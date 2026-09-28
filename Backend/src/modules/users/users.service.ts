import { withUserContext } from "../../config/db";
import { CompleteOnboardingInput } from "./users.schema";

export async function completeOnboarding(userId: string, input: CompleteOnboardingInput) {
  return withUserContext(userId, async (client) => {
    const result = await client.query(
      `UPDATE users SET name = $1, phone = $2, onboarding_completed = true
       WHERE id = $3
       RETURNING id, email, name, phone, picture, onboarding_completed`,
      [input.name, input.phone ?? null, userId]
    );
    return result.rows[0];
  });
}
