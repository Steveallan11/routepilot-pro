import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

// Structured output schema for booking extraction
const bookingSchema = {
  type: "object" as const,
  properties: {
    pickupPostcode: {
      type: "string",
      description: "UK postcode of the pickup/departure location (e.g. MK1 1DF). Extract from the departure address. Return empty string if not found.",
    },
    dropoffPostcode: {
      type: "string",
      description: "UK postcode of the dropoff/arrival/destination location (e.g. CR0 4YL). Extract from the arrival address. Return empty string if not found.",
    },
    deliveryFee: {
      type: "number",
      description: "The payment/remuneration/fee for this job in GBP (e.g. 74.00). Look for £ amounts labelled as remuneration, fee, payment, or rate. Return 0 if not found.",
    },
    fuelDeposit: {
      type: "number",
      description: "Any separate fuel deposit or fuel card amount in GBP. Return 0 if not found.",
    },
    distanceMiles: {
      type: "number",
      description: "Distance in miles shown on the booking (e.g. 89). Return 0 if not found.",
    },
    durationMins: {
      type: "number",
      description: "Estimated journey duration in minutes (e.g. 100 for 1 hour 40 mins). Return 0 if not found.",
    },
    pickupAddress: {
      type: "string",
      description: "Full pickup/departure address as shown (e.g. '66 Denbigh Road, MK1 1DF Bletchley'). Return empty string if not found.",
    },
    dropoffAddress: {
      type: "string",
      description: "Full dropoff/arrival address as shown. Return empty string if not found.",
    },
    brokerName: {
      type: "string",
      description: "Name of the broker or company (e.g. 'Ald Automotive', 'BCA', 'Movex'). Return empty string if not found.",
    },
    scheduledDate: {
      type: "string",
      description: "Scheduled pickup date and time in ISO 8601 format (e.g. '2026-02-19T14:00:00'). Return empty string if not found.",
    },
    jobReference: {
      type: "string",
      description: "Booking reference or job number (e.g. '#5033851-1450182'). Return empty string if not found.",
    },
    confidence: {
      type: "number",
      description: "Your confidence in the extraction from 0 to 1. Use 0.9+ if all key fields found clearly, 0.5-0.9 if some fields uncertain, below 0.5 if image is unclear.",
    },
  },
  required: [
    "pickupPostcode",
    "dropoffPostcode",
    "deliveryFee",
    "fuelDeposit",
    "distanceMiles",
    "durationMins",
    "pickupAddress",
    "dropoffAddress",
    "brokerName",
    "scheduledDate",
    "jobReference",
    "confidence",
  ],
  additionalProperties: false,
};

export const scanRouter = router({
  // Upload image to S3 and return a URL for the LLM to read
  uploadImage: publicProcedure
    .input(
      z.object({
        base64Data: z.string(), // base64 encoded image
        mimeType: z.string().default("image/jpeg"),
      })
    )
    .mutation(async ({ input }) => {
      const { base64Data, mimeType } = input;

      // Decode base64 to buffer
      const buffer = Buffer.from(base64Data, "base64");

      // Validate size (max 10MB)
      if (buffer.length > 10 * 1024 * 1024) {
        throw new Error("Image too large. Please use an image under 10MB.");
      }

      const ext = mimeType.includes("png") ? "png" : "jpg";
      const key = `booking-scans/${nanoid(16)}.${ext}`;
      const { url } = await storagePut(key, buffer, mimeType);

      return { url, key };
    }),

  // Extract booking details from an image URL using LLM vision
  extractBooking: publicProcedure
    .input(
      z.object({
        imageUrl: z.string().url(),
      })
    )
    .mutation(async ({ input }) => {
      const response = await invokeLLM({
        messages: [
          {
            role: "system",
            content:
              "You are an expert at reading UK car delivery booking screenshots. Extract all relevant job details from the image and return them as structured JSON. Be precise with UK postcodes — they follow the format like 'MK1 1DF', 'CR0 4YL', 'SW1A 1AA'. If a postcode has no space, add the correct space (e.g. 'CR04YL' → 'CR0 4YL').",
          },
          {
            role: "user",
            content: [
              {
                type: "image_url",
                image_url: {
                  url: input.imageUrl,
                  detail: "high",
                },
              },
              {
                type: "text",
                text: "Please extract all job details from this booking screenshot. Focus on: pickup postcode, dropoff postcode, delivery fee/remuneration, distance in miles, duration in minutes, addresses, broker name, scheduled date/time, and job reference number.",
              },
            ],
          },
        ],
        response_format: {
          type: "json_schema",
          json_schema: {
            name: "booking_extraction",
            strict: true,
            schema: bookingSchema,
          },
        },
      });

      const content = response.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("No response from AI. Please try again.");
      }

      const extracted = typeof content === "string" ? JSON.parse(content) : content;

      // Normalise postcode spacing
      const normalisePostcode = (pc: string): string => {
        if (!pc) return "";
        const clean = pc.replace(/\s+/g, "").toUpperCase();
        // UK postcode: last 3 chars are always the inward code
        if (clean.length >= 5) {
          return `${clean.slice(0, -3)} ${clean.slice(-3)}`;
        }
        return clean;
      };

      return {
        pickupPostcode: normalisePostcode(extracted.pickupPostcode),
        dropoffPostcode: normalisePostcode(extracted.dropoffPostcode),
        deliveryFee: Number(extracted.deliveryFee) || 0,
        fuelDeposit: Number(extracted.fuelDeposit) || 0,
        distanceMiles: Number(extracted.distanceMiles) || 0,
        durationMins: Number(extracted.durationMins) || 0,
        pickupAddress: extracted.pickupAddress || "",
        dropoffAddress: extracted.dropoffAddress || "",
        brokerName: extracted.brokerName || "",
        scheduledDate: extracted.scheduledDate || "",
        jobReference: extracted.jobReference || "",
        confidence: Number(extracted.confidence) || 0.5,
      };
    }),
});
