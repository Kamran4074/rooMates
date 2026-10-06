/**
 * 1. Exactly one admin per room, enforced by the database. The code already
 *    only ever creates one; this partial unique index makes a second admin
 *    impossible even through a bug or a manual query.
 *
 * 2. expenses.expense_date: the day the money was actually spent, which isn't
 *    always the day it's entered ("Bhavya bought milk yesterday"). Monthly
 *    views group by this date instead of created_at. Existing rows get the
 *    (Indian) calendar day they were created.
 *
 *    The room-expenses index moves from created_at to expense_date, which is
 *    what the list is now sorted by.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const up = (pgm) => {
  pgm.createIndex("room_members", "room_id", {
    name: "room_members_one_admin",
    unique: true,
    where: "role = 'admin'",
  });

  pgm.addColumn("expenses", {
    expense_date: { type: "date" },
  });
  pgm.sql(`UPDATE expenses SET expense_date = (created_at AT TIME ZONE 'Asia/Kolkata')::date;`);
  pgm.alterColumn("expenses", "expense_date", {
    notNull: true,
    default: pgm.func("(now() AT TIME ZONE 'Asia/Kolkata')::date"),
  });

  pgm.dropIndex("expenses", ["room_id", "created_at"], { name: "expenses_room_id_created_at_index" });
  pgm.createIndex("expenses", ["room_id", { name: "expense_date", sort: "DESC" }, { name: "created_at", sort: "DESC" }], {
    name: "expenses_room_date_index",
  });
};

/**
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */
export const down = (pgm) => {
  pgm.dropIndex("expenses", [], { name: "expenses_room_date_index" });
  pgm.createIndex("expenses", ["room_id", { name: "created_at", sort: "DESC" }]);
  pgm.dropColumn("expenses", "expense_date");
  pgm.dropIndex("room_members", "room_id", { name: "room_members_one_admin" });
};
