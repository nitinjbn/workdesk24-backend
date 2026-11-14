# Task categories and category-based numbering

## Architecture and compatibility

Category endpoints reuse the existing admin task router and its JWT, admin-role,
CSRF, API-log and support-access middleware. The flow remains controller ->
service -> repository -> shared Sequelize pool.

Both task creation endpoints now **require `taskCategoryId`**, as explicitly
selected for this rollout. Old clients must be updated before task writes resume.
No category is silently selected for them. Existing task response envelopes,
statuses, priorities, lifecycle rules and task numbers are preserved.

Task lists (admin/app), details and Kanban add:

```json
{
  "taskCategoryId": 1,
  "taskCategory": {
    "id": 1,
    "name": "Projects",
    "taskNumberPrefix": "PRJ"
  }
}
```

Legacy nullable references return `taskCategory: null`. Disabled categories remain
visible on existing tasks. Lists/Kanban also accept `filters.taskCategoryId`.
Task updates may select another enabled, non-deleted category in the same host;
this never changes the task number or either sequence.

## Category endpoints

All endpoints are POST under `/api/v1/admin/tasks/task-categories`.
Use an admin bearer token and the existing matching admin CSRF cookie/header.
Do not supply `hostId`: scope is always derived from authentication.

| Suffix | Request example | Success data |
| --- | --- | --- |
| `/list` | `{}` | `{categories}` |
| `/create` | `{"name":"Projects","description":"Project tasks","taskNumberPrefix":"PRJ","isEnabled":1}` | `{category}` |
| `/update` | `{"taskCategoryId":1,"name":"Projects","taskNumberPrefix":"PROJ","description":null}` | `{category}` |
| `/detail` | `{"taskCategoryId":1}` | `{category}` |
| `/delete` | `{"taskCategoryId":1}` | `{taskCategoryId}` |
| `/toggle-status` | `{"taskCategoryId":1,"isEnabled":0}` | `{category}` |

Example detail response:

```json
{
  "success": true,
  "message": "Task category retrieved successfully",
  "data": {
    "category": {
      "id": 1,
      "hostId": 7,
      "name": "Projects",
      "description": "Project tasks",
      "taskNumberPrefix": "PRJ",
      "nextTaskNumber": "1",
      "isEnabled": 1,
      "isDeleted": 0,
      "createdAt": 1794652200,
      "updatedAt": null,
      "deletedAt": null,
      "taskCount": 0
    }
  }
}
```

Category timestamps are Unix seconds. `nextTaskNumber` may be a numeric string
from the BIGINT driver; it is never converted through an unsafe JavaScript number.
List/detail task counts include all associated tasks, including soft-deleted
tasks. Counts are included in the repository query, without per-category queries.

- Listing returns all matching categories by default, without a pagination key.
  Supply page or limit to opt into pagination, e.g. `{"page":1,"limit":20}`.
  When only one is supplied, the other defaults to page 1 or limit 20 (maximum
  100). Paginated responses include `{page, limit, total, totalPages}` metadata.
  Sorting defaults to name ASC. Allowed sort fields: id, name, createdAt, updatedAt.
- Search is a name substring (maximum 100 characters); omit isEnabled to include
  both enabled and disabled categories.
- Names and prefixes are trimmed, required on create and limited to 100 and 20
  characters respectively. Prefix formatting matches the existing task allocator.
  Description is optional/null, maximum 500 characters.
- Non-deleted names and effective prefixes are unique per host, including
  disabled categories. `PRJ` and `PRJ-` generate the same namespace and conflict.
  Database collation determines case/accent equivalence.
- Ordinary updates cannot modify nextTaskNumber or isEnabled. Use toggle-status
  with an explicit numeric 0/1 for status.
- Soft deletion sets isDeleted/deletedAt. Any associated task prevents deletion
  with HTTP 409 `TASK_CATEGORY_IN_USE`; disabling is the non-destructive option.
- Missing, deleted or cross-host IDs return 404 `TASK_CATEGORY_NOT_FOUND`.
  Duplicate names/prefixes return 409. Invalid inputs return 400.
