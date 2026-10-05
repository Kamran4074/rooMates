import { apiAuthDelete, apiAuthPost } from "@/lib/api";

// Room fund actions. (Reads go through useApiQuery.)

const base = (roomId: string, fundId: string) => `/api/rooms/${roomId}/funds/${fundId}`;

export interface CreateFundInput {
  name: string;
  amountPerMember: number;
  participantIds: string[];
  collectorId: string;
}

export const createFund = (roomId: string, input: CreateFundInput) =>
  apiAuthPost<{ id: string }>(`/api/rooms/${roomId}/funds`, input);

/** Collector/admin: "yes, I got this payment", or after closing: "this refund/collection is done". */
export const confirmFundEntry = (roomId: string, fundId: string, entryId: string) =>
  apiAuthPost(`${base(roomId, fundId)}/entries/${entryId}/confirm`, {});

/** Delete your own entry, or (collector/admin) reject a payment that never arrived. */
export const deleteFundEntry = (roomId: string, fundId: string, entryId: string) =>
  apiAuthDelete(`${base(roomId, fundId)}/entries/${entryId}`);

export const closeFund = (roomId: string, fundId: string) => apiAuthPost(`${base(roomId, fundId)}/close`, {});
