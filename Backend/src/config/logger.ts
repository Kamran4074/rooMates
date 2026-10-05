import winston from "winston";
import { env } from "./env";

export const logger = winston.createLogger({
  level: env.NODE_ENV === "production" ? "info" : "debug",
  // Jest sets NODE_ENV=test; request logs would bury the test output.
  silent: env.NODE_ENV === "test",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    env.NODE_ENV === "production" ? winston.format.json() : winston.format.combine(winston.format.colorize(), winston.format.simple())
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: "logs/error.log", level: "error" }),
    new winston.transports.File({ filename: "logs/combined.log" }),
  ],
});

// Stream so morgan (HTTP request logging) can pipe into winston instead of console.log
export const morganStream = {
  write: (message: string) => logger.http(message.trim()),
};
