import type { Finding } from "../schemas/findings.js";
import type { FileSnapshot } from "../ingest/types.js";
import { lineAndColumn } from "../util/positions.js";
import { findingFingerprint } from "./id.js";

const SUSPICIOUS_PACKAGES = new Set(
  [
    "event-stream",
    "colors",
    "faker",
    "ua-parser-js",
    "electron-native-notify",
    "request",
  ].map((s) => s.toLowerCase()),
);

const POPULAR_TARGETS = ["react", "react-dom", "next", "lodash", "axios", "express"];

function tryParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function findLineForNeedle(content: string, needle: string): number {
  const idx = content.indexOf(needle);
  if (idx < 0) return 1;
  return lineAndColumn(content, idx).line;
}

function simpleTyposquatLike(name: string): string | null {
  const n = name.toLowerCase().trim();
  for (const target of POPULAR_TARGETS) {
    if (n === target) return null;
    if (n.includes(target) && n !== target && n.length <= target.length + 4) return target;
  }
  return null;
}

function addFinding(
  out: Finding[],
  filePath: string,
  content: string,
  pkgName: string,
  title: string,
  description: string,
  fix: string,
  severity: Finding["severity"],
  owasp: Finding["owaspId"],
  needleForLine?: string,
) {
  const needle =
    needleForLine ??
    `"${pkgName}"`;
  const line = needle.length ? findLineForNeedle(content, needle) : 1;

  const id = findingFingerprint(["DEPS", filePath, line, pkgName, title]);

  const dup = out.some(
    (f) =>
      f.file === filePath &&
      f.ruleId === "DEPS_SUPPLY_CHAIN" &&
      f.title === title &&
      f.line === line,
  );
  if (dup) return;

  out.push({
    id,
    ruleId: "DEPS_SUPPLY_CHAIN",
    title,
    severity,
    owaspId: owasp,
    file: filePath,
    line,
    description,
    fixRecommendation: fix,
  });
}

export function runDepsEngine(files: FileSnapshot[]): Finding[] {
  const out: Finding[] = [];

  for (const file of files) {
    const p = file.path.replace(/\\/g, "/");

    if (/(^|\/)package\.json$/i.test(p)) {
      const data = tryParseJson(file.content) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      } | null;

      type DepEntry = { name: string; ver: string; prod: boolean };
      const merged: DepEntry[] = [];

      if (data?.dependencies) {
        for (const [name, ver] of Object.entries(data.dependencies))
          merged.push({ name, ver, prod: true });
      }
      if (data?.devDependencies) {
        for (const [name, ver] of Object.entries(data.devDependencies))
          merged.push({ name, ver, prod: false });
      }

      for (const dep of merged) {
        const bare = dep.name.includes("/") ? dep.name.slice(dep.name.lastIndexOf("/") + 1) : dep.name;
        const key = bare.toLowerCase();

        if (SUSPICIOUS_PACKAGES.has(key)) {
          const high = ["event-stream", "electron-native-notify"].includes(key);
          addFinding(
            out,
            file.path,
            file.content,
            dep.name,
            `Dependencia con historial notable (“${dep.name}”)`,
            `Se declaró '${dep.name}' (${dep.ver}). Es un ejemplo MVP de revisión de supply-chain.`,
            "Verifica reputación oficial, changelog e incidentes; prioriza cambiar a librerías soportadas y activa reproducibilidad por lockfile/CI.",
            high ? "high" : dep.prod ? "high" : "medium",
            "A03",
          );
        }

        const typoBare = bare.toLowerCase();
        const typoOf = dep.name.startsWith("@")
          ? null
          : simpleTyposquatLike(typoBare);
        if (typoOf && !SUSPICIOUS_PACKAGES.has(key)) {
          addFinding(
            out,
            file.path,
            file.content,
            dep.name,
            `Nombre parecido a “${typoOf}”: revisar typo‑squatting`,
            ` '${dep.name}' recuerda a '${typoOf}', un patrón usado como señuela en paquetes maliciosos.`,
            "Confirma el autor y el número exacto de descargas en el registro público antes de ejecutar código de terceros.",
            "medium",
            "A03",
          );
        }
      }
    }

    if (/(^|\/)requirements\.txt$/i.test(p)) {
      const linesArr = file.content.split("\n");

      linesArr.forEach((lineRaw) => {
        const trimmed = lineRaw.trim();
        if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("-")) return;

        let pkgCandidate = trimmed;
        const firstSpace = trimmed.search(/\s/);
        const semi = trimmed.indexOf(";");
        const cutCandidates = [firstSpace >= 0 ? firstSpace : 9999, semi >= 0 ? semi : 9999];
        const cut = Math.min(...cutCandidates);
        if (cut < 9999) pkgCandidate = trimmed.slice(0, cut).trim();

        pkgCandidate = pkgCandidate.split(/[<>=~[\]()]/)[0]?.trim()?.toLowerCase() ?? "";

        pkgCandidate =
          pkgCandidate.replace(/^git\+[^:]+:\/\//i, "").split(/\//)[0]?.split("@")[0] ?? "";

        if (!pkgCandidate) return;

        if (SUSPICIOUS_PACKAGES.has(pkgCandidate)) {
          addFinding(
            out,
            file.path,
            file.content,
            pkgCandidate,
            `Dependencia Python potencialmente problemática (“${pkgCandidate}”)`,
            `'${pkgCandidate}' aparece también en nuestra lista MVP de ejemplo para alertas.`,
            "Comprueba en PyPI, revisa reportes públicos de incidentes y fija rangos/consulta OSV antes de automatizar installs sin revisión.",
            "medium",
            "A03",
            pkgCandidate,
          );
        }
      });
    }
  }

  return out;
}
