import crypto from "node:crypto";

export function findingFingerprint(input: unknown): string {
  return crypto
    .createHash("sha1")
    .update(JSON.stringify(input))
    .digest("hex")
    .slice(0, 14);
}
