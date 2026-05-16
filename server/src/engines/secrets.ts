import type { Finding } from "../schemas/findings.js";
import type { FileSnapshot } from "../ingest/types.js";
import { lineAndColumn } from "../util/positions.js";
import { findingFingerprint } from "./id.js";

type Rule = {
  ruleId: string;
  title: string;
  severity: Finding["severity"];
  owaspId: Finding["owaspId"];
  description: (match: RegExpMatchArray) => string;
  fixRecommendation: string;
  regex: RegExp;
};

const RULES: Rule[] = [
  {
    ruleId: "SECRET_AWS_KEY",
    title: "Posible clave de acceso de AWS en el código",
    severity: "high",
    owaspId: "A04",
    regex: /\b(AKIA)[0-9A-Z]{16}\b/g,
    description: () =>
      "Se detectó texto con el formato típico de una clave de acceso de AWS (Access Key ID).",
    fixRecommendation:
      "Rota la credencial si es real y muévela a un gestor de secretos (no al código fuente ni al repo). Usa roles y variables de entorno en el servidor, no valores fijos públicos.",
  },
  {
    ruleId: "SECRET_OPENAI_SK",
    title: "Token de tipo OpenAI/Sk detectado",
    severity: "high",
    owaspId: "A04",
    regex: /\b(sk-(?:proj|liv|svcacct|-ant)-[a-zA-Z0-9_-]{20,})\b/g,
    description: () =>
      "Hay un texto que parece un token secreto utilizado por servicios tipo OpenAI/API similares.",
    fixRecommendation:
      "Elimina ese valor del código, revoca el token y crea uno nuevo configurado sólo como variable de entorno en el servidor o en CI seguro.",
  },
  {
    ruleId: "SECRET_GENERIC_API",
    title: "Cadena muy parecida a API key/token",
    severity: "medium",
    owaspId: "A04",
    regex:
      /\b(gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|glpat-[A-Za-z0-9\-]{15,})\b/i,
    description: () =>
      "Hay un formato típico de token de desarrollador (GitHub/GitLab/PAT). Podría ser un falso positivo, pero debe revisarse.",
    fixRecommendation:
      "Revoca tokens expuestos, usa secretos sólo donde el servidor los lea en tiempo de ejecución y restringe permisos.",
  },
  {
    ruleId: "SECRET_RSA_BLOCK",
    title: "Material criptográfico privado pegado",
    severity: "high",
    owaspId: "A04",
    regex: /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
    description: () =>
      "Se encontró una cabecera típica de clave privada (LLave PEM). Nadie debe verla fuera del dispositivo o HSM destinado.",
    fixRecommendation:
      "Genera claves nuevas, invalida estas y almacénalas en un cofre/KMS fuera del código y del frontend.",
  },
];

function basename(p: string): string {
  const n = p.replace(/\\/g, "/");
  return n.includes("/") ? n.slice(n.lastIndexOf("/") + 1) : n;
}

export function runSecretsEngine(files: FileSnapshot[]): Finding[] {
  const out: Finding[] = [];

  for (const file of files) {
    const base = basename(file.path);

    const looksLikeSecretsFile =
      /\.(pem|p12|pfx|key)$/i.test(base) || /^\.?env/i.test(base);

    if (looksLikeSecretsFile) {
      out.push({
        id: findingFingerprint(["SECRET_SENSITIVE_FILENAME", file.path]),
        ruleId: "SECRET_SENSITIVE_FILENAME",
        title: "Archivo muy sensible en el proyecto",
        severity: "medium",
        owaspId: "A02",
        file: file.path,
        description:
          "El proyecto incluye un archivo con nombre de certificado/clave/.env visible para el escáner.",
        fixRecommendation:
          "No incluyas claves ni certificados en el código compartido. Usa secreto remotos y .gitignore; sube placeholders documentados (.env.example sin valores secretos).",
      });
    }

    for (const rule of RULES) {
      rule.regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      const re = rule.regex.global ? rule.regex : new RegExp(rule.regex.source, "g");

      while ((m = re.exec(file.content))) {
        const idx = m.index;
        const { line, column } = lineAndColumn(file.content, idx);
        const fp = findingFingerprint([
          rule.ruleId,
          file.path,
          line,
          column,
          m[0]?.slice(0, 32),
        ]);
        out.push({
          id: fp,
          ruleId: rule.ruleId,
          title: rule.title,
          severity: rule.severity,
          owaspId: rule.owaspId,
          file: file.path,
          line,
          column,
          description: rule.description(m),
          fixRecommendation: rule.fixRecommendation,
        });
      }
    }
  }

  return out;
}
