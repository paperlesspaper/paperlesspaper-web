import { useLocation } from "react-router-dom";
import qs, { ParsedQs } from "qs";

export default function useQs(): Omit<ParsedQs, "deleted"> {
  const location = useLocation();

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { deleted, ...result } = qs.parse(location.search, {
    ignoreQueryPrefix: true,
  });
  return result;
}
