import type { GroupedCategory } from "../schemas/findings.js";

export function generateMarkdownReport(categories: GroupedCategory[]): string {
  let md = `# INSTRUCCIONES DE OPTIMIZACIÓN Y REFACTORIZACIÓN DE SEGURIDAD

## Contexto del Sistema
Eres un ingeniero experto en ciberseguridad y refactorización automatizada de código. A continuación se te presenta un reporte de vulnerabilidades estáticas detectadas en el proyecto de código fuente adjunto.

## Tareas Requeridas para la IA
1. **Analizar:** Examina iterativamente cada una de las vulnerabilidades listadas en la sección 'Reporte de Hallazgos'. El reporte está pre-ordenado por nivel de severidad crítica.
2. **Localizar:** Utiliza los parámetros de \`Archivo\` y \`Línea\` para ubicar el contexto exacto del error en el código fuente proporcionado.
3. **Evaluar y Corregir:** Realiza una segunda validación sobre la factibilidad e impacto real de cada hallazgo. Si determinas que la vulnerabilidad representa un riesgo crítico o importante para el sistema, procede a corregirla sin romper la lógica de negocio. Si consideras que el hallazgo es un falso positivo, un riesgo aceptable, o su corrección no es viable en el contexto dado, omite la refactorización.
4. **Formato de Salida:** Devuelve las correcciones estructuradas por archivo modificado, indicando claramente el bloque de código original (Inseguro) y el bloque de código de reemplazo (Seguro).

## REPORTE DE HALLAZGOS (VULNERABILIDADES)
`;

  if (categories.length === 0) {
    md += `\n*¡Felicidades! No se encontraron vulnerabilidades en este análisis.*\n`;
    return md;
  }

  for (const cat of categories) {
    md += `\n### Categoría OWASP: ${cat.owaspId} - ${cat.name}\n`;
    md += `Descripción: ${cat.description}\n`;
    md += `Severidad Máxima en Categoría: \`${cat.worstSeverity.toUpperCase()}\`\n\n`;

    for (const f of cat.findings) {
      md += `#### [${f.severity.toUpperCase()}] ${f.title}\n`;
      md += `- **ID de Regla:** \`${f.ruleId}\`\n`;
      md += `- **OWASP ID:** ${f.owaspId}\n`;
      md += `- **Archivo Afectado:** \`${f.file}\`\n`;
      if (f.line !== undefined) {
        md += `- **Línea:** ${f.line}\n`;
      }
      md += `- **Descripción del Riesgo:** ${f.description}\n\n`;
    }
  }

  return md;
}
