import express from "express";
import cors from "cors";
import helmet from "helmet";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { getOpenApiDocument } from "./config/openapi";
import { requestLogger } from "./middlewares/requestLogger";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler";
import { apiLimiter } from "./middlewares/rateLimit";
import { checkDbConnection } from "./config/db";
import authRoutes from "./modules/auth/auth.routes";
import roomRoutes from "./modules/rooms/rooms.routes";
import expenseRoutes from "./modules/expenses/expenses.routes";
import myExpensesRoutes from "./modules/expenses/myExpenses.routes";
import fundRoutes from "./modules/funds/funds.routes";
import userRoutes from "./modules/users/users.routes";
import contactRoutes from "./modules/contact/contact.routes";
import listingRoutes from "./modules/listings/listings.routes";
import requestRoutes from "./modules/requests/requests.routes";
import adminRoutes from "./modules/admin/admin.routes";

const app = express();

app.set("trust proxy", env.TRUST_PROXY);
// Security headers (no MIME sniffing, no framing, HSTS, no X-Powered-By...).
// Swagger UI's page relies on inline scripts, so only /api-docs skips the
// Content-Security-Policy; it still gets every other header.
const securityHeaders = helmet();
const docsSecurityHeaders = helmet({ contentSecurityPolicy: false });
app.use((req, res, next) =>
  req.path.startsWith("/api-docs") ? docsSecurityHeaders(req, res, next) : securityHeaders(req, res, next)
);
// maxAge: the browser caches the CORS preflight (OPTIONS) for a day instead of
// sending one before nearly every API call - every call carries an
// Authorization header, which forces a preflight.
app.use(cors({ origin: env.CORS_ORIGIN, maxAge: 86_400 }));
// Bodies here are small forms; a cap stops someone posting a huge payload.
app.use(express.json({ limit: "100kb" }));
app.use(requestLogger);
app.use("/api", apiLimiter);

app.get("/api/health", async (_req, res) => {
  const dbConnected = await checkDbConnection();
  res.status(dbConnected ? 200 : 503).json({
    success: dbConnected,
    data: { status: dbConnected ? "ok" : "degraded", db: dbConnected ? "connected" : "unreachable" },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/rooms/:roomId/funds", fundRoutes);
app.use("/api/rooms/:roomId", expenseRoutes);
app.use("/api/expenses", myExpensesRoutes);
app.use("/api/users", userRoutes);
app.use("/api/contact", contactRoutes);
app.use("/api/listings", listingRoutes);
app.use("/api/requests", requestRoutes);
app.use("/api/admin", adminRoutes);

// The spec is static for a given build - generate it once, not per request.
const openApiDocument = getOpenApiDocument();
app.get("/api-docs.json", (_req, res) => res.json(openApiDocument));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(openApiDocument));

app.use("/api", notFoundHandler);
app.use(errorHandler);

export default app;
