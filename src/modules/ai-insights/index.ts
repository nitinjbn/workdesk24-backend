import { AiInsightsController } from './controllers/ai-insights.controller';
import { AttendanceInsightHandler } from './handlers/attendance.handler';
import { DayoverInsightHandler } from './handlers/dayover.handler';
import { FeedbackInsightHandler } from './handlers/feedback.handler';
import { OrdersInsightHandler } from './handlers/orders.handler';
import { PaymentsInsightHandler } from './handlers/payments.handler';
import { PerformanceInsightHandler } from './handlers/performance.handler';
import { VisitsInsightHandler } from './handlers/visits.handler';
import { AiInsightsService } from './services/ai-insights.service';
import { InsightDateService } from './services/insight-date.service';
import { InsightExecutorService } from './services/insight-executor.service';
import { InsightFilterService } from './services/insight-filter.service';
import { InsightPermissionService } from './services/insight-permission.service';

const attendanceHandler = new AttendanceInsightHandler();
const visitsHandler = new VisitsInsightHandler();
const ordersHandler = new OrdersInsightHandler();
const paymentsHandler = new PaymentsInsightHandler();
const performanceHandler = new PerformanceInsightHandler();
const feedbackHandler = new FeedbackInsightHandler();
const dayoverHandler = new DayoverInsightHandler();

const insightExecutorService = new InsightExecutorService(
  attendanceHandler,
  visitsHandler,
  ordersHandler,
  paymentsHandler,
  performanceHandler,
  feedbackHandler,
  dayoverHandler
);

const insightDateService = new InsightDateService();
const insightFilterService = new InsightFilterService();
const insightPermissionService = new InsightPermissionService();

const aiInsightsService = new AiInsightsService(
  insightExecutorService,
  insightDateService,
  insightFilterService,
  insightPermissionService
);

export const aiInsightsController = new AiInsightsController(aiInsightsService);