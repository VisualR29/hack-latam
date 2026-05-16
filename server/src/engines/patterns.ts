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
  // A08: Java Deserialization
  {
    ruleId: "PATTERN_JAVA_OBJECT_INPUT_STREAM",
    title: "Deserialización Java potencialmente insegura (ObjectInputStream)",
    severity: "high",
    owaspId: "A08",
    langs: /\.(java|kt)$/i,
    re: /new\s+ObjectInputStream|readObject\s*\(|ObjectInputStream[\s\S]{0,60}readObject/g,
    describe: () =>
      "ObjectInputStream puede ejecutar código arbitrario durante deserialización si el stream contiene datos maliciosos.",
    fixRecommendation:
      "Implementa ObjectInputFilter, valida tipos antes de deserializar o usa JSON/serialización segura alternativa.",
    safeExample: "// Usar JSON en lugar de serialización Java nativa",
  },
  // A08: .NET Deserialization
  {
    ruleId: "PATTERN_DOTNET_BINARY_FORMATTER",
    title: "BinaryFormatter o DataContractDeserializer (.NET)",
    severity: "high",
    owaspId: "A08",
    langs: /\.(cs|csproj)$/i,
    re: /BinaryFormatter|DataContractDeserializer|DeserializeObject|FromJson\(/gi,
    describe: () =>
      "BinaryFormatter fue deprecado por Microsoft debido a riesgos de RCE. DataContractDeserializer también es riesgoso.",
    fixRecommendation:
      "Cambia a JsonSerializerOptions (System.Text.Json) o validadores explícitos. Nunca deserialices datos no confiables.",
  },
  // A08: PHP Unserialize
  {
    ruleId: "PATTERN_PHP_UNSERIALIZE",
    title: "PHP unserialize() con datos no confiables",
    severity: "high",
    owaspId: "A08",
    langs: /\.(php)$/i,
    re: /unserialize\s*\(\s*\$(?:_GET|_POST|_REQUEST|_COOKIE|data|payload|input)/gi,
    describe: () =>
      "unserialize() puede ejecutar código si datos provienen de usuario. Objeto PHP deserializado puede llamar __wakeup/destruct.",
    fixRecommendation:
      "Usa json_decode() en lugar de unserialize(). Si necesitas PHP objects, usa allowed_classes parameter con whitelist.",
  },
  // A08: Ruby Marshal
  {
    ruleId: "PATTERN_RUBY_MARSHAL_LOAD",
    title: "Ruby Marshal.load con datos externo",
    severity: "high",
    owaspId: "A08",
    langs: /\.(rb|rails)$/i,
    re: /Marshal\.load|YAML\.load\s*\(\s*\$(?:params|request|data)/gi,
    describe: () =>
      "Marshal.load ejecuta código Ruby arbitrario durante deserialización. YAML.load es similar.",
    fixRecommendation:
      "Usa Marshal.safe_load o YAML.safe_load. Para untrusted data, usa JSON.",
  },
  // A03: LDAP Injection
  {
    ruleId: "PATTERN_LDAP_INJECTION",
    title: "Posible LDAP Injection (construcción dinámica de filtro)",
    severity: "medium",
    owaspId: "A03",
    langs: /\.(js|ts|py|php|java)$/i,
    re: /ldap_search|ldapjs|python-ldap|ldapclient[\s\S]{0,80}(?:\$|template|f"|\.format|%s|\.replace|\+|\{)/gi,
    describe: () =>
      "Construcción de filtros LDAP combinando texto del usuario permite inyección y bypass de autenticación.",
    fixRecommendation:
      "Usa librerías que parametricen filtros LDAP. Escapa caracteres especiales: *, (, ), \\, NUL según RFC 4515.",
    safeExample: "// Use ldapjs.escapeFilterString(input) o similar según librería",
  },
  // A03: XPath Injection
  {
    ruleId: "PATTERN_XPATH_INJECTION",
    title: "Posible XPath Injection",
    severity: "medium",
    owaspId: "A03",
    langs: /\.(js|ts|py|java|php)$/i,
    re: /xpath\s*\(|selectNodes|selectSingleNode|compile\s*\(\s*['""`][\s\S]{0,50}(?:\$|\{|\+|template|format)/gi,
    describe: () =>
      "Construcción de expresiones XPath con datos del usuario permite navegar árbol XML arbitrariamente.",
    fixRecommendation:
      "Usa métodos que parametricen XPath (variables de contexto). Valida entrada estrictamente.",
    safeExample: "// Usar XPath variables: //user[username=$username and password=$password]",
  },
  // A03: Command Injection (extended)
  {
    ruleId: "PATTERN_COMMAND_INJECTION_SHELL",
    title: "Posible command injection via shell (backticks, shell_exec)",
    severity: "high",
    owaspId: "A03",
    langs: /\.(php|py|sh|bash)$/i,
    re: /`[\s\S]{0,60}\$\{|shell_exec\s*\(|system\s*\(|passthru\s*\(|exec\s*\([\s\S]{0,60}(?:\$_|input|user|request)/gi,
    describe: () =>
      "Ejecución de comandos shell con interpolación directa de datos del usuario.",
    fixRecommendation:
      "Usa array de argumentos (spawn) sin shell. Si necesitas shell, escapa muy estrictamente.",
    safeExample: "// spawn('ls', ['-la', userDir]) NO: shell=true",
  },
  // A03: Template Injection
  {
    ruleId: "PATTERN_TEMPLATE_INJECTION",
    title: "Posible Server-Side Template Injection (SSTI)",
    severity: "medium",
    owaspId: "A03",
    langs: /\.(js|ts|py)$/i,
    re: /render\s*\(\s*['""`][\s\S]{0,50}\$\{|\beval\s*\(|template\s*\(\s*req\.|\.compile\s*\(\s*userInput/gi,
    describe: () =>
      "Renderizar templates con código del usuario sin sanear permite ejecución de servidor.",
    fixRecommendation:
      "Usa template sandboxes o engines que desactiven funciones peligrosas. Valida/escapa entrada.",
    safeExample: "// handlebars con context claro, no input directo en template string",
  },
  // A03: XML External Entity (XXE)
  {
    ruleId: "PATTERN_XXE_INJECTION",
    title: "XML Parsing potencialmente vulnerable a XXE",
    severity: "medium",
    owaspId: "A03",
    langs: /\.(java|py|php|csharp|js)$/i,
    re: /parseXml|XMLParser|xml\.loads|XmlDocument|XPathDocument|DOMDocument\(\)|parse\s*\(\s*xml[\s\S]{0,50}(?:!DOCTYPE|ENTITY|SYSTEM)/gi,
    describe: () =>
      "Parsear XML sin desactivar DTDs/ENTITY permite acceso a archivos internos y SSRF.",
    fixRecommendation:
      "Desactiva DOCTYPE/ENTITY/External DTDs en parser XML. Usa librerías seguras con defenseXXE=true.",
    safeExample: "// Python: defusedxml.parse() en lugar de xml.etree",
  },
  // A03: NoSQL Injection
  {
    ruleId: "PATTERN_NOSQL_INJECTION",
    title: "Posible NoSQL Injection (MongoDB $where o similar)",
    severity: "high",
    owaspId: "A03",
    langs: /\.(js|ts)$/i,
    re: /\$where\s*:|db\.[\w]+\s*\(\s*\{[\s\S]{0,100}\$where|\{\s*\$function\s*:/gi,
    describe: () =>
      "$where en MongoDB ejecuta código JavaScript arbitrario. Equivalente a SQL injection.",
    fixRecommendation:
      "Evita $where. Usa operadores de query estándar. Filtra/valida entrada antes de construir queries.",
    safeExample: "// db.collection.find({ username: username }) en lugar de $where",
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
