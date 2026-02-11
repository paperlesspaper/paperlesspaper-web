const deviceList = [
  {
    id: "epaper",
    name: "eInk Display",
    image: "EinkDisplay",
    features: ["epaper", "wifi", "nouser", "battery-offline"],
    deviceNameDetection: "epd-",
    description: "The eInk display for displaying pictures.",
    usage: ["Hausverwaltung", "Wetterstation"],
    usecases: [
      {
        title: "Rufknopf",
        description:
          "Weiterleitung des Fahrtwunsches an Busfahrer für Bedarfshaltestellen",
      },
      { title: "Verspätungen" },
      { title: "Zeit bis Ankunft" },
      { title: "Fahrplanauskunft" },
    ],
    resolution: {
      width: 600,
      height: 448,
    },
  },
  {
    id: "epd7",
    name: "OpenPaper 7",
    image: "EinkDisplay",
    features: ["epaper", "wifi", "spectra6", "nouser", "battery-level"],
    deviceNameDetection: "epd7-",
    description: "The eInk display for displaying pictures.",
    battery: {
      min: 4100,
      max: 4800,
    },
    resolution: {
      width: 800,
      height: 480,
    },
  },
  {
    id: "openpaper13",
    name: "OpenPaper 13",
    image: "EinkDisplay",
    features: ["epaper", "wifi", "spectra6", "nouser", "battery-level"],
    deviceNameDetection: "epd7-",
    description: "The eInk display for displaying pictures.",
    battery: {
      min: 4100,
      max: 4800,
    },
    resolution: {
      width: 1600,
      height: 1200,
    },
  },
  {
    id: "eink-display",
    name: "eInk Display",
    image: "EinkDisplay",
    features: [],
    usage: ["Hausverwaltung", "Wetterstation"],
    usecases: [
      {
        title: "Rufknopf",
        description:
          "Weiterleitung des Fahrtwunsches an Busfahrer für Bedarfshaltestellen",
      },
      { title: "Verspätungen" },
      { title: "Zeit bis Ankunft" },
      { title: "Fahrplanauskunft" },
    ],
  },
]; /*as const*/

export default deviceList;

export function deviceByKind(device): any {
  const result = deviceList.find((e) => e.id === device);
  return result;
}

export function deviceByDeviceName(deviceName): any {
  if (!deviceName) return false;
  const result = deviceList.find((e) => {
    if (!e.deviceNameDetection) return false;

    return deviceName.startsWith(e.deviceNameDetection);
  });
  if (!result) return false;
  return result;
}

/**
 * Returns true if the device kind has the given feature
 */
export function deviceKindHasFeature(
  feature:
    | "analog"
    | "wifi"
    | "epaper"
    | "nbiot"
    | "nouser"
    | "battery-offline"
    | "code7"
    | "sensor"
    | "payment"
    | "alt-device"
    | "battery-level",
  kind?: (typeof deviceList)[number]["id"],
): boolean {
  if (!kind) return false;
  const result = deviceList.find((e) => e.id === kind);
  if (!result) return false;
  return result.features.includes(feature);
}
