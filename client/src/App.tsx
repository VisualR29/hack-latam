import { FormEvent, useState, useEffect, useRef } from "react";

import {
  AnalysisResultsView,
  type AnalysisResult,
} from "./components/AnalysisResultsView";
import { ANALYZE_URL } from "./config";
import {
  getCurrentSession,
  listGithubRepos,
  signInWithGitHub,
  signOut,
  supabase,
  upsertUserProfile,
  updateLastLogin,
} from "./services/supabase-client";
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
  provider?: string;
  displayName?: string | null;
  avatarUrl?: string | null;
};

type SessionUser = {
  id: string;
  email?: string | null;
  app_metadata?: { provider?: string };
  user_metadata?: Record<string, any>;
};

function LoginForm({
  onLogin,
  onGitHubLogin,
  gitHubLoading,
}: {
  onLogin: (u: User) => void;
  onGitHubLogin: () => Promise<void>;
  gitHubLoading: boolean;
}) {
  const [email, setEmail] = useState("");
  return (
    <div className="space-y-md">
      <button
        type="button"
        onClick={onGitHubLogin}
        disabled={gitHubLoading}
        className="w-full flex items-center justify-center gap-sm bg-surface-container-high border border-outline-variant text-on-surface px-md py-xs rounded font-bold hover:bg-surface-container-highest transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v 3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        {gitHubLoading ? "Conectando..." : "Conectar con GitHub"}
      </button>
      
      <div className="relative flex items-center my-md">
        <div className="flex-grow border-t border-outline-variant"></div>
        <span className="px-sm text-on-surface-variant text-[12px]">o</span>
        <div className="flex-grow border-t border-outline-variant"></div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); if (email.trim()) onLogin({ email: email.trim() }); }} className="space-y-md">
        <div>
          <label className="font-label-caps text-[12px]">Email</label>
          <input className="w-full mt-xs px-sm py-xs rounded border border-outline-variant bg-surface-container-high" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
        </div>
        <div className="flex justify-end">
          <button className="bg-primary text-on-primary px-md py-xs rounded font-bold">Iniciar sesión</button>
        </div>
      </form>
    </div>
  );
}