- Read-only support sessions can list/view categories but cannot mutate them.

## Task creation and numbering

JSON request to `POST /api/v1/admin/tasks/createTask`:

```json
{
  "taskCategoryId": 1,
  "title": "Prepare proposal",
  "assignedToUserId": 22,
  "priority": "HIGH"
}
```

The multipart `/createTaskWithAttachment` endpoint requires the same category ID
as a text field. The existing optional-file behavior is unchanged.

Both paths use the same centralized transaction:

1. Select the category by id, authenticated hostId and isDeleted=0, with FOR UPDATE.
2. Reject a missing/deleted/cross-host category or a disabled category.
3. Validate references and create the task, activity and optional attachment.
4. Advance the category's nextTaskNumber and commit everything together.
5. Notify only after commit; roll back the counter and records on any failure.

The existing format is retained: prefix, one separator (unless already present),
then the exact decimal sequence, e.g. PRJ-41. Different categories have independent
sequences. BIGINT arithmetic uses BigInt/string values, with existing overflow and
30-character task-number checks.

Category edits, disabling/deletion and task reassignment use the same category
row lock. Category-before-task lock ordering prevents a task being added to a
category while it is deleted. Every lookup is host-scoped, including association
joins; foreign keys are not the only tenant-ownership check.

The database also enforces unique `(hostId, taskNumber)` across all tasks,
including deleted tasks. Changing/reusing a prefix can encounter historical
numbers. A collision returns HTTP 409 `TASK_NUMBER_CONFLICT` and rolls the entire
creation back without consuming a number; choose a different prefix rather than
resetting a counter. There is no silent retry or renumbering.

## Migration and deployment

Migration: [20261114120000-create-task-categories.js](../src/migrations/20261114120000-create-task-categories.js).

