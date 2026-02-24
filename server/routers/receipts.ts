import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { getDb } from "../db";
import { receipts } from "../../drizzle/schema";
import { eq, and, desc } from "drizzle-orm";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

export const receiptsRouter = router({
  // Upload image to S3 and extract receipt data via AI
  scanReceipt: protectedProcedure
    .input(z.object({
      base64Data: z.string(),
      mimeType: z.string().default("image/jpeg"),
      jobId: z.number().optional(), // optionally attach to a job immediately
    }))
    .mutation(async ({ ctx, input }) => {
      // Upload to S3
      const buffer = Buffer.from(input.base64Data, "base64");
      const ext = input.mimeType.includes("png") ? "png" : "jpg";
      const fileKey = `receipts/${ctx.user.id}/${nanoid(10)}.${ext}`;
      const { url: imageUrl } = await storagePut(fileKey, buffer, input.mimeType);

      // Extract receipt data via AI vision
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content: `You are a receipt data extraction assistant for UK car delivery drivers. 
Extract all relevant information from the receipt image and return structured JSON.
For fuel receipts, extract litres, price per litre, and fuel type.
For transport receipts (train/bus/taxi), extract the journey details and total cost.
Always return amounts in GBP (£). If a field is not visible or not applicable, return null.`,
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: { url: imageUrl, detail: "high" },
              },
              {
                type: "text",
                text: "Extract all receipt data from this image.",
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "receipt_extraction",
            strict: true,
            schema: {
              type: "object",
              properties: {
                merchantName: { type: ["string", "null"], description: "Name of the merchant/retailer" },
                receiptDate: { type: ["string", "null"], description: "Date of the receipt in ISO 8601 format (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS)" },
                totalAmount: { type: ["number", "null"], description: "Total amount paid in GBP" },
                category: {
                  type: "string",
                  enum: ["fuel", "train", "bus", "taxi", "parking", "toll", "food", "other"],
                  description: "Category of the receipt",
                },
                fuelLitres: { type: ["number", "null"], description: "Litres of fuel purchased (fuel receipts only)" },
                fuelPricePerLitre: { type: ["number", "null"], description: "Price per litre in GBP (fuel receipts only)" },
                fuelType: {
                  type: "string",
                  enum: ["petrol", "diesel", "electric", "unknown"],
                  description: "Type of fuel (fuel receipts only)",
                },
                notes: { type: ["string", "null"], description: "Any additional notes or details visible on the receipt" },
                confidence: { type: "number", description: "Confidence score 0-1 for the extraction accuracy" },
              },
              required: ["merchantName", "receiptDate", "totalAmount", "category", "fuelLitres", "fuelPricePerLitre", "fuelType", "notes", "confidence"],
              additionalProperties: false,
            },
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) throw new Error("AI extraction returned no content");

      const extracted = typeof content === "string" ? JSON.parse(content) : content;

      // Save to DB
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.insert(receipts).values({
        userId: ctx.user.id,
        jobId: input.jobId ?? null,
        imageUrl,
        merchantName: extracted.merchantName ?? null,
        receiptDate: extracted.receiptDate ? new Date(extracted.receiptDate) : null,
        totalAmount: extracted.totalAmount ?? null,
        category: extracted.category ?? "other",
        fuelLitres: extracted.fuelLitres ?? null,
        fuelPricePerLitre: extracted.fuelPricePerLitre ?? null,
        fuelType: extracted.fuelType ?? "unknown",
        notes: extracted.notes ?? null,
        rawExtracted: extracted,
      });

      return {
        imageUrl,
        ...extracted,
      };
    }),

  // List receipts (optionally filtered by job)
  list: protectedProcedure
    .input(z.object({
      jobId: z.number().optional(),
      limit: z.number().min(1).max(100).default(20),
      offset: z.number().min(0).default(0),
    }))
    .query(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) return { receipts: [] };

      const conditions = [eq(receipts.userId, ctx.user.id)];
      if (input.jobId) conditions.push(eq(receipts.jobId, input.jobId));

      const result = await db
        .select()
        .from(receipts)
        .where(and(...conditions))
        .orderBy(desc(receipts.createdAt))
        .limit(input.limit)
        .offset(input.offset);

      return { receipts: result };
    }),

  // Attach a receipt to a job
  attachToJob: protectedProcedure
    .input(z.object({
      receiptId: z.number(),
      jobId: z.number(),
    }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");

      await db.update(receipts)
        .set({ jobId: input.jobId })
        .where(and(eq(receipts.id, input.receiptId), eq(receipts.userId, ctx.user.id)));

      return { success: true };
    }),

  // Delete a receipt
  delete: protectedProcedure
    .input(z.object({ id: z.number() }))
    .mutation(async ({ ctx, input }) => {
      const db = await getDb();
      if (!db) throw new Error("Database unavailable");
      await db.delete(receipts)
        .where(and(eq(receipts.id, input.id), eq(receipts.userId, ctx.user.id)));
      return { success: true };
    }),
});
