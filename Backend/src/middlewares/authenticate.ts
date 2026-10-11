import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { AppError } from "./errorHandler";

export interface AuthPayload {
  sub: string;
  organizationId: string;
  email: string;
  name: string;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

// Throws if the token is invalid or expired. Shared by HTTP requests and the
// WebSocket handshake (config/realtime.ts), so both check exactly the same way.
export function verifyAccessToken(token: string): AuthPayload {
  // Pin the algorithm we sign with, so a token can't pick its own
  // (the classic "alg: none" / algorithm-confusion attacks).
  return jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as AuthPayload;
}

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("Missing or invalid Authorization header", 401));
  }

  try {
    req.auth = verifyAccessToken(header.slice("Bearer ".length));
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401));
  }
}
