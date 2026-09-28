import express from "express";
import cors from "cors";
import swaggerUi from "swagger-ui-express";
import { env } from "./config/env";
import { getOpenApiDocument } from "./config/openapi";
import { requestLogger } from "./middlewares/requestLogger";
import { errorHandler } from "./middlewares/errorHandler";
import { apiLimiter } from "./middlewares/rateLimit";
import { checkDbConnection } from "./config/db";
import authRoutes from "./modules/auth/auth.routes";
import roomRoutes from "./modules/rooms/rooms.routes";
import expenseRoutes from "./modules/expenses/expenses.routes";
import userRoutes from "./modules/users/users.routes";
import contactRoutes from "./modules/contact/contact.routes";

const app = express();

app.set("trust proxy", env.TRUST_PROXY);
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(express.json());
app.use(requestLogger);
app.use("/api", apiLimiter);

app.get("/api/health", async (_req, res) => {
  const dbConnected = await checkDbConnection();
  res.status(dbConnected ? 200 : 503).json({
    status: dbConnected ? "ok" : "degraded",
    db: dbConnected ? "connected" : "unreachable",
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/rooms", roomRoutes);
app.use("/api/rooms/:roomId", expenseRoutes);
app.use("/api/users", userRoutes);
app.use("/api/contact", contactRoutes);

app.get("/api-docs.json", (_req, res) => res.json(getOpenApiDocument()));
app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(getOpenApiDocument()));

app.use(errorHandler);

export default app;
