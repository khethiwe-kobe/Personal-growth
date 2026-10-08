import crypto from "crypto";

/**
 * Optional application-level field encryption for especially sensitive free
 * text (medical notes). Enabled when MEALPREP_FIELD_KEY (32-byte hex) is set;
 * otherwise values pass through unchanged so local development stays simple.
 */
const KEY = process.env.MEALPREP_FIELD_KEY ? Buffer.from(process.env.MEALPREP_FIELD_KEY, "hex") : null;

export function encryptField(plain: string): string {
  if (!KEY || !plain) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return `enc:${iv.toString("hex")}:${cipher.getAuthTag().toString("hex")}:${enc.toString("hex")}`;
}

export function decryptField(stored: string): string {
  if (!KEY || !stored.startsWith("enc:")) return stored;
  const [, ivHex, tagHex, dataHex] = stored.split(":");
  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(dataHex, "hex")), decipher.final()]).toString("utf8");
}
