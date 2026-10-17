# Task Attachment Download

## Request

`POST /api/v1/app/task/downloadAttachment`

Use the existing app `Authorization: Bearer <token>` header and
`Content-Type: application/json`:

```json
{ "attachmentId": 123 }
```

JSON bodies match all neighboring app task reads and the existing Postman
collection. `src/app.ts` installs `express.json()` before routes. HTTP tests
exercise JSON POST bodies through Express and the real JWT middleware. No
Android source is present in this workspace, so the actual Android client has
not been inspected or run. Its request must send this JSON body, and its
successful response handler must consume a streaming binary body, not JSON.
Query parameters and client-provided task/tenant/user/URL values are not used.

## Authorization And Schema

- Validate a positive safe integer ID (numbers or digit-only numeric strings).
- JWT middleware resolves the user from the database; use only `req.user.id`,
  `req.user.hostId`, and `req.user.isAdminUser` for identity and permissions.
- Query `wd_task_attachments` by its actual `id` primary key and trusted host.
- Reuse task visibility: task must belong to that host, have `isDeleted = 0`,
  and either be assigned to this user or the user must be a same-host admin.
- If `taskCommentId` exists, require the comment ID, host, and task to match.
  Existing comments are visible to task participants, not only their author.
- Inaccessible and missing records return 404, following existing task APIs.

A read-only live `describeTable('wd_task_attachments')` verified the model's
columns: `id`, `hostId`, `taskId`, `taskCommentId`, `uploadedByUserId`, `fileName`,
`fileType`, `fileSizeBytes`, `fileUrl`, `remarks`, and `createdAt`.
Attachments and comments have no soft-delete or enabled fields. Tasks have
`isDeleted`, but no enabled flag. No schema or existing authentication-policy
changes are made.

## Delivery And Failures

The existing Cloudinary upload helper stores a signed HTTPS URL for
`authenticated` delivery. Downloads use that stored signed delivery URL; no new
Cloudinary integration, credentials, or upload behavior is introduced. Legacy
public `upload` URLs are supported without changing their delivery type.

Only HTTPS `res.cloudinary.com` URLs for the configured cloud, image/raw
resources, upload/authenticated delivery, a versioned path, and the exact
`<hostId>/tasks/<asset>` folder are accepted. Authenticated URLs must contain a
signature. Cloudinary SDK `_a` analytics parameters are allowed and removed;
other queries, credentials, ports, transformations, and arbitrary paths are
rejected. Custom CDN/URL patterns are intentionally not accepted automatically.
Node HTTPS does not follow redirects; non-200 responses are rejected.

The upstream readable is piped with backpressure, without buffering the file.
Only PDF/JPEG/PNG/WEBP stored MIME types are used; conflicting upstream MIME or
non-identity content encoding is rejected. A safe attachment filename preserves
the supported extension. Content length is forwarded only when upstream gives
a nonnegative safe integer; the database's original upload size is not used.
Responses use `Cache-Control: private, no-store` and `nosniff`. No upstream URL,
Location, credentials, or other upstream headers are forwarded or logged.

- 400: missing or invalid attachment ID.
- 401: existing authentication middleware rejects the request.
- 404: attachment, visible task, or linked comment is unavailable.
- 502: untrusted URL, missing/denied Cloudinary asset, redirect, upstream
  failure, or incompatible content metadata.
- 504: upstream inactivity timeout (15 seconds) or total deadline (120 seconds).

Errors before bytes are sent use the existing JSON error handler. After bytes
are sent, a failed stream closes the response without appending JSON. Client
disconnects cancel upstream retrieval. Android must treat a truncated download
as failed and discard the partial file.

## Deployment And Privacy

- Existing `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and
  `CLOUDINARY_API_SECRET` configuration is still required. Allow outbound HTTPS
  to `res.cloudinary.com`; no database migration or new package is needed.
- Cloudinary account security settings must permit PDF delivery. Validate a
  real authorized PDF and image in staging; unit tests mock upstream delivery
  and do not establish account-level delivery permissions.
- Configure ingress/proxy timeouts to accommodate the download deadline, and
  avoid proxy buffering if end-to-end streaming is required.
- This endpoint does not make existing public assets private. Legacy public
  URLs remain public. Current authenticated signed URLs are also reusable by
  anyone possessing them; their signatures do not provide per-user access or
  expiration. Existing upload/details/list APIs still return stored URLs for
  compatibility, and this change does not remove those responses or logs.
- Making all attachments accessible only through authorization requires a
  separate compatibility plan: audit existing assets and consumers, retire
  URL-returning responses/log capture, migrate public assets and invalidate old
  delivery URLs, and choose expiring/token-based delivery for signed assets.
  No such migration is performed here.
- The actual Android integration and real Cloudinary file retrieval remain
  staging checks; neither is claimed to have been executed.

## Verification

```text
node --test tests/task/task-service.unit.test.js
node node_modules/typescript/bin/tsc --noEmit --pretty false
```

The task collection includes an authenticated Download My Task Attachment
request. Its successful response is deliberately binary rather than the JSON
envelope used by non-file task APIs, matching the existing file-download API
convention.