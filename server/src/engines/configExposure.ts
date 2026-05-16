import type { Finding } from "../schemas/findings.js";
import type { FileSnapshot } from "../ingest/types.js";
import { lineAndColumn } from "../util/positions.js";
import { findingFingerprint } from "./id.js";

export function runConfigExposureEngine(files: FileSnapshot[]): Finding[] {
  const out: Finding[] = [];

  for (const file of files) {
    const p = file.path.replace(/\\/g, "/");
    const base = p.includes("/") ? p.slice(p.lastIndexOf("/") + 1) : p;

    if (base === ".env" || base.startsWith(".env.")) {
      const hasSecretPair = /^[A-Za-z0-9_]+\s*=\s*\S+/m.test(file.content);
      if (hasSecretPair) {
        out.push({
          id: findingFingerprint(["CONFIG_DOTENV", file.path]),
          ruleId: "CONFIG_DOTENV",
          title: "Archivo de variables de entorno con valores reales",
          severity: "high",
          owaspId: "A02",
          file: file.path,
          line: 1,
          description:
            "Parece un `.env` tipico con asignaciones (`CLAVE = valor`). Si se publica, cualquiera puede reutilizar tus credenciales.",
          fixRecommendation:
            "Mantén sólo `.env.example` en el repositorio sin secretos, rota claves expuestas y configura secret manager/CI seguro.",
          safeExample:
            "# .env.example (sin secretos reales)\nDATABASE_URL=\nAPI_PUBLIC_NAME=",
        });
      }
    }

    if (/\.(js|cjs|mjs|ts|tsx|jsx)$/i.test(p)) {
      const corsRegex = /cors\s*\(\s*\{[^}]{0,320}origin\s*:\s*(?:\*|['"`]\*['"`]|true)/i;
      let m: RegExpExecArray | null;
      const reC = new RegExp(corsRegex.source, corsRegex.flags.includes("g") ? corsRegex.flags : `${corsRegex.flags}g`);

      while ((m = reC.exec(file.content))) {
        const lc = lineAndColumn(file.content, m.index);
        out.push({
          id: findingFingerprint(["CONFIG_CORS_STAR", file.path, lc.line]),
          ruleId: "CONFIG_CORS_STAR",
          title: "CORS demasiado abierto (comodín o true)",
          severity: "medium",
          owaspId: "A02",
          file: file.path,
          line: lc.line,
          column: lc.column,
          description:
            "`origin: '*'` permite que sitios de terceros lancen peticiones privilegiadas usando la sesión real del usuario cuando se combina con credenciales/envío de cookies.",
          fixRecommendation:
            "Enumera dominios de confianza, limita métodos/headers y revisa si necesitas `credentials: true`.",
          safeExample:
            "origin: process.env.ALLOWED_ORIGIN?.split(',') ?? ['https://app.tudominio.com']",
        });
      }

      const debugHits = [...file.content.matchAll(/\bDEBUG\s*[:=]\s*(?:true|'true'|"true")\b/gi)];
      for (const hit of debugHits) {
        const lc = lineAndColumn(file.content, hit.index ?? 0);
        out.push({
          id: findingFingerprint(["CONFIG_DEBUG", file.path, lc.line]),
          ruleId: "CONFIG_DEBUG_ENABLED",
          title: "FLAG `DEBUG` parece activo",
          severity: "low",
          owaspId: "A02",
          file: file.path,
          line: lc.line,
          column: lc.column,
          description:
            "En producción suele filtrar errores internos, rutas ocultas y detalles útiles para attackers.",
          fixRecommendation:
            "Apaga debug en entornos externos, centraliza logs seguros sólo lado servidor.",
        });
      }
    }

    if (/\.(env|tsx?|jsx?)$/i.test(p)) {
      const publicSecretLine =
        /\bNEXT_PUBLIC_[A-Z0-9_]*(?:SECRET|KEY|PASSWORD|TOKEN)\b\s*=/gi;
      let matchCount = 0;
      for (const hit of file.content.matchAll(publicSecretLine)) {
        matchCount++;
        const lc = lineAndColumn(file.content, hit.index ?? 0);
        out.push({
          id: findingFingerprint(["CONFIG_PUBLIC_SECRET", file.path, lc.line, hit.index ?? 0]),
          ruleId: "CONFIG_PUBLIC_SECRET_NAME",
          title: "Variable pública (`NEXT_PUBLIC_`) con nombre de secreto",
          severity: "high",
          owaspId: "A04",
          file: file.path,
          line: lc.line,
          column: lc.column,
          description:
            "Si el navegador puede leerlo, cualquier visitante también. No uses prefijos públicos para claves sólo servidor.",
          fixRecommendation:
            "Elimina ese nombre del bundle cliente; usa sólo servidor/edge privado y rota valores si llegaron al repo.",
          safeExample: "PRIVATE_API_SERVER_ONLY=valor\n// valores públicos: NEXT_PUBLIC_MAPBOX_STYLE_ID",
        });
        if (matchCount >= 3) break;
      }
    }
  }

  return out;
}
