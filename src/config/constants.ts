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
};