import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import {
  handleCreateRoom,
  handleJoinRoom,
  handleGetMyRooms,
  handleGetRoom,
  handleGetRoomMembers,
  handleRemoveMember,
  handleResetInviteCode,
} from "./rooms.controller";

const router = Router();

router.use(authenticate);

router.get("/", handleGetMyRooms);
router.post("/", handleCreateRoom);
router.post("/join", handleJoinRoom);
router.get("/:roomId", handleGetRoom);
router.get("/:roomId/members", handleGetRoomMembers);
router.delete("/:roomId/members/:userId", handleRemoveMember);
router.post("/:roomId/invite-code", handleResetInviteCode);

export default router;
