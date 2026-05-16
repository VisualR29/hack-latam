import type { Finding } from "../schemas/findings.js";
import type { FileSnapshot } from "../ingest/types.js";
import { lineAndColumn } from "../util/positions.js";
import { findingFingerprint } from "./id.js";

type AccessControlRule = {
  ruleId: string;
  title: string;
  severity: Finding["severity"];
  owaspId: Finding["owaspId"];
  description: (match: RegExpMatchArray) => string;
  fixRecommendation: string;
  regex: RegExp;
  langs?: RegExp;
};

const RULES: AccessControlRule[] = [
  // Missing authentication on routes
  {
    ruleId: "ACCESSCONTROL_ROUTE_NO_AUTH",
    title: "Ruta sin verificación de autenticación",
    severity: "high",
    owaspId: "A01",
    langs: /\.(ts|tsx|js)$/i,
    regex: /(?:app\.|router\.)\s*(?:get|post|put|delete|patch)\s*\(\s*['"`]\/(?:api|admin|dashboard|user|account|profile)[^'"`]*['"`]\s*,\s*(?:(?!auth|middleware|verify|JWT|guard|require|check|limiter|protect|session|ensureAuth|isAuth|login|rateLimit|throttle).){0,100}\s*\(.*\)\s*(?:=>|{)/gi,
    description: () =>
      "Se detectó ruta que podría ser sensitiva (contiene /api, /admin, /user, etc) sin middleware de autenticación explícito.",
    fixRecommendation:
      "Agrega middleware de autenticación: `router.get('/api/protected', verifyAuth, handler)`. Usa decoradores o guards en frameworks modernos.",
  },

  // Direct Object References (IDOR)
  {
    ruleId: "ACCESSCONTROL_IDOR",
    title: "Posible Insecure Direct Object Reference (IDOR)",
    severity: "high",
    owaspId: "A01",
    langs: /\.(ts|tsx|js)$/i,
    regex: /(?:findById|getById|get\s+.*ById|id\s*=|\.id\s*==|\.id\s*===)\s*\(\s*(?:req\.(?:params|query|body)\.id|id)\s*\)(?![\s\S]{0,100}(?:userId|ownerId|currentUser|req\.user|session\.user|auth|owner\s*===|verify))/gi,
    description: () =>
      "Se accede recurso por ID desde parametro de usuario sin verificar que pertenece al usuario actual.",
    fixRecommendation:
      "Verifica siempre que el recurso pertenece al usuario autenticado: `if (record.userId !== auth.user.id) throw Unauthorized()`.",
  },

  // Missing authorization (permission check)
  {
    ruleId: "ACCESSCONTROL_NO_AUTHORIZATION",
    title: "Falta verificación de autorización (permisos)",
    severity: "high",
    owaspId: "A01",
    langs: /\.(ts|tsx|js)$/i,
    regex: /(?:admin|DELETE|destroy|remove)\s*\(\s*(?:id|req\.params)\s*\)\s*(?:=>|{)[\s\S]{0,150}(?!(?:role|permission|admin|authorize|canAdmin|isAdmin|hasPermission|requireRole|guard))/gi,
    description: () =>
      "Operación administrativa/destructiva detectada sin verificar permisos del usuario.",
    fixRecommendation:
      "Agrega check de rol/permiso: `if (user.role !== 'admin') throw Forbidden()`. Usa middleware de autorización.",
  },

  // Public secrets or sensitive endpoints
  {
    ruleId: "ACCESSCONTROL_PUBLIC_SENSITIVE",
    title: "Endpoint sensitivo aparentemente sin restricción",
    severity: "medium",
    owaspId: "A01",
    langs: /\.(ts|tsx|js)$/i,
    regex: /(?:app\.|router\.)\s*(?:get|post)\s*\(\s*['"`]\s*(?:\/secret|\/private|\/admin|\/reset|\/passwd|\/download)[^'"`]*['"`]/gi,
    description: () =>
      "Ruta con nombre 'secret', 'private', 'admin' etc detectada sin middleware de protección aparente.",
    fixRecommendation:
      "Asegura que todas rutas sensitivas tengan middleware de auth/authz. Usa nombres de rutas neutros.",
  },

  // Privilege escalation patterns
  {
    ruleId: "ACCESSCONTROL_PRIV_ESCALATION",
    title: "Posible escalada de privilegios (cambio de rol sin verificación)",
    severity: "high",
    owaspId: "A01",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:user\.role|user\.permissions|req\.user\.role)\s*=\s*(?:req\.body\.role|params\.role|req\.query\.role|input\.role)(?![\s\S]{0,80}(?:verify|auth|admin|permission|validate|allow))/gi,
    description: () =>
      "Rol de usuario asignado directamente desde parametro de cliente sin validación.",
    fixRecommendation:
      "Nunca permitas cambio de rol desde cliente. Solo admins pueden asignar roles. Valida siempre en servidor.",
  },

  // Function-level authorization bypass
  {
    ruleId: "ACCESSCONTROL_FUNCTION_BYPASS",
    title: "Función sensible sin verificación de autorización",
    severity: "high",
    owaspId: "A01",
    langs: /\.(ts|tsx|js|py)$/i,
    regex: /(?:export\s+)?(?:async\s+)?function\s+(?:delete|remove|admin|transfer|refund|payment|override)[\w\d_]*\s*\([^)]*\)\s*(?:{|=>)(?![\s\S]{0,200}(?:check|verify|auth|permission|role|admin|owner|allow|guard))/gi,
    description: () =>
      "Función con nombre que sugiere operación sensitiva sin protección aparente.",
    fixRecommendation:
      "Decora función o implementa check de permisos al inicio. Usa guards/middleware framework-específico.",
  },

  // Horizontal privilege escalation
  {
    ruleId: "ACCESSCONTROL_HORIZONTAL_ESCALATION",
    title: "Acceso a datos de otro usuario del mismo nivel",
    severity: "medium",
    owaspId: "A01",
    langs: /\.(ts|tsx|js)$/i,
    regex: /(?:User\.findByIdOrFail|getUser|findUser|getUserById)\s*\(\s*(?:req\.(?:params|query|body)\.(?:id|userId|user_id))(?![\s\S]{0,100}(?:owner|userId\s*===|currentUser|auth|session\.user|verify))/gi,
    description: () =>
      "Acceso a datos de usuario basado en parametro sin verificar que es el usuario actual.",
    fixRecommendation:
      "Restringe siempre a `userId === auth.user.id`. Nunca confíes en parametro de usuario.",
  },
];

export function runAccessControlEngine(files: FileSnapshot[]): Finding[] {
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

        // Post-match: para PUBLIC_SENSITIVE, verificar si hay middleware auth en la definición de ruta
        if (rule.ruleId === "ACCESSCONTROL_PUBLIC_SENSITIVE") {
          const routeContext = file.content.slice(idx, idx + 300);
          const authMiddlewarePattern = /(?:auth|verify|guard|require|protect|ensureAuth|isAuth|authenticate|limiter|session|JWT|passport)/i;
          if (authMiddlewarePattern.test(routeContext)) continue;
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
