# Vercel Environment Variables — Backend (Set-Api)

**Proyecto Vercel:** `Triple-D-Backend` / `set-api-backend`  
**Root Directory:** `Backend`

Copiá estas variables en **Settings → Environment Variables → Production** (y Preview si aplica).

---

## Obligatorias

| Variable | Valor en Vercel |
|----------|-----------------|
| `DATABASE_URL` | URL **directa** Postgres (Prisma/Neon/Vercel Postgres). La misma que usás en local si es prod. |
| `API_URL` | `https://set-api-backend.vercel.app` |
| `WEB_APP_URL` | `https://www.set-api.com,https://set-api.com,https://set-api-web.vercel.app` |
| `JWT_ACCESS_SECRET` | Secreto ≥32 chars (distinto al de dev) |
| `JWT_REFRESH_SECRET` | Secreto ≥32 chars (distinto al de dev) |
| `API_KEY_PEPPER` | Secreto para hash de API Keys de clientes |
| `ARCA_BASE_URL` | `https://set-api-arca-three.vercel.app` |
| `ARCA_API_KEY` | **Igual** a `API_KEY` del proyecto SET_API_ARCA (≥24 chars en prod) |
| `CRON_SECRET` | Secreto aleatorio ≥32 chars; Vercel lo envía como `Authorization: Bearer` al cron diario `/api/cron/billing` |

---

## Integraciones (si las usás en prod)

| Variable | Notas |
|----------|-------|
| `GOOGLE_CLIENT_ID` | Mismo valor que `VITE_GOOGLE_CLIENT_ID` en Frontend |
| `GMAIL_USER` | Cuenta Gmail para envío |
| `GMAIL_APP_PASSWORD` | App password de Gmail |
| `MAIL_FROM` | Ej: `Set-Api <no-reply@set-api.com>` |
| `DIDIT_API_KEY` | KYC Didit |
| `DIDIT_WEBHOOK_SECRET` | Webhook Didit |
| `DIDIT_WORKFLOW_ID` | Workflow Didit |

---

## Seed (una sola vez, no en Vercel obligatorio)

| Variable | Uso |
|----------|-----|
| `SUPERADMIN_EMAIL` | Solo para `npm run db:seed` local contra DB prod |
| `SUPERADMIN_PASSWORD` | Solo para seed |

---

## Verificación

```bash
curl https://set-api-backend.vercel.app/api/health
curl https://set-api-backend.vercel.app/api/ready
```

`arca` debe pasar de `fetch failed` a OK cuando `ARCA_BASE_URL` y `ARCA_API_KEY` estén bien.

---

## Enlace con ARCA

```
Backend.ARCA_API_KEY  ===  SET_API_ARCA.API_KEY
Backend.ARCA_BASE_URL ===  https://set-api-arca-three.vercel.app
```

Ver también: [`SET_API_ARCA/VERCEL.env.template.md`](../SET_API_ARCA/VERCEL.env.template.md)
