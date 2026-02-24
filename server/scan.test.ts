import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock the LLM and storage modules before importing the router
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

vi.mock("./storage", () => ({
  storagePut: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
import { storagePut } from "./storage";
import { scanRouter } from "./routers/scan";
import type { TrpcContext } from "./_core/context";

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("scan.uploadImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uploads a valid image and returns a URL", async () => {
    (storagePut as ReturnType<typeof vi.fn>).mockResolvedValue({
      key: "booking-scans/abc123.jpg",
      url: "https://cdn.example.com/booking-scans/abc123.jpg",
    });

    const caller = scanRouter.createCaller(createPublicContext());
    // 1x1 white JPEG in base64
    const base64Data =
      "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/2wBDAQkJCQwLDBgNDRgyIRwhMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjIyMjL/wAARCAABAAEDASIAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAwDAQACEQMRAD8AJQAB/9k=";

    const result = await caller.uploadImage({ base64Data, mimeType: "image/jpeg" });

    expect(result.url).toBe("https://cdn.example.com/booking-scans/abc123.jpg");
    expect(storagePut).toHaveBeenCalledOnce();
  });

  it("rejects images over 10MB", async () => {
    const caller = scanRouter.createCaller(createPublicContext());
    // Generate a base64 string that decodes to >10MB
    const largeBase64 = Buffer.alloc(11 * 1024 * 1024).toString("base64");

    await expect(
      caller.uploadImage({ base64Data: largeBase64, mimeType: "image/jpeg" })
    ).rejects.toThrow("Image too large");
  });
});

describe("scan.extractBooking", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("extracts booking details from a valid LLM response", async () => {
    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              pickupPostcode: "MK11DF",
              dropoffPostcode: "CR04YL",
              deliveryFee: 74,
              fuelDeposit: 0,
              distanceMiles: 89,
              durationMins: 100,
              pickupAddress: "66 Denbigh Road, MK1 1DF Bletchley",
              dropoffAddress: "Wilcomatic Ltd Unit 5, Commerce Park 19 Commerce Way, CR0 4YL Croydon",
              brokerName: "Ald Automotive",
              scheduledDate: "2026-02-19T14:00:00",
              jobReference: "#5033851-1450182",
              confidence: 0.95,
            }),
          },
        },
      ],
    });

    const caller = scanRouter.createCaller(createPublicContext());
    const result = await caller.extractBooking({
      imageUrl: "https://cdn.example.com/booking-scans/test.jpg",
    });

    // Postcodes should be normalised with correct spacing
    expect(result.pickupPostcode).toBe("MK1 1DF");
    expect(result.dropoffPostcode).toBe("CR0 4YL");
    expect(result.deliveryFee).toBe(74);
    expect(result.distanceMiles).toBe(89);
    expect(result.durationMins).toBe(100);
    expect(result.brokerName).toBe("Ald Automotive");
    expect(result.confidence).toBe(0.95);
  });

  it("normalises postcodes with missing spaces correctly", async () => {
    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValue({
      choices: [
        {
          message: {
            content: JSON.stringify({
              pickupPostcode: "SW1A1AA",
              dropoffPostcode: "M11AE",
              deliveryFee: 50,
              fuelDeposit: 0,
              distanceMiles: 0,
              durationMins: 0,
              pickupAddress: "",
              dropoffAddress: "",
              brokerName: "",
              scheduledDate: "",
              jobReference: "",
              confidence: 0.8,
            }),
          },
        },
      ],
    });

    const caller = scanRouter.createCaller(createPublicContext());
    const result = await caller.extractBooking({
      imageUrl: "https://cdn.example.com/booking-scans/test2.jpg",
    });

    expect(result.pickupPostcode).toBe("SW1A 1AA");
    expect(result.dropoffPostcode).toBe("M1 1AE");
  });

  it("handles missing LLM response gracefully", async () => {
    (invokeLLM as ReturnType<typeof vi.fn>).mockResolvedValue({
      choices: [],
    });

    const caller = scanRouter.createCaller(createPublicContext());
    await expect(
      caller.extractBooking({ imageUrl: "https://cdn.example.com/test.jpg" })
    ).rejects.toThrow("No response from AI");
  });
});
