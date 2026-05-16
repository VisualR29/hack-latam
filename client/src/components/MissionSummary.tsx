import { severityVisual } from "../content/securityMetaphors";

type Props = {
  urgent: number;
  important: number;
  minor: number;
};

export function MissionSummary({ urgent, important, minor }: Props) {
  const total = urgent + important + minor;
  if (total === 0) return null;

  const items = [
    { count: urgent, severity: "high" as const },
    { count: important, severity: "medium" as const },
    { count: minor, severity: "low" as const },
  ].filter((x) => x.count > 0);

  return (
    <section className="grid grid-cols-1 sm:grid-cols-3 gap-sm" aria-label="Resumen de misiones">
      {items.map(({ count, severity }) => {
        const v = severityVisual(severity);
        return (
          <div
            key={severity}
            className={`rounded-xl border ${v.border} ${v.bg} p-md flex items-center gap-md`}
          >
            <span className="text-3xl" aria-hidden>
              {v.emoji}
            </span>
            <div>
              <p className={`text-2xl font-headline-lg leading-none ${v.text}`}>{count}</p>
              <p className="text-[12px] text-on-surface-variant">{v.label}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
