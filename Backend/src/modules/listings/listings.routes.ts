import { Router } from "express";
import { authenticate } from "../../middlewares/authenticate";
import * as c from "./listings.controller";

// Mounted at /api/listings. Everything needs a signed-in user; ownership is
// checked per listing in the service (not here - routes only wire things up).
const router = Router();

router.use(authenticate);

// Fixed paths first, so "nearby"/"mine" aren't read as a :listingId.
router.get("/", c.handleSearch);
router.get("/nearby", c.handleNearby);
router.get("/mine", c.handleMine);
router.post("/", c.handleCreate);

router.get("/:listingId", c.handleGet);
router.patch("/:listingId", c.handleUpdate);
router.delete("/:listingId", c.handleDelete);
router.post("/:listingId/status", c.handleChangeStatus);

router.post("/:listingId/images/upload-signature", c.handleSignImageUpload);
router.post("/:listingId/images", c.handleAddImage);
router.delete("/:listingId/images/:imageId", c.handleRemoveImage);
router.post("/:listingId/images/:imageId/cover", c.handleSetCover);

router.post("/:listingId/reports", c.handleReport);

export default router;
