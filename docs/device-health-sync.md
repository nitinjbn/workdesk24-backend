# Device health sync

`POST /api/v1/app/sync/deviceHealth` requires an app access token and a JSON body
of at most 16 KiB. The schema is defined in
[`device-health.schema.ts`](../src/modules/sync/types/device-health.schema.ts);
the example request and response are in the v3 Postman collection.

The authenticated host and user must match the request, and the device must
already be registered to that host and user. This does not bind an access token
to a particular registered device. Inactive registered devices are accepted:
existing registration flows do not consistently reactivate them. No registration
record is changed.

All timestamps are Unix seconds. Observed timestamps and `collectedAt` may be at
most five minutes ahead of the server; old offline snapshots are allowed.
`receivedAt` is set by the server only when a snapshot is written.

Successful requests return `data.status` as `created`, `updated`, or `duplicate`
and echo the submitted `sequence`. A duplicate of the currently stored complete
snapshot does not write or change `receivedAt`. A lower `collectedAt` returns
409 `DEVICE_HEALTH_STALE`; an equal timestamp with different fields returns 409
`DEVICE_HEALTH_AMBIGUOUS`. A soft-deleted snapshot returns 409
`DEVICE_HEALTH_DELETED`. Invalid or unsupported payloads return 400, an identity
or registration mismatch returns 403, and database failures return 500.

Android currently treats 409 as a permanent failure: it blocks that pending
snapshot rather than acknowledging it. A later meaningful state change can
stage another request. A 2xx response must not be used to silently acknowledge
an older or ambiguous snapshot. Temporary 500 failures remain retryable.

Ordering uses client collection time, not sequence, because the sequence can
reset after reinstall. There is no installation epoch or trusted client clock:
clock changes or delayed requests from an earlier installation can produce
incorrect ordering, and two legitimate updates in the same second can conflict.
An authorized installation-generation fencing contract is needed for strict
ordering. A retry of an older snapshot after a newer write cannot be recognized
as an exact duplicate using only the latest row.
