import reportService from "../../../modules/reporting/services/report.service";
import { AIRequestContext } from "../types/AIRequestContext";

export interface GetAttendanceSummaryArgs {
    fromDate: string;
    toDate: string;
    employeeIds: string[] | null;
}

interface AIAttendanceRecord {
    employeeName: string | null;
    employeeCode: string | null;
    attendanceStatus: string | null;
    attendanceTime: string | null;
}

interface AIAttendanceResult {
    dateRange: {
        from: string;
        to: string;
    };
    totalRecords: number;
    records: AIAttendanceRecord[];
}

export async function handleGetAttendanceSummary(
    args: GetAttendanceSummaryArgs,
    context: AIRequestContext
): Promise<AIAttendanceResult> {

    const result = await reportService.getAttendanceReport(
        {
            hostId: context.hostId,
            filter: {
                from: args.fromDate,
                to: args.toDate,
                employeeIds: args.employeeIds ?? undefined,
            },
        },
        {
            hostId: context.hostId as any,
            requestUserId: null,
        }
    );

    const records: AIAttendanceRecord[] = result.attendance.map(
        (attendance: any) => ({
            employeeName:
                attendance.employeeName ??
                null,

            employeeCode:
                attendance.employeeCode ??
                null,

            attendanceStatus:
                attendance.attendanceStatus ?? null,

            attendanceTime:
                attendance.attendanceTime ?? null,
        })
    );

    return {
        dateRange: {
            from: args.fromDate,
            to: args.toDate,
        },

        totalRecords: records.length,

        records,
    };
}