import { apiAuthDelete, apiAuthPatch, apiAuthPost } from "@/lib/api";
import type { Category } from "@/lib/types";

// Bill sections of a room (Rent, Groceries...). Room admin only - the API checks.
// Reads go through useApiQuery(`/api/rooms/${roomId}/categories`).

const base = (roomId: string) => `/api/rooms/${roomId}/categories`;

export interface CategoryInput {
  name: string;
  memberIds: string[];
}

export const createCategory = (roomId: string, input: CategoryInput) => apiAuthPost<Category>(base(roomId), input);

export const updateCategory = (roomId: string, categoryId: string, input: Partial<CategoryInput>) =>
  apiAuthPatch<Category>(`${base(roomId)}/${categoryId}`, input);

export const deleteCategory = (roomId: string, categoryId: string) => apiAuthDelete(`${base(roomId)}/${categoryId}`);
