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

    // CSP Header validation
    if (/\.(ts|tsx|js|jsx|py)$/i.test(p)) {
      const cspUnsafeRegex = /Content-Security-Policy[\s]*[=:]\s*['""`]([^'"`]*(?:unsafe-inline|unsafe-eval)[^'"`]*)['""`]/gi;
      for (const hit of file.content.matchAll(cspUnsafeRegex)) {
        const lc = lineAndColumn(file.content, hit.index ?? 0);
        out.push({
          id: findingFingerprint(["CONFIG_CSP_UNSAFE", file.path, lc.line]),
          ruleId: "CONFIG_CSP_UNSAFE",
          title: "Content-Security-Policy con `unsafe-inline` o `unsafe-eval`",
          severity: "medium",
          owaspId: "A04",
          file: file.path,
          line: lc.line,
          column: lc.column,
          description:
            "CSP debilitada permite XSS inline. Reduce significativamente la protección contra inyección de scripts.",
          fixRecommendation:
            "Elimina `unsafe-inline` y `unsafe-eval`. Usa nonces o hashes para scripts permitidos. Implementa SRI para externos.",
          safeExample: "Content-Security-Policy: default-src 'self'; script-src 'self' 'nonce-random123'",
        });
      }
    }

    // X-Frame-Options validation
    if (/\.(ts|tsx|js|jsx|py)$/i.test(p)) {
      const xFrameRegex = /X-Frame-Options[\s]*[=:]\s*(?:SAMEORIGIN|DENY)?(?:;|,|$|\s)/gi;
      const missing = !/X-Frame-Options/i.test(file.content);
      
      if (missing && /app\.|express\.|fastify\.|django\.|flask|http\.|Server|middleware/i.test(file.content)) {
        const serverMatch = file.content.match(/(?:app\.|express\.|fastify\.|http\.server|Server|middleware)/);
        if (serverMatch) {
          const lc = lineAndColumn(file.content, serverMatch.index ?? 0);
          out.push({
            id: findingFingerprint(["CONFIG_XFRAME_MISSING", file.path]),
            ruleId: "CONFIG_XFRAME_MISSING",
            title: "Header X-Frame-Options no configurado",
            severity: "low",
            owaspId: "A04",
            file: file.path,
            line: lc.line,
            column: lc.column,
            description:
              "Falta X-Frame-Options permite que la página se cargue en frames/iframes ajenos, facilitando clickjacking.",
            fixRecommendation:
              "Configura `X-Frame-Options: DENY` o `SAMEORIGIN` según necesidad. En Express: `app.use((req, res, next) => { res.setHeader('X-Frame-Options', 'DENY'); next(); })`",
            safeExample: "res.setHeader('X-Frame-Options', 'DENY')",
          });
        }
      }
    }

    // HSTS Header validation
    if (/\.(ts|tsx|js|jsx|py)$/i.test(p)) {
      const hstsRegex = /Strict-Transport-Security[\s]*[=:]\s*['""`]([^'"`]*)['""`]/gi;
      let hasHsts = false;
      for (const hit of file.content.matchAll(hstsRegex)) {
        hasHsts = true;
        const headerValue = hit[1] || "";
        // Check if max-age is very low (< 31536000 = 1 year)
        const maxAgeMatch = headerValue.match(/max-age\s*=\s*(\d+)/i);
        if (maxAgeMatch) {
          const maxAge = parseInt(maxAgeMatch[1], 10);
          if (maxAge < 31536000) {
            const lc = lineAndColumn(file.content, hit.index ?? 0);
            out.push({
              id: findingFingerprint(["CONFIG_HSTS_WEAK", file.path, lc.line]),
              ruleId: "CONFIG_HSTS_WEAK",
              title: "HSTS max-age demasiado bajo",
              severity: "low",
              owaspId: "A04",
              file: file.path,
              line: lc.line,
              column: lc.column,
              description:
                "Strict-Transport-Security con max-age bajo pierde efectividad. Se recomienda ≥ 1 año (31536000 segundos).",
              fixRecommendation:
                "Aumenta max-age a al menos 31536000 (1 año) e incluye `includeSubDomains; preload`.",
              safeExample: "Strict-Transport-Security: max-age=31536000; includeSubDomains; preload",
            });
          }
        }
      }
      
      if (!hasHsts && /app\.|express\.|fastify\.|django\.|flask|http\.|Server|middleware/i.test(file.content)) {
        const serverMatch = file.content.match(/(?:app\.|express\.|fastify\.|http\.server|Server|middleware)/);
        if (serverMatch && file.path.includes("src")) {
          const lc = lineAndColumn(file.content, serverMatch.index ?? 0);
          out.push({
            id: findingFingerprint(["CONFIG_HSTS_MISSING", file.path]),
            ruleId: "CONFIG_HSTS_MISSING",
            title: "Header HSTS no configurado (Strict-Transport-Security)",
            severity: "low",
            owaspId: "A04",
            file: file.path,
            line: lc.line,
            column: lc.column,
            description:
              "Sin HSTS, navegadores pueden ser forzados a usar HTTP tras SSL strip attacks.",
            fixRecommendation:
              "Configura Strict-Transport-Security con max-age≥1 año. Opta por preload list de Google.",
            safeExample: "res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')",
          });
        }
      }
    }

    // HttpOnly and Secure Cookie flags
    if (/\.(ts|tsx|js|jsx)$/i.test(p)) {
      const cookieInsecureRegex = /(?:httpOnly|secure)\s*:\s*false\b/gi;
      for (const hit of file.content.matchAll(cookieInsecureRegex)) {
        const lc = lineAndColumn(file.content, hit.index ?? 0);
        const flag = hit[0];
        out.push({
          id: findingFingerprint(["CONFIG_COOKIE_INSECURE", file.path, lc.line, flag]),
          ruleId: "CONFIG_COOKIE_INSECURE",
          title: `Cookie con ${flag === "httpOnly: false" ? "httpOnly" : "secure"} deshabilitado`,
          severity: "medium",
          owaspId: "A04",
          file: file.path,
          line: lc.line,
          column: lc.column,
          description:
            `Deshabilitar ${flag === "httpOnly: false" ? "httpOnly" : "secure"} en cookies de sesión permite robo vía JavaScript o MITM.`,
          fixRecommendation:
            "Habilita ambas flags para cookies de autenticación: `httpOnly: true, secure: true, sameSite: 'Strict'`",
          safeExample: "res.cookie('session', token, { httpOnly: true, secure: true, sameSite: 'Strict' })",
        });
      }
    }

    // Rate limiting not configured
    if (/\.(ts|tsx|js|jsx)$/i.test(p)) {
      const hasRateLimit = /rateLimit|rate-limit|limiter|throttle|express-rate-limit|slowDown/i.test(file.content);
      if (!hasRateLimit && /app\.post|app\.get|router\.|@Post|@Get|@Route|def.*request/i.test(file.content)) {
        const match = file.content.match(/(?:app\.post|app\.get|router\.|@Post|@Get|@Route|def.*request)/);
        if (match) {
          const lc = lineAndColumn(file.content, match.index ?? 0);
          out.push({
            id: findingFingerprint(["CONFIG_RATE_LIMIT_MISSING", file.path]),
            ruleId: "CONFIG_RATE_LIMIT_MISSING",
            title: "Rate limiting no configurado en endpoints",
            severity: "low",
            owaspId: "A04",
            file: file.path,
            line: lc.line,
            column: lc.column,
            description:
              "Sin rate limiting, brute force, DDoS y ataques de fuerza bruta son fáciles.",
            fixRecommendation:
              "Implementa rate limiting por IP/usuario: npm install express-rate-limit. Configura limits en endpoints críticos.",
            safeExample: "const rateLimit = require('express-rate-limit');\nconst limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 100 });\napp.post('/api/login', limiter, handler)",
          });
        }
      }
    }
  }

  return out;
}
