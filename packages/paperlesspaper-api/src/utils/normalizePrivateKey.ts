export const normalizePrivateKey = (value: string) => {
  let key = value.trim();

  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1);
  }

  key = key.replace(/\\n/g, "\n").replace(/\r\n/g, "\n");

  if (!key.endsWith("\n")) {
    key = `${key}\n`;
  }

  if (
    !key.includes("-----BEGIN PRIVATE KEY-----") ||
    !key.includes("-----END PRIVATE KEY-----")
  ) {
    throw new Error(
      "Invalid Firebase private key format. Check FIREBASE_PRIVATE_KEY or FIREBASE_PRIVATE_KEY_BASE64.",
    );
  }

  return key;
};