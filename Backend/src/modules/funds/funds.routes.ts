import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import {
  handleAddContribution,
  handleAddSpend,
  handleClose,
  handleConfirmEntry,
  handlePreviewClose,
  handleCreateFund,
  handleDeleteEntry,
  handleGetFund,
  handleListFunds,
} from "./funds.controller";

// Mounted at /api/rooms/:roomId/funds - mergeParams exposes :roomId here.
const router = Router({ mergeParams: true });

router.use(authenticate);

router.get("/", handleListFunds);
router.post("/", handleCreateFund);
router.get("/:fundId", handleGetFund);
router.post("/:fundId/contributions", handleAddContribution);
router.post("/:fundId/spends", handleAddSpend);
router.delete("/:fundId/entries/:entryId", handleDeleteEntry);
router.post("/:fundId/entries/:entryId/confirm", handleConfirmEntry);
router.get("/:fundId/close-preview", handlePreviewClose);
router.post("/:fundId/close", handleClose);

export default router;
