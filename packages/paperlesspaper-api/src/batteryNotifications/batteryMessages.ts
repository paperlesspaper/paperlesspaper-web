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

export function getBatteryMessage(name: string, language = "en") {
  const base = language.toLowerCase().split(/[-_]/)[0];
  const locale = base === "sv" ? "se" : base === "cs" ? "cz" : base;
  const [title, body, actionButtonText] =
    messages[locale as keyof typeof messages] || messages.en;
  return {
    title: title.replace("{{name}}", () => name),
    body,
    actionButtonText,
  };
}
