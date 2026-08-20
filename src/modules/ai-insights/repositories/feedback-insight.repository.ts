import { Op, WhereOptions } from 'sequelize';
import db from '../../../models';
import { AiInsightBaseQueryParams, AiInsightResultItem } from '../types/ai-insights.types';

interface FeedbackInsightParams extends AiInsightBaseQueryParams {}

export class FeedbackInsightRepository {
	private buildWhere(params: FeedbackInsightParams): WhereOptions {
		const startUnix = Math.floor(new Date(params.startDateTime).getTime() / 1000);
		const endUnix = Math.floor(new Date(params.endDateTime).getTime() / 1000);

		const where: WhereOptions = {
			hostId: params.hostId,
			isDeleted: 0,
			feedbackTime: {
				[Op.gte]: startUnix,
				[Op.lte]: endUnix,
			},
		};

		if (params.employeeIds?.length) {
			where.userId = { [Op.in]: params.employeeIds };
		}

		return where;
	}

	async getTotalFeedback(params: FeedbackInsightParams): Promise<number> {
		const where = this.buildWhere(params);

		return db.Feedback.count({
			where,
			include: params.customerIds?.length
				? [
						{
							model: db.Visit,
							as: 'visit',
							attributes: [],
							required: true,
							where: {
								hostId: params.hostId,
								isDeleted: 0,
								customerId: {
									[Op.in]: params.customerIds,
								},
							},
						},
					]
				: undefined,
		});
	}

	async getTopEmployeesByFeedbackCount(params: FeedbackInsightParams): Promise<AiInsightResultItem[]> {
		const where = this.buildWhere(params);
		const limit = params.limit ?? 5;

		const rows = await db.Feedback.findAll({
			attributes: [
				'userId',
				[db.Sequelize.fn('COUNT', db.Sequelize.col('Feedback.id')), 'feedbackCount'],
				[db.Sequelize.col('user.name'), 'employeeName'],
				[db.Sequelize.col('user.employeeCode'), 'employeeCode'],
			],
			where,
			include: [
				{
					model: db.User,
					as: 'user',
					attributes: [],
					required: true,
					where: {
						hostId: params.hostId,
						isDeleted: 0,
					},
				},
				...(params.customerIds?.length
					? [
							{
								model: db.Visit,
								as: 'visit',
								attributes: [],
								required: true,
								where: {
									hostId: params.hostId,
									isDeleted: 0,
									customerId: {
										[Op.in]: params.customerIds,
									},
								},
							},
						]
					: []),
			],
			group: ['userId', 'user.id', 'user.name', 'user.employeeCode'],
			order: [[db.Sequelize.literal('feedbackCount'), 'DESC']],
			limit,
			raw: true,
		});

		return rows.map((row: any, index: number) => ({
			rank: index + 1,
			employee: {
				id: Number(row.userId),
				employeeCode: row.employeeCode || undefined,
				name: row.employeeName || 'Unknown',
			},
			score: Number(row.feedbackCount || 0),
			metrics: {
				totalFeedback: Number(row.feedbackCount || 0),
			},
		}));
	}

	async getAverageRating(_params: FeedbackInsightParams): Promise<number | null> {
		// Current wd_feedbacks schema does not expose a numeric rating column.
		return null;
	}
}

export default new FeedbackInsightRepository();
