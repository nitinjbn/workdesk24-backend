import {
  DEFAULT_PERFORMANCE_WEIGHTS,
  PerformanceWeights,
} from '../constants/performance.constants';

export interface PerformanceScoreInput {
  totalOrderValue: number;
  totalPaymentValue: number;
  totalVisits: number;
  presentDays: number;
  maxOrderValue: number;
  maxPaymentValue: number;
  maxPresentDays: number;
  maxVisits: number;
  weights?: PerformanceWeights;
}

export interface PerformanceScoreResult {
  orderScore: number;
  paymentScore: number;
  visitScore: number;
  attendanceScore: number;
  score: number;
}

const roundToTwo = (value: number): number => Number(value.toFixed(2));

const normalize = (value: number, maximum: number): number => {
  if (maximum <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (value / maximum) * 100));
};

export function calculatePerformanceScore({
  totalOrderValue,
  totalPaymentValue,
  totalVisits,
  presentDays,
  maxOrderValue,
  maxPaymentValue,
  maxPresentDays,
  maxVisits,
  weights = DEFAULT_PERFORMANCE_WEIGHTS,
}: PerformanceScoreInput): PerformanceScoreResult {
  const safePresentDays = Math.max(0, presentDays);
  const orderScore = normalize(Math.max(0, totalOrderValue), maxOrderValue);
  const paymentScore = normalize(Math.max(0, totalPaymentValue), maxPaymentValue);
  const visitScore = normalize(Math.max(0, totalVisits), maxVisits);
  const attendanceScore = normalize(safePresentDays, maxPresentDays);
  const score = Math.min(100, Math.max(0,
    orderScore * weights.orderValue
    + paymentScore * weights.paymentValue
    + visitScore * weights.visitProductivity
    + attendanceScore * weights.attendance
  ));

  return {
    orderScore: roundToTwo(orderScore),
    paymentScore: roundToTwo(paymentScore),
    visitScore: roundToTwo(visitScore),
    attendanceScore: roundToTwo(attendanceScore),
    score: roundToTwo(score),
  };
}