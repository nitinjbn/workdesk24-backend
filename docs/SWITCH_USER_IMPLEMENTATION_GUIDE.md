# Switch User: Plain-Language Implementation Guide

This guide describes the implementation as it exists on 2026-10-31. It explains the
behavior; it is not a script to run migrations or modify production data.

## 1. The Main Idea

Despite the API name `switchUser`, this feature switches the **working company**, not
the person who is logged in. In this backend, a company/tenant is called a **host**.

Imagine this example:

- Nitin is Super Admin user `81`, belonging to original host `5`.
- Customer A is host `42`.
- Customer B is host `99`.
- Nitin opens Customer A's Admin portal to provide support.

The backend still knows the person is user `81`. It gives that person a separate
support session whose current host is `42`. No Customer A employee is logged in,
no customer's password is needed, and `wd_users.hostId` is not changed.

Later, Nitin can change the current host to `99` without changing his identity.

**Remember: original user = who is acting; current host = whose data they may access.**

## 2. Small Glossary

| Term | Simple meaning |
| --- | --- |
| Host | One company/tenant and its data boundary. |
| Source session | The original Super Admin login that authorizes support access. |
| Handoff | A one-time ticket used to enter the Admin support flow. It lasts 60 seconds. |
| Switch session | A database record saying who is providing support and which host is current. |
| Access token | A signed JWT used to authenticate protected API requests. |
| Refresh token | A signed JWT used to obtain replacement access/refresh credentials. |
| Token hash | SHA-256 fingerprint of a secret; the database stores the fingerprint, not the secret itself. |
| Token family | A random group ID connecting successive refresh tokens from one login/session. |
| Context version | A counter identifying the current generation of support credentials. |
| CSRF token | A random value sent in a header and compared with a browser cookie. |
| Cookie | Browser-managed storage sent automatically to matching backend paths. |
| Transaction | A group of database changes that succeed together or are rolled back together. |
| Row lock | Makes conflicting operations wait rather than changing the same record at once. |
| Replay | Reusing a refresh credential that has already been replaced or revoked. |

These identifiers are different: a JWT's `sessionId`, a database `switchSessionId`,
a refresh JWT's `jti`, and a `tokenFamily` are not interchangeable.

## 3. The Whole Journey

```mermaid
sequenceDiagram
    participant UI as Browser frontend
    participant API as Backend
    participant DB as MySQL
    UI->>API: Super Admin login
    API->>DB: Save source refresh-token fingerprint
    API-->>UI: Source cookies and Super Admin CSRF
    UI->>API: POST /api/v1/superadmin/switchUser/handoff
    API->>DB: Save one-time handoff fingerprint
    API-->>UI: Handoff cookies and handoff CSRF
    UI->>API: POST /api/v1/admin/switchUser with hostId 42
    API->>DB: Consume ticket, create support session and audit
    API-->>UI: Admin support cookies, host 42, mode, Admin CSRF
    UI->>API: Protected Admin request
    API->>DB: Validate support session, source family and selected host
    API-->>UI: Host 42 data only
    UI->>API: POST /api/v1/admin/switchUser with hostId 99
    API->>DB: Replace support credentials, change host, append audit
    API-->>UI: Updated cookies, host 99 and newer version
    UI->>API: POST /api/v1/admin/logout
    API->>DB: End support session, revoke support family, append audit
    API-->>UI: Clear Admin cookies; source login remains separate
```

### Step A: Original Super Admin Login

`POST /api/v1/superadmin/login` uses the existing email/password login flow.
The account must be an active Super Admin. The browser receives Super Admin
access/refresh cookies and a CSRF value. The source refresh record lives in
`wd_user_refresh_tokens`, not a separate new Super Admin token table.

The original login remains separate from the support login. Its refresh family is
the parent authorization that the support session depends on.

### Step B: Issue the Handoff Ticket

`POST /api/v1/superadmin/switchUser/handoff`, body `{}`:

1. Verify the Super Admin access token and Super Admin CSRF.
2. Verify the source refresh JWT and its stored fingerprint.
3. Check its user, host, family, WEB device type, expiry and revocation state.
4. Check that the account is active and still has `isSuperAdmin = 1`.
5. Generate 32 random bytes, represented as a 64-character hex handoff secret.
6. Save its SHA-256 fingerprint in `wd_admin_switch_handoffs` with a 60-second expiry.
7. Set a handoff cookie and a separate handoff-CSRF cookie.

The response is `{ success: true, message: "Switch handoff created", data: { csrfToken } }`.
The handoff secret is **not** returned in JSON or put in a URL.

Why the extra ticket? Super Admin cookies are scoped to `/api/v1/superadmin`, while
Admin cookies are scoped to `/api/v1/admin`. The ticket provides a narrow, short-lived
bridge between those authentication flows. It does not copy the Super Admin cookie
or give every Admin endpoint permission to use it.

### Step C: Consume the Ticket and Enter a Host

`POST /api/v1/admin/switchUser`, body `{ "hostId": 42 }`:

1. The browser sends the handoff cookie and the frontend sends handoff CSRF.
2. The service requires a positive safe-integer number for `hostId`, not a string.
3. It hashes the ticket and locks its database row.
4. It rejects expired, already-consumed, deleted or unknown tickets.
5. It rechecks the source refresh family and original Super Admin account.
6. It checks that host `42` exists, is active and is not deleted.
7. It determines full or read-only support access from that host's subscription.
8. It sets `consumedAt`, creates a switch session and a separate support token family.
9. It saves the support refresh fingerprint and a `SWITCH` audit row.
10. It returns host/session context, sets Admin cookies and clears handoff cookies.

