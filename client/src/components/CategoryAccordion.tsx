import { useState } from "react";

import { CATEGORY_VISUAL, severityVisual } from "../content/securityMetaphors";
import { FindingCard, type Finding } from "./FindingCard";
import type { OwaspCategory } from "../types/analysis";

type Props = {
  category: OwaspCategory;
  defaultOpen?: boolean;
};

function severityBar(summary: OwaspCategory["severitySummary"], total: number) {
  if (total === 0) return null;
  const parts = [
    { n: summary.high, class: "bg-[#F87171]" },
    { n: summary.medium, class: "bg-[#FACC15]" },
    { n: summary.low, class: "bg-primary" },
  ];
  return (
    <div className="h-1.5 w-full rounded-full overflow-hidden flex bg-surface-container-highest">
      {parts.map(
        (p, i) =>
          p.n > 0 && (
            <div
              key={i}
              className={`${p.class} h-full`}
              style={{ width: `${(p.n / total) * 100}%` }}
              title={`${p.n} hallazgos`}
            />
          ),
      )}
    </div>
  );
}

export function CategoryAccordion({ category, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const worst = severityVisual(category.worstSeverity);
  const visual = CATEGORY_VISUAL[category.owaspId];

  return (
    <article className="w-full min-w-0 rounded-xl border border-outline-variant bg-surface-container-low overflow-hidden mission-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full text-left p-md md:p-lg hover:bg-surface-container-high/50 transition-colors bg-gradient-to-r ${visual.color}`}
        aria-expanded={open}
      >
        <div className="flex gap-md items-start">
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border ${worst.border} ${worst.bg}`}
          >
            <span className="material-symbols-outlined text-[28px] text-primary" data-icon={visual.icon}>
              {visual.icon}
            </span>
          </div>

          <div className="flex-1 min-w-0 space-y-sm">
            <div className="flex flex-wrap items-center gap-xs">
              <span
                className={`inline-flex items-center gap-1 px-sm py-0.5 rounded-full text-[10px] font-label-caps ${worst.text}`}
              >
                <span aria-hidden>{worst.emoji}</span>
                {worst.label}
              </span>
              <span className="text-[11px] text-on-surface-variant italic">{visual.metaphor}</span>
            </div>

            <h4 className="font-headline-md text-[19px] text-on-surface leading-snug pr-6">
              {category.name}
            </h4>

            <p className="text-[14px] text-on-surface-variant leading-relaxed line-clamp-2">
              {category.description}
            </p>

            {severityBar(category.severitySummary, category.count)}

            <div className="flex flex-wrap items-center justify-between gap-sm pt-1">
              <div className="flex flex-wrap gap-xs">
                {category.severitySummary.high > 0 && (
                  <span className="text-[11px] px-sm py-0.5 rounded-full bg-[#F87171]/15 text-[#F87171]">
                    🔴 {category.severitySummary.high} urgente
                    {category.severitySummary.high !== 1 ? "s" : ""}
                  </span>
                )}
                {category.severitySummary.medium > 0 && (
                  <span className="text-[11px] px-sm py-0.5 rounded-full bg-[#FACC15]/15 text-[#FACC15]">
                    🟡 {category.severitySummary.medium} importante
                    {category.severitySummary.medium !== 1 ? "s" : ""}
                  </span>
                )}
                {category.severitySummary.low > 0 && (
                  <span className="text-[11px] px-sm py-0.5 rounded-full bg-primary/15 text-primary">
                    🟢 {category.severitySummary.low} menor
                    {category.severitySummary.low !== 1 ? "es" : ""}
                  </span>
                )}
              </div>
              <span className="flex items-center gap-1 text-[13px] text-primary font-label-caps shrink-0">
                {open ? "Cerrar misiones" : `Ver ${category.count} misión${category.count !== 1 ? "es" : ""}`}
                <span className="material-symbols-outlined text-[20px]">
                  {open ? "expand_less" : "expand_more"}
                </span>
              </span>
            </div>
          </div>
        </div>
      </button>

      {open && (
        <div className="border-t border-outline-variant/50 p-md md:p-lg space-y-md bg-surface-container/40">
          <p className="text-[14px] text-on-surface leading-relaxed rounded-lg bg-primary/5 border border-primary/15 p-sm">
            <span className="font-label-caps text-[11px] text-primary block mb-1">💡 Aprendé esto</span>
            {category.description}
          </p>
          <div className="grid w-full min-w-0 grid-cols-1 gap-md">
            {category.findings.map((finding: Finding, i) => (
              <FindingCard key={finding.id} finding={finding} index={i} />
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
