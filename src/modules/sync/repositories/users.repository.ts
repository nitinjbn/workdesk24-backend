import { FindAndCountOptions, Includeable , Op} from 'sequelize';
import db, { User, UserSettings, Role, Designation, UserDevice } from '../../../models';

export class usersRepository {
  


  async getUserById(params: {hostId: number, userId: number}): Promise<any> {
    const { hostId, userId } = params;

    const where:any = {
      hostId,
      id: userId,
      isDeleted:0
    }
   
    const query: FindAndCountOptions<any> = {
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
}

export default new usersRepository();
