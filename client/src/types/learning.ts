import type { OwaspId } from "../components/FindingCard";

export type LearningLesson = {
  id: string;
  title: string;
  body: string;
};

export type LearningChecklistItem = {
  id: string;
  text: string;
};

export type LearningQuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};

export type CategoryLearningModule = {
  owaspId: OwaspId;
  categoryName: string;
  headline: string;
  intro: string;
  lessons: LearningLesson[];
  checklist: LearningChecklistItem[];
  quiz: LearningQuizQuestion[];
};

export type CategoryLearningProgress = {
  checklistDone: string[];
  lessonsRead: string[];
  quizAnswers: Record<string, number>;
  quizSubmitted: boolean;
  updatedAt: string;
};

export type LearningProgressStore = Record<
  string,
  Record<string, CategoryLearningProgress>
>;
