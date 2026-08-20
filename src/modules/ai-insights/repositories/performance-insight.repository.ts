import { Op } from 'sequelize';
import db from '../../../models';
import { AiInsightBaseQueryParams, AiInsightResultItem } from '../types/ai-insights.types';

interface PerformanceInsightParams extends AiInsightBaseQueryParams {}

type NumericMap = Map<number, number>;

interface Range {
	startUnix: number;
	endUnix: number;
}

export class PerformanceInsightRepository {
	private toUnixRange(params: PerformanceInsightParams): Range {
		return {
			startUnix: Math.floor(new Date(params.startDateTime).getTime() / 1000),
			endUnix: Math.floor(new Date(params.endDateTime).getTime() / 1000),
		};
	}

	private getPreviousRange(current: Range): Range {
		const duration = current.endUnix - current.startUnix;
		return {
			startUnix: current.startUnix - duration - 1,
			endUnix: current.startUnix - 1,
		};
	}

	private async getUsersByHost(hostId: number, employeeIds?: number[]): Promise<Map<number, { name: string; employeeCode?: string }>> {
		const where: any = {
			hostId,
			isDeleted: 0,
		};

		if (employeeIds?.length) {
			where.id = {
				[Op.in]: employeeIds,
			};
		}

		const users = await db.User.findAll({
			where,
			attributes: ['id', 'name', 'employeeCode'],
			raw: true,
		});

		const map = new Map<number, { name: string; employeeCode?: string }>();
		users.forEach((u: any) => {
			map.set(Number(u.id), {
				name: u.name || 'Unknown',
				employeeCode: u.employeeCode || undefined,
			});
		});

		return map;
	}

	private async getVisitCounts(hostId: number, range: Range, employeeIds?: number[]): Promise<NumericMap> {
		const where: any = {
			hostId,
			isDeleted: 0,
			checkInTime: {
				[Op.gte]: range.startUnix,
				[Op.lte]: range.endUnix,
			},
		};

		if (employeeIds?.length) {
			where.userId = { [Op.in]: employeeIds };
		}

		const rows = await db.Visit.findAll({
			attributes: ['userId', [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'value']],
			where,
			group: ['userId'],
			raw: true,
		});

		const result: NumericMap = new Map();
		rows.forEach((row: any) => {
			result.set(Number(row.userId), Number(row.value || 0));
		});

		return result;
	}

	private async getOrderValues(hostId: number, range: Range, employeeIds?: number[]): Promise<NumericMap> {
		const where: any = {
			hostId,
			isDeleted: 0,
			orderTime: {
				[Op.gte]: range.startUnix,
				[Op.lte]: range.endUnix,
			},
		};

		if (employeeIds?.length) {
			where.userId = { [Op.in]: employeeIds };
		}

		const rows = await db.Order.findAll({
			attributes: ['userId', [db.Sequelize.fn('SUM', db.Sequelize.col('totalAmount')), 'value']],
			where,
			group: ['userId'],
			raw: true,
		});

		const result: NumericMap = new Map();
		rows.forEach((row: any) => {
			result.set(Number(row.userId), Number(row.value || 0));
		});

		return result;
	}

	private async getPaymentValues(hostId: number, range: Range, employeeIds?: number[]): Promise<NumericMap> {
		const where: any = {
			hostId,
			isDeleted: 0,
			paymentDate: {
				[Op.gte]: range.startUnix,
				[Op.lte]: range.endUnix,
			},
		};

		if (employeeIds?.length) {
			where.userId = { [Op.in]: employeeIds };
		}

		const rows = await db.Payment.findAll({
			attributes: ['userId', [db.Sequelize.fn('SUM', db.Sequelize.col('amount')), 'value']],
			where,
			group: ['userId'],
			raw: true,
		});

		const result: NumericMap = new Map();
		rows.forEach((row: any) => {
			result.set(Number(row.userId), Number(row.value || 0));
		});

		return result;
	}

