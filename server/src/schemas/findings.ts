import { z } from "zod";

export const SeveritySchema = z.enum(["low", "medium", "high"]);
export type Severity = z.infer<typeof SeveritySchema>;

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

export const TrafficLightSchema = z.enum(["green", "yellow", "red"]);
export type TrafficLight = z.infer<typeof TrafficLightSchema>;

export const EducationalSchema = z.object({
  what: z.string(),
  why: z.string(),
  impact: z.string(),
  whoAffected: z.string(),
});
export type Educational = z.infer<typeof EducationalSchema>;

export const FindingSchema = z.object({
  id: z.string(),
  ruleId: z.string(),
  title: z.string(),
  severity: SeveritySchema,
  owaspId: OwaspIdSchema,
  file: z.string(),
  line: z.number().optional(),
  column: z.number().optional(),
  description: z.string(),
  fixRecommendation: z.string(),
  safeExample: z.string().optional(),
  educational: EducationalSchema.optional(),
});
export type Finding = z.infer<typeof FindingSchema>;

export const AnalysisLimitsSchema = z.object({
  filesProcessed: z.number(),
  totalBytesApprox: z.number(),
  truncated: z.boolean(),
  warnings: z.array(z.string()),
});
export type AnalysisLimits = z.infer<typeof AnalysisLimitsSchema>;

export const AnalysisResultSchema = z.object({
  riskScore: z.number().min(0).max(100),
  trafficLight: TrafficLightSchema,
  findings: z.array(FindingSchema),
  limits: AnalysisLimitsSchema,
  usedAiExplanation: z.boolean(),
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export const RawAnalyzeBodySchema = z.object({
  mode: z.literal("raw"),
  code: z.string(),
  filename: z.string().max(512).optional(),
});

export const GithubAnalyzeBodySchema = z.object({
  mode: z.literal("github"),
  url: z.string().url().max(2048),
});

export const JsonAnalyzeBodySchema = z.union([
  RawAnalyzeBodySchema,
  GithubAnalyzeBodySchema,
]);
