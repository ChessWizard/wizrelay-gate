/**
 * A running panel, asked the questions a browser would ask.
 *
 * The unit tests cover the rules; this covers the wiring — that a route exists, that it
 * refuses a request with no session, that a moved page still answers at its old address.
 * Those are the failures a type checker cannot see and a unit test does not reach, and
 * every one of them has happened here at least once.
 *
 * It talks to a panel the caller started and it signs in as nobody: everything here is
 * either public or must be refused. Nothing is written, so it is safe against a panel
 * holding real work.
 *
 * It warms a page or two before it starts. A container answers its health check before it
 * has rendered anything, and the first render of a route takes a moment — without the
 * warm-up the first check to touch a page fails on a cold panel and passes on the next
 * run, which is the least useful kind of test there is.
 */
const BASE = process.argv[2] ?? 'http://127.0.0.1:3100';

const checks = [];
let failed = 0;

function check(name, run) {
  checks.push({ name, run });
}

async function get(path, init) {
  const response = await fetch(`${BASE}${path}`, { redirect: 'manual', ...init });
  return { status: response.status, location: response.headers.get('location'), response };
}

check('the panel answers', async () => {
  const { status } = await get('/api/health');
  if (status !== 200) throw new Error(`health said ${status}`);
});

check('a page with no session goes to the login screen', async () => {
  const { status, location } = await get('/');
  const ok = status === 307 || status === 302 || status === 200;
  if (!ok) throw new Error(`/ said ${status}`);
  if ((status === 307 || status === 302) && !location?.includes('/login')) {
    throw new Error(`/ redirected to ${location}`);
  }
});

check('the login screen renders', async () => {
  const { status, response } = await get('/login');
  if (status !== 200) throw new Error(`/login said ${status}`);
  const body = await response.text();
  if (!body.includes('<form')) throw new Error('the login screen has no form');
});

check('a console stream refuses a request with no session', async () => {
  const { status } = await get('/api/relays/CU-1/gates/research/stream?from=0');
  if (status !== 401) throw new Error(`the stream said ${status}, not 401`);
});

check('an unknown gate is not found before anything else happens', async () => {
  const { status } = await get('/api/relays/CU-1/gates/nosuchgate/stream');
  if (status !== 404) throw new Error(`said ${status}, not 404`);
});

check('the agent endpoints refuse a request with no token', async () => {
  const calls = [
    ['/api/agent/hello', 'POST'],
    ['/api/agent/jobs', 'GET'],
  ];
  for (const [path, method] of calls) {
    const { status } = await get(path, method === 'POST' ? { method, body: '{}' } : undefined);
    if (status !== 401) throw new Error(`${path} said ${status}, not 401`);
  }
});

check('the agent downloads from its short address', async () => {
  const { status, response } = await get('/agent');
  if (status !== 200) throw new Error(`/agent said ${status}`);
  const body = await response.text();
  if (!body.includes('wizrelay-agent')) throw new Error('/agent served something else');
});

check('the old package list still answers at its old address', async () => {
  const { status, location } = await get('/packages');
  if (status !== 307 && status !== 308 && status !== 302) {
    throw new Error(`/packages said ${status}, not a redirect`);
  }
  if (!location?.includes('/relays')) throw new Error(`/packages went to ${location}`);
});

check('a search keeps its query across the move', async () => {
  const { location } = await get('/packages?q=role%3Acore');
  if (!location?.includes('q=')) throw new Error(`the query was dropped: ${location}`);
});

check('the brand files are served without a session', async () => {
  const { status } = await get('/api/brand/logo');
  if (status !== 200 && status !== 404) throw new Error(`brand said ${status}`);
});

for (const path of ['/login', '/relays']) {
  try {
    await get(path);
  } catch {
  }
}

const only = process.argv[3];
for (const { name, run } of checks) {
  if (only && !name.includes(only)) continue;
  try {
    await run();
    console.log(`  ok    ${name}`);
  } catch (error) {
    failed += 1;
    console.log(`  FAIL  ${name}\n          ${error.message}`);
  }
}

console.log(`\n${checks.length - failed}/${checks.length} passed against ${BASE}`);
process.exit(failed === 0 ? 0 : 1);
