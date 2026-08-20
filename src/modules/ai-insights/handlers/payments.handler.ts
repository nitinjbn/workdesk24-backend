import {
  AiInsightExecutionContext,
  AiInsightExecutionResult
} from "../types/ai-insights.types";

import { AiInsightHandler } from "./insight-handler.types";
import paymentInsightRepository, { PaymentInsightRepository } from '../repositories/payment-insight.repository';

export class PaymentsInsightHandler
  implements AiInsightHandler {

  constructor(
    private readonly repository: PaymentInsightRepository = paymentInsightRepository
  ) {}

  async execute(params: {
    insightId: string;
    context: AiInsightExecutionContext;
  }): Promise<AiInsightExecutionResult> {

    switch (params.insightId) {

      case "payments.top_employee":
        return this.getTopPaymentEmployee(
          params.context
        );

      case "payments.total":
        return this.getTotalPayments(
          params.context
        );

      case "payments.total_value":
        return this.getTotalPaymentValue(
          params.context
        );

      default:
        throw new Error(
          `Unsupported payments insight: ${params.insightId}`
        );
    }
  }

  private async getTopPaymentEmployee(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const employees = await this.repository.getTopEmployeesByPaymentAmount({
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
            ? `${employees[0].employee?.name} collected the highest payment amount.`
            : "No payment data found."
      }
    };
  }

  private async getTotalPayments(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const total = await this.repository.getTotalPayments({
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
          totalPayments: total
        }
      },

      answer: {
        text:
          `${total} payments were recorded.`
      }
    };
  }

  private async getTotalPaymentValue(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const value = await this.repository.getTotalPaymentValue({
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
          totalPaymentValue: value
        }
      },

      answer: {
        text:
          `Total payment collected is ₹${value}.`
      }
    };
  }
}