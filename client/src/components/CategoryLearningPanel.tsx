import { useMemo } from "react";

import { useLearningProgress } from "../hooks/useLearningProgress";
import { shuffleQuizQuestions } from "../util/shuffleQuiz";
import type { CategoryLearningModule } from "../types/learning";
import type { OwaspCategory } from "../types/analysis";
import type { OwaspId } from "./FindingCard";

type Props = {
  analysisId: string;
  category: OwaspCategory;
  learningPremium: boolean;
  userScope: string;
  module?: CategoryLearningModule;
};

function IaRequiredMessage() {
  return (
    <div className="rounded-xl border border-outline-variant/60 bg-surface-container/50 p-md space-y-sm">
      <div className="flex items-center gap-sm">
        <span className="material-symbols-outlined text-primary text-[22px]" data-icon="school">
          school
        </span>
        <h5 className="font-headline-md text-[16px] text-on-surface">Aprendizaje interactivo</h5>
      </div>
      <p className="text-[14px] text-on-surface-variant leading-relaxed">
        Los cursos interactivos requieren activar IA en el servidor (
        <code className="text-[12px]">OPENAI_API_KEY</code>). Mientras tanto, podés leer el resumen
        de cada hallazgo en la pestaña Resumen.
      </p>
    </div>
  );
}

function NoModuleMessage() {
  return (
    <p className="text-[14px] text-on-surface-variant leading-relaxed rounded-lg border border-outline-variant/40 p-sm">
      Esta área no incluye un curso en este análisis (solo generamos cursos para las 3 categorías
      más importantes con riesgo medio o alto).
    </p>
  );
}

