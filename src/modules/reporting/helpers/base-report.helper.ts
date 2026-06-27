import { Op } from 'sequelize';
import { CreatedAtRangeFilter, ReportPaginationMeta, ReportPaginationParams, ReportSortDirection, ReportSortDirectionInput } from '../types/report.types';

const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 100;

export interface NormalizedPagination {
  page: number;
  limit: number;
  offset: number;
}

export class BaseReportHelper {
  normalizePagination(params: ReportPaginationParams): NormalizedPagination {
    const page = this.normalizePage(params.page);
    const limit = this.normalizeLimit(params.limit);

    return {
      page,
      limit,
      offset: (page - 1) * limit,
    };
  }

  buildPagination(total: number, page: number, limit: number): ReportPaginationMeta {
    console.log("################## ", total, page, limit);
    const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPreviousPage = page > 1 && total > 0;

    return {
      total,
      page,
      limit,
      totalPages,
      hasNextPage,
      hasPreviousPage,
      nextPage: hasNextPage ? page + 1 : null,
      previousPage: hasPreviousPage ? page - 1 : null,
    };
  }

  parseNumber(value?: number | string | null): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue)) {
      return null;
    }

    return parsedValue;
  }

  normalizeSortDirection(direction?: ReportSortDirectionInput): ReportSortDirection {
    const normalizedDirection = (direction || 'DESC').toUpperCase();
    return normalizedDirection === 'ASC' ? 'ASC' : 'DESC';
  }

  buildCreatedAtFilter(
    createdAt?: number | string | CreatedAtRangeFilter
  ): Record<symbol, number | number[]> | number | undefined {
    if (createdAt === undefined || createdAt === null || createdAt === '') {
      return undefined;
    }

    if (typeof createdAt === 'number' || typeof createdAt === 'string') {
      const exactValue = this.parseNumber(createdAt);
      return exactValue === null ? undefined : exactValue;
    }

    const exactValue = this.parseNumber(createdAt.eq);
    if (exactValue !== null) {
      return exactValue;
    }

    const from = this.parseNumber(createdAt.from ?? createdAt.start ?? createdAt.gte);
    const to = this.parseNumber(createdAt.to ?? createdAt.end ?? createdAt.lte);

    if (from !== null && to !== null) {
      return {
        [Op.between]: [from, to],
      } as Record<symbol, number | number[]>;
    }

    if (from !== null) {
      return {
        [Op.gte]: from,
      } as Record<symbol, number | number[]>;
    }

    if (to !== null) {
      return {
        [Op.lte]: to,
      } as Record<symbol, number | number[]>;
    }

    return undefined;
  }

  private normalizePage(page?: number): number {
    if (!page || Number.isNaN(Number(page))) {
      return DEFAULT_PAGE;
    }

    return Math.max(DEFAULT_PAGE, Math.floor(Number(page)));
  }

  private normalizeLimit(limit?: number): number {
    if (!limit || Number.isNaN(Number(limit))) {
      return DEFAULT_LIMIT;
    }

    const normalizedLimit = Math.floor(Number(limit));
    return Math.min(Math.max(1, normalizedLimit), MAX_LIMIT);
  }
}

export default new BaseReportHelper();