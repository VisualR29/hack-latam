import type { CategoryLearningModule } from "../schemas/learning.js";
import type { AnalysisLimits, GroupedCategory, OwaspId } from "../schemas/findings.js";
import { log, startTimer } from "../util/logger.js";
import {
  generateCategoryLearningModule,
  isLearningPremiumEnabled,
} from "./learningEngine.js";
import {
  countEligibleLearningCategories,
  selectLearningCategories,
} from "./selectLearningCategories.js";

export type AnalysisLearningResult = {
  learningPremium: boolean;
  learningModules: Partial<Record<OwaspId, CategoryLearningModule>>;
  learningMeta: {
    generatedCount: number;
    eligibleCount: number;
    skippedReason?: "no_api_key" | "no_eligible_categories";
  };
  warnings: string[];
};

export async function generateAnalysisLearning(
  categories: GroupedCategory[],
  reqId?: string,
): Promise<AnalysisLearningResult> {
  const eligibleCount = countEligibleLearningCategories(categories);
  const learningPremium = isLearningPremiumEnabled();

  if (!learningPremium) {
    return {
      learningPremium: false,
      learningModules: {},
      learningMeta: {
        generatedCount: 0,
        eligibleCount,
        skippedReason: "no_api_key",
      },
      warnings: [],
    };
  }

  const selected = selectLearningCategories(categories);

  if (selected.length === 0) {
    return {
      learningPremium: true,
      learningModules: {},
      learningMeta: {
        generatedCount: 0,
        eligibleCount: 0,
        skippedReason: "no_eligible_categories",
      },
      warnings: [],
    };
  }

  const genMs = startTimer();
  log.info("learning.batch.start", "Generando minicursos por categoría", {
    reqId,
    selected: selected.map((c) => c.owaspId),
    eligibleCount,
  });

  const warnings: string[] = [];
  const learningModules: Partial<Record<OwaspId, CategoryLearningModule>> = {};

  const results = await Promise.allSettled(
    selected.map(async (cat) => {
      const module = await generateCategoryLearningModule(
        {
          analysisId: reqId ?? "analysis",
          owaspId: cat.owaspId,
          categoryName: cat.name,
          categoryDescription: cat.description,
          findings: (() => {
            const prioritized = cat.findings.filter(
              (f) => f.severity === "high" || f.severity === "medium",
            );
            const source = prioritized.length > 0 ? prioritized : cat.findings;
            return source.map((f) => ({
              id: f.id,
              title: f.title,
              severity: f.severity,
              description: f.description,
            }));
          })(),
        },
        reqId,
      );
      return { owaspId: cat.owaspId, module };
    }),
  );

  for (let i = 0; i < results.length; i++) {
    const outcome = results[i];
    const cat = selected[i];
    if (outcome.status === "fulfilled") {
      learningModules[outcome.value.owaspId] = outcome.value.module;
    } else {
      const msg = `No se pudo generar el curso para ${cat.name}.`;
      warnings.push(msg);
      log.warn("learning.batch.category_failed", msg, {
        reqId,
        owaspId: cat.owaspId,
        err: outcome.reason,
      });
    }
  }

  const generatedCount = Object.keys(learningModules).length;

  log.info("learning.batch.done", "Minicursos generados", {
    reqId,
    ms: genMs(),
    generatedCount,
    eligibleCount,
  });

  return {
    learningPremium: true,
    learningModules,
    learningMeta: {
      generatedCount,
      eligibleCount,
    },
    warnings,
  };
}

export function mergeLearningWarnings(
  limits: AnalysisLimits,
  learningWarnings: string[],
): AnalysisLimits {
  if (learningWarnings.length === 0) return limits;
  return {
    ...limits,
    warnings: [...limits.warnings, ...learningWarnings],
  };
}