The database changes happen in one transaction. A failed transaction does not leave
a successfully consumed ticket without its corresponding support session.
The ticket can successfully create a session only once. It is not used for every request.

### Step D: Use the Admin APIs

Protected Admin requests pass through authentication middleware. For a support JWT,
the middleware checks the database rather than trusting a client-provided host ID:

- The JWT signature, expiry and access-token type are valid.
- Its switch session is active, not deleted and belongs to the original user.
- Its context version matches the database version.
- The original account remains active and remains Super Admin.
- The source refresh family still has an unrevoked, unexpired WEB record.
- The current host remains active and available.

It then sets `req.user.id` to the original user ID but sets request-local
`req.user.hostId` to the selected host. It also sets trusted `req.authContext`.
That request-local change does **not** update the actual user's database row.

For support requests, supplied `hostId` values in the JSON body, nested objects and
arrays are overwritten with the trusted current host. An existing query-string
`hostId` is also overwritten. Upload routes repeat this scoping **after Multer**,
because multipart fields are parsed later. Media paths and media metadata use the
trusted host too. Resource ownership must still be checked by the service/repository.

The `switchUser` request itself is the exception: its body host ID is the requested
new target, so it is validated rather than overwritten with the old host.

Support credentials are for Admin routes. They are rejected by the App and
Super Admin authentication/refresh paths; they are not credentials for the source login.

### Step E: Switch from A to B

Call the same `POST /api/v1/admin/switchUser`, now with `{ "hostId": 99 }` and
the latest Admin CSRF. No new handoff is needed for an existing support session.

The backend locks the active switch-session row, verifies its version and checks
the source login, original account and new host again. It then:

- Archives the old support refresh fingerprint with reason `HOST_SWITCHED`.
- Updates the existing support refresh row with a newly generated credential.
- Changes `currentHostId` from `42` to `99`.
- Increases `contextVersion`, for example from `1` to `2`.
- Appends a `SWITCH` audit from host `42` to host `99`.
- Replaces the browser's Admin cookies and CSRF value.

The `switchSessionId`, original user, original host, source family, support family
and support device ID stay the same. The refresh row's numeric ID normally stays
the same too: rotation replaces its contents, not the row itself.

An older access token has the old version and is rejected, even if its JWT expiry
has not been reached. Sending the same host again is not a special no-op in this
implementation: a successful switch still replaces credentials and records an event.

### Step F: Refresh Without Changing Hosts

`POST /api/v1/admin/refresh`, body `{}`, latest Admin CSRF and refresh cookie:

The backend locks the support session, rechecks source/account/host eligibility,
archives the old refresh fingerprint with reason `ROTATED`, replaces the current
refresh record, and increments the context version. The host does not change.
The response includes the original user, selected host, access mode, subscription
summary, permissions, new CSRF and switch session/version.

**A refresh increments the version too. It is not only a count of host switches.**
Normal successful refreshes do not create `SWITCH` audit events; the replaced-token
history provides their credential trail.

### Step G: Exit Support or Log Out the Source

`POST /api/v1/admin/logout` ends the support session when given valid current
support credentials. It sets `isActive = 0`, fills `endedAt`, revokes the support
refresh family, appends `SESSION_TERMINATED`, and clears Admin cookies. A valid
current support access token can be used as a fallback if the refresh cookie is
missing/invalid. The Admin CSRF check still applies.

`POST /api/v1/superadmin/logout` revokes the valid source refresh family and ends
its linked active support sessions. It does not intentionally revoke another
device's unrelated source family just because the user ID is the same.
The source record receives reason `LOGOUT`; linked support refresh records receive
`SOURCE_SESSION_LOGOUT`. Missing/invalid source refresh credentials do not guarantee
that this endpoint updates database state; clearing browser cookies alone is not
the same thing as successfully revoking a database session.

Source revocation or expiry also causes future support requests to fail. During
support refresh, a lost source, inactive account or ineligible host ends the support
session through the termination helper. A rejected ordinary request does not
necessarily update the session row or append an audit by itself.

## 4. Cookies: Which One Is Used Where?

These are default names; ordinary Admin/Super Admin names can be environment-configured.

| Cookie | Backend path | Role |
| --- | --- | --- |
| `wd24_super_admin_access_token` | `/api/v1/superadmin` | Authenticate the original Super Admin API calls. |
| `wd24_super_admin_refresh_token` | `/api/v1/superadmin` | Refresh the source login and prove it is active when issuing a handoff. |
| `wd24_super_admin_csrf` | `/api/v1/superadmin` | Compare with the Super Admin `x-csrf-token` header. |
| `wd24_admin_switch_handoff` | `/api/v1/admin/switchUser` | One-time entry secret, 60 seconds, HttpOnly. |
| `wd24_admin_switch_handoff_csrf` | `/api/v1/admin/switchUser` | CSRF for consuming that ticket, 60 seconds. |
| `wd24_admin_access_token` | `/api/v1/admin` | Authenticate Admin support requests after entry. |
| `wd24_admin_refresh_token` | `/api/v1/admin` | Refresh the separate support login. |
| `wd24_admin_csrf` | `/api/v1/admin` | Compare with the Admin `x-csrf-token` header. |

Access/refresh cookies are HttpOnly. CSRF cookies are not HttpOnly, but JavaScript
on a separate frontend origin or a nonmatching path cannot necessarily read them.
Use response CSRF values and a deliberate reload/bootstrap strategy. Cookie lifetime
and JWT expiry are separate settings; an existing cookie is not proof of valid login.

The frontend sends credentials on every call. It uses Super Admin CSRF for handoff
issuance, handoff CSRF for first entry, then Admin CSRF for support operations.
Replace CSRF after every switch/refresh. Never store access/refresh/handoff secrets
in local storage or URLs.

