// scripts/api-test.js — runs T1–T28 from PERSON_A_LEAD.md section 8.1, in order.
//   npm run test:api                              local: reseeds, then tests http://localhost:8080
//   GW=https://your-gateway.onrender.com node scripts/api-test.js     deployed (seed Atlas first)
// Needs freshly seeded data, because it walks one volunteer through the whole loop.
const ids = require('../../shared/ids');

const GW = (process.env.GW || 'http://localhost:8080').replace(/\/$/, '');
const results = [];

async function call(method, path, { token, body, headers = {} } = {}) {
  const res = await fetch(GW + path, {
    method,
    headers: {
      ...(body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, data: json?.data, error: json?.error, raw: json };
}

// check(name, condition, detail). waitsForB marks checks that need Person B's services.
function check(name, pass, detail = '', waitsForB = false) {
  const state = pass ? 'PASS' : waitsForB ? 'WAIT' : 'FAIL';
  results.push(state);
  console.log(`${state}  ${name}${pass ? '' : `  -> ${detail}`}`);
}

async function login(userId) {
  const r = await call('POST', '/api/auth/demo-login', { body: { userId } });
  return r.data?.token;
}

(async () => {
  console.log(`Testing ${GW}\n`);

  let r = await call('GET', '/health/all');
  check('T1  services alive', r.raw?.core && r.raw?.reflect && r.raw?.bridge, JSON.stringify(r.raw), r.raw?.core === true);

  r = await call('GET', '/api/auth/users');
  check('T2  user list is public', r.status === 200 && r.data?.length >= 4, `status ${r.status}`);

  r = await call('GET', '/api/needs');
  check('T3  token is required', r.status === 401, `status ${r.status}`);

  r = await call('POST', '/api/auth/demo-login', { body: { userId: ids.users.newVolunteer } });
  const VOL = r.data?.token;
  check('T4  demo login', r.status === 200 && !!VOL, `status ${r.status}`);

  r = await call('GET', '/api/auth/me', { token: VOL });
  check('T5  me', r.data?._id === ids.users.newVolunteer, JSON.stringify(r.data));

  r = await call('GET', '/api/needs?day=Saturday&maxKm=5&interest=teaching', { token: VOL });
  const found = r.data || [];
  check('T6  filter', found.length >= 1 && found.length <= 3 && found.every(n => n.fitReason),
    `${found.length} needs: ${JSON.stringify(found.map(n => n.fitReason))}`);

  r = await call('GET', '/api/needs?day=Saturday&maxKm=100&interest=teaching', { token: VOL });
  check('T7  never more than 3', r.status === 200 && r.data.length <= 3, `${r.data?.length} needs`);

  const needId = found[0]?._id;
  r = await call('GET', `/api/needs/${needId}`, { token: VOL });
  const n = r.data || {};
  check('T8  need detail', n.want && n.serveUsWell && n.youWillLearn && n.rhythm?.day && n.verified === true, JSON.stringify(n));

  r = await call('POST', `/api/needs/${needId}/visits`, { token: VOL });
  const visitId = r.data?._id;
  check('T9  request visit', r.status === 201 && r.data?.status === 'requested', `status ${r.status} ${JSON.stringify(r.error)}`);

  r = await call('POST', `/api/needs/${needId}/visits`, { token: VOL });
  check('T10 no duplicate visit', r.status === 409, `status ${r.status}`);

  r = await call('POST', '/api/commitments', { token: VOL, body: { visitId, weeks: 4, sentence: 'Too early' } });
  check('T11 commit too early', r.status === 409, `status ${r.status}`);

  r = await call('PATCH', `/api/visits/${visitId}/heard`, { token: VOL, body: { text: 'They wanted to talk more than to read.' } });
  check('T12 heard', r.data?.status === 'visited', `status ${r.status} ${JSON.stringify(r.data || r.error)}`);

  r = await call('PATCH', `/api/visits/${visitId}/decision`, { token: VOL, body: { yes: true } });
  check('T13 volunteer yes', r.data?.volunteerYes === true && r.data?.status === 'visited', JSON.stringify(r.data || r.error));

  const COORD = await login(ids.users.coordinator);
  r = await call('PATCH', `/api/visits/${visitId}/decision`, { token: COORD, body: { yes: true } });
  check('T14 coordinator yes', r.data?.status === 'agreed', JSON.stringify(r.data || r.error));

  r = await call('POST', '/api/commitments', { token: VOL, body: { visitId, weeks: 4, sentence: 'I want to learn to listen.' } });
  const c = r.data || {};
  const cid = c._id;
  check('T15 commit', r.status === 201 && c.sessions?.length === 4 && c.sessions.every(s => s.status === 'upcoming') && c.currentWeek === 1,
    `status ${r.status} ${JSON.stringify(r.data || r.error)}`);

  r = await call('GET', `/api/needs/${needId}`, { token: VOL });
  const again = await call('GET', '/api/needs?day=Saturday&maxKm=5&interest=teaching', { token: VOL });
  check('T16 need is filled', r.data?.status === 'filled' && !again.data.some(x => x._id === needId), `status ${r.data?.status}`);

  r = await call('POST', `/api/commitments/${cid}/absence`, { token: VOL, body: { week: 2 } });
  check('T17 absence', r.data?.sessions?.find(s => s.week === 2)?.status === 'gap', JSON.stringify(r.data?.sessions || r.error));

  const MEMBER = await login(ids.users.circleMember);
  r = await call('POST', `/api/commitments/${cid}/cover`, { token: MEMBER, body: { week: 2 } });
  const w2 = r.data?.sessions?.find(s => s.week === 2);
  check('T18 cover', w2?.status === 'covered' && w2?.coveredBy === ids.users.circleMember, JSON.stringify(w2 || r.error));

  const OUTSIDER = await login(ids.users.otherVolunteer);
  r = await call('POST', `/api/commitments/${cid}/cover`, { token: OUTSIDER, body: { week: 3 } });
  check('T19 cover by outsider', r.status === 403, `status ${r.status}`);

  r = await call('POST', '/api/demo/advance', { token: COORD, body: { commitmentId: cid, toWeek: 4 } });
  const s = Object.fromEntries((r.data?.sessions || []).map(x => [x.week, x.status]));
  check('T20 time travel', r.data?.currentWeek === 4 && s[1] === 'served' && s[3] === 'served' && s[2] === 'covered', JSON.stringify(s));

  r = await call('PATCH', `/api/commitments/${cid}/continue`, { token: VOL, body: { choice: 'continue' } });
  check('T21 continue too early', r.status === 409, `status ${r.status}`);

  r = await call('POST', `/api/commitments/${cid}/invitation`, { token: COORD, body: { text: 'The children asked if you are coming next month.' } });
  check('T22 invitation', !!r.data?.invitation?.sentAt, JSON.stringify(r.data?.invitation || r.error));

  r = await call('POST', `/api/commitments/${cid}/invitation`, { token: VOL, body: { text: 'Inviting myself' } });
  check('T23 invitation by volunteer', r.status === 403, `status ${r.status}`);

  r = await call('PATCH', `/api/commitments/${cid}/continue`, { token: VOL, body: { choice: 'continue' } });
  const fresh = (r.data?.sessions || []).filter(x => x.week > 4);
  check('T24 continue', r.data?.weeks === 8 && fresh.length === 4 && fresh.every(x => x.status === 'upcoming'), JSON.stringify(r.data || r.error));

  const newNeed = {
    title: 'Test need', want: 'x', serveUsWell: 'x', youWillLearn: 'x', groupSize: 5, interestTags: ['teaching'],
    rhythm: { day: 'Sunday', start: '10:00', end: '11:00' }, weeks: 4, place: 'Test',
  };
  r = await call('POST', '/api/needs', { token: COORD, body: { ...newNeed, consent: { readBack: false } } });
  check('T25 post need needs consent', r.status === 400, `status ${r.status}`);

  r = await call('POST', '/api/needs', { token: VOL, body: { ...newNeed, consent: { readBack: true } } });
  check('T26 post need by volunteer', r.status === 403, `status ${r.status}`);

  const wisdom = await call('GET', '/api/wisdom/today', { token: VOL });
  const draft = await call('POST', '/api/bridge/draft-need', { token: COORD, body: { text: 'test', language: 'en' } });
  const reached = x => ![404, 502, 503].includes(x.status);
  check('T27 routing to B', reached(wisdom) && reached(draft), `wisdom ${wisdom.status}, bridge ${draft.status}`, true);

  const fake = { 'x-user-role': 'coordinator', 'x-user-id': ids.users.coordinator };
  const meFaked = await call('GET', '/api/auth/me', { token: VOL, headers: fake });
  r = await call('POST', `/api/commitments/${cid}/invitation`, { token: VOL, headers: fake, body: { text: 'Faked' } });
  check('T28 headers cannot be faked', meFaked.data?._id === ids.users.newVolunteer && r.status === 403,
    `me=${meFaked.data?._id}, invitation status ${r.status}`);

  const count = st => results.filter(x => x === st).length;
  console.log(`\n${count('PASS')} passed, ${count('FAIL')} failed, ${count('WAIT')} waiting for Person B's services`);
  process.exit(count('FAIL') ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
