import { Request, Response } from "express";
import { roomIdParam } from "../../utils/validation";
import { createRoomSchema, joinRoomSchema } from "./rooms.schema";
import { createRoom, joinRoom, listMyRooms, listRoomMembers, getRoomById } from "./rooms.service";

// Express 5 forwards rejected promises from async handlers to the error
// middleware, so controllers don't need try/catch + next(err).

export async function handleCreateRoom(req: Request, res: Response) {
  const room = await createRoom(req.auth!.sub, req.auth!.organizationId, createRoomSchema.parse(req.body));
  res.status(201).json(room);
}

export async function handleJoinRoom(req: Request, res: Response) {
  const { inviteCode } = joinRoomSchema.parse(req.body);
  res.json(await joinRoom(req.auth!.sub, inviteCode));
}

export async function handleGetMyRooms(req: Request, res: Response) {
  res.json(await listMyRooms(req.auth!.sub));
}

export async function handleGetRoom(req: Request, res: Response) {
  res.json(await getRoomById(req.auth!.sub, roomIdParam.parse(req.params.roomId)));
}

export async function handleGetRoomMembers(req: Request, res: Response) {
  res.json(await listRoomMembers(req.auth!.sub, roomIdParam.parse(req.params.roomId)));
}
