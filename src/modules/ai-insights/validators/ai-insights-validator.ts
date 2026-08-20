import { z } from "zod";

/**
 * ---------------------------------------------------------
 * Date Filter
 * ---------------------------------------------------------
 */

const presetDateFilterSchema = z.object({
  type: z.literal("preset"),
  value: z.enum([
    "today",
    "yesterday",
    "this_week",
    "last_week",
    "this_month",
    "last_month"
  ])
});

const customDateFilterSchema = z.object({
  type: z.literal("custom"),
  startDate: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "startDate must be in YYYY-MM-DD format"
    ),
  endDate: z
    .string()
    .regex(
      /^\d{4}-\d{2}-\d{2}$/,
      "endDate must be in YYYY-MM-DD format"
    )
});

export const aiInsightDateFilterSchema = z
  .discriminatedUnion("type", [
    presetDateFilterSchema,
    customDateFilterSchema
  ])
  .superRefine((value, ctx) => {
    if (value.type !== "custom") {
      return;
    }

    if (value.startDate > value.endDate) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["startDate"],
        message:
          "startDate cannot be greater than endDate"
      });
    }
  });


/**
 * ---------------------------------------------------------
 * Entity Filters
 * ---------------------------------------------------------
 */

const entityFilterSchema = z.object({
  ids: z
    .array(
      z
        .number()
        .int()
        .positive()
    )
    .default([])
});


/**
 * ---------------------------------------------------------
 * Filters
 * ---------------------------------------------------------
 */

export const aiInsightFiltersSchema = z.object({
  date: aiInsightDateFilterSchema,
  teams: entityFilterSchema.optional(),
  employees: entityFilterSchema.optional(),
  customers: entityFilterSchema.optional()
});


/**
 * ---------------------------------------------------------
 * Options
 * ---------------------------------------------------------
 */

export const aiInsightOptionsSchema = z.object({
  limit: z
    .number()
    .int()
    .min(1)
    .max(50)
    .optional(),
  offset: z
    .number()
    .int()
    .min(0)
    .optional(),
  includeSummary: z
    .boolean()
    .optional(),
  includeComparison: z
    .boolean()
    .optional()
});


/**
 * ---------------------------------------------------------
 * Execute Insight Request
 * ---------------------------------------------------------
 */

export const executeAiInsightSchema = z.object({
  insightId: z
    .string()
    .trim()
    .min(1)
    .max(100),
  filters: aiInsightFiltersSchema,
  options: aiInsightOptionsSchema.optional()
});


/**
 * ---------------------------------------------------------
 * Route Params
 * ---------------------------------------------------------
 */

export const insightIdParamsSchema = z.object({
  insightId: z
    .string()
    .trim()
    .min(1)
    .max(100)
});