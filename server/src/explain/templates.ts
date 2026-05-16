import type { Educational } from "../schemas/findings.js";

const GENERIC: Educational = {
  what: "El analizador encontró un patrón asociado típicamente con riesgos de seguridad cuando se comparte el código tal cual sin revisión humana.",
  why: "La IA y plantillas rápidas suelen copiar credenciales ficticias o prácticas peligrosas “que funcionan en local” pero jamás deberían publicarse.",
  impact: "Los atacantes podrían automatizar búsquedas de estos patrones y obtener acceso temporal a cuentas de pago, infraestructura o datos personales.",
  whoAffected: "Usuarios finales, tus clientes empresariales, el equipo de soporte y tus propias llaves de desarrollador podrían sufrir abuso de recursos o robo de reputación.",
};

export const EDU_TEMPLATES: Record<string, Educational> = {
  SECRET_SENSITIVE_FILENAME: {
    what: "Hay un archivo cuyo nombre sugiere guardar credenciales fuera de un lugar seguro especializado.",
    why: "Las credenciales en carpetas compartidas pueden subirse accidentalmente a chats, repositorios o copias de seguridad no cifradas.",
    impact: "Cualquiera con acceso al proyecto (o con un enlace público) puede reutilizar tus claves antes de que puedas desactivarlas.",
    whoAffected: "Tú, tu equipo DevOps, clientes del servicio y personas cuyos datos se hospedan tras esas llaves.",
  },
  SECRET_AWS_KEY: {
    what: "Hay un texto muy parecido a una llave de AWS (ID de acceso). Confirma manualmente si son datos reales antes de desestimarlo.",
    why: "Crackers buscan exactamente este patrón porque controla recursos en la nube con facturación inmediata.",
    impact: "Se puede encender minería, borrar datos críticos o exfiltrarlos en menos de minutos si la clave es válida.",
    whoAffected: "Finanzas de la empresa y todos los sistemas alojados detrás de esa cuenta en la nube.",
  },
  SECRET_OPENAI_SK: {
    what: "Parece un token de API muy potente dentro del código textual.",
    why: "Quienes lo encuentren pueden consumir tu saldo técnico, entrenamientos o cargar tus cuotas sin permiso.",
    impact: "Gastos sorpresa, pérdida de privacidad de prompts corporativos o bloqueos de proveedor.",
    whoAffected: "El propietario de la cuenta de facturación y los proyectos donde se reusaba ese token.",
  },
  SECRET_GENERIC_API: {
    what: "Un token de desarrollador (GitHub/GitLab u otro) podría haberse copiado al pegar ejemplo de código.",
    why: "Plataforma de desarrollo es blanco habitual: combinación de reputación alta + automatización mal protegida.",
    impact:
      "Incluso permisos de lectura reducidos pueden filtrarnos secreto siguiente (cadena lateral) o ejecutar código en pipelines.",
    whoAffected:
      "Repositorios afectados, issues privados listados y automatizaciones configuradas dentro de ese servicio.",
  },
  SECRET_RSA_BLOCK: {
    what: "Un bloque PEM de clave privada fue detectado dentro de archivos de texto revisados.",
    why: "Esa pieza permite descifrar conexiones o firmar payloads como si fueras tú con privilegio total.",
    impact: "Alguien podría suplantarte en VPN, TLS intermedios o infraestructura interna antes de cerrar Incident Response.",
    whoAffected:
      "Cualquier sistema que dependa de esa infraestructura criptográfica (VPN, bastiones SSH, gateways).",
  },
  DEPS_SUPPLY_CHAIN: {
    what: "Una librería con nombre cercano al popular aparece declarada junto tu aplicación principal.",
    why: "Atacantes publicaron paquetes “casi idénticos” para engañar a build scripts y CI sin supervisión.",
    impact: "El build podría ejecutar scripts maliciosos silenciosos que roban variables de entorno durante `npm install`.",
    whoAffected: "Ingenieros que importan la dependencia y cada entorno productivo que la empaqueta.",
  },
  PATTERN_EVAL_JS: {
    what: "El código intenta ejecutar texto dinámico como si fuera instrucción real del lenguaje.",
    why: "Si una sola cadena proviene de usuario o de un JSON remoto, el atacante puede correr sus propias instrucciones.",
    impact: "Control remoto del servidor o del navegador según el contexto, robo de cookies, lectura de disco o APIs internas.",
    whoAffected: "Visitantes de la web, clientes finales y la reputación de tu dominio en listas de malware.",
  },
  PATTERN_NEW_FUNCTION: {
    what: "Se construyen funciones en tiempo de ejecución a partir de texto plano.",
    why: "Es un atajo que la IA sugiere para “flexibilidad”, pero abre el mismo vector que `eval` en muchos casos.",
    impact: "Ejecución remota de código si el material de entrada no está 100% curado y versionado.",
    whoAffected: "La misma superficie que `eval`: usuarios autenticados y operadores de la app.",
  },
  PATTERN_CHILD_PROCESS_SHELL: {
    what: "El backend prepara órdenes del sistema operativo concatenando textos.",
    why: "Un carácter mal colocado en la entrada del usuario transforma el comando benigno en borrado o exfiltración.",
    impact: "Compromiso del host, pérdida de backups montados como volúmenes o escalada lateral dentro de VPC.",
    whoAffected:
      "Equipo de infraestructura completo porque el shell corriendo seguramente tiene acceso LAN ampliamente abierto legacy.",
  },
  PATTERN_HTML_INJECTION: {
    what: "Se escribe HTML “crudo” en el navegador a partir de variables dinámicas.",
    why: "Navegador confía tu app: si XSS entra desde input, ejecuta Javascript “como usuario logueado”.",
    impact: "Robo de sesión admins, phishing embebido, redireccion malicioso a descargador de ransomware.",
    whoAffected:
      "Cualquier cuenta logueada mientras navega ese componente específico, incluído equipo interno usando admin panel.",
  },
  PATTERN_SQL_CONCAT_POSSIBLE: {
    what: "Se encontró SQL seguido de una plantilla con datos típicamente tomados desde la petición (req/body/etc.).",
    why: "Eso suele aparecer antes de parametrizaciones correctas. Un apóstrofe mal escapado abre vectores conocidos desde hace años.",
    impact: "Fuga GDPR masiva o manipulaciones financieras al descubrir comandos DDL/DML adicionales con la cuenta del servicio.",
    whoAffected:
      "Titulares de datos, auditores, legal y equipo operaciones que enfrentará incident-response multi-día recuperando backups válidos.",
  },
  PATTERN_SQL_PRISMA_RAW_UNSAFE: {
    what: "Se encontró método Prisma explícito para SQL crudo poco supervisado.",
    why: "Generar SQL sin plantillas parametrizadas hace muy fácil que la IA sugiera interpolación textual sin validar tamaño/formato.",
    impact: "Riesgo de lectura/modificación destructiva usando credenciales válidas pero engañadas mediante payload SQL multi-línea.",
    whoAffected: "Todos los registros hospedados bajo ese connection string hasta que se fuerce failover y auditoría diferencial.",
  },
  PATTERN_PYTHON_PICKLE: {
    what: "`pickle` vuelve a construir objetos Python arbitrarios desde bytes externos.",
    why: "Ese proceso puede lanzar código arbitrario durante deserialización sin pop-up de confirmación visible.",
    impact: "Shell remoto en worker de batch o cola de mensajes que procesa jobs subidos por usuario final.",
    whoAffected: "Operaciones que confían en jobs serializados (ETL, ML pipelines, colas admin).",
  },
  PATTERN_PYTHON_YAML_UNSAFE: {
    what: "Se llama `yaml.load` clásico en vez de `safe_load`.",
    why: "YAML puede incrustar tipos que disparan constructores peligrosos si el stream no es 100% confiable.",
    impact: "RCE en servicio de configuración que lee archivos subidos por partner integración externa.",
    whoAffected: "Partners B2B que comparten plantillas `.yml` y cualquier microservicio downstream que confíe ciegamente.",
  },
  PATTERN_COOKIE_HTTPONLY: {
    what: "Se configura una cookie de sesión accesible por Javascript en el cliente.",
    why: "Si otro bug XSS aparece, el script malicioso puede copiar la cookie y reutilizarla fuera del navegador víctima.",
    impact: "Session riding prolongado aunque la víctima cierre tab (depende longitud expiración).",
    whoAffected: "Cuentas de usuarios de la app y administradores con panel expuesto al mismo bundle JS.",
  },
  CONFIG_DOTENV: {
    what: "Archivo `.env` con secretos reales forma parte del material analizado.",
    why: "Es el vector #1 de filtración accidental en vibe coding: “funciona en local” → commit por error.",
    impact: "Acceso pleno a DB productiva, APIs de pago, buckets S3 con dumps personales descargables.",
    whoAffected: "Personal de datos, legal y clientes cuyo PII quedó desprotegido tras robo de credencial DB.",
  },
  CONFIG_CORS_STAR: {
    what: "Se indica `Access-Control-Allow-Origin: *` o equivalente demasiado amplio en backend.",
    why: "Navegador confía la política: dominio malicioso puede disparar peticiones autenticadas si credenciales enabled.",
    impact: "Robo de JSON privado vía browser del usuario engañado con click en link malicioso embutido.",
    whoAffected: "Usuarios logueados y cuentas con cookies de sesión larga (admin + customer).",
  },
  CONFIG_DEBUG_ENABLED: {
    what: "Hay banderas de depuración explícitas en código accesible al build final.",
    why: "Debug verboso expone variables internas y paths de archivos en disk productivo.",
    impact: "Facilita cadena de ataques (path traversal, enumeración servicios escondidos).",
    whoAffected: "Equipo de seguridad que debe triagear incidente y marketing si filtra roadmap interno en error page.",
  },
  CONFIG_PUBLIC_SECRET_NAME: {
    what: "Variables que el navegador puede leer incluyen palabras reservadas de secreto en su nombre mismo.",
    why: "Indica alta probabilidad que se planea exponer secreto verdadero al público sólo porque “NEXT_PUBLIC debe existir”.",
    impact:
      "Cualquier visitante scrapea tus API keys igual que tus archivos `.js` minificados (no hay manera de ocultarlo).",
    whoAffected:
      "Cualquier integración SaaS donde la key permite facturarte o crear recursos externos con tu nombre marca.",
  },
};

export function educationFor(ruleId: string): Educational {
  return EDU_TEMPLATES[ruleId] ?? GENERIC;
}
