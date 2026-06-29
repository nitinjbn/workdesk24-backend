import { Includeable, ModelStatic, Op, Order, WhereOptions } from 'sequelize';
import User from '../../../models/schemas/User';
import { CommonReportSortBy, ReportSortDirection, UserScopedReportFilter } from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';

export const USER_REPORT_ATTRIBUTES = [
  'id',
  'hostId',
  'roleId',
  'employeeId',
  'name',
  'email',
  'mobile',
  'reportingManagerId',
  'profileImageUrl',
  'joiningDate',
  'lastLoginAt',
  'isActive',
] as const;

const USER_COLUMNS = Object.keys(((User as any).getAttributes?.() || (User as any).rawAttributes || {}) as Record<string, unknown>);

export const buildUserScopedWhere = <T>(
  filter: UserScopedReportFilter,
  userId?: number
): WhereOptions<T> => {
  const where: Record<string, unknown> = {
    isDeleted: 0,
  };

  if (userId !== undefined) {
    where.userId = userId;
  }

  const createdAtFilter = baseReportHelper.buildCreatedAtFilter(filter.createdAt);
  if (createdAtFilter) {
    where.createdAt = createdAtFilter;
  }

  return where as WhereOptions<T>;
};

export const buildUserInclude = (
  hostId: number,
  userId: number | undefined,
  enforceActiveUsersOnly: boolean,
  userFilter?: Record<string, unknown>
): Includeable => {
  const dynamicUserWhere = userFilter
    ? buildDynamicModelFilters(userFilter, USER_COLUMNS, ['hostId', 'isDeleted'])
    : {};

  const userWhere: Record<string, unknown> = {
    hostId,
    isDeleted: {
      [Op.or]: [0, null],
    },
    ...dynamicUserWhere,
  };

  if (userId !== undefined) {
    userWhere.id = userId;
  }

  if (enforceActiveUsersOnly) {
    userWhere.isActive = {
      [Op.or]: [1, null],
    };
  }

  return {
    model: User,
    as: 'user',
    required: true,
    attributes: [...USER_REPORT_ATTRIBUTES],
    where: userWhere,
  };
};

export const extractUserFilter = (filter: Record<string, unknown>): Record<string, unknown> => {
  const nested = (filter.User ?? filter.user) as unknown;
  if (!nested || typeof nested !== 'object' || Array.isArray(nested)) {
    return {};
  }

  return { ...(nested as Record<string, unknown>) };
};

export const buildCommonReportOrder = (
  sortBy: CommonReportSortBy,
  sortOrder: ReportSortDirection,
  fieldMap?: {
    createdAt?: string;
    batteryPercentage?: string;
    speed?: string;
  }
): Order => {
  if (sortBy === 'userName') {
    return [[{ model: User as ModelStatic<any>, as: 'user' }, 'name', sortOrder], ['id', 'DESC']];
  }

  if (sortBy === 'batteryPercentage') {
    return [[fieldMap.batteryPercentage, sortOrder], ['id', 'DESC']];
  }

  if (sortBy === 'speed') {
    return [[fieldMap.speed, sortOrder], ['id', 'DESC']];
  }

  return [[fieldMap.createdAt, sortOrder], ['id', 'DESC']];
};

const isRangeObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const rangeKeys = ['from', 'to', 'start', 'end', 'gte', 'lte', 'eq'];
  return rangeKeys.some((key) => Object.prototype.hasOwnProperty.call(value, key));
};

const isOperatorObject = (value: unknown): value is Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }

  const operatorKeys = ['like', 'startsWith', 'endsWith', 'in', 'notIn', 'ne'];
  return operatorKeys.some((key) => Object.prototype.hasOwnProperty.call(value, key));
};

export const buildDynamicModelFilters = (
  filter: Record<string, unknown>,
  allowedColumns: string[],
  excludedKeys: string[] = []
): Record<string, unknown> => {
  const allowedSet = new Set(allowedColumns);
  const excludedSet = new Set(excludedKeys);
  const where: Record<string, unknown> = {};

  Object.entries(filter).forEach(([key, rawValue]) => {
    if (excludedSet.has(key) || !allowedSet.has(key)) {
      return;
    }

    if (rawValue === undefined || rawValue === null || rawValue === '') {
      return;
    }

    if (isRangeObject(rawValue)) {
      const eq = rawValue.eq;
      if (eq !== undefined && eq !== null && eq !== '') {
        where[key] = eq;
        return;
      }

      const from = rawValue.from ?? rawValue.start ?? rawValue.gte;
      const to = rawValue.to ?? rawValue.end ?? rawValue.lte;

      if (from !== undefined && from !== null && from !== '' && to !== undefined && to !== null && to !== '') {
        where[key] = { [Op.between]: [from, to] };
        return;
      }

      if (from !== undefined && from !== null && from !== '') {
        where[key] = { [Op.gte]: from };
        return;
      }

      if (to !== undefined && to !== null && to !== '') {
        where[key] = { [Op.lte]: to };
      }

      return;
    }

    if (isOperatorObject(rawValue)) {
      const like = rawValue.like;
      if (typeof like === 'string' && like.trim() !== '') {
        where[key] = { [Op.like]: `%${like.trim()}%` };
        return;
      }

      const startsWith = rawValue.startsWith;
      if (typeof startsWith === 'string' && startsWith.trim() !== '') {
        where[key] = { [Op.like]: `${startsWith.trim()}%` };
        return;
      }

      const endsWith = rawValue.endsWith;
      if (typeof endsWith === 'string' && endsWith.trim() !== '') {
        where[key] = { [Op.like]: `%${endsWith.trim()}` };
        return;
      }

      const inValues = rawValue.in;
      if (Array.isArray(inValues) && inValues.length > 0) {
        where[key] = { [Op.in]: inValues };
        return;
      }

      const notInValues = rawValue.notIn;
      if (Array.isArray(notInValues) && notInValues.length > 0) {
        where[key] = { [Op.notIn]: notInValues };
        return;
      }

      const notEqual = rawValue.ne;
      if (notEqual !== undefined && notEqual !== null && notEqual !== '') {
        where[key] = { [Op.ne]: notEqual };
        return;
      }

      return;
    }

    where[key] = rawValue;
  });

  return where;
};
