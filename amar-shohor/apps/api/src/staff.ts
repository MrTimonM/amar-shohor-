import mongoose from 'mongoose';
import { DEPARTMENT_LABELS, type Department } from '@amar/shared';
import { hashPassword } from './auth';
import { env } from './env';
import { StaffCode, User } from './models';

/**
 * Creates the admin and one authority account per department, and issues a
 * staff code for each. Run with `npm run staff`.
 *
 * Unlike `seed.ts` this **wipes nothing**: it upserts by email, so running it
 * twice is safe and running it against a database with real reports in it will
 * not cost you them. That is the whole reason it is a separate script — the
 * usual need is "I want to sign in as an authority", not "rebuild the city".
 *
 * Passwords are reset to SEED_PASSWORD on every run, which is the point: these
 * are demo credentials, and a demo account nobody can get into is useless.
 */

interface StaffSpec {
  name: string;
  email: string;
  department: Department;
}

const STAFF: StaffSpec[] = [
  { name: 'Nasrin Akter', email: 'roads@amarshohor.test', department: 'roads' },
  { name: 'Kamrul Hasan', email: 'water@amarshohor.test', department: 'water' },
  { name: 'Shireen Begum', email: 'waste@amarshohor.test', department: 'waste' },
  { name: 'Tanvir Rahman', email: 'electrical@amarshohor.test', department: 'electrical' },
  { name: 'Farhana Islam', email: 'traffic@amarshohor.test', department: 'traffic' },
  { name: 'Imran Chowdhury', email: 'environment@amarshohor.test', department: 'environment' },
];

const ADMIN = { name: 'City Administrator', email: 'admin@amarshohor.test' };

/** Same alphabet as the admin console, so codes from both look alike. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const newCode = () => {
  const pick = () => ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  const group = () => Array.from({ length: 4 }, pick).join('');
  return `${group()}-${group()}-${group()}`;
};

async function upsert(spec: { name: string; email: string; department?: Department }, role: 'admin' | 'authority', hash: string) {
  const existing = await User.findOne({ email: spec.email });

  if (existing) {
    existing.name = spec.name;
    existing.role = role;
    existing.department = spec.department;
    existing.passwordHash = hash;
    existing.trust = 5;
    await existing.save();
    return { ...spec, role, created: false };
  }

  await User.create({
    name: spec.name,
    email: spec.email,
    passwordHash: hash,
    role,
    department: spec.department,
    trust: 5,
    lastSeenAt: new Date(),
  });
  return { ...spec, role, created: true };
}

async function main() {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to write demo staff accounts to a production database.');
    process.exit(1);
  }

  try {
    await mongoose.connect(env.MONGO_URL, { serverSelectionTimeoutMS: 8000 });
  } catch {
    console.error('\nCould not reach MongoDB. Check MONGO_URL in your .env file.\n');
    process.exit(1);
  }
  await mongoose.connection.syncIndexes();

  // One hash for all of them: scrypt is deliberately slow, and they share a
  // password anyway.
  const hash = await hashPassword(env.SEED_PASSWORD);

  const admin = await upsert(ADMIN, 'admin', hash);
  const staff = [];
  for (const spec of STAFF) staff.push(await upsert(spec, 'authority', hash));

  // A live code per department, so the admin console has something in it and
  // a second officer can be signed up without minting one by hand first.
  const adminUser = await User.findOne({ email: ADMIN.email });
  const codes = [];
  for (const dept of STAFF.map((s) => s.department)) {
    const existing = await StaffCode.findOne({
      department: dept,
      revokedAt: { $exists: false },
      expiresAt: { $gt: new Date() },
    });
    if (existing) {
      codes.push({ department: dept, code: existing.code, fresh: false });
      continue;
    }
    const doc = await StaffCode.create({
      code: newCode(),
      department: dept,
      label: `Seeded — ${DEPARTMENT_LABELS[dept].en}`,
      createdById: adminUser?._id,
      createdByName: adminUser?.name,
      expiresAt: new Date(Date.now() + 30 * 86_400_000),
      maxUses: 5,
      useCount: 0,
    });
    codes.push({ department: dept, code: doc.code, fresh: true });
  }

  const pad = (s: string, n: number) => s.padEnd(n);
  const lines = [
    '',
    `  Password for every account below: ${env.SEED_PASSWORD}`,
    '',
    `  ${pad('ROLE', 11)}${pad('EMAIL', 34)}DEPARTMENT`,
    `  ${'-'.repeat(11)}${'-'.repeat(34)}${'-'.repeat(22)}`,
    `  ${pad('admin', 11)}${pad(admin.email, 34)}— all departments —`,
    ...staff.map((s) => `  ${pad('authority', 11)}${pad(s.email, 34)}${DEPARTMENT_LABELS[s.department!].en}`),
    '',
    '  Staff codes (for creating more authority accounts on the sign-up page):',
    '',
    ...codes.map((c) => `  ${pad(c.code, 18)}${DEPARTMENT_LABELS[c.department].en}`),
    '',
    '  Sign in as the admin and open /admin to issue more codes or withdraw these.',
    '',
  ];
  console.log(lines.join('\n'));

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
