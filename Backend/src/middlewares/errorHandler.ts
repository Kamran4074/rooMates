import { NextFunction, Request, Response } from "express";
import { z, ZodError } from "zod";
import { logger } from "../config/logger";

export class AppError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      errors: z.flattenError(err).fieldErrors,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ message: err.message });
  }

  logger.error("Unhandled error", { error: (err as Error).message, stack: (err as Error).stack, path: req.path });
  return res.status(500).json({ message: "Internal server error" });
}
