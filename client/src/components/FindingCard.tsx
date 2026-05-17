import { useState } from "react";

import { actionSteps, severityVisual } from "../content/securityMetaphors";

export type Severity = "low" | "medium" | "high";

export type OwaspId =
  | "A01"
  | "A02"
  | "A03"
  | "A04"
  | "A05"
  | "A06"
  | "A07"
  | "A08"
  | "A09"
  | "A10";

export type Educational = {
  what: string;
  why: string;
  impact: string;
  whoAffected: string;
  miniCourse?: string[];
};

export type Finding = {
  id: string;
  ruleId: string;
  title: string;
  severity: Severity;
  owaspId: OwaspId;
  file: string;
  line?: number;
  column?: number;
  description: string;
  fixRecommendation: string;
  safeExample?: string;
  educational?: Educational;
};

function fallbackEducational(finding: Finding): Educational {
  return {
    what: finding.description,
    why: "Suele pasar cuando el proyecto crece rápido y nadie revisa la seguridad con calma.",
    impact:
      "Alguien malintencionado podría robar datos, tumbar tu servicio o generar gastos que no esperabas.",
    whoAffected: "Vos, tu equipo, tus clientes y cualquiera que confíe en tu aplicación.",
    miniCourse: actionSteps(finding.fixRecommendation),
  };
}

type Props = {
  finding: Finding;
  index?: number;
};

