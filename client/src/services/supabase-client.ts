/**
 * supabase-client.ts
 * Cliente de Supabase para VibeGuard
 * Maneja autenticación y operaciones de base de datos
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

type SupabaseDisabledError = { error: Error; data: null }

function disabledError(): SupabaseDisabledError {
  return { error: new Error("Supabase no está configurado en este entorno."), data: null }
}

function disabledFrom() {
  return {
    async upsert() {
      return disabledError()
    },
    async select() {
      return this
    },
    async single() {
      return disabledError()
    },
    async eq() {
      return this
    },
    async update() {
      return this
    },
    async insert() {
      return disabledError()
    },
    async delete() {
      return this
    },
    async limit() {
      return this
    },
    async order() {
      return this
    },
    async ilike() {
      return this
    },
    async in() {
      return this
    },
    async maybeSingle() {
      return disabledError()
    },
    async then(onFulfilled: (value: SupabaseDisabledError) => unknown) {
      return Promise.resolve(disabledError()).then(onFulfilled)
    },
  }
}

function createDisabledSupabaseClient() {
  const auth = {
    async signInWithPassword() {
      return disabledError()
    },
    async signUp() {
      return disabledError()
    },
    async signInWithOAuth() {
      return disabledError()
    },
    async signOut() {
      return disabledError()
    },
    async getUser() {
      return { data: { user: null }, error: new Error("Supabase no está configurado en este entorno.") }
    },
    async getSession() {
      return { data: { session: null }, error: new Error("Supabase no está configurado en este entorno.") }
    },
    onAuthStateChange() {
      return { data: { subscription: { unsubscribe() {} } } }
    },
  }

  return {
    auth,
    from: disabledFrom,
  } as unknown as SupabaseClient
}

export const supabase: SupabaseClient =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : createDisabledSupabaseClient()

// ==================== TIPOS ====================

export interface SupabaseUser {
  id: string
  email: string
  github_username?: string
  github_id?: number
  avatar_url?: string
  created_at: string
  updated_at: string
  last_login?: string
  is_active: boolean
}

export interface SupabaseAnalisisData {
  usuario_id: string
  pestaña: 'raw' | 'zip' | 'github'
  etiqueta?: string
  puntuacion_riesgo: number
  semaforo: 'red' | 'yellow' | 'green'
  cantidad_hallazgos: number
  utilizo_explicacion_ia: boolean
  archivos_procesados: number
  total_bytes_aprox: number
  truncado: boolean
  advertencias?: string[]
  nombre_archivo_origen?: string
  url_repositorio_origen?: string
  nombre_zip_origen?: string
  created_at: string
  updated_at: string
}

export interface SupabaseAnalysis {
  id: string
  user_id: string
  tab: 'raw' | 'zip' | 'github'
  label?: string
  risk_score: number
  traffic_light: 'red' | 'yellow' | 'green'
  findings_count: number
  used_ai_explanation: boolean
  files_processed: number
  total_bytes_approx: number
  truncated: boolean
  warnings?: string[]
  source_filename?: string
  source_repo_url?: string
  source_zip_name?: string
  created_at: string
  updated_at: string
  findings?: SupabaseFindings[]
}

export interface SupabaseFindings {
  id: string
  analysis_id: string
  rule_id: string
  owasp_id: string
  title: string
  description: string
  severity: 'low' | 'medium' | 'high'
  file_path: string
  line_number?: number
  column_number?: number
  fix_recommendation: string
  safe_example?: string
  educational_what?: string
  educational_why?: string
  educational_impact?: string
  educational_who_affected?: string
  created_at: string
}

// ==================== AUTENTICACIÓN ====================

/**
 * Iniciar sesión con email y contraseña
 */
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })
  if (error) throw error
  return data
}

/**
 * Registrarse con email y contraseña
 */
export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  })
  if (error) throw error
  return data
}

/**
 * Iniciar sesión con GitHub
 */
export async function signInWithGitHub() {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'github',
    options: {
      queryParams: {
        scope: 'read:user user:email repo',
      },
      redirectTo: window.location.origin,
    },
  })
  if (error) throw error
  return data
}

