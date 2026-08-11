import { logger } from '../../../../config/database';
import db from '../../../../models';
import { QueryTypes } from 'sequelize';

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

export interface PartitionMaintenanceConfig {
  tableName: string;
  lockName: string;
  displayName: string;
  lockTimeoutSeconds?: number;
}

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

  for (const name of existingNames) {
    const match = name.match(/^(.*?)(\d{8})([^\d]*)$/);
    if (!match) {
      continue;
    }

    return `${match[1]}${yyyymmdd}${match[3]}`;
  }

  for (const name of existingNames) {
    const match = name.match(/^(.*?)(\d{4})[_-](\d{2})([^\d]*)$/);
    if (!match) {
      continue;
    }

    return `${match[1]}${yyyy}_${mm}${match[4]}`;
  }

  for (const name of existingNames) {
    const match = name.match(/^(.*?)(\d{6})([^\d]*)$/);
    if (!match) {
      continue;
    }

    return `${match[1]}${yyyymm}${match[3]}`;
  }

  return `p${yyyymm}`;
}

function resolveUnixBoundary(nextMonthUpperBoundUtc: Date): number {
  return Math.floor(Date.UTC(
    nextMonthUpperBoundUtc.getUTCFullYear(),
    nextMonthUpperBoundUtc.getUTCMonth(),
    nextMonthUpperBoundUtc.getUTCDate(),
    0,
    0,
    0,
  ) / 1000);
}

export class PartitionMaintenanceHelper {
  public async ensureNextMonthlyPartition(config: PartitionMaintenanceConfig): Promise<void> {
    let lockAcquired = false;
    const lockTimeoutSeconds = config.lockTimeoutSeconds ?? 15;

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
            lockName: config.lockName,
            timeoutSeconds: lockTimeoutSeconds,
          },
          type: QueryTypes.SELECT,
        },
      ) as LockRow[];

      const acquiredValue = Number(lockRows[0]?.acquired ?? 0);
      lockAcquired = acquiredValue === 1;

      if (!lockAcquired) {
        logger.info(`${config.displayName} partition maintenance skipped because lock is already held by another worker.`, {
          tableName: config.tableName,
          lockName: config.lockName,
        });
        logger.info(`No ${config.displayName} partition change was required.`, {
          tableName: config.tableName,
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
            tableName: config.tableName,
          },
          type: QueryTypes.SELECT,
        },
      ) as PartitionMetadataRow[];

      const metadata = metadataRows[0];
      if (!metadata) {
        throw new Error(`Partition metadata not found for table ${config.tableName}.`);
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
          throw new Error(`Failed to resolve TO_DAYS boundary for ${config.displayName} partition.`);
        }

        targetPartitionDescription = String(Math.trunc(boundaryValue));
        boundarySql = `(TO_DAYS('${nextMonthUpperBoundDate}'))`;
      } else if (partitionMethod === 'RANGE' && partitionExpression.includes('requestdate')) {
        targetPartitionDescription = nextMonthUpperBoundDate;
        boundarySql = `('${nextMonthUpperBoundDate}')`;
      } else if (partitionMethod === 'RANGE' && partitionExpression.includes('createdat')) {
        const boundaryValue = resolveUnixBoundary(nextMonthUpperBoundUtc);
        targetPartitionDescription = String(boundaryValue);
        boundarySql = `(${boundaryValue})`;
      } else if (partitionMethod === 'RANGE' && partitionExpression.includes('unix_timestamp')) {
        const boundaryValue = resolveUnixBoundary(nextMonthUpperBoundUtc);
        targetPartitionDescription = String(boundaryValue);
        boundarySql = `(${boundaryValue})`;
      } else if (partitionMethod === 'RANGE' && partitionExpression.includes('requesttime')) {
        const boundaryValue = resolveUnixBoundary(nextMonthUpperBoundUtc);
        targetPartitionDescription = String(boundaryValue);
        boundarySql = `(${boundaryValue})`;
      } else if (partitionMethod === 'RANGE' && partitionExpression.includes('activitytime')) {
        const boundaryValue = resolveUnixBoundary(nextMonthUpperBoundUtc);
        targetPartitionDescription = String(boundaryValue);
        boundarySql = `(${boundaryValue})`;
      } else {
        throw new Error(
          `Unsupported partition strategy for ${config.tableName}: method=${partitionMethod}, expression=${metadata.partitionExpression ?? 'NULL'}`,
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
            tableName: config.tableName,
          },
          type: QueryTypes.SELECT,
        },
      ) as PartitionStateRow[];

      if (partitionRows.length === 0) {
        throw new Error(`No partitions found for table ${config.tableName}.`);
      }

      const targetExists = partitionRows.some(
        (row) => (row.partitionDescription || '').trim() === targetPartitionDescription,
      );

      if (targetExists) {
        logger.info(`${config.displayName} partition already exists; no action required.`, {
          tableName: config.tableName,
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

      const conflictingPartition = partitionRows.find((row) => row.partitionName === targetPartitionName);
      if (conflictingPartition) {
        logger.info(`${config.displayName} partition name already exists; skipping as idempotent success.`, {
          tableName: config.tableName,
          partitionName: targetPartitionName,
          existingPartitionDescription: conflictingPartition.partitionDescription,
          targetPartitionMonthUtc: nextMonthStartDate,
          targetUpperBoundUtc: nextMonthUpperBoundDate,
          targetPartitionDescription,
        });
        return;
      }

      assertSafeIdentifier(config.tableName, 'table name');
      const quotedTableName = quoteIdentifier(config.tableName);

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

      logger.info(`${config.displayName} partition created successfully.`, {
        tableName: config.tableName,
        partitionName: targetPartitionName,
        targetPartitionMonthUtc: nextMonthStartDate,
        targetUpperBoundUtc: nextMonthUpperBoundDate,
        targetPartitionDescription,
        usedReorganize: Boolean(maxValuePartition),
      });
    } catch (error: unknown) {
      logger.error(`${config.displayName} partition operation failed.`, {
        tableName: config.tableName,
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
              lockName: config.lockName,
            },
            type: QueryTypes.SELECT,
          },
        );
      } catch (releaseError: unknown) {
        logger.error(`Failed to release ${config.displayName} partition maintenance lock.`, {
          tableName: config.tableName,
          lockName: config.lockName,
          error: releaseError instanceof Error ? releaseError.message : String(releaseError),
        });
      }
    }
  }
}

export const partitionMaintenanceHelper = new PartitionMaintenanceHelper();