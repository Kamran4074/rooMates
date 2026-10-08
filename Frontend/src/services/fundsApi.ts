import { apiAuthDelete, apiAuthPost } from "@/lib/api";

// Room fund actions. (Reads go through useApiQuery.)

const base = (roomId: string, fundId: string) => `/api/rooms/${roomId}/funds/${fundId}`;

export interface CreateFundInput {
  name: string;
  amountPerMember: number;
  /** Everyone in the room is in the fund; only who collects is chosen. */
  collectorId: string;
}

export const createFund = (roomId: string, input: CreateFundInput) =>
  apiAuthPost<{ id: string }>(`/api/rooms/${roomId}/funds`, input);

/**
 * The other side agrees: the collector confirms a member's own record, the
 * member approves a record the collector made for them, or (after closing)
 * the collector marks a refund/collection done.
 */
export const confirmFundEntry = (roomId: string, fundId: string, entryId: string) =>
  apiAuthPost(`${base(roomId, fundId)}/entries/${entryId}/confirm`, {});

/** Delete your own entry, or (collector/admin) reject a payment that never arrived. */
export const deleteFundEntry = (roomId: string, fundId: string, entryId: string) =>
  apiAuthDelete(`${base(roomId, fundId)}/entries/${entryId}`);

export const closeFund = (roomId: string, fundId: string) => apiAuthPost(`${base(roomId, fundId)}/close`, {});

/** The member says the collector's record about them is wrong. */
export const disputeFundEntry = (roomId: string, fundId: string, entryId: string, note: string) =>
  apiAuthPost(`${base(roomId, fundId)}/entries/${entryId}/dispute`, { note });
