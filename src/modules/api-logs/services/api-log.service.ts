import { logger } from '../../../config/database';
import db from '../../../models';
import { QueryTypes } from 'sequelize';
import { apiLogQueue, ApiLogQueue } from '../../../infrastructure/background-jobs/queues/api-log.queue';
import { ApiLogRepository, apiLogRepository } from '../repositories/api-log.repository';
import type {
  ApiLogCreateInput,
  ApiLogFinalizeInput,
  ApiLogFinalizeJobPayload,
} from '../types/api-log.types';

interface PartitionMetadataRow {
  partitionMethod: string | null;
  partitionExpression: string | null;
}

interface PartitionStateRow {
  partitionName: string;
  partitionDescription: string | null;
  ordinalPosition: number;
}

interface LockRow {
  acquired?: number | string | null;
  released?: number | string | null;
}

const API_LOG_TABLE = 'wd_api_logs';
const API_LOG_PARTITION_LOCK = 'wd_api_logs:ensure_next_partition';
const API_LOG_PARTITION_LOCK_TIMEOUT_SECONDS = 15;

function quoteIdentifier(identifier: string): string {
  return `\`${identifier}\``;
}

function assertSafeIdentifier(identifier: string, label: string): void {
  if (!/^[A-Za-z0-9_]+$/.test(identifier)) {
    throw new Error(`Unsafe ${label}: ${identifier}`);
  }
}

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

function formatUtcDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  return `${year}-${month}-${day}`;
}

function toUtcMonthStart(year: number, monthIndex: number): Date {
  return new Date(Date.UTC(year, monthIndex, 1, 0, 0, 0));
}

function isMaxValuePartition(partitionDescription: string | null): boolean {
  return (partitionDescription || '').trim().toUpperCase() === 'MAXVALUE';
}

function deriveMonthlyPartitionName(targetMonthStartUtc: Date, existingNames: string[]): string {
  const year = targetMonthStartUtc.getUTCFullYear();
  const month = targetMonthStartUtc.getUTCMonth() + 1;
  const yyyy = String(year);
  const mm = pad2(month);
  const yyyymm = `${yyyy}${mm}`;
  const yyyymmdd = `${yyyymm}01`;

  const nonMaxNames = existingNames;

  for (const name of nonMaxNames) {
    const match = name.match(/^(.*?)(\d{8})([^\d]*)$/);
    if (!match) {
      continue;
    }

    return `${match[1]}${yyyymmdd}${match[3]}`;
  }

  for (const name of nonMaxNames) {
    const match = name.match(/^(.*?)(\d{4})[_-](\d{2})([^\d]*)$/);
    if (!match) {
      continue;
    }

    return `${match[1]}${yyyy}_${mm}${match[4]}`;
  }

  for (const name of nonMaxNames) {
    const match = name.match(/^(.*?)(\d{6})([^\d]*)$/);
    if (!match) {
      continue;
    }

    return `${match[1]}${yyyymm}${match[3]}`;
  }

  return `p${yyyymm}`;
}

export class ApiLogService {
  public constructor(
    private readonly repository: ApiLogRepository = apiLogRepository,
    private readonly queue: ApiLogQueue = apiLogQueue,
  ) {}

  public async createProcessingLog(input: ApiLogCreateInput): Promise<number | null> {
    try {
      return await this.repository.createProcessingRecord(input);
    } catch (error: unknown) {
      logger.error('Failed to create PROCESSING API log record.', {
        error: error instanceof Error ? error.message : String(error),
        endpoint: input.apiEndpoint,
      });
      return null;
    }
  }

  public async queueFinalizeLog(input: ApiLogFinalizeInput): Promise<void> {
    const payload: ApiLogFinalizeJobPayload = {
      apiLogId: input.apiLogId,
      status: input.status,
      responseStatusCode: input.responseStatusCode,
      responseBody: input.responseBody,
      responseSize: input.responseSize,
      responseTime: input.responseTime,
      durationMilliseconds: input.durationMilliseconds,
      errorMessage: input.errorMessage ?? null,
    };

    try {
      await this.queue.dispatchFinalizeUpdate(payload, {
        jobId: `api-log-finalize:${input.apiLogId}:${input.responseTime}`,
      });
    } catch (error: unknown) {
      logger.error('Failed to queue API log finalize job.', {
        error: error instanceof Error ? error.message : String(error),
        apiLogId: input.apiLogId,
      });
    }
  }

  public async finalizeFromQueue(input: ApiLogFinalizeJobPayload): Promise<void> {
    await this.repository.finalizeRecord(input);
  }

