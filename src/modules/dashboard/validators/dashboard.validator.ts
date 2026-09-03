import { z } from 'zod';

const entityFilterSchema = z.object({
  ids: z.array(z.number().int().positive()).default([]),
});

const presetDateFilterSchema = z.object({
  type: z.literal('preset'),
  value: z.enum(['today', 'yesterday', 'this_week', 'last_week', 'this_month', 'last_month']),
});

const customDateFilterSchema = z.object({
  type: z.literal('custom'),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'startDate must be in YYYY-MM-DD format'),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'endDate must be in YYYY-MM-DD format'),
}).superRefine((value, ctx) => {
  if (value.startDate > value.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['startDate'],
      message: 'startDate cannot be greater than endDate',
    });
  }
});

const dateFilterSchema = z.discriminatedUnion('type', [presetDateFilterSchema, customDateFilterSchema]);

export const dashboardOverviewSchema = z.object({
  filter: z.object({
    date: dateFilterSchema.optional(),
    createdAt: z.object({
      from: z.number().int().positive().optional(),
      to: z.number().int().positive().optional(),
    }).optional(),
    employees: entityFilterSchema.optional(),
    users: entityFilterSchema.optional(),
    teams: entityFilterSchema.optional(),
    employeeIds: z.array(z.number().int().positive()).optional(),
    userIds: z.array(z.number().int().positive()).optional(),
    teamIds: z.array(z.number().int().positive()).optional(),
    userId: z.number().int().positive().optional(),
  }).optional(),
  options: z.object({
    trendGranularity: z.enum(['day', 'month']).optional(),
    topPerformersLimit: z.number().int().min(1).max(50).optional(),
    activityLimit: z.number().int().min(1).max(50).optional(),
    includeActivity: z.boolean().optional(),
  }).optional(),
});