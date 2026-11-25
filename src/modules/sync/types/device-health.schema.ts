import { z } from 'zod';

const safeInteger = z.number().int().safe();
const positiveInteger = safeInteger.positive();
const unixSeconds = positiveInteger.refine(
  (value) => value <= Math.floor(Date.now() / 1000) + 300,
  'Timestamp is too far in the future'
);
const permission = z.enum(['GRANTED', 'DENIED', 'NOT_APPLICABLE']);
const nullableBoolean = z.boolean().nullable();

export const deviceHealthSchema = z.strictObject({
  hostId: positiveInteger,
  userId: positiveInteger,
  deviceId: z.string().min(1).max(255).refine((value) => value.trim() === value),
  schemaVersion: z.literal(1),
  sequence: positiveInteger,
  collectedAt: unixSeconds,
  syncReason: z.enum([
    'INITIAL', 'APP_RESUME', 'PERMISSION_CHANGE', 'LOCATION_STATE_CHANGE', 'LOCATION_FAILURE',
    'BATTERY_STATE_CHANGE', 'NOTIFICATION_STATE_CHANGE', 'SERVICE_STATE_CHANGE',
    'NETWORK_RECONCILIATION', 'PERIODIC_RECONCILIATION', 'PENDING_RETRY',
  ]),
  deviceInfo: z.strictObject({
    deviceModel: z.string().max(100),
    manufacturer: z.string().max(100),
    androidVersion: z.string().max(50),
    sdkInt: safeInteger.min(1).max(32767),
    appVersion: z.string().max(64),
    versionCode: safeInteger.nonnegative(),
  }),
  permissions: z.strictObject({
    locationPermission: z.enum(['FINE', 'COARSE', 'DENIED']),
    backgroundLocationPermission: permission,
    cameraPermission: permission,
    microphonePermission: permission,
    notificationPermission: permission,
  }),
  deviceSettings: z.strictObject({
    locationEnabled: nullableBoolean,
    gpsProviderEnabled: nullableBoolean,
    batteryOptimizationIgnored: nullableBoolean,
    batterySaverEnabled: nullableBoolean,
    backgroundRestricted: nullableBoolean,
    appNotificationsEnabled: nullableBoolean,
    trackingNotificationChannelEnabled: nullableBoolean,
  }),
  trackingDiagnostics: z.strictObject({
    trackingExpected: z.boolean(),
    trackingServiceRunning: z.boolean(),
    trackingStatus: z.enum([
      'NOT_EXPECTED', 'PERMISSION_DENIED', 'LOCATION_DISABLED', 'UNKNOWN', 'SERVICE_FAILED',
      'BACKGROUND_PERMISSION_DENIED', 'SERVICE_STOPPED', 'STARTING', 'LOCATION_UNAVAILABLE', 'ACTIVE',
    ]),
    trackingIssue: z.enum([
      'LOCATION_PERMISSION_DENIED', 'PRECISE_LOCATION_UNAVAILABLE', 'LOCATION_DISABLED',
      'LOCATION_STATE_UNKNOWN', 'TRACKING_SERVICE_FAILED', 'BACKGROUND_LOCATION_PERMISSION_DENIED',
      'TRACKING_SERVICE_NOT_RUNNING', 'WAITING_FOR_FIRST_LOCATION', 'NO_RECENT_LOCATION',
      'BACKGROUND_ACCESS_LIMITED',
    ]).nullable(),
    lastLocationFetchResult: z.enum(['NOT_ATTEMPTED', 'SUCCESS', 'FAILED']),
    lastLocationFailureReason: z.enum([
      'UNKNOWN', 'TIMEOUT', 'PERMISSION_DENIED', 'LOCATION_DISABLED',
      'BACKGROUND_PERMISSION_DENIED', 'LOCATION_PERMISSION_DENIED', 'GPS_PROVIDER_DISABLED',
      'PROVIDER_DISABLED',
    ]).nullable(),
    lastLocationFetchAt: unixSeconds.nullable(),
    lastSuccessfulLocationAt: unixSeconds.nullable(),
    lastLocationAccuracyMeters: z.number().finite().nonnegative().nullable(),
  }),
  network: z.strictObject({
    connected: nullableBoolean,
    internetValidated: nullableBoolean,
    networkType: z.enum(['NONE', 'WIFI', 'CELLULAR', 'ETHERNET', 'OTHER']),
  }),
});

export type DeviceHealthInput = z.infer<typeof deviceHealthSchema>;