Requirements: existing task/settings/host tables, InnoDB, MySQL 5.7+ generated
stored-column support (verify against the deployment's actual MySQL version).
Active-name/prefix uniqueness uses two generated nullable keys because MySQL does
not support partial unique indexes. Deleted rows generate NULL, permitting reuse.
These implementation-only columns are not mapped/exposed by the model.

1. Back up the database and stop **all** task/category writers, including old app
   instances, before applying the migration. Do not mix the legacy allocator with
   the category allocator during rollout.
2. Review pending migrations, then use the existing Sequelize migration command
   (`npm.cmd run db:migrate`) for the intended environment. This feature does not
   run sync/alter/force synchronization at application startup.
3. The migration preflights duplicate task numbers and orphan host references,
   failing explicitly rather than altering existing numbers or dropping data.
4. It creates categories, generated uniqueness indexes, a nullable taskCategoryId
   foreign key/index and the host/task-number unique index.
5. An atomic data transaction creates a General category per host represented by
   settings or tasks and maps every uncategorized task to its own host's category.
   Existing task fields other than taskCategoryId are untouched.
6. General copies the legacy prefix/counter/creation time. If the stored counter
   is stale, it advances past existing matching numbers (including deleted tasks).
   Hosts with tasks but no settings use TASK- and the next safe matching suffix.
   Invalid or overflowing counters/prefixes fail explicitly.
7. MySQL DDL implicitly commits; schema steps are restartable. A data failure rolls
   back all backfill writes, but completed DDL remains. Repair the reported source
   data and rerun while writers remain stopped.
8. Verify host/category mappings, migrate clients to send taskCategoryId, then
   deploy the new server and resume writes. New hosts without settings/tasks must
   create a category through the API before creating tasks.

`wd_task_settings` and its model/export remain for rollback only; runtime numbering
uses only TaskCategory. The old TASK_SETTINGS constants are legacy configuration,
not an allocation source.

Rollback also requires all writers stopped. It restores General's high-water
counter to legacy settings and removes the category column/table. It deliberately
refuses a downgrade when tasks use custom/deleted categories, because multiple
used sequences cannot safely be represented by one legacy counter. Reconcile
explicitly or restore the predeployment backup instead. The task-number uniqueness
guard is retained.

## Changed files

New production files:
- [TaskCategory model](../src/models/schemas/TaskCategory.ts)
- [Category controller](../src/modules/task/controllers/task-category.controller.ts)
- [Category service](../src/modules/task/services/task-category.service.ts)
- [Category repository](../src/modules/task/repositories/task-category.repository.ts)
- [Migration](../src/migrations/20261114120000-create-task-categories.js)

Existing production/configuration files:
- [Task model](../src/models/schemas/Task.ts), [legacy settings model](../src/models/schemas/TaskSettings.ts),
  [model registration](../src/models/index.production.ts)
- [Task controller](../src/modules/task/controllers/task.controller.ts),
  [service](../src/modules/task/services/task.service.ts),
  [repository](../src/modules/task/repositories/task.repository.ts)
- [Existing task router](../src/routes/v1/admin/tasks.routes.ts),
  [support policy](../src/shared/middleware/support-access.middleware.ts),
  [numeric serialization](../src/shared/utils/data-type-converter.util.ts)
- [Package scripts](../package.json), [task Postman collection](../Task_Management.postman_collection.json),
  [v3 Postman collection](../Workdesk24_API_v3.postman_collection.json)

New tests:
- [Category CRUD/API tests](../tests/task/task-category.unit.test.js)
- [Executable migration fixtures](../tests/task/task-category-migration.unit.test.js)
- [Opt-in MySQL migration tests](../tests/task/task-category-migration.mysql.integration.test.js)

Updated tests:
- [Numbering unit tests](../tests/task/task-number.unit.test.ts),
  [MySQL numbering tests](../tests/task/task-number.mysql.integration.test.ts),
  [task service/API tests](../tests/task/task-service.unit.test.js),
  [Kanban association assertions](../tests/task/task-kanban.unit.test.js),
  [support policy tests](../tests/auth/support-access.middleware.unit.test.js)

## Verification commands

- `npm.cmd run build`
- `npm.cmd run test:task` (includes the existing broader regression suite)
- `npm.cmd run test:task:mysql` (explicit disposable MySQL fixtures only)

The numbering MySQL suite requires `TASK_NUMBER_TEST_DB_NAME`, DB_HOST, DB_PORT,
DB_USER, DB_PASSWORD (each prefixed `TASK_NUMBER_TEST_`) plus HOST_1_ID,
HOST_1_ADMIN_ID, HOST_1_ASSIGNEE_ID and corresponding HOST_2 variables.
Use two dedicated existing hosts with active field-app assignees/admins in an
already-migrated disposable test database, with no tasks or categories.

The migration MySQL suite separately requires
`TASK_CATEGORY_MIGRATION_TEST_DB_NAME`, DB_HOST, DB_PORT, DB_USER and DB_PASSWORD
(each with the same `TASK_CATEGORY_MIGRATION_TEST_` prefix). It refuses a non-empty
database and cleans up only its explicitly named fixture tables.

Neither suite may target the application database. The test database name must
contain a separate `test` component.

## Verification results

- TypeScript compilation passed.
- Focused category CRUD/HTTP, migration, numbering and support-authorization
  checks: 72 passed.
- Real MySQL 8.4.0 integration checks: 8 passed, none skipped. These exercised
  migration up/restart/down, generated uniqueness constraints, category CRUD,
  host isolation, simultaneous allocation, prefix edits racing allocation,
  counter rollback and actual unique-number collisions.
- The database checks used an isolated, loopback-only portable MySQL instance,
  not the configured application database. No application migration was run.
- Full task regression suite: 142 passed, 21 failed. An in-memory run of the
  original HEAD task code/tests reproduced the existing failures (102 passed,
  22 failed). The directly related creation HTTP fixture was updated for the
  current access-token/account-status contract; unrelated stale dashboard,
  Kanban and attachment-authentication tests were not repaired.
- ESLint on changed TypeScript reports one existing `no-control-regex` issue
  in the task service's attachment-filename sanitizer; no new category-code
  lint errors. The same sanitizer regex is present on original HEAD.
- Both Postman collections parse successfully and contain all six category
  endpoints, authenticated headers and updated creation examples.