	async getBestPerformers(params: PerformanceInsightParams): Promise<AiInsightResultItem[]> {
		const range = this.toUnixRange(params);
		const limit = params.limit ?? 5;

		const [users, visits, orders, payments] = await Promise.all([
			this.getUsersByHost(params.hostId, params.employeeIds),
			this.getVisitCounts(params.hostId, range, params.employeeIds),
			this.getOrderValues(params.hostId, range, params.employeeIds),
			this.getPaymentValues(params.hostId, range, params.employeeIds),
		]);

		const rows: AiInsightResultItem[] = [];

		users.forEach((user, userId) => {
			const visitCount = visits.get(userId) || 0;
			const orderValue = orders.get(userId) || 0;
			const paymentValue = payments.get(userId) || 0;

			if (visitCount === 0 && orderValue === 0 && paymentValue === 0) {
				return;
			}

			rows.push({
				employee: {
					id: userId,
					employeeCode: user.employeeCode,
					name: user.name,
				},
				score: Number(orderValue.toFixed(2)),
				metrics: {
					totalVisits: visitCount,
					totalOrderValue: Number(orderValue.toFixed(2)),
					totalPaymentValue: Number(paymentValue.toFixed(2)),
				},
			});
		});

		rows.sort((a, b) => {
			const aOrder = Number(a.metrics?.totalOrderValue || 0);
			const bOrder = Number(b.metrics?.totalOrderValue || 0);
			if (bOrder !== aOrder) {
				return bOrder - aOrder;
			}

			const aPayment = Number(a.metrics?.totalPaymentValue || 0);
			const bPayment = Number(b.metrics?.totalPaymentValue || 0);
			if (bPayment !== aPayment) {
				return bPayment - aPayment;
			}

			const aVisits = Number(a.metrics?.totalVisits || 0);
			const bVisits = Number(b.metrics?.totalVisits || 0);
			return bVisits - aVisits;
		});

		return rows.slice(0, limit).map((item, index) => ({
			...item,
			rank: index + 1,
		}));
	}

	async getMostImproved(params: PerformanceInsightParams): Promise<AiInsightResultItem[]> {
		const currentRange = this.toUnixRange(params);
		const previousRange = this.getPreviousRange(currentRange);
		const limit = params.limit ?? 5;

		const [users, currentVisits, currentOrders, currentPayments, previousVisits, previousOrders, previousPayments] =
			await Promise.all([
				this.getUsersByHost(params.hostId, params.employeeIds),
				this.getVisitCounts(params.hostId, currentRange, params.employeeIds),
				this.getOrderValues(params.hostId, currentRange, params.employeeIds),
				this.getPaymentValues(params.hostId, currentRange, params.employeeIds),
				this.getVisitCounts(params.hostId, previousRange, params.employeeIds),
				this.getOrderValues(params.hostId, previousRange, params.employeeIds),
				this.getPaymentValues(params.hostId, previousRange, params.employeeIds),
			]);

		const currentRows = await this.getBestPerformers(params);
		const currentScores = new Map<number, number>();
		currentRows.forEach((row) => {
			if (row.employee?.id) {
				currentScores.set(row.employee.id, Number(row.score || 0));
			}
		});

		const previousParams: PerformanceInsightParams = {
			...params,
			startDateTime: new Date(previousRange.startUnix * 1000).toISOString(),
			endDateTime: new Date(previousRange.endUnix * 1000).toISOString(),
		};
		const previousRows = await this.getBestPerformers(previousParams);
		const previousScores = new Map<number, number>();
		previousRows.forEach((row) => {
			if (row.employee?.id) {
				previousScores.set(row.employee.id, Number(row.score || 0));
			}
		});

		const improvements: AiInsightResultItem[] = [];

		users.forEach((user, userId) => {
			const currentScore = currentScores.get(userId) || 0;
			const previousScore = previousScores.get(userId) || 0;
			const currentOrder = currentOrders.get(userId) || 0;
			const previousOrder = previousOrders.get(userId) || 0;
			const currentPayment = currentPayments.get(userId) || 0;
			const previousPayment = previousPayments.get(userId) || 0;
			const currentVisit = currentVisits.get(userId) || 0;
			const previousVisit = previousVisits.get(userId) || 0;

			const orderDelta = currentOrder - previousOrder;
			const paymentDelta = currentPayment - previousPayment;
			const visitDelta = currentVisit - previousVisit;
			const change = currentScore - previousScore;

			if (currentScore === 0 && previousScore === 0) {
				return;
			}

			const changePercentage = previousOrder > 0
				? (orderDelta / previousOrder) * 100
				: orderDelta > 0
					? 100
					: 0;

			improvements.push({
				employee: {
					id: userId,
					employeeCode: user.employeeCode,
					name: user.name,
				},
				score: Number(currentOrder.toFixed(2)),
				metrics: {
					totalVisits: currentVisit,
					totalOrderValue: Number(currentOrder.toFixed(2)),
					totalPaymentValue: Number(currentPayment.toFixed(2)),
					deltaVisits: visitDelta,
					deltaOrderValue: Number(orderDelta.toFixed(2)),
					deltaPaymentValue: Number(paymentDelta.toFixed(2)),
				},
				comparison: {
					previousPeriodScore: Number(previousOrder.toFixed(2)),
					change: Number(change.toFixed(2)),
					changePercentage: Number(changePercentage.toFixed(2)),
				},
			});
		});

		improvements.sort((a, b) => {
			const aOrderDelta = Number(a.metrics?.deltaOrderValue || 0);
			const bOrderDelta = Number(b.metrics?.deltaOrderValue || 0);
			if (bOrderDelta !== aOrderDelta) {
				return bOrderDelta - aOrderDelta;
			}

			const aPaymentDelta = Number(a.metrics?.deltaPaymentValue || 0);
			const bPaymentDelta = Number(b.metrics?.deltaPaymentValue || 0);
			if (bPaymentDelta !== aPaymentDelta) {
				return bPaymentDelta - aPaymentDelta;
			}

			const aVisitDelta = Number(a.metrics?.deltaVisits || 0);
			const bVisitDelta = Number(b.metrics?.deltaVisits || 0);
			return bVisitDelta - aVisitDelta;
		});

		return improvements.slice(0, limit).map((item, index) => ({
			...item,
			rank: index + 1,
		}));
	}

