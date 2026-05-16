const STEPS = [
  {
    icon: "shield",
    title: "Tu escudo",
    body: "El número grande es qué tan protegida está tu app (0 = muy vulnerable, 100 = muy segura).",
  },
  {
    icon: "map",
    title: "Las áreas",
    body: "Cada tarjeta es un tipo de riesgo. Tocala para ver las misiones dentro.",
  },
  {
    icon: "task_alt",
    title: "Tus misiones",
    body: "Cada alerta explica qué pasó, por qué importa y qué hacer — sin jerga obligatoria.",
  },
] as const;

export function LearningJourney() {
  return (
    <section
      className="rounded-xl border border-primary/25 bg-gradient-to-br from-primary/8 to-surface-container-low p-md md:p-lg"
      aria-label="Cómo leer tu informe"
    >
      <div className="flex items-center gap-sm mb-md">
        <span className="text-2xl" aria-hidden>
          🎮
        </span>
        <div>
          <h3 className="font-headline-md text-[17px] text-on-surface">Cómo leer tu informe</h3>
          <p className="text-[13px] text-on-surface-variant">Tres pasos, sin ser programador</p>
        </div>
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
