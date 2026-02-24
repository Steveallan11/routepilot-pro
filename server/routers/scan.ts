import { z } from "zod";
import { publicProcedure, router } from "../_core/trpc";
import { invokeLLM } from "../_core/llm";
import { storagePut } from "../storage";
import { nanoid } from "nanoid";

// Structured output schema for booking extraction — captures everything visible
const bookingSchema = {
  type: "object" as const,
  properties: {
    // Route
    pickupPostcode: {
      type: "string",
      description: "UK postcode of the pickup/departure location (e.g. MK1 1DF). Return empty string if not found.",
    },
    dropoffPostcode: {
      type: "string",
      description: "UK postcode of the dropoff/arrival/destination location (e.g. CR0 4YL). Return empty string if not found.",
    },
    pickupAddress: {
      type: "string",
      description: "Full pickup/departure address as shown on the booking (e.g. '66 Denbigh Road, Bletchley, MK1 1DF'). Return empty string if not found.",
    },
    dropoffAddress: {
      type: "string",
      description: "Full dropoff/arrival/destination address as shown. Return empty string if not found.",
    },

    // Timing
    scheduledPickupDate: {
      type: "string",
      description: "Scheduled pickup date and time in ISO 8601 format (e.g. '2026-02-26T08:30:00'). Return empty string if not found.",
    },
    scheduledDropoffDate: {
      type: "string",
      description: "Scheduled dropoff/delivery/arrival date and time in ISO 8601 format (e.g. '2026-02-26T11:45:00'). Return empty string if not found.",
    },

    // Financials
    deliveryFee: {
      type: "number",
      description: "The payment/remuneration/fee for this job in GBP. Look for £ amounts labelled as remuneration, fee, payment, or rate. Return 0 if not found.",
    },
    fuelDeposit: {
      type: "number",
      description: "Any separate fuel deposit or fuel card amount in GBP. Return 0 if not found.",
    },

    // Route metrics
    distanceMiles: {
      type: "number",
      description: "Distance in miles shown on the booking. Return 0 if not found.",
    },
    durationMins: {
      type: "number",
      description: "Estimated journey duration in minutes (e.g. 100 for 1h 40m). Return 0 if not found.",
    },

    // Broker / booking metadata
    brokerName: {
      type: "string",
      description: "Name of the broker or company (e.g. 'Waylands Group', 'BCA', 'Movex', 'ALD Automotive'). Return empty string if not found.",
    },
    jobReference: {
      type: "string",
      description: "Booking reference or job number (e.g. '#5033851-1450182', 'JOB-12345'). Return empty string if not found.",
    },

    // Vehicle details
    vehicleMake: {
      type: "string",
      description: "Vehicle manufacturer/make (e.g. 'BMW', 'Ford', 'Toyota'). Return empty string if not found.",
    },
    vehicleModel: {
      type: "string",
      description: "Vehicle model name (e.g. '3 Series', 'Focus', 'Corolla'). Return empty string if not found.",
    },
    vehicleReg: {
      type: "string",
      description: "Vehicle registration plate (e.g. 'AB12 CDE'). Return empty string if not found.",
    },
    vehicleColour: {
      type: "string",
      description: "Vehicle colour (e.g. 'White', 'Black', 'Silver'). Return empty string if not found.",
    },
    vehicleFuelType: {
      type: "string",
      description: "Vehicle fuel type: one of 'petrol', 'diesel', 'electric', 'hybrid', or 'unknown'. Return 'unknown' if not found.",
    },

    // Contact / consignee details
    pickupContactName: {
      type: "string",
      description: "Name of the person or company at the pickup location (e.g. 'Daniel Moore', 'BMW Dealership'). Return empty string if not found.",
    },
    pickupContactPhone: {
      type: "string",
      description: "Phone number for the pickup contact. Return empty string if not found.",
    },
    dropoffContactName: {
      type: "string",
      description: "Name of the person or company at the dropoff location (e.g. 'Jake Weatherall', 'Waylands Group'). Return empty string if not found.",
    },
    dropoffContactPhone: {
      type: "string",
      description: "Phone number for the dropoff contact. Return empty string if not found.",
    },
    customerName: {
      type: "string",
      description: "Name of the customer/owner of the vehicle if different from pickup/dropoff contacts. Return empty string if not found.",
    },

    // Notes
    notes: {
      type: "string",
      description: "Any additional instructions, special requirements, or notes visible on the booking. Return empty string if not found.",
    },

    // Confidence
    confidence: {
      type: "number",
      description: "Your confidence in the extraction from 0 to 1. Use 0.9+ if all key fields found clearly.",
    },
  },
  required: [
    "pickupPostcode", "dropoffPostcode", "pickupAddress", "dropoffAddress",
    "scheduledPickupDate", "scheduledDropoffDate",
    "deliveryFee", "fuelDeposit", "distanceMiles", "durationMins",
    "brokerName", "jobReference",
    "vehicleMake", "vehicleModel", "vehicleReg", "vehicleColour", "vehicleFuelType",
    "pickupContactName", "pickupContactPhone",
    "dropoffContactName", "dropoffContactPhone",
    "customerName", "notes", "confidence",
  ],
  additionalProperties: false,
};

