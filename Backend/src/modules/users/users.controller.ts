import { Request, Response, NextFunction } from "express";
import { completeOnboardingSchema } from "./users.schema";
import { completeOnboarding } from "./users.service";

export async function handleCompleteOnboarding(req: Request, res: Response, next: NextFunction) {
  try {
    const input = completeOnboardingSchema.parse(req.body);
    const user = await completeOnboarding(req.auth!.sub, input);
    res.status(200).json(user);
  } catch (err) {
    next(err);
  }
}
