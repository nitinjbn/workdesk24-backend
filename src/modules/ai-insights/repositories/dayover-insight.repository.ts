import { Op, WhereOptions } from 'sequelize';
import db from '../../../models';
import { AiInsightBaseQueryParams, AiInsightResultItem } from '../types/ai-insights.types';

interface DayoverInsightParams extends AiInsightBaseQueryParams {}

export class DayoverInsightRepository {
	private buildWhere(params: DayoverInsightParams): WhereOptions {
		const startUnix = Math.floor(new Date(params.startDateTime).getTime() / 1000);
		const endUnix = Math.floor(new Date(params.endDateTime).getTime() / 1000);

		const where: WhereOptions = {
			hostId: params.hostId,
			isDeleted: 0,
			attendanceTime: {
				[Op.gte]: startUnix,
				[Op.lte]: endUnix,
			},
		};

		if (params.employeeIds?.length) {
			where.userId = { [Op.in]: params.employeeIds };
		}

		return where;
	}

	async getCompletedDayoversCount(params: DayoverInsightParams): Promise<number> {
		const where = this.buildWhere(params) as any;
		where.dayoverTime = {
			[Op.not]: null,
		};

		return db.Attendance.count({ where });
	}

	async getPendingDayoverEmployees(params: DayoverInsightParams): Promise<AiInsightResultItem[]> {
		const where = this.buildWhere(params) as any;
		where.dayoverTime = null;

		const limit = params.limit ?? 20;

		const rows = await db.Attendance.findAll({
			attributes: [
				'userId',
				[db.Sequelize.fn('MIN', db.Sequelize.col('attendanceTime')), 'attendanceTime'],
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
			order: [[db.Sequelize.literal('attendanceTime'), 'ASC']],
			limit,
			raw: true,
		});

		return rows.map((row: any) => ({
			employee: {
				id: Number(row.userId),
				employeeCode: row.employeeCode || undefined,
				name: row.employeeName || 'Unknown',
			},
			metrics: {
				attendanceTime: Number(row.attendanceTime || 0),
			},
		}));
	}

	async getDayoverCompletionRate(params: DayoverInsightParams): Promise<number> {
		const totalWhere = this.buildWhere(params);
		const completedWhere = this.buildWhere(params) as any;
		completedWhere.dayoverTime = {
			[Op.not]: null,
		};

		const [total, completed] = await Promise.all([
			db.Attendance.count({ where: totalWhere }),
			db.Attendance.count({ where: completedWhere }),
		]);

		if (!total) {
			return 0;
		}

		return Number(((completed / total) * 100).toFixed(2));
	}
}

export default new DayoverInsightRepository();
