import { z } from "zod";

import type { Educational, Finding } from "../schemas/findings.js";
import { log, startTimer } from "../util/logger.js";
import { educationFor } from "./templates.js";

const EducationalBlockSchema = z.object({
  what: z.string(),
  why: z.string(),
  impact: z.string(),
  whoAffected: z.string(),
});

const EducationalItemSchema = z.object({
  id: z.string(),
  educational: EducationalBlockSchema,
});

const FlexibleAiSchema = z.union([
  z.object({ items: z.array(EducationalItemSchema) }),
  z.object({ findings: z.array(EducationalItemSchema) }),
]);

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

async function refineWithOpenAi(
  findings: Finding[],
  reqId?: string,
): Promise<Map<string, Educational> | null> {
  const { apiKey, baseUrl, model } = readAiConfig();
  if (!apiKey) return null;

  const brief = findings.map((f) => ({
    id: f.id,
    ruleId: f.ruleId,
    severity: f.severity,
    owaspId: f.owaspId,
    file: f.file,
    line: f.line,
    summaryTitle: f.title,
    summaryBody: f.description,
    baseline: educationFor(f.ruleId),
  }));

  const aiMs = startTimer();
  log.info("explain.ai.start", "Llamada a OpenAI para explicaciones", {
    reqId,
    model,
    findings: findings.length,
  });

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 85_000);

    const res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        messages: [
          {
            role: "system",
            content:
              "Eres VibeGuard, traductora de seguridad para personas sin formación técnica profunda. Responde ÚNICAMENTE JSON con la forma estricta {\"items\":[{\"id\":\"coincidente\",\"educational\":{\"what\":\"\",\"why\":\"\",\"impact\":\"\",\"whoAffected\":\"\"}}]} en español LATAM neutro y claro. No inventes nuevas vulnerabilidades ni cambies reglas OWASP declaradas.",
          },
          {
            role: "user",
            content: JSON.stringify({ findings: brief }, null, 2).slice(0, 56000),
          },
        ],
        response_format: { type: "json_object" },
      }),
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (!res.ok) {
      log.warn("explain.ai.http_error", "OpenAI respondió con error", {
        reqId,
        status: res.status,
        ms: aiMs(),
      });
      return null;
    }

    const payload = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };

    const text = payload.choices?.[0]?.message?.content;
    if (!text) return null;

    const parsed = JSON.parse(text) as unknown;


    const flexible = FlexibleAiSchema.safeParse(parsed);
    const items = flexible.success
      ? "items" in flexible.data
        ? flexible.data.items
        : flexible.data.findings
      : null;    if (!items) {
      log.warn("explain.ai.parse_error", "Respuesta de OpenAI sin formato esperado", {
        reqId,
        ms: aiMs(),
      });
      return null;
    }

    const map = new Map<string, Educational>();
    for (const item of items) {
      map.set(item.id, item.educational);
    }

    log.info("explain.ai.done", "Explicaciones IA aplicadas", {
      reqId,
      ms: aiMs(),
      items: map.size,
    });

    return map.size ? map : null;
  } catch (err) {
    log.warn(
      "explain.ai.failed",
      "Fallo al enriquecer con IA; se usan plantillas",
      { reqId, ms: aiMs() },
      err,
    );
    return null;
  }
}

export async function enrichFindingsEducation(
  findings: Finding[],
  reqId?: string,
): Promise<{ findings: Finding[]; usedAiExplanation: boolean }> {
  const hadAiKey = Boolean(process.env.OPENAI_API_KEY?.trim());

  if (findings.length === 0) {
    log.debug("explain.skip", "Sin hallazgos; no se enriquece", { reqId });
    return { findings, usedAiExplanation: false };
  }

  if (!hadAiKey) {
    log.debug("explain.templates", "Sin OPENAI_API_KEY; plantillas locales", {
      reqId,
      findings: findings.length,
    });
  }

  const capped = findings.slice(0, 80);
  const aiMap = await refineWithOpenAi(capped, reqId);

  const enriched = findings.map((f) => {
    const tpl = educationFor(f.ruleId);
    const refined =
      capped.some((candidate) => candidate.id === f.id) && aiMap
        ? aiMap.get(f.id)
        : undefined;
    const hasFull =
      refined &&
      refined.what &&
      refined.why &&
      refined.impact &&
      refined.whoAffected;

    const educational: Educational =
      hasFull && refined ? { ...tpl, ...refined } : tpl;

    return { ...f, educational };
  });

  const usedAiExplanation =
    hadAiKey &&
    !!aiMap &&
    capped.some((candidate) => aiMap.has(candidate.id));

  return { findings: enriched, usedAiExplanation };
}
