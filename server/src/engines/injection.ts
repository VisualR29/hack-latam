import type { Finding } from "../schemas/findings.js";
import type { FileSnapshot } from "../ingest/types.js";
import { lineAndColumn } from "../util/positions.js";
import { findingFingerprint } from "./id.js";

type InjectionRule = {
  ruleId: string;
  title: string;
  severity: Finding["severity"];
  owaspId: Finding["owaspId"];
  description: (match: RegExpMatchArray) => string;
  fixRecommendation: string;
  regex: RegExp;
  langs?: RegExp;
};

const RULES: InjectionRule[] = [
  // LDAP Injection
  {
    ruleId: "INJECTION_LDAP",
    title: "Posible LDAP Injection en filtro dinámico",
    severity: "high",
    owaspId: "A03",
    langs: /\.(js|ts|py|php|java)$/i,
    regex: /(?:ldap_search|ldap_bind|searchSync|search\s*\()\s*\([^)]{0,100}(?:\$\{|\+|template|f"|\.format|%s|\.replace)/gi,
    description: () =>
      "Se detectó construcción de filtro LDAP que parece combinar variables del usuario directamente en el filtro.",
    fixRecommendation:
      "Usa escapado de caracteres LDAP según RFC 4515: escapa *, (, ), \\, y NULL. Mejor aún: usa librerías que parametricen.",
  },

  // XPath Injection
  {
    ruleId: "INJECTION_XPATH",
    title: "Posible XPath Injection",
    severity: "high",
    owaspId: "A03",
    langs: /\.(js|ts|py|java|php|xml)$/i,
    regex: /(?:xpath|selectNodes|selectSingleNode|evaluate)\s*\(\s*['""`][\s\S]{0,80}(?:\$|template|format|\+|{)/gi,
    description: () =>
      "Se encontró construcción de expresión XPath que posiblemente interpola datos del usuario.",
    fixRecommendation:
      "Usa variables XPath en lugar de concatenación. Ejemplo: //user[username=$username] con bind variable $username.",
  },

  // Command Injection (Shell)
  {
    ruleId: "INJECTION_COMMAND_SHELL",
    title: "Posible Command Injection via shell (backticks, shell_exec, system)",
    severity: "high",
    owaspId: "A03",
    langs: /\.(php|py|sh|bash|pl)$/i,
    regex: /`[\s\S]{0,80}(?:\$\{|\$|%s)|(?:shell_exec|system|passthru|exec|popen)\s*\(\s*['""`][\s\S]{0,50}(?:\$\{|\$|%s|f"|format|interpolate)/gi,
    description: () =>
      "Ejecución de comando shell con interpolación de variables. Un carácter especial puede cambiar el comportamiento.",
    fixRecommendation:
      "Usa array de argumentos (spawn/subprocess) sin shell=true. Escapa muy estrictamente si shell es necesario.",
  },

  // Template Injection (SSTI)
  {
    ruleId: "INJECTION_TEMPLATE_SSTI",
    title: "Posible Server-Side Template Injection (SSTI)",
    severity: "high",
    owaspId: "A03",
    langs: /\.(js|ts|py|php|erb|jinja)$/i,
    regex: /(?:render|template|compile|eval)\s*\(\s*['""`][\s\S]{0,60}\$\{|render\s*\([\s\S]{0,100}req\.body|render\s*\([\s\S]{0,100}userInput/gi,
    description: () =>
      "Se encontró renderización de template con datos que aparecen provenir de usuario/request.",
    fixRecommendation:
      "Usa template sandbox o motor que desactive funciones peligrosas (exec, shell, etc). Valida y escapa entrada.",
  },

  // XXE / XML External Entity
  {
    ruleId: "INJECTION_XXE",
    title: "Posible XXE (XML External Entity) Attack",
    severity: "medium",
    owaspId: "A03",
    langs: /\.(java|py|php|csharp|js|xml)$/i,
    regex: /(?:parseXml|XMLParser|xml\.loads|parseString|DOMParser|XmlDocument|parse\s*\(\s*data)\s*\([\s\S]{0,100}(?:!DOCTYPE|ENTITY|SYSTEM|Resolver|DTD)/gi,
    description: () =>
      "Parseo de XML sin desactivar DTD/ENTITY declarations permite XXE attacks (file read, SSRF).",
    fixRecommendation:
      "Desactiva DOCTYPE, ENTITY, y resolvers externos en parser XML. Usa defusedxml (Python), XXEless (PHP), etc.",
  },

  // NoSQL Injection
  {
    ruleId: "INJECTION_NOSQL",
    title: "Posible NoSQL Injection ($where, $function, $regex)",
    severity: "high",
    owaspId: "A03",
    langs: /\.(js|ts)$/i,
    regex: /\{\s*\$where\s*:|db\.[\w]+\s*\(\s*\{[\s\S]{0,150}\$where|\{\s*\$function\s*:|db\.[\w]+\.find\s*\(\s*\{[\s\S]{0,100}(?:req\.|userInput|params)/gi,
    description: () =>
      "Se detectó $where o $function en query MongoDB, que ejecuta JavaScript arbitrario.",
    fixRecommendation:
      "Reemplaza $where por operadores estándar. Si necesitas lógica compleja, crea functions nombradas, no dinámicas.",
  },

  // GraphQL Injection
  {
    ruleId: "INJECTION_GRAPHQL",
    title: "Posible GraphQL Injection o falta de validación",
    severity: "medium",
    owaspId: "A03",
    langs: /\.(ts|js)$/i,
    regex: /graphql\s*\(\s*`[\s\S]{0,150}\$\{|buildSchema\s*\([\s\S]{0,150}query|apollo.*typeDefs.*user|\.schema\s*=\s*`[\s\S]{0,200}\$\{/gi,
    description: () =>
      "Se encontró construcción de query/schema GraphQL que parece interpolar datos del usuario.",
    fixRecommendation:
      "Valida profundidad de query, complejidad y aliases. Usa GraphQL validators y limiters.",
  },

  // SQL Injection (additional patterns)
  {
    ruleId: "INJECTION_SQL_DYNAMIC",
    title: "Construcción SQL dinámica sin parámetros",
    severity: "high",
    owaspId: "A03",
    langs: /\.(js|ts|py|php|java)$/i,
    regex: /(?:SELECT|INSERT|UPDATE|DELETE|WHERE|FROM)\s+[\s\S]{0,80}(?:\$\{(?:req|request|params|body|query|event|props|user|input|data|args)[\w.]*\}|(?:\+|concat)\s*(?:req|request|params|body|query|event|props|user|input|data)|(?:f"|%s|\.format))/gi,
    description: () =>
      "Construcción de SQL que combina texto con variables. Un apóstrofe permite escapar y ejecutar SQL adicional.",
    fixRecommendation:
      "Usa prepared statements o parametrized queries SIEMPRE. Nunca concatenes valores en SQL.",
  },

  // Regex DoS (ReDoS)
  {
    ruleId: "INJECTION_REGEX_DOS",
    title: "Posible Regular Expression Denial of Service (ReDoS)",
    severity: "medium",
    owaspId: "A03",
    langs: /\.(js|ts|py|java)$/i,
    regex: /new\s+RegExp\s*\(\s*['""`][\s\S]{0,200}\(\[\^]|\.match\s*\(\s*['""`][\s\S]{0,200}\(\[\^]|re\.match\s*\(\s*['""`][\s\S]{0,200}\(\[\^]/gi,
    description: () =>
      "Regex con captura de negación y backtracking puede causar DoS si entrada es larga.",
    fixRecommendation:
      "Evita regex complejas con backtracking. Usa validators simples o librerías like validator.js.",
  },

  // Path Traversal
  {
    ruleId: "INJECTION_PATH_TRAVERSAL",
    title: "Posible Path Traversal (acceso a archivos fuera del directorio esperado)",
    severity: "medium",
    owaspId: "A03",
    langs: /\.(js|ts|py|php)$/i,
    regex: /(?:readFile|readFileSync|open|load|require|import)\s*\(\s*['""`](?:\.\/)?[\s\S]{0,50}(?:\$\{|userPath|req\.params|req\.query)/gi,
    description: () =>
      "Se detectó lectura de archivo combinada con parámetro de usuario sin validación de ruta.",
    fixRecommendation:
      "Valida que ruta es dentro de directorio permitido. Usa path.resolve() + path.join() y verifica resultado.",
  },

  // Log Injection
  {
    ruleId: "INJECTION_LOG_INJECTION",
    title: "Posible Log Injection (newline injection en logs)",
    severity: "low",
    owaspId: "A03",
    langs: /\.(js|ts|py|java)$/i,
    regex: /(?:logger|console|log|info|error|warn|debug)\s*\(\s*['""`][\s\S]{0,100}(?:\$\{|userInput|req\.|message)/gi,
    description: () =>
      "Se loguea input del usuario sin sanitizar. Newlines pueden inyectar entries falsas en logs.",
    fixRecommendation:
      "Sanitiza entrada: reemplaza newlines/tabs por espacios. Mejor: log como JSON con campos estructurados.",
  },
];

export function runInjectionEngine(files: FileSnapshot[]): Finding[] {
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
