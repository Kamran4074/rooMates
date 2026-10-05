import { Request, Response } from "express";
import { sendCreated, sendNoContent, sendSuccess } from "../../utils/response";
import { roomIdParam } from "../../utils/validation";
import { contributionSchema, createFundSchema, entryIdParam, fundIdParam, spendSchema } from "./funds.schema";
import {
  addContribution,
  addSpend,
  closeFund,
  confirmEntry,
  createFund,
  deleteEntry,
  getFund,
  listFunds,
  previewClose,
} from "./funds.service";

const ids = (req: Request) => ({
  roomId: roomIdParam.parse(req.params.roomId),
  fundId: fundIdParam.parse(req.params.fundId),
});

export async function handleListFunds(req: Request, res: Response) {
  sendSuccess(res, await listFunds(req.auth!.sub, roomIdParam.parse(req.params.roomId)));
}

export async function handleCreateFund(req: Request, res: Response) {
  const roomId = roomIdParam.parse(req.params.roomId);
  sendCreated(res, await createFund(req.auth!.sub, roomId, createFundSchema.parse(req.body)), "Fund started");
}

export async function handleGetFund(req: Request, res: Response) {
  const { roomId, fundId } = ids(req);
  sendSuccess(res, await getFund(req.auth!.sub, roomId, fundId));
}

export async function handleAddContribution(req: Request, res: Response) {
  const { roomId, fundId } = ids(req);
  const result = await addContribution(req.auth!.sub, roomId, fundId, contributionSchema.parse(req.body));
  sendCreated(res, result, result.confirmed ? "Payment recorded" : "Payment recorded - waiting for the collector to confirm");
}

export async function handleAddSpend(req: Request, res: Response) {
  const { roomId, fundId } = ids(req);
  sendCreated(res, await addSpend(req.auth!.sub, roomId, fundId, spendSchema.parse(req.body)), "Spend recorded");
}

export async function handleDeleteEntry(req: Request, res: Response) {
  const { roomId, fundId } = ids(req);
  await deleteEntry(req.auth!.sub, roomId, fundId, entryIdParam.parse(req.params.entryId));
  sendNoContent(res);
}

export async function handleConfirmEntry(req: Request, res: Response) {
  const { roomId, fundId } = ids(req);
  sendSuccess(res, await confirmEntry(req.auth!.sub, roomId, fundId, entryIdParam.parse(req.params.entryId)), {
    message: "Confirmed",
  });
}

export async function handlePreviewClose(req: Request, res: Response) {
  const { roomId, fundId } = ids(req);
  sendSuccess(res, await previewClose(req.auth!.sub, roomId, fundId));
}

export async function handleClose(req: Request, res: Response) {
  const { roomId, fundId } = ids(req);
  sendSuccess(res, await closeFund(req.auth!.sub, roomId, fundId), { message: "Fund closed" });
}
