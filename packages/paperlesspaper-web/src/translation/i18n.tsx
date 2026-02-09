import i18n from "i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { initReactI18next } from "react-i18next";
import deJson from "./de.json";
import enJson from "./en.json";
import deJsonGenerated from "./generated/de.json";
import enJsonGenerated from "./generated/en.json";
import nlJsonGenerated from "./generated/nl.json";
import frJsonGenerated from "./generated/fr.json";
import etJsonGenerated from "./generated/et.json";
import seJsonGenerated from "./generated/se.json";
import czJsonGenerated from "./generated/cz.json";

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
      pwa: { ...enJsonGenerated, ...enJson },
    },
    de: { pwa: { ...deJsonGenerated, ...deJson } },
    nl: { pwa: nlJsonGenerated },
    fr: { pwa: frJsonGenerated },
    et: { pwa: etJsonGenerated },
    se: { pwa: seJsonGenerated },
    cz: { pwa: czJsonGenerated },
  },
  //fallbackLng: "en",

  backend: backendOptions,

  debug: import.meta.env.MODE === "production" ? false : true,
  saveMissing: import.meta.env.MODE === "production" ? false : true,
  // have a common namespace used around the full app
  ns: ["pwa"],
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
