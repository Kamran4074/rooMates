import { z } from "zod";
import dotenv from "dotenv";

dotenv.config();

const envSchema = z.object({
  PORT: z.coerce.number().default(5000),
  // Number of reverse proxies in front of the app (e.g. 1 on Render/Railway).
  // Must be right, or rate limits key on the proxy's IP instead of the user's.
  TRUST_PROXY: z.coerce.number().default(0),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  // Comma-separated list of allowed frontend origins, e.g. local + deployed URL.
  CORS_ORIGIN: z
    .string()
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean))
    .pipe(z.array(z.string().url()).min(1)),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  APP_DATABASE_URL: z.string().min(1, "APP_DATABASE_URL is required"),
  JWT_SECRET: z.string().min(1, "JWT_SECRET is required"),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().default(30),
  GOOGLE_CLIENT_ID: z.string().optional(),
  BREVO_API_KEY: z.string().optional(),
  EMAIL_FROM_NAME: z.string().default("RooMates"),
  // Must be a sender verified in Brevo (Settings -> Senders), or sends are rejected.
  EMAIL_FROM_ADDRESS: z.string().email().default("hello.roomatess@gmail.com"),
  CONTACT_INBOX: z.string().email().optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:", z.flattenError(parsed.error).fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