## 5. The Five Core Tables

| Table | Easy way to remember it |
| --- | --- |
| `wd_admin_switch_handoffs` | One-time entry tickets. |
| `wd_admin_switch_sessions` | Current support state: who, which host, which version. |
| `wd_admin_host_switch_audits` | Permanent event notebook for switches and termination. |
| `wd_user_refresh_tokens` | Current refresh fingerprints for source and support logins. |
| `wd_user_refresh_token_history` | Previously replaced refresh fingerprints, used to detect reuse. |

All core time columns are UNIX timestamps in **seconds**, not JavaScript milliseconds.
`NULL` generally means not applicable/not recorded/not happened yet.
`isDeleted` is a soft-delete flag, distinct from `isActive` or `isRevoked`.

### wd_admin_switch_handoffs: Every Column

| Column | Meaning and actual use |
| --- | --- |
| `id` | Numeric database primary key for this ticket row. |
| `tokenHash` | SHA-256 fingerprint used to find the ticket when its secret arrives in the cookie. Unique; stored secret is not recoverable from this hash. |
| `userId` | Original Super Admin receiving the ticket; foreign key to `wd_users.id`. |
| `tokenFamily` | Source Super Admin refresh family, not the newly created support family. Used to recheck the source login at consumption. |
| `expiresAt` | Issuance time plus 60 seconds; an expired ticket cannot be consumed. |
| `consumedAt` | Initially null; filled when successful entry consumes the ticket. Stops a second consumption. |
| `createdAt` | Ticket creation time. |
| `updatedAt` | Initially creation time; updated when consumed. |
| `isDeleted` | Normally 0; repository lookup excludes rows marked deleted. |
| `deletedAt` | Optional soft-deletion time; the normal entry flow does not fill it. |

Unique hash index prevents duplicate ticket fingerprints. The user/family/expiry
index helps locate tickets by source session/expiry. It is not itself an automatic
cleanup job. Issuing a ticket does not select a host; the target is selected during consumption.

### wd_admin_switch_sessions: Every Column

| Column | Meaning and actual use |
| --- | --- |
| `id` | Numeric database primary key. Also provides a consistent ordering when locking several source-linked sessions. |
| `switchSessionId` | Unique UUID shared with support JWTs, refresh records, history and audit rows. It identifies the support session, not one JWT issuance. |
| `userId` | Original Super Admin ID; never a target host's employee. Foreign key to `wd_users.id`. |
| `originalHostId` | Original user's host at entry. Kept unchanged across host switches; foreign key to `wd_hosts.id`. |
| `sourceTokenFamily` | Parent/source Super Admin login family. It connects source logout/revocation to support-session invalidation. |
| `currentHostId` | Selected working host; changes when switching companies. This is the trusted data scope; foreign key to `wd_hosts.id`. |
| `tokenFamily` | Separate support refresh family. Kept across support refreshes and host changes; revoked when support ends/replay is detected. |
| `deviceId` | Generated `support-<uuid>` identifier separating support refresh storage from the source device/login. It is not the target employee's phone. |
| `currentRefreshTokenId` | Numeric ID of the current support refresh row. Logical pointer; this migration does not add a foreign key for it. Main validation also uses hash/family/session/version. |
| `contextVersion` | Starts at 1; increases on successful host changes and support refreshes. Old access credentials then fail the version check. |
| `isActive` | 1 while support is open; termination changes it to 0. Repository lookup requires 1. |
| `startedAt` | When the support session began; does not reset at every host switch. |
| `createdAt` | When this database row was created. |
| `updatedAt` | Latest update to support state, including refresh, host change or termination. |
| `endedAt` | Null while open; set by the termination helper. |
| `isDeleted` | Normally 0; active lookup excludes deleted rows. Logout uses `isActive`, not deletion. |
| `deletedAt` | Reserved soft-deletion timestamp; not the normal logout mechanism. |

There is no `expiresAt` or stored `accessMode` on this table. Validity also depends
on current JWT/refresh/source state. Access mode is recomputed from the selected
host's subscription rather than permanently copied into the session.

Indexes cover unique session UUID, user/active state, support family,
user/source-family/active state and current-host/active state. The source-family
index matters because a user may have different logins on different devices.

### wd_admin_host_switch_audits: Every Column

| Column | Meaning and actual use |
| --- | --- |
| `id` | Numeric primary key for one event. |
| `switchSessionId` | Support session involved; foreign key to its unique session UUID. |
| `originalUserId` | Person who actually performed the support action; foreign key to `wd_users.id`. |
| `originalHostId` | Original identity's host, not the selected customer; foreign key to `wd_hosts.id`. |
| `previousHostId` | Null on first entry; old host on later switches; current host when terminated. Optional host foreign key. |
| `newHostId` | Entered host for a switch; null for termination. Optional host foreign key. |
| `eventType` | `SWITCH` or `SESSION_TERMINATED`. There is no separate refresh event type. |
| `contextVersion` | Support version when the event occurred, allowing correlation with state/history. |
| `requestIp` | Captured request IP for switch events; current termination helper does not pass it. Optional diagnostic data, not proof of identity. |
| `userAgent` | Captured browser/client header for switch events; current termination helper does not pass it. Client-supplied diagnostic data. |
| `createdAt` | When the event was recorded. |
| `updatedAt` | Filled at insertion for schema consistency. Not a field to edit afterward. |
| `isDeleted` | Stored as 0. Do not soft-delete audit rows through UPDATE. |
| `deletedAt` | Normally null. Its presence does not authorize deletion of an audit. |

