# 🛡️ VibeGuard API — Guía para Frontend

## ¿Cómo funciona?

El frontend hace un **POST** a `/api/analyze` con el código del usuario, y el backend regresa un JSON con todo el análisis de seguridad ya procesado y listo para mostrar.

---

## Endpoint

```
POST http://localhost:8787/api/analyze
```

### 3 formas de enviar código:

**1. Código pegado (raw)**
```js
const response = await fetch("http://localhost:8787/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    mode: "raw",
    code: "const q = `SELECT * FROM users WHERE id = ${req.params.id}`",
    filename: "app.js"  // opcional
  })
});
const data = await response.json();
```

**2. Archivo ZIP**
```js
const form = new FormData();
form.append("file", zipFile); // archivo File del input type="file"

const response = await fetch("http://localhost:8787/api/analyze", {
  method: "POST",
  body: form
});
const data = await response.json();
```

**3. Repositorio GitHub**
```js
const response = await fetch("http://localhost:8787/api/analyze", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    mode: "github",
    url: "https://github.com/usuario/repo"
  })
});
const data = await response.json();
```

---

## Respuesta de la API

La API regresa **un solo objeto JSON** con esta estructura:

```json
{
  "riskScore": 100,
  "trafficLight": "red",
  "categories": [ ... ],
  "findings": [ ... ],
  "limits": { ... },
  "usedAiExplanation": false
}
```

### Campos principales

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `riskScore` | `number` (0-100) | Puntuación de riesgo. 0 = seguro, 100 = muy peligroso |
| `trafficLight` | `"green"` \| `"yellow"` \| `"red"` | El semáforo: verde (≤28), amarillo (≤62), rojo (>62) |
| `categories` | `array` | **⭐ NUEVO** — Vulnerabilidades agrupadas por tipo OWASP. Esto es lo que deben usar para el desplegable |
| `findings` | `array` | Lista plana de TODAS las vulnerabilidades individuales (por si lo necesitan) |
| `limits` | `object` | Info sobre cuántos archivos se procesaron |
| `usedAiExplanation` | `boolean` | Si OpenAI enriqueció las explicaciones o no |

---

## ⭐ `categories` — Lo principal para el frontend

Este es el campo que deben usar para la vista de "desplegables". En vez de mostrar 63 vulnerabilidades sueltas, se muestran **máximo 10 categorías** (una por cada OWASP Top 10), y dentro de cada una están las vulnerabilidades específicas.

### Estructura de cada categoría:

```json
{
  "owaspId": "A07",
  "name": "Fallas de Autenticación",
  "description": "El sistema de login y sesiones de tu app tiene debilidades: contraseñas débiles, tokens predecibles, falta de expiración o protección contra fuerza bruta.",
  "count": 13,
  "severitySummary": {
    "high": 6,
    "medium": 7,
    "low": 0
  },
  "worstSeverity": "high",
  "findings": [
    { ... },
    { ... }
  ]
}
```

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `owaspId` | `string` | ID de la categoría OWASP (A01 a A10) |
| `name` | `string` | Nombre amigable en español (ej: "Fallas de Autenticación") |
| `description` | `string` | Explicación en español para gente no técnica |
| `count` | `number` | Cuántas vulnerabilidades hay en esta categoría |
| `severitySummary` | `object` | Desglose: cuántas son high, medium y low |
| `worstSeverity` | `"high"` \| `"medium"` \| `"low"` | La peor severidad encontrada en esta categoría |
| `findings` | `array` | Las vulnerabilidades individuales (para el desplegable) |

> [!IMPORTANT]
> Las categorías ya vienen **ordenadas por peligro** — las más graves primero. Y si una categoría OWASP no tiene vulnerabilidades, **no aparece** en el array.

---

## Estructura de cada `finding` (vulnerabilidad individual)

Cada finding dentro de `categories[n].findings` tiene:

```json
{
  "id": "a1b2c3d4",
  "ruleId": "AUTHFAIL_JWT_NO_EXPIRATION",
  "title": "JWT sin tiempo de expiración",
  "severity": "high",
  "owaspId": "A07",
  "file": "src/auth/login.js",
  "line": 42,
  "column": 10,
  "description": "JWT emitido sin campo 'exp' (expiration). Token válido indefinidamente.",
  "fixRecommendation": "Agrega expiresIn al sign: jwt.sign(payload, secret, { expiresIn: '1h' }).",
  "safeExample": "jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '1h' })",
  "educational": {
    "what": "JWT emitido sin campo 'exp' (expiration).",
    "why": "Token válido indefinidamente. Si leaked, acceso perpetuo.",
    "impact": "Token stolen = acceso no limitado en tiempo.",
    "whoAffected": "Cualquier JWT en circulación; riesgo long-lived."
  }
}
```

