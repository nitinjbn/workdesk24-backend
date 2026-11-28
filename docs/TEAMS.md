# Teams, memberships and assignment rules

Teams are functional groups, independent of reporting managers. A user may
belong to multiple teams. Membership does not grant any assignment permission.
This phase does not change customers, Visit Plans, login, sync or employee lists.

Phase 3 adds rule storage and admin management only. Phase 4 evaluates rules
through the eligible-users API; neither phase changes assignment authorization.

## Deployment

Back up the database, then run `npm run db:migrate` before deploying the new
application. The migration `20261128090000-create-team-tables.js` creates only
`wd_teams` and `wd_team_members`; it does not backfill or update existing records.
MySQL 8+ is required. DDL implicitly commits, so schema steps are restartable.
Automatic destructive rollback is deliberately unsupported; rolling back the
application can leave these additive tables intact.

Identifiers are BIGINT, timestamps are UNIX seconds and flags are numeric 0/1.
Teams use `isDeleted` and `deletedAt` for soft deletion. Non-deleted team names
are case-insensitively unique per host using a generated `activeTeamName` column,
following Task Tags. Disabled teams still reserve their name; deleted names may
be reused. The generated column is managed by the migration, not Sequelize sync.

Memberships have a unique `(hostId, teamId, userId)` constraint and no deletion
lifecycle columns. Removal disables the existing row. Adding a disabled member
reactivates the same row, preserving its ID and original creation time.
Deleting a team leaves its membership rows unchanged and inaccessible through
these APIs. Recreating a deleted team does not inherit the old memberships.

Foreign keys use RESTRICT on delete and CASCADE on update. Services validate
that referenced users and teams belong to the authenticated host. User status
and field-app access do not limit administrative membership management; deleted
users cannot be added, but existing memberships can still be disabled.

## Admin API

All requests are POST under `/api/v1/admin/teams`, with the existing admin
JWT/cookie authentication and CSRF protection. `hostId` in the body is ignored.
The current switched-session host is authoritative. Read-only support sessions
can list/detail teams and list members, but cannot mutate them.

| Endpoint | Request fields | Response `data` |
| --- | --- | --- |
| `/create` | `teamName`, optional `isEnabled` (default 1) | `{ team }` |
| `/list` | optional `search`, `page` (default 1), `limit` (default 10, maximum 100) | `{ teams, pagination }` |
| `/detail` | `teamId` | `{ team, members }` |
| `/update` | `teamId`, at least one of `teamName`, `isEnabled` | `{ team }` |
| `/delete` | `teamId` | `{ teamId }` |
| `/members/list` | `teamId` | `{ members }` |
| `/members/add` | `teamId`, `userId` (single ID or array) | `{ member }` for single ID; `{ members }` for array |
| `/members/update` | `teamId`, `userId` (single ID or array), `isEnabled` | `{ member }` for single ID; `{ members }` for array |
| `/members/remove` | `teamId`, `userId` (single ID or array) | `{ member }` for single ID; `{ members }` for array |

Names are trimmed and must contain 1-100 characters. IDs accept positive safe
integers or their decimal string representation. Flags accept only numeric 0/1.
Membership identity is the team/user pair; updates cannot rebind either
identifier or the host. Member lists include enabled and disabled rows and a
minimal host-scoped `user` summary. Team lists exclude deleted teams and use
stable name/ID ordering.

Membership mutations accept either `"userId": 42` or `"userId": [42, 43]`.
Arrays must be non-empty and every element must pass the existing positive ID
validation. Repeated IDs are processed once; array results are ordered by user ID
ascending, including one-element arrays. A batch uses one transaction: any
invalid/foreign user, missing membership, enabled duplicate on add, or write
failure rejects the entire batch without partial changes. Update applies the
same numeric `isEnabled` flag to every selected membership. Single-ID response
shapes remain unchanged.

Member errors identify the affected same-host user by database name only:
`Alice is already a member of this team` on add, or
`Team membership not found for Alice` on update/remove.
Unknown or cross-host users receive a generic message, without
exposing another host's user name. User IDs are not included in these messages.
Error codes/statuses and atomic batch
behavior remain unchanged.

Responses use `{ success, message, data }`. Pagination contains
`total`, `page`, `limit`, `totalPages`. Unknown, deleted or foreign-host teams
return 404; foreign-host users return 404. Duplicate active membership returns
409 `TEAM_MEMBER_EXISTS`; duplicate non-deleted team name returns 409
`TEAM_NAME_EXISTS`. Invalid fields return 400. Persistence failures propagate
through the existing error handler; failed mutations roll back.

