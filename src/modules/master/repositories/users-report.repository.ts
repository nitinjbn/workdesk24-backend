import { FindAndCountOptions, Includeable , Op} from 'sequelize';
import db, { User, UserSettings, Role, Designation } from '../../../models';
import { CommonReportSortBy, GetUsersFilter, ReportResponse, ReportSortDirection, SingleRecordResponse } from '../types/master.types';
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
    if(filter.accountStatus!==undefined) {
      where.accountStatus = filter.accountStatus;
    } else {
      where.accountStatus = 'ACTIVE';
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

    if (filter.searchKey?.trim()) {
      const searchKey = filter.searchKey.trim();

      where[Op.or] = [
        {
          name: {
            [Op.like]: `%${searchKey}%`,
          },
        },
        {
          email: {
            [Op.like]: `%${searchKey}%`,
          },
        },
        {
          mobile: {
            [Op.like]: `%${searchKey}%`,
          },
        },
      ];
    }

    const roleFilter:any = {
      isDeleted: 0
    }
    if(filter.roleCode) {
      roleFilter.roleCode = filter.roleCode;
    }
   
    const query: FindAndCountOptions<UserInstance> = {
      attributes: {
        exclude: ['id', 'roleId', 'designationId', 'password', 'reportingManagerId', 'accountStatus', 'isDeleted', 'deletedAt'],
        include: [
          [db.Sequelize.col('User.id'), 'userId'],
          [db.Sequelize.col('role.roleName'), 'role'],
          [db.Sequelize.col('designation.name'), 'designation']
        ]
      },
      where,
      include: [
        {
          attributes: ['settingName', 'settingValue', 'isEnabled'],
          model: UserSettings,
          where: {
            isDeleted: 0
          },
          as: "settings",
          required: false
        },
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
      raw: false,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await User.findAndCountAll(query);

      const cleanedRows = rows.map(row => {
        const jsonRow = row.toJSON() as any;
        if(jsonRow.settings && Array.isArray(jsonRow.settings)) {
          jsonRow.settings = jsonRow.settings.map((s: any) => ({
            settingName: s.settingName,
            settingValue: s.settingValue,
            isEnabled: s.isEnabled
          }));
        }
        return jsonRow;
      });

      return {
        data: cleanedRows as any,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };

    } else {
      const rows = await User.findAll(query);
      const cleanedRows = rows.map(row => {
        const jsonRow = row.toJSON() as any;
        if(jsonRow.settings && Array.isArray(jsonRow.settings)) {
          jsonRow.settings = jsonRow.settings.map((s: any) => ({
            settingName: s.settingName,
            settingValue: s.settingValue,
            isEnabled: s.isEnabled
          }));
        }
        return jsonRow;
      });
      return {
        data: cleanedRows as any
      };
    }
  }


  async getUserById(params: {hostId: number, userId: number}): Promise<any> {
    const { hostId, userId } = params;

    const where:any = {
      hostId,
      id: userId,
      isDeleted:0
    }
   
    const query: FindAndCountOptions<UserInstance> = {
      attributes: {
        exclude: ['id', 'roleId', 'designationId', 'password', 'reportingManagerId', 'accountStatus', 'isDeleted', 'deletedAt'],
        include: [
          [db.Sequelize.col('User.id'), 'userId'],
          [db.Sequelize.col('role.roleName'), 'role'],
          [db.Sequelize.col('designation.name'), 'designation']
        ]
      },
      where,
      include: [
        {
          attributes: ['settingName', 'settingValue', 'isEnabled'],
          model: UserSettings,
          where: {
            isDeleted: 0
          },
          as: "settings",
          required: false
        },
        {
          attributes:[],
          model: Role,
          where: {
            isDeleted: 0
          },
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
      subQuery: false,
      raw: false,
      logging: console.log, // Enable logging for debugging
    };

    const data = await User.findOne(query);
    if (!data) {
      return {};
    }
    
    const jsonData = data.toJSON() as any;
    if(jsonData.settings && Array.isArray(jsonData.settings)) {
      jsonData.settings = jsonData.settings.map((s: any) => ({
        settingName: s.settingName,
        settingValue: s.settingValue,
        isEnabled: s.isEnabled
      }));
    }
    return jsonData;
  }

  async getDesignations(params: {hostId: number, page?: number, limit?: number, filter?: any, sortBy: CommonReportSortBy, sortOrder: ReportSortDirection}): Promise<ReportResponse<any>> {
    const { hostId, page, limit, filter={}, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });
    const order = buildCommonReportOrder(sortBy, sortOrder, {
      createdAt: 'createdAt'
    });
    const where:any = {
      hostId,
      isDeleted:0
    }
    if(filter.isEnabled!==undefined) {
      where.isEnabled = filter.isEnabled;
    } else {
      where.isEnabled = 1;
    }
    if(filter.name) {
      where.name = {
        [Op.like]: `%${filter.name.trim()}%`,
      }
    }
    const query: FindAndCountOptions<any> = {
      attributes: {
        exclude: ['isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
      },
      where,
      order,
      raw: true,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await Designation.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };

    } else {
      const rows = await Designation.findAll(query);
      return {
        data: rows
      };
    }
  }

  async createAppUser(params: any): Promise<any> {
    const { hostId, name, employeeCode, email, countryCode, mobile, password, reportingManagerId, roleId, designationId, profileImageUrl, joiningDate, accountStatus, createdAt, gender, addressLine1, addressLine2, landmark, country, state, city, district, pinCode, timezone } = params;
    const newUser = await User.create({
      hostId,
      name,
      employeeCode,
      email,
      countryCode,
      mobile,
      password,
      reportingManagerId,
      roleId,
      designationId,
      profileImageUrl,
      joiningDate,
      accountStatus,
      accountStatusUpdatedAt:createdAt,
      gender,
      addressLine1,
      addressLine2,
      landmark,
      country,
      state,
      city,
      district,
      pinCode,
      timezone,
      isDeleted: 0,
      createdAt
    });

    return newUser;
  }

  async getUserByFilter(params: { filter: any}): Promise<any> {
    const { filter } = params;
    if(!filter) {
      throw new Error('Filter is required');
    }
    const where:any = filter;
    where.isDeleted = 0;
    const user = await User.findOne({
      where,
      raw: true,
      logging: console.log, // Enable logging for debugging
    });
    return user || {};
  }

  async createUserSettings(params: {
    userId: number;
    settings: Array<{ settingName: string; settingValue: string; isEnabled?: number }>;
    createdAt?: number;
  }): Promise<any[]> {
    const { userId, settings, createdAt } = params;

    if(!settings || !Array.isArray(settings) || settings.length === 0) {
      return [];
    }

    if(!userId) {
      throw new Error('userId is required');
    }

    const now = createdAt || Date.now() / 1000; // Current Unix timestamp in seconds

    const records = settings.map((s) => ({
      userId,
      settingName: s.settingName,
      settingValue: s.settingValue,
      isEnabled: s.isEnabled || 1, // Default to 1 if not provided
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    }));

    const created = await UserSettings.bulkCreate(records);
    return created;
  }

  
}

export default new usersRepository();
