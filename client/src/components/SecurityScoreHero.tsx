import { securityRank } from "../content/securityMetaphors";
import type { TrafficLight } from "../types/analysis";

type Props = {
  secureScore: number;
  trafficLight: TrafficLight;
  totalFindings: number;
  totalCategories: number;
  filesProcessed: number;
};

function lampClass(active: TrafficLight, target: TrafficLight) {
  if (active !== target) return "lamp";
  if (target === "green") return "lamp onGreen";
  if (target === "yellow") return "lamp onYellow";
  return "lamp onRed";
}

export function SecurityScoreHero({
  secureScore,
  trafficLight,
  totalFindings,
  totalCategories,
  filesProcessed,
}: Props) {
  const rank = securityRank(secureScore, trafficLight);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (secureScore / 100) * circumference;

  const ringClass =
    trafficLight === "green"
      ? "stroke-primary"
      : trafficLight === "yellow"
        ? "stroke-[#FACC15]"
        : "stroke-[#F87171]";

  const barClass =
    trafficLight === "green"
      ? "bg-primary"
      : trafficLight === "yellow"
        ? "bg-[#FACC15]"
        : "bg-[#F87171]";

  const glowClass =
    trafficLight === "green"
      ? "bg-primary/15"
      : trafficLight === "yellow"
        ? "bg-[#FACC15]/15"
        : "bg-[#F87171]/15";

  const textClass =
    trafficLight === "green"
      ? "text-primary"
      : trafficLight === "yellow"
        ? "text-[#FACC15]"
        : "text-[#F87171]";

  const filesLabel =
    filesProcessed === 1 ? "1 archivo revisado" : `${filesProcessed} archivos revisados`;

  return (
    <section className="relative w-full bg-surface-container-high rounded-xl p-lg md:p-xl inner-glow border border-outline-variant overflow-hidden score-reveal">
      <div className={`absolute top-0 right-0 w-64 h-64 ${glowClass} blur-[100px] rounded-full pointer-events-none`} />

      <div className="relative z-10 w-full min-w-0">
        <div className="grid w-full grid-cols-1 lg:grid-cols-[auto_minmax(0,1fr)] gap-lg lg:gap-xl items-center">
          <div className="flex flex-col items-center lg:items-start gap-md w-full max-w-[220px] mx-auto lg:mx-0 lg:w-auto">
            <div className="relative w-[150px] h-[150px]">
              <svg width="150" height="150" viewBox="0 0 120 120" className="-rotate-90" aria-hidden>
                <circle
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  strokeWidth="8"
                  className="text-surface-container-highest"
                  stroke="currentColor"
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
                  className={ringClass}
                  style={{ transition: "stroke-dashoffset 0.8s ease" }}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl mb-0.5" aria-hidden>
                  {rank.emoji}
                </span>
                <span className={`font-headline-lg text-[38px] leading-none ${textClass}`}>
                  {secureScore}
                </span>
                <span className="text-[11px] text-on-surface-variant">escudo / 100</span>
              </div>
            </div>

            <div className="traffic-visual w-full max-w-[200px]">
              <div className="lamp-stack" aria-label={`Semáforo: ${trafficLight}`}>
                <span className={lampClass(trafficLight, "red")} title="Riesgo alto" />
                <span className={lampClass(trafficLight, "yellow")} title="Riesgo medio" />
                <span className={lampClass(trafficLight, "green")} title="Riesgo bajo" />
              </div>
              <p className="score-foot text-center">Semáforo de seguridad</p>
            </div>
          </div>

          <div className="w-full min-w-[min(100%,20rem)] text-center lg:text-left space-y-sm">
            <div className="flex flex-wrap justify-center lg:justify-start items-center gap-sm">
              <span
                className={`inline-flex items-center gap-1 px-sm py-1 rounded-full text-[11px] font-label-caps ${textClass} bg-surface-container border border-outline-variant`}
              >
                <span className="material-symbols-outlined text-[16px]" data-icon={rank.icon}>
                  {rank.icon}
                </span>
                Nivel {rank.level} · {rank.title}
              </span>
            </div>

            <h2 className="font-headline-lg text-[26px] md:text-headline-lg text-on-surface leading-tight">
              Tu escudo de seguridad
            </h2>
            <p className="font-body-md text-body-md text-on-surface-variant leading-relaxed w-full max-w-[32rem] mx-auto lg:mx-0">
              {rank.subtitle} Imaginá que tu app es una casa: este puntaje dice qué tan bien
              cerradas están las puertas y ventanas.
            </p>

            <div className="flex flex-wrap justify-center lg:justify-start gap-sm pt-sm">
              {totalFindings > 0 ? (
                <>
                  <span className="px-sm py-1 rounded-full bg-surface-container text-on-surface text-[12px] flex items-center gap-1">
                    <span aria-hidden>🎯</span>
                    {totalFindings} misión{totalFindings !== 1 ? "es" : ""}
                  </span>
                  <span className="px-sm py-1 rounded-full bg-surface-container text-on-surface-variant text-[12px]">
                    {totalCategories} área{totalCategories !== 1 ? "s" : ""} a revisar
                  </span>
                </>
              ) : (
                <span className="px-sm py-1 rounded-full bg-primary/15 text-primary text-[12px]">
                  ✨ Sin misiones pendientes
                </span>
              )}
              {filesProcessed > 0 && (
                <span className="px-sm py-1 rounded-full bg-surface-container text-on-surface-variant text-[12px]">
                  {filesLabel}
                </span>
              )}
            </div>

            <div className="pt-sm w-full max-w-[32rem] mx-auto lg:mx-0">
              <div className="h-2 rounded-full bg-surface-container-highest overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${barClass}`}
                  style={{ width: `${secureScore}%` }}
                />
              </div>
              <p className="text-[11px] text-outline mt-1 text-left">
                Más lleno = más protegida tu aplicación
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
