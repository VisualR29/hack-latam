/**
 * Base del API sin barra final.
 * En dev dejalo vacío: Vite proxifica /api → 127.0.0.1:8787 (misma origen, sin CORS).
 */
const raw = (import.meta.env.VITE_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

export const API_BASE = raw;

export const ANALYZE_URL = raw ? `${raw}/api/analyze` : "/api/analyze";
