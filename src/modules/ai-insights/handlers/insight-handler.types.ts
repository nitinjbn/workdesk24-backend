import {
  AiInsightExecutionContext,
  AiInsightExecutionResult
} from "../types/ai-insights.types";

export interface AiInsightHandler {
  execute(params: {
    insightId: string;
    context: AiInsightExecutionContext;
  }): Promise<AiInsightExecutionResult>;
}