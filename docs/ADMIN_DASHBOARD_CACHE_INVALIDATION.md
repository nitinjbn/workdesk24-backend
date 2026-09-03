# Admin Dashboard Cache Invalidation

The Admin Dashboard Overview API cache is invalidated by bumping a tenant-scoped dashboard overview version key. The overview response cache key includes this version, so new requests bypass stale entries without flushing Redis or deleting unrelated tenant/application caches.

Redis failures are non-blocking. If invalidation cannot update the version key, the business operation still succeeds and the dashboard falls back to TTL-based freshness.

## Invalidating Events

- `attendance.changed`: attendance create/update through `SyncService.syncAttendance`.
- `dayover.changed`: dayover update through `SyncService.syncAttendance` when an attendance row receives dayover data.
- `visit.changed`: visit create/update through `SyncService.syncVisits`.
- `order.changed`: order create/update through `SyncService.syncOrders`.
- `payment.changed`: payment create/update through `SyncService.syncPayments`.
- `feedback.changed`: feedback create/update through `SyncService.syncFeedback`.
- `image.changed`: image create/update/delete sync through `SyncService.syncImages`.
- `leave.status_changed`: leave approval/cancellation transitions that add or remove approved leave visibility through `LeaveRequestApprovalService`.

## Scope

Invalidation is scoped to the affected tenant's dashboard overview cache only. It does not flush Redis, delete all tenant cache entries, or touch independently refreshed APIs such as activity feed or last locations.