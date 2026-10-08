import { Request, Response } from "express";
import { sendCreated, sendNoContent, sendSuccess } from "../../utils/response";
import { roomIdParam, uuidParam } from "../../utils/validation";
import { createCategorySchema, updateCategorySchema } from "./categories.schema";
import { createCategory, deleteCategory, listCategories, updateCategory } from "./categories.service";

const categoryIdParam = uuidParam("section");

export async function handleListCategories(req: Request, res: Response) {
  sendSuccess(res, await listCategories(req.auth!.sub, roomIdParam.parse(req.params.roomId)));
}

export async function handleCreateCategory(req: Request, res: Response) {
  const roomId = roomIdParam.parse(req.params.roomId);
  sendCreated(res, await createCategory(req.auth!.sub, roomId, createCategorySchema.parse(req.body)), "Section added");
}

export async function handleUpdateCategory(req: Request, res: Response) {
  const roomId = roomIdParam.parse(req.params.roomId);
  const categoryId = categoryIdParam.parse(req.params.categoryId);
  sendSuccess(res, await updateCategory(req.auth!.sub, roomId, categoryId, updateCategorySchema.parse(req.body)));
}

export async function handleDeleteCategory(req: Request, res: Response) {
  const roomId = roomIdParam.parse(req.params.roomId);
  await deleteCategory(req.auth!.sub, roomId, categoryIdParam.parse(req.params.categoryId));
  sendNoContent(res);
}
