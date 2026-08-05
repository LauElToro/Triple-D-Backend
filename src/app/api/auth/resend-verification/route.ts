import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { issueOtp } from "@/application/auth/otp-service";
import { sendMail } from "@/infrastructure/email/mailer";
import { verifyEmailTemplate } from "@/infrastructure/email/templates";
import { ok, error, handleError } from "@/interface/http/responses";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return error(422, "Datos inválidos", "unprocessable");

    const email = parsed.data.email.toLowerCase().trim();
    const user = await prisma.user.findUnique({ where: { email } });

    // Avoid leaking whether the email exists.
    if (!user || user.emailVerified || user.googleId) {
      return ok({ message: "Si el email existe y no está verificado, enviamos un nuevo código." });
    }

    const code = await issueOtp(user.id, "EMAIL_VERIFY");
    await sendMail({ to: email, ...verifyEmailTemplate(code) });

    return ok({ message: "Si el email existe y no está verificado, enviamos un nuevo código." });
  } catch (err) {
    return handleError(err);
  }
}
