import { Request, Response } from "express";
import { sendSuccess } from "../../utils/response";
import {
  idParam,
  listingsQuery,
  optionalReasonSchema,
  reasonSchema,
  reportsQuery,
  resolveReportSchema,
  roomsQuery,
  usersQuery,
  usersExportQuery,
  onboardingQuery,
} from "./admin.schema";
import { paginationQuery } from "../../utils/pagination";
import * as admin from "./admin.service";
import { getOnboarding } from "./onboarding.service";

const id = (req: Request) => idParam.parse(req.params.id);

export async function handleStats(_req: Request, res: Response) {
  sendSuccess(res, await admin.getStats());
}

export async function handleUsers(req: Request, res: Response) {
  const { search, status, sort, view, page, limit } = usersQuery.parse(req.query);
  const { data, pagination } = await admin.listUsers({ search, status, sort, view }, { page, limit });
  sendSuccess(res, data, { pagination });
}

export async function handleOnboarding(req: Request, res: Response) {
  const { search, filter, sort, page, limit } = onboardingQuery.parse(req.query);
  const { counts, items, pagination } = await getOnboarding({ search, filter, sort }, { page, limit });
  sendSuccess(res, { counts, items }, { pagination });
}

export async function handleExportUsers(req: Request, res: Response) {
  const csv = await admin.exportUsersCsv(req.auth!.sub, usersExportQuery.parse(req.query));
  const date = new Date().toISOString().slice(0, 10);
  res
    .status(200)
    .set({
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="roomates-users-${date}.csv"`,
      "Cache-Control": "no-store",
    })
    .send(csv);
}

export async function handleOwnedGroups(req: Request, res: Response) {
  sendSuccess(res, await admin.listOwnedGroups(id(req)));
}

export async function handleUser(req: Request, res: Response) {
  sendSuccess(res, await admin.getUser(id(req)));
}

export async function handleDeleteUser(req: Request, res: Response) {
  const { reason } = reasonSchema.parse(req.body ?? {});
  sendSuccess(res, await admin.deleteUser(req.auth!.sub, id(req), reason), { message: "Account deleted" });
}

export async function handleSuspend(req: Request, res: Response) {
  const { reason } = optionalReasonSchema.parse(req.body ?? {});
  sendSuccess(res, await admin.setSuspended(req.auth!.sub, id(req), true, reason), { message: "Account suspended" });
}

export async function handleUnsuspend(req: Request, res: Response) {
  sendSuccess(res, await admin.setSuspended(req.auth!.sub, id(req), false), { message: "Account restored" });
}

export async function handleListings(req: Request, res: Response) {
  const { status, page, limit } = listingsQuery.parse(req.query);
  const { data, pagination } = await admin.listListings(status, { page, limit });
  sendSuccess(res, data, { pagination });
}

export async function handleListing(req: Request, res: Response) {
  sendSuccess(res, await admin.getListing(id(req)));
}

export async function handleApprove(req: Request, res: Response) {
  sendSuccess(res, await admin.moderateListing(req.auth!.sub, id(req), "approve"), { message: "Listing published" });
}

export async function handleReject(req: Request, res: Response) {
  const { reason } = reasonSchema.parse(req.body);
  sendSuccess(res, await admin.moderateListing(req.auth!.sub, id(req), "reject", reason), { message: "Listing rejected" });
}

export async function handleRemoveListing(req: Request, res: Response) {
  const { reason } = reasonSchema.parse(req.body);
  sendSuccess(res, await admin.moderateListing(req.auth!.sub, id(req), "remove", reason), { message: "Listing removed" });
}

export async function handleReports(req: Request, res: Response) {
  const { status, page, limit } = reportsQuery.parse(req.query);
  const { data, pagination } = await admin.listReports(status, { page, limit });
  sendSuccess(res, data, { pagination });
}

export async function handleResolveReport(req: Request, res: Response) {
  const { action, note } = resolveReportSchema.parse(req.body);
  sendSuccess(res, await admin.resolveReport(req.auth!.sub, id(req), action, note));
}

export async function handleRooms(req: Request, res: Response) {
  const { search, page, limit } = roomsQuery.parse(req.query);
  const { data, pagination } = await admin.listRooms(search, { page, limit });
  sendSuccess(res, data, { pagination });
}

export async function handleRoom(req: Request, res: Response) {
  sendSuccess(res, await admin.getRoom(id(req)));
}

export async function handleAuditLogs(req: Request, res: Response) {
  const { data, pagination } = await admin.listAuditLogs(paginationQuery.parse(req.query));
  sendSuccess(res, data, { pagination });
}
