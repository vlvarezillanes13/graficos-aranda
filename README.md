# Graficos — incidentes ITSM

Dashboard React (Vite) con API serverless en la carpeta `api/` para desplegar **frontend y backend en un solo proyecto Vercel**.

## Desarrollo local

```bash
npm install
npm run dev
```

La app corre en `http://localhost:5173`. Las rutas `/api/*` las atiende el middleware de Vite (misma lógica que en Vercel).

Variables mínimas en `.env`:

- `AUTH_SESSION_SECRET` o `VITE_AUTH_SESSION_SECRET`
- Opcional: `AUTH_ADMIN_PASSWORD`

Tras login, un administrador debe pegar el **token ITSM** (JWT de Postman) en el modal de la app.

## Deploy en Vercel

1. Importa el repositorio en [Vercel](https://vercel.com).
2. Framework: **Vite** (detectado automáticamente vía `vercel.json`).
3. Configura variables de entorno en el proyecto:

| Variable | Descripción |
|----------|-------------|
| `AUTH_SESSION_SECRET` | Secreto para firmar sesiones (obligatorio) |
| `AUTH_ADMIN_PASSWORD` | Clave del usuario admin `SNDVAI` (opcional) |
| `KV_REST_API_URL` | URL de Vercel KV |
| `KV_REST_API_TOKEN` | Token de Vercel KV |

4. Crea una base **KV** en Vercel (Storage → KV) y enlázala al proyecto. Sin KV, el token ITSM y los casos urgentes solo viven en memoria de cada función (no recomendado en producción).

5. Deploy. No hace falta un servidor aparte: `/api/*` son Vercel Functions; el SPA se sirve desde `dist/`.

## Casos urgentes compartidos

Antes usaban Socket.IO (`backend/`). En Vercel la lista se sincroniza con **REST** (`GET/POST /api/urgent-cases`) y polling cada 5 s. El estado persiste en KV cuando está configurado.

La carpeta `backend/` queda como referencia local opcional; no se usa en el deploy de Vercel.

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Frontend + API en desarrollo |
| `npm run build` | Typecheck + build de producción |
| `npm run preview` | Preview del build |
