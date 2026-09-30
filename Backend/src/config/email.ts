import { env } from "./env";
import { logger } from "./logger";
import { AppError } from "../middlewares/errorHandler";

// Brevo's transactional API over plain HTTPS. Deliberately not SMTP: some free
// hosts block outbound SMTP ports, while HTTPS always works.
const BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email";

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
}

// Every email in the app goes through this one function, so switching
// provider (Resend -> Brevo) only ever touches this file.
export async function sendEmail({ to, subject, html, replyTo }: EmailOptions) {
  if (!env.BREVO_API_KEY) {
    throw new AppError("Email service is not configured on the server", 500);
  }

  const res = await fetch(BREVO_SEND_URL, {
    method: "POST",
    headers: {
      "api-key": env.BREVO_API_KEY,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { name: env.EMAIL_FROM_NAME, email: env.EMAIL_FROM_ADDRESS },
      to: [{ email: to }],
      subject,
      htmlContent: html,
      ...(replyTo ? { replyTo: { email: replyTo } } : {}),
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logger.error("Failed to send email", { to, subject, status: res.status, detail });
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
