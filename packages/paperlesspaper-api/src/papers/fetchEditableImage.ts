import { ApiError } from "@internetderdinge/api";
import { withDeadline } from "../utils/withDeadline";

/** Keep signed storage URLs and upstream response bodies out of API errors. */
export const fetchEditableImage = async (signedUrl: string) => {
  try {
    return await withDeadline(async (signal) => {
      const response = await fetch(signedUrl, { signal });
      if (!response.ok) {
        await response.body?.cancel();
        throw new ApiError(
          response.status === 404 ? 404 : 502,
          response.status === 404
            ? "Editable image data was not found"
            : "Could not retrieve editable image data",
        );
      }
      return await response.json();
    }, "Editable image download", 20_000);
  } catch (error) {
    if (error instanceof ApiError) throw error;
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    throw new ApiError(
      timedOut ? 504 : 502,
      timedOut
        ? "Retrieving editable image data timed out"
        : "Could not retrieve editable image data",
    );
  }
};
