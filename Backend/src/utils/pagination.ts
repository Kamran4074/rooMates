import { z } from "zod";

export const MAX_PAGE_SIZE = 50;

export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(20),
});

export type PageParams = z.infer<typeof paginationQuery>;

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

// For "LIMIT $n OFFSET $m" in SQL.
export const toLimitOffset = ({ page, limit }: PageParams) => ({ limit, offset: (page - 1) * limit });

// List queries select `COUNT(*) OVER() AS total_count`, which puts the total
// (before LIMIT) on every row - one query instead of a separate COUNT(*).
// An empty page has no rows to read it from, so the total is 0 there.
export function paginate<T extends { total_count?: string | number }>(rows: T[], params: PageParams) {
  const total = rows.length ? Number(rows[0].total_count) : 0;
  const data = rows.map(({ total_count: _total, ...rest }) => rest);
  const pagination: Pagination = {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.ceil(total / params.limit),
  };
  return { data, pagination };
}
