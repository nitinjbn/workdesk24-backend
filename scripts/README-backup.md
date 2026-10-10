# MySQL Backup — `scripts/backup-mysql.js`

Manual, local, compressed backups of the WorkDesk24 production MySQL database
hosted on Railway. Runs standalone — the Express server does not need to start.

## Prerequisites (macOS)

- Node.js (same version you use for this repo).
- `mysqldump` on `PATH`:
  ```bash
  brew install mysql-client
  # mysql-client is keg-only; add it to PATH as instructed by brew, e.g.:
  echo 'export PATH="/opt/homebrew/opt/mysql-client/bin:$PATH"' >> ~/.zshrc
  ```
  MariaDB's dump utility also works (`brew install mariadb`).
- `gzip` — preinstalled on macOS.

## How the script finds configuration

The script loads the repository `.env` via `dotenv` (already a project
dependency), resolving the path relative to the repo root
(`<repo>/.env`). No credentials are hardcoded. Use `--env-file <path>` to load
a different file.

Existing environment variables used (values are never printed):

| Variable      | Purpose                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------------------------------- |
| `DB_HOST`     | Target host (displayed)                                                                                     |
| `DB_PORT`     | Target port (default `3306`)                                                                                |
| `DB_NAME`     | Database to dump (displayed)                                                                                |
| `DB_USER`     | Dump user (not displayed)                                                                                   |
| `DB_PASSWORD` | Passed to mysqldump only via the `MYSQL_PWD` environment variable — never on the command line, never logged |
| `NODE_ENV`    | Used for the Railway-production confidence check                                                            |

## Running a backup

```bash
node scripts/backup-mysql.js
```

Useful flags:

- `--yes` — skip the interactive safety confirmation.
- `--env-file <path>` — use an alternate env file.
- `--help` — usage and prerequisites.

Before connecting, the script prints the target host, port, database name, and
destination directory. If the host does not look like Railway production
(`*.rlwy.net` with `NODE_ENV=production`), it requires you to type `yes` first.

## Where backups are saved

```
backups/mysql/workdesk24-YYYY-MM-DD-HHmmss.sql.gz
```

- Filenames use **local system time**.
- Every run creates a new file; existing backups are never overwritten.
- During generation the file is named `*.partial` and renamed only after the
  dump, gzip, and validation checks all succeed.
- Directory permissions `0700`, file permissions `0600` (owner-only).
- `backups/mysql/` is excluded from Git via `.gitignore`. Do not commit
  backups — they contain customer data.
- Old backups are never deleted automatically; prune them manually.

## Verifying a backup

The script already runs a full gunzip pass and checks for SQL content, but
**that does not prove the dump is restorable**. To verify manually:

```bash
# gzip integrity
gzip -t backups/mysql/workdesk24-2026-10-10-213000.sql.gz

# inspect the first lines of the dump
zcat backups/mysql/workdesk24-2026-10-10-213000.sql.gz | head -n 40
```

The only reliable verification is a test restore (below).

## Restoring into a separate test database

Never restore over production. Create a scratch database and restore there:

```bash
mysql --host=<host> --port=<port> --user=<user> -p \
  -e "CREATE DATABASE workdesk24_restore_test"

zcat backups/mysql/workdesk24-2026-10-10-213000.sql.gz | \
  mysql --host=<host> --port=<port> --user=<user> -p workdesk24_restore_test
```

Then sanity-check row counts on a few large tables against production.

## Limitations

- `--single-transaction` gives a consistent snapshot **only for InnoDB**
  tables. Any MyISAM/other non-transactional tables may be inconsistent if
  written to during the dump.
- Views, triggers, routines, and events are included only if the database
  user has the required privileges (`SHOW VIEW`, `TRIGGER`, `EVENT`,
  `LOCK TABLES`, etc.). If the server denies them, mysqldump fails and the
  partial file is discarded — the error text is shown.
- The script probes `mysqldump --help` and only passes options the installed
  utility supports (`--no-tablespaces`, `--set-gtid-purged=OFF`,
  `--column-statistics=0`, etc.), so MySQL/MariaDB client differences are
  handled. GTID purged state is excluded when supported, so restoring does
  not require GTID setup.
- A dump from a newer/older server version than the restore target may need
  adjustments. Prefer a dump utility version matching the server major
  version.
- gzip integrity + SQL-content checks do **not** guarantee restorability.
  Periodically perform a real test restore.
- The script does not modify the production database, its permissions, or any
  application code, and it never uploads backups anywhere.

## Failure behavior

- Missing env vars, missing `mysqldump`/`gzip`, dump errors, gzip errors, and
  failed validation all exit with a **nonzero** code and remove the `.partial`
  file. Previous successful backups are never touched.
- Ctrl+C (`SIGINT`) / `SIGTERM` terminate the child processes and remove the
  partial file.
