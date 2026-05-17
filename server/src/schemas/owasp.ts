import { z } from "zod";

export const OwaspIdSchema = z.enum([
  "A01",
  "A02",
  "A03",
  "A04",
  "A05",
  "A06",
  "A07",
  "A08",
  "A09",
  "A10",
]);
export type OwaspId = z.infer<typeof OwaspIdSchema>;

export const SeveritySchema = z.enum(["low", "medium", "high"]);
export type Severity = z.infer<typeof SeveritySchema>;
