import {
  AiInsightCategory,
  AiInsightQuestion,
  AiInsightQueryRequest,
  AiInsightQueryResponse
} from "../types/ai-insights.types";

import {
  AI_INSIGHTS_CONFIG
} from "../config/ai-insights.config";

import {
  InsightExecutorService
} from "../services/insight-executor.service";

import {
  InsightDateService
} from "../services/insight-date.service";

import {
  InsightFilterService
} from "../services/insight-filter.service";

import {
  InsightPermissionService
} from "../services/insight-permission.service";
import { createConfiguredError } from '../../../shared/utils/error.util';

interface BaseContext {
  hostId: number;
  userId: number;
}

export class AiInsightsService {

  constructor(
    private readonly insightExecutorService:
      InsightExecutorService,

    private readonly insightDateService:
      InsightDateService,

    private readonly insightFilterService:
      InsightFilterService,

    private readonly insightPermissionService:
      InsightPermissionService
  ) {}

  // =====================================================
  // GET CATEGORIES
  // =====================================================

  async getCategories(
    context: BaseContext
  ): Promise<AiInsightCategory[]> {

    await this.insightPermissionService
      .validateAccess(context);

    return AI_INSIGHTS_CONFIG.filter(
      (category) => category.enabled
    );
  }

  // =====================================================
  // GET QUESTION
  // =====================================================

  async getQuestion(params: {
    hostId: number;
    userId: number;
    insightId: string;
  }): Promise<AiInsightQuestion> {

    await this.insightPermissionService
      .validateAccess({
        hostId: params.hostId,
        userId: params.userId
      });

    const insight =
      this.findInsight(params.insightId);

    if (!insight) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        `AI insight not found: ${params.insightId}`,
        404,
        'NOT_FOUND'
      );
    }

    return insight.question;
  }

  // =====================================================
  // EXECUTE INSIGHT
  // =====================================================

  async executeInsight(params: {
    hostId: number;
    userId: number;
    request: AiInsightQueryRequest;
  }): Promise<AiInsightQueryResponse> {

    const {
      hostId,
      userId,
      request
    } = params;

    // ---------------------------------------------------
    // 1. Find configuration
    // ---------------------------------------------------

    const insight =
      this.findInsight(request.insightId);

    if (!insight) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        `AI insight not found: ${request.insightId}`,
        404,
        'NOT_FOUND'
      );
    }

    const {
      category,
      question
    } = insight;

    // ---------------------------------------------------
    // 2. Permission
    // ---------------------------------------------------

    await this.insightPermissionService
      .validateInsightAccess({
        hostId,
        userId,
        insightId: request.insightId
      });

    // ---------------------------------------------------
    // 3. Validate filters
    // ---------------------------------------------------

    await this.insightFilterService.validateFilters({
      hostId,
      question,
      filters: request.filters
    });

    // ---------------------------------------------------
    // 4. Get timezone
    // ---------------------------------------------------

    const timezone =
      await this.insightDateService
        .getHostTimezone(hostId);

    // ---------------------------------------------------
    // 5. Resolve date
    // ---------------------------------------------------

    const dateRange =
      this.insightDateService.resolveDateRange({
        filter: request.filters.date,
        timezone
      });

    // ---------------------------------------------------
    // 6. Build execution context
    // ---------------------------------------------------

    const context = {
      hostId,
      userId,
      timezone,
      dateRange,
      filters: request.filters,
      options: request.options ?? {}
    };

    // ---------------------------------------------------
    // 7. Execute
    // ---------------------------------------------------

    const executionResult =
      await this.insightExecutorService.execute({
        insightId: request.insightId,
        context
      });

    // ---------------------------------------------------
    // 8. Build standard response
    // ---------------------------------------------------

    return {
      insight: {
        id: question.id,
        category: category.id,
        question: question.question,
        title:
          question.shortQuestion ??
          question.question,
        resultType: question.resultType
      },

      filters: request.filters,

      resolvedDateRange: dateRange,

      result: executionResult.result,

      answer: executionResult.answer,

      actions: executionResult.actions
    };
  }

  // =====================================================
  // PRIVATE
  // =====================================================

  private findInsight(
    insightId: string
  ): {
    category: AiInsightCategory;
    question: AiInsightQuestion;
  } | undefined {

    for (
      const category
      of AI_INSIGHTS_CONFIG
    ) {

      const question =
        category.questions.find(
          (item) =>
            item.id === insightId
        );

      if (question) {
        return {
          category,
          question
        };
      }
    }

    return undefined;
  }
}