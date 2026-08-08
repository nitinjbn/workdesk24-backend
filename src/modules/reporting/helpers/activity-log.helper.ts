import moment from 'moment-timezone';
import { ACTIVITY_DETAILS } from '../../../config/activityLog';
import { HostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { CONFIG } from '../../../config/constants';

type ActivityDetail = (typeof ACTIVITY_DETAILS)[keyof typeof ACTIVITY_DETAILS];

interface ActivityEnrichment {
  description: string | null;
  redirectUrl: string | null;
  payload: Record<string, unknown> | null;
}

function formatUnixForDisplay(unix: number, settings?: HostDateTimeSettings): string {
  const tz = settings?.timeZone || CONFIG.REPORTING.TIMEZONE;
  const fmt = settings?.dateTimeFormat || CONFIG.REPORTING.DATE_TIME_FORMAT;
  const safeZone = moment.tz.zone(tz) ? tz : CONFIG.REPORTING.TIMEZONE;
  const m = moment.unix(unix).tz(safeZone);
  return m.isValid() ? m.format(fmt) : String(unix);
}

function replaceVars(template: string, vars: Record<string, string>): string {
  return template.replace(/\$\{(\w+)\}/g, (_, key) => vars[key] ?? '');
}

function deepReplaceVars(value: unknown, vars: Record<string, string>): unknown {
  if (typeof value === 'string') return replaceVars(value, vars);
  if (Array.isArray(value)) return value.map((v) => deepReplaceVars(v, vars));
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, deepReplaceVars(v, vars)])
    );
  }
  return value;
}

export function resolveActivityEnrichment(
  record: Record<string, any>,
  settings?: HostDateTimeSettings
): ActivityEnrichment {
  const descriptionKey = record.descriptionKey as keyof typeof ACTIVITY_DETAILS | undefined;
  if (!descriptionKey || !(descriptionKey in ACTIVITY_DETAILS)) {
    return { description: null, redirectUrl: null, payload: null };
  }

  const detail: ActivityDetail = ACTIVITY_DETAILS[descriptionKey];
  const metadata: Record<string, any> = record.metadata ?? {};
  const activityTime = Number(record.activityTime);

  const tz = settings?.timeZone || CONFIG.REPORTING.TIMEZONE;
  const safeZone = moment.tz.zone(tz) ? tz : CONFIG.REPORTING.TIMEZONE;
  const dayStart = Number.isFinite(activityTime) && activityTime > 0
    ? moment.unix(activityTime).tz(safeZone).startOf('day').unix()
    : null;
  const dayEnd = Number.isFinite(activityTime) && activityTime > 0
    ? moment.unix(activityTime).tz(safeZone).endOf('day').unix()
    : null;

  const vars: Record<string, string> = {
    employeeName: metadata.employeeName ?? '',
    customerName: metadata.customerName ?? '',
    userId: String(record.userId ?? ''),
    activityTime: Number.isFinite(activityTime) && activityTime > 0
      ? formatUnixForDisplay(activityTime, settings)
      : '',
    fromTime: dayStart !== null ? String(dayStart) : '',
    toTime: dayEnd !== null ? String(dayEnd) : '',
    amount: String(metadata.amount ?? metadata.totalAmount ?? ''),
    lateMinutes: String(metadata.lateMinutes ?? ''),
    earlyMinutes: String(metadata.earlyMinutes ?? ''),
  };

  return {
    description: replaceVars(detail.description, vars),
    redirectUrl: detail.url,
    payload: deepReplaceVars(detail.payload, vars) as Record<string, unknown>,
  };
}
