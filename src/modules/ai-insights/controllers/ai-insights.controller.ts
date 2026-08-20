import { Response, NextFunction } from "express";
import { AiInsightsService } from "../services/ai-insights.service";
import { AuthRequest } from '../../../shared/types/auth.types';
import { executeAiInsightSchema, insightIdParamsSchema } from '../validators/ai-insights-validator';
import { createConfiguredError } from '../../../shared/utils/error.util';

export class AiInsightsController {
  constructor(
    private readonly aiInsightsService: AiInsightsService
  ) {}

  /**
   * GET /api/v1/ai-insights/categories
   *
   * Returns all enabled AI Insight categories and questions.
   */
  getCategories = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw createConfiguredError('ACCESS_DENIED', 'Unauthorized', 401, 'ACCESS_DENIED');
      }

      const data = await this.aiInsightsService.getCategories({
        hostId: req.user.hostId,
        userId: req.user.id
      });

      res.status(200).json({
        success: true,
        message: 'AI insight categories fetched successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /api/v1/ai-insights/questions/:insightId
   *
   * Returns configuration for a specific insight/question,
   * including supported filters and options.
   */
  getQuestion = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw createConfiguredError('ACCESS_DENIED', 'Unauthorized', 401, 'ACCESS_DENIED');
      }

      const parsed = insightIdParamsSchema.safeParse(req.params);
      if (!parsed.success) {
        throw createConfiguredError(
          'VALIDATION_ERROR',
          parsed.error.issues[0]?.message || 'Invalid insightId',
          400,
          'VALIDATION_ERROR'
        );
      }

      const { insightId } = parsed.data;

      const data = await this.aiInsightsService.getQuestion({
        hostId: req.user.hostId,
        userId: req.user.id,
        insightId
      });

      res.status(200).json({
        success: true,
        message: 'AI insight question fetched successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /api/v1/ai-insights/query
   *
   * Executes a predefined insight using the filters
   * supplied by the admin.
   */
  executeInsight = async (
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      if (!req.user) {
        throw createConfiguredError('ACCESS_DENIED', 'Unauthorized', 401, 'ACCESS_DENIED');
      }

      const parsed = executeAiInsightSchema.safeParse(req.body);
      if (!parsed.success) {
        throw createConfiguredError(
          'VALIDATION_ERROR',
          parsed.error.issues[0]?.message || 'Invalid request payload',
          400,
          'VALIDATION_ERROR'
        );
      }

      const data = await this.aiInsightsService.executeInsight({
        hostId: req.user.hostId,
        userId: req.user.id,
        request: parsed.data
      });

      res.status(200).json({
        success: true,
        message: 'AI insight executed successfully',
        data
      });
    } catch (error) {
      next(error);
    }
  };
}