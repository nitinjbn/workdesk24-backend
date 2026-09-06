import { QueryTypes } from 'sequelize';
import db from '../../../models';
import { ActivityTrendSummaryRow } from '../types/report.types';

export class ActivityTrendReportRepository {
  async getActivityTrendReport(params: {
    hostId: number;
    fromDateUnix: number;
    tillDateUnix: number;
  }): Promise<ActivityTrendSummaryRow[]> {
    const { hostId, fromDateUnix, tillDateUnix } = params;

    const rows = (await db.sequelize.query(
      `SELECT reportDate,
        COUNT(DISTINCT CASE WHEN attendanceStatus = 'Present' THEN userId END) AS attendance,
        COALESCE(SUM(totalVisits), 0) AS visits,
        COALESCE(SUM(totalOrders), 0) AS orders,
        COALESCE(SUM(totalPayments), 0) AS payments
      FROM wd_user_daily_summary
      WHERE hostId = :hostId
        AND isDeleted = 0
        AND reportDate BETWEEN :fromDateUnix AND :tillDateUnix
      GROUP BY reportDate
      ORDER BY reportDate ASC`,
      {
        replacements: { hostId, fromDateUnix, tillDateUnix },
        type: QueryTypes.SELECT,
      }
    )) as ActivityTrendSummaryRow[];

    return rows;
  }
}

export default new ActivityTrendReportRepository();
