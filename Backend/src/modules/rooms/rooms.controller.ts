import { Request, Response, NextFunction } from "express";
import { z } from "zod";
import { createRoomSchema, joinRoomSchema } from "./rooms.schema";
import { createRoom, joinRoom, listMyRooms, listRoomMembers, getRoomById } from "./rooms.service";

const roomIdParamSchema = z.string().uuid("Invalid room id");

export async function handleCreateRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createRoomSchema.parse(req.body);
    const room = await createRoom(req.auth!.sub, req.auth!.organizationId, input);
    res.status(201).json(room);
  } catch (err) {
    next(err);
  }
}

export async function handleJoinRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const { inviteCode } = joinRoomSchema.parse(req.body);
    const room = await joinRoom(req.auth!.sub, inviteCode);
    res.status(200).json(room);
  } catch (err) {
    next(err);
  }
}

export async function handleGetMyRooms(req: Request, res: Response, next: NextFunction) {
  try {
    const rooms = await listMyRooms(req.auth!.sub);
    res.status(200).json(rooms);
  } catch (err) {
    next(err);
  }
}

export async function handleGetRoom(req: Request, res: Response, next: NextFunction) {
  try {
    const roomId = roomIdParamSchema.parse(req.params.roomId);
    const room = await getRoomById(req.auth!.sub, roomId);
    res.status(200).json(room);
  } catch (err) {
    next(err);
  }
}

export async function handleGetRoomMembers(req: Request, res: Response, next: NextFunction) {
  try {
    const roomId = roomIdParamSchema.parse(req.params.roomId);
    const members = await listRoomMembers(req.auth!.sub, roomId);
    res.status(200).json(members);
  } catch (err) {
    next(err);
  }
}
