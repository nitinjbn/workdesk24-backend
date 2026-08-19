export interface AIRequestContext {
    userId: string;
    hostId: string;
    role: string;
    timezone: string;
    lastEmployeeSearchUserIds?: Set<string>;
    lastEmployeeSearchMatchCount?: number;
}