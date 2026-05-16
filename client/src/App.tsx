import { FormEvent, useState, useEffect, useRef } from "react";

import {
  AnalysisResultsView,
  type AnalysisResult,
} from "./components/AnalysisResultsView";
import { ANALYZE_URL } from "./config";
import { clientLog, clientTimer } from "./util/logger";
import type { Severity } from "./components/FindingCard";
type Tab = "raw" | "zip" | "github";

type StoredAnalysis = AnalysisResult & {
  id: string;
  timestamp: number;
  tab: Tab;
  label?: string;
};

type Settings = {
  persistHistory: boolean;
};

type User = {
  email: string;
};

type Notification = {
  id: string;
  title: string;
  body?: string;
  ts: number;
};

function LoginForm({ onLogin }: { onLogin: (u: User) => void }) {
  const [email, setEmail] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (email.trim()) onLogin({ email: email.trim() }); }} className="space-y-md">
      <div>
        <label className="font-label-caps text-[12px]">Email</label>
        <input className="w-full mt-xs px-sm py-xs rounded border border-outline-variant bg-surface-container-high" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
      </div>
      <div className="flex justify-end">
        <button className="bg-primary text-on-primary px-md py-xs rounded font-bold">Iniciar sesión</button>
      </div>
    </form>
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

  // UI panels & persisted state
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  // Refs for click-outside handling
  const historyRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const loginRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  const [history, setHistory] = useState<StoredAnalysis[]>([]);
  const [settings, setSettings] = useState<Settings>({ persistHistory: true });
  const [user, setUser] = useState<User | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('vg_theme');
      if (saved === 'light' || saved === 'dark') return saved;
      if (typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    } catch (e) {}
    return 'dark';
  });
  const [linesArray, setLinesArray] = useState([1]);

  useEffect(() => {
    const lines = code.split("\n").length;
    if (lines !== linesArray.length) {
      setLinesArray(Array.from({ length: Math.max(12, lines) }, (_, i) => i + 1));
    }
  }, [code, linesArray.length]);

  // Load persisted UI state
  useEffect(() => {
    try {
      const raw = localStorage.getItem('vg_history');
      if (raw) setHistory(JSON.parse(raw));
    } catch (e) {
      // ignore
    }
    try {
      const raw = localStorage.getItem('vg_settings');
      if (raw) setSettings(JSON.parse(raw));
    } catch (e) {}
    try {
      const raw = localStorage.getItem('vg_user');
      if (raw) setUser(JSON.parse(raw));
    } catch (e) {}
    try {
      const raw = localStorage.getItem('vg_notifications');
      if (raw) setNotifications(JSON.parse(raw));
    } catch (e) {}
    // apply theme class
    try {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.classList.toggle('light', theme === 'light');
    } catch (e) {}
  }, []);

  // Close panels when clicking outside them
  useEffect(() => {
    function onDocClick(e: MouseEvent) {
      const target = e.target as Node | null;
      if (!target) return;

      // If clicked an element marked to ignore closing, skip
      if ((target as HTMLElement).closest('[data-no-close]')) return;

      if (showHistory && historyRef.current && !historyRef.current.contains(target)) {
        setShowHistory(false);
      }
      if (showSettings && settingsRef.current && !settingsRef.current.contains(target)) {
        setShowSettings(false);
      }
      if (showLogin && loginRef.current && !loginRef.current.contains(target)) {
        setShowLogin(false);
      }
      if (showNotifications && notificationsRef.current && !notificationsRef.current.contains(target)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showHistory, showSettings, showLogin, showNotifications]);

  useEffect(() => {
    try {
      localStorage.setItem('vg_theme', theme);
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.classList.toggle('light', theme === 'light');
    } catch (e) {}
  }, [theme]);

  function toggleTheme() {
    setTheme((t) => (t === 'dark' ? 'light' : 'dark'));
  }

  async function onSubmit(event?: FormEvent) {
    if (event) event.preventDefault();
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
      // Guardar en historial local y crear notificación
      try {
        const item: StoredAnalysis = {
          ...payload,
          id: String(Date.now()),
          timestamp: Date.now(),
          tab,
          label: tab === 'raw' ? filename : tab === 'github' ? repoUrl : zipFile?.name,
        };
        setHistory((prev) => {
          const next = [item, ...prev].slice(0, 50);
          if (settings.persistHistory) localStorage.setItem('vg_history', JSON.stringify(next));
          return next;
        });

        const note: Notification = { id: String(Date.now() + 1), title: `Análisis completado — ${payload.riskScore}%`, ts: Date.now(), body: `${payload.findings.length} hallazgos` };
        setNotifications((prev) => {
          const n = [note, ...prev].slice(0, 50);
          localStorage.setItem('vg_notifications', JSON.stringify(n));
          return n;
        });
      } catch (e) {
        // ignore
      }
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
            onClick={(e) => { e.preventDefault(); setShowHistory(true); }}
            data-no-close
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
            <span className="font-body-md text-[12px] text-on-surface-variant">{user?.email ?? "security@vibeguard.io"}</span>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 md:ml-64 flex flex-col min-h-screen">
        {/* Top Navbar */}
        <header className="flex justify-between items-center h-16 px-margin-mobile md:px-margin-desktop bg-surface border-b border-outline-variant sticky top-0 z-40">
          <div className="flex items-center gap-md">
            <span className="font-headline-md text-headline-md font-bold text-primary md:hidden">VG</span>
            <span className="font-headline-md text-headline-md font-bold text-on-surface hidden md:block">
              {result ? "Tu informe de seguridad" : "Nuevo análisis"}
            </span>
          </div>
          <div className="flex items-center gap-lg">
            <div className="flex items-center gap-md">
              <button data-no-close onClick={toggleTheme} title={theme === 'dark' ? 'Cambiar a claro' : 'Cambiar a oscuro'} className="material-symbols-outlined text-on-surface hover:text-primary transition-colors scale-95 active:scale-90">
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </button>
              <button data-no-close onClick={() => setShowNotifications((s) => !s)} className="material-symbols-outlined text-on-surface hover:text-primary transition-colors scale-95 active:scale-90" data-icon="notifications">notifications</button>
              <button data-no-close onClick={() => setShowSettings(true)} className="material-symbols-outlined text-on-surface hover:text-primary transition-colors scale-95 active:scale-90" data-icon="settings">settings</button>
            </div>
            <div className="w-8 h-8 rounded-full bg-surface-variant border border-outline-variant overflow-hidden hidden md:block">
              <button data-no-close className="w-full h-full flex items-center justify-center" onClick={() => setShowLogin(true)}>
                <span className="material-symbols-outlined text-outline">person</span>
              </button>
            </div>
          </div>
        </header>

        {/* Main Content Canvas */}
        <main className="flex-1 min-w-0 w-full p-margin-mobile md:p-margin-desktop flex flex-col bg-background">
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
            <AnalysisResultsView
              result={result}
              onNewAnalysis={() => setResult(null)}
            />
          )}
        </main>

        <nav className="md:hidden fixed bottom-0 left-0 right-0 h-16 bg-surface-container border-t border-outline-variant flex justify-around items-center px-sm z-50">
          <a className="flex flex-col items-center text-primary" href="#" onClick={(e) => { e.preventDefault(); setResult(null); }}>
            <span className="material-symbols-outlined" data-icon="dashboard">dashboard</span>
            <span className="text-[10px] font-label-caps">Panel</span>
          </a>
          <a data-no-close className="flex flex-col items-center text-on-surface-variant" href="#" onClick={(e) => { e.preventDefault(); setShowHistory(true); }}>
            <span className="material-symbols-outlined" data-icon="history">history</span>
            <span className="text-[10px] font-label-caps">Historial</span>
          </a>
        </nav>
      </div>

      {/* Panels: History, Settings, Login, Notifications */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/40 z-60 flex" onClick={() => setShowHistory(false)}>
          <div ref={historyRef} className="ml-auto w-96 min-w-[320px] h-full bg-surface-container p-md overflow-y-auto border-l border-outline-variant" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-md">
              <h3 className="font-headline-md">Historial</h3>
              <div className="flex items-center gap-sm">
                <button className="text-on-surface-variant" onClick={() => { setHistory([]); localStorage.removeItem('vg_history'); }}>Limpiar</button>
                <button className="text-primary font-bold" onClick={() => setShowHistory(false)}>Cerrar</button>
              </div>
            </div>
            {history.length === 0 ? (
              <p className="text-on-surface-variant">Aún no hay análisis en el historial.</p>
            ) : (
              <div className="space-y-sm">
                {history.map((h) => (
                  <button key={h.id} className="w-full text-left p-sm rounded hover:bg-surface-container-high border border-outline-variant flex items-center justify-between" onClick={() => { setResult(h); setShowHistory(false); }}>
                    <div>
                      <div className="font-label-caps text-[12px]">{h.label ?? h.tab}</div>
                      <div className="text-[13px] text-on-surface-variant">{new Date(h.timestamp).toLocaleString()} — {h.riskScore}%</div>
                    </div>
                    <div className="text-[12px] font-label-caps text-on-surface-variant">{h.findings.length} hallazgos</div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {showSettings && (
        <div className="fixed inset-0 bg-black/40 z-60 flex items-center justify-center" onClick={() => setShowSettings(false)}>
          <div ref={settingsRef} className="w-full max-w-lg min-w-[420px] bg-surface-container p-lg rounded shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-md">
              <h3 className="font-headline-md">Ajustes</h3>
              <button className="text-on-surface-variant" onClick={() => setShowSettings(false)}>Cerrar</button>
            </div>
            <div className="space-y-md">
              <div className="flex items-start gap-md">
                <div className="flex-1 min-w-0">
                  <div className="font-label-caps text-[12px]">Guardar historial</div>
                  <div className="text-[13px] text-on-surface-variant truncate">Guarda los resultados en el dispositivo</div>
                </div>
                <div className="flex items-center">
                  <label className="inline-flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.persistHistory}
                      onChange={(e) => { const s = { ...settings, persistHistory: e.target.checked }; setSettings(s); localStorage.setItem('vg_settings', JSON.stringify(s)); }}
                      className="w-5 h-5 rounded border border-outline-variant bg-surface-container-high"
                    />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLogin && (
        <div className="fixed inset-0 bg-black/40 z-60 flex items-center justify-center" onClick={() => setShowLogin(false)}>
          <div ref={loginRef} className="w-full max-w-sm min-w-[360px] bg-surface-container p-lg rounded shadow-lg" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-md">
              <h3 className="font-headline-md">Iniciar Sesión</h3>
              <button className="text-on-surface-variant" onClick={() => setShowLogin(false)}>Cerrar</button>
            </div>
            <LoginForm onLogin={(u) => { setUser(u); localStorage.setItem('vg_user', JSON.stringify(u)); setShowLogin(false); }} />
          </div>
        </div>
      )}

      {showNotifications && (
        <div ref={notificationsRef} className="fixed right-4 top-16 w-80 bg-surface-container p-sm rounded border border-outline-variant shadow-lg z-60">
          <div className="flex items-center justify-between mb-xs">
            <div className="font-label-caps text-[12px]">Notificaciones</div>
            <button className="text-on-surface-variant text-[12px]" onClick={() => { setNotifications([]); localStorage.removeItem('vg_notifications'); }}>Limpiar</button>
          </div>
          <div className="space-y-xs max-h-64 overflow-y-auto">
            {notifications.length === 0 && <div className="text-on-surface-variant">No hay notificaciones.</div>}
            {notifications.map(n => (
              <div key={n.id} className="p-xs rounded hover:bg-surface-container-high border border-outline-variant">
                <div className="font-body-md">{n.title}</div>
                <div className="text-[12px] text-on-surface-variant">{n.body}</div>
                <div className="text-[11px] text-on-surface-variant mt-xs">{new Date(n.ts).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visual Polish: Background Aura */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
      <div className="fixed bottom-0 left-64 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full -z-10 pointer-events-none"></div>
    </div>
  );
}
