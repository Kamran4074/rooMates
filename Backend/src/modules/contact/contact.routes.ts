import { Router } from "express";
import { env } from "../../config/env";
import { sendEmail, escapeHtml } from "../../config/email";
import { AppError } from "../../middlewares/errorHandler";
import { contactLimiter } from "../../middlewares/rateLimit";
import { contactSchema } from "./contact.schema";

const router = Router();

// Forwards the message to the site owner's inbox; replyTo lets them answer
// the sender directly from their mail client. User input is HTML-escaped -
// it's rendered inside an email body, so unescaped input would be injection.
router.post("/", contactLimiter, async (req, res) => {
  const { name, email, message } = contactSchema.parse(req.body);
  if (!env.CONTACT_INBOX) {
    throw new AppError("Contact form is not configured on the server", 500);
  }

  await sendEmail({
    to: env.CONTACT_INBOX,
    replyTo: email,
    subject: `RooMates contact: ${name.slice(0, 60)}`,
    html: `<p><strong>From:</strong> ${escapeHtml(name)} (${escapeHtml(email)})</p>
           <p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
  });

  res.json({ message: "Thanks! We'll get back to you soon." });
});

export default router;
