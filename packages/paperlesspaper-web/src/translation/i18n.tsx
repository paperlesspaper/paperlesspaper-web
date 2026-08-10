import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import deJson from "./de.json";
import enJson from "./en.json";
import nlJson from "./nl.json";
import frJson from "./fr.json";
import etJson from "./et.json";
import seJson from "./se.json";
import czJson from "./cz.json";

import deJsonGenerated from "./generated/de.json";
import enJsonGenerated from "./generated/en.json";
import nlJsonGenerated from "./generated/nl.json";
import frJsonGenerated from "./generated/fr.json";
import etJsonGenerated from "./generated/et.json";
import seJsonGenerated from "./generated/se.json";
import czJsonGenerated from "./generated/cz.json";

import deJsonGeneratedPwa from "./generated-pwa/de.json";
import enJsonGeneratedPwa from "./generated-pwa/en.json";
import nlJsonGeneratedPwa from "./generated-pwa/nl.json";
import frJsonGeneratedPwa from "./generated-pwa/fr.json";
import etJsonGeneratedPwa from "./generated-pwa/et.json";
import seJsonGeneratedPwa from "./generated-pwa/se.json";
import czJsonGeneratedPwa from "./generated-pwa/cz.json";

import { backendOptions } from "./backendOptions";
import HttpBackend from "i18next-http-backend";

const options = {
  //caches: ["localStorage", "cookie"],
  convertDetectedLanguage: (lng) => {
    // console.log("convertDetectedLanguage", lng);

    const language = lng.toLowerCase().replace("-", "_").split("_")?.[0];
    if (language === "sv") {
      return "se";
    }
    return language.length === 2 ? language : "en";
  },
};

i18n.use(LanguageDetector);

if (import.meta.env.MODE !== "production") {
  i18n.use(HttpBackend);
}
i18n.use(initReactI18next).init({
  // <HttpBackendOptions>
  detection: options,
  resources: {
    en: {
      "plp-pwa": { ...enJsonGenerated, ...enJson },
      pwa: { ...enJsonGeneratedPwa, ...enJson },
    },
    de: {
      "plp-pwa": { ...deJsonGenerated, ...deJson },
      pwa: { ...deJsonGeneratedPwa, ...deJson },
    },
    nl: {
      "plp-pwa": { ...nlJsonGenerated, ...nlJson },
      pwa: { ...nlJsonGeneratedPwa, ...nlJson },
    },
    fr: {
      "plp-pwa": { ...frJsonGenerated, ...frJson },
      pwa: { ...frJsonGeneratedPwa, ...frJson },
    },
    et: {
      "plp-pwa": { ...etJsonGenerated, ...etJson },
      pwa: { ...etJsonGeneratedPwa, ...etJson },
    },
    se: {
      "plp-pwa": { ...seJsonGenerated, ...seJson },
      pwa: { ...seJsonGeneratedPwa, ...seJson },
    },
    cz: {
      "plp-pwa": { ...czJsonGenerated, ...czJson },
      pwa: { ...czJsonGeneratedPwa, ...czJson },
    },
  },
  //fallbackLng: "en",

  backend: backendOptions,

  debug: import.meta.env.MODE === "production" ? false : true,
  saveMissing: import.meta.env.MODE === "production" ? false : true,
  // have a common namespace used around the full app
  ns: ["plp-pwa", "pwa"],
  defaultNS: "pwa",

  keySeparator: false, // we use content as keys

  interpolation: {
    escapeValue: false,
  },
});
i18n.on("languageChanged", (lng) => {
  if (typeof document !== "undefined") {
    document.documentElement.lang = lng;
  }
});

export default i18n;
