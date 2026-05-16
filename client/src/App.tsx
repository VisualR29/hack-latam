import { FormEvent, useState, useEffect } from "react";

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

function getSeverityStyles(severity: Severity) {
  switch (severity) {
    case "high":
      return { bg: "bg-[#F87171]", bgAlpha: "bg-[#F87171]/10", text: "text-[#F87171]", label: "CRÍTICO", icon: "warning" };
    case "medium":
      return { bg: "bg-[#FACC15]", bgAlpha: "bg-[#FACC15]/10", text: "text-[#FACC15]", label: "ADVERTENCIA", icon: "lock_open" };
    case "low":
    default:
      return { bg: "bg-[#4ADE80]", bgAlpha: "bg-[#4ADE80]/10", text: "text-[#4ADE80]", label: "SEGURO", icon: "check_circle" };
  }
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

  const [linesArray, setLinesArray] = useState([1]);

  useEffect(() => {
    const lines = code.split("\n").length;
    if (lines !== linesArray.length) {
      setLinesArray(Array.from({ length: Math.max(12, lines) }, (_, i) => i + 1));
    }
  }, [code, linesArray.length]);

  async function onSubmit(event?: FormEvent) {
    if (event) event.preventDefault();
    setError(null);

    try {
      setLoading(true);

      let response: Response;

      if (tab === "zip") {
        if (!zipFile) {
          throw new Error("Selecciona un archivo .zip con tu proyecto antes de escanear.");
        }
        const form = new FormData();
        form.append("file", zipFile);

        response = await fetch("/api/analyze", {
          method: "POST",
          body: form,
        });
      } else if (tab === "raw") {
        if (!code.trim()) {
          throw new Error("Escribe algo de código antes de lanzar el análisis.");
        }

        response = await fetch("/api/analyze", {
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

        response = await fetch("/api/analyze", {
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

      setResult(payload);
    } catch (err) {
      setResult(null);
      setError(err instanceof Error ? err.message : "Error inesperado.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-on-background font-body-md selection:bg-primary/30 flex">
      {/* Sidebar Shell */}
      <aside className="hidden md:flex flex-col h-screen py-lg px-sm fixed left-0 top-0 w-64 bg-surface-container z-50">
        <div className="mb-xl px-xs">
          <h1 className="font-headline-md text-headline-md font-bold text-primary">VibeGuard</h1>
          <p className="font-body-md text-body-md text-on-surface-variant opacity-70">Análisis de Seguridad</p>
        </div>
        <nav className="flex-1 flex flex-col gap-xs">
          <a
            className="flex items-center gap-sm px-sm py-sm transition-colors duration-200 ease-in-out text-primary bg-primary-container/10 border-r-2 border-primary group"
            href="#"
            onClick={(e) => { e.preventDefault(); setResult(null); }}
          >
            <span className="material-symbols-outlined" data-icon="dashboard">dashboard</span>
            <span className="font-label-caps text-label-caps">Panel de Control</span>
          </a>
          <a
            className="flex items-center gap-sm px-sm py-sm transition-colors duration-200 ease-in-out text-on-surface-variant hover:bg-surface-bright hover:text-primary group"
            href="#"
          >
            <span className="material-symbols-outlined" data-icon="history">history</span>
            <span className="font-label-caps text-label-caps">Historial de Seguridad</span>
          </a>
        </nav>
        <div className="mt-auto px-xs flex items-center gap-sm pt-md border-t border-outline-variant">
          <div className="w-8 h-8 rounded-full bg-surface-variant flex items-center justify-center overflow-hidden border border-outline-variant">
            <span className="material-symbols-outlined text-outline">person</span>
          </div>
          <div className="flex flex-col">
            <span className="font-label-caps text-[11px] text-on-surface">Sesión de Administrador</span>
            <span className="font-body-md text-[12px] text-on-surface-variant">security@vibeguard.io</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 md:ml-64 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="flex justify-between items-center h-16 px-margin-mobile md:px-margin-desktop bg-surface border-b border-outline-variant sticky top-0 z-40">
          <div className="flex items-center gap-md">
            <span className="font-headline-md text-headline-md font-bold text-primary md:hidden">VG</span>
            <span className="font-headline-md text-headline-md font-bold text-on-surface hidden md:block">
              {result ? "Resultados del Análisis" : "Nuevo Análisis"}
            </span>
          </div>
          <div className="flex items-center gap-lg">
            <div className="flex items-center gap-md">
              <button className="material-symbols-outlined text-on-surface hover:text-primary transition-colors scale-95 active:scale-90" data-icon="notifications">notifications</button>
              <button className="material-symbols-outlined text-on-surface hover:text-primary transition-colors scale-95 active:scale-90" data-icon="settings">settings</button>
            </div>
            <div className="w-8 h-8 rounded-full bg-surface-variant border border-outline-variant overflow-hidden hidden md:block">
              <span className="material-symbols-outlined text-outline flex items-center justify-center h-full w-full">person</span>
            </div>
          </div>
        </header>

        {/* Main Content Canvas */}
        <main className="flex-1 p-margin-mobile md:p-margin-desktop flex flex-col bg-background">
          {error && (
            <div className="mb-md bg-error-container/20 border border-error text-error px-md py-sm rounded-lg flex items-center gap-sm">
              <span className="material-symbols-outlined" data-icon="error">error</span>
              <p>{error}</p>
            </div>
          )}

          {!result ? (
            <div className="w-full max-w-4xl mx-auto bg-surface-container rounded-xl border border-outline-variant inner-glow overflow-hidden flex flex-col transition-all duration-300">
              {/* Switcher Header */}
              <div className="flex flex-wrap items-center border-b border-outline-variant bg-surface-container-low px-md">
                <button
                  className={`py-md px-4 md:px-lg font-label-caps text-label-caps transition-all border-b-2 flex items-center gap-xs ${tab === 'raw' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
                  onClick={() => setTab('raw')}
                >
                  <span className="material-symbols-outlined text-[18px]" data-icon="content_paste">content_paste</span>
                  <span className="hidden sm:inline">Pegar Código</span>
                </button>
                <button
                  className={`py-md px-4 md:px-lg font-label-caps text-label-caps transition-all border-b-2 flex items-center gap-xs ${tab === 'zip' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
                  onClick={() => setTab('zip')}
                >
                  <span className="material-symbols-outlined text-[18px]" data-icon="folder_zip">folder_zip</span>
                  <span className="hidden sm:inline">Archivo ZIP</span>
                </button>
                <button
                  className={`py-md px-4 md:px-lg font-label-caps text-label-caps transition-all border-b-2 flex items-center gap-xs ${tab === 'github' ? 'border-primary text-primary' : 'border-transparent text-on-surface-variant hover:text-on-surface'}`}
                  onClick={() => setTab('github')}
                >
                  <span className="material-symbols-outlined text-[18px]" data-icon="terminal">terminal</span>
                  <span className="hidden sm:inline">GitHub</span>
                </button>
              </div>

              {/* Content Area */}
              <div className="p-sm md:p-lg space-y-lg">
                <div className="space-y-xs">
                  <h2 className="font-headline-md text-[20px] md:text-headline-md text-on-surface">Escáner de Vulnerabilidades</h2>
                  <p className="font-body-md text-body-md text-on-surface-variant">Proporciona tu código fuente a continuación para realizar una auditoría de seguridad basada en los estándares de OWASP.</p>
                </div>

                <form onSubmit={onSubmit} className="space-y-lg">
                  {tab === 'raw' && (
                    <div className="space-y-md animate-fade-in">
                      <input
                        className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-md py-sm font-code-sm text-code-sm text-on-surface focus:outline-none focus:border-primary mb-sm"
                        placeholder="Nombre opcional para referencias (ej. index.ts)"
                        value={filename}
                        onChange={(e) => setFilename(e.target.value)}
                      />
                      <div className="relative group">
                        <div className="absolute left-0 top-0 h-full w-12 bg-surface-container-lowest border-r border-outline-variant flex flex-col items-center py-sm gap-[4px] font-code-sm text-code-sm text-outline-variant select-none overflow-hidden" id="line-numbers">
                          {linesArray.map((i) => <span key={i}>{i}</span>)}
                        </div>
                        <textarea
                          className="w-full h-80 pl-16 pr-sm py-sm bg-surface-container-high border border-outline-variant rounded-lg font-code-sm text-code-sm text-on-surface code-textarea custom-scrollbar resize-none placeholder:text-outline-variant/50 transition-all"
                          placeholder="// Pega tu código Javascript, Python, Go o Java aquí..."
                          value={code}
                          onChange={(e) => setCode(e.target.value)}
                          onScroll={(e) => {
                            const lineNumbers = document.getElementById('line-numbers');
                            if (lineNumbers) lineNumbers.scrollTop = (e.target as HTMLTextAreaElement).scrollTop;
                          }}
                          spellCheck={false}
                        />
                      </div>
                    </div>
                  )}

                  {tab === 'zip' && (
                    <div className="py-xl flex flex-col items-center justify-center border-2 border-dashed border-outline-variant rounded-xl bg-surface-container-low transition-colors hover:bg-surface-container-high cursor-pointer relative animate-fade-in group">
                      <input
                        type="file"
                        accept=".zip,application/zip"
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        onChange={(e) => setZipFile(e.target.files?.[0] ?? null)}
                      />
                      <span className="material-symbols-outlined text-[64px] text-outline mb-md group-hover:text-primary transition-colors" data-icon="cloud_upload">cloud_upload</span>
                      <h3 className="font-headline-md text-headline-md text-on-surface">Subir Archivo de Proyecto</h3>
                      <p className="font-body-md text-body-md text-on-surface-variant mt-xs">
                        {zipFile ? zipFile.name : "Arrastra y suelta tu archivo .zip o haz clic para buscar"}
                      </p>
                    </div>
                  )}

                  {tab === 'github' && (
                    <div className="space-y-md animate-fade-in">
                      <div className="flex flex-col sm:flex-row items-center gap-sm">
                        <input
                          className="flex-1 w-full bg-surface-container-high border border-outline-variant rounded-lg px-md py-sm font-code-sm text-code-sm text-on-surface focus:outline-none focus:border-primary"
                          placeholder="https://github.com/usuario/repositorio"
                          type="url"
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                        />
                      </div>
                      <p className="font-body-md text-[12px] text-on-surface-variant italic">Solo se soportan repositorios públicos en el Nivel Gratuito.</p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-sm border-t border-outline-variant">
                    <div className="hidden sm:flex items-center gap-sm">
                      <div className="flex items-center gap-xs px-sm py-xs bg-surface-container-highest rounded-full border border-outline-variant">
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>
                        <span className="font-label-caps text-[10px] text-on-surface-variant">Motor Activo</span>
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="ml-auto bg-[#2FEBD2] text-[#0c141a] px-xl py-sm rounded-lg font-label-caps text-label-caps font-bold hover:brightness-110 active:scale-95 transition-all flex items-center gap-sm shadow-[0_0_20px_rgba(47,235,210,0.2)] disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <>
                          <span className="material-symbols-outlined animate-spin" data-icon="sync">sync</span>
                          Analizando...
                        </>
                      ) : (
                        <>
                          <span className="material-symbols-outlined" data-icon="shield_with_heart">shield_with_heart</span>
                          Analizar
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-7xl mx-auto space-y-lg animate-fade-in">
              {/* Hero Score Card */}
              <div className="relative bg-surface-container-high rounded-xl p-lg inner-glow overflow-hidden group">
                <div className="absolute inset-0 opacity-5 pointer-events-none">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-primary-container rounded-full blur-[100px]"></div>
                </div>
                <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-lg">
                  <div className="space-y-sm text-center md:text-left">
                    <span className="font-label-caps text-label-caps text-primary tracking-widest px-sm py-1 bg-primary/10 rounded-full">ESTADO DE SEGURIDAD</span>
                    <h3 className="font-headline-lg text-headline-lg text-on-surface mt-xs">Puntuación de Seguridad</h3>
                    <p className="font-body-md text-on-surface-variant max-w-md">Tu código ha sido auditado según los estándares del Top 10 de OWASP. La puntuación refleja las necesidades inmediatas de corrección.</p>
                    <div className="pt-sm flex flex-wrap gap-xs">
                       <span className="text-[12px] px-2 py-1 bg-surface-container rounded border border-outline-variant">Archivos: {result.limits.filesProcessed}</span>
                       <span className="text-[12px] px-2 py-1 bg-surface-container rounded border border-outline-variant">Bytes: {result.limits.totalBytesApprox}</span>
                       <span className="text-[12px] px-2 py-1 bg-surface-container rounded border border-outline-variant">IA Educativa: {result.usedAiExplanation ? "Activada ✨" : "Desactivada"}</span>
                    </div>
                  </div>
                  <div className="relative flex items-center justify-center">
                    <svg className="w-48 h-48 transform -rotate-90">
                      <circle className="text-surface-container-highest" cx="96" cy="96" fill="transparent" r="88" stroke="currentColor" strokeWidth="8"></circle>
                      <circle
                        className={`${result.trafficLight === 'red' ? 'text-error' : result.trafficLight === 'yellow' ? 'text-[#FACC15]' : 'text-primary'} transition-all duration-1000 ease-out`}
                        cx="96" cy="96" fill="transparent" r="88" stroke="currentColor"
                        strokeDasharray="552.92"
                        strokeDashoffset={552.92 - (552.92 * result.riskScore / 100)}
                        strokeLinecap="round" strokeWidth="12"
                      ></circle>
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="font-headline-lg text-[64px] text-on-surface">{result.riskScore}%</span>
                      <span className={`font-label-caps text-label-caps ${result.trafficLight === 'red' ? 'text-error' : result.trafficLight === 'yellow' ? 'text-[#FACC15]' : 'text-primary'}`}>
                        {result.trafficLight === 'red' ? 'CRÍTICO' : result.trafficLight === 'yellow' ? 'ADVERTENCIA' : 'SEGURO'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Findings */}
              <div className="space-y-md">
                <div className="flex items-center justify-between">
                  <h4 className="font-headline-md text-headline-md text-on-surface flex items-center gap-xs">
                    <span className="material-symbols-outlined text-primary" data-icon="rule">rule</span>
                    Hallazgos Encontrados ({result.findings.length})
                  </h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-gutter pb-xl">
                  {result.findings.length === 0 && (
                    <div className="col-span-full py-xl text-center text-on-surface-variant">
                      No se detectaron vulnerabilidades.
                    </div>
                  )}
                  {result.findings.map((finding) => {
                    const styles = getSeverityStyles(finding.severity);
                    return (
                      <div key={finding.id} className="bg-surface-container-low rounded-lg p-sm border border-outline-variant hover:border-primary/40 transition-all flex flex-col justify-between">
                        <div className="flex justify-between items-start mb-md">
                          <div className="p-xs bg-surface-container-highest rounded text-on-surface">
                            <span className="material-symbols-outlined" data-icon={styles.icon}>{styles.icon}</span>
                          </div>
                          <span className={`px-sm py-1 ${styles.bgAlpha} ${styles.text} font-label-caps text-[10px] rounded-full flex items-center gap-xs`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${styles.bg} ${finding.severity === 'high' ? 'animate-pulse' : ''}`}></span>
                            {styles.label}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h5 className="font-headline-md text-body-lg font-bold mb-xs">{finding.owaspId}: {OWASP_TITLE[finding.owaspId]}</h5>
                          <p className="font-body-md text-[13px] text-on-surface-variant mb-md">{finding.title}</p>

                          <div className="bg-background rounded p-sm mt-md border border-outline-variant/30">
                            <p className="font-label-caps text-[10px] text-outline mb-xs">UBICACIÓN & DESCRIPCIÓN</p>
                            <code className="font-code-sm text-[11px] text-on-surface-variant block mb-2">{finding.file}{finding.line ? `:${finding.line}` : ''}</code>
                            <p className="text-[12px] text-on-surface leading-snug">{finding.description}</p>
                          </div>

                          <div className="mt-md">
                            <p className="font-label-caps text-[10px] text-primary mb-xs">CÓMO ARREGLARLO</p>
                            <p className="text-[12px] text-on-surface leading-snug">{finding.fixRecommendation}</p>
                            {finding.safeExample && (
                                <pre className="mt-xs p-xs bg-surface-container-highest rounded overflow-x-auto text-[11px] font-code-sm text-[#a8ffee]">
                                  {finding.safeExample}
                                </pre>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container border-t border-outline-variant flex justify-around items-center px-sm z-50">
          <a className="flex flex-col items-center text-primary" href="#" onClick={(e) => { e.preventDefault(); setResult(null); }}>
            <span className="material-symbols-outlined" data-icon="dashboard">dashboard</span>
            <span className="text-[10px] font-label-caps">Panel</span>
          </a>
          <a className="flex flex-col items-center text-on-surface-variant" href="#">
            <span className="material-symbols-outlined" data-icon="history">history</span>
            <span className="text-[10px] font-label-caps">Historial</span>
          </a>
        </nav>
      </div>

      {/* Visual Polish: Background Aura */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
      <div className="fixed bottom-0 left-64 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full -z-10 pointer-events-none"></div>
    </div>
  );
}
