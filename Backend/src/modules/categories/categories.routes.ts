import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { handleCreateCategory, handleDeleteCategory, handleListCategories, handleUpdateCategory } from "./categories.controller";

// Mounted at /api/rooms/:roomId/categories.
const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/", handleListCategories);
router.post("/", handleCreateCategory);
router.patch("/:categoryId", handleUpdateCategory);
router.delete("/:categoryId", handleDeleteCategory);

export default router;
