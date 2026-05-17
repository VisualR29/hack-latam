import { z } from "zod";

import type { CategoryLearningModule, LearningModuleRequest } from "../schemas/learning.js";
import {
  CategoryLearningModuleSchema,
  LearningModuleRequestSchema,
} from "../schemas/learning.js";
import { log, startTimer } from "../util/logger.js";

const AiModuleSchema = z.object({ module: CategoryLearningModuleSchema });

function readAiConfig(): {
  apiKey?: string;
  baseUrl: string;
  model: string;
} {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const baseUrl = (
    process.env.OPENAI_BASE_URL || "https://api.openai.com/v1"
  ).replace(/\/+$/, "");
  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  return { apiKey: apiKey || undefined, baseUrl, model };
}

export function isLearningPremiumEnabled(): boolean {
  return Boolean(process.env.OPENAI_API_KEY?.trim());
}

export async function generateCategoryLearningModule(
  input: LearningModuleRequest,
  reqId?: string,
): Promise<CategoryLearningModule> {
  const parsed = LearningModuleRequestSchema.parse(input);

  if (!isLearningPremiumEnabled()) {
    const err = new Error(
      "La Academia interactiva requiere OPENAI_API_KEY en el servidor.",
    ) as Error & { status?: number; code?: string };
    err.status = 503;
    err.code = "LEARNING_PREMIUM_REQUIRED";
    throw err;
  }

  const { apiKey, baseUrl, model } = readAiConfig();
  const aiMs = startTimer();

  const findingsBrief = parsed.findings.map((f) => ({
    title: f.title,
    severity: f.severity,
    summary: f.description.slice(0, 400),
  }));

  log.info("learning.ai.start", "Generando módulo educativo por categoría", {
    reqId,
    owaspId: parsed.owaspId,
    findings: parsed.findings.length,
    model,
  });

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90_000);

  try {
    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.35,
        messages: [
          {
            role: "system",
            content: [
              "Eres VibeGuard, guía de ciberseguridad para personas sin conocimientos de programación.",
              "Respondé ÚNICAMENTE JSON con forma estricta:",
              '{"module":{"owaspId":"A0X","categoryName":"","headline":"","intro":"","lessons":[{"id":"l1","title":"","body":""}],"checklist":[{"id":"c1","text":""}],"quiz":[{"id":"q1","question":"","options":["","","",""],"correctIndex":0,"explanation":""}]}}',
              "Reglas:",
              "- Español latinoamericano, tono neutro y claro (como para alguien de 12 años). Oraciones cortas.",
              "- Usá analogías cotidianas (casa, llaves, banco, tienda, diario personal) cuando ayuden.",
              "- Mencioná los hallazgos reales del usuario con ejemplos simples: 'En tu app encontramos…, es como…'.",
              "- Si usás un término técnico importante (token, contraseña, API), explicalo en una frase simple en intro o lección 1.",
              "- lessons: 2-3 lecciones cortas (3-5 oraciones cada body).",
              "- checklist: 4-6 pasos que el usuario pueda marcar (entender → hablar con quien desarrolla → validar).",
              "- quiz: 3-4 preguntas de opción múltiple; options siempre 4; correctIndex 0-3; explanation amable si fallan.",
              "- Basate SOLO en los hallazgos enviados; no inventes vulnerabilidades nuevas.",
              "- owaspId y categoryName deben coincidir con los datos del usuario.",
            ].join(" "),
          },
          {
            role: "user",
            content: JSON.stringify(
              {
                owaspId: parsed.owaspId,
                categoryName: parsed.categoryName,
                categoryDescription: parsed.categoryDescription,
                findingsInThisCategory: findingsBrief,
              },
              null,
              2,
            ).slice(0, 48_000),
          },
        ],
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      const err = new Error(`OpenAI respondió ${res.status}`) as Error & {
        status?: number;
        code?: string;
      };
      err.status = 502;
      err.code = "LEARNING_AI_ERROR";
      throw err;
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = payload.choices?.[0]?.message?.content;
    if (!text) {
      const err = new Error("OpenAI no devolvió contenido") as Error & {
        status?: number;
        code?: string;
      };
      err.status = 502;
      err.code = "LEARNING_AI_ERROR";
      throw err;
    }

    const aiParsed = AiModuleSchema.safeParse(JSON.parse(text));
    if (!aiParsed.success) {
      log.warn("learning.ai.parse_error", "JSON de academia inválido", {
        reqId,
        ms: aiMs(),
      });
      const err = new Error("No se pudo interpretar el curso generado") as Error & {
        status?: number;
        code?: string;
      };
      err.status = 502;
      err.code = "LEARNING_AI_ERROR";
      throw err;
    }

    const module = {
      ...aiParsed.data.module,
      owaspId: parsed.owaspId,
      categoryName: parsed.categoryName,
    };

    const validated = CategoryLearningModuleSchema.parse(module);

    log.info("learning.ai.done", "Módulo educativo generado", {
      reqId,
      ms: aiMs(),
      lessons: validated.lessons.length,
      checklist: validated.checklist.length,
      quiz: validated.quiz.length,
    });

    return validated;
  } catch (err) {
    clearTimeout(timer);
    if (err instanceof Error && "status" in err) throw err;
    log.warn("learning.ai.failed", "Fallo al generar academia", { reqId, ms: aiMs() }, err);
    const wrapped = new Error("No se pudo generar el curso en este momento") as Error & {
      status?: number;
      code?: string;
    };
    wrapped.status = 502;
    wrapped.code = "LEARNING_AI_ERROR";
    throw wrapped;
  }
}
