import { z } from "zod";
import { registerUser } from "@/application/auth/auth-service";
import { audit, clientIp } from "@/interface/http/audit";
import { created, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  name: z.string().min(1).optional(),
  plan: z.enum(["free", "fixed", "usage"]).optional(),
  orgName: z.string().min(1).optional(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return error(422, "Datos inválidos", "unprocessable", parsed.error.flatten());
    }

    const user = await registerUser(parsed.data);
    await audit({ actorId: user.id, action: "auth.register", target: user.email, ip: clientIp(req) });

    // Two-step: registration requires email verification before a full session.
    return created({
      status: "verify_email",
      userId: user.id,
      email: user.email,
      message: "Te enviamos un código de verificación por email.",
    });
  } catch (err) {
    return handleError(err);
  }
}
