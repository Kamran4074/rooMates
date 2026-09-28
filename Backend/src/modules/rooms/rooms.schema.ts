import { z } from "zod";

export const createRoomSchema = z.object({
  name: z.string().min(1, "Room name is required").max(100),
  type: z.enum(["roommates", "trip"]),
});

export const joinRoomSchema = z.object({
  inviteCode: z.string().min(1, "Invite code is required"),
});

export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type JoinRoomInput = z.infer<typeof joinRoomSchema>;
