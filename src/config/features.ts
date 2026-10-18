export const FEATURES = {
  DETAILS: {
    ATTENDANCE: {
      FEATURE_KEY: 'ATTENDANCE',
      FEATURE_NAME: 'Attendance',
      REMARKS: 'This feature tracks attendance',
      DEFAULT_ENABLED: 1,
    },
    LEAVE: {
      FEATURE_KEY: 'LEAVE',
      FEATURE_NAME: 'Leave',
      REMARKS: 'This feature manages leave requests',
      DEFAULT_ENABLED: 1,
    },
    LOCATION_TRACKING: {
      FEATURE_KEY: 'LOCATION_TRACKING',
      FEATURE_NAME: 'Location Tracking',
      REMARKS: 'This feature tracks the location of users',
      DEFAULT_ENABLED: 1,
    },
    VISIT: {
      FEATURE_KEY: 'VISIT',
      FEATURE_NAME: 'Visit',
      REMARKS: 'This feature manages visits',
      DEFAULT_ENABLED: 1,
      SUB_FEATURES: {
        ORDER: {
          FEATURE_KEY: 'ORDER',
          FEATURE_NAME: 'Order',
          REMARKS: 'This feature manages orders',
          DEFAULT_ENABLED: 1,
        },
        PAYMENT: {
          FEATURE_KEY: 'PAYMENT',
          FEATURE_NAME: 'Payment',
          REMARKS: 'This feature manages payments',
          DEFAULT_ENABLED: 1,
        },
        FEEDBACK: {
          FEATURE_KEY: 'FEEDBACK',
          FEATURE_NAME: 'Feedback',
          REMARKS: 'This feature manages feedback',
          DEFAULT_ENABLED: 1,
        },
        VISIT_IMAGE: {
          FEATURE_KEY: 'VISIT_IMAGE',
          FEATURE_NAME: 'Visit Image',
          REMARKS: 'This feature manages visit images',
          DEFAULT_ENABLED: 1,
        },
      }
    },    
    TASK_MANAGEMENT: {
      FEATURE_KEY: 'TASK_MANAGEMENT',
      FEATURE_NAME: 'Task Management',
      REMARKS: 'This feature manages tasks',
      DEFAULT_ENABLED: 1,
    },
    API_LOGS: {
      FEATURE_KEY: 'API_LOGS',
      FEATURE_NAME: 'API Logs',
      REMARKS: 'This feature tracks API logs',
      DEFAULT_ENABLED: 1,
    },
  }
};
