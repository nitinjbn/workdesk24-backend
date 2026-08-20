import {
  AiInsightExecutionContext,
  AiInsightExecutionResult
} from "../types/ai-insights.types";

import { AiInsightHandler } from "./insight-handler.types";
import feedbackInsightRepository, { FeedbackInsightRepository } from '../repositories/feedback-insight.repository';

export class FeedbackInsightHandler
  implements AiInsightHandler {

  constructor(
    private readonly repository: FeedbackInsightRepository = feedbackInsightRepository
  ) {}

  async execute(params: {
    insightId: string;
    context: AiInsightExecutionContext;
  }): Promise<AiInsightExecutionResult> {

    switch (params.insightId) {

      case "feedback.total":
        return this.getTotalFeedback(
          params.context
        );

      case "feedback.top_employee":
        return this.getTopFeedbackEmployee(
          params.context
        );

      case "feedback.average_rating":
        return this.getAverageRating(
          params.context
        );

      default:
        throw new Error(
          `Unsupported feedback insight: ${params.insightId}`
        );
    }
  }

  private async getTotalFeedback(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const total = await this.repository.getTotalFeedback({
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
          totalFeedback: total
        }
      },

      answer: {
        text:
          `${total} feedback records were received.`
      }
    };
  }

  private async getTopFeedbackEmployee(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const employees = await this.repository.getTopEmployeesByFeedbackCount({
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
            ? `${employees[0].employee?.name} received the highest feedback score.`
            : "No feedback data found."
      }
    };
  }

  private async getAverageRating(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const rating = await this.repository.getAverageRating({
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
          averageRating: rating,
          ratingAvailable: rating !== null
        }
      },

      answer: {
        text: rating === null
          ? 'Average feedback rating is not available in current schema.'
          : `Average feedback rating is ${rating}.`
      }
    };
  }
}