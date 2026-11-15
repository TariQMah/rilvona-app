/**
 * Creates (or promotes) a platform admin that can sign in to the admin panel with email and password.
 *
 *   node prisma/set-admin.js you@example.com
 *
 * The password is typed at a hidden prompt, so it never lands in shell history. Run it from apps/api on the
 * server (it reads DATABASE_URL from the environment or from the .env next to it). Re-running changes the password.
 */
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { PrismaClient } = require('@prisma/client');
const { argon2id, hash } = require('argon2');

function loadEnv() {
  if (process.env.DATABASE_URL) return;
  const file = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !(match[1] in process.env)) process.env[match[1]] = match[2].replace(/^"|"$/g, '');
  }
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const write = rl._writeToOutput;
    rl._writeToOutput = (text) => {
      if (text.startsWith(question)) write.call(rl, text);
    };
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    console.error('Usage: node prisma/set-admin.js you@example.com');
    process.exit(1);
  }
  loadEnv();
  const password = await askHidden('New admin password (8+ characters): ');
  const again = await askHidden('Type it again: ');
  if (password !== again) throw new Error('The passwords do not match');
  if (password.length < 8) throw new Error('Use at least 8 characters');

  const passwordHash = await hash(password, { type: argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });
  const prisma = new PrismaClient();
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      await prisma.user.update({
        where: { email },
        data: { passwordHash, role: 'PLATFORM_ADMIN', status: 'ACTIVE', emailVerifiedAt: existing.emailVerifiedAt ?? new Date(), deletedAt: null },
      });
      console.log(`${email} is now a platform admin (existing account promoted, password set).`);
    } else {
      await prisma.user.create({
        data: {
          email,
          passwordHash,
          role: 'PLATFORM_ADMIN',
          status: 'ACTIVE',
          emailVerifiedAt: new Date(),
          profile: { create: { displayName: 'Rilvona Admin', username: 'rilvonaadmin' } },
          notificationPrefs: { create: {} },
        },
      });
      console.log(`Created platform admin ${email}.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
