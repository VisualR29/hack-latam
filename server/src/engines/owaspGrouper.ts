import type { Finding, GroupedCategory, OwaspId, Severity } from "../schemas/findings.js";

/**
 * Metadatos de las categorías OWASP Top 10 (2021).
 * Nombre y descripción amigable para usuarios no técnicos.
 */
const OWASP_META: Record<OwaspId, { name: string; description: string }> = {
  A01: {
    name: "Control de Acceso Roto",
    description:
      "Tu aplicación permite que personas sin permiso accedan a cosas que no deberían ver o hacer, como ver datos de otros usuarios o usar funciones de administrador.",
  },
  A02: {
    name: "Fallas Criptográficas",
    description:
      "Tu código expone contraseñas, llaves de API o datos sensibles sin protección. Es como dejar las llaves de tu casa pegadas en la puerta.",
  },
  A03: {
    name: "Inyección",
    description:
      "Tu aplicación acepta datos de usuarios y los usa directamente en comandos o consultas sin verificarlos. Un atacante puede meter código malicioso para robar o borrar información.",
  },
  A04: {
    name: "Diseño Inseguro",
    description:
      "La configuración de seguridad de tu app está mal o le faltan protecciones básicas como CORS, headers de seguridad o cookies seguras.",
  },
  A05: {
    name: "Configuración de Seguridad Incorrecta",
    description:
      "Tu aplicación usa prácticas peligrosas como ejecutar código dinámico (eval), versiones sin fijar de dependencias, o scripts de instalación sospechosos.",
  },
  A06: {
    name: "Componentes Vulnerables",
    description:
      "Tu proyecto usa librerías o paquetes que tienen vulnerabilidades conocidas, nombres sospechosos o que fueron comprometidos anteriormente.",
  },
  A07: {
    name: "Fallas de Autenticación",
    description:
      "El sistema de login y sesiones de tu app tiene debilidades: contraseñas débiles, tokens predecibles, falta de expiración o protección contra fuerza bruta.",
  },
  A08: {
    name: "Fallas de Integridad de Datos",
    description:
      "Tu código carga datos externos sin verificar que no fueron modificados. Esto incluye deserialización insegura (pickle, yaml.load, etc).",
  },
  A09: {
    name: "Fallas de Registro y Monitoreo",
    description:
      "Tu app no registra eventos importantes (logins, errores), usa console.log en vez de un logger profesional, o peor: loguea contraseñas y tokens.",
  },
  A10: {
    name: "Falsificación de Solicitudes del Servidor (SSRF)",
    description:
      "Tu app permite que un atacante haga que tu servidor haga peticiones a sitios internos o servicios privados, exponiendo datos de infraestructura.",
  },
};

/**
 * Agrupa un arreglo plano de findings en categorías OWASP.
 * Solo incluye categorías que tienen al menos un finding.
 * Las categorías se ordenan por severidad (peores primero) y luego por cantidad.
 */
export function groupFindingsByOwasp(findings: Finding[]): GroupedCategory[] {
  const byOwasp = new Map<OwaspId, Finding[]>();

  for (const f of findings) {
    const existing = byOwasp.get(f.owaspId) ?? [];
    existing.push(f);
    byOwasp.set(f.owaspId, existing);
  }

  const categories: GroupedCategory[] = [];

  for (const [owaspId, owaspFindings] of byOwasp.entries()) {
    const meta = OWASP_META[owaspId] ?? {
      name: `OWASP ${owaspId}`,
      description: "Categoría de seguridad detectada.",
    };

    const severitySummary = { high: 0, medium: 0, low: 0 };
    for (const f of owaspFindings) {
      severitySummary[f.severity]++;
    }

    const worstSeverity: Severity =
      severitySummary.high > 0
        ? "high"
        : severitySummary.medium > 0
          ? "medium"
          : "low";

    // Ordenar findings dentro de categoría: high > medium > low
    owaspFindings.sort((a, b) => {
      const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
      return order[a.severity] - order[b.severity];
    });

    categories.push({
      owaspId,
      name: meta.name,
      description: meta.description,
      count: owaspFindings.length,
      severitySummary,
      worstSeverity,
      findings: owaspFindings,
    });
  }

  // Ordenar categorías: peor severidad primero, luego por cantidad descendente
  categories.sort((a, b) => {
    const order: Record<Severity, number> = { high: 0, medium: 1, low: 2 };
    const sevDiff = order[a.worstSeverity] - order[b.worstSeverity];
    if (sevDiff !== 0) return sevDiff;
    return b.count - a.count;
  });

  return categories;
}
