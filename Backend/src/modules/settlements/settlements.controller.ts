import { Request, Response } from "express";
import { roomIdParam, uuidParam } from "../../utils/validation";
import { paginationQuery } from "../../utils/pagination";
import { sendCreated, sendNoContent, sendSuccess } from "../../utils/response";
import { createSettlementSchema } from "./settlements.schema";
import { createSettlement, deleteSettlement, listSettlements } from "./settlements.service";

const settlementIdParam = uuidParam("payment");

export async function handleCreateSettlement(req: Request, res: Response) {
  const roomId = roomIdParam.parse(req.params.roomId);
  const settlement = await createSettlement(req.auth!.sub, roomId, createSettlementSchema.parse(req.body));
  sendCreated(res, settlement, "Payment recorded");
}

export async function handleListSettlements(req: Request, res: Response) {
  const roomId = roomIdParam.parse(req.params.roomId);
  const { data, pagination } = await listSettlements(req.auth!.sub, roomId, paginationQuery.parse(req.query));
  sendSuccess(res, data, { pagination });
}

export async function handleDeleteSettlement(req: Request, res: Response) {
  const roomId = roomIdParam.parse(req.params.roomId);
  await deleteSettlement(req.auth!.sub, roomId, settlementIdParam.parse(req.params.settlementId));
  sendNoContent(res);
}
