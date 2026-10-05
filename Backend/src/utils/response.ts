import { Response } from "express";
import { Pagination } from "./pagination";

// Every successful response has the same shape, so the frontend unwraps it in
// one place (lib/api.ts) instead of every page guessing:
//   { success: true, message?, data, pagination? }
// Errors are shaped by middlewares/errorHandler.ts: { success: false, message, errors? }
export function sendSuccess<T>(
  res: Response,
  data: T,
  options: { status?: number; message?: string; pagination?: Pagination } = {}
) {
  res.status(options.status ?? 200).json({
    success: true,
    ...(options.message && { message: options.message }),
    data,
    ...(options.pagination && { pagination: options.pagination }),
  });
}

export const sendCreated = <T>(res: Response, data: T, message?: string) =>
  sendSuccess(res, data, { status: 201, message });

// 204 has no body by definition - used for deletes.
export const sendNoContent = (res: Response) => {
  res.status(204).send();
};
