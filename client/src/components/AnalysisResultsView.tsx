import { FindingCard, type Finding } from "./FindingCard";

export type TrafficLight = "green" | "yellow" | "red";

export type AnalysisResult = {
  riskScore: number;
  trafficLight: TrafficLight;
  findings: Finding[];
  limits: {
    filesProcessed: number;
    totalBytesApprox: number;
    truncated: boolean;
    warnings: string[];
  };
  usedAiExplanation: boolean;
};

function summaryCopy(result: AnalysisResult) {
  const n = result.findings.length;
  const urgent = result.findings.filter((f) => f.severity === "high").length;

  if (result.limits.filesProcessed === 0) {
    return {
      headline: "No pudimos revisar tu código",
      body: "Revisá las advertencias de abajo. Puede ser un problema de conexión con GitHub o que el archivo esté vacío.",
      statusLabel: "Sin datos",
      statusClass: "text-on-surface-variant",
    };
  }

  if (n === 0) {
    return {
      headline: "Buenas noticias: no vimos riesgos evidentes",
      body: "Eso no significa que el proyecto sea 100 % seguro, pero no encontramos patrones preocupantes en lo que analizamos.",
      statusLabel: "Todo en orden por ahora",
      statusClass: "text-primary",
    };
  }

  if (result.trafficLight === "red" || urgent > 0) {
    return {
      headline:
        urgent > 0
          ? `Encontramos ${urgent} punto${urgent > 1 ? "s" : ""} urgente${urgent > 1 ? "s" : ""}`
          : "Tu proyecto necesita atención antes de publicarse",
      body: "Abajo te explicamos cada hallazgo en palabras simples: qué es, por qué importa y qué podés hacer. No hace falta saber programar para entenderlo.",
      statusLabel: "Requiere acción",
      statusClass: "text-[#F87171]",
    };
  }

  if (result.trafficLight === "yellow") {
    return {
      headline: `Hay ${n} punto${n > 1 ? "s" : ""} para revisar`,
      body: "Nada parece una emergencia inmediata, pero conviene leer las explicaciones y planificar correcciones pronto.",
      statusLabel: "Revisar pronto",
      statusClass: "text-[#FACC15]",
    };
  }

  return {
    headline: `Detectamos ${n} detalle${n > 1 ? "s" : ""} menor${n > 1 ? "es" : ""}`,
    body: "Son mejoras recomendables. Cada tarjeta te guía paso a paso sin tecnicismos innecesarios.",
    statusLabel: "Riesgo bajo",
    statusClass: "text-primary",
  };
}

type Props = {
  result: AnalysisResult;
  onNewAnalysis: () => void;
};

export function AnalysisResultsView({ result, onNewAnalysis }: Props) {
  const summary = summaryCopy(result);
  const urgentCount = result.findings.filter((f) => f.severity === "high").length;
  const importantCount = result.findings.filter((f) => f.severity === "medium").length;
  const filesLabel =
    result.limits.filesProcessed === 1
      ? "1 archivo revisado"
      : `${result.limits.filesProcessed} archivos revisados`;

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

      <section className="relative bg-surface-container-high rounded-xl p-lg md:p-xl inner-glow border border-outline-variant overflow-hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="relative z-10 w-full space-y-md">
          <span className={`font-label-caps text-label-caps tracking-widest ${summary.statusClass}`}>
            {summary.statusLabel}
          </span>
          <h2 className="font-headline-lg text-[28px] md:text-headline-lg text-on-surface leading-tight">
            {summary.headline}
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            {summary.body}
          </p>

          {result.findings.length > 0 && (
            <div className="flex flex-wrap gap-sm pt-sm">
              {urgentCount > 0 && (
                <span className="px-sm py-1 rounded-full bg-[#F87171]/15 text-[#F87171] text-[12px] font-label-caps">
                  {urgentCount} urgente{urgentCount > 1 ? "s" : ""}
                </span>
              )}
              {importantCount > 0 && (
                <span className="px-sm py-1 rounded-full bg-[#FACC15]/15 text-[#FACC15] text-[12px] font-label-caps">
                  {importantCount} importante{importantCount > 1 ? "s" : ""}
                </span>
              )}
              {result.limits.filesProcessed > 0 && (
                <span className="px-sm py-1 rounded-full bg-surface-container text-on-surface-variant text-[12px]">
                  {filesLabel}
                </span>
              )}
            </div>
          )}
        </div>
      </section>

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
            <span className="material-symbols-outlined text-primary shrink-0" data-icon="school">
              school
            </span>
            Aprendé qué significa cada alerta
          </h3>
          <p className="text-[14px] text-on-surface-variant mt-xs w-full max-w-3xl leading-relaxed">
            Cada tarjeta responde: qué encontramos, por qué te importa, qué podría pasar y qué
            hacer. Los detalles de código son opcionales.
          </p>
        </div>

        {result.findings.length === 0 && result.limits.filesProcessed > 0 ? (
          <div className="py-xl text-center rounded-xl border border-outline-variant bg-surface-container-low">
            <span
              className="material-symbols-outlined text-[48px] text-primary mb-md block mx-auto"
              data-icon="verified_user"
            >
              verified_user
            </span>
            <p className="text-on-surface font-headline-md">No hay alertas que mostrar</p>
            <p className="text-on-surface-variant text-[14px] mt-xs max-w-md mx-auto">
              Seguí buenas prácticas al desplegar y volvé a escanear cuando cambies algo
              importante.
            </p>
          </div>
        ) : result.findings.length > 0 ? (
          <div className="grid w-full min-w-0 grid-cols-1 md:grid-cols-2 gap-md md:gap-lg">
            {result.findings.map((finding) => (
              <div key={finding.id} className="min-w-0 w-full">
                <FindingCard finding={finding} />
              </div>
            ))}
          </div>
        ) : null}
      </section>

      <p className="text-[12px] text-outline text-center w-full max-w-2xl mx-auto px-sm leading-relaxed">
        VibeGuard es una guía educativa, no reemplaza una auditoría profesional. Antes de manejar
        datos reales de usuarios, consultá con alguien de seguridad si tenés dudas.
      </p>
    </div>
  );
}
