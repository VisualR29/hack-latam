import type { Finding, OwaspId, Severity } from "../components/FindingCard";
import type { CategoryLearningModule } from "./learning";

export type TrafficLight = "green" | "yellow" | "red";

export type OwaspCategory = {
  owaspId: OwaspId;
  name: string;
  description: string;
  count: number;
  severitySummary: {
    high: number;
    medium: number;
    low: number;
  };
  worstSeverity: Severity;
  findings: Finding[];
};

export type LearningMeta = {
  generatedCount: number;
  eligibleCount: number;
  skippedReason?: "no_api_key" | "no_eligible_categories";
};

export type AnalysisResult = {
  riskScore: number;
  secureScore: number;
  trafficLight: TrafficLight;
  categories: OwaspCategory[];
  findings: Finding[];
  limits: {
    filesProcessed: number;
    totalBytesApprox: number;
    truncated: boolean;
    warnings: string[];
  };
  usedAiExplanation: boolean;
  markdownReport?: string;
  learningPremium: boolean;
  learningModules: Partial<Record<OwaspId, CategoryLearningModule>>;
  learningMeta?: LearningMeta;
};