Examples and authenticated request headers are in
[Workdesk24_API_v3.postman_collection.json](../Workdesk24_API_v3.postman_collection.json).

## Validation

- `npm run test:teams`: focused service, repository, HTTP contract and migration checks.
- `npm run test:teams:mysql`: real migration and persistence checks against an
  isolated MySQL instance. Set `TEAM_TEST_MYSQL_SOCKET` to its socket; without it,
  the test is skipped. It creates/drops only a uniquely named test database.
- `npm run build`: TypeScript build.

Do not run migrations against a shared/live database just to validate this phase.

## Assignment rules (Phase 3)

Apply `20261128100000-create-team-assignment-rules.js` after the Phase 2 migration,
using `npm run db:migrate` before deploying rule-enabled code. It creates only
`wd_team_assignment_rules`, with BIGINT IDs and UNIX-second timestamps, numeric
flags, and host/source/target foreign keys. It is restartable after partial MySQL
DDL execution; automatic destructive rollback is unsupported.

The unique key is `(hostId, sourceTeamId, targetTeamId)`, including deleted rows.
Source and target are not individually unique. Same-team, multiple-target,
multiple-source and reciprocal rules are supported. The three permission flags
are independent and default to 0; an all-zero rule is valid. New rules default to
`isEnabled = 1`. There is no hierarchy or transitive evaluation.

All four POST endpoints are under `/api/v1/admin/teams/assignment-rules`, sharing
the existing team/admin authentication, CSRF and switched-session policies.
The authenticated host is authoritative; body `hostId` is ignored.

| Endpoint | Request fields | Response `data` |
| --- | --- | --- |
| `/create` | `sourceTeamId`, `targetTeamId`, optional permission flags | `{ rule }` |
| `/list` | optional `sourceTeamId`, `isEnabled` | `{ rules }` |
| `/update` | `ruleId`, at least one permission flag or `isEnabled` | `{ rule }` |
| `/delete` | `ruleId` | `{ ruleId }` |

Permission fields are `allowCustomerAssignment`, `allowScheduleVisit` and
`allowRescheduleVisit`. All flags accept only numeric 0/1. IDs use the same
positive safe-integer validation as teams. Creation validates non-deleted teams
in the authenticated host, including disabled teams. Each team is locked once
in ID order; concurrent additions cannot insert duplicate pairs.

Update rejects supplied `sourceTeamId`/`targetTeamId` rather than silently
rebinding a rule. Creation does not accept `isEnabled`; use update to disable
a rule. Updates change only supplied flags and preserve all other permissions.

List excludes deleted rules, includes disabled rules by default, and returns
`sourceTeamName`/`targetTeamName` plus minimal `sourceTeam`/`targetTeam` summaries.
`isEnabled: 1` filters out disabled rules. This is an admin storage filter,
**not eligibility calculation**. Parent team summaries retain their enabled and
deleted status so rules remain manageable after a team is soft-deleted.

Deletion uses `isDeleted`, `deletedAt` and `isEnabled = 0`; no row is physically
deleted. Creating the same pair after deletion restores its existing row and ID,
preserves `createdAt`, and resets permissions to the new request (omitted flags
default to 0). Creating a duplicate non-deleted rule, even if disabled, returns
409 `TEAM_ASSIGNMENT_RULE_EXISTS`; re-enable it through update instead.

Unknown/foreign-host rules return 404 `TEAM_ASSIGNMENT_RULE_NOT_FOUND`.
Unknown/deleted/foreign-host teams on create return 404 `TEAM_NOT_FOUND`.
Read-only support sessions may list rules but cannot create, update or delete.

- `npm run test:team-rules`: focused behavior, HTTP, migration and support checks.
- `npm run test:team-rules:mysql`: real migration/persistence checks on a private
  MySQL instance selected by `TEAM_TEST_MYSQL_SOCKET`; skipped if unset.

## Eligible users (Phase 4)

`POST /api/v1/app/teams/getEligibleUsers` uses the existing app JWT authentication.
Actor and host are derived from the authenticated user; body `hostId`, `userId`
or `actorId` cannot override them. No new migration is required.

Request fields:

- `action` (required): exactly `CUSTOMER_ASSIGNMENT`, `SCHEDULE_VISIT` or
  `RESCHEDULE_VISIT`, mapped respectively to `allowCustomerAssignment`,
  `allowScheduleVisit` and `allowRescheduleVisit`.
