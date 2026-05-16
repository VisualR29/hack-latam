import { useState } from "react";

import { FindingCard, type Finding, type Severity } from "./FindingCard";
import type { OwaspCategory } from "../types/analysis";

function severityChip(severity: Severity) {
  switch (severity) {
    case "high":
      return { dot: "bg-[#F87171]", text: "text-[#F87171]", label: "Urgente" };
    case "medium":
      return { dot: "bg-[#FACC15]", text: "text-[#FACC15]", label: "Importante" };
    default:
      return { dot: "bg-primary", text: "text-primary", label: "Menor" };
  }
}

type Props = {
  category: OwaspCategory;
  defaultOpen?: boolean;
};

export function CategoryAccordion({ category, defaultOpen = false }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  const worst = severityChip(category.worstSeverity);

  return (
    <article className="w-full min-w-0 rounded-xl border border-outline-variant bg-surface-container-low overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left p-md md:p-lg hover:bg-surface-container-high/50 transition-colors"
        aria-expanded={open}
      >
        <div className="flex flex-wrap items-start gap-sm justify-between">
          <div className="flex-1 min-w-0 space-y-xs">
            <div className="flex flex-wrap items-center gap-xs">
              <span
                className={`inline-flex items-center gap-1.5 px-sm py-0.5 rounded-full text-[10px] font-label-caps ${worst.text} bg-surface-container-highest`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${worst.dot}`} />
                {worst.label}
              </span>
              <span className="text-[11px] text-on-surface-variant font-label-caps">
                {category.owaspId}
              </span>
            </div>
            <h4 className="font-headline-md text-[18px] text-on-surface leading-snug pr-8">
              {category.name}
            </h4>
            <p className="text-[13px] text-on-surface-variant leading-relaxed line-clamp-2">
              {category.description}
            </p>
          </div>
          <div className="flex items-center gap-sm shrink-0">
            <span className="text-[13px] text-on-surface-variant whitespace-nowrap">
              {category.count} alerta{category.count !== 1 ? "s" : ""}
            </span>
            <span
              className="material-symbols-outlined text-on-surface-variant"
              data-icon={open ? "expand_less" : "expand_more"}
            >
              {open ? "expand_less" : "expand_more"}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap gap-xs mt-sm">
          {category.severitySummary.high > 0 && (
            <span className="text-[11px] px-sm py-0.5 rounded-full bg-[#F87171]/15 text-[#F87171]">
              {category.severitySummary.high} urgente
              {category.severitySummary.high !== 1 ? "s" : ""}
            </span>
          )}
          {category.severitySummary.medium > 0 && (
            <span className="text-[11px] px-sm py-0.5 rounded-full bg-[#FACC15]/15 text-[#FACC15]">
              {category.severitySummary.medium} importante
              {category.severitySummary.medium !== 1 ? "s" : ""}
            </span>
          )}
          {category.severitySummary.low > 0 && (
            <span className="text-[11px] px-sm py-0.5 rounded-full bg-primary/15 text-primary">
              {category.severitySummary.low} menor
              {category.severitySummary.low !== 1 ? "es" : ""}
            </span>
          )}
        </div>
      </button>

      {open && (
        <div className="border-t border-outline-variant/50 p-md md:p-lg space-y-md bg-surface-container/30">
          <p className="text-[14px] text-on-surface-variant leading-relaxed">{category.description}</p>
          <div className="grid w-full min-w-0 grid-cols-1 xl:grid-cols-2 gap-md">
            {category.findings.map((finding: Finding) => (
              <div key={finding.id} className="min-w-0 w-full">
                <FindingCard finding={finding} />
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
