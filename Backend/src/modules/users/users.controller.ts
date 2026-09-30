import { Request, Response } from "express";
import { profileSchema } from "./users.schema";
import { completeOnboarding, updateProfile, getMe } from "./users.service";

export async function handleCompleteOnboarding(req: Request, res: Response) {
  res.json(await completeOnboarding(req.auth!.sub, profileSchema.parse(req.body)));
}

export async function handleUpdateProfile(req: Request, res: Response) {
  res.json(await updateProfile(req.auth!.sub, profileSchema.parse(req.body)));
}

export async function handleGetMe(req: Request, res: Response) {
  res.json(await getMe(req.auth!.sub));
}