An audit row is append-only: model hooks reject instance/bulk UPDATE and DELETE,
and database triggers reject ordinary SQL UPDATE and DELETE too. New events are
inserted; old events are not rewritten. This is not protection against a privileged
database administrator dropping triggers/tables or performing other DDL. Limit DB privileges.

Indexes support session/time, actor/time and destination-host/time searches.
The row records the transition, not every Admin request or every edited resource.
Termination reason is passed into refresh revocation state; there is no dedicated
`reason` column on this audit table. Broader API logging is a separate system.

### wd_user_refresh_tokens: Every Column

This shared table supports normal Admin, Super Admin and App authentication too.
Support is identified by the additional session/version fields, not by another table.

| Column | Meaning and actual use |
| --- | --- |
| `id` | Numeric primary key. Normally stable while this device/session's token is replaced. |
| `hostId` | Identity host of the login. For source and support rows in the example, this is 5, not current customer 42/99. |
| `userId` | Original logged-in user, 81 in the example. |
| `tokenHash` | Current refresh JWT's SHA-256 fingerprint. Unique; supplied JWT is hashed and matched to this row. Column allows 128 characters, while current SHA-256 hex hashes use 64. |
| `tokenFamily` | Group of successive refresh credentials for this login. Source family and support family are different. |
| `deviceType` | `WEB`, `ANDROID` or `IOS`. This source/support flow uses WEB. |
| `deviceId` | Source login's device ID, or a generated support device ID. Together with host/user, identifies the current device row. |
| `deviceName` | Optional client device label; support generation does not require it. |
| `appVersion` | Optional app version; not the switch context version. |
| `expiresAt` | Expiry taken from the signed refresh JWT's `exp`. Checked before accepting/rotating credentials. |
| `lastUsedAt` | Optional usage metadata; do not assume every support call updates it. |
| `createdAt` | Timestamp written for the current stored credential. Replacement data can refresh this value even when the row ID stays the same. |
| `updatedAt` | Timestamp of current row mutation; model hooks also maintain it. |
| `replacedByTokenHash` | Replacement-fingerprint field. Normal successful rotation clears it on the live row; the old-to-new link is retained in history. |
| `isRevoked` | 0 for usable current credentials; 1 after revocation. Expiry and other checks still apply when it is 0. |
| `revokedReason` | Optional reason, such as `REUSE_DETECTED`, `EXPIRED` or a support termination reason. Cleared for a successfully replaced current credential. |
| `revokedAt` | Revocation time, or null for an active replacement. |
| `switchSessionId` | Support-session UUID; null for ordinary source/Admin/App logins. Logical link, not a foreign key in the supplied migration. |
| `contextVersion` | Support credential generation, or null for ordinary logins. Used to check expected support context during replacement. |

Unique `(hostId, userId, deviceId)` means one current row for that identity/device
combination. Unique `tokenHash` means one current owner per fingerprint. Other
indexes cover host, user, family, expiry, revocation and switch-session lookup.
These refresh host/user identifiers are logical references; the supplied creation
migration does not add foreign keys for them.

### wd_user_refresh_token_history: Every Column

| Column | Meaning and actual use |
| --- | --- |
| `id` | Numeric primary key for one archived credential. |
| `refreshTokenId` | Current-table row ID from which the snapshot was archived. Many history rows can refer to the same stable current row. No foreign key is added by this migration. |
| `hostId` | Archived credential's identity host, not the switched customer. |
| `userId` | Archived credential's user. |
| `tokenHash` | Previous refresh fingerprint. Unique and used to recognize an already-replaced credential. |
| `tokenFamily` | Family to revoke if this old credential is reused. |
| `deviceType` | Archived device channel. |
| `deviceId` | Archived device/session storage identity. |
| `expiresAt` | Previous credential's original expiry. |
| `createdAt` | Copied from the previous current credential's creation timestamp, not necessarily archive insertion time. |
| `updatedAt` | Archive/replacement time in the current repository implementation. |
| `revokedAt` | When the old credential was replaced/archived. |
| `replacedByTokenHash` | Fingerprint of its replacement; links successive generations without storing their raw secrets. |
| `revokedReason` | Why it was archived, e.g. `ROTATED`, `HOST_SWITCHED` or `REPLACED_BY_LOGIN`. |
| `isDeleted` | Normally 0. Replay lookup excludes deleted history, so deletion weakens retained reuse evidence. |
| `deletedAt` | Optional soft-delete time; not populated during normal archive creation. |
| `switchSessionId` | Copied support UUID when applicable; otherwise null. |
| `contextVersion` | Version of the old support credential, not the new replacement's version. |

Indexes cover unique old hash, originating refresh-row ID, user/family and support
session. History is retained by normal rotation. It does not have the audit table's
append-only database triggers; do not describe it as having the same enforcement.

## 6. An Example of Database State Changing

These values are illustrative labels, not real secrets or production rows.

| Moment | Handoff row | Switch-session row | Current refresh row | History/audit |
| --- | --- | --- | --- | --- |
| Source login | None | None | Source row: user 81, host 5, family SOURCE-A, no switch UUID | Source replacements may already have history. |
| Ticket issued | User 81, family SOURCE-A, expiry +60 seconds, consumedAt null | None | Source row unchanged | No switch audit yet. |
| Enter host 42 | consumedAt filled | UUID S1, user 81, original host 5, source SOURCE-A, support family SUPPORT-B, current host 42, version 1 | Separate row 200: host 5, support device, SUPPORT-B, S1, version 1 | SWITCH: null -> 42, version 1. |
| Refresh | No further ticket use | Same S1/host 42, version 2 | Same row 200, new fingerprint, version 2 | Old fingerprint archived at version 1; no normal SWITCH audit. |
| Switch to 99 | No new ticket needed | Same S1, current host 99, version 3 | Same row 200, new fingerprint, version 3 | Old fingerprint archived at version 2; SWITCH: 42 -> 99, version 3. |
| Exit support | Ticket stays consumed | S1 inactive, endedAt filled | Support family revoked | SESSION_TERMINATED: previous 99, new null. |