- `search` (optional): name search, at most 100 characters, trimmed.
- `page` and `limit` (optional): supplying either enables pagination, with
  defaults of page 1 and limit 10 (maximum 100). Omitting both returns all
  eligible users without pagination metadata.

IDs/pagination use positive safe integers or decimal strings. Unsupported
actions and invalid inputs use the existing 400 `VALIDATION_ERROR` response.

```json
{
  "action": "SCHEDULE_VISIT",
  "search": "Alice",
  "page": 1,
  "limit": 10
}
```

```json
{
  "success": true,
  "message": "Eligible users retrieved successfully",
  "data": {
    "users": [{ "userId": 11, "name": "Adam" }, { "userId": 22, "name": "Alice" }],
    "pagination": { "total": 2, "page": 1, "limit": 10, "totalPages": 1 }
  }
}
```

The reusable `AssignmentEligibilityService.getEligibleUsers` delegates to one
eligibility query in the existing rule repository. Database-level `EXISTS`
combines active source memberships, direct enabled rules and active target
memberships using OR logic. Teams on both sides must be enabled/non-deleted;
memberships must be enabled; rules must be enabled/non-deleted and grant the
requested permission. All joins enforce matching host ownership.

The authenticated actor is always included in the database candidate set for all
three actions, using their actual database ID and name. Self-eligibility does not
require a team, rule, search match or field-app access. Other targets must be
active/non-deleted users in the host; visit actions also require
`isFieldAppUser = 1` for those targets.
Users are deduplicated before database pagination and ordered by name ascending,
then ID. The actor is sorted alongside everyone else, not pinned first.
Membership in an unrelated team does not disqualify an otherwise eligible user.
Other same-team users require a matching permission; no admin,
missing-configuration or transitive fallback grants access to other users.

Without other matches, an unpaged response contains only the authenticated actor.
When pagination is supplied it applies normally to the combined distinct set,
so the actor appears on the page containing their name; totals include them once.
Search filters other eligible users but never filters the actor. This phase
does not integrate the service into any customer or Visit Plan operation and
does not change existing admin overrides, visibility, login, refresh or sync.

- `npm run test:team-eligibility`: focused SQL/business and authenticated API tests.
- `npm run test:team-eligibility:mysql`: checks the actual query on private MySQL,
  using `TEAM_TEST_MYSQL_SOCKET`; skipped if unset.

## Phase 6: Visit Plan enforcement

Existing authenticated POST write endpoints now enforce team eligibility:

- `/api/v1/app/visits/schedule`: `SCHEDULE_VISIT` for the resolved assignee.
- `/api/v1/app/visits/reschedule`: `RESCHEDULE_VISIT` for the selected assignee,
  including the current assignee when `assignedUserId` is omitted.
- `/api/v1/app/visits/reschedule/execute-v2`: `RESCHEDULE_VISIT` before a
  revision-valid mutation, even when the assignee is unchanged.

The actor is always eligible for self-assignment; field-app access is required
only for other assignees. Host Admin retains the existing organization-wide team
permission override. Neither exception bypasses authenticated host scope, active
user validation or existing customer/visit access checks.

The Phase 4 service also offers an internal `isUserEligible` method which applies
the same SQL eligibility to one target user within the caller's transaction.
No host user list is loaded for enforcement, and the app eligible-user list
contract and its lack of an admin fallback are unchanged.

When the existing locked customer-assignment helper is about to add an assignee
to a restricted customer's assigned-user list, it additionally requires
`CUSTOMER_ASSIGNMENT`. Open customers stay open; existing assignments are kept.
No customer permission is checked when no assignment is added, including an
unchanged reschedule assignee. Self and Host Admin exceptions also apply here.

Permission denials return HTTP 403 with `code: TEAM_ASSIGNMENT_FORBIDDEN` using
the existing error envelope; no visit, assignment, history or operation result
is committed. V2 revision/status rejections retain their existing recorded
outcomes. Successful idempotent replays return their saved result without
reapplying team permission checks or repeating side effects, but still require
the existing authenticated owner/key and customer access checks.

`/api/v1/app/visits/reschedule/prepare-v2` remains a read-only revision lookup.
Its output is not authorization to mutate: execute-v2 checks the selected
assignee. Existing reschedule access is customer-scoped, rather than requiring
the actor to be the current assignee; that behavior is preserved. Self-eligibility
does not open an otherwise inaccessible customer or visit.

No schema migration, general customer API, offline sync, login/refresh response,
Android, cancellation or completion changes are part of Phase 6.
