import nodemailer, { type Transporter } from "nodemailer";
import { env } from "@/lib/env";

let transporter: Transporter | null = null;

function getTransporter(): Transporter | null {
  if (!env.gmailUser || !env.gmailAppPassword) {
    return null;
  }
  if (!transporter) {
    transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: env.gmailUser,
        // App password may be pasted with spaces; Gmail ignores them.
        pass: env.gmailAppPassword.replace(/\s+/g, ""),
      },
    });
  }
  return transporter;
}

export interface MailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendMail(input: MailInput): Promise<{ sent: boolean; reason?: string }> {
  const tx = getTransporter();
  if (!tx) {
    // Non-fatal in dev: log so the flow can continue without SMTP configured.
    console.warn(`[mailer] SMTP not configured, skipping email to ${input.to}: ${input.subject}`);
    return { sent: false, reason: "smtp_not_configured" };
  }
  try {
    await tx.sendMail({
      from: env.mailFrom,
      to: input.to,
      subject: input.subject,
      html: input.html,
      text: input.text ?? input.html.replace(/<[^>]+>/g, " "),
    });
    return { sent: true };
  } catch (err) {
    console.error("[mailer] send failed:", err);
    return { sent: false, reason: "send_failed" };
  }
}
