import { FindAndCountOptions, Op, Transaction } from 'sequelize';
import db, { Host, HostSettings, HostSubscription, User } from '../../../models';
import { ReportResponse } from '../types/master.types';

export class hostRepository {
  async createHost(params: any, transaction?: Transaction): Promise<any> {
    console.log('Creating host with params:', params);
    const createHostResult = await Host.create(
      {
        ...params,
      },
      { logging: console.log, transaction }
    );
    return createHostResult;
  }

  async createHostSubscription(params: any, transaction?: Transaction): Promise<any> {
    const createHostSubscriptionResult = await HostSubscription.create(
      {
        ...params,
      },
      { logging: console.log, transaction }
    );
    return createHostSubscriptionResult;
  }

  async createAdminUser(params: any, transaction?: Transaction): Promise<any> {
    const {
      hostId,
      name,
      employeeCode,
      email,
      enteredMobileNumber,
      callingCode,
      mobile,
      dateOfBirth,
      password,
      reportingManagerId,
      roleId,
      designationId,
      profileImageUrl,
      joiningDate,
      accountStatus,
      createdAt,
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
      isAdminUser,
    } = params;
    const newUser = await User.create(
      {
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
        accountStatusUpdatedAt: createdAt,
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
        isAdminUser,
        isDeleted: 0,
        createdAt,
      },
      { transaction }
    );

    return newUser;
  }

  async getHostCurrentSubscription(params: { hostId: number; currentDate: string }): Promise<any> {
    const { hostId, currentDate } = params;

    const where: any = {
      hostId,
      isDeleted: 0,
      planStartDate: {
        [Op.lte]: currentDate,
      },
      planEndDate: {
        [Op.gte]: currentDate,
      },
    };

    const query: FindAndCountOptions<any> = {
      attributes: [
        'id',
        'hostId',
        'licensedUserCount',
        'planStartDate',
        'planEndDate',
        'isDeleted',
        'createdAt',
        'updatedAt',
      ],
      where,
      order: [['planStartDate', 'DESC']],
      logging: console.log, // Enable logging for debugging
    };

    const subscriptionDetails = await HostSubscription.findOne(query);
    return {
      data: subscriptionDetails?.toJSON() || {},
    };
  }

  async getHostBySubDomain(params: { subDomain: string }): Promise<any> {
    const { subDomain } = params;

    const host = await Host.findOne({
      where: {
        subDomain,
        isDeleted: 0,
      },
      logging: console.log,
    });

    return {
      data: host?.toJSON() || {},
    };
  }
}

export default new hostRepository();
