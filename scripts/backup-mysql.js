#!/usr/bin/env node
'use strict';

/**
 * WorkDesk24 — Railway MySQL manual backup.
 *
 * Creates a compressed mysqldump of the database configured in the repository
 * .env file into backups/mysql/. Standalone: does not start the backend.
 *
 * Usage:
 *   node scripts/backup-mysql.js [--yes] [--env-file <path>] [--help]
 *
 * Safety notes:
 * - The DB password is passed to mysqldump only via the MYSQL_PWD environment
 *   variable, never on the command line and never printed.
 * - The dump is written to a .partial file and renamed only after the dump,
 *   gzip, and integrity validation all succeed.
 */

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const zlib = require('zlib');

const REPO_ROOT = path.resolve(__dirname, '..');
const DEFAULT_ENV_FILE = path.join(REPO_ROOT, '.env');
const BACKUP_DIR = path.join(REPO_ROOT, 'backups', 'mysql');
const FILE_PREFIX = 'workdesk24';
const REQUIRED_ENV_VARS = ['DB_HOST', 'DB_NAME', 'DB_USER', 'DB_PASSWORD'];

// Runtime state for cleanup on failure/signals.
let activeChildren = new Set();
let activeProgress = null;
let partialPath = null;
let finished = false;

function printHelp() {
  console.log(`WorkDesk24 MySQL backup (Railway production)

Usage:
  node scripts/backup-mysql.js [--yes] [--env-file <path>] [--help]

Options:
  --yes              Skip the interactive safety confirmation.
  --env-file <path>  Load environment from this file instead of the repo .env.
  --help             Show this help.

What it does:
  1. Loads DB_HOST, DB_PORT, DB_NAME, DB_USER, DB_PASSWORD from the repo .env.
  2. Verifies mysqldump and gzip are installed and supported options exist.
  3. Shows the target host/database (never the password) and asks for
     confirmation when the target does not look like Railway production.
  4. Streams mysqldump | gzip into backups/mysql/${FILE_PREFIX}-<local-timestamp>.sql.gz.

Prerequisites (macOS):
  - mysqldump: brew install mysql-client (or mariadb), then ensure it is on PATH.
  - gzip: preinstalled on macOS.

Backups are written with owner-only permissions (0600) into a 0700 directory
and are excluded from Git via .gitignore. Timestamps use local system time.`);
}

