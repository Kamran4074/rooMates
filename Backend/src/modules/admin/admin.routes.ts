import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import { authorize } from "../../middlewares/authorize";
import * as c from "./admin.controller";

// Mounted at /api/admin. Every route: signed in AND super_admin, checked
// against the database (see authorize.ts) - applied once, here, for all.
const router = Router();

router.use(authenticate, authorize("super_admin"));

router.get("/stats", c.handleStats);

router.get("/users", c.handleUsers);
router.get("/users/:id", c.handleUser);
router.post("/users/:id/delete", c.handleDeleteUser);
router.post("/users/:id/suspend", c.handleSuspend);
router.post("/users/:id/unsuspend", c.handleUnsuspend);

router.get("/listings", c.handleListings);
router.get("/listings/:id", c.handleListing);
router.post("/listings/:id/approve", c.handleApprove);
router.post("/listings/:id/reject", c.handleReject);
router.post("/listings/:id/remove", c.handleRemoveListing);

router.get("/reports", c.handleReports);
router.post("/reports/:id/resolve", c.handleResolveReport);

router.get("/rooms", c.handleRooms);
router.get("/rooms/:id", c.handleRoom);

router.get("/audit-logs", c.handleAuditLogs);

export default router;
