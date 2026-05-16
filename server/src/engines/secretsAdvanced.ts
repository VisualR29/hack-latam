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
  // Database Connection Strings
  {
    ruleId: "SECRET_DB_CONNECTION_STRING",
    title: "Posible cadena de conexión a base de datos expuesta",
    severity: "high",
    owaspId: "A02",
    regex: /(?:mongodb|mysql|postgresql|postgres|mariadb|redis|elasticsearch):\/\/[^\s"'`;]+/gi,
    description: () =>
      "Se detectó una cadena de conexión a base de datos con credenciales. Incluye usuario, contraseña y ubicación del servidor.",
    fixRecommendation:
      "Mueve la cadena de conexión a variables de entorno. Rota credenciales y restricciones de acceso en la base de datos. Usa .env o secretos del sistema.",
  },
  {
    ruleId: "SECRET_DB_HOST_PATTERN",
    title: "Patrón de conexión RDS/host de base de datos con credenciales",
    severity: "high",
    owaspId: "A02",
    regex: /(?:user|password|USER|PASSWORD)[\s]*[=:]\s*['""`]?[^'""`\s;]+['""`]?[\s]*(?:;|,|host|HOST|server|SERVER|db_host)/gi,
    description: () =>
      "Se encontró patrón típico de credenciales de base de datos (usuario/contraseña) cercanos a hosts o servidores.",
    fixRecommendation:
      "Extrae las credenciales a variables de entorno. Utiliza un gestor de secretos (AWS Secrets Manager, HashiCorp Vault, Azure Key Vault).",
  },

  // AWS Extended
  {
    ruleId: "SECRET_AWS_SECRET_ACCESS_KEY",
    title: "Posible clave de acceso secreto de AWS",
    severity: "high",
    owaspId: "A02",
    regex: /aws_secret_access_key\s*[=:]\s*(?:['"`])?(wJalrXUtnFEMI[^\s'""`]{15,})/gi,
    description: () =>
      "Se detectó patrón de AWS Secret Access Key. Esta es la parte privada del par de credenciales y nunca debe exponerse.",
    fixRecommendation:
      "Rota la credencial inmediatamente, invalída la clave antigua en AWS IAM y crea una nueva. Nunca guarde en código fuente.",
  },
  {
    ruleId: "SECRET_AWS_ACCOUNT_ID",
    title: "ID de cuenta AWS posiblemente expuesto",
    severity: "medium",
    owaspId: "A02",
    regex: /arn:aws:[a-z\-]+:\w*:\d{12}:/gi,
    description: () =>
      "Se encontró un ARN de AWS que contiene el ID de cuenta. Aunque parcialmente público, es información sensible.",
    fixRecommendation:
      "Evita hardcodificar ARNs en código fuente. Usa variables de entorno o referencias dinámicas a cuentas.",
  },

  // Stripe API Keys
  {
    ruleId: "SECRET_STRIPE_API_KEY",
    title: "Clave API de Stripe (sk_live o sk_test)",
    severity: "high",
    owaspId: "A02",
    regex: /\b(sk_(?:live|test)_[a-zA-Z0-9]{20,})\b/g,
    description: () =>
      "Se detectó una clave API de Stripe. Con sk_live se puede acceder y manipular pagos en producción.",
    fixRecommendation:
      "Revoca la clave en Stripe Dashboard. Utiliza sólo en servidor/backend usando variables de entorno.",
  },
  {
    ruleId: "SECRET_STRIPE_PUBLISHABLE_KEY",
    title: "Clave publicable de Stripe en contexto privado",
    severity: "low",
    owaspId: "A04",
    regex: /\b(pk_(?:live|test)_[a-zA-Z0-9]{20,})\b/g,
    description: () =>
      "Se detectó una clave publicable de Stripe. Si bien se espera que sea pública, revisar que no esté en .env privado sin propósito.",
    fixRecommendation:
      "Claves publicables pueden estar expuestas. No las protejas en .env privado; usa variables públicas del build si es necesario.",
  },

  // Twilio
  {
    ruleId: "SECRET_TWILIO_API_KEY",
    title: "API Key de Twilio (SID y Auth Token)",
    severity: "high",
    owaspId: "A02",
    regex: /AC[a-zA-Z0-9]{32}|auth[_-]?token[:\s=]*['"`]?[a-zA-Z0-9]{32}['"`]?/gi,
    description: () =>
      "Se detectó credenciales de Twilio. Permite enviar SMS/llamadas y manipular logs de comunicaciones.",
    fixRecommendation:
      "Rota el token en Twilio Console. Almacena SID y token sólo en variables de entorno del servidor.",
  },

  // SendGrid
  {
    ruleId: "SECRET_SENDGRID_API_KEY",
    title: "API Key de SendGrid detectada",
    severity: "high",
    owaspId: "A02",
    regex: /SG\.[a-zA-Z0-9_-]{20,}/g,
    description: () =>
      "Se encontró una clave API de SendGrid. Permite enviar correos y manipular listas de contactos.",
    fixRecommendation:
      "Revoca la clave y crea una nueva en SendGrid. Usa sólo en backend con variables de entorno.",
  },

  // Firebase
  {
    ruleId: "SECRET_FIREBASE_DATABASE_URL",
    title: "URL de base de datos Firebase expuesta",
    severity: "medium",
    owaspId: "A02",
    regex: /https:\/\/[a-z0-9\-]+\.firebaseio\.com/gi,
    description: () =>
      "Se detectó URL de Firebase Realtime Database. Aunque contiene nombre del proyecto, se debe proteger el acceso.",
    fixRecommendation:
      "Verifica reglas de Firebase Security Rules. Usa authenticated endpoints y variables de entorno para URLs.",
  },
  {
    ruleId: "SECRET_FIREBASE_CONFIG",
    title: "Configuración de Firebase (apiKey/projectId)",
    severity: "low",
    owaspId: "A04",
    regex: /apiKey[\s]*:\s*['"`]([a-zA-Z0-9_-]{30,})['"`]|projectId[\s]*:\s*['"`]([^\s'"`]+)['"`]/gi,
    description: () =>
      "Se detectó configuración de Firebase. Aunque parcialmente pública, revisar contexto de exposición.",
    fixRecommendation:
      "Firebase config puede estar parcialmente pública (client-side). Asegura que règles de Firestore/RTDB sean restrictivas.",
  },

  // Google Cloud
  {
    ruleId: "SECRET_GCP_API_KEY",
    title: "API Key de Google Cloud Platform",
    severity: "high",
    owaspId: "A02",
    regex: /AIza[0-9A-Za-z\-_]{35}/g,
    description: () =>
      "Se detectó una API key de GCP. Permite acceder a servicios de Google Cloud bajo esa clave.",
    fixRecommendation:
      "Rota la clave en Google Cloud Console. Limita permisos mediante IAM. Usa sólo en backend.",
  },
  {
    ruleId: "SECRET_GCP_SERVICE_ACCOUNT",
    title: "Posible archivo de credenciales de Google Cloud Service Account",
    severity: "high",
    owaspId: "A02",
    regex: /"type"\s*:\s*"service_account"[\s\S]{0,500}"private_key"/i,
    description: () =>
      "Se encontró referencia a un archivo service account de GCP que incluye private_key. No debe exponerse nunca.",
    fixRecommendation:
      "Invalida la cuenta service en GCP y crea una nueva. Mantén archivos .json de credenciales fuera del repo.",
  },

  // GitHub & GitLab Extended
  {
    ruleId: "SECRET_GITHUB_OAUTH_TOKEN",
    title: "Token OAuth de GitHub o token personal",
    severity: "high",
    owaspId: "A02",
    regex: /\b(ghp_[a-zA-Z0-9]{36}|gho_[a-zA-Z0-9]{36}|ghu_[a-zA-Z0-9]{36})\b/g,
    description: () =>
      "Se detectó token de GitHub. Permite acceso a repositorios, workflows y datos de cuenta.",
    fixRecommendation:
      "Revoca el token en GitHub Settings > Developer settings. Crea uno nuevo con permisos mínimos.",
  },
  {
    ruleId: "SECRET_GITLAB_TOKEN",
    title: "Token de GitLab (personal o CI/CD)",
    severity: "high",
    owaspId: "A02",
    regex: /\b(glpat-[a-zA-Z0-9\-]{15,}|glcr-[a-zA-Z0-9\-]{15,}|glpd-[a-zA-Z0-9\-]{15,})\b/g,
    description: () =>
      "Se encontró token de GitLab. Proporciona acceso a repositorios y pipelines CI/CD.",
    fixRecommendation:
      "Revoca el token en GitLab. Crea uno nuevo. No uses tokens con acceso `api` innecesariamente.",
  },

  // JWT & JSON Web Tokens
  {
    ruleId: "SECRET_JWT_HARDCODED",
    title: "JWT hardcodeado o token de sesión",
    severity: "medium",
    owaspId: "A02",
    regex: /[\w\-]+\.[\w\-]+\.[\w\-]{20,}(?=\s|$|["'`;,])/g,
    description: () =>
      "Se detectó patrón típico de JWT (token.payload.signature). Si es hardcodeado, no debe estar expuesto.",
    fixRecommendation:
      "Genera JWTs dinámicamente sin almacenarlos en código. Usa secreto bien guardado para firmado.",
  },

  // Microsoft / Azure
  {
    ruleId: "SECRET_AZURE_CONNECTION_STRING",
    title: "Connection string de Azure Storage o SQL",
    severity: "high",
    owaspId: "A02",
    regex: /DefaultEndpointsProtocol=https?;AccountName=[^;]+;AccountKey=[^\s;"'`]+/gi,
    description: () =>
      "Se detectó cadena de conexión a Azure. Contiene claves de acceso a recursos en la nube.",
    fixRecommendation:
      "Rota las claves en Azure Portal. Almacena en Azure Key Vault, no en código.",
  },
  {
    ruleId: "SECRET_AZURE_CLIENT_SECRET",
    title: "Client Secret de Azure AD/Entra",
    severity: "high",
    owaspId: "A02",
    regex: /[Cc]lient[_-]?[Ss]ecret[\s]*[=:]\s*['"`]?[a-zA-Z0-9\._~-]{20,}['"`]?/g,
    description: () =>
      "Se encontró Client Secret de Azure AD. Permite autenticar aplicaciones en Azure.",
    fixRecommendation:
      "Rota el secreto en Azure AD. Usa Azure Key Vault para almacenar.",
  },

  // Private Keys (Extended)
  {
    ruleId: "SECRET_RSA_PUBLIC_KEY",
    title: "Clave pública RSA detectada (menor riesgo pero revisar contexto)",
    severity: "low",
    owaspId: "A04",
    regex: /-----BEGIN PUBLIC KEY-----/,
    description: () =>
      "Se encontró una clave pública RSA. Aunque son públicas por definición, revisar si se exponía accidentalmente.",
    fixRecommendation:
      "Claves públicas pueden ser públicas, pero evita almacenarlas en .gitignore. Usa archivos versionados explícitos.",
  },
  {
    ruleId: "SECRET_SSH_PRIVATE_KEY",
    title: "Clave privada SSH detectada",
    severity: "high",
    owaspId: "A04",
    regex: /-----BEGIN (?:OPENSSH|RSA|DSA|EC) PRIVATE KEY-----/,
    description: () =>
      "Se encontró archivo de clave privada SSH. Permite acceso directo a servidores sin contraseña.",
    fixRecommendation:
      "Invalida la clave en hosts autorizados. Genera una nueva. Revoca acceso del servidor comprometido.",
  },

  // Generic High-Entropy Secrets
  {
    ruleId: "SECRET_GENERIC_BEARER_TOKEN",
    title: "Token bearer o Authorization hardcodeado",
    severity: "medium",
    owaspId: "A02",
    regex: /Authorization[\s]*[=:]\s*Bearer\s+(?:\S{20,})/gi,
    description: () =>
      "Se detectó Authorization header con token Bearer hardcodeado. Debe obtenerse en tiempo de ejecución.",
    fixRecommendation:
      "Mueve tokens de autorización a variables de entorno. Obtén dinámicamente en tiempo de ejecución.",
  },

  // Django Secret Key
  {
    ruleId: "SECRET_DJANGO_SECRET_KEY",
    title: "Django SECRET_KEY o DJANGO_SECRET_KEY",
    severity: "high",
    owaspId: "A02",
    regex: /(?:DJANGO_)?SECRET_KEY[\s]*[=:]\s*['"`]([^\s'"`]{20,})['"`]/gi,
    description: () =>
      "Se detectó la SECRET_KEY de Django. Se usa para firmar sesiones y tokens de seguridad.",
    fixRecommendation:
      "Rota la clave en Django. Guarda en archivo .env o gestor de secretos. Invalida sesiones existentes.",
  },

  // Flask Session Key
  {
    ruleId: "SECRET_FLASK_SESSION_KEY",
    title: "Flask session key o SECRET_KEY",
    severity: "high",
    owaspId: "A02",
    regex: /(?:FLASK_)?(?:SESSION_)?KEY[\s]*[=:]\s*['"`]([^\s'"`]{15,})['"`]/gi,
    description: () =>
      "Se detectó SECRET_KEY de Flask. Se usa para firmar cookies y sesiones.",
    fixRecommendation:
      "Cámbiala en variables de entorno. Regenera todas las sesiones. Considera usar framework-level session store.",
  },
];

function basename(p: string): string {
  const n = p.replace(/\\/g, "/");
  return n.includes("/") ? n.slice(n.lastIndexOf("/") + 1) : n;
}

export function runSecretsAdvancedEngine(files: FileSnapshot[]): Finding[] {
  const out: Finding[] = [];

  for (const file of files) {
    for (const rule of RULES) {
      rule.regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      const re = rule.regex.global ? rule.regex : new RegExp(rule.regex.source, "g");

      while ((m = re.exec(file.content))) {
        const idx = m.index;
        const { line, column } = lineAndColumn(file.content, idx);

        // Skip matches on lines that reference process.env
        const lineStart = file.content.lastIndexOf("\n", idx) + 1;
        const lineEnd = file.content.indexOf("\n", idx);
        const lineContent = file.content.slice(lineStart, lineEnd === -1 ? undefined : lineEnd);
        if (/process\.env/i.test(lineContent)) continue;

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
