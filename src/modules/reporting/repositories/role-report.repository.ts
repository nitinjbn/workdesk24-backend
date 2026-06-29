import { FindAndCountOptions, Op} from 'sequelize';
import { Role } from '../../../models';
import { GetRolesPayload, GetRoleDetailsByIdPayload, ReportResponse, SingleRecordResponse} from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder } from './user-scoped-report.helper';

type RoleInstance = typeof Role.prototype;

export class roleRepository {
  async getRoles(params: GetRolesPayload): Promise<ReportResponse<RoleInstance>> {
    const { page, limit, filter, hostId, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });
    const order = buildCommonReportOrder(sortBy, sortOrder, {
      createdAt: 'createdAt'
    });

    const where:any = {
      hostId,
      isDeleted:0
    }

    if(filter.roleId || filter.id) {
      filter.id = filter.roleId || filter.id;
    }

    if(filter.roleName) {
      where.roleName = {
        [Op.like]: `%${filter.roleName.trim()}%`,
      }
    }
    if(filter.roleCode) {
      where.roleCode = filter.roleCode;
    }
   
    const query: FindAndCountOptions<RoleInstance> = {
      attributes: {
        exclude: ['isDeleted', 'deletedAt'],
      },
      where,
      order,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await Role.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };

    } else {
      const rows = await Role.findAll(query);
      return {
        data: rows
      };
    }
  }

  async getRoleById(params: GetRoleDetailsByIdPayload): Promise<SingleRecordResponse<RoleInstance>> {
    const { hostId, roleId } = params;

    const where:any = {
      id: roleId,
      hostId,
      isDeleted:0
    }
   
    const query: FindAndCountOptions<RoleInstance> = {
      attributes: {
        exclude: ['isDeleted', 'deletedAt'],
      },
      where,
      logging: console.log, // Enable logging for debugging
    };

    const roleDetails = await Role.findOne(query);
    return {
      data: roleDetails || {}
    };
  }
}

export default new roleRepository();