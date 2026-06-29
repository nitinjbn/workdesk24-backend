import { FindAndCountOptions, Includeable , Op} from 'sequelize';
import db, { User, Role, Designation } from '../../../models';
import { CommonReportSortBy, GetUsersFilter, ReportResponse, ReportSortDirection } from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder } from './user-scoped-report.helper';

type UserInstance = typeof User.prototype;

export interface GetUsersQuery {
  hostId: number;
  page?: number;
  limit?: number;
  filter?: GetUsersFilter;
  sortBy: CommonReportSortBy;
  sortOrder: ReportSortDirection;
}

export class usersRepository {
  async getUsers(params: GetUsersQuery): Promise<ReportResponse<UserInstance>> {
    const { page, limit, filter={}, hostId, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });
    const order = buildCommonReportOrder(sortBy, sortOrder, {
      createdAt: 'createdAt'
    });

    const where:any = {
      hostId,
      isDeleted:0
    }
    if(filter.isActive!==undefined) {
      where.isActive = filter.isActive;
    } else {
      where.isActive = 1;
    }

    if(filter.userId || filter.id) {
      filter.id = filter.userId || filter.id;
    }

    if(filter.name) {
      where.name = {
        [Op.like]: `%${filter.name.trim()}%`,
      }
    }
    if(filter.email) {
      where.email = {
        [Op.like]: `%${filter.email.trim()}%`,
      }
    }
    if(filter.mobile) {
      where.mobile = {
        [Op.like]: `%${filter.mobile}%`,
      }
    }

    const roleFilter:any = {
      isDeleted: 0
    }
    if(filter.roleCode) {
      roleFilter.roleCode = filter.roleCode;
    }
   
    const query: FindAndCountOptions<UserInstance> = {
      attributes: {
        exclude: ['roleId', 'designationId', 'password', 'reportingManagerId', 'isActive', 'isDeleted', 'deletedAt'],
        include: [
          [db.Sequelize.col('role.roleName'), 'role'],
          [db.Sequelize.col('designation.name'), 'designation']
        ]
      },
      where,
      include: [
        {
          attributes:[],
          model: Role,
          where: roleFilter,
          as: "role",
          required: true
        },
        {
          attributes:[],
          model: Designation,
          where: {
            isDeleted: 0
          },
          as: "designation",
          required: true
        }
      ],
      order,
      raw: true,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await User.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };

    } else {
      const rows = await User.findAll(query);
      return {
        data: rows
      };
    }
  }
}

export default new usersRepository();