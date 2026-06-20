import { Op, WhereOptions } from 'sequelize';
import HostSettings from '../../models/schemas/HostSettings';
import { CONFIG } from '../../config/constants';

export interface HostSettingsMap {
  [settingName: string]: string;
}

export interface HostDateTimeSettings {
  timeZone: string;
  dateTimeFormat: string;
}

const DEFAULT_TIME_ZONE = CONFIG.REPORTING.TIMEZONE;
const DEFAULT_DATE_TIME_FORMAT = CONFIG.REPORTING.DATE_TIME_FORMAT;

export const getHostSettingsValues = async (
  hostId: number,
  settingNames: string[]
): Promise<HostSettingsMap> => {
  const normalizedHostId = Number(hostId);
  if (!Number.isFinite(normalizedHostId) || normalizedHostId <= 0) {
    return {};
  }

  const normalizedSettingNames = settingNames
    .map((settingName) => settingName?.trim())
    .filter((settingName): settingName is string => !!settingName);

  if (!normalizedSettingNames.length) {
    return {};
  }

  const rows = await HostSettings.findAll({
    where: {
      hostId: normalizedHostId,
      settingName: {
        [Op.in]: normalizedSettingNames,
      },
      isEnabled: 1,
      isDeleted: 0,
    } as WhereOptions<HostSettings>,
    attributes: ['settingName', 'settingValue', 'updatedAt', 'createdAt'],
    order: [
      ['updatedAt', 'DESC'],
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
  });

  const values: HostSettingsMap = {};

  rows.forEach((row) => {
    const settingName = row.settingName;
    if (!settingName || values[settingName] !== undefined) {
      return;
    }

    values[settingName] = row.settingValue;
  });

  return values;
};

export const getHostDateTimeSettings = async (hostId: number): Promise<HostDateTimeSettings> => {
  const settings = await getHostSettingsValues(hostId, ['timezone', 'dateTimeFormat']);

  return {
    timeZone: settings.timezone || DEFAULT_TIME_ZONE,
    dateTimeFormat: settings.dateTimeFormat || DEFAULT_DATE_TIME_FORMAT,
  };
};
