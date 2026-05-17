import type { LearningQuizQuestion } from "../types/learning";

function hashString(value: string): number {
  let hash = 0;
  for (let i = 0; i < value.length; i++) {
    hash = (Math.imul(31, hash) + value.charCodeAt(i)) | 0;
  }
  return hash >>> 0;
}

function seededShuffle<T>(items: T[], seed: number): T[] {
  const arr = [...items];
  let state = seed || 1;
  for (let i = arr.length - 1; i > 0; i--) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    const j = state % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/** Mezcla opciones del quiz; el orden es estable por análisis pero varía entre cursos. */
export function shuffleQuizQuestion(
  question: LearningQuizQuestion,
  seedKey: string,
): LearningQuizQuestion {
  const order = question.options.map((_, index) => index);
  const shuffledOrder = seededShuffle(order, hashString(`${seedKey}:${question.id}`));
  const options = shuffledOrder.map((index) => question.options[index]);
  const correctIndex = shuffledOrder.indexOf(question.correctIndex);
  return { ...question, options, correctIndex };
}

export function shuffleQuizQuestions(
  questions: LearningQuizQuestion[],
  seedKey: string,
): LearningQuizQuestion[] {
  return questions.map((q) => shuffleQuizQuestion(q, seedKey));
}
