import { z } from "zod";

const memberIds = z
  .array(z.string().uuid("Invalid member"))
  .min(1, "Pick at least one person")
  .max(100);

// A section of the room's bills (Rent, Groceries, WiFi...) and who shares it.
export const createCategorySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(40),
  memberIds,
});

export const updateCategorySchema = z
  .object({
    name: z.string().trim().min(1, "Name is required").max(40).optional(),
    memberIds: memberIds.optional(),
  })
  .refine((d) => d.name !== undefined || d.memberIds !== undefined, { message: "Nothing to change" });

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
