/**
 * One account per mobile number - makes it harder to farm free-tier rooms by
 * signing up with lots of throwaway emails. Phones are stored normalised as
 * +91XXXXXXXXXX so "98765 43210" and "+919876543210" count as the same number.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  // Normalise existing values: keep the last 10 digits of valid Indian mobiles.
  pgm.sql(`
    UPDATE users
    SET phone = '+91' || right(regexp_replace(phone, '[^0-9]', '', 'g'), 10)
    WHERE phone IS NOT NULL
      AND regexp_replace(phone, '[^0-9]', '', 'g') ~ '^(91|0)?[6-9][0-9]{9}$';
  `);
  pgm.sql(`UPDATE users SET phone = NULL WHERE phone IS NOT NULL AND phone !~ '^\\+91[6-9][0-9]{9}$';`);

  // If two existing accounts share a number, the older one keeps it.
  pgm.sql(`
    UPDATE users u SET phone = NULL
    WHERE phone IS NOT NULL
      AND EXISTS (SELECT 1 FROM users o WHERE o.phone = u.phone AND o.created_at < u.created_at);
  `);

  // Anyone left without a phone is sent back through onboarding to add one.
  pgm.sql(`UPDATE users SET onboarding_completed = false WHERE phone IS NULL;`);

  pgm.addConstraint("users", "users_phone_format", "CHECK (phone IS NULL OR phone ~ '^\\+91[6-9][0-9]{9}$')");
  // Partial index: phone stays NULL for accounts mid-onboarding, and many NULLs are fine.
  pgm.createIndex("users", "phone", { name: "users_phone_unique", unique: true, where: "phone IS NOT NULL" });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropIndex("users", "phone", { name: "users_phone_unique" });
  pgm.dropConstraint("users", "users_phone_format");
};
