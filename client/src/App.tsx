import { FormEvent, useMemo, useState } from "react";

import { ANALYZE_URL } from "./config";
import { clientLog, clientTimer } from "./util/logger";

type Severity = "low" | "medium" | "high";

type OwaspId =
  | "A01"
  | "A02"
  | "A03"
  | "A04"
  | "A05"
  | "A06"
  | "A07"
  | "A08"
  | "A09"
  | "A10";

type TrafficLight = "green" | "yellow" | "red";

type Educational = {
  what: string;
  why: string;
  impact: string;
  whoAffected: string;
};

type Finding = {
  id: string;
  ruleId: string;
  title: string;
  severity: Severity;
  owaspId: OwaspId;
  file: string;
  line?: number;
  column?: number;
  description: string;
  fixRecommendation: string;
  safeExample?: string;
  educational?: Educational;
};

type AnalysisResult = {
  riskScore: number;
  trafficLight: TrafficLight;
  findings: Finding[];
  limits: {
    filesProcessed: number;
    totalBytesApprox: number;
    truncated: boolean;
    warnings: string[];
  };
  usedAiExplanation: boolean;
};

type Tab = "raw" | "zip" | "github";

const OWASP_TITLE: Record<OwaspId, string> = {
  A01: "Control de acceso",
  A02: "Mal configuración de seguridad",
  A03: "Cadena de suministro de software",
  A04: "Fallas criptográficas",
  A05: "Inyección",
  A06: "Diseño inseguro",
  A07: "Fallos de autenticación",
  A08: "Integridad de software/datos",
  A09: "Registro/monitorización",
  A10: "Manejo de condiciones excepcionales",
};

function clampLabel(score: number) {
  if (score <= 12) return "Señales bajas dentro de esta revisión rápida.";
  if (score <= 62) return "Hay señales mezcladas: conviene ordenar antes de desplegar.";
  return "Concentración alta de patrones delicados revisados superficialmente.";
}

function severityClass(level: Severity) {
  switch (level) {
    case "high":
      return "sev-high";
    case "medium":
      return "sev-med";
    case "low":
    default:
      return "sev-low";
  }
}

