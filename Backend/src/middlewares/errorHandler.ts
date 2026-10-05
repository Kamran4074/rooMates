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

// Services throw AppError for expected failures ("Room not found", 403...);
// anything else is a bug and becomes a generic 500 - the real message and
// stack go to the log, never to the client.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    return res.status(400).json({
      success: false,
      message: "Validation failed",
      errors: z.flattenError(err).fieldErrors,
    });
  }

  if (err instanceof AppError) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  // Malformed JSON body, from express.json().
  if (err instanceof SyntaxError && "body" in err) {
    return res.status(400).json({ success: false, message: "Request body is not valid JSON" });
  }

  logger.error("Unhandled error", { error: (err as Error).message, stack: (err as Error).stack, path: req.path });
  return res.status(500).json({ success: false, message: "Internal server error" });
}

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, message: `No route for ${req.method} ${req.path}` });
}