function parseArgs(argv) {
  const args = { yes: false, envFile: DEFAULT_ENV_FILE, help: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      args.help = true;
    } else if (arg === '--yes' || arg === '-y') {
      args.yes = true;
    } else if (arg === '--env-file') {
      const value = argv[i + 1];
      if (!value) {
        throw new Error('--env-file requires a path');
      }
      args.envFile = path.resolve(value);
      i += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}. Run with --help for usage.`);
    }
  }

  return args;
}

function fail(message) {
  stopActiveProgress();
  console.error(`\nERROR: ${message}`);
  cleanupPartial();
  process.exit(1);
}

function cleanupPartial() {
  if (partialPath && fs.existsSync(partialPath)) {
    try {
      fs.unlinkSync(partialPath);
    } catch {
      // Best effort only; never delete anything besides our own partial file.
    }
  }
}

function killChildren() {
  for (const child of activeChildren) {
    try {
      child.kill('SIGKILL');
    } catch {
      // Already exited.
    }
  }
  activeChildren.clear();
}

function handleSignal(signal) {
  stopActiveProgress();
  console.error(`\nReceived ${signal}. Aborting backup and removing partial file.`);
  killChildren();
  cleanupPartial();
  process.exit(signal === 'SIGINT' ? 130 : 143);
}

process.on('SIGINT', () => handleSignal('SIGINT'));
process.on('SIGTERM', () => handleSignal('SIGTERM'));

/**
 * Live progress line for long-running phases. On a TTY it rewrites one line;
 * when piped/redirected it prints a line every 5 seconds instead.
 */
function startProgress(label, getBytes) {
  const startedAt = Date.now();
  const isTty = process.stdout.isTTY;
  let lastPrint = 0;

  const render = (final = false) => {
    const elapsed = Math.floor((Date.now() - startedAt) / 1000);
    const line = `  ${label}: ${formatBytes(getBytes())} written, ${elapsed}s elapsed`;

    if (isTty) {
      process.stdout.write(`\r${line.padEnd(72)}`);
    } else if (final || Date.now() - lastPrint >= 5000) {
      lastPrint = Date.now();
      console.log(line);
    }
  };

  render();
  const timer = setInterval(render, 1000);

  activeProgress = {
    stop(final = true) {
      clearInterval(timer);
      activeProgress = null;
      if (isTty) {
        render(final);
        process.stdout.write('\n');
      }
    },
  };

  return activeProgress.stop;
}

function stopActiveProgress() {
  if (activeProgress) {
    activeProgress.stop(false);
  }
}

function loadEnvironment(envFile) {
  if (!fs.existsSync(envFile)) {
    fail(`Environment file not found: ${envFile}`);
  }

  require('dotenv').config({ path: envFile });

  const missing = REQUIRED_ENV_VARS.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    fail(
      `Missing required environment variables: ${missing.join(', ')}. ` +
        'Check your .env file. Values are intentionally not displayed.'
    );
  }

  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || '3306',
    name: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
}

function checkUtility(command, versionArgs, installHint) {
  const result = spawnSync(command, versionArgs, { encoding: 'utf8' });

  if (result.error) {
    fail(`'${command}' is not available on PATH. ${installHint}`);
  }

  const versionLine = `${result.stdout || ''}${result.stderr || ''}`
    .split('\n')
    .find((line) => line.trim().length > 0);

  return versionLine ? versionLine.trim() : `${command} (version unknown)`;
}

function getSupportedDumpOptions() {
  const result = spawnSync('mysqldump', ['--help'], { encoding: 'utf8' });
  const helpText = `${result.stdout || ''}\n${result.stderr || ''}`;

  if (!helpText.trim()) {
    fail('Could not read mysqldump option list (mysqldump --help produced no output).');
  }

  // Only enable options the installed dump utility actually supports,
  // keeping MySQL/MariaDB compatibility without blindly passing flags.
  const candidates = [
    ['single-transaction', '--single-transaction'],
    ['quick', '--quick'],
    ['routines', '--routines'],
    ['events', '--events'],
    ['triggers', '--triggers'],
    ['no-tablespaces', '--no-tablespaces'],
    ['set-gtid-purged', '--set-gtid-purged=OFF'],
    ['column-statistics', '--column-statistics=0'],
  ];

  const supported = [];
  const skipped = [];
  for (const [name, flag] of candidates) {
    if (helpText.includes(name)) {
      supported.push(flag);
    } else {
      skipped.push(flag);
    }
  }

  if (skipped.length > 0) {
    console.log(`Note: this mysqldump does not support: ${skipped.join(', ')} (skipped)`);
  }

  return supported;
}

function looksLikeRailwayProduction(host) {
  return /rlwy\.net|railway/i.test(host) && process.env.NODE_ENV === 'production';
}

function confirmTarget(db) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(
      `\nWARNING: target "${db.host}:${db.port}/${db.name}" could not be confidently ` +
        'identified as the Railway production database.\nType "yes" to continue: ',
      (answer) => {
        rl.close();
        resolve(answer.trim().toLowerCase() === 'yes');
      }
    );
  });
}

function timestampLocal(date) {
  const pad = (value) => String(value).padStart(2, '0');
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}-` +
    `${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
  );
}

function waitForExit(child) {
  return new Promise((resolve) => {
    child.on('close', (code, signal) => resolve({ code, signal }));
  });
}

function captureStderr(child) {
  let text = '';
  child.stderr.on('data', (chunk) => {
    if (text.length < 8000) {
      text += chunk.toString('utf8');
    }
  });
  return () => text.trim();
}

function runBackup(db, dumpOptions, finalPath) {
  partialPath = `${finalPath}.partial`;

  const dumpArgs = [
    `--host=${db.host}`,
    `--port=${db.port}`,
    `--user=${db.user}`,
    ...dumpOptions,
    db.name,
  ];

  const dump = spawn('mysqldump', dumpArgs, {
    env: { ...process.env, MYSQL_PWD: db.password },
  });
  const gzip = spawn('gzip', ['-c']);
  const out = fs.createWriteStream(partialPath, { mode: 0o600 });
  const stopProgress = startProgress('backing up', () => out.bytesWritten);

  activeChildren = new Set([dump, gzip]);
  const getDumpStderr = captureStderr(dump);
  const getGzipStderr = captureStderr(gzip);

  dump.stdout.pipe(gzip.stdin);
  gzip.stdout.pipe(out);

  const writeDone = new Promise((resolve, reject) => {
    out.on('finish', resolve);
    out.on('error', reject);
  });

  dump.on('error', (error) => {
    gzip.kill('SIGKILL');
    writeDone.catch(() => {});
    fail(`Failed to start mysqldump: ${error.message}`);
  });

  gzip.on('error', (error) => {
    dump.kill('SIGKILL');
    writeDone.catch(() => {});
    fail(`Failed to start gzip: ${error.message}`);
  });

  return Promise.all([waitForExit(dump), waitForExit(gzip), writeDone]).then(
    ([dumpResult, gzipResult]) => {
      stopProgress();
      activeChildren.clear();

      if (dumpResult.code !== 0) {
        fail(
          `mysqldump exited with code ${dumpResult.code}.\n${getDumpStderr()}\n` +
            'The partial backup was discarded.'
        );
      }

      if (gzipResult.code !== 0) {
        fail(
          `gzip exited with code ${gzipResult.code}.\n${getGzipStderr()}\n` +
            'The partial backup was discarded.'
        );
      }
    }
  );
}

function verifyBackup(filePath) {
  return new Promise((resolve, reject) => {
    const gunzip = zlib.createGunzip();
    const input = fs.createReadStream(filePath);
    let bytes = 0;
    let head = '';

    gunzip.on('data', (chunk) => {
      bytes += chunk.length;
      if (head.length < 4096) {
        head += chunk.toString('utf8');
      }
    });
    gunzip.on('end', () => resolve({ bytes, head }));
    gunzip.on('error', reject);
    input.on('error', reject);

    input.pipe(gunzip);
  });
}

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.help) {
    printHelp();
    return;
  }

  const db = loadEnvironment(args.envFile);

  console.log('WorkDesk24 MySQL backup');
  console.log('-----------------------');
  console.log(`Target host:     ${db.host}`);
  console.log(`Target port:     ${db.port}`);
  console.log(`Target database: ${db.name}`);
  console.log(`Backup directory: ${BACKUP_DIR}`);
  console.log('(password loaded from environment, not displayed)');

  const dumpVersion = checkUtility(
    'mysqldump',
    ['--version'],
    'Install it with: brew install mysql-client (or: brew install mariadb).'
  );
  checkUtility('gzip', ['--version'], 'gzip is preinstalled on macOS; check your PATH.');
  console.log(`Dump utility:    ${dumpVersion}`);

  const dumpOptions = getSupportedDumpOptions();

  if (!args.yes && !looksLikeRailwayProduction(db.host)) {
    const confirmed = await confirmTarget(db);
    if (!confirmed) {
      fail('Backup cancelled by user.');
    }
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true, mode: 0o700 });
  fs.chmodSync(BACKUP_DIR, 0o700);

  const finalPath = path.join(BACKUP_DIR, `${FILE_PREFIX}-${timestampLocal(new Date())}.sql.gz`);
  if (fs.existsSync(finalPath)) {
    fail(`Refusing to overwrite existing backup: ${finalPath}`);
  }

  console.log('\nRunning backup (streaming mysqldump | gzip)...');
  const startedAt = Date.now();

  await runBackup(db, dumpOptions, finalPath);

  // Validate the compressed output before accepting it.
  const stat = fs.statSync(partialPath);
  if (!stat.size) {
    fail('Backup file is empty. The partial backup was discarded.');
  }

  console.log('\nVerifying backup integrity (gunzip pass + SQL content check)...');
  let verification;
  try {
    verification = await verifyBackup(partialPath);
  } catch (error) {
    fail(`Backup failed gzip integrity validation: ${error.message}`);
  }

  if (
    verification.bytes === 0 ||
    !/(MySQL dump|MariaDB dump|CREATE TABLE|INSERT INTO|--)/i.test(verification.head)
  ) {
    fail('Backup decompressed but does not look like a SQL dump. The partial file was discarded.');
  }

  fs.renameSync(partialPath, finalPath);
  partialPath = null;
  fs.chmodSync(finalPath, 0o600);

  const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
  const finalSize = fs.statSync(finalPath).size;

  console.log('\nBackup completed successfully.');
  console.log(`  File:     ${finalPath}`);
  console.log(`  Size:     ${formatBytes(finalSize)} (compressed)`);
  console.log(`  Duration: ${durationSeconds}s`);
  console.log('  Status:   gzip integrity and SQL content checks passed');
  console.log('\nReminder: validate restorability by restoring into a separate test database.');

  finished = true;
}

process.on('exit', () => {
  if (!finished) {
    killChildren();
    cleanupPartial();
  }
});

main().catch((error) => {
  fail(error.message || String(error));
});
