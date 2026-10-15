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