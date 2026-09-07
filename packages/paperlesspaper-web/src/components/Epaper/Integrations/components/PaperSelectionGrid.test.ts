import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { haveDifferentFrameSizes } from "./frameSize.js";

describe("haveDifferentFrameSizes", () => {
  it("reports frame kinds with different resolutions", () => {
    assert.equal(haveDifferentFrameSizes("epd7", "openpaper13"), true);
  });

  it("accepts matching frame sizes", () => {
    assert.equal(haveDifferentFrameSizes("epd7", "epd7"), false);
  });

  it("does not warn when a frame kind is missing", () => {
    assert.equal(haveDifferentFrameSizes("epd7", undefined), false);
  });

  it("does not claim a mismatch for an unknown resolution", () => {
    assert.equal(haveDifferentFrameSizes("epd7", "custom-frame"), false);
  });
});
