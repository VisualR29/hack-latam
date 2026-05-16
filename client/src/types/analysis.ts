import type { Finding, OwaspId, Severity } from "../components/FindingCard";

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
};
