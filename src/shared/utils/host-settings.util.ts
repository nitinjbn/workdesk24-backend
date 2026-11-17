import { Op, WhereOptions } from 'sequelize';
import HostSettings from '../../models/schemas/HostSettings';
import { CONFIG } from '../../config/constants';
import { CommonUtil } from './common.util';

export interface HostSettingsMap {
  [settingName: string]: any;
}

export interface HostDateTimeSettings {
  timeZone: string;
  dateTimeFormat: string;
  dateFormat: string;
  timeFormat: string;
}

const DEFAULT_TIME_ZONE = CONFIG.REPORTING.TIMEZONE;
const DEFAULT_DATE_TIME_FORMAT = CONFIG.REPORTING.DATE_TIME_FORMAT;
const DEFAULT_DATE_FORMAT = CONFIG.REPORTING.DATE_FORMAT;
const DEFAULT_TIME_FORMAT = CONFIG.REPORTING.TIME_FORMAT;

export const getHostSettingsValues = async (
  hostId: number,
  settingNames: string[]
): Promise<HostSettingsMap> => {
  const normalizedHostId = Number(hostId);
  const normalizedSettingNames = settingNames
    .map((settingName) => settingName?.trim())
    .filter((settingName): settingName is string => !!settingName);

  const values: HostSettingsMap = Object.fromEntries(
    normalizedSettingNames.map((settingName) => [settingName, null])
  );
  if (!Number.isFinite(normalizedHostId) || normalizedHostId <= 0 || !normalizedSettingNames.length) {
    return values;
  }

  const assignedKeyValueSettings = new Set<string>();

  const rows = await HostSettings.findAll({
    where: {
      hostId: normalizedHostId,
      settingName: {
        [Op.in]: normalizedSettingNames,
      },
      isEnabled: 1,
      isDeleted: 0,
    } as WhereOptions<HostSettings>,
    attributes: ['settingName', 'settingValue', 'updatedAt', 'createdAt', 'id'],
    order: [
      ['updatedAt', 'DESC'],
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
    raw: true,
  });

  rows.forEach((row) => {
    const settingName = row.settingName;
    if (
      settingName &&
      normalizedSettingNames.includes(settingName) &&
      !assignedKeyValueSettings.has(settingName)
    ) {
      values[settingName] = row.settingValue ?? null;
      assignedKeyValueSettings.add(settingName);
    }
  });

  return CommonUtil.convertSettingsToObject(
    normalizedSettingNames.map((settingName) => ({
      settingName,
      settingValue: values[settingName],
    }))
  );
};

export const getHostDateTimeSettings = async (hostId: number): Promise<HostDateTimeSettings> => {
  const settings = await getHostSettingsValues(hostId, ['timezone', 'dateTimeFormat', 'dateFormat', 'timeFormat']);

  return {
    timeZone: settings.timezone || DEFAULT_TIME_ZONE,
    dateTimeFormat: settings.dateTimeFormat || DEFAULT_DATE_TIME_FORMAT,
    dateFormat: settings.dateFormat || DEFAULT_DATE_FORMAT,
    timeFormat: settings.timeFormat || DEFAULT_TIME_FORMAT,
  };
};