export default function App() {
  const [tab, setTab] = useState<Tab>("raw");
  const [code, setCode] = useState("");
  const [filename, setFilename] = useState("fragmento.tsx");
  const [repoUrl, setRepoUrl] = useState("");
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [selectedGithubRepo, setSelectedGithubRepo] = useState<string | null>(null);
  const [githubReposLoading, setGithubReposLoading] = useState(false);
  const [githubReposError, setGithubReposError] = useState<string | null>(null);
  const [zipFile, setZipFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  // UI panels & persisted state
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showLogin, setShowLogin] = useState(false);

  // Refs for click-outside handling
  const historyRef = useRef<HTMLDivElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const loginRef = useRef<HTMLDivElement | null>(null);

  const [history, setHistory] = useState<StoredAnalysis[]>([]);
  const [settings, setSettings] = useState<Settings>({ persistHistory: true });
  const [user, setUser] = useState<User | null>(null);
  const [gitHubLoading, setGitHubLoading] = useState(false);
  const [gitHubAccessToken, setGitHubAccessToken] = useState<string | null>(null);
  const [showAccountMenu, setShowAccountMenu] = useState(false);
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
    // apply theme class
    try {
      document.documentElement.classList.toggle('dark', theme === 'dark');
      document.documentElement.classList.toggle('light', theme === 'light');
    } catch (e) {}
  }, []);

  useEffect(() => {
    let active = true;

    async function syncSupabaseUser(sessionUser: SessionUser, providerToken?: string | null) {
      const email = sessionUser.email ?? `${sessionUser.id}@github.local`;
      const githubUsername =
        sessionUser.user_metadata?.user_name ??
        sessionUser.user_metadata?.preferred_username ??
        sessionUser.user_metadata?.name ??
        sessionUser.email?.split('@')[0] ??
        null;
      const avatarUrl = sessionUser.user_metadata?.avatar_url ?? null;

      const nextUser: User = {
        email,
        provider: sessionUser.app_metadata?.provider,
        displayName: githubUsername,
        avatarUrl,
      };

      setUser(nextUser);
      localStorage.setItem('vg_user', JSON.stringify(nextUser));
      setGitHubAccessToken(providerToken ?? null);

      await upsertUserProfile(sessionUser.id, {
        email,
        github_username: githubUsername ?? undefined,
        avatar_url: avatarUrl ?? undefined,
        last_login: new Date().toISOString(),
        is_active: true,
      });
      await updateLastLogin(sessionUser.id);
    }

    async function restoreSession() {
      try {
        const session = await getCurrentSession();
        if (!active || !session?.user) return;

        await syncSupabaseUser(session.user as SessionUser, (session as any)?.provider_token ?? null);
        setShowLogin(false);
      } catch (e) {
        // Si Supabase todavía no está configurado, mantenemos el fallback local.
      }
    }

    void restoreSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_OUT' || !session?.user) {
        setUser(null);
        setGitHubAccessToken(null);
        setShowLogin(false);
        setShowAccountMenu(false);
        try {
          localStorage.removeItem('vg_user');
        } catch (e) {}
        return;
      }
      if (session?.user) {
        void syncSupabaseUser(session.user as SessionUser, (session as any)?.provider_token ?? null)
          .then(() => setShowLogin(false))
          .catch((error) => {
            setError(error instanceof Error ? error.message : 'No se pudo sincronizar el usuario con Supabase.');
          });
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  // Load GitHub repos when switching to github tab and having an access token
  useEffect(() => {
    let mounted = true;
    async function loadRepos() {
      if (!gitHubAccessToken) return;
      try {
        setGithubReposLoading(true);
        setGithubReposError(null);
        const repos = await listGithubRepos(gitHubAccessToken);
        if (!mounted) return;
        setGithubRepos(repos || []);
        setSelectedGithubRepo(null);
      } catch (err) {
        if (!mounted) return;
        setGithubReposError(err instanceof Error ? err.message : 'No se pudieron cargar los repositorios de GitHub.');
        console.error('No se pudieron cargar repositorios de GitHub:', err);
      } finally {
        if (mounted) setGithubReposLoading(false);
      }
    }

    if (tab === 'github' && gitHubAccessToken && githubRepos.length === 0) {
      void loadRepos();
    }

    return () => { mounted = false; };
  }, [tab, gitHubAccessToken, githubRepos.length]);

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
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [showHistory, showSettings, showLogin]);

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

  async function handleGitHubLogin() {
    try {
      setGitHubLoading(true);
      setError(null);
      await signInWithGitHub();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo iniciar sesión con GitHub.');
      setGitHubLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await signOut();
    } finally {
      setUser(null);
      setGitHubAccessToken(null);
      setShowLogin(false);
      setShowAccountMenu(false);
      try {
        localStorage.removeItem('vg_user');
      } catch (e) {}
    }
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
        const targetUrl = repoUrl.trim() || selectedGithubRepo?.trim() || "";
        if (!targetUrl) {
          throw new Error(
            "Seleccioná uno de tus repositorios o pegá la URL de un repo público (https://github.com/usuario/repo).",
          );
        }

        clientLog.debug("analyze.request", "POST github", {
          url: ANALYZE_URL,
          repoUrl: targetUrl.trim(),
          hasGitHubToken: Boolean(gitHubAccessToken),
        });

        response = await fetch(ANALYZE_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode: "github",
            url: targetUrl.trim(),
            githubToken: gitHubAccessToken ?? undefined,
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

      if (payload.categories?.length) {
        for (const cat of payload.categories) {
          cat.findings.sort((a, b) => {
            const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
            return order[a.severity] - order[b.severity] || a.title.localeCompare(b.title, "es");
          });
        }
      }

      clientLog.info("analyze.success", "Análisis recibido", {
        ms: elapsed(),
        findings: payload.findings.length,
        categories: payload.categories?.length ?? 0,
        secureScore: payload.secureScore,
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
          label: tab === 'raw' ? filename : tab === 'github' ? (selectedGithubRepo ?? repoUrl) : zipFile?.name,
        };
        setHistory((prev) => {
          const next = [item, ...prev].slice(0, 50);
          if (settings.persistHistory) localStorage.setItem('vg_history', JSON.stringify(next));
          return next;
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
        <div className="mt-auto px-xs pt-md border-t border-outline-variant">
          <div className="flex items-center gap-sm">
            <div className="w-9 h-9 rounded-full bg-surface-variant flex items-center justify-center overflow-hidden border border-outline-variant shrink-0">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt={user.displayName ?? user.email} className="w-full h-full object-cover" />
              ) : (
                <span className="material-symbols-outlined text-outline">person</span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <span className="font-label-caps text-[11px] text-on-surface">{user ? "Sesión activa" : "Sesión no iniciada"}</span>
              <span className="font-body-md text-[12px] text-on-surface-variant truncate">
                {user ? (user.displayName ?? user.email) : "Iniciá sesión para conectar repos"}
              </span>
              {user?.provider && <span className="text-[11px] text-on-surface-variant/80">{user.provider}</span>}
            </div>
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
              <button data-no-close onClick={() => setShowSettings(true)} className="material-symbols-outlined text-on-surface hover:text-primary transition-colors scale-95 active:scale-90" data-icon="settings">settings</button>
            </div>
            <div className="relative hidden md:block">
              <button
                data-no-close
                className="w-8 h-8 rounded-full bg-surface-variant border border-outline-variant overflow-hidden flex items-center justify-center"
                onClick={() => (user ? setShowAccountMenu((value) => !value) : setShowLogin(true))}
              >
                {user?.avatarUrl ? (
                  <img src={user.avatarUrl} alt={user.displayName ?? user.email} className="w-full h-full object-cover" />
                ) : (
                  <span className="material-symbols-outlined text-outline">{user ? "account_circle" : "person"}</span>
                )}
              </button>

              {user && showAccountMenu && (
                <div data-no-close className="absolute right-0 mt-sm w-64 rounded-lg border border-outline-variant bg-surface-container shadow-lg p-sm z-60">
                  <div className="flex items-center gap-sm pb-sm border-b border-outline-variant">
                    <div className="w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center overflow-hidden border border-outline-variant shrink-0">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.displayName ?? user.email} className="w-full h-full object-cover" />
                      ) : (
                        <span className="material-symbols-outlined text-outline">person</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-label-caps text-[11px] text-on-surface">{user.displayName ?? "Cuenta conectada"}</div>
                      <div className="text-[12px] text-on-surface-variant truncate">{user.email}</div>
                    </div>
                  </div>
                  <div className="pt-sm flex items-center justify-between gap-sm">
                    <span className="text-[12px] text-on-surface-variant">{user.provider ? `Proveedor: ${user.provider}` : "Sesión local"}</span>
                    <button className="text-[12px] font-bold text-error" onClick={handleSignOut}>Salir</button>
                  </div>
                </div>
              )}
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
                      {gitHubAccessToken && (
                        <div className="space-y-xs">
                          <label className="block font-label-caps text-[11px] text-on-surface-variant">
                            Mis repositorios
                          </label>
                          {githubReposLoading ? (
                            <div className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-md py-sm text-on-surface-variant">
                              Cargando repositorios de GitHub...
                            </div>
                          ) : githubRepos.length > 0 ? (
                            <select
                              className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-md py-sm font-code-sm text-code-sm text-on-surface focus:outline-none focus:border-primary"
                              value={selectedGithubRepo ?? ""}
                              onChange={(e) => {
                                const value = e.target.value;
                                setSelectedGithubRepo(value || null);
                                if (value) setRepoUrl("");
                              }}
                            >
                              <option value="">— Elegí uno de tus repos —</option>
                              {githubRepos.map((r) => (
                                <option
                                  key={r.id}
                                  value={
                                    r.html_url ??
                                    (r.full_name ? `https://github.com/${r.full_name}` : r.url)
                                  }
                                >
                                  {r.full_name ?? r.name}
                                </option>
                              ))}
                            </select>
                          ) : !githubReposError ? (
                            <p className="text-[12px] text-on-surface-variant">
                              No se listaron repos en tu cuenta. Usá la URL de abajo.
                            </p>
                          ) : null}
                        </div>
                      )}

                      <div className="space-y-xs">
                        <label className="block font-label-caps text-[11px] text-on-surface-variant">
                          {gitHubAccessToken ? "O URL de cualquier repositorio" : "URL del repositorio"}
                        </label>
                        <input
                          className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-md py-sm font-code-sm text-code-sm text-on-surface focus:outline-none focus:border-primary"
                          placeholder="https://github.com/usuario/repositorio"
                          type="url"
                          value={repoUrl}
                          onChange={(e) => setRepoUrl(e.target.value)}
                        />
                      </div>

                      {githubReposError && (
                        <p className="text-[12px] text-error">{githubReposError}</p>
                      )}
                      <p className="font-body-md text-[12px] text-on-surface-variant italic leading-relaxed">
                        {gitHubAccessToken
                          ? "Con sesión de GitHub podés elegir tus repos (incluidos privados) o pegar la URL de un repo público ajeno."
                          : "Pegá la URL de un repositorio público. Conectate con GitHub para analizar también tus repos privados."}
                      </p>
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
                      <div className="text-[13px] text-on-surface-variant">{new Date(h.timestamp).toLocaleString()} — seguridad {h.secureScore ?? 100 - h.riskScore}/100</div>
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
            <LoginForm
              onLogin={(u) => { setUser(u); localStorage.setItem('vg_user', JSON.stringify(u)); setShowLogin(false); }}
              onGitHubLogin={handleGitHubLogin}
              gitHubLoading={gitHubLoading}
            />
          </div>
        </div>
      )}

      {/* Visual Polish: Background Aura */}
      <div className="fixed top-0 right-0 w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full -z-10 pointer-events-none"></div>
      <div className="fixed bottom-0 left-64 w-[400px] h-[400px] bg-primary/5 blur-[100px] rounded-full -z-10 pointer-events-none"></div>
    </div>
  );
}
