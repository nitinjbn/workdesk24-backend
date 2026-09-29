import { Op, WhereOptions } from 'sequelize';
import UserSettings from '../../models/schemas/UserSettings';

export interface UserSettingsMap {
  [settingName: string]: string;
}

export const getUserSettingsValues = async (
  userId: number,
  settingNames: string[]
): Promise<UserSettingsMap> => {
  const normalizedUserId = Number(userId);
  if (!Number.isFinite(normalizedUserId) || normalizedUserId <= 0) {
    return {};
  }

  const normalizedSettingNames = settingNames
    .map((settingName) => settingName?.trim())
    .filter((settingName): settingName is string => !!settingName);

  if (!normalizedSettingNames.length) {
    return {};
  }

  const rows = await UserSettings.findAll({
    where: {
      userId: normalizedUserId,
      settingName: {
        [Op.in]: normalizedSettingNames,
      },
      isEnabled: 1,
      isDeleted: 0,
    } as WhereOptions<UserSettings>,
    attributes: ['settingName', 'settingValue', 'updatedAt', 'createdAt'],
    order: [
      ['updatedAt', 'DESC'],
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
  });

  const values: UserSettingsMap = {};

  rows.forEach((row) => {
    const settingName = row.settingName;
    if (!settingName || values[settingName] !== undefined) {
      return;
    }

    values[settingName] = row.settingValue;
  });

  return values;
};
