// src/modules/ai-insights/types/ai-insights.types.ts

export interface AiInsightCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  displayOrder: number;
  enabled: boolean;
  questions: AiInsightQuestion[];
}

// ============================================================
// QUESTION
// ============================================================

export interface AiInsightQuestion {
  id: string;
  question: string;
  shortQuestion?: string;
  description?: string;
  icon?: string;

  /**
   * Defines how the frontend should render the result.
   */
  resultType: AiInsightResultType;

  /**
   * Filters supported by this question.
   */
  filters: AiInsightFilterDefinition[];

  /**
   * Additional execution/display options.
   */
  options?: AiInsightOptions;
}

// ============================================================
// RESULT TYPE
// ============================================================

export type AiInsightResultType =
  | "ranking"
  | "employee_list"
  | "summary"
  | "metric"
  | "comparison"
  | "trend"
  | "chart";

// ============================================================
// FILTER DEFINITION
// ============================================================

export interface AiInsightFilterDefinition {
  key: AiInsightFilterKey;
  type: AiInsightFilterType;

  required: boolean;

  defaultValue?: unknown;

  /**
   * Used by date filters.
   */
  presets?: AiInsightDatePreset[];

  /**
   * Used when filter options come from an API.
   */
  source?: AiInsightFilterSource;

  /**
   * Optional validation/configuration.
   */
  validation?: AiInsightFilterValidation;
}

// ============================================================
// FILTER KEY
// ============================================================

export type AiInsightFilterKey =
  | "date"
  | "teams"
  | "employees"
  | "customers";

// ============================================================
// FILTER TYPE
// ============================================================

export type AiInsightFilterType =
  | "date"
  | "select"
  | "multi_select";

// ============================================================
// DATE PRESETS
// ============================================================

export type AiInsightDatePreset =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "custom";

// ============================================================
// FILTER SOURCE
// ============================================================

export interface AiInsightFilterSource {
  type: "api";
  endpoint: string;
  valueKey?: string;
  labelKey?: string;
}

// ============================================================
// FILTER VALIDATION
// ============================================================

export interface AiInsightFilterValidation {
  min?: number;
  max?: number;
  maxRangeDays?: number;
}

// ============================================================
// INSIGHT OPTIONS
// ============================================================

export interface AiInsightOptions {
  limit?: {
    enabled: boolean;
    default: number;
    min: number;
    max: number;
  };

  comparison?: {
    enabled: boolean;
  };
}


// ============================================================
// QUERY REQUEST
// ============================================================

export interface AiInsightQueryRequest {
  insightId: string;

  filters: AiInsightQueryFilters;

  options?: AiInsightQueryOptions;
}

// ============================================================
// QUERY FILTERS
// ============================================================

export interface AiInsightQueryFilters {
  date?: AiInsightDateFilter;
  teams?: AiInsightEntityFilter;
  employees?: AiInsightEntityFilter;
  customers?: AiInsightEntityFilter;
}

// ============================================================
// DATE FILTER
// ============================================================

export type AiInsightDateFilter =
  | AiInsightPresetDateFilter
  | AiInsightCustomDateFilter;

export interface AiInsightPresetDateFilter {
  type: "preset";
  value: Exclude<AiInsightDatePreset, "custom">;
}

export interface AiInsightCustomDateFilter {
  type: "custom";
  startDate: string; // YYYY-MM-DD
  endDate: string;   // YYYY-MM-DD
}

// ============================================================
// ENTITY FILTER
// ============================================================

export interface AiInsightEntityFilter {
  ids: number[];
}

// ============================================================
// QUERY OPTIONS
// ============================================================

export interface AiInsightQueryOptions {
  limit?: number;
  offset?: number;
  includeSummary?: boolean;
  includeComparison?: boolean;
}

// ============================================================
// RESOLVED DATE RANGE
// ============================================================

export interface AiInsightResolvedDateRange {
  startDate: string;
  endDate: string;
  startDateTime: string;
  endDateTime: string;
  timezone: string;
}

// ============================================================
// EXECUTION CONTEXT
// ============================================================

export interface AiInsightExecutionContext {
  hostId: number;
  userId: number;

  timezone: string;

  dateRange: AiInsightResolvedDateRange;

  filters: AiInsightQueryFilters;

  options: AiInsightQueryOptions;
}

// ============================================================
// QUERY RESPONSE
// ============================================================

export interface AiInsightQueryResponse {
  insight: AiInsightResponseInfo;

  filters: AiInsightQueryFilters;

  resolvedDateRange: AiInsightResolvedDateRange;

  result: AiInsightResult;

  answer: AiInsightAnswer;

  actions?: AiInsightAction[];
}

// ============================================================
// RESPONSE INFO
// ============================================================

export interface AiInsightResponseInfo {
  id: string;
  category: string;
  question: string;
  title: string;
  resultType: AiInsightResultType;
}

// ============================================================
// RESULT
// ============================================================

export interface AiInsightResult {
  type: AiInsightResultType;

  summary?: Record<string, unknown>;

  items?: AiInsightResultItem[];

  pagination?: AiInsightPagination;
}

// ============================================================
// RESULT ITEM
// ============================================================

export interface AiInsightResultItem {
  rank?: number;

  employee?: {
    id: number;
    employeeCode?: string;
    name: string;
  };

  customer?: {
    id: number;
    name: string;
  };

  score?: number;

  metrics?: Record<string, number | string | null>;

  comparison?: {
    previousPeriodScore?: number;
    change?: number;
    changePercentage?: number;
  };

  [key: string]: unknown;
}

// ============================================================
// PAGINATION
// ============================================================

export interface AiInsightPagination {
  limit: number;
  offset: number;
  total: number;
  hasMore: boolean;
}

// ============================================================
// ANSWER
// ============================================================

export interface AiInsightAnswer {
  text: string;

  highlights?: string[];
}

// ============================================================
// ACTIONS
// ============================================================

export interface AiInsightAction {
  type: "navigate" | "filter" | "export";

  label: string;

  route?: string;

  params?: Record<string, string | number>;
}

// ============================================================
// EXECUTION RESULT
// ============================================================

export interface AiInsightExecutionResult {
  result: AiInsightResult;

  answer: AiInsightAnswer;

  actions?: AiInsightAction[];
}


export interface AiInsightHandler {
  execute(params: {
    insightId: string;
    context: AiInsightExecutionContext;
  }): Promise<AiInsightExecutionResult>;
}

export interface AiInsightEmployee {
  id: number;
  employeeCode?: string;
  name: string;
}

export interface RankingInsightResult {
  type: 'ranking';
  items: AiInsightResultItem[];
  summary?: Record<string, unknown>;
  pagination?: AiInsightPagination;
}

export interface MetricInsightResult {
  type: 'metric';
  summary: Record<string, unknown>;
  items?: AiInsightResultItem[];
  pagination?: AiInsightPagination;
}

export interface EmployeeListInsightResult {
  type: 'employee_list';
  items: AiInsightResultItem[];
  summary?: Record<string, unknown>;
  pagination?: AiInsightPagination;
}

export interface AiInsightBaseQueryParams {
  hostId: number;
  startDateTime: string;
  endDateTime: string;
  employeeIds?: number[];
  customerIds?: number[];
  limit?: number;
}