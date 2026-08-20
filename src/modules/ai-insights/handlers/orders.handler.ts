import {
  AiInsightExecutionContext,
  AiInsightExecutionResult
} from "../types/ai-insights.types";

import { AiInsightHandler } from "./insight-handler.types";
import orderInsightRepository, { OrderInsightRepository } from '../repositories/order-insight.repository';

export class OrdersInsightHandler
  implements AiInsightHandler {

  constructor(
    private readonly repository: OrderInsightRepository = orderInsightRepository
  ) {}

  async execute(params: {
    insightId: string;
    context: AiInsightExecutionContext;
  }): Promise<AiInsightExecutionResult> {

    switch (params.insightId) {

      case "orders.top_employee":
        return this.getTopOrderEmployee(
          params.context
        );

      case "orders.highest_value":
        return this.getHighestOrderValue(
          params.context
        );

      case "orders.total":
        return this.getTotalOrders(
          params.context
        );

      case "orders.total_value":
        return this.getTotalOrderValue(
          params.context
        );

      default:
        throw new Error(
          `Unsupported orders insight: ${params.insightId}`
        );
    }
  }

  private async getTopOrderEmployee(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const employees = await this.repository.getTopEmployeesByOrderValue({
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
            ? `${employees[0].employee?.name} generated the highest order value.`
            : "No order data found."
      }
    };
  }

  private async getHighestOrderValue(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const value = await this.repository.getHighestOrderValue({
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
          highestOrderValue: value
        }
      },

      answer: {
        text:
          `The highest order value is ₹${value}.`
      }
    };
  }

  private async getTotalOrders(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const total = await this.repository.getTotalOrders({
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
          totalOrders: total
        }
      },

      answer: {
        text:
          `${total} orders were created.`
      }
    };
  }

  private async getTotalOrderValue(
    context: AiInsightExecutionContext
  ): Promise<AiInsightExecutionResult> {

    const value = await this.repository.getTotalOrderValue({
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
          totalOrderValue: value
        }
      },

      answer: {
        text:
          `Total order value is ₹${value}.`
      }
    };
  }
}