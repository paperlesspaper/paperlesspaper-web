import { useParams } from "react-router-dom";

export default function useCalendarUrl() {
  const { organization } = useParams();

  return function ({ kind, entry, exists }) {
    if (exists === false) {
      return `/${organization}/calendar/`;
    }
    if (kind === "device") {
      return `/${organization}/calendar/device/${entry || ""}`;
    }
    return `/${organization}/calendar/user/${entry || ""}`;
  };
}
