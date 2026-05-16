import type { Finding } from "../schemas/findings.js";
import type { FileSnapshot } from "../ingest/types.js";
import { lineAndColumn } from "../util/positions.js";
import { findingFingerprint } from "./id.js";

type IntegrityRule = {
  ruleId: string;
  title: string;
  severity: Finding["severity"];
  owaspId: Finding["owaspId"];
  description: (match: RegExpMatchArray) => string;
  fixRecommendation: string;
  regex: RegExp;
  langs?: RegExp;
};

const RULES: IntegrityRule[] = [
  // A05: Auto-update patterns
  {
    ruleId: "INTEGRITY_AUTO_UPDATE",
    title: "Actualización automática sin verificación de integridad",
    severity: "medium",
    owaspId: "A05",
    langs: /\.(js|ts|json)$/i,
    regex: /(?:auto.?update|checkForUpdates|downloadUpdate|update.*silent)\s*[:=]|npm\s+install\s+(?:--global|\.\.)\s*(?:|$)/gi,
    description: () =>
      "Se detectó código de auto-actualización sin verificación de integridad (hash/signature).",
    fixRecommendation:
      "Verifica hashes SHA256/RSA signature de updates. Implementa rollback si update falla.",
  },

  // Package.json post-install hooks
  {
    ruleId: "INTEGRITY_POSTINSTALL_SCRIPT",
    title: "Script post-install en package.json (potencialmente malicioso)",
    severity: "medium",
    owaspId: "A05",
    langs: /\.json$/i,
    regex: /"(?:postinstall|post-install|install|preinstall|pre-install)"\s*:\s*"(?!npm\s+prune|npm\s+ci)[^"]*(?:exec|shell|bash|sh|node|python|curl|wget|download)/gi,
    description: () =>
      "Hay un script post-install que ejecuta comandos potencialmente peligrosos.",
    fixRecommendation:
      "Revisa qué hace el post-install. Si necesario, usa `npm audit` y `npm ci` en lugar de `npm install`.",
  },

  // Lock files missing
  {
    ruleId: "INTEGRITY_NO_LOCK_FILE",
    title: "Falta archivo de lock (package-lock.json o yarn.lock)",
    severity: "low",
    owaspId: "A05",
    langs: /package\.json$/i,
    regex: /^.$/,  // Always match to check file
    description: () =>
      "Sin lock file, versiones de dependencias pueden variar entre instalaciones.",
    fixRecommendation:
      "Genera package-lock.json (npm ci) o yarn.lock. Commitea al repo. Usa `npm ci` en CI/CD.",
  },

  // Insecure package sources
  {
    ruleId: "INTEGRITY_INSECURE_REGISTRY",
    title: "Fuente de paquetes insegura o no verificada",
    severity: "medium",
    owaspId: "A05",
    langs: /\.(json|yaml|yml|txt)$/i,
    regex: /registry\s*[=:]\s*['"`](?!https:\/\/registry\.npmjs\.org|https:\/\/registry\.yarnpkg\.com)[^'"`]*['"`]|index\.url\s*[=:]\s*(?!https:)[\s\S]{0,50}/gi,
    description: () =>
      "Se detectó fuente de paquetes que no es un registry oficial o verificado.",
    fixRecommendation:
      "Usa registries oficiales (npm, yarn). Si necesitas mirror privado, verifica HTTPS y firma.",
  },

  // Missing integrity checks
  {
    ruleId: "INTEGRITY_MISSING_CHECKSUM",
    title: "Descarga de dependencia sin validación de hash/checksum",
    severity: "medium",
    owaspId: "A05",
    langs: /\.(js|ts|py|sh|bash)$/i,
    regex: /(?:curl|wget|download|fetch)\s+(?:https?:\/\/[\w\.\-\/]+\.(?:jar|zip|tar|gz|exe|dll|so))\s*(?:[|>]|$)(?!.*sha256|.*sha1|.*md5|.*verify|.*check)/gi,
    description: () =>
      "Se detectó descarga de archivo sin validación posterior de checksum/hash.",
    fixRecommendation:
      "Descarga + verifica hash SHA256 antes de usar archivo. Considera usar package managers.",
  },

  // Ruby gems without lock
  {
    ruleId: "INTEGRITY_RUBY_NO_GEMLOCK",
    title: "Gemfile sin Gemfile.lock",
    severity: "low",
    owaspId: "A05",
    langs: /Gemfile$/i,
    regex: /^.$/,  // Always match to check file
    description: () =>
      "Sin Gemfile.lock, versiones de gems puede variar. Usa `bundle lock`.",
    fixRecommendation:
      "Ejecuta `bundle lock` y commitea Gemfile.lock. Usa `bundle ci` en deployments.",
  },

  // Python requirements without lock
  {
    ruleId: "INTEGRITY_PYTHON_NO_LOCK",
    title: "requirements.txt sin hash de integridad (pip)",
    severity: "low",
    owaspId: "A05",
    langs: /requirements(?:\.txt|-lock\.txt|-dev\.txt)?$/i,
    regex: /^(?!.*(?:--hash|sha256|sha512|blake2|blake2s|blake2b))[\w\-]+[=<>~!]+[\d\.]+/gm,
    description: () =>
      "Dependencias Python sin hash verificable. Usa `pip hash` o Pipfile.lock.",
    fixRecommendation:
      "Agrega hashes: `pip install --require-hashes`. O mejor: usa poetry/pipenv con lock files.",
  },

  // Go modules without sum verification
  {
    ruleId: "INTEGRITY_GO_NO_SUM",
    title: "go.mod sin go.sum para verificación de integridad",
    severity: "low",
    owaspId: "A05",
    langs: /go\.mod$/i,
    regex: /^.$/,  // Always match
    description: () =>
      "Sin go.sum, módulos de Go no verifican integridad de descargas.",
    fixRecommendation:
      "Ejecuta `go mod tidy` para generar go.sum. Commitea ambos al repo.",
  },

  // Dependency pinning missing
  {
    ruleId: "INTEGRITY_LOOSE_VERSION_CONSTRAINTS",
    title: "Restricciones de versión muy abiertas (permite cambios mayores)",
    severity: "low",
    owaspId: "A05",
    langs: /\.(json|txt|py|rb)$/i,
    regex: /["'][\w\-]+["\']:\s*["']\*["']|["'][\w\-]+["\']:\s*["']latest["']|^[\w\-]+[=<>~]*$/gm,
    description: () =>
      "Versión de dependencia sin especificar permite cambios no controlados.",
    fixRecommendation:
      "Fija versiones: ^ (minor) o ~ (patch). Evita * y latest. Actualiza deliberadamente.",
  },

  // Unsigned/untrusted commits
  {
    ruleId: "INTEGRITY_UNSIGNED_COMMITS",
    title: "Commits sin firma GPG detectados (potencial en historial)",
    severity: "low",
    owaspId: "A05",
    langs: /\.git\/.*/i,
    regex: /^committer [^\[]+\[\d+\]\s+(?!gpgsig)$/gm,
    description: () =>
      "Commits en historio Git sin firma GPG podrían haber sido inyectados o modificados.",
    fixRecommendation:
      "Configura `git config commit.gpgsign true`. Firma commits con GPG. Requiere en branch protection.",
  },

  // Submodule without integrity pin
  {
    ruleId: "INTEGRITY_GIT_SUBMODULE_LOOSE",
    title: "Git submodule sin commit específico pinned",
    severity: "medium",
    owaspId: "A05",
    langs: /\.gitmodules$/i,
    regex: /branch\s*=/gi,
    description: () =>
      "Submodule sigue branch en lugar de commit específico. Permite inyección.",
    fixRecommendation:
      "Usa commits específicos, no branches. Verifica integridad de submodules frecuentemente.",
  },

  // Docker image without digest
  {
    ruleId: "INTEGRITY_DOCKER_NO_DIGEST",
    title: "Docker image sin digest SHA256 (solo tag)",
    severity: "medium",
    owaspId: "A05",
    langs: /Dockerfile|docker-compose\.ya?ml$/i,
    regex: /FROM\s+[\w\-\/]+:[\w\-\.]+(?!@sha256|@digest|\s*#)/gi,
    description: () =>
      "Pull de imagen Docker solo por tag permite push de tag modificado.",
    fixRecommendation:
      "Fija con digest: `FROM image:tag@sha256:...`. Valida digest con `docker inspect`.",
  },

  // Unverified external script
  {
    ruleId: "INTEGRITY_EXTERNAL_SCRIPT_NO_VERIFY",
    title: "Script externo ejecutado sin verificación de integridad",
    severity: "medium",
    owaspId: "A05",
    langs: /\.(sh|bash|py|js|ts|json)$/i,
    regex: /(?:curl|wget|source|\.|\bash)\s+(?:https?:\/\/[\w\.\-\/]+\.(?:sh|py|js|rb))\s*(?:[|;\n]|$)/gi,
    description: () =>
      "Se ejecuta script descargado de internet sin verificar hash/firma.",
    fixRecommendation:
      "Descarga + verifica hash/firma antes de ejecutar. Mejor: incluye scripts en repo versionado.",
  },

  // Artifact repository without HTTPS
  {
    ruleId: "INTEGRITY_ARTIFACT_HTTP",
    title: "Descarga de artifact/librería desde HTTP (sin TLS)",
    severity: "medium",
    owaspId: "A05",
    langs: /\.(gradle|xml|pom|json|yaml|yml|js|ts|py)$/i,
    regex: /http:\/\/(?!localhost|127\.0\.0\.1)[^\s'"`]+(?:\.jar|\.zip|\.war|\.tar|\.gz)/gi,
    description: () =>
      "Descarga de artifact vía HTTP permite MITM y code injection.",
    fixRecommendation:
      "Usa HTTPS (https://) para todos los repositorios y downloads.",
  },
];