Refreshing SOURCE-A normally preserves that source family. Therefore the support
link survives a valid source refresh. Logging out/revoking SOURCE-A breaks it.

## 7. Other Tables Used or Created as Prerequisites

The schema reference contains **14 new/prerequisite tables**, not 14 different
security stages. Some tables only let existing models/login/reporting work on a
fresh schema. Creating such a table does not automatically make it part of ticket validation.

For existing large business tables below, this guide explains the fields relevant
to switching, not every unrelated business field. For all 14 new/prerequisite tables,
every column from the SQL reference is covered here or in the appendix.

### Existing Identity and Tenant Tables

- `wd_users`: `id` identifies the actor; `hostId` is their original company;
  `accountStatus` must remain ACTIVE; `isSuperAdmin` must remain 1. `roleId` identifies
  the user's normal role. `email`/`name` identify the actor in responses. Password
  validation belongs to the source login, not each switch. `isAdminUser` controls
  ordinary Admin login; established support has a trusted support-context path.
  `isFieldAppUser` does not turn a support token into an App credential.
- `wd_hosts`: `id` identifies the selected company; `isActive = 1` and `isDeleted = 0`
  are required for support. `subDomain` identifies its frontend tenant address, but
  the switch request selects numeric `hostId`; a URL/CORS match does not grant host access.
- `wd_roles`: the selected host's enabled, nondeleted `roleCode = 'ADMIN'` role is
  looked up using its `hostId` and `id` to build the permissions response.
- `wd_permissions`: permission definitions supply IDs, module names and action
  codes/names. These describe actions, not who is logged in.
- `wd_role_permissions`: grants connect a host/role with a permission and its enabled
  state. They provide the initial permission set.
- `wd_user_permissions`: overrides for the selected host and original user can
  replace permission enabled state. No target employee is selected for these checks.

The service merges role permissions with user overrides, filters enabled actions,
sorts them and groups them by module. If the selected host lacks a usable ADMIN
role, the built permission list is empty. The list is not a substitute for server
authorization. Trusted support paths in task/AI code preserve the original user;
read-only support still passes through the explicit route policy.

### Subscription Decision

`wd_host_settings` supplies the selected host's timezone/date formatting defaults.
The subscription lookup uses that timezone's current date. From
`wd_host_subscriptions`, the backend selects a nondeleted subscription whose
`planStartDate <= today <= planEndDate`, preferring the latest start date.

- Selected row enabled and paymentStatus PAID: `SUPPORT_FULL`.
- No current row, expired/future-only coverage, disabled row or other payment status:
  `SUPPORT_READ_ONLY`.
- Inactive/deleted/unavailable host: reject entry; it is not a read-only fallback.

The current query chooses the latest applicable row before checking enabled/payment
state; it does not search all overlapping rows for any paid row. Changes to this
selection policy require deliberate tests.

The returned `subscription` is a support summary, not the entire billing row:
`status`, `canUseApp`, `isReadOnly`, `canRenew`. For support, `canRenew` is false.
For read-only support, status is INACTIVE and canUseApp is false. This does not
mean that the original Super Admin identity has been disabled.

### Prerequisite Appendix: Every Remaining Table Column

#### wd_user_devices

Existing login/device bookkeeping; not the one-time ticket table. Support generation
uses its own generated device ID and directly saves a refresh record; it does not
create a target-host employee device entry as part of consuming the handoff.

| Column | Meaning |
| --- | --- |
| `id` | Numeric device-record primary key. |
| `hostId` | Device owner's identity host; host foreign key. |
| `userId` | Device owner; user foreign key. |
| `deviceId` | Client device identifier; host/user/device tuple is unique. |
| `deviceName` | Friendly device label. |
| `deviceModel` | Device model name. |
| `manufacturer` | Device manufacturer. |
| `brand` | Device brand. |
| `device` | Device/platform identifier reported by the client. |
| `product` | Client-reported product identifier. |
| `hardware` | Hardware description. |
| `osVersion` | Operating-system version. |
| `sdkInt` | Client SDK/API level. |
| `appVersion` | Application version. |
| `storageTotalBytes` | Reported total storage capacity. |
| `storageAvailableBytes` | Reported free storage capacity. |
| `storageUsedBytes` | Reported used storage capacity. |
| `isActive` | Device-record active flag; not switch-session validity by itself. |
| `sessionId` | Existing login/access-session bookkeeping ID; not the support session UUID. |
| `fcmToken` | Push-notification registration token; unrelated to access/refresh tokens. |
| `createdAt` | Device record creation timestamp. |
| `updatedAt` | Device record last update timestamp. |

#### wd_user_settings

General user preferences loaded by existing user/login paths; not ticket validation.

| Column | Meaning |
| --- | --- |
| `id` | Setting record primary key. |
| `userId` | User owning the setting; user foreign key. |
| `settingName` | Preference key. |
| `settingValue` | Preference value. |
| `isEnabled` | Whether the preference is enabled. |
| `createdAt` | Creation timestamp. |
| `updatedAt` | Last update timestamp. |
| `isDeleted` | Soft-delete flag. |
| `deletedAt` | Optional soft-delete timestamp. |

#### wd_user_permissions

