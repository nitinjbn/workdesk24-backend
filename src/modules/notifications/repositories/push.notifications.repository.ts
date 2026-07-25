import { FindAndCountOptions, Includeable , Op} from 'sequelize';
import db, { UserPushNotifications, UserSettings, Role, Designation, UserDevice } from '../../../models';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';

type UserPushNotificationsInstance = typeof UserPushNotifications.prototype;


export class pushNotificationsRepository {
  async savePushNotification(payload: any): Promise<UserPushNotificationsInstance> {
    if (!payload) {
      throw new Error('Payload is required to save push notification');
    }

    const currentTime = DateTimeFormatUtil.getCurrentUnixTime();
    payload.createdAt = currentTime;
    const savedNotification = await UserPushNotifications.create(payload);
    return savedNotification;
  }
}

export default new pushNotificationsRepository();
