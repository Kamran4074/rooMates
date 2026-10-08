/**
 * Onboarding tracker (super admin): when did each person verify their email
 * and finish their profile? Until now only true/false was stored.
 *
 * One trigger stamps the time whenever the flag turns true - whichever path
 * set it (password signup + OTP, Google sign-in, the onboarding page, the
 * SECURITY DEFINER auth functions, the super admin seed) - and clears it if
 * the flag is turned off again, so the two can never disagree.
 *
 * Existing accounts: verified -> their signup time; profile done -> when they
 * first joined a group, else their signup time. Best available estimate.
 *
 * The other funnel steps already have timestamps: first group =
 * room_members.joined_at, first expense = expenses.created_at.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.addColumns("users", {
    email_verified_at: { type: "timestamptz" },
    onboarding_completed_at: { type: "timestamptz" },
  });
  pgm.sql(`
    UPDATE users u SET
      email_verified_at = CASE WHEN u.email_verified THEN u.created_at END,
      onboarding_completed_at = CASE WHEN u.onboarding_completed THEN
        COALESCE((SELECT min(rm.joined_at) FROM room_members rm WHERE rm.user_id = u.id), u.created_at)
      END;
  `);

  pgm.sql(`
    CREATE FUNCTION stamp_user_milestones() RETURNS trigger AS $$
    BEGIN
      IF NEW.email_verified THEN
        NEW.email_verified_at := COALESCE(NEW.email_verified_at, now());
      ELSE
        NEW.email_verified_at := NULL;
      END IF;
      IF NEW.onboarding_completed THEN
        NEW.onboarding_completed_at := COALESCE(NEW.onboarding_completed_at, now());
      ELSE
        NEW.onboarding_completed_at := NULL;
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  pgm.sql(`
    CREATE TRIGGER users_stamp_milestones BEFORE INSERT OR UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION stamp_user_milestones();
  `);
  // The tracker's "first expense" lookup by creator.
  pgm.createIndex("expenses", "created_by", { name: "expenses_created_by_live_index", where: "deleted_at IS NULL" });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropIndex("expenses", [], { name: "expenses_created_by_live_index" });
  pgm.sql(`DROP TRIGGER users_stamp_milestones ON users;`);
  pgm.sql(`DROP FUNCTION stamp_user_milestones();`);
  pgm.dropColumns("users", ["email_verified_at", "onboarding_completed_at"]);
};
