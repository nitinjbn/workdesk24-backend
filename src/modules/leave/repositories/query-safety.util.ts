export const LEAVE_LIST_MAX_LIMIT = 200;
export const LEAVE_LIST_DEFAULT_LIMIT = 20;

type SortDirection = 'ASC' | 'DESC';

export const buildSafeOrder = (payload: {
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  allowedSortBy: string[];
  defaultOrder: Array<[string, SortDirection]>;
}): Array<[string, SortDirection]> => {
  const { sortBy, sortOrder, allowedSortBy, defaultOrder } = payload;

  const normalizedSortBy = typeof sortBy === 'string' ? sortBy.trim() : '';
  const normalizedSortOrder = String(sortOrder || '').toUpperCase();
  const safeSortOrder: SortDirection = normalizedSortOrder === 'ASC' ? 'ASC' : 'DESC';

  if (normalizedSortBy && allowedSortBy.includes(normalizedSortBy)) {
    return [[normalizedSortBy, safeSortOrder]];
  }

  return defaultOrder;
};

export const resolvePagination = (
  page?: number,
  limit?: number
): { page: number; limit: number; offset: number } | null => {
  const hasPage = page !== undefined && page !== null;
  const hasLimit = limit !== undefined && limit !== null;

  if (!hasPage && !hasLimit) {
    return null;
  }

  const safePage = Math.max(1, Number.isFinite(Number(page)) ? Math.floor(Number(page)) : 1);
  const requestedLimit = Number.isFinite(Number(limit))
    ? Math.floor(Number(limit))
    : LEAVE_LIST_DEFAULT_LIMIT;
  const safeLimit = Math.min(LEAVE_LIST_MAX_LIMIT, Math.max(1, requestedLimit));

  return {
    page: safePage,
    limit: safeLimit,
    offset: (safePage - 1) * safeLimit,
  };
};

export const buildPagination = (total: number, page: number, limit: number): any => ({
  total,
  page,
  limit,
  totalPages: Math.ceil(total / limit),
  hasNextPage: page < Math.ceil(total / limit),
  hasPreviousPage: page > 1,
  nextPage: page < Math.ceil(total / limit) ? page + 1 : null,
  previousPage: page > 1 ? page - 1 : null,
});
