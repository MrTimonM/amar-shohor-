import mongoose from 'mongoose';
import { CATEGORIES, CATEGORY_META, type Category, type Status } from '@amar/shared';
import { hashPassword } from './auth';
import { createIssueFromReport, recomputePriority, resolveReport } from './dedup';
import { env } from './env';
import { makeRef } from './http';
import { log } from './log';
import { Issue, Report, StatusEvent, Upload, User, Verification, Ward, type ReportDoc } from './models';

/**
 * Realistic Dhaka test data, including deliberate duplicate clusters so the
 * phase 10 dedup engine is exercised rather than merely present. Run with
 * `npm run seed`.
 *
 * Deterministic: the same seed produces the same city every time, so a bug
 * found in a demo can be reproduced.
 */

let rngState = 0x9e3779b9;
function rnd(): number {
  rngState = (rngState + 0x6d2b79f5) | 0;
  let t = Math.imul(rngState ^ (rngState >>> 15), 1 | rngState);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const pick = <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)] as T;
const between = (min: number, max: number) => min + rnd() * (max - min);
const intBetween = (min: number, max: number) => Math.floor(between(min, max + 1));

const WARDS = [
  { name: 'Gulshan', nameBn: 'গুলশান', cc: 'Dhaka North', lat: 23.7925, lng: 90.4142, density: 22_000 },
  { name: 'Banani', nameBn: 'বনানী', cc: 'Dhaka North', lat: 23.7936, lng: 90.4004, density: 26_000 },
  { name: 'Uttara', nameBn: 'উত্তরা', cc: 'Dhaka North', lat: 23.8759, lng: 90.3795, density: 19_000 },
  { name: 'Mirpur', nameBn: 'মিরপুর', cc: 'Dhaka North', lat: 23.8223, lng: 90.3654, density: 41_000 },
  { name: 'Mohammadpur', nameBn: 'মোহাম্মদপুর', cc: 'Dhaka North', lat: 23.7657, lng: 90.3586, density: 45_000 },
  { name: 'Dhanmondi', nameBn: 'ধানমন্ডি', cc: 'Dhaka South', lat: 23.7461, lng: 90.3742, density: 30_000 },
  { name: 'Tejgaon', nameBn: 'তেজগাঁও', cc: 'Dhaka North', lat: 23.7639, lng: 90.3936, density: 28_000 },
  { name: 'Motijheel', nameBn: 'মতিঝিল', cc: 'Dhaka South', lat: 23.733, lng: 90.4172, density: 34_000 },
  { name: 'Lalbagh', nameBn: 'লালবাগ', cc: 'Dhaka South', lat: 23.7186, lng: 90.3881, density: 52_000 },
  { name: 'Jatrabari', nameBn: 'যাত্রাবাড়ী', cc: 'Dhaka South', lat: 23.7104, lng: 90.4364, density: 38_000 },
] as const;

const CITIZEN_NAMES = [
  'Rafiq Islam', 'Nusrat Jahan', 'Tanvir Ahmed', 'Sabina Yasmin', 'Imran Hossain',
  'Mehjabin Chowdhury', 'Arif Rahman', 'Farhana Akter', 'Sohel Rana', 'Tasnim Reza',
  'Kamrul Hasan', 'Shirin Sultana', 'Jubayer Alam', 'Rumana Haque', 'Nafis Iqbal',
  'Anika Tabassum', 'Masud Karim', 'Priya Das', 'Rezaul Karim', 'Ishrat Binte',
];

