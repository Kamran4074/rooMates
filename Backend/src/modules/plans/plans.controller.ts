import { Request, Response } from "express";
import { sendSuccess } from "../../utils/response";
import { uuidParam } from "../../utils/validation";
import * as plans from "./plans.service";
import { upgradeRequestSchema } from "./plans.schema";

export async function handleCatalog(_req: Request, res: Response) {
  // Prices change rarely; browsers may keep them for a minute.
  res.set("Cache-Control", "public, max-age=60");
  sendSuccess(res, await plans.catalog());
}

export async function handleMyPlan(req: Request, res: Response) {
  sendSuccess(res, await plans.getMyPlan(req.auth!.sub));
}

export async function handleCreateRequest(req: Request, res: Response) {
  const input = upgradeRequestSchema.parse(req.body);
  sendSuccess(res, await plans.createUpgradeRequest(req.auth!.sub, input), {
    status: 201,
    message: "Request sent - we'll call you to complete the upgrade",
  });
}

export async function handleCancelRequest(req: Request, res: Response) {
  const id = uuidParam("request").parse(req.params.requestId);
  sendSuccess(res, await plans.cancelUpgradeRequest(req.auth!.sub, id), { message: "Request cancelled" });
}
