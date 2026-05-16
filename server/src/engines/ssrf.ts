import type { Finding } from "../schemas/findings.js";
import type { FileSnapshot } from "../ingest/types.js";
import { lineAndColumn } from "../util/positions.js";
import { findingFingerprint } from "./id.js";

type SSRFRule = {
  ruleId: string;
  title: string;
  severity: Finding["severity"];
  owaspId: Finding["owaspId"];
  description: (match: RegExpMatchArray) => string;
  fixRecommendation: string;
  regex: RegExp;
  langs?: RegExp;
};

const RULES: SSRFRule[] = [
  // User-controlled URL without validation
  {
    ruleId: "SSRF_UNVALIDATED_URL",
    title: "URL controlada por usuario sin validación",
    severity: "high",
    owaspId: "A10",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:fetch|http\.|request|urllib|requests\.get|axios|curl)\s*\(\s*(?:req\.(?:body|query|params)\.(?:url|link|uri|endpoint|address)|userUrl|userInput\.url|inputUrl)/gi,
    description: () =>
      "Se realiza petición HTTP a URL controlada por el usuario sin validación previa.",
    fixRecommendation:
      "Valida URL: protocolo (https only), dominio en whitelist. Rechaza IPs privadas (127.0.0.1, 192.168.*, 10.*, 172.16-31.*).",
  },

  // No URL protocol validation
  {
    ruleId: "SSRF_NO_PROTOCOL_VALIDATION",
    title: "Sin validación del protocolo de URL (podría ser file://)",
    severity: "high",
    owaspId: "A10",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:fetch|request|http\.get|urllib\.urlopen|requests\.get|curl)\s*\([\s\S]{0,100}(?:url|URL|uri|endpoint)[\s\S]{0,50}(?=\)|;|\n)(?![\s\S]{0,150}(?:https|protocol|scheme|file|ftp|gopher|startsWith|includes|match|valid))/gi,
    description: () =>
      "Petición HTTP sin validar que protocolo es HTTP/HTTPS. Podría permitir file://, gopher://, etc.",
    fixRecommendation:
      "Valida: `if (!url.startsWith('https://')) throw Error()`. Whitelist protocolos permitidos.",
  },

  // Localhost/Private IP access
  {
    ruleId: "SSRF_LOCALHOST_ACCESS",
    title: "Intento de acceso a localhost o IPs privadas",
    severity: "high",
    owaspId: "A10",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:http|localhost|127\.0\.0\.1|0\.0\.0\.0|192\.168\.|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(?:1[6-9]|2[0-9]|3[0-1]))/gi,
    description: () =>
      "URL hardcodeada referenciando localhost o rango privado. Posible SSRF interno.",
    fixRecommendation:
      "Si necesitas conectar a servicios internos, usa variables de entorno y valida. Nunca hardcodees.",
  },

  // AWS Metadata endpoint vulnerable
  {
    ruleId: "SSRF_AWS_METADATA",
    title: "Posible acceso a AWS metadata endpoint (169.254.169.254)",
    severity: "high",
    owaspId: "A10",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /169\.254\.169\.254|metadata\.google\.internal|instance\.metadata|GCP.*metadata/gi,
    description: () =>
      "URL referenciando metadata endpoint. Si SSRF existe, expone credenciales AWS/GCP/Azure.",
    fixRecommendation:
      "Nunca hagas requests a metadata endpoints. Si necesitas credenciales, usa IAM roles/managed identities.",
  },

  // DNS Rebinding vulnerability
  {
    ruleId: "SSRF_DNS_REBINDING",
    title: "Posible DNS Rebinding (validación de DNS débil)",
    severity: "high",
    owaspId: "A10",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /dns\.resolve|getaddrinfo|gethostbyname(?![\s\S]{0,200}(?:whitelist|blacklist|private|check\.private|isPrivate|validHost))/gi,
    description: () =>
      "Resolución DNS sin re-validar que IP es pública. DNS rebinding puede atacar.",
    fixRecommendation:
      "Resuelve DNS + valida IP es pública. Re-valida al conectar. Usa IP whitelist, no DNS.",
  },

  // Open redirect combined with SSRF
  {
    ruleId: "SSRF_OPEN_REDIRECT_SSRF",
    title: "Posible combo de SSRF con open redirect",
    severity: "high",
    owaspId: "A10",
    langs: /\.(ts|tsx|js)$/i,
    regex: /(?:redirect|location|window\.location)\s*[=:]\s*[\s\S]{0,50}(?:req\.body\.url|req\.query\.redirect|req\.params\.url|userInput)(?![\s\S]{0,100}(?:validate|whitelist|startsWith|includes|check))/gi,
    description: () =>
      "Redirect a URL del usuario. Si backend sigue redirect, SSRF es posible.",
    fixRecommendation:
      "Whitelist URLs de redirect. Nunca redirige a URL arbitrary del usuario.",
  },

  // Webhook/Callback without validation
  {
    ruleId: "SSRF_WEBHOOK_NO_VALIDATION",
    title: "Webhook/callback URL sin validación",
    severity: "high",
    owaspId: "A10",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:webhook|callback|notifyUrl|hookUrl)\s*[=:]\s*(?:req\.body|userInput|params)[\s\S]{0,100}(?:fetch|request|http\.)(?![\s\S]{0,200}(?:validate|isValidUrl|checkHost|whitelist))/gi,
    description: () =>
      "URL de webhook/callback tomada de usuario y usada para hacer petición sin validar.",
    fixRecommendation:
      "Valida URL de webhook: protocolo HTTPS, dominio en whitelist, no IPs privadas.",
  },

  // URL parsing bypass
  {
    ruleId: "SSRF_URL_PARSING_BYPASS",
    title: "Posible bypass de validación URL (parsing inconsistente)",
    severity: "medium",
    owaspId: "A10",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:new\s+URL|urlparse|urllib\.parse)\s*\([\s\S]{0,100}(?:hostname|host|netloc)[\s\S]{0,50}(?![\s\S]{0,100}(?:2x|double.*decode|normalize|unicode|idn|punycode))/gi,
    description: () =>
      "Validación URL podría ser bypasseada por parsing inconsistente o encoding tricks.",
    fixRecommendation:
      "Usa librerías modernas que normalizan. Valida después de parsear. Test con: `127.0.0.1`, `127.1`, `0x7f.1`, `[::1]`.",
  },

  // Port scanning via SSRF
  {
    ruleId: "SSRF_PORT_SCANNING",
    title: "Posible SSRF usado para port scanning",
    severity: "medium",
    owaspId: "A10",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:for\s+|loop|while)[\s\S]{0,50}(?:port|PORT|3306|5432|6379|27017|8080|8443)[\s\S]{0,100}(?:fetch|request|http\.|socket)/gi,
    description: () =>
      "Patrón sugerente de scanning iterativo de puertos.",
    fixRecommendation:
      "Limita destinos: IP whitelist, puerto whitelist. Implementa timeout y rate limiting.",
  },

  // Time-based SSRF detection (timeout analysis)
  {
    ruleId: "SSRF_TIMING_ATTACK_POSSIBLE",
    title: "Posible timing analysis via SSRF",
    severity: "medium",
    owaspId: "A10",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:timeout|connectTimeout|readTimeout)\s*[=:]\s*(?!\d{4,}|[\s\S]{0,30}(?:very|large|big|long|high))[\d]{1,3}(?![\d])/gi,
    description: () =>
      "Timeout muy bajo en conexiones. Podría permitir timing analysis para detectar servicios.",
    fixRecommendation:
      "Usa timeout consistente (3-5s). No exponga información de timeout en respuesta.",
  },

  // No SSL/TLS verification (MITM)
  {
    ruleId: "SSRF_NO_TLS_VERIFICATION",
    title: "Sin verificación SSL/TLS en petición SSRF",
    severity: "high",
    owaspId: "A10",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:rejectUnauthorized|verify|insecure|allowInsecure)\s*[=:]\s*(?:false|0|no|disable)[\s\S]{0,50}(?:fetch|request|http\.|https\.|axios|requests)/gi,
    description: () =>
      "Petición HTTP sin verificar certificado SSL. MITM puede interceptar.",
    fixRecommendation:
      "Siempre verifica certificados SSL. Solo en test environment: opcionalmente desactiva con warning.",
  },
];

