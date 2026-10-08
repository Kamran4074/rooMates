import { z } from "zod";

export const roomIdParam = z.string().uuid("Invalid room id");

// Any other uuid in the URL (expenseId, settlementId, ...).
export const uuidParam = (label: string) => z.string().uuid(`Invalid ${label} id`);