| Column | Meaning |
| --- | --- |
| `id` | Override record primary key. |
| `hostId` | Host in which the override applies; host foreign key. |
| `userId` | User whose permission is overridden; user foreign key. |
| `permissionId` | Permission definition; permission foreign key. |
| `isEnabled` | Whether this override enables/disables the action. |
| `isDeleted` | Soft-delete flag for the override. |
| `createdAt` | Creation timestamp. |
| `updatedAt` | Last update timestamp. |
| `deletedAt` | Optional soft-delete timestamp. |

#### wd_attendance_sites

Existing geo-fencing/reporting prerequisite; not a handoff eligibility check.

| Column | Meaning |
| --- | --- |
| `id` | Attendance-site primary key. |
| `hostId` | Company owning the site; host foreign key. |
| `siteName` | Site label. |
| `latitude` | Site center latitude. |
| `longitude` | Site center longitude. |
| `radiusMeters` | Allowed geo-fence radius in meters. |
| `isEnabled` | Site enablement flag. |
| `createdAt` | Creation timestamp. |
| `updatedAt` | Last update timestamp. |
| `isDeleted` | Soft-delete flag. |
| `deletedAt` | Optional soft-delete timestamp. |

#### wd_user_attendance_sites

Existing mapping between employees and attendance sites; not an authentication ticket.

| Column | Meaning |
| --- | --- |
| `id` | Assignment primary key. |
| `userId` | Assigned user; user foreign key. |
| `attendanceSiteId` | Assigned site; attendance-site foreign key. |
| `isEnabled` | Assignment enablement flag. |
| `createdAt` | Creation timestamp. |
| `updatedAt` | Last update timestamp. |
| `isDeleted` | Soft-delete flag. |
| `deletedAt` | Optional soft-delete timestamp. |

#### wd_host_settings

| Column | Meaning |
| --- | --- |
| `id` | Host-setting primary key. |
| `hostId` | Company owning the setting; host foreign key. |
| `settingName` | Key such as timezone, dateTimeFormat, dateFormat or timeFormat. |
| `settingValue` | Configured value; application defaults apply when unavailable. |
| `isEnabled` | Settings lookup requires enabled rows. |
| `createdAt` | Creation timestamp; also helps choose the latest setting. |
| `updatedAt` | Update timestamp; lookup prefers newer values. |
| `isDeleted` | Settings lookup excludes soft-deleted rows. |
| `deletedAt` | Optional soft-delete timestamp. |

#### wd_subscription_cycles

Billing plan/cycle definitions. Required as the parent of subscription rows, but
support entitlement does not directly inspect every cycle price field.

| Column | Meaning |
| --- | --- |
| `id` | Cycle primary key referenced by subscriptions. |
| `cycleCode` | Plan/cycle code. |
| `cycleName` | Display name. |
| `validityInMonths` | Plan duration. |
| `perUserMonthlyPrice` | Monthly price per licensed user. |
| `perUserSetupPrice` | Setup price per licensed user. |
| `minimumUsers` | Minimum licensed-user count for the cycle. |
| `isPopular` | Billing UI popular-plan marker. |
| `remarks` | Optional plan notes. |
| `sortOrder` | Plan display ordering. |
| `isEnabled` | Cycle enablement flag. |
| `isDeleted` | Soft-delete flag. |
| `createdAt` | Creation timestamp. |
| `updatedAt` | Last update timestamp. |
| `deletedAt` | Optional soft-delete timestamp. |

#### wd_host_subscriptions

| Column | Meaning |
| --- | --- |
| `id` | Purchased subscription primary key. |
| `hostId` | Subscribed company; host foreign key and lookup scope. |
| `subscriptionCycleId` | Purchased cycle; subscription-cycle foreign key. |
| `licensedUserCount` | Licensed seats; used by other eligibility/business checks, not the support full/read-only decision. |
| `validityInMonths` | Purchased duration snapshot. |
| `perUserMonthlyPrice` | Purchased monthly unit-price snapshot. |
| `perUserSetupPrice` | Purchased setup unit-price snapshot. |
| `discountType` | PERCENTAGE/FIXED discount type, if any. |
| `discountValue` | Configured discount value. |
| `grossAmount` | Amount before discounts. |
| `discountAmount` | Calculated discount amount. |
| `netAmount` | Amount after discounts. |
| `planStartDate` | Inclusive coverage start; existing DATE column, not UNIX seconds. |
| `planEndDate` | Inclusive coverage end; existing DATE column, not UNIX seconds. |
| `paymentStatus` | FREE/PENDING/PAID; current support policy requires PAID for full access. |
| `paymentReference` | Optional billing/payment reference. |
| `remarks` | Optional purchase notes. |
| `isEnabled` | Selected subscription must be enabled for full support. |
| `isDeleted` | Subscription lookup excludes deleted rows. |
| `createdAt` | Creation UNIX timestamp. |
| `updatedAt` | Last update UNIX timestamp. |
| `deletedAt` | Optional soft-delete UNIX timestamp. |

#### wd_migration_object_ownership

Migration bookkeeping only. This table is not consulted to allow a browser request.

| Column | Meaning |
| --- | --- |
| `id` | Ownership-marker primary key. |
| `migrationName` | Migration that actually created an object. |
| `objectName` | Created database object name, currently used for the refresh table. |
| `createdAt` | When the ownership marker was written. |

The unique migration/object pair avoids duplicate markers. The refresh-table
rollback uses ownership to avoid dropping a pre-existing table, and refuses to
drop a populated owned table. Manual CREATE from the SQL reference does not make
the migrations own that object automatically.

### Why the Other ALTER Statements Exist

The host/user alignment migrations repair older fresh-install definitions so the
current models can be read. They are not instructions to move an identity into
another tenant.

