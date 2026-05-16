import type { Finding } from "../schemas/findings.js";
import type { FileSnapshot } from "../ingest/types.js";
import { lineAndColumn } from "../util/positions.js";
import { findingFingerprint } from "./id.js";

type LoggingRule = {
  ruleId: string;
  title: string;
  severity: Finding["severity"];
  owaspId: Finding["owaspId"];
  description: (match: RegExpMatchArray) => string;
  fixRecommendation: string;
  regex: RegExp;
  langs?: RegExp;
};

const RULES: LoggingRule[] = [
  // Missing critical event logging
  {
    ruleId: "LOGGING_MISSING_CRITICAL_EVENTS",
    title: "Evento crítico de autenticación sin logging",
    severity: "medium",
    owaspId: "A09",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:login|signin|authenticate|logout|password.*change|failed.*auth)\s*[\s\S]{0,200}(?=return|res\.|next|callback)(?![\s\S]{0,250}(?:log|logger|audit|record|event|track|monitor))/gi,
    description: () =>
      "Evento crítico (login, logout, cambio de contraseña) sin registro de log.",
    fixRecommendation:
      "Log evento: timestamp, usuario, IP, método auth, éxito/fallo, etc. Ejemplo: `logger.info('User login', {userId, ip, timestamp})`.",
  },

  // Missing error logging
  {
    ruleId: "LOGGING_MISSING_ERROR_HANDLER",
    title: "Try-catch sin logging del error",
    severity: "low",
    owaspId: "A09",
    langs: /\.(ts|tsx|js)$/i,
    regex: /catch\s*\(\s*(?:e|err|error)\s*\)\s*(?:{[\s\S]{0,100}(?:rethrow|throw|return|next\()|=>[\s\S]{0,50}(?:rethrow|throw|return|next\())(?![\s\S]{0,100}(?:log|logger|console\.error|emit|track))/gi,
    description: () =>
      "Excepción capturada sin registro de log. Dificulta debugging y auditoría.",
    fixRecommendation:
      "Log error antes de re-lanzar: `logger.error('Unexpected error', {error: e.message, stack: e.stack})`.",
  },

  // Console.log in production
  {
    ruleId: "LOGGING_CONSOLE_LOG_PRODUCTION",
    title: "console.log/warn/error usado en código (no persistent)",
    severity: "low",
    owaspId: "A09",
    langs: /\.(ts|tsx|js)$/i,
    regex: /console\.(log|warn|error|debug|info)\s*\(/gi,
    description: () =>
      "console.log no persiste en logs. En producción se pierde si no hay redirección de stderr.",
    fixRecommendation:
      "Usa logger con niveles: `logger.info()`, `logger.error()`, etc. Envía a centralized log system.",
  },

  // Logging without timestamp
  {
    ruleId: "LOGGING_NO_TIMESTAMP",
    title: "Log sin timestamp",
    severity: "low",
    owaspId: "A09",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:logger|log|audit)\.(?:info|error|warn|debug)\s*\(\s*['""`][\s\S]{0,80}[\s\S]{0,20}(?![\s\S]{0,100}(?:timestamp|date|now|datetime|createdAt|time))/gi,
    description: () =>
      "Entrada de log sin incluir timestamp. Dificulta correlación temporal.",
    fixRecommendation:
      "Agrega timestamp automáticamente: `logger.info({timestamp: new Date().toISOString(), ...})`.",
  },

  // Logging passwords/tokens/secrets
  {
    ruleId: "LOGGING_SENSITIVE_DATA",
    title: "Datos sensitivos loguados (passwords, tokens, secrets)",
    severity: "high",
    owaspId: "A09",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:logger|log|console|print|print_r|var_dump|dump|audit)\.(?:info|error|warn|debug)?\s*\(\s*[\s\S]{0,100}(?:password|passwd|pwd|secret|token|apikey|key|auth|credential|oauth|jwt|bearer)/gi,
    description: () =>
      "Contraseña, token o apikey loguada. Expondrá credenciales en logs persistentes.",
    fixRecommendation:
      "Nunca loguees secrets. Si necesitas loguear entrada: sanitiza, redacta, o loguea solo hash.",
  },

  // No structured logging
  {
    ruleId: "LOGGING_NOT_STRUCTURED",
    title: "Logs sin estructura (string formatting)",
    severity: "low",
    owaspId: "A09",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:logger|log)\.(?:info|error|warn|debug)\s*\(\s*['"`]\s*(?:[^'"`]*\$\{|\+|%s|format|\+\s*str)/gi,
    description: () =>
      "Logs con formato string en lugar de campos estructurados. Difícil parsear automáticamente.",
    fixRecommendation:
      "Usa JSON/structured logging: `logger.info({event: 'login', userId, ip, status: 'success'})`.",
  },

  // No correlation IDs
  {
    ruleId: "LOGGING_NO_CORRELATION_ID",
    title: "Logs sin correlation ID (request tracing)",
    severity: "low",
    owaspId: "A09",
    langs: /\.(ts|tsx|js)$/i,
    regex: /(?:app\.|router\.)\s*(?:use|get|post)\s*\([^)]*\)[\s\S]{0,300}logger[\s\S]{0,100}(?![\s\S]{0,200}(?:correlation|requestId|traceId|request\.id|x-request-id|trace))/gi,
    description: () =>
      "Logs sin trace/correlation ID. Imposible seguir request a través de sistema distribuido.",
    fixRecommendation:
      "Agrega middleware: `req.id = uuid()`. Loguea con `{requestId: req.id}` en cada log.",
  },

  // Logs stored insecurely
  {
    ruleId: "LOGGING_INSECURE_STORAGE",
    title: "Archivos .log públicos o sin rotación",
    severity: "medium",
    owaspId: "A09",
    langs: /\.(ts|tsx|js|py|conf|config|json|yml|yaml)$/i,
    regex: /(?:writeFileSync|open|fopen|file_put_contents)\s*\([^)]*\.log['"`]\s*(?![\s\S]{0,100}(?:\/var\/log|secure|permission|chmod|0600|private))|\bpath\s*[=:]\s*['"`][^'"`]*\.log[^'"`]*['"`]\s*(?![\s\S]{0,100}(?:secure|private|chmod))/gi,
    description: () =>
      "Archivos de log almacenados en locación pública o sin permisos restringidos.",
    fixRecommendation:
      "Almacena logs en `/var/log` con permisos 0600. Implementa rotación. Usa servicio de logging centralizado.",
  },

  // No monitoring/alerting
  {
    ruleId: "LOGGING_NO_ALERTS",
    title: "Sin alertas configuradas para eventos críticos",
    severity: "medium",
    owaspId: "A09",
    langs: /\.(ts|tsx|js|py|tf|yaml|yml|json)$/i,
    regex: /(?:auth|security|admin|payment|delete)\s*[\s\S]{0,200}logger[\s\S]{0,100}(?=\n|$)(?![\s\S]{0,300}(?:alert|monitor|notify|webhook|email|slack|pagerduty|alarm))/gi,
    description: () =>
      "Eventos críticos loguados pero sin alertas configuradas para notificación.",
    fixRecommendation:
      "Configura alertas: webhook, email, Slack, PagerDuty. Monitorea eventos críticos en tiempo real.",
  },

  // Log injection vulnerability
  {
    ruleId: "LOGGING_LOG_INJECTION",
    title: "Posible log injection (entrada sin sanitizar en log)",
    severity: "low",
    owaspId: "A09",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:logger|log|audit)\.(?:info|error|warn|debug)\s*\(\s*[\s\S]{0,100}(?:req\.|userInput|message|data|body|params)[\s\S]{0,100}(?![\s\S]{0,100}(?:sanitize|escape|replace|newline|clean|strip))/gi,
    description: () =>
      "Entrada del usuario loguada sin sanitizar newlines. Permite inyectar entries falsas.",
    fixRecommendation:
      "Sanitiza entrada: reemplaza `\\n`, `\\r` por espacios. Mejor: loguea como JSON con estructura.",
  },
];

export function runLoggingEngine(files: FileSnapshot[]): Finding[] {
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
