import { useCallback, useEffect, useMemo, useState } from "react";

import type { OwaspId } from "../components/FindingCard";
import type {
  CategoryLearningProgress,
  LearningProgressStore,
} from "../types/learning";

const PROGRESS_KEY = "vg_learning_progress_v1";
const MODULE_CACHE_PREFIX = "vg_learning_module_";

function readStore(userScope: string): LearningProgressStore {
  try {
    const raw = localStorage.getItem(`${PROGRESS_KEY}_${userScope}`);
    if (!raw) return {};
    return JSON.parse(raw) as LearningProgressStore;
  } catch {
    return {};
  }
}

function writeStore(userScope: string, store: LearningProgressStore) {
  try {
    localStorage.setItem(`${PROGRESS_KEY}_${userScope}`, JSON.stringify(store));
  } catch {
    /* quota */
  }
}

function emptyProgress(): CategoryLearningProgress {
  return {
    checklistDone: [],
    lessonsRead: [],
    quizAnswers: {},
    quizSubmitted: false,
    updatedAt: new Date().toISOString(),
  };
}

export function moduleCacheKey(analysisId: string, owaspId: OwaspId) {
  return `${MODULE_CACHE_PREFIX}${analysisId}_${owaspId}`;
}

export function useLearningProgress(userScope: string) {
  const [store, setStore] = useState<LearningProgressStore>(() => readStore(userScope));

  useEffect(() => {
    setStore(readStore(userScope));
  }, [userScope]);

  const persist = useCallback(
    (next: LearningProgressStore) => {
      setStore(next);
      writeStore(userScope, next);
    },
    [userScope],
  );

  const getProgress = useCallback(
    (analysisId: string, owaspId: OwaspId): CategoryLearningProgress => {
      const raw = store[analysisId]?.[owaspId];
      if (!raw) return emptyProgress();
      return {
        ...emptyProgress(),
        ...raw,
        lessonsRead: raw.lessonsRead ?? [],
      };
    },
    [store],
  );

  const updateProgress = useCallback(
    (
      analysisId: string,
      owaspId: OwaspId,
      patch: Partial<CategoryLearningProgress>,
    ) => {
      const current = getProgress(analysisId, owaspId);
      const merged: CategoryLearningProgress = {
        ...current,
        ...patch,
        updatedAt: new Date().toISOString(),
      };
      const next: LearningProgressStore = {
        ...store,
        [analysisId]: {
          ...(store[analysisId] ?? {}),
          [owaspId]: merged,
        },
      };
      persist(next);
    },
    [getProgress, persist, store],
  );

  const toggleChecklistItem = useCallback(
    (analysisId: string, owaspId: OwaspId, itemId: string) => {
      const current = getProgress(analysisId, owaspId);
      const done = new Set(current.checklistDone);
      if (done.has(itemId)) done.delete(itemId);
      else done.add(itemId);
      updateProgress(analysisId, owaspId, {
        checklistDone: [...done],
      });
    },
    [getProgress, updateProgress],
  );

  const toggleLessonRead = useCallback(
    (analysisId: string, owaspId: OwaspId, lessonId: string) => {
      const current = getProgress(analysisId, owaspId);
      const read = new Set(current.lessonsRead ?? []);
      if (read.has(lessonId)) read.delete(lessonId);
      else read.add(lessonId);
      updateProgress(analysisId, owaspId, {
        lessonsRead: [...read],
      });
    },
    [getProgress, updateProgress],
  );

  const setQuizAnswer = useCallback(
    (analysisId: string, owaspId: OwaspId, questionId: string, optionIndex: number) => {
      const current = getProgress(analysisId, owaspId);
      updateProgress(analysisId, owaspId, {
        quizAnswers: { ...current.quizAnswers, [questionId]: optionIndex },
      });
    },
    [getProgress, updateProgress],
  );

  const submitQuiz = useCallback(
    (analysisId: string, owaspId: OwaspId) => {
      updateProgress(analysisId, owaspId, { quizSubmitted: true });
    },
    [updateProgress],
  );

  return useMemo(
    () => ({
      getProgress,
      updateProgress,
      toggleChecklistItem,
      toggleLessonRead,
      setQuizAnswer,
      submitQuiz,
    }),
    [getProgress, updateProgress, toggleChecklistItem, toggleLessonRead, setQuizAnswer, submitQuiz],
  );
}
