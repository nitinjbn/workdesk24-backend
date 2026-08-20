import {
  AiInsightExecutionContext,
  AiInsightExecutionResult
} from "../types/ai-insights.types";

import { AiInsightHandler } from "./insight-handler.types";
import dayoverInsightRepository, { DayoverInsightRepository } from '../repositories/dayover-insight.repository';

export class DayoverInsightHandler
  implements AiInsightHandler {

  constructor(
    private readonly repository: DayoverInsightRepository = dayoverInsightRepository
  ) {}

  async execute(params: {
    insightId: string;
    context: AiInsightExecutionContext;
  }): Promise<AiInsightExecutionResult> {

    switch (params.insightId) {

      case "dayover.completed":
        return this.getCompletedDayovers(
          params.context
        );

      case "dayover.pending":
        return this.getPendingDayovers(
          params.context
        );

      case "dayover.completion_rate":
        return this.getCompletionRate(
          params.context
        );

      default:
        throw new Error(
          `Unsupported dayover insight: ${params.insightId}`
        );
    }
  }

  private async getCompletedDayovers(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const total = await this.repository.getCompletedDayoversCount({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
    });

    return {
      result: {
        type: "metric",
        summary: {
          completedDayovers: total
        }
      },

      answer: {
        text:
          `${total} employees completed dayover.`
      }
    };
  }

  private async getPendingDayovers(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const employees = await this.repository.getPendingDayoverEmployees({
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
          employees.length
            ? `${employees.length} employees have pending dayover.`
            : "No pending dayovers."
      }
    };
  }

  private async getCompletionRate(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const completionRate = await this.repository.getDayoverCompletionRate({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
    });

    return {
      result: {
        type: "metric",
        summary: {
          completionRate
        }
      },

      answer: {
        text:
          `Dayover completion rate is ${completionRate}%.`
      }
    };
  }
}