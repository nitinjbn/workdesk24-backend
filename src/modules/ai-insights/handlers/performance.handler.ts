import {
  AiInsightExecutionContext,
  AiInsightExecutionResult
} from "../types/ai-insights.types";

import { AiInsightHandler } from "./insight-handler.types";
import performanceInsightRepository, { PerformanceInsightRepository } from '../repositories/performance-insight.repository';
import { DEFAULT_PERFORMANCE_WEIGHTS } from '../constants/performance.constants';

export class PerformanceInsightHandler
  implements AiInsightHandler {

  constructor(
    private readonly repository: PerformanceInsightRepository = performanceInsightRepository
  ) {}

  async execute(params: {
    insightId: string;
    context: AiInsightExecutionContext;
  }): Promise<AiInsightExecutionResult> {

    switch (params.insightId) {

      case "performance.best":
        return this.getBestPerformers(
          params.context
        );

      case "performance.lowest":
        return this.getLowestPerformers(
          params.context
        );

      case "performance.most_improved":
        return this.getMostImproved(
          params.context
        );

      case "performance.top_visit":
        return this.getTopVisitPerformers(
          params.context
        );

      case "performance.top_order":
        return this.getTopOrderPerformers(
          params.context
        );

      case "performance.top_payment":
        return this.getTopPaymentPerformers(
          params.context
        );

      default:
        throw new Error(
          `Unsupported performance insight: ${params.insightId}`
        );
    }
  }

  /**
   * Overall best performer.
   */
  private async getBestPerformers(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const rankings = await this.repository.getBestPerformers({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
      limit: context.options.limit,
    });

    const winner = rankings[0];

    return {
      result: {
        type: "ranking",
        items: rankings
      },

      weightage: DEFAULT_PERFORMANCE_WEIGHTS,

      answer: {
        text: winner
          ? `${winner.employee?.name} is the best performer with a weighted score of ${winner.score ?? 0} in the selected period.`
          : "No performance data found for the selected period."
      }
    };
  }

  private async getLowestPerformers(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {
    const rankings = await this.repository.getLowestPerformers({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
      limit: context.options.limit,
    });

    const lowest = rankings[0];

    return {
      result: {
        type: "ranking",
        items: rankings,
      },
      weightage: DEFAULT_PERFORMANCE_WEIGHTS,
      answer: {
        text: lowest
          ? `${lowest.employee?.name} is the lowest performer with a weighted score of ${lowest.score ?? 0} in the selected period.`
          : "No performance data found for the selected period.",
      },
    };
  }

  /**
   * Employee who improved the most compared
   * with the previous equivalent period.
   */
  private async getMostImproved(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const rankings = await this.repository.getMostImproved({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
      limit: context.options.limit,
    });

    const winner = rankings[0];

    return {
      result: {
        type: "ranking",
        items: rankings
      },

      answer: {
        text: winner
          ? `${winner.employee?.name} improved the most in order value by ${winner.comparison?.changePercentage ?? 0}%.`
          : "No performance comparison data found."
      }
    };
  }

  private async getTopVisitPerformers(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const rankings = await this.repository.getTopVisitPerformers({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
      limit: context.options.limit,
    });

    return {
      result: {
        type: "ranking",
        items: rankings
      },

      answer: {
        text: rankings.length
          ? `${rankings[0].employee?.name} leads visit performance.`
          : 'No visit performance data found.'
      }
    };
  }

  private async getTopOrderPerformers(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const rankings = await this.repository.getTopOrderPerformers({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
      limit: context.options.limit,
    });

    return {
      result: {
        type: "ranking",
        items: rankings
      },

      answer: {
        text: rankings.length
          ? `${rankings[0].employee?.name} leads order performance.`
          : 'No order performance data found.'
      }
    };
  }

  private async getTopPaymentPerformers(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const rankings = await this.repository.getTopPaymentPerformers({
      hostId: context.hostId,
      startDateTime: context.dateRange.startDateTime,
      endDateTime: context.dateRange.endDateTime,
      employeeIds: context.filters.employees?.ids,
      limit: context.options.limit,
    });

    return {
      result: {
        type: "ranking",
        items: rankings
      },

      answer: {
        text: rankings.length
          ? `${rankings[0].employee?.name} leads payment performance.`
          : 'No payment performance data found.'
      }
    };
  }
}