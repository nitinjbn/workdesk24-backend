export const searchEmployeesTool = {
    type: "function" as const,
    name: "search_employees",
    description:
        "Search employees in the authenticated organization by employee name, employee code, or email. Use this when an administrator refers to an employee by name, employee code, or email.",

    strict: true,

    parameters: {
        type: "object",

        properties: {
            search: {
                type: "string",
                description:
                    "Employee name, employee code, or email to search for.",
            },
        },

        required: ["search"],

        additionalProperties: false,
    },
};