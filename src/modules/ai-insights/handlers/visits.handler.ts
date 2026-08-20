import {
  AiInsightExecutionContext,
  AiInsightExecutionResult
} from "../types/ai-insights.types";

import { AiInsightHandler } from "./insight-handler.types";
import visitInsightRepository, { VisitInsightRepository } from '../repositories/visit-insight.repository';

export class VisitsInsightHandler
  implements AiInsightHandler {

  constructor(
    private readonly repository: VisitInsightRepository = visitInsightRepository
  ) {}

  async execute(params: {
    insightId: string;
    context: AiInsightExecutionContext;
  }): Promise<AiInsightExecutionResult> {

    switch (params.insightId) {

      case "visits.top_employee":
        return this.getTopVisitEmployee(
          params.context
        );

      case "visits.most_visits":
        return this.getEmployeesWithMostVisits(
          params.context
        );

      case "visits.completed":
        return this.getCompletedVisits(
          params.context
        );

      case "visits.cancelled":
        return this.getCancelledVisits(
          params.context
        );

      case "visits.average":
        return this.getAverageVisits(
          params.context
        );

      default:
        throw new Error(
          `Unsupported visits insight: ${params.insightId}`
        );
    }
  }

  private async getTopVisitEmployee(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const employees = await this.repository.getTopEmployeesByVisits({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
      customerIds: context.filters.customers?.ids,
      limit: context.options.limit,
    });

    return {
      result: {
        type: "ranking",
        items: employees
      },

      answer: {
        text:
          employees.length
            ? `${employees[0].employee?.name} made the most visits.`
            : "No visit data found."
      }
    };
  }

  private async getEmployeesWithMostVisits(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const employees = await this.repository.getTopEmployeesByVisits({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
      customerIds: context.filters.customers?.ids,
      limit: context.options.limit,
    });

    return {
      result: {
        type: "ranking",
        items: employees
      },

      answer: {
        text:
          employees.length
            ? `Top ${employees.length} employees by visits.`
            : "No visit data found."
      }
    };
  }

  private async getCompletedVisits(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const total = await this.repository.getCompletedVisitsCount({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
      customerIds: context.filters.customers?.ids,
    });

    return {
      result: {
        type: "metric",
        summary: {
          completedVisits: total
        }
      },

      answer: {
        text:
          `${total} visits were completed.`
      }
    };
  }

  private async getCancelledVisits(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const total = await this.repository.getCancelledVisitsCount({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
      customerIds: context.filters.customers?.ids,
    });

    return {
      result: {
        type: "metric",
        summary: {
          cancelledVisits: total
        }
      },

      answer: {
        text:
          `${total} visits were cancelled.`
      }
    };
  }

  private async getAverageVisits(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const average = await this.repository.getAverageVisitsPerEmployee({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
      customerIds: context.filters.customers?.ids,
    });

    return {
      result: {
        type: "metric",
        summary: {
          averageVisits: average
        }
      },

      answer: {
        text:
          `Average visits per employee are ${average}.`
      }
    };
  }
}