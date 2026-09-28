import { Resend } from "resend";
import { env } from "./env";
import { logger } from "./logger";
import { AppError } from "../middlewares/errorHandler";

const resend = env.RESEND_API_KEY ? new Resend(env.RESEND_API_KEY) : null;

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

export async function sendEmail({ to, subject, html, replyTo }: EmailOptions) {
  if (!resend) {
    throw new AppError("Email service is not configured on the server", 500);
  }

  const { error } = await resend.emails.send({ from: env.EMAIL_FROM, to, subject, html, replyTo });
  if (error) {
    logger.error("Failed to send email", { to, subject, error: error.message });
    throw new AppError("Could not send email. Please try again.", 502);
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
