# Guía para Frontend: Botón de Exportar Reporte para IA

Esta guía explica cómo implementar el botón para que el usuario pueda descargar el reporte de vulnerabilidades en formato Markdown (`.md`), listo para enviarlo a un LLM (ChatGPT, Claude, etc.) para que le ayude a corregir su código.

---

## 1. ¿Qué envía el Backend?

A partir de ahora, cuando haces una petición exitosa a `/api/analyze`, la respuesta JSON incluye un nuevo campo llamado `markdownReport`.

Este campo contiene un `string` gigante que ya viene pre-formateado con:
- Las instrucciones obligatorias ("Contexto del Sistema" y "Tareas Requeridas para la IA").
- Todo el listado de vulnerabilidades encontradas estructurado en Markdown.

**Ejemplo de la respuesta del backend:**
```json
{
  "secureScore": 25,
  "trafficLight": "red",
  "categories": [ ... ],
  "findings": [ ... ],
  "limits": { ... },
  "usedAiExplanation": false,
  "markdownReport": "# INSTRUCCIONES DE OPTIMIZACIÓN Y REFACTORIZACIÓN DE SEGURIDAD\n\n## Contexto del Sistema\nEres un ingeniero experto en ciberseguridad...\n\n### Categoría OWASP: A07 - Fallas de Autenticación\n..."
}
```

---

## 2. Cómo crear el botón de descarga en React

Dado que el backend ya te manda todo el texto listo en `result.markdownReport`, no necesitas hacer una nueva petición para descargar el archivo. Puedes generar el archivo de texto "al vuelo" (en el propio navegador) usando un `Blob` y forzar la descarga.

Aquí tienes un componente de ejemplo funcional que puedes usar:

```tsx
import React from 'react';

// Asumiendo que recibes el resultado del análisis como prop
export default function ExportReportButton({ result }) {
  
  const handleDownload = () => {
    // 1. Extraer el reporte en markdown de la respuesta de la API
    const reportContent = result.markdownReport;

    // Si por alguna razón no existe (aunque siempre debería venir), detenemos la función
    if (!reportContent) return;

    // 2. Crear un Blob (un archivo virtual en la memoria del navegador)
    const blob = new Blob([reportContent], { type: 'text/markdown;charset=utf-8' });

    // 3. Crear una URL temporal que apunte a ese Blob
    const url = URL.createObjectURL(blob);

    // 4. Crear un elemento <a> invisible para forzar la descarga
    const link = document.createElement('a');
    link.href = url;
    
    // Asignar el nombre del archivo que se descargará
    link.setAttribute('download', 'VibeGuard_Security_Report.md');
    
    // Añadirlo al documento, hacer click y luego limpiarlo
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Liberar la memoria de la URL temporal
    URL.revokeObjectURL(url);
  };

  return (
    <button 
      onClick={handleDownload}
      className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded inline-flex items-center"
    >
      <svg className="fill-current w-4 h-4 mr-2" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20">
        <path d="M13 8V2H7v6H2l8 8 8-8h-5zM0 18h20v2H0v-2z"/>
      </svg>
      <span>Exportar Reporte para IA (.md)</span>
    </button>
  );
}
```

### ¿Qué hace este código paso a paso?
1. Toma el `string` que está en `result.markdownReport`.
2. Lo convierte en un objeto `Blob` con tipo MIME `text/markdown`.
3. Usa `URL.createObjectURL` para generar un enlace temporal de descarga en el navegador.
4. Crea una etiqueta `<a>` invisible, le pone el atributo `download` con el nombre de archivo sugerido (`VibeGuard_Security_Report.md`) y simula un "clic" para iniciar la descarga.
5. Limpia la basura (remueve el elemento y revoca la URL).

¡Y listo! Con eso tu usuario obtendrá el archivo y podrá subirlo a cualquier LLM para que analice las instrucciones prefabricadas y el listado de errores.
