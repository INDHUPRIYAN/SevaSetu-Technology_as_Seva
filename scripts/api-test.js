// scripts/api-test.js — runs T1–T28 from PERSON_A_LEAD.md section 8.1, in order.
//   npm run test:api                              local: reseeds, then tests http://localhost:8080
//   GW=https://your-gateway.onrender.com node scripts/api-test.js     deployed (seed Atlas first)
// Needs freshly seeded data, because it walks one volunteer through the whole loop.
const ids = require('../seed/ids');

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


function check(name, pass, detail = '') {
  const state = pass ? 'PASS' : 'FAIL';
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
  check('T1  services alive', r.raw?.core && r.raw?.reflect && r.raw?.bridge, JSON.stringify(r.raw));

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
  r = await call('POST', '/api/needs', { token: COORD, body: { ...newNeed, consent: { readBack: false, coordinatorConsent: true } } });
  check('T25 post need needs consent', r.status === 400, `status ${r.status}`);

  r = await call('POST', '/api/needs', { token: COORD, body: { ...newNeed, consent: { readBack: true } } });
  check('T25b community confirmation alone is not enough (coordinator consent too)', r.status === 400, `status ${r.status}`);

  r = await call('POST', '/api/needs', { token: VOL, body: { ...newNeed, consent: { readBack: true, coordinatorConsent: true } } });
  check('T26 post need by volunteer', r.status === 403, `status ${r.status}`);

  const wisdom = await call('GET', '/api/wisdom/today', { token: VOL });
  const draft = await call('POST', '/api/bridge/draft-need', { token: COORD, body: { text: 'test', language: 'en' } });
  const reached = x => ![404, 502, 503].includes(x.status);
  check('T27 routing to reflect and bridge', reached(wisdom) && reached(draft), `wisdom ${wisdom.status}, bridge ${draft.status}`);

  const fake = { 'x-user-role': 'coordinator', 'x-user-id': ids.users.coordinator };
  const meFaked = await call('GET', '/api/auth/me', { token: VOL, headers: fake });
  r = await call('POST', `/api/commitments/${cid}/invitation`, { token: VOL, headers: fake, body: { text: 'Faked' } });
  check('T28 headers cannot be faked', meFaked.data?._id === ids.users.newVolunteer && r.status === 403,
    `me=${meFaked.data?._id}, invitation status ${r.status}`);

  console.log('\nProduct rules');

  // AI only drafts: asking bridge for a draft never creates a need
  const needsBefore = (await call('GET', '/api/coordinator/overview', { token: COORD })).data.needs.length;
  r = await call('POST', '/api/bridge/draft-need', { token: COORD, body: { text: '10 students want help with maths on Sunday', language: 'en' } });
  const needsAfter = (await call('GET', '/api/coordinator/overview', { token: COORD })).data.needs.length;
  check('X1  AI draft never publishes', r.status === 200 && r.data?.draft?.title && needsAfter === needsBefore,
    `draft ${r.status}, needs ${needsBefore} -> ${needsAfter}`);

  // "I cannot come", with a note: the circle member sees the note on the open gap
  r = await call('POST', `/api/commitments/${cid}/absence`, { token: VOL, body: { week: 5, note: 'We stopped at chapter 3.' } });
  const circleView = await call('GET', '/api/circles/mine', { token: MEMBER });
  const gap = circleView.data?.openGaps?.find(g => g.commitmentId === cid && g.week === 5);
  check('X2  absence note reaches the circle', r.status === 200 && gap?.note === 'We stopped at chapter 3.', JSON.stringify(gap || r.error));

  // Pause needs a real future return date
  r = await call('PATCH', `/api/commitments/${cid}/continue`, { token: VOL, body: { choice: 'pause' } });
  const noDate = r.status;
  r = await call('PATCH', `/api/commitments/${cid}/continue`, { token: VOL, body: { choice: 'pause', returnDate: '2020-01-01' } });
  const pastDate = r.status;
  const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);
  r = await call('PATCH', `/api/commitments/${cid}/continue`, { token: VOL, body: { choice: 'pause', returnDate: future } });
  check('X3  pause stores the return date', noDate === 400 && pastDate === 400 && r.data?.status === 'paused' && r.data?.pausedUntil === future,
    `no date ${noDate}, past ${pastDate}, then ${r.data?.status} until ${r.data?.pausedUntil}`);

  // Finish needs a handover; the need opens again with the note, and the circle sees it
  r = await call('PATCH', `/api/commitments/${cid}/continue`, { token: VOL, body: { choice: 'finish' } });
  const noHandover = r.status;
  const handover = 'The students love reading aloud in pairs. Start with the story they choose.';
  r = await call('PATCH', `/api/commitments/${cid}/continue`, { token: VOL, body: { choice: 'finish', handover } });
  const needNow = await call('GET', `/api/needs/${needId}`, { token: OUTSIDER });
  const circleNow = await call('GET', '/api/circles/mine', { token: MEMBER });
  const afterFinish = await call('PATCH', `/api/commitments/${cid}/continue`, { token: VOL, body: { choice: 'continue' } });
  check('X4  finish needs a handover; need reopens; circle and next volunteer see it',
    noHandover === 400 && r.data?.status === 'finished' && needNow.data?.status === 'open'
      && needNow.data?.handover?.note === handover && circleNow.data?.handovers?.some(h => h.note === handover) && afterFinish.status === 409,
    `no handover ${noHandover}, status ${r.data?.status}, need ${needNow.data?.status}, circle sees ${!!circleNow.data?.handovers?.length}, continue after finish ${afterFinish.status}`);

  // The private diary through the gateway: only the writer, even with faked headers
  const ARJUN = await login(ids.users.seededVolunteer);
  const diary = token => call('GET', `/api/reflect/entries?commitmentId=${ids.commitments.seeded}`, { token, headers: { 'x-user-id': ids.users.seededVolunteer } });
  const [own, other, coord, member] = await Promise.all([ARJUN, OUTSIDER, COORD, MEMBER].map(diary));
  check('X5  diary: only the writer can read it (faked x-user-id ignored)',
    own.data?.length === 1 && other.data?.length === 0 && coord.data?.length === 0 && member.data?.length === 0,
    `own ${own.data?.length}, outsider ${other.data?.length}, coordinator ${coord.data?.length}, circle member ${member.data?.length}`);

  // No gamification and no personal details of people served, in any response
  const BANNED_KEYS = /^(hours?|points?|rank(ing)?|score|streak|badges?|leaderboard|sentiment|age|income|caste|religion|photo\w*|beneficiar\w*)$/i;
  const keysIn = (v, out = []) => {
    if (Array.isArray(v)) v.forEach(x => keysIn(x, out));
    else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { if (BANNED_KEYS.test(k)) out.push(k); keysIn(x, out); }
    return out;
  };
  const sample = await Promise.all([
    call('GET', '/api/needs?day=Saturday&maxKm=100&interest=teaching', { token: VOL }),
    call('GET', `/api/needs/${needId}`, { token: VOL }),
    call('GET', '/api/commitments/mine', { token: VOL }),
    call('GET', '/api/visits/mine', { token: COORD }),
    call('GET', '/api/circles/mine', { token: MEMBER }),
    call('GET', '/api/coordinator/overview', { token: COORD }),
    call('GET', `/api/reflect/entries?commitmentId=${ids.commitments.seeded}`, { token: ARJUN }),
    call('GET', `/api/reflect/then-and-now?commitmentId=${ids.commitments.seeded}`, { token: ARJUN }),
    call('GET', '/api/wisdom', { token: VOL }),
  ]);
  const bannedKeys = keysIn(sample.map(x => x.data));
  check('X6  no hours, points, ranks, scores or personal fields in any response', bannedKeys.length === 0, `found ${[...new Set(bannedKeys)]}`);

  const count = st => results.filter(x => x === st).length;
  console.log(`\n${count('PASS')} passed, ${count('FAIL')} failed`);
  process.exit(count('FAIL') ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
