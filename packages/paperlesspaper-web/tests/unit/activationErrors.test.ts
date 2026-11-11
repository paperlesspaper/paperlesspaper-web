import { expect, it } from "vitest";
import {
  activationErrorMessage,
  isTemporaryActivationError,
  isAlreadyRegisteredError,
} from "../../src/helpers/devices/activationErrors";

it.each([502, 503, 504, "FETCH_ERROR", "TIMEOUT_ERROR"])(
  "allows bounded retry for %s",
  (status) => {
    expect(isTemporaryActivationError({ status })).toBe(true);
  }
);
it.each([400, 401, 403, 404, 409, 422, 500])(
  "does not automatically retry %s",
  (status) => {
    expect(isTemporaryActivationError({ status })).toBe(false);
  }
);
it("recognizes an HTML gateway error without treating successful malformed JSON as transient", () => {
  expect(
    isTemporaryActivationError({ status: "PARSING_ERROR", originalStatus: 502 })
  ).toBe(true);
  expect(
    isTemporaryActivationError({ status: "PARSING_ERROR", originalStatus: 200 })
  ).toBe(false);
});

it("does not mistake an ownership race for a legacy registration conflict", () => {
  const conflict = {
    status: 409,
    data: { message: "Device assignment changed; check activation again" },
  };
  expect(isAlreadyRegisteredError(conflict)).toBe(false);
  expect(activationErrorMessage(conflict)).toContain("do not need to reset");
  expect(
    isAlreadyRegisteredError({
      status: 409,
      data: { available: false, message: "Device is already registered" },
    })
  ).toBe(true);
  expect(
    isAlreadyRegisteredError({
      status: 409,
      data: {
        message: "Device is already registered in this organization",
        device: { id: "device" },
      },
    })
  ).toBe(true);
  expect(
    isAlreadyRegisteredError({
      status: 409,
      data: { message: "Device is already registered" },
    })
  ).toBe(true);
});
it("gives organization and connection errors distinct actionable messages", () => {
  expect(activationErrorMessage({ status: 403 })).toContain("organization");
  expect(activationErrorMessage({ status: 401 })).toContain("sign in");
  expect(activationErrorMessage({ status: 502 })).toContain(
    "internet connection"
  );
  expect(activationErrorMessage({ status: 502 })).toContain(
    "do not need to reset"
  );
  expect(
    activationErrorMessage({
      status: 400,
      data: { message: "private upstream details" },
    })
  ).not.toContain("private upstream details");
});
