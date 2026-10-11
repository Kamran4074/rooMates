// What each plan allows. The database stores the numbers per organization
// (organizations.max_rooms / max_members_per_room) so a deal for one customer
// doesn't need a deploy; these are what switching plan sets them to.
export const PLAN_LIMITS = {
  free: { maxRooms: 2, maxMembersPerRoom: 4 },
  paid: { maxRooms: 10, maxMembersPerRoom: 20 },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;
