export interface PageParams {
  page: number;
  pageSize: number;
}

export interface Paginated<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export function normalizePage(input: { page?: number | string | null; pageSize?: number | string | null }, maxPageSize = 200): PageParams {
  const page = Math.max(1, Number.parseInt(String(input.page ?? 1), 10) || 1);
  const pageSize = Math.min(maxPageSize, Math.max(1, Number.parseInt(String(input.pageSize ?? 25), 10) || 25));
  return { page, pageSize };
}

export function paginate<T>(items: T[], total: number, params: PageParams): Paginated<T> {
  return { items, page: params.page, pageSize: params.pageSize, total, totalPages: Math.max(1, Math.ceil(total / params.pageSize)) };
}
