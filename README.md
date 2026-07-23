# Triple D — API

Backend del SaaS Triple D: **Next.js (App Router) + DDD + Prisma + PostgreSQL**.
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
- PostgreSQL 16 (o `docker compose` desde la raíz del repo)

## Setup local

```bash
npm install
cp .env.example .env      # completar secretos (ya provistos en .env de dev)
npx prisma migrate deploy # o: npx prisma db push
npm run db:seed           # crea el SUPERADMIN (SUPERADMIN_EMAIL/PASSWORD)
npm run dev               # http://localhost:4000
```

## Con Docker (recomendado)

Desde la raíz del repositorio (`e:\Garcas`):

```bash
docker compose up --build
```

Levanta `postgres`, `arca` (FastAPI), `backend` (esta API, puerto 4000) y
`mailhog`. El backend aplica migraciones y siembra el SUPERADMIN al arrancar.

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
