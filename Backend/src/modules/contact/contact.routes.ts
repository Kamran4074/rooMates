import { Router } from "express";
import { z } from "zod";
import { env } from "../../config/env";
import { sendEmail, escapeHtml } from "../../config/email";
import { AppError } from "../../middlewares/errorHandler";
import { contactLimiter } from "../../middlewares/rateLimit";

export const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email"),
  message: z.string().min(10, "Message should be at least 10 characters").max(2000),
});

const router = Router();

// Forwards the message to the site owner's inbox; replyTo lets them answer
// the sender directly from their mail client. User input is HTML-escaped -
// it's rendered inside an email body, so unescaped input would be injection.
router.post("/", contactLimiter, async (req, res, next) => {
  try {
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

    res.status(200).json({ message: "Thanks! We'll get back to you soon." });
  } catch (err) {
    next(err);
  }
});

export default router;
