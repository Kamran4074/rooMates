import { Request, Response } from "express";
import { sendCreated, sendSuccess } from "../../utils/response";
import {
  createRequestSchema,
  receivedRequestsQuery,
  requestIdParam,
  respondToRequestSchema,
  sentRequestsQuery,
} from "./requests.schema";
import * as requests from "./requests.service";

export async function handleCreate(req: Request, res: Response) {
  const { listingId, message } = createRequestSchema.parse(req.body);
  sendCreated(res, await requests.createRequest(req.auth!.sub, listingId, message), "Request sent to the owner");
}

export async function handleSent(req: Request, res: Response) {
  const { status, page, limit } = sentRequestsQuery.parse(req.query);
  const { data, pagination } = await requests.listSent(req.auth!.sub, status, { page, limit });
  sendSuccess(res, data, { pagination });
}

export async function handleReceived(req: Request, res: Response) {
  const { status, listingId, page, limit } = receivedRequestsQuery.parse(req.query);
  const { data, pagination } = await requests.listReceived(req.auth!.sub, { status, listingId }, { page, limit });
  sendSuccess(res, data, { pagination });
}

export async function handleRespond(req: Request, res: Response) {
  const { action, markRented } = respondToRequestSchema.parse(req.body);
  const result = await requests.respond(req.auth!.sub, requestIdParam.parse(req.params.requestId), action, markRented);
  sendSuccess(res, result, { message: action === "accept" ? "Request accepted - you can now contact each other" : "Request declined" });
}