export const scanRouter = router({
  // Upload image to S3 and return a URL for the LLM to read
  uploadImage: publicProcedure
    .input(
      z.object({
        base64Data: z.string(),
        mimeType: z.string().default("image/jpeg"),
      })
    )
    .mutation(async ({ input }) => {
      const { base64Data, mimeType } = input;
      const buffer = Buffer.from(base64Data, "base64");

      if (buffer.length > 10 * 1024 * 1024) {
        throw new Error("Image too large. Please use an image under 10MB.");
      }

      const ext = mimeType.includes("png") ? "png" : "jpg";
      const key = `booking-scans/${nanoid(16)}.${ext}`;
      const { url } = await storagePut(key, buffer, mimeType);

      return { url, key };
    }),

  // Extract ALL booking details from an image URL using LLM vision
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
              "You are an expert at reading UK car delivery and transport booking screenshots. Extract every piece of information visible in the image and return it as structured JSON. Be precise with UK postcodes — they follow the format like 'MK1 1DF', 'CR0 4YL'. If a postcode has no space, add the correct space. Extract vehicle registration plates exactly as shown. Extract all dates and times in ISO 8601 format. Extract all contact names, addresses, and any special instructions.",
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
                text: "Please extract ALL job details from this booking screenshot. I need: pickup and dropoff full addresses with postcodes, scheduled pickup and dropoff times, delivery fee/remuneration, distance in miles, duration, broker/company name, job reference, vehicle make/model/registration/colour/fuel type, pickup and dropoff contact names and phone numbers, customer name, and any special instructions or notes.",
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

      // Normalise UK postcode spacing
      const normalisePostcode = (pc: string): string => {
        if (!pc) return "";
        const clean = pc.replace(/\s+/g, "").toUpperCase();
        if (clean.length >= 5) {
          return `${clean.slice(0, -3)} ${clean.slice(-3)}`;
        }
        return clean;
      };

      // Normalise vehicle fuel type
      const normaliseFuelType = (ft: string): "petrol" | "diesel" | "electric" | "hybrid" | "unknown" => {
        const f = (ft || "").toLowerCase();
        if (f.includes("petrol")) return "petrol";
        if (f.includes("diesel")) return "diesel";
        if (f.includes("electric")) return "electric";
        if (f.includes("hybrid")) return "hybrid";
        return "unknown";
      };

      return {
        // Route
        pickupPostcode: normalisePostcode(extracted.pickupPostcode),
        dropoffPostcode: normalisePostcode(extracted.dropoffPostcode),
        pickupAddress: extracted.pickupAddress || "",
        dropoffAddress: extracted.dropoffAddress || "",

        // Timing
        scheduledDate: extracted.scheduledPickupDate || "",
        scheduledDropoffDate: extracted.scheduledDropoffDate || "",

        // Financials
        deliveryFee: Number(extracted.deliveryFee) || 0,
        fuelDeposit: Number(extracted.fuelDeposit) || 0,

        // Route metrics
        distanceMiles: Number(extracted.distanceMiles) || 0,
        durationMins: Number(extracted.durationMins) || 0,

        // Broker / booking
        brokerName: extracted.brokerName || "",
        jobReference: extracted.jobReference || "",

        // Vehicle
        vehicleMake: extracted.vehicleMake || "",
        vehicleModel: extracted.vehicleModel || "",
        vehicleReg: (extracted.vehicleReg || "").toUpperCase(),
        vehicleColour: extracted.vehicleColour || "",
        vehicleFuelType: normaliseFuelType(extracted.vehicleFuelType),

        // Contacts
        pickupContactName: extracted.pickupContactName || "",
        pickupContactPhone: extracted.pickupContactPhone || "",
        dropoffContactName: extracted.dropoffContactName || "",
        dropoffContactPhone: extracted.dropoffContactPhone || "",
        customerName: extracted.customerName || "",

        // Notes
        notes: extracted.notes || "",

        confidence: Number(extracted.confidence) || 0.5,
      };
    }),
});
