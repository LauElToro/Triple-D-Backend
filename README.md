# Set-Api — API

Backend del SaaS Set-Api: **Next.js (App Router) + DDD + Prisma + PostgreSQL**.
Gestiona identidad, roles/permisos, 2FA, KYC (Didit), API Keys con metering,
facturación por ciclo, proxy a ARCA, tickets de soporte y métricas.

## Arquitectura (DDD)

```
src/
  domain/           # reglas de negocio puras (planes, etc.)
  application/      # casos de uso (auth, billing, ...)
  infrastructure/   # adaptadores: security, email, kyc, arca
  interface/http/   # sesión, permisos, serializers, auth por API Key
  app/api/          # route handlers (App Router)
prisma/             # schema + migraciones + seed
```

## Requisitos

- Node 20+
- PostgreSQL 16 (local, o un Postgres administrado como Vercel Postgres / Neon / Supabase)

## Setup local

```bash
npm install
cp .env.example .env      # completar secretos (ya provistos en .env de dev)
npx prisma migrate deploy # o: npx prisma db push
npm run db:seed           # crea el SUPERADMIN (SUPERADMIN_EMAIL/PASSWORD)
npm run dev               # http://localhost:4000
```

## Deploy en Vercel

Proyecto Vercel con **Root Directory = `Backend`**. La configuración vive en
`vercel.json`:

```jsonc
{
  "framework": "nextjs",
  "buildCommand": "prisma generate && prisma migrate deploy && next build"
}
```

Cada build genera el cliente Prisma y aplica migraciones contra la base productiva.

Pasos:

1. Aprovisionar un Postgres administrado (Vercel Postgres, Neon, Supabase…).
   `DATABASE_URL` debe ser una conexión **directa** (no pooler) para que
   `prisma migrate deploy` funcione en build.
2. Cargar en **Settings → Environment Variables** todas las claves de la sección
   de abajo (`DATABASE_URL`, secretos JWT, Gmail, Didit, Google, `ARCA_BASE_URL`
   apuntando al deploy Vercel del microservicio ARCA, `WEB_APP_URL` = dominio del
   frontend).
3. Tras el primer deploy, ejecutar el seed una única vez desde tu máquina apuntando
   a la base productiva: `DATABASE_URL=... npm run db:seed`.

El runtime de las route handlers es Node.js (`export const runtime = "nodejs"`),
requerido por Prisma, bcrypt y nodemailer.

## Variables de entorno

Ver `.env.example`. Claves principales:

- `DATABASE_URL` — conexión a Postgres
- `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` — firma de tokens (access 2h)
- `GMAIL_USER` / `GMAIL_APP_PASSWORD` — envío de mails (registro, login, 2FA)
- `DIDIT_API_KEY` / `DIDIT_WEBHOOK_SECRET` / `DIDIT_WORKFLOW_ID` — KYC
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — login con Google (placeholder)
- `ARCA_BASE_URL` / `ARCA_API_KEY` — gateway ARCA (FastAPI)

## Modelo de seguridad

- El rol vive en la base de datos; el JWT solo lo transporta (firmado). Toda
  autorización se re-verifica server-side contra `Membership` en cada request,
  de modo que un usuario **no puede auto-escalarse de rol**.
- `SUPERADMIN` (plataforma), `ADMIN` (dueño de organización), `USER` (invitado
  con sub-rol `DEV` / `CONTABILIDAD` / `ADMINISTRACION`).
- KYC obligatorio (Didit) antes de operar; gate aplicado en el backend y en el
  frontend.
- API Keys se guardan **hasheadas**; el valor en claro se muestra una sola vez.

## Endpoints principales

| Método | Ruta | Descripción |
|--------|------|-------------|
| POST | `/api/auth/register` | Registro (paso 1: verificación por email) |
| POST | `/api/auth/verify-email` | Confirma email y abre sesión |
| POST | `/api/auth/login` | Login (puede requerir 2FA) |
| POST | `/api/auth/2fa/verify` | Completa login con 2FA |
| POST | `/api/auth/google` | Login/registro con Google |
| POST | `/api/auth/refresh` | Rota la sesión (autorefresh) |
| POST | `/api/kyc/session` | Crea sesión KYC Didit |
| POST | `/api/kyc/webhook` | Webhook Didit (verifica X-Signature-V2) |
| GET/POST | `/api/keys` | Lista / emite API Keys |
| POST | `/api/keys/{id}/rotate` | Rota una key |
| GET | `/api/usage` | Metering del ciclo |
| GET | `/api/invoices` | Facturas emitidas |
| POST | `/api/arca/comprobantes` | Emite comprobante (metered) |
| GET | `/api/arca/contribuyente/{cuit}` | Padrón/constancia |
| GET/POST | `/api/team/members` · `/api/team/invitations` | Equipo |
| GET/POST | `/api/tickets` | Soporte |
| GET | `/api/metrics` · `/api/admin/clients` | KPIs (SUPERADMIN) |
```
