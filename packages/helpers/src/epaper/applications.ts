export const applications = [
  {
    id: "image",
    name: "Image",
    description: "Create an image or upload a photo",
    tags: ["highlight"],
  },
  {
    id: "calendar",
    name: "Calendar",
    description: "Display a calendar",
    url: "https://apps.paperlesspaper.de/calendar",
    settings: {
      kind: {},
      language: {},
      color: {},
    },
  },
  {
    id: "google-calendar",
    name: "Google Calendar",
    status: "beta",
    description: "Connect to a Google Calendar",
    url: "https://apps.paperlesspaper.de/google-calendar",
    settings: {
      kind: {},
      color: {},
      dayRange: {},
      language: {},
      highlightToday: {},
      highlightScale: {},
      maxEvents: {},
    },
  },
  {
    id: "weather",
    name: "Weather",
    description: "Display the weather of the day",
    url: "https://apps.paperlesspaper.de/weather",
    settings: {
      location: {},
      language: ["de", "en", "fr", "es", "it"],
      kind: {},
      color: {},
      iconstyle: {},
      displayLastUpdated: {},
    },
  },
  {
    id: "rss",
    name: "RSS-Feed",
    description: "Show the latest news via RSS-Feed",
    url: "https://apps.paperlesspaper.de/rss",
    settings: {
      feed: {},

      kind: {},
      color: {},
    },
  },
  /* {
    id: "apple-photos-random",
    name: "Apple Photos (Random)",
    description: "Show a random image from a public Apple Photos shared album",
    status: "beta",
    url: "https://apps.paperlesspaper.de/apple-photos-random",
    settings: {
      albumUrl: {},
      refreshSeconds: {},
      fit: {},
      showCaption: {},
    },
  }, */
  {
    id: "wikipedia",
    name: "Wikipedia",
    description: "Article of the day or Today in history",
    url: "https://apps.paperlesspaper.de/wikipedia",
    settings: {
      location: {},
      language: ["de", "en"],
      kind: {},
      color: {},
    },
  },
  {
    id: "website",
    name: "Website",
    description: "Show any website",
    settings: {
      location: {},

      language: {},
      kind: {},
      color: {},
    },
  },
  {
    id: "plugin",
    name: "Integration Plugin",
    description: "Install an integration via a config.json URL",
    status: "beta",
    settings: {},
  },
  {
    id: "baby",
    name: "Birth & Baby",
    description: "Facts for the current week of your babys development",
    status: "beta",
    url: "https://apps.paperlesspaper.de/babybirth",
    settings: {
      color: {},
      language: {},
      birthdate: {},
    },
  },
  {
    id: "movies",
    name: "Upcoming Movies",
    description: "Show upcoming movies in theaters",
    status: "beta",
    url: "https://apps.paperlesspaper.de/upcomingmovies",
    settings: {
      color: {},
      language: {},
    },
  },
  {
    id: "slides",
    name: "Slideshow",
    status: "beta",
    description: "Rotation of images and integrations",
    settings: {},
    tags: ["highlight"],
  },
  /* {
    id: "google-keep",
    name: "Google Notes",
    description: "Display your Google Notes",
    status: "beta",
    url: "https://apps.paperlesspaper.de/google-notes",
    settings: {
      kind: {},
      color: {},
    },
  },*/
  {
    id: "days-left",
    name: "Days left",
    description: "Show the days left until a specific date",
    status: "beta",
    url: "https://apps.paperlesspaper.de/days-left",
    settings: {
      from: {},
      date: {},
      kind: {},
      color: {},
      accent: {},
      description: {},
      language: ["de", "en", "fr", "es", "it"],
    },
  },
  {
    id: "days-since",
    name: "Days since",
    description: "Show the days since a specific date",
    status: "beta",
    url: "https://apps.paperlesspaper.de/days-since",
    settings: {
      from: {},
      kind: {},
      color: {},
      accent: {},
      description: {},
      language: ["de", "en", "fr", "es", "it"],
    },
  },
  {
    id: "sunrise",
    name: "Sunrise & Sunset",
    description: "Show sunrise and sunset times for your location",
    status: "beta",
    url: "https://apps.paperlesspaper.de/sun",
    settings: {
      location: {},
      language: ["de", "en", "fr", "es", "it"],
      kind: {},
      color: {},
    },
  },
  {
    id: "apothekennotdienst",
    name: "Apotheken-Notdienst",
    description: "Display on-call pharmacies near your location",
    status: "beta",
    url: "https://apps.paperlesspaper.de/apothekennotdienst",
    settings: {
      lat: {},
      lon: {},
      radius: {},
      day: {},
      limit: {},
      refreshInterval: {},
      color: {},
      kind: {},
      language: {},
      title: {},
    },
  },
  {
    id: "printer",
    name: "Printer",
    description: "Let's you print from your computer's print dialog",
    status: "beta",
    settings: {},
  },
];

export function applicationsByKind(application): any {
  const result = applications.find((e) => e.id === application);
  return result;
}

// Days left this year (Days until)
// https://usetrmnl.com/integrations/days-left-retirement

// Add headers to website

// Language learning

// Google Notes
/*
A high-resolution 2D digital icon for a integration for the paperlesspaper eInk display that can display different other integrations and images randomly or after each other,
featuring slightly 3D shading and highlights to give it depth.
The icon has smooth, beveled edges and appears realistic but minimalistic.
Image should be taken from top. The background is fully transparent, with no shadows or surrounding elements, suitable for use as an icon or in UI design.
*/

/**
 * Returns true if the device kind has the given feature
 */
/*
  export function deviceKindHasFeature(
    feature:
      | "analog"
      | "wifi"
      | "nbiot"
      | "code7"
      | "sensor"
      | "payment"
      | "anabox-smart"
      | "intakes1"
      | "intakes3"
      | "intakes4"
      | "intakes5"
      | "intakes7"
      | "stationaer"
      | "tray-colors"
      | "nuechtern-bedarf"
      | "week-colors"
      | "day-colors"
      | "alt-device",
    kind?: (typeof deviceList)[number]["id"]
  ): boolean {
    if (!kind) return false;
    const result = deviceList.find((e) => e.id === kind);
    if (!result) return false;
    return result.features.includes(feature);
  }
    */