/**
 * Cerrar sesión
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}

/**
 * Obtener usuario actual autenticado
 */
export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()
  if (error) throw error
  return user
}

/**
 * Obtener sesión actual
 */
export async function getCurrentSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession()
  if (error) throw error
  return session
}

/**
 * Escuchar cambios de autenticación
 */
export function onAuthStateChange(callback: (user: any) => void) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user)
  })
}

// ==================== USUARIOS ====================

/**
 * Crear o actualizar perfil de usuario
 */
export async function upsertUserProfile(userId: string, profile: Partial<SupabaseUser>) {
  const { data, error } = await supabase
    .from('usuarios')
    .upsert(
      {
        id: userId,
        ...profile,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'id' }
    )
    .select()
    .single()

  if (error) throw error
  return data
}

/**
 * Obtener perfil del usuario
 */
export async function getUserProfile(userId: string) {
  const { data, error } = await supabase.from('usuarios').select('*').eq('id', userId).single()

  if (error) throw error
  return data as SupabaseUser
}

/**
 * Actualizar último login del usuario
 */
export async function updateLastLogin(userId: string) {
  const { error } = await supabase
    .from('usuarios')
    .update({ last_login: new Date().toISOString() })
    .eq('id', userId)

  if (error) throw error
}

// ==================== ANÁLISIS ====================

/**
 * Guardar un análisis completado
 */
export async function saveAnalysis(
  userId: string,
  analysisData: {
    pestaña: 'raw' | 'zip' | 'github'
    etiqueta?: string
    puntuacion_riesgo: number
    semaforo: 'red' | 'yellow' | 'green'
    hallazgos: any[]
    limites: {
      archivos_procesados: number
      total_bytes_aprox: number
      truncado: boolean
      advertencias: string[]
    }
    utilizo_explicacion_ia: boolean
    nombre_archivo_origen?: string
    url_repositorio_origen?: string
    nombre_zip_origen?: string
  }
) {
  // 1. Insertar análisis
  const { data: analysis, error: analysisError } = await supabase
    .from('analisis')
    .insert({
      usuario_id: userId,
      pestaña: analysisData.pestaña,
      etiqueta: analysisData.etiqueta,
      puntuacion_riesgo: analysisData.puntuacion_riesgo,
      semaforo: analysisData.semaforo,
      cantidad_hallazgos: analysisData.hallazgos.length,
      utilizo_explicacion_ia: analysisData.utilizo_explicacion_ia,
      archivos_procesados: analysisData.limites.archivos_procesados,
      total_bytes_aprox: analysisData.limites.total_bytes_aprox,
      truncado: analysisData.limites.truncado,
      advertencias: analysisData.limites.advertencias,
      nombre_archivo_origen: analysisData.nombre_archivo_origen,
      url_repositorio_origen: analysisData.url_repositorio_origen,
      nombre_zip_origen: analysisData.nombre_zip_origen,
    })
    .select()
    .single()

  if (analysisError) throw analysisError

  // 2. Insertar hallazgos
  if (analysisData.hallazgos.length > 0) {
    const hallazgosData = analysisData.hallazgos.map((f) => ({
      analisis_id: analysis.id,
      id_regla: f.ruleId,
      id_owasp: f.owaspId,
      titulo: f.title,
      descripcion: f.description,
      severidad: f.severity,
      ruta_archivo: f.file,
      numero_linea: f.line || null,
      numero_columna: f.column || null,
      recomendacion_arreglo: f.fixRecommendation,
      ejemplo_seguro: f.safeExample || null,
      educativo_que: f.educational?.what || null,
      educativo_por_que: f.educational?.why || null,
      educativo_impacto: f.educational?.impact || null,
      educativo_afectados: f.educational?.whoAffected || null,
    }))

    const { error: findingsError } = await supabase.from('hallazgos').insert(hallazgosData)

    if (findingsError) throw findingsError
  }

  return analysis
}

/**
 * Obtener análisis del usuario (con paginación)
 */
