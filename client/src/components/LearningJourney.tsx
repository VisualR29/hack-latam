const STEPS = [
  {
    icon: "speed",
    title: "Tu puntaje",
    body: "El número grande muestra qué tan protegida está tu app (0 = muy vulnerable, 100 = muy segura).",
  },
  {
    icon: "folder_open",
    title: "Las áreas",
    body: "Cada tarjeta agrupa un tipo de riesgo. Abrila para ver el resumen de cada hallazgo.",
  },
  {
    icon: "school",
    title: "Aprendizaje",
    body: "En la pestaña Aprendizaje encontrás lecciones simples, checklist y un quiz según tu análisis.",
  },
] as const;

type Props = {
  coursesAvailable?: number;
};

export function LearningJourney({ coursesAvailable = 0 }: Props) {
  return (
    <section
      className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/8 to-surface-container-low p-md md:p-lg"
      aria-label="Cómo leer tu informe"
    >
      <div className="flex flex-wrap items-center gap-sm mb-md">
        <span className="material-symbols-outlined text-primary text-[28px]" data-icon="info">
          info
        </span>
        <div className="flex-1 min-w-0">
          <h3 className="font-headline-md text-[17px] text-on-surface">Cómo usar este informe</h3>
          <p className="text-[13px] text-on-surface-variant">Tres pasos en lenguaje simple</p>
        </div>
        {coursesAvailable > 0 && (
          <span className="text-[11px] font-label-caps px-sm py-0.5 rounded-full bg-primary/15 text-primary">
            {coursesAvailable} curso{coursesAvailable !== 1 ? "s disponibles" : " disponible"}
          </span>
        )}
      </div>

      <ol className="grid grid-cols-1 md:grid-cols-3 gap-md">
        {STEPS.map((step, i) => (
          <li
            key={step.title}
            className="relative flex gap-sm rounded-lg bg-surface-container/60 border border-outline-variant/40 p-sm"
          >
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary font-label-caps text-[13px]"
              aria-hidden
            >
              {i + 1}
            </span>
            <div className="min-w-0 space-y-1">
              <h4 className="flex items-center gap-1 text-[14px] font-semibold text-on-surface">
                <span className="material-symbols-outlined text-[18px] text-primary" data-icon={step.icon}>
                  {step.icon}
                </span>
                {step.title}
              </h4>
              <p className="text-[13px] text-on-surface-variant leading-relaxed">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
