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

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    return next(new AppError("Missing or invalid Authorization header", 401));
  }

  try {
    // Pin the algorithm we sign with, so a token can't pick its own
    // (the classic "alg: none" / algorithm-confusion attacks).
    const payload = jwt.verify(header.slice("Bearer ".length), env.JWT_SECRET, { algorithms: ["HS256"] }) as AuthPayload;
    req.auth = payload;
    next();
  } catch {
    next(new AppError("Invalid or expired token", 401));
  }
}