export function FindingCard({ finding, index }: Props) {
  const [showDeepDive, setShowDeepDive] = useState(false);
  const [showTechnical, setShowTechnical] = useState(false);
  const visual = severityVisual(finding.severity);
  const edu = finding.educational ?? fallbackEducational(finding);
  const course = edu.miniCourse?.length ? edu.miniCourse : actionSteps(finding.fixRecommendation);
  const location =
    finding.line != null
      ? `${finding.file}, cerca de la línea ${finding.line}`
      : finding.file;

  return (
    <article
      className={`w-full min-w-0 rounded-xl border ${visual.border} ${visual.bg} flex flex-col overflow-hidden h-full mission-card`}
    >
      <header className="p-md border-b border-outline-variant/40 space-y-sm">
        <div className="flex flex-wrap items-center justify-between gap-xs">
          <span
            className={`inline-flex items-center gap-1.5 px-sm py-1 rounded-full text-[11px] font-label-caps ${visual.text}`}
          >
            <span aria-hidden>{visual.emoji}</span>
            {visual.quest}
          </span>
          {index != null && (
            <span className="text-[11px] text-on-surface-variant">Misión #{index + 1}</span>
          )}
        </div>
        <h5 className="font-headline-md text-[18px] text-on-surface leading-snug">{finding.title}</h5>
        <p className="text-[13px] text-on-surface-variant leading-relaxed">{visual.hint}</p>
      </header>

      <div className="p-md space-y-md flex-1">
        {showDeepDive ? (
          <>
            <section className="rounded-lg bg-surface-container/80 border border-outline-variant/30 p-md space-y-xs">
              <h6 className="flex items-center gap-xs text-[12px] font-label-caps text-on-surface">
                <span className="material-symbols-outlined text-[18px] text-primary" data-icon="auto_stories">
                  auto_stories
                </span>
                En palabras simples
              </h6>
              <p className="text-[15px] text-on-surface leading-relaxed">{edu.what}</p>
            </section>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-sm">
              <section className="rounded-lg bg-[#F87171]/5 border border-[#F87171]/20 p-sm space-y-1">
                <h6 className="flex items-center gap-1 text-[11px] font-label-caps text-[#F87171]">
                  <span className="material-symbols-outlined text-[16px]" data-icon="psychology_alt">
                    psychology_alt
                  </span>
                  Por qué importa
                </h6>
                <p className="text-[13px] text-on-surface leading-relaxed">{edu.why}</p>
              </section>
              <section className="rounded-lg bg-[#FACC15]/5 border border-[#FACC15]/20 p-sm space-y-1">
                <h6 className="flex items-center gap-1 text-[11px] font-label-caps text-[#FACC15]">
                  <span className="material-symbols-outlined text-[16px]" data-icon="bolt">
                    bolt
                  </span>
                  Qué podría pasar
                </h6>
                <p className="text-[13px] text-on-surface leading-relaxed">{edu.impact}</p>
              </section>
            </div>

            <section className="rounded-lg bg-surface-container-low border border-outline-variant/40 p-sm">
              <h6 className="flex items-center gap-1 text-[11px] font-label-caps text-on-surface-variant mb-1">
                <span className="material-symbols-outlined text-[16px]" data-icon="groups">
                  groups
                </span>
                Quién podría verse afectado
              </h6>
              <p className="text-[13px] text-on-surface leading-relaxed">{edu.whoAffected}</p>
            </section>

            <section className="rounded-xl bg-primary/10 border-2 border-primary/30 p-md space-y-sm">
              <h6 className="flex items-center gap-xs font-label-caps text-[12px] text-primary">
                <span className="text-lg" aria-hidden>
                  ✅
                </span>
                Mini curso para corregirlo
              </h6>
              <p className="text-[12px] text-on-surface-variant">
                Un recorrido corto para entender, arreglar y validar el problema:
              </p>
              <ol className="space-y-2 pl-1">
                {course.map((step, i) => (
                  <li key={i} className="flex gap-2 text-[14px] text-on-surface leading-relaxed">
                    <span
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-[11px] font-bold"
                      aria-hidden
                    >
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>
            </section>
          </>
        ) : (
          <section className="rounded-lg border border-dashed border-outline-variant/50 bg-surface-container/50 p-md space-y-xs">
            <h6 className="flex items-center gap-xs text-[12px] font-label-caps text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px]" data-icon="visibility">
                visibility
              </span>
              Explicación oculta
            </h6>
            <p className="text-[14px] text-on-surface leading-relaxed">
              Tocá para ver por qué importa, a quién afecta y el mini curso de solución.
            </p>
          </section>
        )}
      </div>

      <footer className="px-md pb-md">
        <button
          type="button"
          onClick={() => setShowDeepDive((v) => !v)}
          className="w-full flex items-center justify-between gap-sm py-sm px-sm rounded-lg bg-surface-container-highest/80 border border-outline-variant/40 text-on-surface-variant hover:text-on-surface transition-colors text-left"
          aria-expanded={showDeepDive}
        >
          <span className="flex items-center gap-xs text-[12px] font-label-caps">
            <span className="material-symbols-outlined text-[18px]" data-icon="engineering">
              engineering
            </span>
            {showDeepDive ? "Ocultar explicación guiada" : "Abrir explicación guiada"}
          </span>
          <span className="material-symbols-outlined text-[20px]">
            {showDeepDive ? "expand_less" : "expand_more"}
          </span>
        </button>

        {showDeepDive && (
          <>
            <button
              type="button"
              onClick={() => setShowTechnical((v) => !v)}
              className="mt-sm w-full flex items-center justify-between gap-sm py-sm px-sm rounded-lg bg-background border border-outline-variant/30 text-on-surface-variant hover:text-on-surface transition-colors text-left"
              aria-expanded={showTechnical}
            >
              <span className="flex items-center gap-xs text-[12px] font-label-caps">
                <span className="material-symbols-outlined text-[18px]" data-icon="code">
                  code
                </span>
                {showTechnical ? "Ocultar detalles técnicos" : "Ver detalles técnicos"}
              </span>
              <span className="material-symbols-outlined text-[20px]">
                {showTechnical ? "expand_less" : "expand_more"}
              </span>
            </button>

            {showTechnical && (
              <div className="mt-sm p-sm rounded-lg bg-background border border-outline-variant/30 space-y-sm text-[12px]">
                <p>
                  <span className="text-outline font-label-caps text-[10px] block mb-1">DÓNDE ESTÁ</span>
                  <span className="font-code-sm text-on-surface-variant">{location}</span>
                </p>
                <p>
                  <span className="text-outline font-label-caps text-[10px] block mb-1">
                    DETALLE TÉCNICO
                  </span>
                  <span className="text-on-surface leading-snug">{finding.description}</span>
                </p>
                {finding.safeExample && (
                  <div>
                    <span className="text-outline font-label-caps text-[10px] block mb-1">
                      EJEMPLO DE CÓDIGO MÁS SEGURO
                    </span>
                    <pre className="p-xs bg-surface-container-highest rounded overflow-x-auto font-code-sm text-[#a8ffee] whitespace-pre-wrap">
                      {finding.safeExample}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </footer>
    </article>
  );
}
