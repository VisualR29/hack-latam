# VibeGuard (MVP)

Plataforma **local** pensada como capa preventiva ante el “vibe coding”: ingestá código pegado (texto plano), un `.zip` o un repositorio **público** de GitHub y recibí un puntaje rápido de patrones delicados más explicaciones en lenguaje sencillo (plantillas español + modo opcional con IA tipo OpenAI).

> **Este MVP no intenta repetir scanners enterprise**. Es una demostración con reglas/heurísticas acotadas, límites de tamaño y sin garantías de falsos negativos/positivos.

## Requerimientos

- Node.js 18+ (`fetch` disponible sin polyfill adicional relevante aquí).

## Variables de entorno servidor

Consultá `[server/.env.example](server/.env.example)`. Lo mínimo es:

- Sin IA: sólo ejecutá `.\\server`/`npm run dev` y listo → textos deterministas locales.
- Con IA opcional compatible OpenAI (`OPENAI_API_KEY`, `OPENAI_BASE_URL`): copiá tu clave donde indica ese archivo ejemplo.

Opcional **`GITHUB_TOKEN`**: aumenta límites de rate limit oficial frente GitHub público cuando analizás URLs.

## Scripts raíz (`npm`)

```bash
npm install                 # sólo concurrently a nivel carpeta proyecto
npm run dev                # paralelo servidor (8787) + cliente vite (5173)
npm run build              # tsc servidor + vite build cliente
npm run start              # arranca la build compilada de express
```

Ejecutá dentro de `./server`:

```bash
cd server && npm install
```

y dentro de `./client`:

```bash
cd client && npm install
```

## API HTTP

- **`GET /health`**: chequeo rápido.
- **`POST /api/analyze`**
  - JSON `{ "mode": "raw", "code": "...", "filename?": ... }`.
  - JSON `{ "mode": "github", "url": "https://github.com/owner/repo" }`.
  - `multipart/form-data` con campo de archivo llamado **`file`** (solo `.zip`).

### Límites operativos (alto nivel)

- Límite aprox de texto analizable combinado (~5 MB) y hasta **200** archivos después de filtros/extensiones conocidas `.ts`, `.tsx`, `.js`, `.json`, `.yml`, etc.
- ZIP máximo configurado contra `constants.ts`.
- Extracciones temporales locales se borran luego (`finally` servidor).

Seguridad de la **plataforma** misma frente payloads maliciosos: no ejecutamos el código del proyecto del usuario fuera lectura texto + parser JSON lockfiles mínimos; mitigamos `Zip Slip` básico; GitHub SSRF limitado a host `github.com` con parse estricto de `owner/repo`.

## Frontend

SPA Vite dentro de `./client`; en desarrollo se proxifica `/api → http://localhost:8787` vía configuración vite.

---

## Roadmap rápido (fuera alcance inicial)

Motor OSV público granular, parsers Docker/Terraform densos, autenticación multi-equipo/almacén histórico, upgrade multer→2.x, tests automatizados e2e, etc.

## Licencia/uso ético del producto ficticio MVP

Este repositorio no sustituye pentests humanos profesionales. Verificaciones manuales finales antes de llevar automatización o datos personales fuera sandbox siguen obligatorias.
