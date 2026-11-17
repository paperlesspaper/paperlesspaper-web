import type { BatteryWarning } from "./batteryPreference.js";

const messages = {
  de: [
    "{{name}}: Batterie fast leer",
    "Die Batterien deines Geräts sind fast leer. Bitte tausche sie aus oder verbinde das Gerät über USB mit einer Stromquelle.",
    "Gerät öffnen",
  ],
  en: [
    "{{name}}: Battery low",
    "Your device's batteries are running low. Please replace them or connect the device to a USB power source.",
    "Open device",
  ],
  nl: [
    "{{name}}: Batterij bijna leeg",
    "De batterijen van je apparaat zijn bijna leeg. Vervang ze of sluit het apparaat via USB aan op een stroombron.",
    "Apparaat openen",
  ],
  fr: [
    "{{name}} : piles faibles",
    "Les piles de votre appareil sont presque vides. Remplacez-les ou branchez l’appareil à une source d’alimentation USB.",
    "Ouvrir l’appareil",
  ],
  et: [
    "{{name}}: patareid on peaaegu tühjad",
    "Sinu seadme patareid on peaaegu tühjad. Vaheta need välja või ühenda seade USB kaudu toiteallikaga.",
    "Ava seade",
  ],
  se: [
    "{{name}}: Låg batterinivå",
    "Batterierna i din enhet är nästan slut. Byt ut dem eller anslut enheten till en USB-strömkälla.",
    "Öppna enheten",
  ],
  cz: [
    "{{name}}: Slabé baterie",
    "Baterie v zařízení jsou téměř vybité. Vyměňte je nebo připojte zařízení ke zdroji napájení přes USB.",
    "Otevřít zařízení",
  ],
};

const emptyMessages = {
  de: [
    "{{name}}: Batterie leer",
    "Dein Gerät hat sich seit mehr als einem Tag nicht gemeldet. Die Batterien können leer sein. Bitte prüfe Batterien, Stromversorgung und WLAN.",
  ],
  en: [
    "{{name}}: Battery empty",
    "Your device has not reported for more than one day. Its batteries may be empty. Please check the batteries, power supply and Wi-Fi.",
  ],
  nl: [
    "{{name}}: Batterij leeg",
    "Je apparaat heeft zich meer dan een dag niet gemeld. De batterijen kunnen leeg zijn. Controleer de batterijen, stroomvoorziening en wifi.",
  ],
  fr: [
    "{{name}} : piles vides",
    "Votre appareil ne s’est pas manifesté depuis plus d’un jour. Les piles sont peut-être vides. Vérifiez les piles, l’alimentation et le Wi-Fi.",
  ],
  et: [
    "{{name}}: patareid on tühjad",
    "Sinu seade pole rohkem kui ühe päeva jooksul ühendust võtnud. Patareid võivad olla tühjad. Kontrolli patareisid, toidet ja Wi-Fi-ühendust.",
  ],
  se: [
    "{{name}}: Batteriet är tomt",
    "Din enhet har inte hört av sig på mer än ett dygn. Batterierna kan vara slut. Kontrollera batterierna, strömförsörjningen och Wi-Fi.",
  ],
  cz: [
    "{{name}}: Vybité baterie",
    "Zařízení se neozvalo déle než jeden den. Baterie mohou být vybité. Zkontrolujte baterie, napájení a Wi-Fi.",
  ],
};

export function getBatteryMessage(
  name: string,
  language = "en",
  warning: BatteryWarning = "low"
) {
  const base = language.toLowerCase().split(/[-_]/)[0];
  const locale = base === "sv" ? "se" : base === "cs" ? "cz" : base;
  const [title, body, actionButtonText] =
    messages[locale as keyof typeof messages] || messages.en;
  const [warningTitle, warningBody] =
    warning === "empty"
      ? emptyMessages[locale as keyof typeof emptyMessages] || emptyMessages.en
      : [title, body];
  return {
    title: warningTitle.replace("{{name}}", () => name),
    body: warningBody,
    actionButtonText,
  };
}
