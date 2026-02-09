const languages = {
  de: {
    name: "german",
    deepl: "de",
    auth0: "de",
    original: "deutsch",
  },
  en: {
    name: "english",
    deepl: "en-GB",
    auth0: "en",
    original: "english",
  },
  fr: {
    name: "french",
    deepl: "fr",
    auth0: "fr",
    original: "français",
    experimental: true,
  },
  nl: {
    name: "dutch",
    deepl: "nl",
    auth0: "nl",
    original: "nederlands",
    experimental: true,
  },
  et: {
    name: "estonian",
    deepl: "et",
    auth0: "et",
    original: "eesti",
    experimental: true,
  },
  se: {
    name: "swedish",
    deepl: "se",
    auth0: "sv",
    original: "svenska",
  },
  cz: {
    name: "czech",
    deepl: "cz",
    auth0: "cs",
    original: "ceština",
    experimental: true,
  },
};

export default languages;

export const languageToAuth0 = (language: string): string => {
  return (
    languages[language as keyof typeof languages]?.auth0 ?? languages.en.auth0
  );
};
