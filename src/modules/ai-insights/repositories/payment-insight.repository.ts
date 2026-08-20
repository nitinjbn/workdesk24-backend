import { Op, WhereOptions } from 'sequelize';
import db from '../../../models';
import { AiInsightBaseQueryParams, AiInsightResultItem } from '../types/ai-insights.types';

interface PaymentInsightParams extends AiInsightBaseQueryParams {}

export class PaymentInsightRepository {
	private buildWhere(params: PaymentInsightParams): WhereOptions {
		const startUnix = Math.floor(new Date(params.startDateTime).getTime() / 1000);
		const endUnix = Math.floor(new Date(params.endDateTime).getTime() / 1000);

		const where: WhereOptions = {
			hostId: params.hostId,
			isDeleted: 0,
			paymentDate: {
				[Op.gte]: startUnix,
				[Op.lte]: endUnix,
			},
		};

		if (params.employeeIds?.length) {
			where.userId = { [Op.in]: params.employeeIds };
		}

		return where;
	}

	async getTopEmployeesByPaymentAmount(params: PaymentInsightParams): Promise<AiInsightResultItem[]> {
		const startUnix = Math.floor(new Date(params.startDateTime).getTime() / 1000);
		const endUnix = Math.floor(new Date(params.endDateTime).getTime() / 1000);
		const limit = params.limit ?? 5;

		const visitWhere: any = {
			hostId: params.hostId,
			isDeleted: 0,
		};

		if (params.customerIds?.length) {
			visitWhere.customerId = { [Op.in]: params.customerIds };
		}

		const paymentWhere: any = {
			hostId: params.hostId,
			isDeleted: 0,
			paymentDate: {
				[Op.gte]: startUnix,
				[Op.lte]: endUnix,
			},
		};

		if (params.employeeIds?.length) {
			paymentWhere.userId = { [Op.in]: params.employeeIds };
		}

		const rows = await db.Payment.findAll({
			attributes: [
				'userId',
				[db.Sequelize.fn('SUM', db.Sequelize.col('amount')), 'totalPaymentValue'],
				[db.Sequelize.fn('COUNT', db.Sequelize.col('Payment.id')), 'totalPayments'],
				[db.Sequelize.col('user.name'), 'employeeName'],
				[db.Sequelize.col('user.employeeCode'), 'employeeCode'],
			],
			where: paymentWhere,
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
				{
					model: db.Visit,
					as: 'visit',
					attributes: [],
					required: true,
					where: visitWhere,
				},
			],
			group: ['userId', 'user.id', 'user.name', 'user.employeeCode'],
			order: [[db.Sequelize.literal('totalPaymentValue'), 'DESC']],
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
			score: Number(row.totalPaymentValue || 0),
			metrics: {
				totalPaymentValue: Number(row.totalPaymentValue || 0),
				totalPayments: Number(row.totalPayments || 0),
			},
		}));
	}

	async getTotalPayments(params: PaymentInsightParams): Promise<number> {
		const where = this.buildWhere(params);
		return db.Payment.count({
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

	async getTotalPaymentValue(params: PaymentInsightParams): Promise<number> {
		const where = this.buildWhere(params);
		const row = await db.Payment.findOne({
			attributes: [[db.Sequelize.fn('SUM', db.Sequelize.col('amount')), 'totalPaymentValue']],
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
			raw: true,
		});

		return Number((row as any)?.totalPaymentValue || 0);
	}
}

export default new PaymentInsightRepository();
