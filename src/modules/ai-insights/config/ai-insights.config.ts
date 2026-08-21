import {
  AiInsightCategory,
  AiInsightFilterDefinition
} from "../types/ai-insights.types";

const DATE_FILTER: AiInsightFilterDefinition = {
  key: "date",
  type: "date",
  required: true,
  defaultValue: {
    type: "preset",
    value: "today"
  },
  presets: [
    "today",
    "yesterday",
    "this_week",
    "last_week",
    "this_month",
    "last_month",
    "custom"
  ]
};

const EMPLOYEE_FILTER: AiInsightFilterDefinition = {
  key: "employees",
  type: "multi_select",
  required: false,
  defaultValue: []
};

const CUSTOMER_FILTER: AiInsightFilterDefinition = {
  key: "customers",
  type: "multi_select",
  required: false,
  defaultValue: []
};

export const AI_INSIGHTS_CONFIG: AiInsightCategory[] = [
  {
    id: "attendance",
    name: "Attendance",
    description: "Attendance, working hours and punctuality insights",
    icon: "calendar-check",
    displayOrder: 1,
    enabled: true,

    questions: [
      {
        id: "attendance.earliest",
        question: "Who marked attendance earliest?",
        shortQuestion: "Earliest attendance",
        description:
          "Find employees who marked attendance earliest during the selected period",
        icon: "clock",
        resultType: "ranking",

        filters: [
          DATE_FILTER,
          EMPLOYEE_FILTER
        ],

        options: {
          limit: {
            enabled: true,
            default: 5,
            min: 1,
            max: 50
          },
          comparison: {
            enabled: false
          }
        }
      },

      {
        id: "attendance.latest",
        question: "Who marked attendance latest?",
        shortQuestion: "Latest attendance",
        description:
          "Find employees who marked attendance latest during the selected period",
        icon: "clock",
        resultType: "ranking",

        filters: [
          DATE_FILTER,
          EMPLOYEE_FILTER
        ],

        options: {
          limit: {
            enabled: true,
            default: 5,
            min: 1,
            max: 50
          },
          comparison: {
            enabled: false
          }
        }
      },

      {
        id: "attendance.absent",
        question: "Who is absent?",
        shortQuestion: "Absent employees",
        description: "Find employees who have not marked attendance",
        icon: "user-x",
        resultType: "employee_list",

        filters: [
          DATE_FILTER,
          EMPLOYEE_FILTER
        ],

        options: {
          limit: {
            enabled: true,
            default: 20,
            min: 1,
            max: 100
          },
          comparison: {
            enabled: false
          }
        }
      },

      {
        id: "attendance.present",
        question: "Who is present?",
        shortQuestion: "Present employees",
        description: "Find employees who marked attendance",
        icon: "user-check",
        resultType: "employee_list",

        filters: [
          DATE_FILTER,
          EMPLOYEE_FILTER
        ],

        options: {
          limit: {
            enabled: true,
            default: 20,
            min: 1,
            max: 100
          },
          comparison: {
            enabled: false
          }
        }
      },

      {
        id: "attendance.average_working_hours",
        question: "What are average working hours?",
        shortQuestion: "Average working hours",
        description: "Average working hours based on attendance/dayover records",
        icon: "timer",
        resultType: "metric",

        filters: [
          DATE_FILTER,
          EMPLOYEE_FILTER
        ],

        options: {
          limit: {
            enabled: true,
            default: 20,
            min: 1,
            max: 100
          },
          comparison: {
            enabled: false
          }
        }
      }
    ]
  },

  // ----------------------------------------------------
  // VISITS
  // ----------------------------------------------------

  {
    id: "visits",
    name: "Visits",
    description: "Customer visits and field activity insights",
    icon: "map-pin",
    displayOrder: 2,
    enabled: true,

    questions: [
      {
        id: "visits.top_employee",
        question: "Who made the most visits?",
        shortQuestion: "Top visit performer",
        description:
          "Find employees with the highest number of customer visits",
        icon: "trending-up",
        resultType: "ranking",

        filters: [
          DATE_FILTER,
          EMPLOYEE_FILTER,
          CUSTOMER_FILTER
        ],

        options: {
          limit: {
            enabled: true,
            default: 5,
            min: 1,
            max: 50
          },
          comparison: {
            enabled: true
          }
        }
      },

      {
        id: "visits.most_visits",
        question: "Which employees have the most visits?",
        shortQuestion: "Most visits",
        description: "Rank employees by number of visits",
        icon: "list-ordered",
        resultType: "ranking",
        filters: [DATE_FILTER, EMPLOYEE_FILTER, CUSTOMER_FILTER],
        options: {
          limit: {
            enabled: true,
            default: 10,
            min: 1,
            max: 50
          },
          comparison: {
            enabled: false
          }
        }
      },

      {
        id: "visits.completed",
        question: "How many visits were completed?",
        shortQuestion: "Completed visits",
        description: "Count visits where checkout was marked",
        icon: "check",
        resultType: "metric",
        filters: [DATE_FILTER, EMPLOYEE_FILTER, CUSTOMER_FILTER]
      },

      {
        id: "visits.cancelled",
        question: "How many visits were cancelled?",
        shortQuestion: "Cancelled visits",
        description: "Count cancelled visits if cancellation status is captured",
        icon: "x",
        resultType: "metric",
        filters: [DATE_FILTER, EMPLOYEE_FILTER, CUSTOMER_FILTER]
      },

      {
        id: "visits.average",
        question: "What are average visits per employee?",
        shortQuestion: "Average visits",
        description: "Average number of visits per active employee in range",
        icon: "bar-chart-2",
        resultType: "metric",
        filters: [DATE_FILTER, EMPLOYEE_FILTER, CUSTOMER_FILTER]
      }
    ]
  },

  // ----------------------------------------------------
  // ORDERS
  // ----------------------------------------------------

  {
    id: "orders",
    name: "Orders",
    description: "Order volume and sales insights",
    icon: "shopping-cart",
    displayOrder: 3,
    enabled: true,

    questions: [
      {
        id: "orders.top_employee",
        question: "Who generated the highest order value?",
        shortQuestion: "Top order performer",
        description:
          "Find employees with the highest order value",
        icon: "trophy",
        resultType: "ranking",

        filters: [
          DATE_FILTER,
          EMPLOYEE_FILTER,
          CUSTOMER_FILTER
        ],

        options: {
          limit: {
            enabled: true,
            default: 5,
            min: 1,
            max: 50
          },
          comparison: {
            enabled: true
          }
        }
      },

      {
        id: "orders.highest_value",
        question: "What is the highest order value?",
        shortQuestion: "Highest order value",
        description: "Returns highest single order amount",
        icon: "arrow-up-right",
        resultType: "metric",
        filters: [DATE_FILTER, EMPLOYEE_FILTER, CUSTOMER_FILTER]
      },

      {
        id: "orders.total",
        question: "How many orders were created?",
        shortQuestion: "Total orders",
        description: "Count of orders created in selected period",
        icon: "hash",
        resultType: "metric",
        filters: [DATE_FILTER, EMPLOYEE_FILTER, CUSTOMER_FILTER]
      },

      {
        id: "orders.total_value",
        question: "What is the total order value?",
        shortQuestion: "Total order value",
        description: "Total value of orders in selected period",
        icon: "indian-rupee",
        resultType: "metric",
        filters: [DATE_FILTER, EMPLOYEE_FILTER, CUSTOMER_FILTER]
      }
    ]
  },

  {
    id: "payments",
    name: "Payments",
    description: "Payment amount and collection insights",
    icon: "wallet",
    displayOrder: 4,
    enabled: true,
    questions: [
      {
        id: "payments.top_employee",
        question: "Who collected the highest payment amount?",
        shortQuestion: "Top payment performer",
        description: "Rank employees by payment collection value",
        icon: "trophy",
        resultType: "ranking",
        filters: [DATE_FILTER, EMPLOYEE_FILTER, CUSTOMER_FILTER],
        options: {
          limit: {
            enabled: true,
            default: 5,
            min: 1,
            max: 50
          },
          comparison: {
            enabled: true
          }
        }
      },
      {
        id: "payments.total",
        question: "How many payments were recorded?",
        shortQuestion: "Total payments",
        description: "Total number of payment entries",
        icon: "hash",
        resultType: "metric",
        filters: [DATE_FILTER, EMPLOYEE_FILTER, CUSTOMER_FILTER]
      },
      {
        id: "payments.total_value",
        question: "What is the total payment value?",
        shortQuestion: "Total payment value",
        description: "Total payment amount collected",
        icon: "indian-rupee",
        resultType: "metric",
        filters: [DATE_FILTER, EMPLOYEE_FILTER, CUSTOMER_FILTER]
      }
    ]
  },

  // ----------------------------------------------------
  // PERFORMANCE
  // ----------------------------------------------------

  {
    id: "performance",
    name: "Performance",
    description: "Employee and team performance insights",
    icon: "trophy",
    displayOrder: 5,
    enabled: true,

    questions: [
      {
        id: "performance.best",
        question: "Who is the best performer?",
        shortQuestion: "Best performer",
        description:
          "Find the highest-performing employees",
        icon: "trophy",
        resultType: "ranking",

        filters: [
          DATE_FILTER,
          EMPLOYEE_FILTER,
        ],

        options: {
          limit: {
            enabled: true,
            default: 5,
            min: 1,
            max: 50
          },
          comparison: {
            enabled: true
          }
        }
      },

      {
        id: "performance.lowest",
        question: "Who is the lowest performer?",
        shortQuestion: "Lowest performer",
        description:
          "Find the lowest-performing employees using the weighted performance score",
        icon: "trending-down",
        resultType: "ranking",

        filters: [
          DATE_FILTER,
          EMPLOYEE_FILTER,
        ],

        options: {
          limit: {
            enabled: true,
            default: 5,
            min: 1,
            max: 50
          },
          comparison: {
            enabled: true
          }
        }
      },

      {
        id: "performance.most_improved",
        question: "Who improved the most?",
        shortQuestion: "Most improved",
        description:
          "Find employees with the highest performance improvement",
        icon: "trending-up",
        resultType: "ranking",

        filters: [
          DATE_FILTER,
          EMPLOYEE_FILTER
        ],

        options: {
          limit: {
            enabled: true,
            default: 5,
            min: 1,
            max: 50
          },
          comparison: {
            enabled: true
          }
        }
      },

      {
        id: "performance.top_visit",
        question: "Who is the top visit performer?",
        shortQuestion: "Top visit performer",
        description: "Rank by total visits",
        icon: "map-pin",
        resultType: "ranking",
        filters: [DATE_FILTER, EMPLOYEE_FILTER]
      },

      {
        id: "performance.top_order",
        question: "Who is the top order performer?",
        shortQuestion: "Top order performer",
        description: "Rank by total order value",
        icon: "shopping-cart",
        resultType: "ranking",
        filters: [DATE_FILTER, EMPLOYEE_FILTER]
      },

      {
        id: "performance.top_payment",
        question: "Who is the top payment performer?",
        shortQuestion: "Top payment performer",
        description: "Rank by total payment value",
        icon: "wallet",
        resultType: "ranking",
        filters: [DATE_FILTER, EMPLOYEE_FILTER]
      }
    ]
  },

  {
    id: "feedback",
    name: "Feedback",
    description: "Feedback collection insights",
    icon: "message-square",
    displayOrder: 6,
    enabled: true,
    questions: [
      {
        id: "feedback.total",
        question: "How much feedback was received?",
        shortQuestion: "Total feedback",
        description: "Total feedback records",
        icon: "hash",
        resultType: "metric",
        filters: [DATE_FILTER, EMPLOYEE_FILTER, CUSTOMER_FILTER]
      },
      {
        id: "feedback.top_employee",
        question: "Who received the highest feedback volume?",
        shortQuestion: "Top feedback employee",
        description: "Ranks employees by feedback count",
        icon: "award",
        resultType: "ranking",
        filters: [DATE_FILTER, EMPLOYEE_FILTER, CUSTOMER_FILTER],
        options: {
          limit: {
            enabled: true,
            default: 5,
            min: 1,
            max: 50
          },
          comparison: {
            enabled: false
          }
        }
      },
      {
        id: "feedback.average_rating",
        question: "What is the average feedback rating?",
        shortQuestion: "Average feedback rating",
        description: "Average rating, if rating field exists in schema",
        icon: "star",
        resultType: "metric",
        filters: [DATE_FILTER, EMPLOYEE_FILTER, CUSTOMER_FILTER]
      }
    ]
  },

  {
    id: "dayover",
    name: "Dayover",
    description: "Dayover completion insights",
    icon: "sunset",
    displayOrder: 7,
    enabled: true,
    questions: [
      {
        id: "dayover.completed",
        question: "How many dayovers were completed?",
        shortQuestion: "Completed dayovers",
        description: "Count dayover submissions",
        icon: "check",
        resultType: "metric",
        filters: [DATE_FILTER, EMPLOYEE_FILTER]
      },
      {
        id: "dayover.pending",
        question: "Who has pending dayover?",
        shortQuestion: "Pending dayovers",
        description: "Employees with attendance but no dayover",
        icon: "alert-circle",
        resultType: "employee_list",
        filters: [DATE_FILTER, EMPLOYEE_FILTER],
        options: {
          limit: {
            enabled: true,
            default: 20,
            min: 1,
            max: 100
          },
          comparison: {
            enabled: false
          }
        }
      },
      {
        id: "dayover.completion_rate",
        question: "What is dayover completion rate?",
        shortQuestion: "Dayover completion rate",
        description: "Completion percentage for attendance records",
        icon: "percent",
        resultType: "metric",
        filters: [DATE_FILTER, EMPLOYEE_FILTER]
      }
    ]
  }
];