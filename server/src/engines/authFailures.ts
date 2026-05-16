import type { Finding } from "../schemas/findings.js";
import type { FileSnapshot } from "../ingest/types.js";
import { lineAndColumn } from "../util/positions.js";
import { findingFingerprint } from "./id.js";

type AuthFailureRule = {
  ruleId: string;
  title: string;
  severity: Finding["severity"];
  owaspId: Finding["owaspId"];
  description: (match: RegExpMatchArray) => string;
  fixRecommendation: string;
  regex: RegExp;
  langs?: RegExp;
};

const RULES: AuthFailureRule[] = [
  // Weak password policy
  {
    ruleId: "AUTHFAIL_WEAK_PASSWORD_POLICY",
    title: "Posible política de contraseña débil (sin validación de complejidad)",
    severity: "medium",
    owaspId: "A07",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:password\s*[=:]|validatePassword|checkPassword)\s*[\s\S]{0,100}(?:length\s*(?:<|<=)\s*(?:3|4|5|6|7|8)|![\w\-]*(?:uppercase|digit|special|symbol|[A-Z]|[0-9]|[!@#$%]))/gi,
    description: () =>
      "Se detectó validación de contraseña muy permisiva (< 8 caracteres o sin requisitos de complejidad).",
    fixRecommendation:
      "Requiere: mín 12 caracteres, mayúscula, minúscula, número, carácter especial. Usa zxcvbn o similar.",
  },

  // Missing MFA/2FA
  {
    ruleId: "AUTHFAIL_NO_MFA",
    title: "Falta autenticación multi-factor (MFA/2FA)",
    severity: "high",
    owaspId: "A07",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:authenticate|login|signin|verify)\s*[\s\S]{0,150}(?:password\s*===|password\s*==)[\s\S]{0,50}(?=return\s+success|next\(\)|callback\(|auth_token|session|JWT|return\s+true)(?![\s\S]{0,200}(?:mfa|2fa|totp|sms|email.*verify|second.?factor|google.?auth|authenticator))/gi,
    description: () =>
      "Autenticación solo por password, sin segundo factor de autenticación.",
    fixRecommendation:
      "Implementa MFA: TOTP (Google Authenticator), SMS, email verification, o security keys.",
  },

  // Session fixation
  {
    ruleId: "AUTHFAIL_SESSION_FIXATION",
    title: "Posible session fixation (no regenera ID post-login)",
    severity: "high",
    owaspId: "A07",
    langs: /\.(ts|tsx|js)$/i,
    regex: /(?:login|authenticate|signin)\s*[\s\S]{0,150}(?:session|Session|req\.session)\s*[=:]\s*[\s\S]{0,100}(?=return|next|redirect|callback)(?![\s\S]{0,150}(?:regenerate|regenerateId|newSession|fresh))/gi,
    description: () =>
      "ID de sesión no se regenera después de login. Permite session fixation attacks.",
    fixRecommendation:
      "Llama `req.session.regenerate()` post-login. Destruye sesión anterior antes de crear nueva.",
  },

  // Hardcoded credentials (already in secrets but flagging for auth)
  {
    ruleId: "AUTHFAIL_HARDCODED_CREDENTIALS",
    title: "Credenciales hardcodeadas para autenticación",
    severity: "high",
    owaspId: "A07",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:username|password|apikey|token)\s*[=:]\s*['"`](?![\${}])[a-zA-Z0-9\.\-_@!#$%]{8,}['"`][\s\S]{0,50}(?:authenticate|login|verify|check|compare)/gi,
    description: () =>
      "Credenciales hardcodeadas para verificación de autenticación.",
    fixRecommendation:
      "Usa variables de entorno. Mejor: usa OAuth, SAML, o gestión de identidad dedicada.",
  },

  // No password expiration
  {
    ruleId: "AUTHFAIL_NO_PASSWORD_EXPIRATION",
    title: "Contraseñas sin expiración",
    severity: "low",
    owaspId: "A07",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:password\.?expir|session\.?timeout|token\.?ttl)\s*(?![\s\S]{0,50}(?:expi|timeout|ttl|seconds|hours|days|date))[\s\S]{0,50}(?:never|null|false|undefined|0)/gi,
    description: () =>
      "Contraseñas no expiran o sesiones no tienen timeout.",
    fixRecommendation:
      "Configura expiración de password (ej: 90 días). Session timeout: 15-30 min inactividad.",
  },

  // JWT without expiration
  {
    ruleId: "AUTHFAIL_JWT_NO_EXPIRATION",
    title: "JWT sin tiempo de expiración",
    severity: "high",
    owaspId: "A07",
    langs: /\.(ts|tsx|js)$/i,
    regex: /(?:sign|JWT\.sign|jsonwebtoken\.sign)\s*\(\s*[\s\S]{0,350}(?![\w\s]*exp|[\w\s]*expiresIn|[\w\s]*expiresAt)/gi,
    description: () =>
      "JWT emitido sin campo 'exp' (expiration). Token válido indefinidamente.",
    fixRecommendation:
      "Agrega `expiresIn` al sign: `jwt.sign(payload, secret, { expiresIn: '1h' })`.",
  },

  // Weak token generation
  {
    ruleId: "AUTHFAIL_WEAK_TOKEN_GENERATION",
    title: "Generación de token/session ID débil",
    severity: "high",
    owaspId: "A07",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:token|sessionId|secret)\s*[=:]\s*(?:Math\.random\(\)|uuid\(\)|random\(\)|hash\(Date\.now)/gi,
    description: () =>
      "Token o session ID generado con método no criptográfico (Math.random, Date, etc).",
    fixRecommendation:
      "Usa `crypto.randomBytes()` (Node.js) o `secrets.token_hex()` (Python). Mínimo 32 bytes.",
  },

  // No CSRF protection
  {
    ruleId: "AUTHFAIL_NO_CSRF_PROTECTION",
    title: "Falta protección CSRF (Cross-Site Request Forgery)",
    severity: "medium",
    owaspId: "A07",
    langs: /\.(ts|tsx|js)$/i,
    regex: /(?:app\.|router\.)\s*(?:post|put|delete|patch)\s*\([^)]*\)[\s\S]{0,200}(?=handler|{)(?![\s\S]{0,300}(?:csrf|CSRF|csrfProtection|validateCSRFToken|token.*verify|req\.csrfToken))/gi,
    description: () =>
      "Endpoints de mutación (POST, PUT, DELETE) sin validación de CSRF token.",
    fixRecommendation:
      "Implementa middleware CSRF: `csurf()` (Express), verifica token en header o body.",
  },

  // Insecure password reset
  {
    ruleId: "AUTHFAIL_INSECURE_PASSWORD_RESET",
    title: "Proceso de reset de contraseña inseguro",
    severity: "high",
    owaspId: "A07",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:resetPassword|forgotPassword|reset)\s*[\s\S]{0,200}token\s*[=:]\s*(?![\s\S]{0,50}(?:crypto|randomBytes|secrets|uuid4|token_hex))(?:Math\.random|Date\.now|id|email\.split|substring|slice)/gi,
    description: () =>
      "Token de reset de contraseña generado de forma predecible o débil.",
    fixRecommendation:
      "Usa cryptographically secure tokens (32+ bytes). Expira en 1 hora. Hashea antes guardar.",
  },

  // Account enumeration via auth
  {
    ruleId: "AUTHFAIL_ACCOUNT_ENUMERATION",
    title: "Posible enumeración de cuentas via auth endpoint",
    severity: "low",
    owaspId: "A07",
    langs: /\.(ts|tsx|js)$/i,
    regex: /(?:login|authenticate)\s*[\s\S]{0,200}(?:email.*not\s+found|user.*not\s+found|no.*account|username.*exists|user.*exists)(?![\s\S]{0,100}generic)/gi,
    description: () =>
      "Mensaje de error diferencia entre usuario inexistente y contraseña incorrecta.",
    fixRecommendation:
      "Usa mensaje genérico: 'Email o contraseña incorrectos'. Mismo tiempo de respuesta (timing-attack).",
  },

  // Brute force not prevented
  {
    ruleId: "AUTHFAIL_NO_BRUTE_FORCE_PROTECTION",
    title: "Sin protección contra brute force en login",
    severity: "medium",
    owaspId: "A07",
    langs: /\.(ts|tsx|js)$/i,
    regex: /(?:login|authenticate|signin)\s*[\s\S]{0,250}(?=return|res\.|next)(?![\s\S]{0,300}(?:rateLimit|throttle|limits|attempts|lockout|delay|wait|backoff))/gi,
    description: () =>
      "Endpoint de login sin rate limiting o protección contra intentos múltiples.",
    fixRecommendation:
      "Implementa rate limiting: máx 5 intentos/10 min. Lockout temporal. Use CAPTCHA.",
  },
];

export function runAuthFailuresEngine(files: FileSnapshot[]): Finding[] {
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
