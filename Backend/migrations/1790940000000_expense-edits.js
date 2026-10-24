/**
 * Editing an expense.
 *
 * 1. expenses.edited_at / edited_by: when an expense was last changed and by
 *    whom (shown as "edited" in the app). Both set or both empty.
 *
 * 2. expense_splits can now be rewritten (an edit replaces an expense's
 *    shares). Writing shares - adding OR removing - is limited to the people
 *    who may change the expense itself: whoever added it, or the room admin,
 *    and only while it isn't deleted. The same rule as expenses_update.
 *    Before, the insert policy let any member of the room add a share to any
 *    expense in it; the API never did that, but the database didn't stop it.
 *
 * 3. The activity trigger logs "expense_edited" with what changed, old and
 *    new ({"amount_paise": [90000, 95000], ...}). An empty "changes" means
 *    only who shares it changed. The feed stays append-only, so an edit can't
 *    hide what the expense said before.
 *
 * @param pgm {import('node-pg-migrate').MigrationBuilder}
 */

const MINE = "(SELECT my_room_ids())::uuid[]";

// The expense this share belongs to may be changed by the current user.
const CAN_EDIT_EXPENSE = `EXISTS (
  SELECT 1 FROM expenses e
  WHERE e.id = expense_splits.expense_id AND e.deleted_at IS NULL
    AND (e.created_by = app_current_user_id() OR is_room_admin(e.room_id))
)`;

export const up = (pgm) => {
  pgm.addColumns("expenses", {
    edited_at: { type: "timestamptz" },
    edited_by: { type: "uuid", references: "users" },
  });
  pgm.addConstraint("expenses", "expenses_edited_pair", { check: "(edited_at IS NULL) = (edited_by IS NULL)" });

  pgm.sql(`DROP POLICY expense_splits_insert ON expense_splits;`);
  pgm.sql(`
    CREATE POLICY expense_splits_insert ON expense_splits FOR INSERT
      WITH CHECK (room_id = ANY (${MINE}) AND ${CAN_EDIT_EXPENSE});
  `);
  pgm.sql(`
    CREATE POLICY expense_splits_delete ON expense_splits FOR DELETE
      USING (room_id = ANY (${MINE}) AND ${CAN_EDIT_EXPENSE});
  `);

  pgm.sql(`
    CREATE OR REPLACE FUNCTION log_expense_activity() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM log_activity(NEW.room_id, 'expense_added', NEW.created_by, NEW.paid_by, NEW.amount_paise,
          jsonb_build_object('expense_id', NEW.id, 'description', NEW.description, 'expense_date', NEW.expense_date,
                             'category', (SELECT name FROM expense_categories WHERE id = NEW.category_id)));
      ELSIF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        PERFORM log_activity(NEW.room_id, 'expense_deleted', NEW.deleted_by, NEW.paid_by, NEW.amount_paise,
          jsonb_build_object('expense_id', NEW.id, 'description', NEW.description));
      ELSIF NEW.deleted_at IS NULL AND NEW.edited_at IS DISTINCT FROM OLD.edited_at THEN
        PERFORM log_activity(NEW.room_id, 'expense_edited', NEW.edited_by, NEW.paid_by, NEW.amount_paise,
          jsonb_build_object(
            'expense_id', NEW.id,
            'description', NEW.description,
            -- Only the fields that changed, each as [old, new].
            'changes', jsonb_strip_nulls(jsonb_build_object(
              'description', CASE WHEN OLD.description IS DISTINCT FROM NEW.description
                THEN jsonb_build_array(OLD.description, NEW.description) END,
              'amount_paise', CASE WHEN OLD.amount_paise IS DISTINCT FROM NEW.amount_paise
                THEN jsonb_build_array(OLD.amount_paise, NEW.amount_paise) END,
              'expense_date', CASE WHEN OLD.expense_date IS DISTINCT FROM NEW.expense_date
                THEN jsonb_build_array(OLD.expense_date, NEW.expense_date) END,
              'paid_by', CASE WHEN OLD.paid_by IS DISTINCT FROM NEW.paid_by
                THEN jsonb_build_array((SELECT name FROM users WHERE id = OLD.paid_by),
                                       (SELECT name FROM users WHERE id = NEW.paid_by)) END,
              'category', CASE WHEN OLD.category_id IS DISTINCT FROM NEW.category_id
                THEN jsonb_build_array((SELECT name FROM expense_categories WHERE id = OLD.category_id),
                                       (SELECT name FROM expense_categories WHERE id = NEW.category_id)) END
            ))));
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    CREATE OR REPLACE FUNCTION log_expense_activity() RETURNS trigger AS $$
    BEGIN
      IF TG_OP = 'INSERT' THEN
        PERFORM log_activity(NEW.room_id, 'expense_added', NEW.created_by, NEW.paid_by, NEW.amount_paise,
          jsonb_build_object('expense_id', NEW.id, 'description', NEW.description, 'expense_date', NEW.expense_date,
                             'category', (SELECT name FROM expense_categories WHERE id = NEW.category_id)));
      ELSIF OLD.deleted_at IS NULL AND NEW.deleted_at IS NOT NULL THEN
        PERFORM log_activity(NEW.room_id, 'expense_deleted', NEW.deleted_by, NEW.paid_by, NEW.amount_paise,
          jsonb_build_object('expense_id', NEW.id, 'description', NEW.description));
      END IF;
      RETURN NULL;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
  `);

  pgm.sql(`DROP POLICY expense_splits_delete ON expense_splits;`);
  pgm.sql(`DROP POLICY expense_splits_insert ON expense_splits;`);
  pgm.sql(`CREATE POLICY expense_splits_insert ON expense_splits FOR INSERT WITH CHECK (room_id = ANY (${MINE}));`);

  pgm.dropConstraint("expenses", "expenses_edited_pair");
  pgm.dropColumns("expenses", ["edited_at", "edited_by"]);
};
