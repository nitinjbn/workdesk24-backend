import { VisitRepository } from '../../modules/sync/repositories';
import { Transaction } from 'sequelize';
const visitRepository = new VisitRepository();

export type RecordWithVisitLocalId = {
  visitLocalId?: string;
  visitId?: number;
  [key: string]: any;
};

export async function resolveVisitLocalIdForRecord(
  userId: number,
  record: RecordWithVisitLocalId,
  cache = new Map<string, number>(),
  transaction?: Transaction
): Promise<void> {
  if (!record.visitLocalId || record.visitId) {
    return;
  }

  const cachedVisitId = cache.get(record.visitLocalId);

  if (cachedVisitId) {
    record.visitId = cachedVisitId;
    return;
  }

  const visit = await visitRepository.findOne({
    userId,
    localId: record.visitLocalId,
  } as any, transaction);

  if (!visit) {
    throw new Error(`Visit not found for visitLocalId: ${record.visitLocalId}`);
  }

  record.visitId = visit.id;
  cache.set(record.visitLocalId, visit.id);
}

export async function resolveVisitLocalIdsForRecords(
  userId: number,
  records: RecordWithVisitLocalId[]
): Promise<void> {
  const cache = new Map<string, number>();

  for (const record of records) {
    await resolveVisitLocalIdForRecord(userId, record, cache);
  }
}
