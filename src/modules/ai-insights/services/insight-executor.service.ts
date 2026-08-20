// src/modules/ai-insights/services/insight-executor.service.ts

import {
  AiInsightExecutionContext,
  AiInsightExecutionResult
} from "../types/ai-insights.types";

import { AttendanceInsightHandler } from "../handlers/attendance.handler";
import { VisitsInsightHandler } from "../handlers/visits.handler";
import { OrdersInsightHandler } from "../handlers/orders.handler";
import { PaymentsInsightHandler } from "../handlers/payments.handler";
import { PerformanceInsightHandler } from "../handlers/performance.handler";
import { FeedbackInsightHandler } from "../handlers/feedback.handler";
import { DayoverInsightHandler } from "../handlers/dayover.handler";
import { createConfiguredError } from '../../../shared/utils/error.util';

export class InsightExecutorService {

  constructor(
    private readonly attendanceHandler:
      AttendanceInsightHandler,

    private readonly visitsHandler:
      VisitsInsightHandler,

    private readonly ordersHandler:
      OrdersInsightHandler,

    private readonly paymentsHandler:
      PaymentsInsightHandler,

    private readonly performanceHandler:
      PerformanceInsightHandler,

    private readonly feedbackHandler:
      FeedbackInsightHandler,

    private readonly dayoverHandler:
      DayoverInsightHandler
  ) {}

  async execute(params: {
    insightId: string;
    context: AiInsightExecutionContext;
  }): Promise<AiInsightExecutionResult> {

    const {
      insightId,
      context
    } = params;

    const category =
      insightId.split(".")[0];

    switch (category) {

      case "attendance":
        return this.attendanceHandler.execute({
          insightId,
          context
        });

      case "visits":
        return this.visitsHandler.execute({
          insightId,
          context
        });

      case "orders":
        return this.ordersHandler.execute({
          insightId,
          context
        });

      case "payments":
        return this.paymentsHandler.execute({
          insightId,
          context
        });

      case "performance":
        return this.performanceHandler.execute({
          insightId,
          context
        });

      case "feedback":
        return this.feedbackHandler.execute({
          insightId,
          context
        });

      case "dayover":
        return this.dayoverHandler.execute({
          insightId,
          context
        });

      default:
        throw createConfiguredError(
          'VALIDATION_ERROR',
          `Unsupported insight category: ${category}`,
          400,
          'VALIDATION_ERROR'
        );
    }
  }
}