	async getTopVisitPerformers(params: PerformanceInsightParams): Promise<AiInsightResultItem[]> {
		const range = this.toUnixRange(params);
		const users = await this.getUsersByHost(params.hostId, params.employeeIds);
		const visitCounts = await this.getVisitCounts(params.hostId, range, params.employeeIds);

		const rows: AiInsightResultItem[] = [];
		users.forEach((user, userId) => {
			const count = visitCounts.get(userId) || 0;
			if (!count) {
				return;
			}

			rows.push({
				employee: {
					id: userId,
					employeeCode: user.employeeCode,
					name: user.name,
				},
				score: count,
				metrics: {
					totalVisits: count,
				},
			});
		});

		rows.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
		return rows.slice(0, params.limit ?? 5).map((row, index) => ({ ...row, rank: index + 1 }));
	}

	async getTopOrderPerformers(params: PerformanceInsightParams): Promise<AiInsightResultItem[]> {
		const range = this.toUnixRange(params);
		const users = await this.getUsersByHost(params.hostId, params.employeeIds);
		const orderValues = await this.getOrderValues(params.hostId, range, params.employeeIds);

		const rows: AiInsightResultItem[] = [];
		users.forEach((user, userId) => {
			const value = orderValues.get(userId) || 0;
			if (!value) {
				return;
			}

			rows.push({
				employee: {
					id: userId,
					employeeCode: user.employeeCode,
					name: user.name,
				},
				score: Number(value.toFixed(2)),
				metrics: {
					totalOrderValue: Number(value.toFixed(2)),
				},
			});
		});

		rows.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
		return rows.slice(0, params.limit ?? 5).map((row, index) => ({ ...row, rank: index + 1 }));
	}

	async getTopPaymentPerformers(params: PerformanceInsightParams): Promise<AiInsightResultItem[]> {
		const range = this.toUnixRange(params);
		const users = await this.getUsersByHost(params.hostId, params.employeeIds);
		const paymentValues = await this.getPaymentValues(params.hostId, range, params.employeeIds);

		const rows: AiInsightResultItem[] = [];
		users.forEach((user, userId) => {
			const value = paymentValues.get(userId) || 0;
			if (!value) {
				return;
			}

			rows.push({
				employee: {
					id: userId,
					employeeCode: user.employeeCode,
					name: user.name,
				},
				score: Number(value.toFixed(2)),
				metrics: {
					totalPaymentValue: Number(value.toFixed(2)),
				},
			});
		});

		rows.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
		return rows.slice(0, params.limit ?? 5).map((row, index) => ({ ...row, rank: index + 1 }));
	}
}

export default new PerformanceInsightRepository();
