import visitRepository from '../../modules/staff/repositories/visit.repository';

export type RecordWithVisitLocalId = {
  visitLocalId?: string;
  visitId?: number;
  [key: string]: any;
};

export async function resolveVisitLocalIdForRecord(
  userId: number,
  record: RecordWithVisitLocalId,
  cache = new Map<string, number>()
): Promise<void> {
  if (!record.visitLocalId || record.visitId) {
    return;
  }

  const cachedVisitId = cache.get(record.visitLocalId);

  if (cachedVisitId) {
    record.visitId = cachedVisitId;
    return;
  }

  const visit = await visitRepository.findByLocalId(userId, record.visitLocalId);

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