const DESCRIPTIONS: Record<Category, string[]> = {
  road_damage: [
    'Deep pothole in the middle of the lane, rickshaws are tipping into it.',
    'The road has broken up badly after the rain. Two wheelers cannot pass safely.',
    'Large crater near the bus stop, it has been growing for weeks.',
  ],
  waterlogging: [
    'Knee-deep water outside the school gate every time it rains.',
    'The drain is blocked so the whole lane floods within minutes.',
    'Standing water has not drained for four days now.',
  ],
  garbage: [
    'Garbage has piled up at the corner and nobody has collected it.',
    'The bin overflowed days ago, the smell reaches the flats above.',
    'Waste dumped on the footpath, blocking the whole width.',
  ],
  streetlight: [
    'Three lights in a row are dead, the stretch is completely dark after 7pm.',
    'The pole light has been off for two weeks. Women avoid this lane at night.',
    'Streetlight flickers all night and then goes out.',
  ],
  traffic_signal: [
    'The signal has been dead since Friday and traffic police are managing by hand.',
    'Only the red lamp works, drivers are guessing.',
    'Signal timing is stuck, the crossing never gets a green.',
  ],
  sidewalk: [
    'Footpath slabs are missing, an elderly man fell here yesterday.',
    'The sidewalk is broken open over the drain, it is a real hazard at night.',
    'Tiles lifted across the whole stretch, wheelchairs cannot use it.',
  ],
  congestion: [
    'This intersection locks up for forty minutes every evening.',
    'Illegal parking on both sides has narrowed the road to one lane.',
    'Bus stand overflow blocks the junction all through the morning.',
  ],
  environmental: [
    'Open drain running alongside the footpath, the smell is unbearable.',
    'Construction dust covering the whole block, no screening at all.',
    'Waste being burned in the open at the back of the lane.',
  ],
};

const AUTHORITY_STAFF = [
  { name: 'Md. Shahjahan Ali', department: 'roads' },
  { name: 'Nasrin Akhter', department: 'water' },
  { name: 'Abdul Momen', department: 'waste' },
  { name: 'Rina Parveen', department: 'electrical' },
  { name: 'Habibur Rahman', department: 'traffic' },
  { name: 'Selina Hossain', department: 'environment' },
] as const;

// Roughly 111km per degree of latitude; longitude shrinks with the cosine.
const metersToLat = (m: number) => m / 111_320;
const metersToLng = (m: number, lat: number) => m / (111_320 * Math.cos((lat * Math.PI) / 180));

function jitter(lat: number, lng: number, meters: number) {
  const angle = rnd() * Math.PI * 2;
  const dist = rnd() * meters;
  return {
    lat: lat + metersToLat(Math.sin(angle) * dist),
    lng: lng + metersToLng(Math.cos(angle) * dist, lat),
  };
}

function squareBoundary(lat: number, lng: number, halfMeters: number) {
  const dLat = metersToLat(halfMeters);
  const dLng = metersToLng(halfMeters, lat);
  return {
    type: 'Polygon' as const,
    coordinates: [
      [
        [lng - dLng, lat - dLat],
        [lng + dLng, lat - dLat],
        [lng + dLng, lat + dLat],
        [lng - dLng, lat + dLat],
        [lng - dLng, lat - dLat],
      ],
    ],
  };
}

const photoFor = (category: Category, seed: number) => {
  const url = `${env.API_PUBLIC_URL}/v1/media/placeholder/${category}/${seed}`;
  return {
    id: `seed-${category}-${seed}`,
    key: `seed/${category}/${seed}`,
    url,
    thumbUrl: url,
    width: 420,
    height: 320,
    bytes: 4200,
  };
};

/**
 * Every account needs an email, because it is the sign-in identifier. Seeded
 * people who are not the operator get an address under the reserved `.test`
 * TLD, which by RFC 2606 can never resolve — so no seeded row can be mistaken
 * for a real person's address.
 */
const seedEmail = (name: string, suffix: string) =>
  `${name.toLowerCase().replace(/[^a-z]+/g, '.').replace(/^\.|\.$/g, '')}@${suffix}.amarshohor.test`;

async function wipe() {
  await Promise.all([
    Ward.deleteMany({}),
    User.deleteMany({}),
    Report.deleteMany({}),
    Issue.deleteMany({}),
    Verification.deleteMany({}),
    Upload.deleteMany({}),
    // StatusEvent refuses updates and deletes through the model, by design —
    // the seed drops the collection directly, which is the one legitimate
    // place to do it.
    StatusEvent.collection.deleteMany({}),
  ]);
}

