import { z } from "zod";

import { CategoryLearningModuleSchema } from "./learning.js";
import { OwaspIdSchema, SeveritySchema } from "./owasp.js";

export { OwaspIdSchema, SeveritySchema };
export type { OwaspId, Severity } from "./owasp.js";

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

export const LearningMetaSchema = z.object({
  generatedCount: z.number().int().min(0),
  eligibleCount: z.number().int().min(0),
  skippedReason: z.enum(["no_api_key", "no_eligible_categories"]).optional(),
});

export const AnalysisResultSchema = z.object({
  riskScore: z.number().min(0).max(100),
  secureScore: z.number().min(0).max(100),
  trafficLight: TrafficLightSchema,
  findings: z.array(FindingSchema),
  categories: z.array(z.object({
    owaspId: OwaspIdSchema,
    name: z.string(),
    description: z.string(),
    count: z.number(),
    severitySummary: z.object({
      high: z.number(),
      medium: z.number(),
      low: z.number(),
    }),
    worstSeverity: SeveritySchema,
    findings: z.array(FindingSchema),
  })),
  limits: AnalysisLimitsSchema,
  usedAiExplanation: z.boolean(),
  markdownReport: z.string(),
  learningPremium: z.boolean(),
  learningModules: z.record(OwaspIdSchema, CategoryLearningModuleSchema),
  learningMeta: LearningMetaSchema,
});
export type AnalysisResult = z.infer<typeof AnalysisResultSchema>;

export type GroupedCategory = AnalysisResult["categories"][number];

export const RawAnalyzeBodySchema = z.object({
  mode: z.literal("raw"),
  code: z.string(),
  filename: z.string().max(512).optional(),
});

export const GithubAnalyzeBodySchema = z.object({
  mode: z.literal("github"),
  url: z.string().url().max(2048),
  githubToken: z.string().min(1).optional(),
});

export const JsonAnalyzeBodySchema = z.union([
  RawAnalyzeBodySchema,
  GithubAnalyzeBodySchema,
]);
