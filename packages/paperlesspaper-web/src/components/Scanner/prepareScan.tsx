import gs1js from "gs1js";
//import convert from "xml-js";
import moment from "moment";
import axios from "axios";

export default function prepareScan({ text, format, numBits }) {
  console.log("scan result", text, format);
  if (!text) return;

  /* Paperlesspaper device onboarding link */
  if (text.startsWith("https://paperlesspaper.de/b?d=")) {
    // extract all params using querystring

    const urlParams = new URLSearchParams(
      text.replace("https://paperlesspaper.de/b", ""),
    );
    const params = Object.fromEntries(urlParams.entries());
    console.log("Paperlesspaper params", params);
    return params;
    //return text.replace("https://paperlesspaper.de/b?d=", "");
  }

  // App QR-Code
  if (applicationIdentifiers.find((e) => e.identifier === "9N")) {
    return applicationIdentifiers.find((e) => e.identifier === "9N").value;
  }

  if (
    applicationIdentifiers &&
    // applicationIdentifiers.length === 4 &&
    applicationIdentifiers.find(
      (e) =>
        e.identifier === "21" &&
        typeof e.value === "string" &&
        e.value.substring(0, 3) === "nrf",
    )
  ) {
    const nrfNumber = applicationIdentifiers.find((e) => e.identifier === "21");
    return nrfNumber.value;
  }

  return text;
}
