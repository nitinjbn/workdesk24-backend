import { Op, WhereOptions } from 'sequelize';
import db from '../../../models';
import { AiInsightBaseQueryParams, AiInsightResultItem } from '../types/ai-insights.types';

interface AttendanceInsightParams extends AiInsightBaseQueryParams {}

export class AttendanceInsightRepository {
	private async buildBaseWhere(params: AttendanceInsightParams): Promise<WhereOptions> {
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

	async getEarliestAttendance(params: AttendanceInsightParams): Promise<AiInsightResultItem[]> {
		const where = await this.buildBaseWhere(params);
		const limit = params.limit ?? 5;

		const rows = await db.Attendance.findAll({
			attributes: [
				'userId',
				[db.Sequelize.fn('MIN', db.Sequelize.col('attendanceTime')), 'earliestTime'],
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
			order: [[db.Sequelize.literal('earliestTime'), 'ASC']],
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
			metrics: {
				attendanceTime: Number(row.earliestTime),
			},
			score: Number(row.earliestTime),
		}));
	}

	async getLatestAttendance(params: AttendanceInsightParams): Promise<AiInsightResultItem[]> {
		const where = await this.buildBaseWhere(params);
		const limit = params.limit ?? 5;

		const rows = await db.Attendance.findAll({
			attributes: [
				'userId',
				[db.Sequelize.fn('MAX', db.Sequelize.col('attendanceTime')), 'latestTime'],
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
			order: [[db.Sequelize.literal('latestTime'), 'DESC']],
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
			metrics: {
				attendanceTime: Number(row.latestTime),
			},
			score: Number(row.latestTime),
		}));
	}

	async getPresentEmployees(params: AttendanceInsightParams): Promise<AiInsightResultItem[]> {
		const where = await this.buildBaseWhere(params);
		const limit = params.limit ?? 20;

		const rows = await db.Attendance.findAll({
			attributes: [
				'userId',
				[db.Sequelize.fn('MIN', db.Sequelize.col('attendanceTime')), 'firstAttendanceTime'],
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
			order: [[db.Sequelize.literal('firstAttendanceTime'), 'ASC']],
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
				attendanceTime: Number(row.firstAttendanceTime),
			},
		}));
	}

	async getAbsentEmployees(params: AttendanceInsightParams): Promise<AiInsightResultItem[]> {
		const startUnix = Math.floor(new Date(params.startDateTime).getTime() / 1000);
		const endUnix = Math.floor(new Date(params.endDateTime).getTime() / 1000);
		const limit = params.limit ?? 20;

		const attendanceWhere: WhereOptions = {
			hostId: params.hostId,
			isDeleted: 0,
			attendanceTime: {
				[Op.gte]: startUnix,
				[Op.lte]: endUnix,
			},
		};

		if (params.employeeIds?.length) {
			attendanceWhere.userId = { [Op.in]: params.employeeIds };
		}

		const attendanceRows = await db.Attendance.findAll({
			attributes: ['userId'],
			where: attendanceWhere,
			group: ['userId'],
			raw: true,
		});

		const presentUserIds = attendanceRows.map((row: any) => Number(row.userId));

		const userWhere: any = {
			hostId: params.hostId,
			isDeleted: 0,
			accountStatus: 'ACTIVE',
		};

		if (params.employeeIds?.length) {
			userWhere.id = { [Op.in]: params.employeeIds };
		}

		if (presentUserIds.length) {
			userWhere.id = {
				...(userWhere.id || {}),
				[Op.notIn]: presentUserIds,
			};
		}

		const users = await db.User.findAll({
			attributes: ['id', 'name', 'employeeCode'],
			where: userWhere,
			order: [['name', 'ASC']],
			limit,
			raw: true,
		});

		return users.map((user: any) => ({
			employee: {
				id: Number(user.id),
				employeeCode: user.employeeCode || undefined,
				name: user.name || 'Unknown',
			},
		}));
	}

	async getAverageWorkingHours(params: AttendanceInsightParams): Promise<number> {
		const where = await this.buildBaseWhere(params);

		const row = await db.Attendance.findOne({
			attributes: [
				[db.Sequelize.fn('AVG', db.Sequelize.col('workingHours')), 'averageWorkingHours'],
			],
			where,
			raw: true,
		});

		const average = Number((row as any)?.averageWorkingHours || 0);
		return Number.isFinite(average) ? Number(average.toFixed(2)) : 0;
	}
}

export default new AttendanceInsightRepository();
