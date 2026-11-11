export const isTemporaryActivationError = (error: any) => {
  const status =
    error?.status === "PARSING_ERROR" ? error.originalStatus : error?.status;
  return [502, 503, 504, "FETCH_ERROR", "TIMEOUT_ERROR"].includes(status);
};

// The legacy API uses 409 for an existing registration. A concurrent claim also
// returns 409, but does not mean that the user must reset the frame.
export const isAlreadyRegisteredError = (error: any) =>
  error?.status === 409 &&
  (error?.data?.available === false ||
    !!error?.data?.device?.id ||
    [
      "Device is already registered",
      "Device is already registered in this organization",
    ].includes(error?.data?.message));

export function activationErrorMessage(error: any) {
  if (error?.status === 401) {
    return "Please sign in again to set up your frame.";
  }
  if (error?.status === 403) {
    return "You do not have access to this organization. Select an organization you belong to, or ask its administrator for access.";
  }
  if (error?.status === 409) {
    return "The device assignment changed during setup. Please try again. You do not need to reset your frame.";
  }
  if (isTemporaryActivationError(error)) {
    return "We could not confirm the activation. Check your internet connection and try again. You do not need to reset your frame.";
  }
  return "We could not set up your frame. Please try again or contact support with your device ID.";
}
