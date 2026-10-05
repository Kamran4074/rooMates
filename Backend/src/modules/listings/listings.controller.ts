import { Request, Response } from "express";
import { sendCreated, sendNoContent, sendSuccess } from "../../utils/response";
import {
  createListingSchema,
  idParam,
  listingStatusActionSchema,
  myListingsQuery,
  nearbyListingsQuery,
  reportListingSchema,
  saveImageSchema,
  searchListingsQuery,
  updateListingSchema,
} from "./listings.schema";
import * as listings from "./listings.service";

const listingId = (req: Request) => idParam.parse(req.params.listingId);

export async function handleSearch(req: Request, res: Response) {
  const { page, limit, ...filters } = searchListingsQuery.parse(req.query);
  const { data, pagination } = await listings.search(req.auth!.sub, filters, { page, limit });
  sendSuccess(res, data, { pagination });
}

export async function handleNearby(req: Request, res: Response) {
  const { data, pagination } = await listings.nearby(req.auth!.sub, nearbyListingsQuery.parse(req.query));
  sendSuccess(res, data, { pagination });
}

export async function handleMine(req: Request, res: Response) {
  const { status, page, limit } = myListingsQuery.parse(req.query);
  const { data, pagination } = await listings.mine(req.auth!.sub, status, { page, limit });
  sendSuccess(res, data, { pagination });
}

export async function handleGet(req: Request, res: Response) {
  sendSuccess(res, await listings.getDetail(req.auth!.sub, listingId(req)));
}

export async function handleCreate(req: Request, res: Response) {
  sendCreated(res, await listings.create(req.auth!.sub, createListingSchema.parse(req.body)), "Draft saved. Add photos, then submit it for review.");
}

export async function handleUpdate(req: Request, res: Response) {
  sendSuccess(res, await listings.update(req.auth!.sub, listingId(req), updateListingSchema.parse(req.body)), {
    message: "Listing updated",
  });
}

export async function handleChangeStatus(req: Request, res: Response) {
  const { action } = listingStatusActionSchema.parse(req.body);
  sendSuccess(res, await listings.changeStatus(req.auth!.sub, listingId(req), action));
}

export async function handleDelete(req: Request, res: Response) {
  await listings.remove(req.auth!.sub, listingId(req));
  sendNoContent(res);
}

export async function handleSignImageUpload(req: Request, res: Response) {
  sendSuccess(res, await listings.signImageUpload(req.auth!.sub, listingId(req)));
}

export async function handleAddImage(req: Request, res: Response) {
  sendCreated(res, await listings.addImage(req.auth!.sub, listingId(req), saveImageSchema.parse(req.body)));
}

export async function handleRemoveImage(req: Request, res: Response) {
  await listings.removeImage(req.auth!.sub, listingId(req), idParam.parse(req.params.imageId));
  sendNoContent(res);
}

export async function handleSetCover(req: Request, res: Response) {
  await listings.setCoverImage(req.auth!.sub, listingId(req), idParam.parse(req.params.imageId));
  sendNoContent(res);
}

export async function handleReport(req: Request, res: Response) {
  await listings.report(req.auth!.sub, listingId(req), reportListingSchema.parse(req.body));
  sendCreated(res, null, "Thanks - a moderator will review this listing.");
}
