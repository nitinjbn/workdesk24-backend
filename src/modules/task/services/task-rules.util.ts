import { createConfiguredError } from '../../../shared/utils/error.util';

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type TaskAction = 'STARTED' | 'COMPLETED' | 'CANCELLED';

const transitions: Record<string, { action: TaskAction; timestampField: 'startedAt' | 'completedAt' | 'cancelledAt' }> = {
  'PENDING:IN_PROGRESS': { action: 'STARTED', timestampField: 'startedAt' },
  'IN_PROGRESS:COMPLETED': { action: 'COMPLETED', timestampField: 'completedAt' },
  'PENDING:CANCELLED': { action: 'CANCELLED', timestampField: 'cancelledAt' },
  'IN_PROGRESS:CANCELLED': { action: 'CANCELLED', timestampField: 'cancelledAt' },
};

export function getTaskTransition(current: TaskStatus, target: TaskStatus) {
  return transitions[`${current}:${target}`] || null;
}

export function isValidTaskFile(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === 'image/jpeg') return buffer.length > 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  if (mimeType === 'image/png') return buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === 'image/webp') return buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP';
  if (mimeType === 'application/pdf') return buffer.toString('ascii', 0, 5) === '%PDF-';
  return false;
}

export function isValidUnixTimestamp(value: unknown): boolean {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

export function parseTaskEntityId(value: unknown, field: 'taskId' | 'tagId'): number {
  if ((typeof value !== 'number' && typeof value !== 'string')
    || (typeof value === 'string' && (value !== value.trim() || !/^[1-9]\d*$/.test(value)))
    || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
    const code = field === 'tagId' ? 'INVALID_TASK_TAG_ID' : 'INVALID_TASK_ID';
    throw createConfiguredError(code, `${field} must be a positive integer`, 400, code);
  }
  return Number(value);
}

export function parseTaskTagIds(value: unknown): number[] {
  if (!Array.isArray(value)) {
    throw createConfiguredError('INVALID_TASK_TAG_IDS', 'tagIds must be an array of positive integers', 400, 'INVALID_TASK_TAG_IDS');
  }
  return [...new Set(value.map((id) => parseTaskEntityId(id, 'tagId')))];
}
