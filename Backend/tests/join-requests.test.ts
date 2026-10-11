import { withUserContext } from "../src/config/db";
import { api, cleanup, createUser, joinRoom, startServer, TestUser } from "./helpers";

// Joining with an invite code needs the room admin's approval.

let admin: TestUser, member: TestUser;
let roomId: string, inviteCode: string;

beforeAll(async () => {
  await startServer();
  [admin, member] = await Promise.all([createUser(), createUser()]);
  const room = await api(admin, "POST", "/api/rooms", { name: "Approval flat", type: "roommates" });
  roomId = room.body.data.id;
  inviteCode = room.body.data.inviteCode;
  await joinRoom(member, inviteCode);
});
afterAll(cleanup);

describe("join requests", () => {
  it("a code files a request; nothing is visible until the admin approves", async () => {
    const taha = await createUser();
    const res = await api(taha, "POST", "/api/rooms/join", { inviteCode });
    expect(res.status).toBe(202);
    expect(res.body.data).toEqual(expect.objectContaining({ id: roomId, name: "Approval flat", status: "pending" }));
    expect((await api(taha, "GET", `/api/rooms/${roomId}`)).status).toBe(404); // not a member yet

    // Asking again returns the same open request.
    const again = await api(taha, "POST", "/api/rooms/join", { inviteCode });
    expect(again.body.data.requestId).toBe(res.body.data.requestId);

    const mine = await api(taha, "GET", "/api/rooms/join-requests");
    expect(mine.body.data.mine).toEqual([expect.objectContaining({ room_id: roomId, room_name: "Approval flat" })]);
    const adminView = await api(admin, "GET", "/api/rooms/join-requests");
    expect(adminView.body.data.toApprove).toEqual([expect.objectContaining({ room_id: roomId, user_id: taha.id })]);
    // A regular member can't see or decide it.
    expect((await api(member, "GET", "/api/rooms/join-requests")).body.data.toApprove).toEqual([]);
    const approvePath = `/api/rooms/${roomId}/join-requests/${res.body.data.requestId}/approve`;
    expect((await api(member, "POST", approvePath)).status).toBe(403);
    expect((await api(taha, "POST", approvePath)).status).toBe(404); // not in the room at all

    expect((await api(admin, "POST", approvePath)).status).toBe(200);
    expect((await api(taha, "GET", `/api/rooms/${roomId}`)).status).toBe(200);
    expect((await api(admin, "POST", approvePath)).status).toBe(409); // already decided
    expect((await api(taha, "POST", "/api/rooms/join", { inviteCode })).status).toBe(409); // already a member
  });

  it("a rejected request doesn't get in, and can ask again", async () => {
    const stranger = await createUser();
    const res = await api(stranger, "POST", "/api/rooms/join", { inviteCode });
    expect((await api(admin, "POST", `/api/rooms/${roomId}/join-requests/${res.body.data.requestId}/reject`)).status).toBe(200);
    expect((await api(stranger, "GET", `/api/rooms/${roomId}`)).status).toBe(404);
    expect((await api(stranger, "GET", "/api/rooms/join-requests")).body.data.mine).toEqual([]);
    expect((await api(stranger, "POST", "/api/rooms/join", { inviteCode })).status).toBe(202);
  });

  it("the database won't let anyone add themselves to a room", async () => {
    const sneaky = await createUser();
    await expect(
      withUserContext(sneaky.id, (client) =>
        client.query("INSERT INTO room_members (room_id, user_id, role) VALUES ($1, $2, 'member')", [roomId, sneaky.id])
      )
    ).rejects.toThrow(/row-level security/);
  });
});

describe("notifications start when you join", () => {
  it("a new member doesn't see what happened before they joined", async () => {
    await api(admin, "POST", `/api/rooms/${roomId}/expenses`, { description: "Old rent", amount: 900, splitType: "equal" });
    const latecomer = await createUser();
    await joinRoom(latecomer, inviteCode);

    const feed = (await api(latecomer, "GET", `/api/notifications?roomId=${roomId}&limit=50`)).body.data as { type: string; data: { description?: string } }[];
    expect(feed.some((e) => e.data.description === "Old rent")).toBe(false);
    expect(feed.map((e) => e.type)).toContain("member_joined"); // their own joining is shown
    expect((await api(latecomer, "GET", "/api/notifications/unread-count")).body.data.count).toBe(1); // "admin approved you"

    const adminFeed = (await api(admin, "GET", `/api/notifications?roomId=${roomId}&limit=50`)).body.data as {
      type: string;
      subject_id: string;
      data: { name?: string };
    }[];
    expect(adminFeed.map((e) => e.type)).toEqual(expect.arrayContaining(["join_requested", "join_rejected"]));
    // The requester isn't a member, so their name travels on the event itself.
    const asked = adminFeed.find((e) => e.type === "join_requested" && e.subject_id === latecomer.id);
    expect(asked?.data.name).toEqual(expect.stringMatching(/^Test /));
  });
});
