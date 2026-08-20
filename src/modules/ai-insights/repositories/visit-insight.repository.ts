import { Op, WhereOptions } from 'sequelize';
import db from '../../../models';
import { AiInsightBaseQueryParams, AiInsightResultItem } from '../types/ai-insights.types';

interface VisitInsightParams extends AiInsightBaseQueryParams {}

export class VisitInsightRepository {
	private buildWhere(params: VisitInsightParams): WhereOptions {
		const startUnix = Math.floor(new Date(params.startDateTime).getTime() / 1000);
		const endUnix = Math.floor(new Date(params.endDateTime).getTime() / 1000);

		const where: WhereOptions = {
			hostId: params.hostId,
			isDeleted: 0,
			checkInTime: {
				[Op.gte]: startUnix,
				[Op.lte]: endUnix,
			},
		};

		if (params.employeeIds?.length) {
			where.userId = { [Op.in]: params.employeeIds };
		}

		if (params.customerIds?.length) {
			where.customerId = { [Op.in]: params.customerIds };
		}

		return where;
	}

	async getTopEmployeesByVisits(params: VisitInsightParams): Promise<AiInsightResultItem[]> {
		const where = this.buildWhere(params);
		const limit = params.limit ?? 5;

		const rows = await db.Visit.findAll({
			attributes: [
				'userId',
				[db.Sequelize.fn('COUNT', db.Sequelize.col('Visit.id')), 'visitCount'],
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
			],
			group: ['userId', 'user.id', 'user.name', 'user.employeeCode'],
			order: [[db.Sequelize.literal('visitCount'), 'DESC']],
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
			score: Number(row.visitCount),
			metrics: {
				totalVisits: Number(row.visitCount),
			},
		}));
	}

	async getCompletedVisitsCount(params: VisitInsightParams): Promise<number> {
		const where = this.buildWhere(params) as any;
		where.checkOutTime = {
			[Op.not]: null,
		};

		return db.Visit.count({ where });
	}

	async getCancelledVisitsCount(_params: VisitInsightParams): Promise<number> {
		// Visit schema does not define status/cancel semantics. Keep deterministic and explicit.
		return 0;
	}

	async getAverageVisitsPerEmployee(params: VisitInsightParams): Promise<number> {
		const where = this.buildWhere(params);

		const rows = await db.Visit.findAll({
			attributes: [
				'userId',
				[db.Sequelize.fn('COUNT', db.Sequelize.col('Visit.id')), 'visitCount'],
			],
			where,
			group: ['userId'],
			raw: true,
		});

		if (!rows.length) {
			return 0;
		}

		const totalVisits = rows.reduce((sum: number, row: any) => sum + Number(row.visitCount || 0), 0);
		const average = totalVisits / rows.length;
		return Number(average.toFixed(2));
	}
}

export default new VisitInsightRepository();
