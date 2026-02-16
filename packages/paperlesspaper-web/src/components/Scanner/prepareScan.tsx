//import convert from "xml-js";
export default function prepareScan({ text, format }) {
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

  return text;
}
