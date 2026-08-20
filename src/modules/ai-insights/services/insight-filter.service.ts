import {
  AiInsightQuestion,
  AiInsightQueryFilters
} from "../types/ai-insights.types";
import db from '../../../models';
import { Op } from 'sequelize';
import { createConfiguredError } from '../../../shared/utils/error.util';

export class InsightFilterService {

  async validateFilters(params: {
    hostId: number;
    question: AiInsightQuestion;
    filters: AiInsightQueryFilters;
  }): Promise<void> {

    const {
      hostId,
      question,
      filters
    } = params;

    // --------------------------------------------------
    // Check required filters
    // --------------------------------------------------

    for (const filter of question.filters) {

      const value =
        filters[
          filter.key as keyof AiInsightQueryFilters
        ];

      if (
        filter.required &&
        (value === undefined || value === null)
      ) {
        throw new Error(
          `Filter '${filter.key}' is required`
        );
      }
    }

    // --------------------------------------------------
    // Date validation
    // --------------------------------------------------

    if (filters.date) {
      this.validateDateFilter(
        filters.date
      );
    }

    // --------------------------------------------------
    // Entity filters
    // --------------------------------------------------

    if (filters.teams) {
      this.validateIds(
        filters.teams.ids,
        "teams"
      );
    }

    if (filters.employees) {
      this.validateIds(
        filters.employees.ids,
        "employees"
      );
    }

    if (filters.customers) {
      this.validateIds(
        filters.customers.ids,
        "customers"
      );
    }

    // --------------------------------------------------
    // Unsupported filters
    // --------------------------------------------------

    const supportedFilters =
      new Set(
        question.filters.map(
          (filter) => filter.key
        )
      );

    for (const key of Object.keys(filters)) {

      if (
        !supportedFilters.has(key as any)
      ) {
        throw createConfiguredError(
          'VALIDATION_ERROR',
          `Filter '${key}' is not supported for insight '${question.id}'`
          ,
          400,
          'VALIDATION_ERROR'
        );
      }
    }

    if (filters.employees?.ids?.length) {
      await this.validateEmployeeScope(hostId, filters.employees.ids);
    }

    if (filters.customers?.ids?.length) {
      await this.validateCustomerScope(hostId, filters.customers.ids);
    }

    if (filters.teams?.ids?.length) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'Team filter is not supported in current data model',
        400,
        'VALIDATION_ERROR'
      );
    }
  }

  private validateDateFilter(
    date: NonNullable<
      AiInsightQueryFilters["date"]
    >
  ): void {

    if (date.type === "preset") {
      return;
    }

    if (date.type === "custom") {

      if (!date.startDate) {
        throw createConfiguredError(
          'VALIDATION_ERROR',
          'startDate is required',
          400,
          'VALIDATION_ERROR'
        );
      }

      if (!date.endDate) {
        throw createConfiguredError(
          'VALIDATION_ERROR',
          'endDate is required',
          400,
          'VALIDATION_ERROR'
        );
      }

      if (date.startDate > date.endDate) {
        throw createConfiguredError(
          'VALIDATION_ERROR',
          'startDate cannot be greater than endDate',
          400,
          'VALIDATION_ERROR'
        );
      }
    }
  }

  private validateIds(
    ids: number[],
    field: string
  ): void {

    if (!Array.isArray(ids)) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        `${field}.ids must be an array`,
        400,
        'VALIDATION_ERROR'
      );
    }

    for (const id of ids) {

      if (
        !Number.isInteger(id) ||
        id <= 0
      ) {
        throw createConfiguredError(
          'VALIDATION_ERROR',
          `Invalid ${field} id: ${id}`,
          400,
          'VALIDATION_ERROR'
        );
      }
    }
  }

  private async validateEmployeeScope(
    hostId: number,
    employeeIds: number[]
  ): Promise<void> {

    const uniqueIds = [...new Set(employeeIds)];

    const count = await db.User.count({
      where: {
        id: {
          [Op.in]: uniqueIds
        },
        hostId,
        isDeleted: 0
      }
    });

    if (count !== uniqueIds.length) {
      throw createConfiguredError(
        'ACCESS_DENIED',
        'One or more employee filters are outside your host scope',
        403,
        'ACCESS_DENIED'
      );
    }
  }

  private async validateCustomerScope(
    hostId: number,
    customerIds: number[]
  ): Promise<void> {

    const uniqueIds = [...new Set(customerIds)];

    const count = await db.Customer.count({
      where: {
        id: {
          [Op.in]: uniqueIds
        },
        hostId,
        isDeleted: 0
      }
    });

    if (count !== uniqueIds.length) {
      throw createConfiguredError(
        'ACCESS_DENIED',
        'One or more customer filters are outside your host scope',
        403,
        'ACCESS_DENIED'
      );
    }
  }
}