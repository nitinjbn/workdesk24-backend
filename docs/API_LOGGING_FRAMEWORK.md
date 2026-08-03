# API Logging Framework Guide

## Purpose
This document explains the production API logging framework used in this backend.

Goals:
- Capture request and response telemetry for every API route.
- Protect sensitive data through masking.
- Keep logging asynchronous and fault-isolated from business APIs.
- Support scalable reporting with requestDate-based monthly partitioning in MySQL.

## Design Principles
- Logging must never break the API response path.
- Controller logic remains independent from logging logic.
- Logging updates after response are offloaded to background jobs.
- Sensitive payload fields are masked before persistence.
- Route category and module are explicitly set by routing layer.

## High-Level Flow
1. Incoming request enters API logging middleware.
2. Middleware masks request body and writes a PROCESSING row in wd_api_logs.
3. Middleware stores apiLogId in request scope.
4. Controller executes and sends response.
5. On response finish, middleware computes response metrics and enqueues finalize job.
6. System worker consumes finalize job and updates wd_api_logs as SUCCESS or FAILED.

## File Map
Core logging module:
- src/modules/api-logs/middleware/api-logging.middleware.ts
- src/modules/api-logs/services/api-log.service.ts
- src/modules/api-logs/repositories/api-log.repository.ts
- src/modules/api-logs/types/api-log.types.ts
- src/modules/api-logs/index.ts

Queue and worker integration:
- src/infrastructure/background-jobs/queues/api-log.queue.ts
- src/infrastructure/background-jobs/processors/system.processor.ts
- src/infrastructure/background-jobs/workers/system.worker.ts
- src/infrastructure/background-jobs/constants/job-names.constant.ts
- src/infrastructure/background-jobs/constants/processor-names.constant.ts

App and route integration:
- src/app.ts
- src/routes/v1/index.ts
- src/routes/v1/app/index.ts
- src/routes/v1/admin/index.ts
- src/routes/v1/auth/index.ts
- src/routes/v1/public/index.ts

Model:
- src/models/schemas/ApiLog.ts
- src/models/index.production.ts

## Captured Fields
Before controller execution:
- hostId
- userId
- deviceId
- source (ANDROID, IOS, WEB, CRON, SYSTEM)
- category
- module
- apiEndpoint
- requestBody (masked)
- requestSize
- requestTime (Unix)
- requestDate (UTC date)
- ipAddress
- userAgent
- status = PROCESSING

After response finish:
- responseTime (Unix)
- durationMilliseconds
- responseStatusCode
- responseBody (masked)
- responseSize
- status = SUCCESS (statusCode < 400) or FAILED
- errorMessage (if exception path)

## Sensitive Data Masking
Masked keys (case-insensitive):
- password
- otp
- pin
- authorization
- accessToken
- refreshToken
- token

Notes:
- Deep objects and arrays are traversed recursively.
- Circular references are handled safely.
- Buffer values are reduced to a short descriptor.
- Oversized request/response bodies are truncated to a preview payload.

## Route Category and Module Strategy
Category and module are passed explicitly by route middleware using apiLogRouteContext.

Examples currently used:
- /api/v1/auth/* -> category: auth, module: auth
- /api/v1/app/sync/* -> category: app, module: sync
- /api/v1/admin/users/* -> category: admin, module: users
- /api/v1/public/inquiries/* -> category: public, module: inquiries

If route context is not set, middleware falls back to endpoint-based inference.

## Fault Isolation Guarantees
Logging is intentionally fail-safe:
- Any middleware logging exception is caught and ignored for API flow.
- Request pre-log write has a short timeout guard.
- Finalize queue dispatch errors are caught and logged only.
- If logging fails completely, API response still proceeds unchanged.

This ensures logging failures do not impact API success/failure behavior.

## Skip Rules
Logging is skipped for:
- /health
- /ping
- /favicon.ico
- /background-jobs (default pattern skip)

Additional skip patterns can be configured via environment variable and route-level middleware.

## Environment Configuration
Optional environment variables:
- API_LOG_BODY_MAX_BYTES
  - Default: 32768
  - Maximum serialized payload bytes before truncation preview is stored.

- API_LOG_CREATE_TIMEOUT_MS
  - Default: 30
  - Maximum wait for PROCESSING record creation before continuing request without apiLogId.

- API_LOG_SKIP_PATH_PATTERNS
  - Default: /background-jobs
  - Comma-separated path patterns to skip logging.
  - Example: /background-jobs,/metrics,/internal

## Queue Behavior
Finalize update is dispatched to SYSTEM queue with retry policy:
- attempts: 3
- backoff: fixed, 1000 ms
- removeOnComplete: keep latest 500
- removeOnFail: keep latest 1000

Job name:
- api-log-finalize

Processor:
- system-processor handles api-log-finalize and updates wd_api_logs.

## How to Add Logging Context for New Routes
Always set context at route mount level.

Pattern:
1. Import apiLogRouteContext from modules/api-logs.
2. Add router.use with category and module before endpoint definitions.

Example:
- router.use('/orders', apiLogRouteContext('app', 'orders'))

This keeps log categorization consistent across endpoints.

## How to Disable Logging for Specific Routes
Option 1: Environment-based skip patterns.
- Set API_LOG_SKIP_PATH_PATTERNS with comma-separated values.

Option 2: Route-level explicit disable.
1. Import disableApiLoggingForRoute from modules/api-logs.
2. Apply it before the target route group.

Example:
- router.use('/background-jobs', disableApiLoggingForRoute(), backgroundJobsRouter)

## Operational Checklist
When deploying logging changes:
1. Ensure worker process is running so finalize jobs are consumed.
2. Verify Redis connectivity for BullMQ.
3. Confirm wd_api_logs table exists and model is initialized.
4. Check logs for queue dispatch errors.
5. Validate that API responses are unaffected during DB/Redis failures.

## Troubleshooting
Issue: Rows remain in PROCESSING
- Check worker process health.
- Check Redis connectivity.
- Check system processor registration.

Issue: category/module not as expected
- Verify apiLogRouteContext on route mount.
- Confirm middleware order places route context before controller execution.

Issue: Large payloads not fully visible
- Expected when payload exceeds API_LOG_BODY_MAX_BYTES.
- Increase size carefully after reviewing storage impact.

Issue: Logging affects latency
- Lower API_LOG_CREATE_TIMEOUT_MS.
- Keep request/response payload limits conservative.
- Avoid adding heavy synchronous logic in middleware.

## Security Notes
- Do not remove masking keys without security review.
- Never write raw authorization tokens to logs.
- Keep logging as observability-only, not as source of truth for business state.

## Future Enhancements
- Add automated tests for mask rules and timeout behavior.
- Add structured dashboards for status and latency trends.
- Add optional sampling for extremely high-throughput endpoints.
