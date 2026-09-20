import { createConfiguredError } from '../../../shared/utils/error.util';
import userService from '../services/user.service';
import hostService from '../services/host.service';

class UserValidator {
  static validateHostId(hostId: number) {
    if (!hostId) {
      throw createConfiguredError('INVALID_PARAMETERS', 'Host ID is required.');
    }
  }

  static async checkCreateAppUserEligibility(hostId: number) {
    const currentSubscription = await hostService.getCurrentSubscription(hostId);
    if (!currentSubscription || Object.keys(currentSubscription).length === 0) {
      throw createConfiguredError(
        'NO_ACTIVE_SUBSCRIPTION_FOR_HOST',
        "You don't have an active subscription."
      );
    }

    const licensedUserCount = currentSubscription?.licensedUserCount || 0;
    if (licensedUserCount <= 0) {
      throw createConfiguredError(
        'NO_APP_USER_ALLOWED_UNDER_CURRENT_SUBSCRIPTION',
        'You are not allowed to create any user under your current subscription. Please contact WorkDesk24 Support to add user.'
      );
    }

    if (licensedUserCount > 0) {
      const totalExistingAppUsers = await userService.getTotalAppUsersCount(hostId);
      if (totalExistingAppUsers >= licensedUserCount) {
        throw createConfiguredError(
          'MAX_APP_USERS_CREATED_UNDER_CURRENT_SUBSCRIPTION',
          'You have already created the maximum number of users allowed under your current subscription. Please contact WorkDesk24 Support to add more users.'
        );
      }
    }
    return true;
  }
}

export default UserValidator;
