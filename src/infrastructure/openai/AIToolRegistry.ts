import { getAttendanceSummaryTool } from "./tools/attendance.tools";
import { handleGetAttendanceSummary } from "./tools/attendance.tool-handler";

export const AI_TOOLS = [
    getAttendanceSummaryTool,
];

export const AI_TOOL_HANDLERS = {
    get_attendance_summary: handleGetAttendanceSummary,
} as const;