| Campo | Tipo | Para qué |
|-------|------|----------|
| `id` | `string` | ID único del hallazgo (para keys de React) |
| `title` | `string` | Título corto para mostrar |
| `severity` | `"high"` \| `"medium"` \| `"low"` | Color/icono del badge |
| `file` | `string` | En qué archivo se encontró |
| `line` | `number?` | Línea exacta (puede ser undefined) |
| `description` | `string` | Qué se encontró |
| `fixRecommendation` | `string` | Cómo arreglarlo |
| `safeExample` | `string?` | Código de ejemplo seguro (opcional) |
| `educational` | `object?` | Explicación educativa con 4 campos (what, why, impact, whoAffected) |

---

## Ejemplo completo de respuesta real

Así se ve una respuesta real cuando se escanea código inseguro:

```json
{
  "riskScore": 100,
  "trafficLight": "red",
  "categories": [
    {
      "owaspId": "A07",
      "name": "Fallas de Autenticación",
      "description": "El sistema de login y sesiones de tu app tiene debilidades...",
      "count": 13,
      "severitySummary": { "high": 6, "medium": 7, "low": 0 },
      "worstSeverity": "high",
      "findings": [
        {
          "id": "f8a2c1",
          "ruleId": "AUTHFAIL_JWT_NO_EXPIRATION",
          "title": "JWT sin tiempo de expiración",
          "severity": "high",
          "owaspId": "A07",
          "file": "src/app.js",
          "line": 133,
          "description": "JWT emitido sin campo 'exp'. Token válido indefinidamente.",
          "fixRecommendation": "Agrega expiresIn: jwt.sign(payload, secret, { expiresIn: '1h' })"
        },
        {
          "id": "b3d4e5",
          "ruleId": "AUTHFAIL_WEAK_TOKEN_GENERATION",
          "title": "Token generado con Math.random()",
          "severity": "high",
          "owaspId": "A07",
          "file": "src/app.js",
          "line": 136,
          "description": "Token/sessionId generado con método no criptográfico.",
          "fixRecommendation": "Usa crypto.randomBytes(32).toString('hex')"
        }
      ]
    },
    {
      "owaspId": "A02",
      "name": "Fallas Criptográficas",
      "description": "Tu código expone contraseñas, llaves de API o datos sensibles...",
      "count": 12,
      "severitySummary": { "high": 8, "medium": 1, "low": 3 },
      "worstSeverity": "high",
      "findings": [
        {
          "id": "c4e5f6",
          "ruleId": "SECRET_AWS_KEY",
          "title": "Llave AWS detectada en código",
          "severity": "high",
          "owaspId": "A02",
          "file": "src/app.js",
          "line": 46,
          "description": "Se detectó un patrón AKIA... típico de Access Key de AWS.",
          "fixRecommendation": "Mueve a variables de entorno y rota la llave."
        }
      ]
    },
    {
      "owaspId": "A09",
      "name": "Fallas de Registro y Monitoreo",
      "description": "Tu app no registra eventos importantes o loguea contraseñas.",
      "count": 8,
      "severitySummary": { "high": 1, "medium": 0, "low": 7 },
      "worstSeverity": "high",
      "findings": [ "..." ]
    }
  ],
  "findings": [ "... los 73 findings planos ..." ],
  "limits": {
    "filesProcessed": 1,
    "totalBytesApprox": 6411,
    "truncated": false,
    "warnings": []
  },
  "usedAiExplanation": false
}
```

---

## Idea para la UI con desplegables

