export const CONFIG = {
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