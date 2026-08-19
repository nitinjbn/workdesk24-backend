import {
    getAttendanceSummaryTool,
    getAttendanceRecordsTool,
} from "./tools/attendance.tools";

import {
    handleGetAttendanceSummary,
    handleGetAttendanceRecords,
} from "./tools/attendance.tool-handler";

import {
    searchEmployeesTool,
} from "./tools/employee.tools";

import {
    handleSearchEmployees,
} from "./tools/employee.tool-handler";


export const AI_TOOLS = [
    searchEmployeesTool,
    getAttendanceSummaryTool,
    getAttendanceRecordsTool,
];


export const AI_TOOL_HANDLERS = {
    search_employees: handleSearchEmployees,
    get_attendance_summary: handleGetAttendanceSummary,
    get_attendance_records: handleGetAttendanceRecords,
} as const;