async function main() {
  if (env.NODE_ENV === 'production') {
    console.error('Refusing to seed a production database.');
    process.exit(1);
  }

  try {
    await mongoose.connect(env.MONGO_URL, { serverSelectionTimeoutMS: 8000 });
  } catch {
    console.error(
      [
        '',
        'Could not reach MongoDB, so there is nothing to seed.',
        'Start one locally, or point MONGO_URL at an Atlas cluster in your .env file.',
        '',
      ].join('\n'),
    );
    process.exit(1);
  }
  // The dedup engine runs real $near queries, which fail outright without the
  // 2dsphere indexes. The API builds them on boot; the seed connects directly,
  // so it has to build them itself before writing anything.
  await mongoose.connection.syncIndexes();

  log.info('seeding', { db: mongoose.connection.name });
  await wipe();

  // --- wards ---------------------------------------------------------------
  const wards = await Ward.insertMany(
    WARDS.map((w) => ({
      name: w.name,
      nameBn: w.nameBn,
      cityCorporation: w.cc,
      densityPerKm2: w.density,
      center: { type: 'Point', coordinates: [w.lng, w.lat] },
      boundary: squareBoundary(w.lat, w.lng, 900),
    })),
  );
  log.info('wards created', { count: wards.length });

  // --- people --------------------------------------------------------------
  /**
   * Staff accounts are given real email addresses from the environment. Phone
   * sign-in needs an SMS gateway that does not exist yet, so a phone-only
   * admin account would be one nobody could actually sign into.
   */
  const staffEmails = env.SEED_STAFF_EMAILS.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  const adminEmail = env.SEED_ADMIN_EMAIL.trim().toLowerCase() || undefined;

  /**
   * One hash, reused for every seeded account. scrypt is deliberately slow —
   * hashing 30-odd accounts separately would add nearly two seconds to a seed
   * for no benefit, since they all share the same password anyway.
   */
  const seedPasswordHash = await hashPassword(env.SEED_PASSWORD);

  const admin = await User.create({
    phone: '+8801700000000',
    email: adminEmail ?? seedEmail('City Administrator', 'city'),
    passwordHash: seedPasswordHash,
    name: 'City Administrator',
    role: 'admin',
    trust: 5,
  });

  const staff = await User.insertMany(
    AUTHORITY_STAFF.map((member, i) => {
      return {
        phone: `+88017111111${String(i).padStart(2, '0')}`,
        email: staffEmails[i] ?? seedEmail(member.name, member.department),
        passwordHash: seedPasswordHash,
        name: member.name,
        role: 'authority',
        department: member.department,
        trust: 5,
        wardIds: [],
      };
    }),
  );

  const citizens = await User.insertMany(
    CITIZEN_NAMES.map((name, i) => ({
      phone: `+88018${String(20000000 + i * 7919).padStart(8, '0')}`,
      email: seedEmail(name, 'citizen'),
      passwordHash: seedPasswordHash,
      name,
      role: i < 4 ? 'verifier' : 'citizen',
      // A spread of trust, so weighted verification is visibly doing something.
      trust: Number(between(0.6, 3.4).toFixed(2)),
    })),
  );
  log.info('users created', { admin: 1, staff: staff.length, citizens: citizens.length });

  // --- clusters ------------------------------------------------------------
  // A cluster is one physical problem. Several of them get multiple reports,
  // which is exactly what the dedup engine has to collapse.
  const CLUSTERS = 58;
  let photoSeed = 0;
  let reportTotal = 0;

  for (let c = 0; c < CLUSTERS; c += 1) {
    const ward = pick(WARDS);
    const wardDoc = wards.find((w) => w.name === ward.name);
    const category = pick(CATEGORIES) as Category;
    const spot = jitter(ward.lat, ward.lng, 780);

    // Most problems get one report; the interesting ones get several.
    const reportsInCluster = rnd() < 0.42 ? intBetween(2, 5) : 1;
    const firstDaysAgo = between(0.2, 44);

    for (let r = 0; r < reportsInCluster; r += 1) {
      const reporter = pick(citizens);
      // Reports of the same problem arrive over the following few days, from
      // slightly different spots — the GPS drift dedup has to survive.
      const daysAgo = Math.max(0.05, firstDaysAgo - r * between(0.1, 2.2));
      const createdAt = new Date(Date.now() - daysAgo * 86_400_000);
      const at = jitter(spot.lat, spot.lng, r === 0 ? 4 : between(6, 34));

      photoSeed += 1;
      const doc = await Report.create({
        ref: makeRef('RP'),
        category,
        severity: intBetween(2, 5),
        description: rnd() < 0.8 ? pick(DESCRIPTIONS[category]) : undefined,
        location: { type: 'Point', coordinates: [at.lng, at.lat] },
        accuracy: Math.round(between(6, 38)),
        address: `${ward.name}, ${ward.cc}`,
        photos: [photoFor(category, photoSeed)],
        reporterId: reporter._id,
        wardId: wardDoc?._id,
        queuedOffline: rnd() < 0.08,
        mergeDecision: 'pending',
      });

      /**
       * Backdating goes through the raw driver on purpose. Mongoose strips
       * `createdAt` out of `$set` on any update to a schema with timestamps
       * enabled — `{ timestamps: false }` does not change that — so the write
       * is accepted and silently does nothing. The symptom is subtle: every
       * seeded report ends up stamped "now", which flattens the 30-day trend
       * and makes median fix time read in minutes.
       */
      await Report.collection.updateOne(
        { _id: doc._id as never },
        { $set: { createdAt, updatedAt: createdAt } },
      );
      const fresh = await Report.findById(doc._id).lean<ReportDoc & { _id: unknown }>();
      if (!fresh) continue;

      // Run the real engine rather than assigning issues by hand — the seed is
      // also a smoke test of phase 10.
      if (r === 0) {
        await createIssueFromReport(fresh);
      } else {
        await resolveReport(fresh);
      }
      reportTotal += 1;
    }

    await User.updateOne({ _id: pick(citizens)._id }, { $inc: { reportCount: reportsInCluster } });
  }

  const issues = await Issue.find({});
  log.info('dedup complete', { reports: reportTotal, issues: issues.length, merged: reportTotal - issues.length });

  // --- verification --------------------------------------------------------
  for (const issue of issues) {
    if (rnd() < 0.12) continue; // a few issues nobody has confirmed yet

    const voters = [...citizens].sort(() => rnd() - 0.5).slice(0, intBetween(2, 9));
    let confirms = 0;
    let disputes = 0;
    let weightedConfirms = 0;
    let weightedDisputes = 0;

    for (const voter of voters) {
      const vote = rnd() < 0.86 ? 'confirm' : 'dispute';
      const weight = Math.max(0.25, Math.min(voter.trust ?? 1, 5));
      await Verification.create({
        issueId: issue._id,
        userId: voter._id,
        vote,
        weight,
        distanceM: intBetween(20, 380),
        at: new Date(new Date(issue.firstReportAt).valueOf() + between(1, 48) * 3600_000),
      });
      if (vote === 'confirm') {
        confirms += 1;
        weightedConfirms += weight;
      } else {
        disputes += 1;
        weightedDisputes += weight;
      }
    }

    issue.confirms = confirms;
    issue.disputes = disputes;
    issue.weightedConfirms = weightedConfirms;
    issue.weightedDisputes = weightedDisputes;

    if (weightedConfirms >= env.VERIFY_THRESHOLD && weightedConfirms > weightedDisputes * 2) {
      issue.status = 'verified';
      issue.verifiedAt = new Date(new Date(issue.firstReportAt).valueOf() + between(4, 60) * 3600_000);
      await StatusEvent.create({
        issueId: issue._id,
        status: 'verified',
        from: 'reported',
        note: `Confirmed by ${confirms} nearby ${confirms === 1 ? 'citizen' : 'citizens'}`,
        actorName: 'Community',
        actorRole: 'verifier',
        at: issue.verifiedAt,
      });
    }
    await issue.save();
  }

  // --- lifecycle -----------------------------------------------------------
  // Each stage is placed as a fraction of the time the issue has actually
  // existed, not as a fixed number of hours after the previous one. Fixed
  // offsets overshoot "now" for anything reported recently, which left every
  // issue stuck at `assigned` and the dashboard reading a 0% resolution rate.
  const verified = await Issue.find({ status: 'verified' });
  for (const issue of verified) {
    const roll = rnd();
    if (roll < 0.18) continue; // still waiting for the authority to pick it up

    const firstAt = new Date(issue.firstReportAt).valueOf();
    const ageMs = Math.max(3600_000, Date.now() - firstAt);
    const at = (fraction: number) => new Date(firstAt + ageMs * fraction * between(0.85, 1.15));

    const owner = staff.find((s) => s.department === issue.department) ?? pick(staff);
    const assignedAt = at(0.25);
    const slaHours = CATEGORY_META[issue.category as Category].slaHours;

    issue.status = 'assigned';
    issue.assigneeId = owner._id as typeof issue.assigneeId;
    issue.assignedAt = assignedAt;
    issue.slaDueAt = new Date(assignedAt.valueOf() + slaHours * 3600_000);
    await StatusEvent.create({
      issueId: issue._id,
      status: 'assigned',
      from: 'verified',
      note: `Assigned to ${owner.name}, ${issue.department}`,
      actorId: admin._id,
      actorName: admin.name,
      actorRole: 'admin',
      at: assignedAt,
    });

    if (roll < 0.38) {
      await issue.save();
      continue; // assigned, nobody has started yet
    }

    const startedAt = at(0.5);
    issue.status = 'in_progress';
    await StatusEvent.create({
      issueId: issue._id,
      status: 'in_progress',
      from: 'assigned',
      note: pick([
        'Crew scheduled, materials requisitioned.',
        'Work has started on site.',
        'Contractor mobilised this morning.',
      ]),
      actorId: owner._id,
      actorName: owner.name,
      actorRole: 'authority',
      at: startedAt,
    });

    if (roll < 0.58) {
      await issue.save();
      continue; // work under way
    }

    photoSeed += 1;
    const resolvedAt = at(0.78);
    issue.status = 'resolved';
    issue.resolvedAt = resolvedAt;
    issue.proofPhotos = [photoFor(issue.category as Category, photoSeed)] as typeof issue.proofPhotos;
    // Most reporters sign the fix off; some never come back to confirm it.
    if (rnd() < 0.7) issue.citizenSignedOffAt = at(0.9);

    await StatusEvent.create({
      issueId: issue._id,
      status: 'resolved',
      from: 'in_progress',
      note: pick([
        'Repair completed and inspected.',
        'Cleared and the site was checked afterwards.',
        'Fixed. Photo of the completed work attached.',
      ]),
      actorId: owner._id,
      actorName: owner.name,
      actorRole: 'authority',
      proofPhotos: issue.proofPhotos,
      at: resolvedAt,
    });
    await issue.save();
  }

  // Backdate the issue rows so the 30-day trend line has real shape, and
  // recompute priority now that report counts and ages are final.
  const all = await Issue.find({});
  for (const issue of all) {
    // Raw driver, for the same reason as the report backdating above.
    await Issue.collection.updateOne(
      { _id: issue._id as never },
      { $set: { createdAt: issue.firstReportAt } },
    );
    await recomputePriority(String(issue._id));
  }

  // A couple of reports left in the review queue, so the moderator console has
  // something to show on first run.
  const holdBack = await Report.find({ mergeDecision: 'auto' }).limit(3);
  for (const report of holdBack) {
    await Report.updateOne(
      { _id: report._id },
      { $set: { mergeDecision: 'pending', issueId: null, mergeConfidence: Number(between(0.52, 0.7).toFixed(3)) } },
    );
    await Issue.updateOne({ _id: report.issueId }, { $pull: { reportIds: report._id }, $inc: { reportCount: -1 } });
  }

  const counts = {
    wards: await Ward.countDocuments(),
    users: await User.countDocuments(),
    reports: await Report.countDocuments(),
    issues: await Issue.countDocuments(),
    resolved: await Issue.countDocuments({ status: 'resolved' }),
    inReview: await Report.countDocuments({ mergeDecision: 'pending', issueId: null }),
    verifications: await Verification.countDocuments(),
    events: await StatusEvent.countDocuments(),
  };

  const statuses = await Issue.aggregate<{ _id: Status; n: number }>([{ $group: { _id: '$status', n: { $sum: 1 } } }]);

  console.log('\n  Seed complete\n');
  console.table(counts);
  console.table(statuses.map((s) => ({ status: s._id, issues: s.n })));
  const signInLines = [
    `    Admin      ${admin.email}`,
    ...staff.map((member) => `    Authority  ${member.email}  (${member.department})`),
    `    Citizen    ${citizens[0]!.email}`,
  ];

  console.log(`
  Sign in with an email address and a password — no confirmation step.
  Every seeded account uses the same password: ${env.SEED_PASSWORD}

${signInLines.join('\n')}

  Anyone can create their own citizen account from the sign-up page.
  An authority account additionally needs the staff code (STAFF_SIGNUP_CODE).
`);

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
