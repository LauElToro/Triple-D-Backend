const BRAND = "Set-Api";
const ACCENT = "#e8562a";

function layout(title: string, body: string): string {
  return `<!doctype html><html><body style="margin:0;background:#f6f5f2;font-family:Arial,Helvetica,sans-serif;color:#111">
  <div style="max-width:520px;margin:0 auto;padding:32px 16px">
    <div style="font-size:22px;font-weight:800;letter-spacing:-0.02em;margin-bottom:16px">${BRAND}</div>
    <div style="background:#fff;border:1px solid #e6e3dd;border-radius:12px;padding:28px">
      <h1 style="font-size:18px;margin:0 0 12px">${title}</h1>
      ${body}
    </div>
    <p style="color:#8a857c;font-size:12px;margin-top:16px">Enviado por ${BRAND} · Facturación electrónica ARCA</p>
  </div></body></html>`;
}

function codeBox(code: string): string {
  return `<div style="font-size:30px;font-weight:700;letter-spacing:8px;text-align:center;background:#faf9f7;border:1px dashed ${ACCENT};border-radius:10px;padding:16px;margin:16px 0">${code}</div>`;
}

export function verifyEmailTemplate(code: string) {
  return {
    subject: `${BRAND} · Verificá tu email`,
    html: layout(
      "Confirmá tu dirección de email",
      `<p>Usá este código para verificar tu cuenta. Vence en 15 minutos.</p>${codeBox(code)}`
    ),
  };
}

export function twoFactorTemplate(code: string) {
  return {
    subject: `${BRAND} · Código de acceso (2FA)`,
    html: layout(
      "Tu código de verificación en dos pasos",
      `<p>Ingresá este código para completar el inicio de sesión. Vence en 5 minutos.</p>${codeBox(
        code
      )}<p style="color:#8a857c;font-size:13px">Si no fuiste vos, cambiá tu contraseña.</p>`
    ),
  };
}

export function welcomeTemplate(email: string) {
  return {
    subject: `${BRAND} · Cuenta creada`,
    html: layout(
      "Bienvenido a Set-Api",
      `<p>Tu cuenta <b>${email}</b> fue creada. El siguiente paso es completar la verificación de identidad (KYC) para operar.</p>`
    ),
  };
}

export function loginAlertTemplate(email: string, when: string) {
  return {
    subject: `${BRAND} · Nuevo inicio de sesión`,
    html: layout(
      "Inicio de sesión detectado",
      `<p>Se inició sesión en la cuenta <b>${email}</b> el ${when}.</p><p style="color:#8a857c;font-size:13px">Si no fuiste vos, restablecé tu contraseña de inmediato.</p>`
    ),
  };
}

export function invitationTemplate(orgName: string, acceptUrl: string, subRole: string) {
  return {
    subject: `${BRAND} · Te invitaron a ${orgName}`,
    html: layout(
      `Invitación a ${orgName}`,
      `<p>Fuiste invitado a colaborar con el rol <b>${subRole}</b>.</p>
       <p><a href="${acceptUrl}" style="display:inline-block;background:${ACCENT};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">Aceptar invitación</a></p>
       <p style="color:#8a857c;font-size:12px">Si no esperabas esta invitación, ignorá este mail.</p>`
    ),
  };
}

export function passwordResetTemplate(code: string) {
  return {
    subject: `${BRAND} · Restablecer contraseña`,
    html: layout(
      "Restablecé tu contraseña",
      `<p>Usá este código para restablecer tu contraseña. Vence en 15 minutos.</p>${codeBox(code)}`
    ),
  };
}
