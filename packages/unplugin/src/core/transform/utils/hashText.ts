import crypto from "node:crypto";

/**
 * SHA-256 hex digest of text or bytes.
 *
 * The single content fingerprint every generation proof uses, so hashes
 * recorded at capture and recomputed during validation are always comparable.
 */
export function hashText(input: string | Buffer): string {
  return crypto.createHash("sha256").update(input).digest("hex");
}
