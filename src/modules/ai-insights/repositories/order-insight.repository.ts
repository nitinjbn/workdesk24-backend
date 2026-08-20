import { Op, WhereOptions } from 'sequelize';
import db from '../../../models';
import { AiInsightBaseQueryParams, AiInsightResultItem } from '../types/ai-insights.types';

interface OrderInsightParams extends AiInsightBaseQueryParams {}

export class OrderInsightRepository {
	private buildWhere(params: OrderInsightParams): WhereOptions {
		const startUnix = Math.floor(new Date(params.startDateTime).getTime() / 1000);
		const endUnix = Math.floor(new Date(params.endDateTime).getTime() / 1000);

		const where: WhereOptions = {
			hostId: params.hostId,
			isDeleted: 0,
			orderTime: {
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

	async getTopEmployeesByOrderValue(params: OrderInsightParams): Promise<AiInsightResultItem[]> {
		const where = this.buildWhere(params);
		const limit = params.limit ?? 5;

		const rows = await db.Order.findAll({
			attributes: [
				'userId',
				[db.Sequelize.fn('SUM', db.Sequelize.col('totalAmount')), 'totalOrderValue'],
				[db.Sequelize.fn('COUNT', db.Sequelize.col('Order.id')), 'totalOrders'],
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
			order: [[db.Sequelize.literal('totalOrderValue'), 'DESC']],
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
			score: Number(row.totalOrderValue || 0),
			metrics: {
				totalOrderValue: Number(row.totalOrderValue || 0),
				totalOrders: Number(row.totalOrders || 0),
			},
		}));
	}

	async getHighestOrderValue(params: OrderInsightParams): Promise<number> {
		const where = this.buildWhere(params);
		const row = await db.Order.findOne({
			attributes: [[db.Sequelize.fn('MAX', db.Sequelize.col('totalAmount')), 'highestOrderValue']],
			where,
			raw: true,
		});

		return Number((row as any)?.highestOrderValue || 0);
	}

	async getTotalOrders(params: OrderInsightParams): Promise<number> {
		const where = this.buildWhere(params);
		return db.Order.count({ where });
	}

	async getTotalOrderValue(params: OrderInsightParams): Promise<number> {
		const where = this.buildWhere(params);
		const row = await db.Order.findOne({
			attributes: [[db.Sequelize.fn('SUM', db.Sequelize.col('totalAmount')), 'totalOrderValue']],
			where,
			raw: true,
		});

		return Number((row as any)?.totalOrderValue || 0);
	}
}

export default new OrderInsightRepository();
