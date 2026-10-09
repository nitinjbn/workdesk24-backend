/**
 * Diagnostic: why does /app/version/check return message: null?
 *
 * Runs the exact same matching rules as AppUpgradeRepository.findApplicablePolicy
 * against every row in wd_app_upgrade_policies and prints why each row
 * matches or is excluded for the given host/user.
 *
 * Usage: node check-app-version.js <hostId> <userId>
 */
const mysql = require('mysql2/promise');
require('dotenv').config();

const hostId = Number(process.argv[2]);
const userId = Number(process.argv[3]);

if (!hostId || !userId) {
  console.error('Usage: node check-app-version.js <hostId> <userId>');
  process.exit(1);
}

async function run() {
  const port = Number(process.env.DB_PORT || 3306);
  const useSsl = process.env.DB_SSL === 'true';

  console.log(
    `connecting to ${process.env.DB_HOST}:${port} db=${process.env.DB_NAME} ssl=${useSsl}`
  );

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectTimeout: 10000,
    ...(useSsl
      ? {
          ssl: {
            rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED === 'true',
          },
        }
      : {}),
  });

  const now = Math.floor(Date.now() / 1000);
  console.log(`now (epoch seconds): ${now}\n`);

  const [policies] = await connection.execute(
    `SELECT p.id, p.scopeType, p.hostId, p.userId, p.releaseId, p.forceUpdate,
            p.isEnabled, p.effectiveFrom, p.effectiveTill, p.message,
            r.isEnabled AS releaseEnabled, r.versionCode, r.versionName
     FROM wd_app_upgrade_policies p
     LEFT JOIN wd_app_releases r ON r.id = p.releaseId
     ORDER BY p.id`
  );

  if (policies.length === 0) {
    console.log('No rows in wd_app_upgrade_policies.');
  }

  for (const p of policies) {
    const checks = [
      ['isEnabled = 1', Number(p.isEnabled) === 1],
      [
        'release exists & release.isEnabled = 1',
        p.releaseEnabled !== null && Number(p.releaseEnabled) === 1,
      ],
      ['effectiveFrom <= now (seconds!)', Number(p.effectiveFrom) <= now],
      [
        'effectiveTill IS NULL or >= now',
        p.effectiveTill === null || Number(p.effectiveTill) >= now,
      ],
      [
        'scope matches',
        (p.scopeType === 'USER' && Number(p.hostId) === hostId && Number(p.userId) === userId) ||
          (p.scopeType === 'HOST' && Number(p.hostId) === hostId) ||
          p.scopeType === 'GLOBAL',
      ],
    ];

    const matched = checks.every(([, ok]) => ok);
    console.log(`policy #${p.id} [${p.scopeType}] -> ${matched ? 'MATCHES' : 'EXCLUDED'}`);
    for (const [label, ok] of checks) {
      console.log(`   ${ok ? 'OK ' : 'FAIL'} ${label}`);
    }
    console.log(
      `   data: hostId=${p.hostId} userId=${p.userId} releaseId=${p.releaseId} ` +
        `effectiveFrom=${p.effectiveFrom} effectiveTill=${p.effectiveTill} ` +
        `release=${p.versionName}(${p.versionCode}) message=${JSON.stringify(p.message)}\n`
    );
  }

  const [releases] = await connection.execute(
    `SELECT id, versionName, versionCode, distributionChannel, isEnabled
     FROM wd_app_releases ORDER BY versionCode DESC`
  );
  console.log('wd_app_releases rows:');
  console.table(releases);

  await connection.end();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
