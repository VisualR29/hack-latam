import type { TrafficLight } from "../types/analysis";

type Props = {
  secureScore: number;
  trafficLight: TrafficLight;
  totalFindings: number;
  totalCategories: number;
  filesProcessed: number;
};

function trafficMeta(trafficLight: TrafficLight, secureScore: number) {
  switch (trafficLight) {
    case "green":
      return {
        label: "Tu app se ve bien protegida",
        status: "Segura",
        ring: "stroke-primary",
        glow: "bg-primary/15",
        text: "text-primary",
      };
    case "yellow":
      return {
        label: "Hay áreas que conviene mejorar",
        status: "En revisión",
        ring: "stroke-[#FACC15]",
        glow: "bg-[#FACC15]/15",
        text: "text-[#FACC15]",
      };
    default:
      return {
        label:
          secureScore < 20
            ? "Riesgo muy alto antes de publicar"
            : "Necesita atención antes de publicar",
        status: "Crítico",
        ring: "stroke-[#F87171]",
        glow: "bg-[#F87171]/15",
        text: "text-[#F87171]",
      };
  }
}

export function SecurityScoreHero({
  secureScore,
  trafficLight,
  totalFindings,
  totalCategories,
  filesProcessed,
}: Props) {
  const meta = trafficMeta(trafficLight, secureScore);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (secureScore / 100) * circumference;

  const filesLabel =
    filesProcessed === 1 ? "1 archivo revisado" : `${filesProcessed} archivos revisados`;

  return (
    <section className="relative w-full bg-surface-container-high rounded-xl p-lg md:p-xl inner-glow border border-outline-variant overflow-hidden">
      <div
        className={`absolute top-0 right-0 w-56 h-56 ${meta.glow} blur-[90px] rounded-full pointer-events-none`}
      />
      <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-lg">
        <div className="relative flex shrink-0 items-center justify-center mx-auto md:mx-0 w-[140px] h-[140px]">
          <svg width="140" height="140" viewBox="0 0 120 120" className="-rotate-90" aria-hidden>
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              className="text-surface-container-highest"
            />
            <circle
              cx="60"
              cy="60"
              r="54"
              fill="none"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className={meta.ring}
              style={{ transition: "stroke-dashoffset 0.6s ease" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`font-headline-lg text-[36px] leading-none ${meta.text}`}>
              {secureScore}
            </span>
            <span className="text-[12px] text-on-surface-variant mt-1">de 100</span>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-sm text-center md:text-left">
          <span className={`font-label-caps text-label-caps tracking-widest ${meta.text}`}>
            {meta.status}
          </span>
          <h2 className="font-headline-lg text-[26px] md:text-headline-lg text-on-surface leading-tight">
            Nivel de seguridad de tu app
          </h2>
          <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed">
            {meta.label}. Cuanto más alto el puntaje, más protegida está tu aplicación.
          </p>
          <div className="flex flex-wrap justify-center md:justify-start gap-sm pt-sm">
            {totalFindings > 0 ? (
              <span className="px-sm py-1 rounded-full bg-surface-container text-on-surface text-[12px]">
                {totalFindings} alerta{totalFindings !== 1 ? "s" : ""} en {totalCategories} área
                {totalCategories !== 1 ? "s" : ""}
              </span>
            ) : (
              <span className="px-sm py-1 rounded-full bg-primary/15 text-primary text-[12px]">
                Sin alertas detectadas
              </span>
            )}
            {filesProcessed > 0 && (
              <span className="px-sm py-1 rounded-full bg-surface-container text-on-surface-variant text-[12px]">
                {filesLabel}
              </span>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
