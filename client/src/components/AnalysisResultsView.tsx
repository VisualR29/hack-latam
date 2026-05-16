import { useMemo } from "react";

import { CategoryAccordion } from "./CategoryAccordion";
import { SecurityScoreHero } from "./SecurityScoreHero";
import type { AnalysisResult } from "../types/analysis";
import type { Finding, OwaspId, Severity } from "./FindingCard";

export type { AnalysisResult, OwaspCategory, TrafficLight } from "../types/analysis";

function countUrgent(result: AnalysisResult) {
  return result.categories.reduce((sum, c) => sum + c.severitySummary.high, 0);
}

function summaryCopy(result: AnalysisResult, totalFindings: number, urgent: number) {
  if (result.limits.filesProcessed === 0) {
    return {
      headline: "No pudimos revisar tu código",
      body: "Revisá las advertencias de abajo. Puede ser un problema de conexión con GitHub o que el archivo esté vacío.",
    };
  }

  if (totalFindings === 0) {
    return {
      headline: "Buenas noticias: no vimos riesgos evidentes",
      body: "Tu puntaje de seguridad es alto. Igual conviene revisar el código cuando hagas cambios importantes.",
    };
  }

  if (result.trafficLight === "red" || urgent > 0) {
    return {
      headline:
        urgent > 0
          ? `Hay ${urgent} punto${urgent > 1 ? "s" : ""} urgente${urgent > 1 ? "s" : ""} por atender`
          : "Tu app necesita mejoras de seguridad",
      body: "Abrí cada área de abajo para entender qué encontramos y qué podés hacer, sin tecnicismos innecesarios.",
    };
  }

  if (result.trafficLight === "yellow") {
    return {
      headline: "Tu app está aceptable, pero hay margen de mejora",
      body: "Revisá las áreas marcadas y planificá correcciones cuando puedas.",
    };
  }

  return {
    headline: "Tu app se ve bastante bien",
    body: "Hay algunos detalles menores. Cada categoría explica qué significan y cómo mejorarlos.",
  };
}

type Props = {
  result: AnalysisResult;
  onNewAnalysis: () => void;
};

export function AnalysisResultsView({ result, onNewAnalysis }: Props) {
  const totalFindings = result.findings.length;
  const urgentCount = countUrgent(result);
  const summary = summaryCopy(result, totalFindings, urgentCount);

  const categories = useMemo(() => {
    if (result.categories.length > 0) return result.categories;
    const byOwasp = new Map<OwaspId, Finding[]>();
    for (const f of result.findings) {
      const list = byOwasp.get(f.owaspId) ?? [];
      list.push(f);
      byOwasp.set(f.owaspId, list);
    }
    return [...byOwasp.entries()].map(([owaspId, findings]) => {
      const severitySummary = { high: 0, medium: 0, low: 0 };
      for (const f of findings) severitySummary[f.severity]++;
      const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
      const worstSeverity = findings.reduce<Severity>(
        (w, f) => (order[f.severity] < order[w] ? f.severity : w),
        "low",
      );
      return {
        owaspId,
        name: `Área ${owaspId}`,
        description: "Hallazgos agrupados por tipo de riesgo.",
        count: findings.length,
        severitySummary,
        worstSeverity,
        findings,
      };
    });
  }, [result.categories, result.findings]);

  const secureScore =
    result.secureScore ?? Math.max(0, Math.min(100, 100 - (result.riskScore ?? 0)));

  return (
    <div className="w-full min-w-0 max-w-5xl mx-auto space-y-lg animate-fade-in pb-xl">
      <div className="flex flex-wrap items-center justify-between gap-md">
        <button
          type="button"
          onClick={onNewAnalysis}
          className="flex items-center gap-xs text-primary hover:underline font-label-caps text-[12px]"
        >
          <span className="material-symbols-outlined text-[18px]" data-icon="arrow_back">
            arrow_back
          </span>
          Hacer otro análisis
        </button>
        {result.usedAiExplanation && (
          <span className="text-[12px] text-on-surface-variant flex items-center gap-xs">
            <span className="material-symbols-outlined text-[16px] text-primary" data-icon="auto_awesome">
              auto_awesome
            </span>
            Explicaciones adaptadas a tu caso
          </span>
        )}
      </div>

      <SecurityScoreHero
        secureScore={secureScore}
        trafficLight={result.trafficLight}
        totalFindings={totalFindings}
        totalCategories={categories.length}
        filesProcessed={result.limits.filesProcessed}
      />

      {result.limits.filesProcessed > 0 && (
        <section className="w-full space-y-xs px-sm">
          <h3 className="font-headline-md text-headline-md text-on-surface">{summary.headline}</h3>
          <p className="text-[14px] text-on-surface-variant leading-relaxed max-w-3xl">
            {summary.body}
          </p>
        </section>
      )}

      {result.limits.warnings.length > 0 && (
        <section
          className="rounded-xl border border-[#FACC15]/40 bg-[#FACC15]/5 p-md space-y-sm"
          role="alert"
        >
          <h3 className="flex items-center gap-xs font-headline-md text-[15px] text-[#FACC15]">
            <span className="material-symbols-outlined" data-icon="info">
              info
            </span>
            Avisos del análisis
          </h3>
          <ul className="space-y-xs text-[14px] text-on-surface leading-relaxed list-disc pl-6">
            {result.limits.warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </section>
      )}

      {result.limits.truncated && (
        <p className="text-[13px] text-on-surface-variant px-sm">
          Analizamos una parte del proyecto por límites de tamaño. Si tu repo es grande, probá
          enfocarte en carpetas críticas o subí un ZIP más pequeño.
        </p>
      )}

      <section className="w-full min-w-0 space-y-md">
        <div className="w-full">
          <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-xs">
            <span className="material-symbols-outlined text-primary shrink-0" data-icon="category">
              category
            </span>
            Problemas por área de seguridad
          </h3>
          <p className="text-[14px] text-on-surface-variant mt-xs w-full max-w-3xl leading-relaxed">
            Cada bloque agrupa alertas del mismo tipo. Tocá una categoría para ver el detalle de
            cada problema y qué podés hacer.
          </p>
        </div>

        {categories.length === 0 && result.limits.filesProcessed > 0 ? (
          <div className="py-xl text-center rounded-xl border border-outline-variant bg-surface-container-low">
            <span
              className="material-symbols-outlined text-[48px] text-primary mb-md block mx-auto"
              data-icon="verified_user"
            >
              verified_user
            </span>
            <p className="text-on-surface font-headline-md">No hay alertas que mostrar</p>
            <p className="text-on-surface-variant text-[14px] mt-xs w-full max-w-md mx-auto">
              Seguí buenas prácticas al desplegar y volvé a escanear cuando cambies algo
              importante.
            </p>
          </div>
        ) : (
          <div className="space-y-md">
            {categories.map((cat, index) => (
              <CategoryAccordion key={cat.owaspId} category={cat} defaultOpen={index === 0} />
            ))}
          </div>
        )}
      </section>

      <p className="text-[12px] text-outline text-center w-full max-w-2xl mx-auto px-sm leading-relaxed">
        VibeGuard es una guía educativa, no reemplaza una auditoría profesional. Antes de manejar
        datos reales de usuarios, consultá con alguien de seguridad si tenés dudas.
      </p>
    </div>
  );
}
