import { z } from "zod";

export const contactSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  email: z.string().email("Invalid email"),
  message: z.string().min(10, "Message should be at least 10 characters").max(2000),
});
