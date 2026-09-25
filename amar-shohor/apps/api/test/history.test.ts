import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Types } from 'mongoose';
import { Issue, Report } from '../src/models';
import { issuesRouter } from '../src/routes/issues';
import { statusEvent } from '../src/serialize';

// Exercise the route with an isolated database boundary; never write to the
// developer's database or require real user credentials.
test('history scope, closed statuses, pagination and validation', async (t) => {
  const handler = issuesRouter.stack.find((layer) => layer.route?.path === '/history').route.stack[0].handle;
  let observed: Record<string, unknown> = {};
  let skipped = 0;
  let reporter: unknown;
  t.mock.method(Report, 'distinct', async (_field: string, filter: unknown) => {
    reporter = filter;
    return ['reported-issue'];
  });
  t.mock.method(Issue, 'find', (filter: Record<string, unknown>) => {
    observed = filter;
    const query = {
      sort: () => query,
      skip: (value: number) => { skipped = value; return query; },
      limit: () => query,
      lean: async () => [],
    };
    return query;
  });
  t.mock.method(Issue, 'countDocuments', async () => 41);
  const run = (role?: string, query = {}, extra = {}) => new Promise<any>((resolve, reject) => {
    handler({ query, user: role ? { id: 'viewer', role, wardIds: [], ...extra } : undefined }, { json: resolve }, reject);
  });

  await assert.rejects(run(), { status: 401 });
  const citizen = await run('citizen');
  assert.deepEqual(reporter, { reporterId: 'viewer' });
  assert.deepEqual(observed, { _id: { $in: ['reported-issue'] } });
  assert.equal(citizen.total, 41);
  assert.equal(citizen.limit, 20);
  await run('verifier');
  assert.deepEqual(observed, { _id: { $in: ['reported-issue'] } });

  await run('authority', {}, { department: 'roads', wardIds: ['ward-a'] });
  assert.deepEqual(observed, { department: 'roads', wardId: { $in: ['ward-a'] } });
  await assert.rejects(run('authority'), { status: 403 });
  await run('admin');
  assert.deepEqual(observed, {}); // Includes resolved and rejected issues.
  await run('admin', { status: 'resolved', page: '2' });
  assert.deepEqual(observed, { status: 'resolved' });
  assert.equal(skipped, 20);
  await run('admin', { status: 'rejected' });
  assert.equal(observed.status, 'rejected');
  await assert.rejects(run('admin', { status: 'invalid' }), { status: 400 });
  await assert.rejects(run('admin', { page: '-1' }), { status: 400 });
  await assert.rejects(run('admin', { page: '1.5' }), { status: 400 });
});

test('history preserves previous status, actor, note and timestamp', () => {
  const event = statusEvent({
    _id: new Types.ObjectId(), issueId: new Types.ObjectId(),
    from: 'resolved', status: 'assigned', actorName: 'Reporting citizen',
    actorRole: 'citizen', note: 'The repair did not hold.',
    at: new Date('2026-09-26T08:30:00Z'),
  });
  assert.equal(event.from, 'resolved');
  assert.equal(event.status, 'assigned');
  assert.equal(event.actor.name, 'Reporting citizen');
  assert.equal(event.note, 'The repair did not hold.');
  assert.equal(event.at, '2026-09-26T08:30:00.000Z');
});
