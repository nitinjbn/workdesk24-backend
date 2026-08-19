import reportService from "../../../modules/reporting/services/report.service";
import userService from "../../../modules/master/services/user.service";
import moment from "moment-timezone";
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

export interface GetAttendanceRecordsArgs {
    fromDate: string;
    toDate: string;
    userId: string;
}

interface AIAttendanceResult {
    dateRange: {
        from: string;
        to: string;
    };
    totalRecords: number;
    records: AIAttendanceRecord[];
}

const getAttendanceTimeRange = (
    fromDate: string,
    toDate: string,
    timezone: string,
): { from: number; to: number } | null => {
    if (!moment.tz.zone(timezone)) {
        return null;
    }

    const from = moment.tz(fromDate, "YYYY-MM-DD", true, timezone).startOf("day");
    const toExclusive = moment.tz(toDate, "YYYY-MM-DD", true, timezone)
        .add(1, "day")
        .startOf("day");

    if (!from.isValid() || !toExclusive.isValid() || from.isSameOrAfter(toExclusive)) {
        return null;
    }

    return {
        from: from.unix(),
        to: toExclusive.unix(),
    };
};

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
                ...(args.employeeIds && args.employeeIds.length > 0
                    ? { User: { id: { in: args.employeeIds } } }
                    : {}),
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

export async function handleGetAttendanceRecords(
    args: GetAttendanceRecordsArgs,
    context: AIRequestContext
) {
    const userId = Number(args.userId);
    const hostId = Number(context.hostId);

    if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(hostId) || hostId <= 0) {
        return {
            success: false,
            errorCode: "INVALID_EMPLOYEE",
            message: "The requested employee could not be validated.",
        };
    }

    const employee = await userService.findActiveEmployeeForAI(hostId, userId);
    if (!employee) {
        return {
            success: false,
            errorCode: "EMPLOYEE_NOT_FOUND",
            message: "The requested employee was not found in the authenticated organization.",
        };
    }

    const resolvedUserIds = context.lastEmployeeSearchUserIds;
    if (!resolvedUserIds?.has(String(userId))) {
        return {
            success: false,
            errorCode: "EMPLOYEE_NOT_RESOLVED",
            message: "The employee must be selected from search_employees results.",
        };
    }

    if (context.lastEmployeeSearchMatchCount !== 1) {
        return {
            success: false,
            errorCode: "AMBIGUOUS_EMPLOYEE",
            message: "Multiple employees matched. Please clarify which employee is requested.",
        };
    }

    const attendanceTime = getAttendanceTimeRange(
        args.fromDate,
        args.toDate,
        context.timezone,
    );

    if (!attendanceTime) {
        return {
            success: false,
            errorCode: "INVALID_DATE_RANGE",
            message: "The requested attendance date range is invalid.",
        };
    }

    const result = await reportService.getAttendanceReport(
        {
            hostId,
            filter: {
                from: args.fromDate,
                to: args.toDate,
                userId,
                attendanceTime,
            },
        },
        {
            hostId,
            requestUserId: undefined,
        }
    );

    return {
        success: true,
        employee: {
            userId: String(employee.id),
            name: employee.name ?? "",
            employeeCode: employee.employeeCode ?? null,
        },
        dateRange: {
            from: args.fromDate,
            to: args.toDate,
        },
        attendance: result.attendance.map((record: any) => ({
            attendanceDate: moment.tz(record.attendanceTime, context.timezone).format("YYYY-MM-DD"),
            attendanceTime: record.attendanceTime ?? null,
            attendanceStatus: record.attendanceStatus ?? null,
            dayoverTime: record.dayoverTime ?? null,
            workingHours: record.workingHours ?? null,
        })),
    };
}