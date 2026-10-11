import { apiAuthPost } from "@/lib/api";

// Room admin: let someone in (they become a member) or turn them away.
// Lists come from the joinRequestsStore (GET /api/rooms/join-requests).

const path = (roomId: string, requestId: string, action: "approve" | "reject") =>
  `/api/rooms/${roomId}/join-requests/${requestId}/${action}`;

export const approveJoinRequest = (roomId: string, requestId: string) => apiAuthPost(path(roomId, requestId, "approve"), {});
export const rejectJoinRequest = (roomId: string, requestId: string) => apiAuthPost(path(roomId, requestId, "reject"), {});
