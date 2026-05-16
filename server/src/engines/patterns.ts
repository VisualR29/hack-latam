import type { Finding } from "../schemas/findings.js";
import type { FileSnapshot } from "../ingest/types.js";
import { lineAndColumn } from "../util/positions.js";
import { findingFingerprint } from "./id.js";

type PatternRule = {
  ruleId: string;
  title: string;
  severity: Finding["severity"];
  owaspId: Finding["owaspId"];
  re: RegExp;
  langs?: RegExp;
  describe: () => string;
  fixRecommendation: string;
  safeExample?: string;
};

const RULES: PatternRule[] = [
  {
    ruleId: "PATTERN_EVAL_JS",
    title: "Uso peligroso de eval/exec dinámico (JavaScript/TS)",
    severity: "high",
    owaspId: "A05",
    langs: /\.(js|jsx|mjs|cjs|ts|tsx)$/i,
    re: /\beval\s*\(/g,
    describe: () => "`eval(...)` ejecuta texto como código. Es muy fácil abusar desde entradas no confiables.",
    fixRecommendation:
      "Evita interpretar texto del usuario como código. Usa funciones whitelist, parsers seguros u operaciones declarativas con permisos mínimos.",
    safeExample: "// En vez de ejecutar texto crudo,\nparseInputWithSchema(userText)\n\n// Ejemplo muy simplificado usando JSON válido sólo:",
  },
  {
    ruleId: "PATTERN_NEW_FUNCTION",
    title: "`new Function` (código compilado desde cadenas)",
    severity: "high",
    owaspId: "A05",
    langs: /\.(js|jsx|mjs|cjs|ts|tsx)$/i,
    re: /\bnew\s+Function\s*\(/g,
    describe: () =>
      "`new Function(...)` permite construir funciones desde cadenas, similar concepto de riesgos que eval en muchos proyectos.",
    fixRecommendation:
      "Reemplázalo por lógica comprobada en archivos/versionados o micro-compiladores con tests; nunca texto directo desde clientes externos.",
    safeExample: "function multiply(a: number, b: number){ return a * b }",
  },
  {
    ruleId: "PATTERN_CHILD_PROCESS_SHELL",
    title: "Orden externa mediante child_process/exec",
    severity: "medium",
    owaspId: "A05",
    langs: /\.(js|jsx|ts|tsx|mjs|cjs)$/i,
    re: /child_process[^\n]{0,60}\.(exec|execSync)\(/g,
    describe: () =>
      "Construir comandos del sistema combinando texto es un modo clásico de inyección (command injection).",
    fixRecommendation:
      "Usa `spawn`/argumentos tipo array (`['git','pull']`) sin shell, sanitiza muy estrictamente o delega APIs internas ya probadas.",
  },
  {
    ruleId: "PATTERN_HTML_INJECTION",
    title: "Posible XSS al manipular `innerHTML`/similar",
    severity: "medium",
    owaspId: "A05",
    langs: /\.(js|jsx|ts|tsx|html)$/i,
    re: /\.innerHTML\s*=\s*|dangerouslySetInnerHTML/g,
    describe: () =>
      "Insertar HTML sin sanear desde datos del usuario habitualmente permite robar sesiones o redirigir a sitios fraudulentos.",
    fixRecommendation:
      "Renderiza contenido usando escapadores del framework (`text`, `sanitize-html` muy restringido) o muestra sólo formato seguro conocido.",
    safeExample: "element.textContent = userControlledText",
  },
  {
    ruleId: "PATTERN_SQL_PRISMA_RAW_UNSAFE",
    title: "`$queryRawUnsafe` de Prisma (SQL crudo no parametrizado)",
    severity: "high",
    owaspId: "A05",
    langs: /\.(ts|tsx|js)$/i,
    re: /\$queryRawUnsafe\s*\(/g,
    describe: () =>
      "Permite lanzar texto SQL arbitrario. Si ese texto llega desde inputs del usuario puede dañarse toda la base.",
    fixRecommendation:
      "Usa `$queryRaw` con placeholders etiquetados o consultas ORM parametrizadas. Evita interpolar valores concatenados literalmente.",
  },
  {
    ruleId: "PATTERN_SQL_CONCAT_POSSIBLE",
    title: "SQL combinado dinámicamente con datos de entrada",
    severity: "medium",
    owaspId: "A05",
    langs: /\.(js|jsx|ts|tsx|py|sql)$/i,
    re: /\b(?:select|insert|update|delete)\b[\s\S]{0,120}\$\{\s*(?:req|request|params|body|payload|event|values|props)/i,
    describe: () =>
      "Construir instrucciones SQL mezclando texto con datos del usuario habitualmente permite inyección de SQL.",
    fixRecommendation:
      "Usa queries parametrizadas del driver (?,?, :name). Nunca interpola credenciales/IDs externos directamente en texto SQL.",
    safeExample: "db.query(\"SELECT id FROM users WHERE email = ?\", [email])",
  },
  {
    ruleId: "PATTERN_PYTHON_PICKLE",
    title: "Deserialización insegura con pickle",
    severity: "medium",
    owaspId: "A08",
    langs: /\.(py)$/i,
    re: /\bpickle\.loads?\s*\(|cPickle\.loads\s*\(/g,
    describe: () =>
      "Pickle ejecuta efectos durante deserialización. Un archivo falsificado permite ejecución de código en servidor.",
    fixRecommendation:
      "Cambia por JSON/MessagePack con esquema validado u otro formato puramente declarativo cuando sea posible.",
  },
  {
    ruleId: "PATTERN_PYTHON_YAML_UNSAFE",
    title: "`yaml.load` sin loader seguro (Python)",
    severity: "high",
    owaspId: "A08",
    langs: /\.py$/i,
    re: /\byaml\.load\s*\([^)]*\)/g,
    describe: () =>
      "`yaml.load` clásico puede ejecutar código. Se prefiere `safe_load`.",
    fixRecommendation:
      "Sustituir por `yaml.safe_load` o validadores explícitos del esquema de configuración esperado.",
    safeExample: "data = yaml.safe_load(stream)",
  },
  {
    ruleId: "PATTERN_COOKIE_HTTPONLY",
    title: "Cookie accesible por JavaScript (`httpOnly: false`)",
    severity: "low",
    owaspId: "A02",
    langs: /\.(js|ts|mjs|cjs)$/i,
    re: /\b(httpOnly\s*:\s*false)\b/g,
    describe: () =>
      "Una sesión marcada así puede ser robada mediante scripts cuando hay otro fallo XSS en la misma app.",
    fixRecommendation:
      "Activa httpOnly cuando la cookie lleve información de sesión/identidad sensible y revisa modelo de cookies mismo-site.",
    safeExample: "httpOnly: true",
  },
];

export function runPatternsEngine(files: FileSnapshot[]): Finding[] {
  const out: Finding[] = [];

  for (const file of files) {
    for (const rule of RULES) {
      if (rule.langs && !rule.langs.test(file.path.replace(/\\/g, "/"))) continue;

      const re = new RegExp(rule.re.source, rule.re.flags.includes("g") ? rule.re.flags : `${rule.re.flags}g`);

      let m: RegExpExecArray | null;
      while ((m = re.exec(file.content))) {
        const idx = m.index;
        const { line, column } = lineAndColumn(file.content, idx);
        const snippet = file.content.slice(idx, idx + 120).replace(/\s+/g, " ").slice(0, 120);

        out.push({
          id: findingFingerprint([rule.ruleId, file.path, line, column, snippet]),
          ruleId: rule.ruleId,
          title: rule.title,
          severity: rule.severity,
          owaspId: rule.owaspId,
          file: file.path,
          line,
          column,
          description: `${rule.describe()} Contexto cercano: “${snippet}”.`,
          fixRecommendation: rule.fixRecommendation,
          safeExample: rule.safeExample,
        });
      }
    }
  }

  return out;
}
