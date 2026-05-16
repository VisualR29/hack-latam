import { useState } from "react";

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

const OWASP_PLAIN: Record<OwaspId, string> = {
  A01: "Quién puede entrar y qué puede hacer",
  A02: "Configuración y ajustes del sistema",
  A03: "Librerías y dependencias externas",
  A04: "Protección de datos sensibles",
  A05: "Entradas maliciosas en la app",
  A06: "Diseño general de seguridad",
  A07: "Inicio de sesión y contraseñas",
  A08: "Integridad del software y los datos",
  A09: "Registros y monitoreo",
  A10: "Errores y fallos inesperados",
};

function severityMeta(severity: Severity) {
  switch (severity) {
    case "high":
      return {
        label: "Urgente",
        hint: "Conviene corregirlo antes de publicar o compartir el proyecto.",
        bg: "bg-[#F87171]/10",
        text: "text-[#F87171]",
        dot: "bg-[#F87171]",
      };
    case "medium":
      return {
        label: "Importante",
        hint: "No es una emergencia inmediata, pero sí merece tu atención pronto.",
        bg: "bg-[#FACC15]/10",
        text: "text-[#FACC15]",
        dot: "bg-[#FACC15]",
      };
    default:
      return {
        label: "Para tener en cuenta",
        hint: "Es una buena práctica mejorar esto cuando puedas.",
        bg: "bg-primary/10",
        text: "text-primary",
        dot: "bg-primary",
      };
  }
}

function fallbackEducational(finding: Finding): Educational {
  return {
    what: finding.description,
    why: "Los patrones que marcamos suelen aparecer cuando el código se genera rápido sin revisar seguridad.",
    impact:
      "Si alguien aprovecha este punto débil, podría acceder a datos, alterar tu servicio o generar costos inesperados.",
    whoAffected: "Vos, tu equipo, tus clientes y cualquier persona que use la aplicación.",
  };
}

type Props = {
  finding: Finding;
};

export function FindingCard({ finding }: Props) {
  const [showTechnical, setShowTechnical] = useState(false);
  const meta = severityMeta(finding.severity);
  const edu = finding.educational ?? fallbackEducational(finding);
  const location =
    finding.line != null
      ? `${finding.file}, alrededor de la línea ${finding.line}`
      : finding.file;

  const sections = [
    { key: "what", icon: "visibility", title: "Qué detectamos", body: edu.what },
    { key: "why", icon: "help", title: "Por qué importa", body: edu.why },
    { key: "impact", icon: "warning", title: "Qué podría pasar", body: edu.impact },
    { key: "who", icon: "groups", title: "Quién podría verse afectado", body: edu.whoAffected },
  ] as const;

  return (
    <article className="w-full min-w-0 bg-surface-container-low rounded-xl border border-outline-variant hover:border-primary/30 transition-all flex flex-col overflow-hidden h-full">
      <header className="p-md border-b border-outline-variant/50 space-y-sm">
        <div className="flex flex-wrap items-center gap-xs">
          <span
            className={`inline-flex items-center gap-xs px-sm py-1 rounded-full font-label-caps text-[10px] ${meta.bg} ${meta.text}`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
          </span>
          <span className="text-[11px] text-on-surface-variant px-sm py-0.5 bg-surface-container-highest rounded-full">
            {OWASP_PLAIN[finding.owaspId]}
          </span>
        </div>
        <h5 className="font-headline-md text-[17px] text-on-surface leading-snug">
          {finding.title}
        </h5>
        <p className="text-[13px] text-on-surface-variant leading-relaxed">{meta.hint}</p>
      </header>

      <div className="p-md space-y-md flex-1">
        {sections.map((s) => (
          <section key={s.key} className="space-y-xs">
            <h6 className="flex items-center gap-xs font-label-caps text-[11px] text-primary tracking-wide">
              <span className="material-symbols-outlined text-[16px]" data-icon={s.icon}>
                {s.icon}
              </span>
              {s.title}
            </h6>
            <p className="text-[14px] text-on-surface leading-relaxed pl-6">{s.body}</p>
          </section>
        ))}

        <section className="rounded-lg bg-primary/5 border border-primary/20 p-md space-y-xs">
          <h6 className="flex items-center gap-xs font-label-caps text-[11px] text-primary">
            <span className="material-symbols-outlined text-[16px]" data-icon="task_alt">
              task_alt
            </span>
            Qué podés hacer
          </h6>
          <p className="text-[14px] text-on-surface leading-relaxed pl-6">
            {finding.fixRecommendation}
          </p>
        </section>
      </div>

      <footer className="px-md pb-md">
        <button
          type="button"
          onClick={() => setShowTechnical((v) => !v)}
          className="w-full flex items-center justify-between gap-sm py-sm px-sm rounded-lg bg-surface-container-highest/80 border border-outline-variant/40 text-on-surface-variant hover:text-on-surface transition-colors text-left"
          aria-expanded={showTechnical}
        >
          <span className="flex items-center gap-xs text-[12px] font-label-caps">
            <span className="material-symbols-outlined text-[18px]" data-icon="code">
              code
            </span>
            {showTechnical ? "Ocultar detalles técnicos" : "Ver detalles técnicos (opcional)"}
          </span>
          <span
            className="material-symbols-outlined text-[20px]"
            data-icon={showTechnical ? "expand_less" : "expand_more"}
          >
            {showTechnical ? "expand_less" : "expand_more"}
          </span>
        </button>

        {showTechnical && (
          <div className="mt-sm p-sm rounded-lg bg-background border border-outline-variant/30 space-y-sm text-[12px]">
            <p>
              <span className="text-outline font-label-caps text-[10px] block mb-1">UBICACIÓN</span>
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
                  EJEMPLO SEGURO
                </span>
                <pre className="p-xs bg-surface-container-highest rounded overflow-x-auto font-code-sm text-[#a8ffee] whitespace-pre-wrap">
                  {finding.safeExample}
                </pre>
              </div>
            )}
          </div>
        )}
      </footer>
    </article>
  );
}
