import { useMemo } from "react";

import { CategoryAccordion } from "./CategoryAccordion";
import { LearningJourney } from "./LearningJourney";
import { MissionSummary } from "./MissionSummary";
import { SecurityScoreHero } from "./SecurityScoreHero";
import type { AnalysisResult } from "../types/analysis";
import { downloadMarkdownReport } from "../util/downloadMarkdownReport";
import type { Finding, OwaspId, Severity } from "./FindingCard";

export type { AnalysisResult, OwaspCategory, TrafficLight } from "../types/analysis";

function countBySeverity(result: AnalysisResult) {
  let urgent = 0;
  let important = 0;
  let minor = 0;
  for (const c of result.categories) {
    urgent += c.severitySummary.high;
    important += c.severitySummary.medium;
    minor += c.severitySummary.low;
  }
  if (result.categories.length === 0) {
    for (const f of result.findings) {
      if (f.severity === "high") urgent++;
      else if (f.severity === "medium") important++;
      else minor++;
    }
  }
  return { urgent, important, minor };
}

function summaryCopy(result: AnalysisResult, totalFindings: number, urgent: number) {
  if (result.limits.filesProcessed === 0) {
    return {
      headline: "No pudimos revisar tu código",
      body: "Revisá los avisos de abajo. Puede ser un problema de conexión o un archivo vacío.",
    };
  }

  if (totalFindings === 0) {
    return {
      headline: "¡Felicitaciones! Tu escudo está fuerte",
      body: "No encontramos misiones pendientes. Cuando cambies algo importante, volvé a escanear.",
    };
  }

  if (result.trafficLight === "red" || urgent > 0) {
    return {
      headline:
        urgent > 0
          ? `Tenés ${urgent} misión${urgent > 1 ? "es" : ""} urgente${urgent > 1 ? "s" : ""}`
          : "Tu app necesita refuerzos de seguridad",
      body: "No te asustes: abrí cada área, leé la historia de cada alerta y seguí el plan de acción paso a paso.",
    };
  }

  if (result.trafficLight === "yellow") {
    return {
      headline: "Vas bien, pero hay tareas por hacer",
      body: "Revisá las áreas amarillas cuando puedas. Cada una te enseña qué mejorar y por qué.",
    };
  }

  return {
    headline: "Casi perfecto — detalles menores",
    body: "Son buenos hábitos de seguridad. Aprendé con cada misión y mejorá con calma.",
  };
}

type Props = {
  result: AnalysisResult;
  analysisId: string;
  userScope: string;
  onNewAnalysis: () => void;
};

export function AnalysisResultsView({ result, analysisId, userScope, onNewAnalysis }: Props) {
  const totalFindings = result.findings.length;
  const { urgent, important, minor } = countBySeverity(result);
  const summary = summaryCopy(result, totalFindings, urgent);
  const markdownReport = result.markdownReport?.trim();

  function handleDownloadReport() {
    if (!markdownReport) return;
    downloadMarkdownReport(markdownReport);
  }

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

  const learningPremium = result.learningPremium ?? false;
  const learningModules = result.learningModules ?? {};
  const coursesAvailable = Object.keys(learningModules).length;

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
          Nuevo escaneo
        </button>
        <div className="flex flex-wrap items-center gap-sm">
          {markdownReport && (
            <button
              type="button"
              onClick={handleDownloadReport}
              className="flex items-center gap-xs bg-primary text-on-primary px-md py-xs rounded-lg text-[13px] font-bold hover:opacity-90 transition-opacity"
              title="Descargá el reporte y pegalo en Cursor, Copilot u otro asistente con acceso a tu proyecto"
            >
              <span className="material-symbols-outlined text-[18px]" data-icon="download">
                download
              </span>
              Exportar reporte para IA
            </button>
          )}
          {result.usedAiExplanation && (
            <span className="text-[12px] text-on-surface-variant flex items-center gap-xs">
              <span className="material-symbols-outlined text-[16px] text-primary" data-icon="auto_awesome">
                auto_awesome
              </span>
              Explicaciones personalizadas con IA
            </span>
          )}
        </div>
      </div>

      <SecurityScoreHero
        secureScore={secureScore}
        trafficLight={result.trafficLight}
        totalFindings={totalFindings}
        totalCategories={categories.length}
        filesProcessed={result.limits.filesProcessed}
      />

      {totalFindings > 0 && (
        <MissionSummary urgent={urgent} important={important} minor={minor} />
      )}

      <LearningJourney coursesAvailable={coursesAvailable} />

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
          Analizamos una parte del proyecto por límites de tamaño. Si tu repo es grande, probá un
          ZIP más pequeño o carpetas críticas.
        </p>
      )}

      <section className="w-full min-w-0 space-y-md">
        <div className="w-full">
          <h3 className="font-headline-md text-headline-md text-on-surface flex items-center gap-xs">
            <span className="text-xl" aria-hidden>
              🗺️
            </span>
            Hallazgos por área
          </h3>
          <p className="text-[14px] text-on-surface-variant mt-xs w-full max-w-3xl leading-relaxed">
            Cada tarjeta agrupa un tipo de riesgo. Usá Resumen para ver los detalles y Aprendizaje
            para el minicurso interactivo.
          </p>
        </div>

        {categories.length === 0 && result.limits.filesProcessed > 0 ? (
          <div className="py-xl text-center rounded-xl border border-outline-variant bg-surface-container-low">
            <span className="text-5xl mb-md block" aria-hidden>
              🏆
            </span>
            <p className="text-on-surface font-headline-md">¡Sin misiones pendientes!</p>
            <p className="text-on-surface-variant text-[14px] mt-xs w-full max-w-md mx-auto">
              Tu escudo se ve sólido. Volvé a escanear cuando hagas cambios grandes.
            </p>
          </div>
        ) : (
          <div className="space-y-md">
            {categories.map((cat, index) => (
              <CategoryAccordion
                key={cat.owaspId}
                category={cat}
                defaultOpen={index === 0}
                analysisId={analysisId}
                learningPremium={learningPremium}
                learningModule={learningModules[cat.owaspId]}
                userScope={userScope}
              />
            ))}
          </div>
        )}
      </section>

      <p className="text-[12px] text-outline text-center w-full max-w-2xl mx-auto px-sm leading-relaxed">
        VibeGuard es tu guía para aprender seguridad paso a paso. No reemplaza una auditoría
        profesional si manejás datos sensibles de muchas personas.
      </p>
    </div>
  );
}
