import { z } from "zod";

export const roomIdParam = z.string().uuid("Invalid room id");