| Added/aligned fields | Purpose |
| --- | --- |
| Host `subDomain` | Tenant address identifier; missing values get a legacy-ID fallback before NOT NULL/unique enforcement. |
| Host `callingCode`, `landmark`, `countryName`, `countryIsoCode`, `stateName`, `stateIsoCode`, `district`, `pinCode` | Contact/address model compatibility; optional legacy address backfills preserve existing data. |
| User `designationId`, `employeeCode` | Employee organization identifiers. |
| User `enteredMobileNumber`, `callingCode`, `mobileVerified`, `mobileVerifiedAt` | Phone entry/verification fields. |
| User `dateOfBirth`, `gender` | User profile fields. |
| User `accountStatus`, `accountStatusUpdatedAt` | Authentication account state and its timestamp. |
| User `addressLine1`, `addressLine2`, `landmark`, `countryName`, `countryIsoCode`, `stateName`, `stateIsoCode`, `city`, `district`, `pinCode` | User address compatibility. |
| User `timezone` | User timezone preference; selected-host subscription checks use host settings. |
| User `holidayCalendarId`, `leavePolicyId` | Existing leave configuration references. |
| User `isFieldAppUser`, `isAdminUser`, `isSuperAdmin` | Channel/privilege flags; switching requires the original Super Admin flag. |
| Attendance `attendanceLocation`, `dayoverLocation` | Human-readable attendance/day-end locations; not authentication state. |

Admin-flag/account-status backfills only run for the matching newly-added-field
case. They must not blindly overwrite existing live authorization flags.

## 8. Full Support vs Read-Only Support

Full mode allows the normal supported Admin workflows, still subject to applicable
resource, validation and authorization checks. It is not permission to read another
host by changing the request body.

Read-only mode uses an explicit backend allowlist. Because this project uses POST
for reads too, the HTTP verb cannot decide whether an action is safe. Supported
query routes include dashboard reads, user/customer/product reads, selected reports,
task reads, leave reads and specific AI Insights queries. Unclassified routes are
denied by default with `403 SUPPORT_READ_ONLY`, even if a frontend calls them a read.
The exact maintained list is in
[support-access.middleware.ts](../src/shared/middleware/support-access.middleware.ts).

The frontend should disable edits/uploads/deletes/approvals, but the server policy
is what actually enforces the restriction. Do not route read-only support users to
subscription renewal just because the summary says INACTIVE.

## 9. Why Replay Protection and Locks Matter

Two requests might arrive at almost the same time. MySQL row locks serialize the
conflicting handoff/session/refresh mutations. Transactions keep session changes,
refresh replacement and required audits consistent.

After successful refresh, the old fingerprint moves to history. If it is presented
again, the backend recognizes it rather than accepting it as a new login. The
repository revokes its family; support refresh also terminates the support session
and commits its termination audit before reporting the replay error.

Two simultaneous refresh calls with the same token are not two valid rotations.
One may succeed and the next may be treated as replay, revoking the family. This
strict behavior is deliberate. Frontend refresh must be single-flight across tabs,
and coordinated with host switches/logout. Do not add blind retries on timeouts.

Refresh JWTs include a unique `jti`. This makes two separately generated refresh
tokens different even when their other claims and issuance second are identical.
`jti` is a JWT claim; it is not a new database column or the token-family ID.

## 10. Frontend Responsibilities

1. Keep normal Admin login intact and source Super Admin state separate.
2. Use handoff -> switchUser for first entry; use switchUser directly afterward.
3. Store response user, selected host, mode, switch UUID/version and CSRF as context.
4. Use response `host.id`, not response `user.hostId`, as the active tenant.
5. Allow an established support session in route guards without requiring the
   original user's ordinary Admin flag.
6. Clear old-host query caches/forms/uploads and ignore old in-flight responses.
   Never replay an old-host write against the newly selected company.
7. Refresh/replace context atomically; synchronize tabs because browser cookies are shared.
   Tabs cannot independently remain on different support hosts using these same cookies.
8. Show original actor, selected company and full/read-only status. Exit support
   calls Admin logout; source logout is a separate action.
9. Recover CSRF deliberately on reload; do not repeatedly refresh with an invalid CSRF value.

Current response caveat: the switch service computes permissions, but the
`switchUser` controller does not currently include `permissions` in its JSON.
Admin refresh does include them. A future change can add that response field and
update its contract/tests/Postman collection; do not assume it already exists.

## 11. API Quick Reference and Failures

All methods below are POST. Bodies are JSON and browser requests include credentials.

| Endpoint | Body | CSRF used | Main result |
| --- | --- | --- | --- |
| `/api/v1/superadmin/login` | email/password, optional deviceDetails | None for login | Source cookies, user, CSRF. |
| `/api/v1/superadmin/switchUser/handoff` | `{}` | Super Admin | One-time handoff cookies and handoff CSRF. |
| `/api/v1/admin/switchUser` | `{ "hostId": 42 }` | Handoff for entry; Admin for later switches | Original user, selected host, mode, subscription summary, switch UUID/version, Admin CSRF. |
| `/api/v1/admin/refresh` | `{}` | Admin | Rotated credentials/context and permissions. |
| `/api/v1/admin/logout` | `{}` | Admin | End support and clear Admin cookies. |
| `/api/v1/superadmin/refresh` | `{}` | Super Admin | Refresh source credentials without intentionally changing its family. |
| `/api/v1/superadmin/logout` | `{}` | Super Admin | Revoke source family and terminate linked support. |

There is no separate session-status, audit-list, target-user-login or handoff-consume
endpoint. The support APIs do not expose raw authentication secrets in JSON.

