import type { GroupedCategory, OwaspId, Severity } from "../schemas/findings.js";

const SEVERITY_ORDER: Record<Severity, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

const MAX_LEARNING_CATEGORIES = 3;

function categoryHasMediumOrHigh(cat: GroupedCategory): boolean {
  return (
    cat.worstSeverity === "high" ||
    cat.worstSeverity === "medium" ||
    cat.severitySummary.high > 0 ||
    cat.severitySummary.medium > 0
  );
}

/** Elige hasta 3 categorías OWASP con hallazgos medium/high para generar minicursos. */
export function selectLearningCategories(
  categories: GroupedCategory[],
): GroupedCategory[] {
  return categories
    .filter(categoryHasMediumOrHigh)
    .sort((a, b) => {
      const bySeverity =
        SEVERITY_ORDER[a.worstSeverity] - SEVERITY_ORDER[b.worstSeverity];
      if (bySeverity !== 0) return bySeverity;
      return b.count - a.count;
    })
    .slice(0, MAX_LEARNING_CATEGORIES);
}

export function countEligibleLearningCategories(categories: GroupedCategory[]): number {
  return categories.filter(categoryHasMediumOrHigh).length;
}

export type { OwaspId };