export async function getUserAnalyses(userId: string, limit = 50, offset = 0) {
  const { data, error, count } = await supabase
    .from('analisis')
    .select('*', { count: 'exact' })
    .eq('usuario_id', userId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) throw error
  return { analyses: data as any[], total: count }
}

/**
 * Obtener análisis específico con sus hallazgos
 */
export async function getAnalysisWithFindings(analysisId: string) {
  const { data, error } = await supabase
    .from('analisis')
    .select('*, hallazgos(*)')
    .eq('id', analysisId)
    .single()

  if (error) throw error
  return data as any
}

/**
 * Eliminar análisis
 */
export async function deleteAnalysis(analysisId: string) {
  const { error } = await supabase.from('analisis').delete().eq('id', analysisId)

  if (error) throw error
}

/**
 * Obtener estadísticas de análisis del usuario
 */
export async function getUserAnalysisStats(userId: string) {
  const { data, error } = await supabase
    .rpc('get_user_analysis_stats', { usuario_id: userId })

  if (error) {
    // Fallback: calcular manualmente
    const { data: analyses } = await supabase
      .from('analisis')
      .select('puntuacion_riesgo, cantidad_hallazgos, created_at')
      .eq('usuario_id', userId)

    if (analyses) {
      return {
        total_analyses: analyses.length,
        avg_risk_score: analyses.reduce((sum, a) => sum + a.puntuacion_riesgo, 0) / analyses.length || 0,
        total_findings: analyses.reduce((sum, a) => sum + a.cantidad_hallazgos, 0),
        last_analysis: analyses[0]?.created_at,
      }
    }
    throw error
  }

  return data
}

// ==================== HALLAZGOS ====================

/**
 * Obtener hallazgos de un análisis
 */
export async function getAnalysisFindings(analysisId: string) {
  const { data, error } = await supabase
    .from('hallazgos')
    .select('*')
    .eq('analisis_id', analysisId)
    .order('severidad', { ascending: false })

  if (error) throw error
  return data as any[]
}

/**
 * Listar repositorios de GitHub usando el token OAuth del usuario
 */
export async function listGithubRepos(token: string) {
  if (!token) throw new Error('Token de GitHub requerido');
  const res = await fetch('https://api.github.com/user/repos?per_page=200', {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`GitHub API responded ${res.status}: ${txt}`);
  }
  return (await res.json()) as any[];
}

/**
 * Obtener hallazgos por severidad
 */
export async function getFindingsBySeverity(userId: string, severity: 'low' | 'medium' | 'high') {
  const { data, error } = await supabase
    .from('hallazgos')
    .select('*')
    .eq('severidad', severity)
    .in(
      'analisis_id',
      (
        await supabase
          .from('analisis')
          .select('id')
          .eq('usuario_id', userId)
      ).data?.map((a) => a.id) || []
    )

  if (error) throw error
  return data as any[]
}

// ==================== AUDITORÍA ====================

/**
 * Registrar evento de auditoría
 */
export async function logAuditEvent(
  userId: string | null,
  action: string,
  resourceType?: string,
  resourceId?: string,
  details?: Record<string, any>
) {
  const { error } = await supabase.from('registros_auditoria').insert({
    usuario_id: userId,
    accion: action,
    tipo_recurso: resourceType,
    id_recurso: resourceId,
    detalles: details || null,
    direccion_ip: null, // Se obtendría del servidor en producción
    agente_usuario: navigator.userAgent,
  })

  if (error) console.error('Error logging audit event:', error)
}

// ==================== REALTIME ====================

/**
 * Escuchar cambios en tiempo real en los análisis del usuario
 */
export function subscribeToUserAnalyses(userId: string, callback: (analyses: any[]) => void) {
  return supabase
    .channel(`analisis:${userId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'analisis',
        filter: `usuario_id=eq.${userId}`,
      },
      () => {
        // Refetch en cambios
        getUserAnalyses(userId).then((result) => callback(result.analyses))
      }
    )
    .subscribe()
}

export default supabase
