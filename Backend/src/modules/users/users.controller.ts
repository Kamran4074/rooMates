import { Request, Response } from "express";
import { sendSuccess } from "../../utils/response";
import { profileSchema } from "./users.schema";
import { completeOnboarding, updateProfile, getMe } from "./users.service";

export async function handleCompleteOnboarding(req: Request, res: Response) {
  sendSuccess(res, await completeOnboarding(req.auth!.sub, profileSchema.parse(req.body)));
}

export async function handleUpdateProfile(req: Request, res: Response) {
  sendSuccess(res, await updateProfile(req.auth!.sub, profileSchema.parse(req.body)), { message: "Profile updated" });
}

export async function handleGetMe(req: Request, res: Response) {
  sendSuccess(res, await getMe(req.auth!.sub));
}
