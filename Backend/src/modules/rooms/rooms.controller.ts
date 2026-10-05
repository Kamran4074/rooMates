import { Request, Response } from "express";
import { sendCreated, sendNoContent, sendSuccess } from "../../utils/response";
import { z } from "zod";
import { roomIdParam } from "../../utils/validation";
import { createRoomSchema, joinRoomSchema } from "./rooms.schema";
import {
  createRoom,
  joinRoom,
  listMyRooms,
  listRoomMembers,
  getRoomById,
  removeMember,
  resetInviteCode,
} from "./rooms.service";

// Express 5 forwards rejected promises from async handlers to the error
// middleware, so controllers don't need try/catch + next(err).

export async function handleCreateRoom(req: Request, res: Response) {
  const room = await createRoom(req.auth!.sub, req.auth!.organizationId, createRoomSchema.parse(req.body));
  sendCreated(res, room, "Room created");
}

export async function handleJoinRoom(req: Request, res: Response) {
  const { inviteCode } = joinRoomSchema.parse(req.body);
  sendSuccess(res, await joinRoom(req.auth!.sub, inviteCode), { message: "Joined the room" });
}

export async function handleGetMyRooms(req: Request, res: Response) {
  sendSuccess(res, await listMyRooms(req.auth!.sub));
}

export async function handleGetRoom(req: Request, res: Response) {
  sendSuccess(res, await getRoomById(req.auth!.sub, roomIdParam.parse(req.params.roomId)));
}

export async function handleGetRoomMembers(req: Request, res: Response) {
  sendSuccess(res, await listRoomMembers(req.auth!.sub, roomIdParam.parse(req.params.roomId)));
}

export async function handleRemoveMember(req: Request, res: Response) {
  const roomId = roomIdParam.parse(req.params.roomId);
  const memberId = z.string().uuid("Invalid member id").parse(req.params.userId);
  await removeMember(req.auth!.sub, roomId, memberId);
  sendNoContent(res);
}

export async function handleResetInviteCode(req: Request, res: Response) {
  sendSuccess(res, await resetInviteCode(req.auth!.sub, roomIdParam.parse(req.params.roomId)));
}