```
┌─────────────────────────────────────────────────┐
│  🔴 Puntuación: 100/100  —  CRÍTICO             │
│  Se encontraron 73 vulnerabilidades en 8 áreas  │
└─────────────────────────────────────────────────┘

▼ 🔴 A07 — Fallas de Autenticación (13 hallazgos)
│  "El sistema de login y sesiones de tu app..."
│  🔴 6 críticos  |  🟡 7 advertencias
│
│  ┌─ JWT sin tiempo de expiración ──── src/app.js:133
│  │  JWT emitido sin campo 'exp'. Token válido indefinidamente.
│  │  💡 Agrega expiresIn: jwt.sign(payload, secret, { expiresIn: '1h' })
│  └──────────────────────────────────────────────
│
│  ┌─ Token generado con Math.random() ──── src/app.js:136
│  │  Token/sessionId generado con método no criptográfico.
│  │  💡 Usa crypto.randomBytes(32).toString('hex')
│  └──────────────────────────────────────────────
│  ... y 11 más

▶ 🔴 A02 — Fallas Criptográficas (12 hallazgos)
▶ 🔴 A01 — Control de Acceso Roto (12 hallazgos)
▶ 🟡 A04 — Diseño Inseguro (9 hallazgos)
▶ 🔴 A09 — Fallas de Registro y Monitoreo (8 hallazgos)
▶ 🔴 A03 — Inyección (7 hallazgos)
▶ 🔴 A05 — Configuración de Seguridad Incorrecta (7 hallazgos)
▶ 🔴 A10 — SSRF (5 hallazgos)
```

---

## Código React de ejemplo para el desplegable

```tsx
function ResultsView({ result }: { result: AnalysisResult }) {
  const [openCategory, setOpenCategory] = useState<string | null>(null);

  return (
    <div>
      {/* Semáforo */}
      <ScoreCard
        riskScore={result.riskScore}
        trafficLight={result.trafficLight}
        totalFindings={result.findings.length}
        totalCategories={result.categories.length}
      />

      {/* Categorías desplegables */}
      {result.categories.map((cat) => (
        <div key={cat.owaspId}>
          {/* Header de categoría — click para abrir/cerrar */}
          <button onClick={() =>
            setOpenCategory(
              openCategory === cat.owaspId ? null : cat.owaspId
            )
          }>
            <SeverityBadge severity={cat.worstSeverity} />
            <span>
              {cat.owaspId} — {cat.name} ({cat.count} hallazgos)
            </span>
            <span>
              🔴 {cat.severitySummary.high} |
              🟡 {cat.severitySummary.medium} |
              🟢 {cat.severitySummary.low}
            </span>
          </button>

          {/* Descripción amigable */}
          <p>{cat.description}</p>

          {/* Findings individuales (el desplegable) */}
          {openCategory === cat.owaspId && (
            <div>
              {cat.findings.map((finding) => (
                <FindingCard key={finding.id} finding={finding} />
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
```

---

## TypeScript types (copiar al frontend)

```ts
type Severity = "low" | "medium" | "high";

type OwaspId =
  | "A01" | "A02" | "A03" | "A04" | "A05"
  | "A06" | "A07" | "A08" | "A09" | "A10";

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

type GroupedCategory = {
  owaspId: OwaspId;
  name: string;           // "Fallas de Autenticación"
  description: string;    // Explicación amigable para no-técnicos
  count: number;          // Total de findings en esta categoría
  severitySummary: {
    high: number;
    medium: number;
    low: number;
  };
  worstSeverity: Severity;
  findings: Finding[];    // Los findings individuales (desplegable)
};

type AnalysisResult = {
  riskScore: number;              // 0-100
  trafficLight: TrafficLight;     // "green" | "yellow" | "red"
  categories: GroupedCategory[];  // ⭐ Usar para la vista principal
  findings: Finding[];            // Lista plana (retrocompatible)
  limits: {
    filesProcessed: number;
    totalBytesApprox: number;
    truncated: boolean;
    warnings: string[];
  };
  usedAiExplanation: boolean;
};
```

---

## Resumen rápido

| Quiero mostrar... | Uso este campo |
|---|---|
| El semáforo (verde/amarillo/rojo) | `result.trafficLight` |
| La puntuación (0-100) | `result.riskScore` |
| Las categorías del desplegable | `result.categories` |
| El nombre amigable de cada categoría | `categories[n].name` |
| Cuántas vulns hay por categoría | `categories[n].count` |
| Los badges de severidad | `categories[n].severitySummary` |
| Las vulnerabilidades individuales | `categories[n].findings` |
| Dónde está el problema | `finding.file` y `finding.line` |
| Cómo arreglarlo | `finding.fixRecommendation` |
| Explicación educativa | `finding.educational` |
