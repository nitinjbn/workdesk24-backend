export const CONFIG = {
  APP_CONFIG: {
    NAME: process.env.APP_NAME || 'WorkDesk24',
  },
  REPORTING: {
    TIMEZONE: 'Asia/Kolkata',
    DATE_FORMAT: 'DD-MMM-YYYY',
    TIME_FORMAT: 'hh:mm A',
    DATE_TIME_FORMAT: 'DD-MMM-YYYY hh:mm A',
  },
  AUTH: {
    APP: {
      LOGIN: {
        // Roles allowed to login via /api/v1/auth/login
        ALLOWED_ROLES: [
          'FIELD_EXECUTIVE'
        ],
      },
    },
    ADMIN_PANEL: {
        LOGIN: {
            // Roles allowed to access admin panel
            ALLOWED_ROLES: [
                'ADMIN',
                'SUPER_ADMIN',
                'TEAM_LEAD',
                'VIEWER',
            ],
        },
    },
  },
  USER: {
    MOBILE: {
      DEFAULT_COUNTRY: 'IN',
      ALLOWED_TYPES: ['MOBILE', 'FIXED_LINE_OR_MOBILE'],
    },
    GENDER: {
      "MALE": "Male",
      "FEMALE": "Female",
      "OTHER": "Other",
      "PREFER_NOT_TO_SAY": "Prefer not to say"
    }
  },
  WEEKDAY_FLAGS: {
    SUNDAY: 1,
    MONDAY: 2,
    TUESDAY: 4,
    WEDNESDAY: 8,
    THURSDAY: 16,
    FRIDAY: 32,
    SATURDAY: 64
  },
  NOTIFICATIONS: {
    CHANNELS: {
      EMAIL: 'EMAIL',
      SMS: 'SMS',
      PUSH: 'PUSH',
      WHATSAPP: 'WHATSAPP'
    },
    EMAIL: {
      PROVIDER: (process.env.NOTIFICATIONS_EMAIL_PROVIDER || 'SES').toUpperCase(),
      FROM_NAME: process.env.SES_FROM_NAME || 'Workdesk24',
      FROM_ADDRESS: process.env.SES_FROM_EMAIL || 'noreply@workdesk24.com',
      REPLY_TO: process.env.SES_REPLY_TO || 'noreply@workdesk24.com',
      SES: {
        REGION: process.env.AWS_SES_REGION || process.env.AWS_REGION || 'ap-south-1',
        ACCESS_KEY_ID: process.env.AWS_SES_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID || '',
        SECRET_ACCESS_KEY: process.env.AWS_SES_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY || '',
        SESSION_TOKEN: process.env.AWS_SES_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN || ''
      }
    }
  },
  OTP: {
    AUTH: {
      PURPOSE_KEY: 'AUTH_OTP',
      LABEL: 'Account Verification',
      EMAIL_TEMPLATE: 'AUTH_OTP_EMAIL',
      CODE_LENGTH: 6,
      EXPIRY_MINUTES: 10,
      MAX_ATTEMPTS: 5,
      MAX_RESENDS: 3,
    },
    PASSWORD_RESET: {
      PURPOSE_KEY: 'PASSWORD_RESET',
      LABEL: 'Password Reset',
      EMAIL_TEMPLATE: 'PASSWORD_RESET_EMAIL',
      CODE_LENGTH: 6,
      EXPIRY_MINUTES: 10,
      MAX_ATTEMPTS: 5,
      MAX_RESENDS: 3,
    },
    EMAIL_VERIFICATION: {
      PURPOSE_KEY: 'EMAIL_VERIFICATION',
      LABEL: 'Email Verification',
      EMAIL_TEMPLATE: 'EMAIL_VERIFICATION_EMAIL',
      CODE_LENGTH: 6,
      EXPIRY_MINUTES: 15,
      MAX_ATTEMPTS: 5,
      MAX_RESENDS: 3,
    }
  }
}