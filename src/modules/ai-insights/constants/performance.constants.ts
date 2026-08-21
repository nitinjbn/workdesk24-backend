/**
 * Default performance weights. These will be replaced by client-specific
 * weights loaded from the database when that configuration is available.
 */
export interface PerformanceWeights {
  orderValue: number;
  paymentValue: number;
  visitProductivity: number;
  attendance: number;
}

export const DEFAULT_PERFORMANCE_WEIGHTS = {
  orderValue: 0.40,
  paymentValue: 0.25,
  visitProductivity: 0.20,
  attendance: 0.15,
} as const satisfies PerformanceWeights;