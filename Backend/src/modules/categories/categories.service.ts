import { PoolClient } from "pg";
import { withUserContext } from "../../config/db";
import { AppError } from "../../middlewares/errorHandler";
import { getMemberIds, requireMember, requireRoomAdmin } from "../rooms/rooms.repository";
import { CreateCategoryInput, UpdateCategoryInput } from "./categories.schema";

// Sections of a room's bills (Rent, Groceries, WiFi...) and who shares each.
// Only the room admin edits them (checked here for a clear message, and by
// RLS); everyone in the room can see them and file expenses under them.
// People joining/leaving the room are added to/removed from every section by
// a database trigger.

export interface Category {
  id: string;
  name: string;
  member_ids: string[];
}

const CATEGORY_SELECT = `
  SELECT c.id, c.name,
         ARRAY(SELECT cm.user_id FROM expense_category_members cm WHERE cm.category_id = c.id) AS member_ids
  FROM expense_categories c`;

export async function getCategory(client: PoolClient, roomId: string, categoryId: string): Promise<Category> {
  const { rows } = await client.query<Category>(`${CATEGORY_SELECT} WHERE c.id = $1 AND c.room_id = $2`, [categoryId, roomId]);
  if (!rows[0]) throw new AppError("Section not found", 404);
  return rows[0];
}

async function checkMembers(client: PoolClient, roomId: string, ids: string[]) {
  const roomMembers = new Set(await getMemberIds(client, roomId));
  if (ids.some((id) => !roomMembers.has(id))) throw new AppError("Everyone in a section must be a member of this room", 400);
}

const duplicateName = (err: unknown) => (err as { code?: string }).code === "23505";

export async function listCategories(userId: string, roomId: string) {
  return withUserContext(userId, async (client) => {
    await requireMember(client, roomId, userId);
    const { rows } = await client.query<Category>(`${CATEGORY_SELECT} WHERE c.room_id = $1 ORDER BY lower(c.name)`, [roomId]);
    return rows;
  });
}

export async function createCategory(userId: string, roomId: string, input: CreateCategoryInput) {
  return withUserContext(userId, async (client) => {
    await requireRoomAdmin(client, roomId, userId);
    const memberIds = [...new Set(input.memberIds)];
    await checkMembers(client, roomId, memberIds);
    try {
      const { rows } = await client.query<{ id: string }>(
        "INSERT INTO expense_categories (room_id, name, created_by) VALUES ($1, $2, $3) RETURNING id",
        [roomId, input.name, userId]
      );
      await client.query(
        "INSERT INTO expense_category_members (category_id, user_id) SELECT $1, unnest($2::uuid[])",
        [rows[0].id, memberIds]
      );
      return { id: rows[0].id, name: input.name, member_ids: memberIds };
    } catch (err) {
      if (duplicateName(err)) throw new AppError(`There's already a section called "${input.name}"`, 409);
      throw err;
    }
  });
}

export async function updateCategory(userId: string, roomId: string, categoryId: string, input: UpdateCategoryInput) {
  return withUserContext(userId, async (client) => {
    await requireRoomAdmin(client, roomId, userId);
    await getCategory(client, roomId, categoryId);
    try {
      if (input.name !== undefined) {
        await client.query("UPDATE expense_categories SET name = $2 WHERE id = $1", [categoryId, input.name]);
      }
    } catch (err) {
      if (duplicateName(err)) throw new AppError(`There's already a section called "${input.name}"`, 409);
      throw err;
    }
    if (input.memberIds !== undefined) {
      const memberIds = [...new Set(input.memberIds)];
      await checkMembers(client, roomId, memberIds);
      await client.query("DELETE FROM expense_category_members WHERE category_id = $1", [categoryId]);
      await client.query(
        "INSERT INTO expense_category_members (category_id, user_id) SELECT $1, unnest($2::uuid[])",
        [categoryId, memberIds]
      );
    }
    return getCategory(client, roomId, categoryId);
  });
}

// Expenses already filed under it keep their splits; they just lose the label.
export async function deleteCategory(userId: string, roomId: string, categoryId: string) {
  return withUserContext(userId, async (client) => {
    await requireRoomAdmin(client, roomId, userId);
    await getCategory(client, roomId, categoryId);
    await client.query("DELETE FROM expense_categories WHERE id = $1", [categoryId]);
  });
}