function LampStack({ tone, score }: { tone: TrafficLight; score: number }) {

  const greenOn = tone === "green";
  const yellowOn = tone === "yellow";
  const redOn = tone === "red";

  return (
    <div className="traffic-visual">
      <div className="lamp-stack">
        <div className={`lamp ${greenOn ? "onGreen" : ""}`} aria-hidden />
        <div className={`lamp ${yellowOn ? "onYellow" : ""}`} aria-hidden />
        <div className={`lamp ${redOn ? "onRed" : ""}`} aria-hidden />
      </div>
      <p className="score-value">{score}</p>
      <p className="score-foot">0‑100 · Cuanto mayor, más urgente según estos patrones heurísticos sueltos.</p>
      <p className="score-label">
        {tone === "green" ? "Verde · Perfil estable" : tone === "yellow" ? "Ámbar · Atención necesaria" : "Rojo · Priorizar antes de lanzar"}
      </p>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("raw");
  const [code, setCode] = useState("");
  const [filename, setFilename] = useState("fragmento.tsx");
  const [repoUrl, setRepoUrl] = useState("https://github.com/expressjs/express");
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const tabButtons = useMemo(
    () =>
      ([
        { id: "raw" as Tab, label: "Pegar código" },
        { id: "zip" as Tab, label: "Subir ZIP" },
        { id: "github" as Tab, label: "Repo GitHub" },
      ]) satisfies Array<{ id: Tab; label: string }>,
    [],
  );

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    const elapsed = clientTimer();
    clientLog.info("analyze.submit", "Usuario lanzó análisis", { tab });

    try {
      setLoading(true);

      let response: Response;

      if (tab === "zip") {
        if (!zipFile) {
          throw new Error("Selecciona un archivo .zip con tu proyecto antes de escanear.");
        }
        const form = new FormData();
        form.append("file", zipFile);

        clientLog.debug("analyze.request", "POST ZIP", {
          url: ANALYZE_URL,
          zipName: zipFile.name,
          zipBytes: zipFile.size,
        });

        response = await fetch(ANALYZE_URL, {
          method: "POST",
          body: form,
        });
      } else if (tab === "raw") {
        if (!code.trim()) {
          throw new Error("Escribe algo de código antes de lanzar el análisis.");
        }

        clientLog.debug("analyze.request", "POST raw", {
          url: ANALYZE_URL,
          codeBytes: code.length,
          filename: filename.trim() || "pasted-code.txt",
        });

        response = await fetch(ANALYZE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "raw",
            code,
            filename: filename.trim() ? filename.trim() : undefined,
          }),
        });
      } else {
        if (!repoUrl.trim()) throw new Error("Pega primero una URL válida.");

        clientLog.debug("analyze.request", "POST github", {
          url: ANALYZE_URL,
          repoUrl: repoUrl.trim(),
        });

        response = await fetch(ANALYZE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "github",
            url: repoUrl.trim(),
          }),
        });
      }

      if (!response.ok) {
        const maybeJson = await response.json().catch(() => null) as {
          message?: string;
          error?: string;
        } | null;
        clientLog.warn("analyze.http_error", "Respuesta no OK del servidor", {
          status: response.status,
          error: maybeJson?.error,
          ms: elapsed(),
        });
        throw new Error(
          maybeJson?.message ||
            `El servidor respondió ${response.status} (${maybeJson?.error ?? "UNKNOWN_ERROR"}).`,
        );
      }

      const payload = (await response.json()) as AnalysisResult;

      payload.findings.sort((a, b) => {
        const order: Record<Severity, number> = {
          high: 0,
          medium: 1,
          low: 2,
        };
        return (
          order[a.severity] - order[b.severity] ||
          a.title.localeCompare(b.title, "es")
        );
      });

      clientLog.info("analyze.success", "Análisis recibido", {
        ms: elapsed(),
        findings: payload.findings.length,
        riskScore: payload.riskScore,
        trafficLight: payload.trafficLight,
        usedAiExplanation: payload.usedAiExplanation,
      });

      setResult(payload);
    } catch (err) {
      setResult(null);
      const message =
        err instanceof TypeError && /fetch|network|failed|disconnected/i.test(String(err))
          ? "No se pudo contactar al servidor. Abrí la app en http://127.0.0.1:5173 (no localhost), confirmá que `npm run dev` esté activo y que DevTools → Network no tenga «Offline» marcado."
          : err instanceof Error
            ? err.message
            : "Error inesperado.";
      clientLog.error("analyze.failed", message, {
        tab,
        ms: elapsed(),
        err: err instanceof Error ? err.message : String(err),
      });
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell">
      <header className="hero">
        <span className="pill-badge">VibeGuard · OWASP Top 10 (2025)</span>
        <h1>Protege lo que codificás con IA</h1>
        <p className="lead">
          VibeGuard escanea lo que vos pegás, empacás o linkeás y traduce cada alerta como si se lo explicaras a alguien
          sin jargon.
        </p>
      </header>

      <div className="panel">
        <form onSubmit={onSubmit}>
          <div className="tabs" role="tablist">
            {tabButtons.map((entry) => (
              <button
                key={entry.id}
                type="button"
                className="tab-btn"
                aria-current={tab === entry.id}
                aria-selected={tab === entry.id}
                onClick={() => setTab(entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          {tab === "raw" && (
            <>
              <div className="field">
                <label htmlFor="code">Tu código fuente</label>
                <textarea
                  id="code"
                  name="code"
                  spellCheck={false}
                  value={code}
                  onChange={(event) => setCode(event.target.value)}
                  placeholder="// Pega snippets generados por la IA..."
                />
              </div>

              <div className="field">
                <label htmlFor="filename">Nombre opcional para referencias</label>
                <input
                  id="filename"
                  type="text"
                  value={filename}
                  onChange={(event) => setFilename(event.target.value)}
                  aria-describedby="filename-helper"
                  placeholder="p.ej. server/routes/checkout.ts"
                />
                <p id="filename-helper" style={{ margin: 0, fontSize: "0.86rem", color: "#566183" }}>
                  Ayuda sólo textual; no ejecuta tus archivos.
                </p>
              </div>
            </>
          )}

          {tab === "zip" && (
            <div className="field">
              <label htmlFor="zip">Archivo .zip</label>
              <input
                id="zip"
                type="file"
                accept=".zip,application/zip"
                aria-describedby="zip-helper"
                onChange={(event) =>
                  setZipFile(event.target.files?.[0] ?? null)
                }
              />
              <p id="zip-helper" style={{ margin: 0, fontSize: "0.86rem", color: "#566183" }}>
                Se analizan rutas relativas conocidas (*.ts, *.py…). Omitimos binaries y tamaños grandes automáticamente.
              </p>
            </div>
          )}

          {tab === "github" && (
            <>
              <div className="field">
                <label htmlFor="github-url">Link público de GitHub</label>
                <input
                  id="github-url"
                  type="url"
                  placeholder="https://github.com/org/repo"
                  value={repoUrl}
                  aria-describedby="github-helper"
                  onChange={(event) => setRepoUrl(event.target.value)}
                  required={tab === "github"}
                />
                <p id="github-helper" style={{ margin: 0, fontSize: "0.86rem", color: "#566183" }}>
                  Pensado para proyectos públicos. Si llegás al rate limit pedí un{" "}
                  <code className="mono">GITHUB_TOKEN</code> al servidor (.env servidor).
                </p>
              </div>
            </>
          )}

          <div className="row-actions">
            <button className="btn-primary" type="submit" disabled={loading}>
              {loading ? "Analizando..." : "Lanzar análisis rápido"}
            </button>
            {loading && (
              <span aria-live="polite" style={{ color: "#2c395b" }}>
                Esto suele llevar algunos segundos…
              </span>
            )}
          </div>
        </form>
      </div>

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {result && (
        <section aria-live="polite">
          <div className="result-header">
            <LampStack tone={result.trafficLight} score={result.riskScore} />

            <div>
              <h2>Puntuación rápida de riesgos detectados</h2>
              <p style={{ color: "#2c395b", marginBottom: "0.35rem", maxWidth: "68ch" }}>
                {clampLabel(result.riskScore)} El valor sube sólo porque sumamos evidencias rápidamente detectables —
                jamás garantiza estar “limpia” ante auditorías profesionales.
              </p>
              <div className="meta-chips">
                <span className="chip">
                  <strong>Archivos</strong>: {result.limits.filesProcessed}
                </span>
                <span className="chip">
                  <strong>Bytes</strong>: {result.limits.totalBytesApprox.toLocaleString("es")}
                </span>
                <span className="chip">
                  <strong>Análisis ampliado con IA educativa:</strong>
                  {" "}{result.usedAiExplanation ? "Sí ✨" : "No (solo plantillas)"}
                </span>
                <span className="chip mono">
                  <strong>Truncado?</strong>: {result.limits.truncated ? "Sí" : "No"}
                </span>
              </div>
              {Boolean(result.limits.warnings.length) && (
                <ul className="warnings-mini">
                  {result.limits.warnings.map((warn) => (
                    <li key={warn}>{warn}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <section className="findings-stack">
            <h3 style={{ marginTop: "1.85rem", marginBottom: "0rem" }}>
              Lista de puntos delicados encontrados ({result.findings.length})
            </h3>

            {!result.findings.length && (
              <p>No detectamos ninguno de los patrones MVP dentro de estos límites. Eso jamás será una certificación oficial.</p>
            )}

            {result.findings.map((finding) => (
              <details className="finding-card" key={finding.id}>
                <summary>{finding.title}</summary>
                <div className="finding-body">
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem", alignItems: "center" }}>
                    <strong className={severityClass(finding.severity)}>
                      Severidad • {finding.severity.toUpperCase()}
                    </strong>
                    <span className="chip mono">
                      {finding.owaspId} • {OWASP_TITLE[finding.owaspId]}
                    </span>
                    <span className="mono" style={{ color: "#1d2b53" }}>
                      {finding.file}
                      {typeof finding.line === "number"
                        ? ` · línea ~${finding.line}`
                        : ""}
                      {typeof finding.column === "number"
                        ? ` · col ${finding.column}`
                        : ""}
                    </span>
                  </div>
                  <p style={{ margin: 0 }}>
                    <strong>Qué vio la regla rápida</strong>: {finding.description}
                  </p>
                  <section>
                    <h4 style={{ margin: "0.25rem 0" }}>Cómo arreglarlo</h4>
                    <p style={{ marginTop: "0rem" }}>
                      {finding.fixRecommendation}
                    </p>

                    {finding.safeExample && (
                      <pre style={{ overflowX: "auto", marginTop: "0.5rem", borderRadius: "0.9rem", background: "#0d1326", padding: "0.95rem", color: "#eaf0ff", fontSize: "0.85rem" }}>
                        {finding.safeExample}
                      </pre>
                    )}
                  </section>

                  {finding.educational && (
                    <section className="edu-grid">
                      <h4 style={{ gridColumn: "1 / -1", marginBottom: "-0.2rem", marginTop: 0 }}>Traducción didáctica (no técnica)</h4>
                      <dl>
                        <dt>Qué problema es si lo simplificamos</dt>
                        <dd>{finding.educational.what}</dd>
                        <dt>Por qué importa aun si “funciona en local”</dt>
                        <dd>{finding.educational.why}</dd>
                        <dt>Qué puede pasar en el mundo real</dt>
                        <dd>{finding.educational.impact}</dd>
                        <dt>Quién termina sintiendo ese impacto primero</dt>
                        <dd>{finding.educational.whoAffected}</dd>
                      </dl>
                    </section>
                  )}
                </div>
              </details>
            ))}
          </section>
        </section>
      )}
    </div>
  );
}
