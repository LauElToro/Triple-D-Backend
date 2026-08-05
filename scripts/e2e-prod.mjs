#!/usr/bin/env node
/**
 * Production E2E smoke: login → API Key → ARCA proxy → usage.
 * Usage: node scripts/e2e-prod.mjs
 * Reads credentials from ../.env (not committed).
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.E2E_API_URL ?? "https://set-api-backend.vercel.app";
const CUIT = process.env.E2E_CUIT ?? "20286947930";

function loadEnv(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i);
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    env[k] = v;
  }
  return env;
}

const env = loadEnv(path.join(__dirname, "..", ".env"));

async function api(method, route, { token, apiKey, body, orgId } = {}) {
  const headers = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;
  if (orgId) headers["X-Org-Id"] = orgId;

  const res = await fetch(`${BASE}${route}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = { raw: text.slice(0, 500) };
  }
  return { status: res.status, ok: res.ok, data };
}

function step(name, result) {
  const icon = result.ok ? "OK" : "FAIL";
  console.log(`\n[${icon}] ${name} → HTTP ${result.status}`);
  const preview = JSON.stringify(result.data)?.slice(0, 600);
  if (preview) console.log(preview);
  return result;
}

async function main() {
  console.log(`E2E Set-Api → ${BASE}`);
  const email = env.SUPERADMIN_EMAIL;
  const password = env.SUPERADMIN_PASSWORD;
  if (!email || !password) {
    console.error("Missing SUPERADMIN_EMAIL/PASSWORD in Backend/.env");
    process.exit(1);
  }

  const login = step(
    "1. Login superadmin",
    await api("POST", "/api/auth/login", { body: { email, password } }),
  );
  if (!login.ok) process.exit(1);
  const token = login.data?.accessToken;
  if (!token) {
    console.error("No accessToken (2FA required?)");
    process.exit(1);
  }

  const me = step("2. GET /api/me", await api("GET", "/api/me", { token }));
  const orgId = me.data?.activeOrg?.id ?? me.data?.organizations?.[0]?.id;
  if (!orgId) {
    console.error("No organization for user");
    process.exit(1);
  }
  console.log(`Org: ${orgId}, arcaCuit: ${me.data?.activeOrg?.arcaCuit ?? "(unset)"}`);

  if (!me.data?.activeOrg?.arcaCuit) {
    step(
      "3. PATCH org arcaCuit",
      await api("PATCH", "/api/organizations", {
        token,
        orgId,
        body: { arcaCuit: CUIT },
      }),
    );
  } else {
    console.log("\n[SKIP] 3. PATCH org arcaCuit (already set)");
  }

  const keysBefore = step("4. GET /api/usage (before)", await api("GET", "/api/usage", { token, orgId }));
  const unitsBefore = keysBefore.data?.cycle?.units ?? 0;

  const keyRes = step(
    "5. POST /api/keys (create)",
    await api("POST", "/api/keys", { token, orgId, body: { name: "e2e-" + Date.now() } }),
  );
  let apiKey = keyRes.data?.plaintext;
  if (!apiKey) {
    console.log("\n[WARN] Key creation failed — trying existing keys list");
    const list = await api("GET", "/api/keys", { token, orgId });
    if (list.data?.keys?.length) {
      console.log("Existing keys:", list.data.keys.map((k) => k.prefix).join(", "));
      console.error("Cannot run metered ARCA calls without plaintext key. Create one in dashboard.");
      process.exit(1);
    }
    process.exit(1);
  }
  console.log(`API Key prefix: ${keyRes.data?.key?.prefix ?? "?"}`);

  step(
    "6. GET /api/arca/contribuyente (metered read)",
    await api("GET", `/api/arca/contribuyente/${CUIT}`, { apiKey }),
  );

  const pv = step(
    "7. GET /api/arca/puntos-venta",
    await api("GET", `/api/arca/puntos-venta?cuit_emisor=${CUIT}`, { apiKey }),
  );

  const today = new Date();
  const cbteFch = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
  // Must match a valid PV for the emisor — list with GET /api/arca/puntos-venta (step 7).
  const ptoVta = 2;

  step(
    "8. POST /api/arca/comprobantes (emit)",
    await api("POST", "/api/arca/comprobantes", {
      apiKey,
      body: {
        cbteTipo: 11,
        ptoVta,
        concepto: 1,
        docTipo: 99,
        docNro: 0,
        cbteFch,
        impTotal: 1210,
        impNeto: 1000,
        impIVA: 210,
        iva: [{ id: 5, baseImp: 1000, importe: 210 }],
        condicionIVAReceptorId: 5,
      },
    }),
  );

  const usageAfter = step("9. GET /api/usage (after)", await api("GET", "/api/usage", { token, orgId }));
  const unitsAfter = usageAfter.data?.cycle?.units ?? 0;
  console.log(`\nMetering: ${unitsBefore} → ${unitsAfter} units (delta ${unitsAfter - unitsBefore})`);

  console.log("\n--- E2E complete ---");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