  public async ensureNextPartition(): Promise<void> {
    let lockAcquired = false;

    const nowUtc = new Date();
    const nextMonthStartUtc = toUtcMonthStart(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() + 1);
    const nextMonthUpperBoundUtc = toUtcMonthStart(nowUtc.getUTCFullYear(), nowUtc.getUTCMonth() + 2);
    const nextMonthStartDate = formatUtcDate(nextMonthStartUtc);
    const nextMonthUpperBoundDate = formatUtcDate(nextMonthUpperBoundUtc);

    try {
      const lockRows = await db.sequelize.query(
        'SELECT GET_LOCK(:lockName, :timeoutSeconds) AS acquired',
        {
          replacements: {
            lockName: API_LOG_PARTITION_LOCK,
            timeoutSeconds: API_LOG_PARTITION_LOCK_TIMEOUT_SECONDS,
          },
          type: QueryTypes.SELECT,
        },
      ) as LockRow[];

      const acquiredValue = Number(lockRows[0]?.acquired ?? 0);
      lockAcquired = acquiredValue === 1;

      if (!lockAcquired) {
        logger.info('API log partition maintenance skipped because lock is already held by another worker.', {
          tableName: API_LOG_TABLE,
          lockName: API_LOG_PARTITION_LOCK,
        });
        logger.info('No API log partition change was required.', {
          tableName: API_LOG_TABLE,
          reason: 'lock-not-acquired',
        });
        return;
      }

      const metadataRows = await db.sequelize.query(
        `SELECT
           PARTITION_METHOD AS partitionMethod,
           PARTITION_EXPRESSION AS partitionExpression
         FROM information_schema.PARTITIONS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :tableName
           AND PARTITION_NAME IS NOT NULL
         LIMIT 1`,
        {
          replacements: {
            tableName: API_LOG_TABLE,
          },
          type: QueryTypes.SELECT,
        },
      ) as PartitionMetadataRow[];

      const metadata = metadataRows[0];
      if (!metadata) {
        throw new Error(`Partition metadata not found for table ${API_LOG_TABLE}.`);
      }

      const partitionMethod = (metadata.partitionMethod || '').toUpperCase();
      const partitionExpression = (metadata.partitionExpression || '').toLowerCase();

      let targetPartitionDescription: string;
      let boundarySql: string;

      if (partitionMethod === 'RANGE COLUMNS') {
        targetPartitionDescription = nextMonthUpperBoundDate;
        boundarySql = `('${nextMonthUpperBoundDate}')`;
      } else if (partitionMethod === 'RANGE' && partitionExpression.includes('to_days')) {
        const boundaryRows = await db.sequelize.query(
          'SELECT TO_DAYS(:upperBoundDate) AS boundaryValue',
          {
            replacements: {
              upperBoundDate: nextMonthUpperBoundDate,
            },
            type: QueryTypes.SELECT,
          },
        ) as Array<{ boundaryValue: number | string }>;

        const boundaryValue = Number(boundaryRows[0]?.boundaryValue);
        if (!Number.isFinite(boundaryValue)) {
          throw new Error('Failed to resolve TO_DAYS boundary for API log partition.');
        }

        targetPartitionDescription = String(Math.trunc(boundaryValue));
        boundarySql = `(TO_DAYS('${nextMonthUpperBoundDate}'))`;
      } else if (partitionMethod === 'RANGE' && partitionExpression.includes('requestdate')) {
        targetPartitionDescription = nextMonthUpperBoundDate;
        boundarySql = `('${nextMonthUpperBoundDate}')`;
      } else if (partitionMethod === 'RANGE' && partitionExpression.includes('unix_timestamp')) {
        const boundaryValue = Math.floor(Date.UTC(
          nextMonthUpperBoundUtc.getUTCFullYear(),
          nextMonthUpperBoundUtc.getUTCMonth(),
          nextMonthUpperBoundUtc.getUTCDate(),
          0,
          0,
          0,
        ) / 1000);

        targetPartitionDescription = String(boundaryValue);
        boundarySql = `(${boundaryValue})`;
      } else if (partitionMethod === 'RANGE' && partitionExpression.includes('requesttime')) {
        const boundaryValue = Math.floor(Date.UTC(
          nextMonthUpperBoundUtc.getUTCFullYear(),
          nextMonthUpperBoundUtc.getUTCMonth(),
          nextMonthUpperBoundUtc.getUTCDate(),
          0,
          0,
          0,
        ) / 1000);

        targetPartitionDescription = String(boundaryValue);
        boundarySql = `(${boundaryValue})`;
      } else {
        throw new Error(
          `Unsupported partition strategy for ${API_LOG_TABLE}: method=${partitionMethod}, expression=${metadata.partitionExpression ?? 'NULL'}`,
        );
      }

      const partitionRows = await db.sequelize.query(
        `SELECT
           PARTITION_NAME AS partitionName,
           PARTITION_DESCRIPTION AS partitionDescription,
           PARTITION_ORDINAL_POSITION AS ordinalPosition
         FROM information_schema.PARTITIONS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :tableName
           AND PARTITION_NAME IS NOT NULL
         ORDER BY PARTITION_ORDINAL_POSITION ASC`,
        {
          replacements: {
            tableName: API_LOG_TABLE,
          },
          type: QueryTypes.SELECT,
        },
      ) as PartitionStateRow[];

      if (partitionRows.length === 0) {
        throw new Error(`No partitions found for table ${API_LOG_TABLE}.`);
      }

      const targetExists = partitionRows.some(
        (row) => (row.partitionDescription || '').trim() === targetPartitionDescription,
      );

      if (targetExists) {
        logger.info('API log partition already exists; no action required.', {
          tableName: API_LOG_TABLE,
          targetPartitionMonthUtc: nextMonthStartDate,
          targetUpperBoundUtc: nextMonthUpperBoundDate,
          targetPartitionDescription,
        });
        return;
      }

      const maxValuePartition = partitionRows.find((row) => isMaxValuePartition(row.partitionDescription));
      const existingNames = partitionRows
        .filter((row) => !isMaxValuePartition(row.partitionDescription))
        .map((row) => row.partitionName);
      const targetPartitionName = deriveMonthlyPartitionName(nextMonthStartUtc, existingNames);
      assertSafeIdentifier(targetPartitionName, 'partition name');

      const nameConflict = partitionRows.some(
        (row) => row.partitionName === targetPartitionName,
      );

      if (nameConflict) {
        throw new Error(
          `Partition name conflict for ${API_LOG_TABLE}: ${targetPartitionName} already exists with a different boundary.`,
        );
      }

      assertSafeIdentifier(API_LOG_TABLE, 'table name');
      const quotedTableName = quoteIdentifier(API_LOG_TABLE);

      let ddlSql: string;
      if (maxValuePartition) {
        assertSafeIdentifier(maxValuePartition.partitionName, 'MAXVALUE partition name');

        ddlSql = `ALTER TABLE ${quotedTableName} REORGANIZE PARTITION ${quoteIdentifier(maxValuePartition.partitionName)} INTO (`
          + `PARTITION ${quoteIdentifier(targetPartitionName)} VALUES LESS THAN ${boundarySql}, `
          + `PARTITION ${quoteIdentifier(maxValuePartition.partitionName)} VALUES LESS THAN MAXVALUE)`;
      } else {
        ddlSql = `ALTER TABLE ${quotedTableName} ADD PARTITION (`
          + `PARTITION ${quoteIdentifier(targetPartitionName)} VALUES LESS THAN ${boundarySql})`;
      }

      await db.sequelize.query(ddlSql, {
        type: QueryTypes.RAW,
      });

      logger.info('API log partition created successfully.', {
        tableName: API_LOG_TABLE,
        partitionName: targetPartitionName,
        targetPartitionMonthUtc: nextMonthStartDate,
        targetUpperBoundUtc: nextMonthUpperBoundDate,
        targetPartitionDescription,
        usedReorganize: Boolean(maxValuePartition),
      });
    } catch (error: unknown) {
      logger.error('API log partition operation failed.', {
        tableName: API_LOG_TABLE,
        targetPartitionMonthUtc: nextMonthStartDate,
        targetUpperBoundUtc: nextMonthUpperBoundDate,
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      if (!lockAcquired) {
        return;
      }

      try {
        await db.sequelize.query(
          'SELECT RELEASE_LOCK(:lockName) AS released',
          {
            replacements: {
              lockName: API_LOG_PARTITION_LOCK,
            },
            type: QueryTypes.SELECT,
          },
        );
      } catch (releaseError: unknown) {
        logger.error('Failed to release API log partition maintenance lock.', {
          tableName: API_LOG_TABLE,
          lockName: API_LOG_PARTITION_LOCK,
          error: releaseError instanceof Error ? releaseError.message : String(releaseError),
        });
      }
    }
  }
}

export const apiLogService = new ApiLogService();
