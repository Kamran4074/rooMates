/**
 * Room vacancy listings: someone with a spare room/bed posts it, other users
 * find it (by city/filters or "near me"), send an "I'm interested" request,
 * and the owner accepts or rejects. Every listing is reviewed by a super admin
 * before it goes public.
 *
 * Unlike the expense tables (visible only to room members), a PUBLISHED
 * listing is visible to every signed-in user - that's the point of it.
 *
 * Status lifecycle:
 *   draft -> pending -> published -> rented
 *               \-> rejected -> (edit) -> pending
 *   any -> removed (admin only)
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createTable("listings", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    owner_id: { type: "uuid", notNull: true, references: "users", onDelete: "CASCADE" },
    title: { type: "text", notNull: true },
    description: { type: "text", notNull: true },
    rent_paise: { type: "bigint", notNull: true },
    room_type: { type: "text", notNull: true },
    furnishing: { type: "text", notNull: true },
    amenities: { type: "text[]", notNull: true, default: "{}" },
    locality: { type: "text", notNull: true },
    city: { type: "text", notNull: true },
    state: { type: "text", notNull: true },
    pincode: { type: "text", notNull: true },
    // Optional: set from "use my location". Without them a listing is still
    // found by city/pincode, just not by "near me".
    latitude: { type: "numeric(9,6)" },
    longitude: { type: "numeric(9,6)" },
    available_from: { type: "date", notNull: true },
    status: { type: "text", notNull: true, default: "draft" },
    rejection_reason: { type: "text" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint("listings", "listings_rent_check", "CHECK (rent_paise > 0)");
  pgm.addConstraint(
    "listings",
    "listings_room_type_check",
    "CHECK (room_type IN ('private_room', 'shared_room', 'entire_flat'))"
  );
  pgm.addConstraint(
    "listings",
    "listings_furnishing_check",
    "CHECK (furnishing IN ('furnished', 'semi_furnished', 'unfurnished'))"
  );
  pgm.addConstraint(
    "listings",
    "listings_status_check",
    "CHECK (status IN ('draft', 'pending', 'published', 'rejected', 'rented', 'removed'))"
  );
  pgm.addConstraint("listings", "listings_pincode_check", "CHECK (pincode ~ '^[1-9][0-9]{5}$')");
  pgm.addConstraint(
    "listings",
    "listings_location_check",
    `CHECK ((latitude IS NULL) = (longitude IS NULL)
        AND (latitude IS NULL OR latitude BETWEEN -90 AND 90)
        AND (longitude IS NULL OR longitude BETWEEN -180 AND 180))`
  );

  // Indexes for the queries that actually run:
  pgm.createIndex("listings", "owner_id"); //                 "my listings"
  pgm.createIndex("listings", ["status", { name: "created_at", sort: "DESC" }]); // browse + admin queue
  pgm.sql(`CREATE INDEX listings_status_city_idx ON listings (status, lower(city));`); // city search
  pgm.createIndex("listings", ["status", "pincode"]); //      pincode search
  // "Near me" first narrows to a lat/lng box; this makes that box cheap.
  pgm.sql(`CREATE INDEX listings_location_idx ON listings (latitude, longitude) WHERE status = 'published';`);

  // Defence in depth: only a super admin (owner connection) may publish or
  // reject. Even if an API bug let an owner send status = 'published', the
  // database itself refuses it for app_user.
  pgm.sql(`
    CREATE FUNCTION listings_guard_status() RETURNS trigger AS $$
    BEGIN
      IF current_user = 'app_user'
         AND NEW.status IN ('published', 'rejected', 'removed')
         AND (TG_OP = 'INSERT' OR NEW.status IS DISTINCT FROM OLD.status) THEN
        RAISE EXCEPTION 'only an admin can set a listing to %', NEW.status USING ERRCODE = 'insufficient_privilege';
      END IF;
      NEW.updated_at := now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `);
  pgm.sql(`
    CREATE TRIGGER listings_guard_status BEFORE INSERT OR UPDATE ON listings
      FOR EACH ROW EXECUTE FUNCTION listings_guard_status();
  `);

  pgm.createTable("listing_images", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    listing_id: { type: "uuid", notNull: true, references: "listings", onDelete: "CASCADE" },
    url: { type: "text", notNull: true },
    // Cloudinary's id, needed to delete the file.
    public_id: { type: "text", notNull: true },
    is_primary: { type: "boolean", notNull: true, default: false },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.createIndex("listing_images", "listing_id");
  // At most one cover photo per listing.
  pgm.createIndex("listing_images", "listing_id", {
    name: "listing_images_one_primary",
    unique: true,
    where: "is_primary",
  });

  pgm.createTable("listing_requests", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    listing_id: { type: "uuid", notNull: true, references: "listings", onDelete: "CASCADE" },
    requester_id: { type: "uuid", notNull: true, references: "users", onDelete: "CASCADE" },
    message: { type: "text" },
    status: { type: "text", notNull: true, default: "pending" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
    updated_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint(
    "listing_requests",
    "listing_requests_status_check",
    "CHECK (status IN ('pending', 'accepted', 'rejected'))"
  );
  // One request per person per listing.
  pgm.addConstraint("listing_requests", "listing_requests_unique", "UNIQUE (listing_id, requester_id)");
  pgm.createIndex("listing_requests", "requester_id");

  pgm.createTable("listing_reports", {
    id: { type: "uuid", primaryKey: true, default: pgm.func("gen_random_uuid()") },
    listing_id: { type: "uuid", notNull: true, references: "listings", onDelete: "CASCADE" },
    reported_by: { type: "uuid", notNull: true, references: "users", onDelete: "CASCADE" },
    reason: { type: "text", notNull: true },
    description: { type: "text" },
    status: { type: "text", notNull: true, default: "open" },
    resolved_by: { type: "uuid", references: "users" },
    resolved_at: { type: "timestamptz" },
    created_at: { type: "timestamptz", notNull: true, default: pgm.func("now()") },
  });
  pgm.addConstraint(
    "listing_reports",
    "listing_reports_reason_check",
    "CHECK (reason IN ('fake_listing', 'wrong_information', 'already_rented', 'spam', 'other'))"
  );
  pgm.addConstraint(
    "listing_reports",
    "listing_reports_status_check",
    "CHECK (status IN ('open', 'resolved', 'dismissed'))"
  );
  pgm.addConstraint("listing_reports", "listing_reports_unique", "UNIQUE (listing_id, reported_by)");
  pgm.createIndex("listing_reports", ["status", { name: "created_at", sort: "DESC" }]);

  // ---------------- Row-Level Security ----------------
  // Someone who sent a request keeps seeing that listing after it's rented or
  // unpublished (their "requests I sent" page needs its title). SECURITY
  // DEFINER: a plain subquery here would recurse through listing_requests'
  // policy, which itself looks at listings.
  pgm.sql(`
    CREATE FUNCTION has_requested_listing(p_listing_id uuid) RETURNS boolean AS $$
      SELECT EXISTS (
        SELECT 1 FROM listing_requests WHERE listing_id = p_listing_id AND requester_id = app_current_user_id()
      );
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`ALTER TABLE listings ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`
    CREATE POLICY listings_select ON listings FOR SELECT
      USING (status = 'published' OR owner_id = app_current_user_id() OR has_requested_listing(id));
  `);
  pgm.sql(`CREATE POLICY listings_insert ON listings FOR INSERT WITH CHECK (owner_id = app_current_user_id());`);
  pgm.sql(`
    CREATE POLICY listings_update ON listings FOR UPDATE
      USING (owner_id = app_current_user_id()) WITH CHECK (owner_id = app_current_user_id());
  `);
  pgm.sql(`CREATE POLICY listings_delete ON listings FOR DELETE USING (owner_id = app_current_user_id());`);

  // Photos follow their listing: the subquery runs under listings' own RLS.
  pgm.sql(`ALTER TABLE listing_images ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`
    CREATE POLICY listing_images_select ON listing_images FOR SELECT
      USING (EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id));
  `);
  pgm.sql(`
    CREATE POLICY listing_images_write ON listing_images FOR ALL
      USING (EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id AND l.owner_id = app_current_user_id()))
      WITH CHECK (EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id AND l.owner_id = app_current_user_id()));
  `);

  // A request is visible to the person who sent it and the listing's owner.
  pgm.sql(`ALTER TABLE listing_requests ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`
    CREATE POLICY listing_requests_select ON listing_requests FOR SELECT
      USING (requester_id = app_current_user_id()
             OR EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id AND l.owner_id = app_current_user_id()));
  `);
  pgm.sql(`
    CREATE POLICY listing_requests_insert ON listing_requests FOR INSERT
      WITH CHECK (requester_id = app_current_user_id() AND status = 'pending');
  `);
  // Only the owner answers (accept/reject).
  pgm.sql(`
    CREATE POLICY listing_requests_update ON listing_requests FOR UPDATE
      USING (EXISTS (SELECT 1 FROM listings l WHERE l.id = listing_id AND l.owner_id = app_current_user_id()));
  `);

  // Users file reports; only admins (owner connection) read them.
  pgm.sql(`ALTER TABLE listing_reports ENABLE ROW LEVEL SECURITY;`);
  pgm.sql(`
    CREATE POLICY listing_reports_insert ON listing_reports FOR INSERT
      WITH CHECK (reported_by = app_current_user_id() AND status = 'open');
  `);
  pgm.sql(`CREATE POLICY listing_reports_select ON listing_reports FOR SELECT USING (reported_by = app_current_user_id());`);

  // Owner and requester may see each other's user row (name, and - only once
  // accepted, which the API enforces - phone/email). SECURITY DEFINER because
  // it's used by the users policy and must read listings/requests directly.
  pgm.sql(`
    CREATE FUNCTION is_listing_counterparty(p_other_user uuid) RETURNS boolean AS $$
      SELECT EXISTS (
        SELECT 1 FROM listing_requests r JOIN listings l ON l.id = r.listing_id
        WHERE (r.requester_id = app_current_user_id() AND l.owner_id = p_other_user)
           OR (r.requester_id = p_other_user AND l.owner_id = app_current_user_id())
      );
    $$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;
  `);
  pgm.sql(`DROP POLICY users_select ON users;`);
  pgm.sql(`
    CREATE POLICY users_select ON users FOR SELECT
      USING (id = app_current_user_id() OR shares_room_with(id) OR is_listing_counterparty(id));
  `);
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.sql(`DROP POLICY users_select ON users;`);
  pgm.sql(`
    CREATE POLICY users_select ON users FOR SELECT
      USING (id = app_current_user_id() OR shares_room_with(id));
  `);
  pgm.sql(`DROP FUNCTION IF EXISTS is_listing_counterparty(uuid);`);
  pgm.dropTable("listing_reports", { ifExists: true });
  pgm.dropTable("listing_requests", { ifExists: true });
  pgm.dropTable("listing_images", { ifExists: true });
  pgm.dropTable("listings", { ifExists: true });
  pgm.sql(`DROP FUNCTION IF EXISTS has_requested_listing(uuid);`);
  pgm.sql(`DROP FUNCTION IF EXISTS listings_guard_status();`);
};
