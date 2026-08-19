import  reportService from "../../../modules/reporting/services/report.service";
import { AIRequestContext } from "../types/AIRequestContext";

export interface GetAttendanceSummaryArgs {
    fromDate: string;
    toDate: string;
    employeeIds: string[] | null;
}

export async function handleGetAttendanceSummary(
    args: GetAttendanceSummaryArgs,
    context: AIRequestContext
) {
    const result = await reportService.getAttendanceReport({
        hostId: context.hostId,
        filter: {
            from: args.fromDate,
            to: args.toDate
        }
    },  {
        hostId: context.hostId as any,
        requestUserId: null as any,
    });

    return result;
}