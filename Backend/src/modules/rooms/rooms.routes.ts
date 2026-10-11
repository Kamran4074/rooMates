import { Router } from "express";
import { joinLimiter } from "../../middlewares/rateLimit";
import { authenticate } from "../../middlewares/authenticate";
import {
  handleCreateRoom,
  handleJoinRoom,
  handleListJoinRequests,
  handleApproveJoinRequest,
  handleRejectJoinRequest,
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
router.post("/join", joinLimiter, handleJoinRoom);
router.get("/join-requests", handleListJoinRequests); // before "/:roomId"
router.get("/:roomId", handleGetRoom);
router.get("/:roomId/members", handleGetRoomMembers);
router.delete("/:roomId/members/:userId", handleRemoveMember);
router.post("/:roomId/invite-code", handleResetInviteCode);
router.post("/:roomId/join-requests/:requestId/approve", handleApproveJoinRequest);
router.post("/:roomId/join-requests/:requestId/reject", handleRejectJoinRequest);

export default router;