export function runSSRFEngine(files: FileSnapshot[]): Finding[] {
  const out: Finding[] = [];

  for (const file of files) {
    for (const rule of RULES) {
      if (rule.langs && !rule.langs.test(file.path.replace(/\\/g, "/"))) continue;

      const re = new RegExp(rule.regex.source, rule.regex.flags.includes("g") ? rule.regex.flags : `${rule.regex.flags}g`);

      let m: RegExpExecArray | null;
      while ((m = re.exec(file.content))) {
        const idx = m.index;
        const { line, column } = lineAndColumn(file.content, idx);
        const snippet = file.content.slice(idx, idx + 100).replace(/\s+/g, " ").slice(0, 100);

        // Skip potential false positives
        if (rule.ruleId === "SSRF_LOCALHOST_ACCESS" && /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(snippet)) {
          // Only flag if looks like dynamic request, not hardcoded test
          if (!/test|mock|stub|example|localhost:3000|localhost:5000/.test(snippet.toLowerCase())) {
            continue;
          }
        }

        out.push({
          id: findingFingerprint([rule.ruleId, file.path, line, column, snippet]),
          ruleId: rule.ruleId,
          title: rule.title,
          severity: rule.severity,
          owaspId: rule.owaspId,
          file: file.path,
          line,
          column,
          description: `${rule.description(m)} Contexto: "${snippet}".`,
          fixRecommendation: rule.fixRecommendation,
        });
      }
    }
  }

  return out;
}
