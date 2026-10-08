import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { handleCreateSettlement, handleDeleteSettlement, handleListSettlements } from "./settlements.controller";

const router = Router({ mergeParams: true });

router.use(authenticate);

router.post("/", handleCreateSettlement);
router.get("/", handleListSettlements);
router.delete("/:settlementId", handleDeleteSettlement);

export default router;
