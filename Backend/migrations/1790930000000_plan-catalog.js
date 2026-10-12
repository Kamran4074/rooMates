/**
 * The price list moves from code into the database, so the super admin can
 * change prices, limits and what each plan unlocks from the admin console
 * without a deploy.
 *
 * The three plans themselves are fixed (basic / standard / premium): each
 * feature flag is checked in code, so a new plan or feature still means code.
 * Seeded with the values the app shipped with.
 *
 * Everyone can read it (it's the public price list); only the owner role
 * (the admin console) can change it.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("plan_catalog", {
    id: { type: "text", primaryKey: true, check: "id IN ('basic', 'standard', 'premium')" },
    sort_order: { type: "smallint", notNull: true },
    name: { type: "text", notNull: true, check: "char_length(name) BETWEEN 2 AND 30" },
    tagline: { type: "text", notNull: true, check: "char_length(tagline) <= 120" },
    price_monthly_paise: { type: "integer", notNull: true, check: "price_monthly_paise >= 0" },
    price_yearly_paise: { type: "integer", notNull: true, check: "price_yearly_paise >= 0" },
    max_rooms: { type: "integer", notNull: true, check: "max_rooms BETWEEN 1 AND 100" },
    // Same range as organizations.max_members_per_room.
    max_members_per_room: { type: "integer", notNull: true, check: "max_members_per_room BETWEEN 2 AND 100" },
    max_listings: { type: "integer", notNull: true, check: "max_listings BETWEEN 0 AND 100" },
    unlimited: { type: "boolean", notNull: true, default: false },
    feature_room_fund: { type: "boolean", notNull: true },
    feature_bill_sections: { type: "boolean", notNull: true },
    feature_find_room: { type: "boolean", notNull: true },
    support: { type: "text", notNull: true, check: "char_length(support) <= 40" },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_by: { type: "uuid", references: "users", onDelete: "SET NULL" },
  });
  // Basic is the free plan everyone falls back to; paid plans must cost something.
  pgm.addConstraint("plan_catalog", "plan_catalog_prices", {
    check: "(id = 'basic') = (price_monthly_paise = 0 AND price_yearly_paise = 0)",
  });

  pgm.sql(`
    INSERT INTO plan_catalog (id, sort_order, name, tagline, price_monthly_paise, price_yearly_paise, max_rooms, max_members_per_room,
                              max_listings, unlimited, feature_room_fund, feature_bill_sections, feature_find_room, support)
    VALUES
      ('basic', 1, 'Basic', 'Split rent, bills and trips with a small group.', 0, 0, 2, 4, 0, false, false, false, false, 'Email'),
      ('standard', 2, 'Standard', 'Everything unlocked for a busy flat or a group trip.', 4900, 49000, 5, 10, 2, false, true, true, true, 'Email'),
      ('premium', 3, 'Premium', 'No limits, for hostels, PGs and big groups.', 9900, 99000, 100, 100, 10, true, true, true, true, 'Priority (phone)');
  `);
  // An organization's plan must be one in the list.
  pgm.addConstraint("organizations", "organizations_plan_fkey", { foreignKeys: { columns: "plan", references: "plan_catalog(id)" } });

  // Public data, so no row security - but the app role may only read it.
  pgm.sql(`REVOKE INSERT, UPDATE, DELETE ON plan_catalog FROM app_user;`);
  pgm.sql(`GRANT SELECT ON plan_catalog TO app_user;`);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropConstraint("organizations", "organizations_plan_fkey");
  pgm.dropTable("plan_catalog");
};