export function runIntegrityEngine(files: FileSnapshot[]): Finding[] {
  const out: Finding[] = [];

  // Check for lock file existence at repo level
  const hasPackageLock = files.some(f => f.path.endsWith("package-lock.json"));
  const hasYarnLock = files.some(f => f.path.endsWith("yarn.lock"));
  const hasGemLock = files.some(f => f.path.endsWith("Gemfile.lock"));
  const hasGoSum = files.some(f => f.path.endsWith("go.sum"));
  const hasPipfileLock = files.some(f => f.path.endsWith("Pipfile.lock"));
  const hasPoetryLock = files.some(f => f.path.endsWith("poetry.lock"));

  const hasPackageJson = files.some(f => f.path.endsWith("package.json"));
  const hasGemfile = files.some(f => f.path.endsWith("Gemfile"));
  const hasGoMod = files.some(f => f.path.endsWith("go.mod"));
  const hasRequirements = files.some(f => f.path.includes("requirements") && f.path.endsWith(".txt"));

  // Check for missing lock files
  if (hasPackageJson && !hasPackageLock && !hasYarnLock) {
    const pkgFile = files.find(f => f.path.endsWith("package.json"));
    if (pkgFile) {
      const { line, column } = lineAndColumn(pkgFile.content, 0);
      out.push({
        id: findingFingerprint(["INTEGRITY_NO_LOCK_FILE", "package.json"]),
        ruleId: "INTEGRITY_NO_LOCK_FILE",
        title: "Falta archivo de lock (package-lock.json o yarn.lock)",
        severity: "low",
        owaspId: "A05",
        file: pkgFile.path,
        line,
        column,
        description:
          "Sin lock file, versiones de dependencias pueden variar entre instalaciones. Esto permite supply chain attacks.",
        fixRecommendation:
          "Ejecuta `npm ci` (no npm install) en CI/CD. Commitea package-lock.json al repo. Para yarn: yarn.lock.",
      });
    }
  }

  if (hasGemfile && !hasGemLock) {
    const gemFile = files.find(f => f.path.endsWith("Gemfile"));
    if (gemFile) {
      const { line, column } = lineAndColumn(gemFile.content, 0);
      out.push({
        id: findingFingerprint(["INTEGRITY_RUBY_NO_GEMLOCK", "Gemfile"]),
        ruleId: "INTEGRITY_RUBY_NO_GEMLOCK",
        title: "Gemfile sin Gemfile.lock",
        severity: "low",
        owaspId: "A05",
        file: gemFile.path,
        line,
        column,
        description:
          "Sin Gemfile.lock, versiones de gems puede variar. Ejecuta `bundle lock`.",
        fixRecommendation:
          "Ejecuta `bundle lock` y commitea Gemfile.lock. Usa `bundle ci` en deployments.",
      });
    }
  }

  if (hasGoMod && !hasGoSum) {
    const goModFile = files.find(f => f.path.endsWith("go.mod"));
    if (goModFile) {
      const { line, column } = lineAndColumn(goModFile.content, 0);
      out.push({
        id: findingFingerprint(["INTEGRITY_GO_NO_SUM", "go.mod"]),
        ruleId: "INTEGRITY_GO_NO_SUM",
        title: "go.mod sin go.sum para verificación de integridad",
        severity: "low",
        owaspId: "A05",
        file: goModFile.path,
        line,
        column,
        description:
          "Sin go.sum, módulos de Go no verifican integridad de descargas.",
        fixRecommendation:
          "Ejecuta `go mod tidy` para generar go.sum. Commitea ambos al repo.",
      });
    }
  }

  // Regular expression matching for other patterns
  for (const file of files) {
    for (const rule of RULES) {
      // Skip file-existence checks already done above
      if (["INTEGRITY_NO_LOCK_FILE", "INTEGRITY_RUBY_NO_GEMLOCK", "INTEGRITY_GO_NO_SUM"].includes(rule.ruleId)) continue;

      if (rule.langs && !rule.langs.test(file.path.replace(/\\/g, "/"))) continue;

      const re = new RegExp(rule.regex.source, rule.regex.flags.includes("g") ? rule.regex.flags : `${rule.regex.flags}g`);

      let m: RegExpExecArray | null;
      while ((m = re.exec(file.content))) {
        const idx = m.index;
        const { line, column } = lineAndColumn(file.content, idx);
        const snippet = file.content.slice(idx, idx + 80).replace(/\s+/g, " ").slice(0, 80);

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
