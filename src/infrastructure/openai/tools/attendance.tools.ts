export const getAttendanceSummaryTool = {
    type: "function" as const,

    name: "get_attendance_summary",

    description:
        "Get attendance summary for employees for a specified date range. " +
        "Use this tool when the administrator asks about attendance, " +
        "present employees, absent employees, leave, working days, " +
        "or attendance percentage.",

    strict: true,

    parameters: {
        type: "object",

        properties: {
            fromDate: {
                type: "string",
                description: "Start date in YYYY-MM-DD format.",
            },

            toDate: {
                type: "string",
                description: "End date in YYYY-MM-DD format.",
            },

            employeeIds: {
                type: ["array", "null"],
                items: {
                    type: "string",
                },
                description:
                    "Optional employee IDs. Use null when the request applies to all employees.",
            },
        },

        required: [
            "fromDate",
            "toDate",
            "employeeIds",
        ],

        additionalProperties: false,
    },
};