import { useLocation } from "react-router-dom";
import qs, { ParsedQs } from "qs";

export const getQueryStringValue = (value: unknown) => {
  if (typeof value === "string") return value;
  if (Array.isArray(value) && typeof value[0] === "string") return value[0];
  return undefined;
};

export default function useQs(): Omit<ParsedQs, "deleted"> {
  const location = useLocation();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { deleted, ...result } = qs.parse(location.search, {
    ignoreQueryPrefix: true,
  });
  return result;
}
