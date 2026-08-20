import {
  AiInsightExecutionContext,
  AiInsightExecutionResult
} from "../types/ai-insights.types";

import { AiInsightHandler } from "./insight-handler.types";
import attendanceInsightRepository, { AttendanceInsightRepository } from '../repositories/attendance-insight.repository';

export class AttendanceInsightHandler
  implements AiInsightHandler {

  constructor(
    private readonly repository: AttendanceInsightRepository = attendanceInsightRepository
  ) {}

  async execute(params: {
    insightId: string;
    context: AiInsightExecutionContext;
  }): Promise<AiInsightExecutionResult> {

    switch (params.insightId) {

      case "attendance.earliest":
        return this.getEarliestAttendance(
          params.context
        );

      case "attendance.latest":
        return this.getLatestAttendance(
          params.context
        );

      case "attendance.absent":
        return this.getAbsentEmployees(
          params.context
        );

      case "attendance.present":
        return this.getPresentEmployees(
          params.context
        );

      case "attendance.average_working_hours":
        return this.getAverageWorkingHours(
          params.context
        );

      default:
        throw new Error(
          `Unsupported attendance insight: ${params.insightId}`
        );
    }
  }

  /**
   * Who marked attendance earliest?
   */
  private async getEarliestAttendance(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const employees = await this.repository.getEarliestAttendance({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
      limit: context.options.limit,
    });

    return {
      result: {
        type: "ranking",
        items: employees
      },

      answer: {
        text:
          employees.length > 0
            ? `${employees[0].employee?.name} marked attendance earliest.`
            : "No attendance data found for the selected period."
      }
    };
  }

  /**
   * Who marked attendance latest?
   */
  private async getLatestAttendance(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const employees = await this.repository.getLatestAttendance({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
      limit: context.options.limit,
    });

    return {
      result: {
        type: "ranking",
        items: employees
      },

      answer: {
        text:
          employees.length > 0
            ? `${employees[0].employee?.name} marked attendance latest.`
            : "No attendance data found."
      }
    };
  }

  /**
   * Who is absent?
   */
  private async getAbsentEmployees(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const employees = await this.repository.getAbsentEmployees({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
      limit: context.options.limit,
    });

    return {
      result: {
        type: "employee_list",
        items: employees
      },

      answer: {
        text:
          employees.length > 0
            ? `${employees.length} employees are absent.`
            : "No absent employees found."
      }
    };
  }

  /**
   * Who is present?
   */
  private async getPresentEmployees(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const employees = await this.repository.getPresentEmployees({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
      limit: context.options.limit,
    });

    return {
      result: {
        type: "employee_list",
        items: employees
      },

      answer: {
        text:
          employees.length > 0
            ? `${employees.length} employees are present.`
            : "No present employees found."
      }
    };
  }

  /**
   * Average working hours.
   */
  private async getAverageWorkingHours(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const averageHours = await this.repository.getAverageWorkingHours({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
    });

    return {
      result: {
        type: "metric",
        summary: {
          averageWorkingHours: averageHours
        }
      },

      answer: {
        text:
          `Average working hours are ${averageHours} hours.`
      }
    };
  }
}