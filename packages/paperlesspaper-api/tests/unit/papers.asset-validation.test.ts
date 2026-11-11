import { expect, it, vi } from "vitest";
vi.mock("@internetderdinge/api", async () => {
  const { z } = await import("zod");
  const id = z.string().regex(/^[a-f\d]{24}$/i);
  return {
    zObjectId: id,
    zObjectIdFor: () => id,
    zPagination: { query: z.object({}) },
  };
});
import { generateSignedFileUrlSchema } from "../../src/papers/papers.validation";

it.each([
  undefined,
  ".png",
  "original.png",
  "original.jpg",
  "thumbnail.jpg",
  "editable.json",
])("allows the supported paper asset %s", (kind) => {
  expect(generateSignedFileUrlSchema.body.safeParse({ kind }).success).toBe(
    true
  );
});
it.each([
  "/../other-paper.png",
  "../../private",
  "%2f..%2fprivate",
  "\\..\\private",
  "https://other.example",
  "private.json",
])("rejects arbitrary object suffix %s before signing or fetching", (kind) => {
  expect(generateSignedFileUrlSchema.body.safeParse({ kind }).success).toBe(
    false
  );
});
it("only downloads editable JSON through the API", () => {
  expect(
    generateSignedFileUrlSchema.body.safeParse({
      kind: "editable.json",
      return: "json",
    }).success
  ).toBe(true);
  expect(
    generateSignedFileUrlSchema.body.safeParse({
      kind: "original.png",
      return: "json",
    }).success
  ).toBe(false);
});