export function CategoryLearningPanel({
  analysisId,
  category,
  learningPremium,
  userScope,
  module,
}: Props) {
  const {
    getProgress,
    toggleChecklistItem,
    toggleLessonRead,
    setQuizAnswer,
    submitQuiz,
  } = useLearningProgress(userScope);

  const progress = getProgress(analysisId, category.owaspId);
  const owaspId = category.owaspId as OwaspId;

  const displayQuiz = useMemo(() => {
    if (!module) return [];
    return shuffleQuizQuestions(module.quiz, `${analysisId}:${owaspId}`);
  }, [module, analysisId, owaspId]);

  const checklistTotal = module?.checklist.length ?? 0;
  const checklistDone = progress.checklistDone.length;
  const lessonsTotal = module?.lessons.length ?? 0;
  const lessonsRead = progress.lessonsRead.length;

  const quizStats = useMemo(() => {
    if (!module || !progress.quizSubmitted) {
      return { correct: 0, total: module?.quiz.length ?? 0 };
    }
    let correct = 0;
    for (const q of displayQuiz) {
      if (progress.quizAnswers[q.id] === q.correctIndex) correct++;
    }
    return { correct, total: displayQuiz.length };
  }, [displayQuiz, progress.quizAnswers, progress.quizSubmitted]);

  const overallPct = useMemo(() => {
    if (!module) return 0;
    const lessonWeight = module.lessons.length;
    const checklistWeight = module.checklist.length;
    const quizWeight = module.quiz.length;
    const totalWeight = lessonWeight + checklistWeight + quizWeight;
    if (totalWeight === 0) return 0;

    const lessonPart = (lessonsRead / Math.max(lessonWeight, 1)) * lessonWeight;
    const checklistPart =
      (checklistDone / Math.max(checklistWeight, 1)) * checklistWeight;
    const quizPart = progress.quizSubmitted
      ? (quizStats.correct / Math.max(quizStats.total, 1)) * quizWeight
      : 0;

    return Math.round(((lessonPart + checklistPart + quizPart) / totalWeight) * 100);
  }, [module, lessonsRead, checklistDone, progress.quizSubmitted, quizStats]);

  if (!learningPremium) {
    return <IaRequiredMessage />;
  }

  if (!module) {
    return <NoModuleMessage />;
  }

  return (
    <div className="rounded-xl border border-primary/20 bg-surface-container/30 p-md md:p-lg space-y-lg">
      <header className="space-y-sm">
        <div className="flex flex-wrap gap-xs">
          {overallPct >= 100 && (
            <span className="text-[10px] font-label-caps px-sm py-0.5 rounded-full bg-primary/20 text-primary">
              Completado
            </span>
          )}
        </div>
        <h5 className="font-headline-md text-[18px] text-on-surface leading-snug">{module.headline}</h5>
        <p className="text-[14px] text-on-surface-variant leading-relaxed">{module.intro}</p>
        <div className="space-y-1">
          <div className="flex justify-between text-[11px]">
            <span className="text-on-surface-variant">Tu progreso en esta área</span>
            <span className="font-bold text-primary">{overallPct}%</span>
          </div>
          <div className="h-2 rounded-full bg-surface-container-highest overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
        </div>
      </header>

      <section className="space-y-sm" aria-label="Lecciones">
        <h6 className="flex items-center justify-between gap-sm font-label-caps text-[12px] text-on-surface">
          <span className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-[18px] text-primary" data-icon="menu_book">
              menu_book
            </span>
            Lecciones
          </span>
          <span className="text-on-surface-variant">
            {lessonsRead}/{lessonsTotal} leídas
          </span>
        </h6>
        <div className="space-y-sm">
          {module.lessons.map((lesson, i) => {
            const read = progress.lessonsRead.includes(lesson.id);
            return (
              <article
                key={lesson.id}
                className={`rounded-lg border p-sm space-y-1 transition-colors ${
                  read
                    ? "border-primary/30 bg-primary/5"
                    : "border-outline-variant/40 bg-surface-container-high/60"
                }`}
              >
                <div className="flex items-start justify-between gap-sm">
                  <p className="text-[11px] font-label-caps text-primary">Lección {i + 1}</p>
                  <label className="flex items-center gap-1 shrink-0 cursor-pointer text-[12px] text-on-surface-variant">
                    <input
                      type="checkbox"
                      checked={read}
                      onChange={() => toggleLessonRead(analysisId, owaspId, lesson.id)}
                      className="h-3.5 w-3.5 rounded border-outline-variant text-primary focus:ring-primary"
                    />
                    Leída
                  </label>
                </div>
                <p className="text-[15px] font-semibold text-on-surface">{lesson.title}</p>
                <p className="text-[14px] text-on-surface leading-relaxed">{lesson.body}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section className="space-y-sm" aria-label="Checklist">
        <h6 className="flex items-center justify-between gap-sm font-label-caps text-[12px] text-on-surface">
          <span className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-[18px] text-primary" data-icon="checklist">
              checklist
            </span>
            Tu plan de acción
          </span>
          <span className="text-on-surface-variant">
            {checklistDone}/{checklistTotal}
          </span>
        </h6>
        <ul className="space-y-xs">
          {module.checklist.map((item) => {
            const done = progress.checklistDone.includes(item.id);
            return (
              <li key={item.id}>
                <label className="flex gap-sm items-start cursor-pointer rounded-lg border border-outline-variant/30 p-sm hover:bg-surface-container-high/50 transition-colors">
                  <input
                    type="checkbox"
                    checked={done}
                    onChange={() => toggleChecklistItem(analysisId, owaspId, item.id)}
                    className="mt-1 h-4 w-4 rounded border-outline-variant text-primary focus:ring-primary"
                  />
                  <span
                    className={`text-[14px] leading-relaxed ${done ? "text-on-surface-variant line-through" : "text-on-surface"}`}
                  >
                    {item.text}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="space-y-md" aria-label="Quiz">
        <h6 className="flex items-center gap-xs font-label-caps text-[12px] text-on-surface">
          <span className="material-symbols-outlined text-[18px] text-primary" data-icon="quiz">
            quiz
          </span>
          Poné a prueba lo aprendido
        </h6>
        {displayQuiz.map((q, qi) => {
          const selected = progress.quizAnswers[q.id];
          const showResult = progress.quizSubmitted;
          const isCorrect = selected === q.correctIndex;
          return (
            <fieldset
              key={q.id}
              className="rounded-lg border border-outline-variant/40 p-sm space-y-sm"
              disabled={progress.quizSubmitted}
            >
              <legend className="text-[14px] font-semibold text-on-surface px-1">
                {qi + 1}. {q.question}
              </legend>
              <div className="space-y-xs">
                {q.options.map((opt, oi) => {
                  const picked = selected === oi;
                  let optClass = "border-outline-variant/40 hover:border-primary/40";
                  if (showResult && oi === q.correctIndex) {
                    optClass = "border-primary bg-primary/10";
                  } else if (showResult && picked && !isCorrect) {
                    optClass = "border-[#F87171]/50 bg-[#F87171]/10";
                  } else if (picked) {
                    optClass = "border-primary/50 bg-primary/5";
                  }
                  return (
                    <label
                      key={oi}
                      className={`flex gap-sm items-center rounded-lg border p-sm cursor-pointer transition-colors ${optClass}`}
                    >
                      <input
                        type="radio"
                        name={q.id}
                        checked={picked}
                        onChange={() => setQuizAnswer(analysisId, owaspId, q.id, oi)}
                        className="text-primary focus:ring-primary"
                      />
                      <span className="text-[14px] text-on-surface">{opt}</span>
                    </label>
                  );
                })}
              </div>
              {showResult && (
                <p
                  className={`text-[13px] leading-relaxed px-1 ${isCorrect ? "text-primary" : "text-[#FACC15]"}`}
                >
                  {isCorrect ? "Correcto. " : "Revisá la lección: "}
                  {q.explanation}
                </p>
              )}
            </fieldset>
          );
        })}
        {!progress.quizSubmitted ? (
          <button
            type="button"
            onClick={() => submitQuiz(analysisId, owaspId)}
            disabled={Object.keys(progress.quizAnswers).length < displayQuiz.length}
            className="w-full sm:w-auto bg-surface-container-highest border border-primary/40 text-primary px-lg py-sm rounded-lg font-label-caps text-[12px] font-bold hover:bg-primary/10 disabled:opacity-40"
          >
            Ver resultados del quiz
          </button>
        ) : (
          <p className="text-[14px] text-on-surface">
            Respondiste bien{" "}
            <strong className="text-primary">
              {quizStats.correct} de {quizStats.total}
            </strong>
            .{" "}
            {quizStats.correct === quizStats.total
              ? "Muy bien."
              : "Repasá las lecciones y volvé a intentar."}
          </p>
        )}
      </section>
    </div>
  );
}
