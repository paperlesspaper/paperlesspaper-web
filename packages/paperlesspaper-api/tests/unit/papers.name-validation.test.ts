import { describe, expect, it, vi } from "vitest";

vi.mock("@internetderdinge/api", async () => {
  const { z } = await import("zod");
  const id = z.string().regex(/^[a-f\d]{24}$/i);
  return {
    zObjectId: id,
    zObjectIdFor: () => id,
    zPagination: { query: z.object({}) },
  };
});
import {
  createPaperSchema,
  updatePaperSchema,
} from "../../src/papers/papers.validation";

// validateZod applies strict() before parsing incoming HTTP bodies.
describe.each([
  ["create", createPaperSchema.body],
  ["update", updatePaperSchema.body],
] as const)("%s paper name validation", (_, schema) => {
  const body = {
    deviceId: "aaaaaaaaaaaaaaaaaaaaaaaa",
    organization: "bbbbbbbbbbbbbbbbbbbbbbbb",
    kind: "slides",
    meta: {
      selectedPapers: { cccccccccccccccccccccccc: true },
      currentSlide: 0,
    },
  };

  it("accepts and preserves the slideshow name from the library", () => {
    expect(schema.strict().parse({ ...body, name: "10/2026" })).toMatchObject({
      name: "10/2026",
    });
  });
  it("trims the name and allows unnamed papers", () => {
    expect(schema.strict().parse({ ...body, name: "  Urlaub  " }).name).toBe(
      "Urlaub",
    );
    expect(schema.strict().safeParse(body).success).toBe(true);
  });
  it("continues to reject invalid names and unknown fields", () => {
    expect(
      schema.strict().safeParse({ ...body, name: { bad: true } }).success,
    ).toBe(false);
    expect(
      schema.strict().safeParse({ ...body, unsupported: "value" }).success,
    ).toBe(false);
  });
});