| Failure | Meaning |
| --- | --- |
| 400 INVALID_HOST_ID | Target must be a positive safe-integer number. |
| 404 HOST_NOT_ELIGIBLE | Target is inactive, deleted or unavailable. |
| 401 INVALID_SWITCH_HANDOFF | Ticket expired, used, unavailable or source no longer valid. |
| 401 INVALID_SWITCH_SESSION | Session or its current access context is no longer usable. |
| 409 STALE_SWITCH_CONTEXT | A conflicting operation changed the service's expected version. Middleware can reject old access context with 401 before this service check. |
| 403 SUPER_ADMIN_ACCESS_REQUIRED | No longer an eligible source Super Admin/support principal. |
| 401 REFRESH_TOKEN_REUSE_DETECTED | Old/revoked refresh credential reused; stop using that login. |
| 403 SUPPORT_READ_ONLY | Attempted Admin route is not allowed in read-only support. |
| 401 CSRF failure | Cookie/header missing or different; not every such response includes a machine-readable code. |
| 429 | Authentication rate limit exceeded. |

## 12. Deployment, Database Safety and Limitations

- `CORS_SUBDOMAIN_DOMAINS=workdesk24.com` enables canonical HTTPS subdomain origins.
  Root/other origins use `CORS_ORIGINS`. CORS approves browser origins, not host IDs,
  user privileges or support mode. Only trust subdomains whose frontend content you control.
- Use Secure cookies in production; choose SameSite settings appropriate to the
  actual API/frontend deployment. Cross-site third-party cookie blocking can still apply.
- Run reviewed migrations rather than executing the entire SQL reference blindly.
  Existing tables, columns, indexes and foreign-key types must be checked first.
- A missing current refresh table with populated legacy `wd_admin_refresh_tokens`
  is refused by the compatibility migration; it requires reviewed conversion, not deletion.
- Do not remove audit triggers, clear replay history, invent source-family backfills,
  or manually set a session active to repair a login.
- The code shown does not provide a scheduled handoff/session/history retention
  cleanup policy. Expiry checks reject expired tickets; they do not automatically delete rows.
- A new handoff can create another support session. There is no database rule saying
  only one switch-session row may exist per user. The browser has one current Admin
  cookie set, so newly issued Admin credentials replace that browser's prior set.
- Session validation occurs when requests enter the middleware. Do not interpret
  it as cancellation of all already-running business operations at logout/switch time.
- Audit rows record switches/termination, not a full change history of every business record.

## 13. Where to Change Things Later

| Responsibility | Owning implementation |
| --- | --- |
| Handoff, switch, refresh, termination and response building | [auth.service.ts](../src/modules/auth/services/auth.service.ts) |
| Current refresh replacement, snapshots and replay detection | [user-refresh-token.repository.ts](../src/modules/auth/repositories/user-refresh-token.repository.ts) |
| Active support lookup and source-linked session locking | [admin-switch-session.repository.ts](../src/modules/auth/repositories/admin-switch-session.repository.ts) |
| Ticket storage and locked lookup | [admin-switch-handoff.repository.ts](../src/modules/auth/repositories/admin-switch-handoff.repository.ts) |
| Admin cookies and JSON response fields | [Admin auth.controller.ts](../src/modules/admin/controllers/auth.controller.ts) |
| Source cookies and handoff issuance controller | [Super Admin auth.controller.ts](../src/modules/superadmin/controllers/auth.controller.ts) |
| Trusted actor/host context and upload host scoping | [auth.middleware.ts](../src/shared/middleware/auth.middleware.ts) |
| Cookie/header CSRF matching | [csrf.middleware.ts](../src/shared/middleware/csrf.middleware.ts) |
| Full/read-only subscription decision | [host.service.ts](../src/modules/master/services/host.service.ts) and [host.repository.ts](../src/modules/master/repositories/host.repository.ts) |
| Read-only route allowlist | [support-access.middleware.ts](../src/shared/middleware/support-access.middleware.ts) |
| Cookie names, paths and browser options | [auth-cookie.util.ts](../src/shared/utils/auth-cookie.util.ts) |
| Dynamic/explicit browser origin policy | [cors-config.util.ts](../src/shared/utils/cors-config.util.ts) |
| Model-level audit immutability | [AdminHostSwitchAudit.ts](../src/models/schemas/AdminHostSwitchAudit.ts) |
| New support tables, context columns and audit triggers | [switch-session migration](../src/migrations/20261030123000-create-admin-switch-session-tables.js) |

Before changing behavior, test normal Admin/Super Admin/App login too. Protect
original identity, host isolation, source-family revocation, replay history,
transaction boundaries, stale-version rejection and audit immutability. API response
changes must also update the Postman collection and frontend contract.

Useful existing verification includes
[host-switch.mysql.integration.test.js](../tests/auth/host-switch.mysql.integration.test.js),
[admin-switch-session.unit.test.js](../tests/auth/admin-switch-session.unit.test.js),
[multipart-support-host-scope.integration.test.js](../tests/auth/multipart-support-host-scope.integration.test.js),
and [cors-config.unit.test.js](../tests/security/cors-config.unit.test.js).
Real MySQL tests require an explicitly enabled, verified disposable database; never
point them at production to check a documentation change.

For companion references, see [ADMIN_AUTH_FLOW.md](ADMIN_AUTH_FLOW.md) and
[HOST_SWITCH_SCHEMA.sql](HOST_SWITCH_SCHEMA.sql).

## 14. One-Sentence Summary

**The handoff proves that a current Super Admin may enter support once; the switch
session keeps that person's identity and selected host separate; refresh history
detects credential reuse; audits preserve host transitions; source logout removes
the parent authorization.**