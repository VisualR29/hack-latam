import { z } from "zod";

import { OwaspIdSchema } from "./owasp.js";

export const LearningLessonSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
});

export const LearningChecklistItemSchema = z.object({
  id: z.string(),
  text: z.string(),
});

export const LearningQuizQuestionSchema = z.object({
  id: z.string(),
  question: z.string(),
  options: z.array(z.string()).min(2).max(4),
  correctIndex: z.number().int().min(0).max(3),
  explanation: z.string(),
});

export const CategoryLearningModuleSchema = z.object({
  owaspId: OwaspIdSchema,
  categoryName: z.string(),
  headline: z.string(),
  intro: z.string(),
  lessons: z.array(LearningLessonSchema).min(1).max(4),
  checklist: z.array(LearningChecklistItemSchema).min(3).max(8),
  quiz: z.array(LearningQuizQuestionSchema).min(2).max(5),
});

export type CategoryLearningModule = z.infer<typeof CategoryLearningModuleSchema>;

export const LearningModuleRequestSchema = z.object({
  analysisId: z.string().min(1).max(128),
  owaspId: OwaspIdSchema,
  categoryName: z.string().min(1).max(200),
  categoryDescription: z.string().min(1).max(2000),
  findings: z
    .array(
      z.object({
        id: z.string(),
        title: z.string(),
        severity: z.enum(["low", "medium", "high"]),
        description: z.string().max(2000),
      }),
    )
    .min(1)
    .max(40),
});

export type LearningModuleRequest = z.infer<typeof LearningModuleRequestSchema>;
