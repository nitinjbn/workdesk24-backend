import { FindAndCountOptions, Includeable , Op} from 'sequelize';
import db, { User, UserSettings, Role, Designation, UserDevice } from '../../../models';
import { CommonReportSortBy, GetUsersFilter, ReportResponse, ReportSortDirection, SingleRecordResponse } from '../types/master.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder } from './user-scoped-report.helper';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';

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
  async searchEmployeesForAI(params: {
    hostId: number;
    search: string;
  }): Promise<Array<Pick<UserInstance, 'id' | 'name' | 'employeeCode' | 'email'>>> {
    const search = params.search.trim();

    if (!search) {
      return [];
    }

    const users = await User.findAll({
      attributes: ['id', 'name', 'employeeCode', 'email'],
      where: {
        hostId: params.hostId,
        isDeleted: 0,
        accountStatus: 'ACTIVE',
        [Op.or]: [
          { name: { [Op.like]: `%${search}%` } },
          { employeeCode: { [Op.like]: `%${search}%` } },
          { email: { [Op.like]: `%${search}%` } },
        ],
      },
      order: [['name', 'ASC'], ['id', 'ASC']],
    });

    return users;
  }

  async findActiveEmployeeForAI(params: {
    hostId: number;
    userId: number;
  }): Promise<Pick<UserInstance, 'id' | 'name' | 'employeeCode'> | null> {
    const user = await User.findOne({
      attributes: ['id', 'name', 'employeeCode'],
      where: {
        id: params.userId,
        hostId: params.hostId,
        isDeleted: 0,
        accountStatus: 'ACTIVE',
      },
    });

    return user;
  }

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
    if(filter.accountStatus) {
      where.accountStatus = filter.accountStatus;
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

    if(filter.joiningDate) {
      const { from, to } = filter.joiningDate;
      if(from && to) {
        where.joiningDate = {
          [Op.between]: [from, to]
        }
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
        exclude: ['id', 'roleId', 'designationId', 'password', 'reportingManagerId', 'isDeleted', 'deletedAt'],
        include: [
          [db.Sequelize.col('User.id'), 'userId'],
          [db.Sequelize.col('roles.roleName'), 'role'],
          [db.Sequelize.col('designations.name'), 'designation']
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
          attributes: [],
          model: Role,
          where: roleFilter,
          as: "roles",
          required: true
        },
        {
          attributes: [],
          model: Designation,
          where: {
            isDeleted: 0
          },
          as: "designations",
          required: true
        },
        {
          attributes: {
            exclude: ['id', 'hostId',  'userId'],
          },
          model: UserDevice,
          as: "device",
          required: false
        }
      ],
      order,
      raw: false,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;
      query.distinct = true;

      const { rows, count } = await User.findAndCountAll(query);
      //console.log("########################################## rows:", rows);

      const cleanedRows = rows.map(row => {
        const jsonRow = row.toJSON() as any;
        if(jsonRow.settings && Array.isArray(jsonRow.settings)) {
          jsonRow.settings = jsonRow.settings.map((s: any) => ({
            settingName: s.settingName,
            settingValue: s.settingValue,
            isEnabled: s.isEnabled
          }));
        }
        // Convert devices to plain object (single device per user)
        if(jsonRow.device && typeof jsonRow.device.toJSON === 'function') {
          jsonRow.device = jsonRow.device.toJSON();
        } else if(jsonRow.device) {
          jsonRow.device = jsonRow.device;
        } else {
          jsonRow.device = {};
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
        // Convert devices to plain object (single device per user)
        if(jsonRow.device && typeof jsonRow.device.toJSON === 'function') {
          jsonRow.device = jsonRow.device.toJSON();
        } else if(jsonRow.device) {
          jsonRow.device = jsonRow.device;
        } else {
          jsonRow.device = {};
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
        exclude: ['id', 'roleId', 'password', 'reportingManagerId', 'isDeleted', 'deletedAt'],
        include: [
          [db.Sequelize.col('User.id'), 'userId'],
          [db.Sequelize.col('roles.roleName'), 'role'],
          [db.Sequelize.col('designations.name'), 'designation']
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
          attributes: [],
          model: Role,
          where: {
            isDeleted: 0
          },
          as: "roles",
          required: true
        },
        {
          attributes: [],
          model: Designation,
          where: {
            isDeleted: 0
          },
          as: "designations",
          required: true
        },
        {
          attributes: {
            exclude: ['id', 'hostId',  'userId'],
          },
          model: UserDevice,
          as: "device",
          required: false
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
    // Convert devices to plain object (single device per user)
    if(jsonData.device && typeof jsonData.device.toJSON === 'function') {
      jsonData.device = jsonData.device.toJSON();
    } else if(jsonData.device) {
      jsonData.device = jsonData.device;
    } else {
      jsonData.device = {};
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
    const { hostId, name, employeeCode, email, enteredMobileNumber, callingCode, mobile, dateOfBirth, password, reportingManagerId, roleId, designationId, profileImageUrl, joiningDate, accountStatus, createdAt, gender, addressLine1, addressLine2, landmark, countryName, countryIsoCode, stateName, stateIsoCode, city, district, pinCode, timezone, holidayCalendarId, leavePolicyId } = params;
    const newUser = await User.create({
      hostId,
      name,
      employeeCode,
      email,
      enteredMobileNumber,
      callingCode,
      mobile,
      password,
      dateOfBirth,
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
      countryName,
      countryIsoCode,
      stateName,
      stateIsoCode,
      city,
      district,
      pinCode,
      timezone,
      holidayCalendarId,
      leavePolicyId,
      isDeleted: 0,
      createdAt
    });

    return newUser;
  }

  async getUsersByFilter(filter: any): Promise<any> {
    if(!filter) {
      throw new Error('Filter is required');
    }
    const where:any = filter;
    
    // Ensure that isDeleted is always checked to be 0 unless explicitly provided in the filter
    if(!Object.prototype.hasOwnProperty.call(where, 'isDeleted')) {
      where.isDeleted = 0;
    }
    const users = await User.findAll({
      where,
      raw: true,
      logging: console.log, // Enable logging for debugging
    });
    return users || [];
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

  async updateUserSettings(params: {
    userId: number;
    settings: Array<{ settingName: string; settingValue: string; isEnabled?: number }>;
    updatedAt?: number;
  }): Promise<any[]> {
    const { userId, settings, updatedAt } = params;

    if(!userId) {
      throw new Error('userId is required');
    }

    const normalizedSettings = Array.isArray(settings) ? settings : [];
    const now = updatedAt || Date.now() / 1000;

    try {
      return await db.sequelize.transaction(async (transaction: any) => {
        const existingSettings = await UserSettings.findAll({
          where: { userId },
          order: [
            ['isDeleted', 'ASC'],
            ['updatedAt', 'DESC'],
            ['id', 'DESC']
          ],
          transaction,
        });

        const existingByName = new Map<string, any>();
        existingSettings.forEach((setting) => {
          if(!existingByName.has(setting.settingName)) {
            existingByName.set(setting.settingName, setting);
          }
        });

        const payloadSettingNames = new Set(normalizedSettings.map((setting) => setting.settingName));
        const savedSettings: any[] = [];

        for(const setting of normalizedSettings) {
          const existingSetting = existingByName.get(setting.settingName);

          if(existingSetting) {
            await existingSetting.update(
              {
                settingValue: setting.settingValue,
                isEnabled: setting.isEnabled ?? existingSetting.isEnabled ?? 1,
                isDeleted: 0,
                deletedAt: null,
                updatedAt: now,
              },
              { transaction }
            );
            savedSettings.push(existingSetting);
            continue;
          }

          const createdSetting = await UserSettings.create(
            {
              userId,
              settingName: setting.settingName,
              settingValue: setting.settingValue,
              isEnabled: setting.isEnabled ?? 1,
              isDeleted: 0,
              deletedAt: null,
              createdAt: now,
              updatedAt: now,
            },
            { transaction }
          );
          savedSettings.push(createdSetting);
        }

        const settingsToSoftDelete = existingSettings.filter(
          (setting) => setting.isDeleted === 0 && !payloadSettingNames.has(setting.settingName)
        );

        for(const setting of settingsToSoftDelete) {
          await setting.update(
            {
              isDeleted: 1,
              deletedAt: now,
              updatedAt: now,
            },
            { transaction }
          );
        }

        return savedSettings;
      });
    } catch (error) {
      throw error;
    }
  }

  async updateAppUser(updateObj: { [key: string]: any }, filter: {hostId: number, userId: number}): Promise<any> {    
   
    //console.log("###################### updateAppUser updateObj:", updateObj);
    if(!filter || !filter.hostId || !filter.userId) {
      throw new Error('hostId and userId are required for updating user');
    }

    if(!updateObj || Object.keys(updateObj).length === 0) {
      throw new Error('No fields provided for update');
    }

    const [updatedCount] = await User.update(
      {
        ...updateObj
      },
      {
        where: {          
          id: filter.userId,
          hostId: filter.hostId
        },
        individualHooks: true
      }
    );

    if (updatedCount === 0) {
      throw new Error('Failed to update app user');
    }

    return {
      id: filter.userId
    };
  }

  async updateUserDeviceDetails(payload: {
    hostId: number;
    userId: number;
    deviceId: string;
    deviceName?: string;
    deviceModel?: string;
    manufacturer?: string;
    brand?: string;
    device?: string;
    product?: string;
    hardware?: string | null;
    osVersion?: string;
    sdkInt?: number;
    appVersion?: string | null;
    storageTotalBytes?: number | null;
    storageAvailableBytes?: number | null;
    storageUsedBytes?: number | null;
    fcmToken?: string | null;
    createdAt?: number;
  }): Promise<any> {
    const { hostId, userId, deviceId, ...deviceData } = payload;

    if(!deviceData.createdAt) {
      deviceData.createdAt = DateTimeFormatUtil.getCurrentUnixTime();
    }

    // Try to find existing device record
    const existingDevice = await UserDevice.findOne({
      where: {
        hostId,
        userId,
        deviceId,
      },
    });

    if (existingDevice) {
      // Update existing record
      await existingDevice.update(deviceData);
      return existingDevice;
    } else {
      // Create new record
      return await UserDevice.create({
        hostId,
        userId,
        deviceId,
        ...deviceData,
      });
    }
  }
}

export default new usersRepository();
