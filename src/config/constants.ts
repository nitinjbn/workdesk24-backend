export const CONFIG = {
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
  }
};