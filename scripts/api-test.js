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

  // One Visit ramp: the volunteer is never asked first; the community invites or not
  r = await call('PATCH', `/api/visits/${visitId}/decision`, { token: VOL, body: { yes: true } });
  check('T13 volunteer cannot send an invitation', r.status === 403, `status ${r.status}`);

  r = await call('POST', '/api/commitments', { token: VOL, body: { visitId, weeks: 4, sentence: 'No invitation yet' } });
  check('T13b commit without a community invitation', r.status === 409, `status ${r.status}`);

  const COORD = await login(ids.users.coordinator);
  r = await call('PATCH', `/api/visits/${visitId}/decision`, { token: COORD, body: { yes: true, text: 'They would like you to come back.' } });
  check('T14 community invites', r.data?.status === 'invited' && r.data?.invitation?.text, JSON.stringify(r.data || r.error));

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

  const wisdom = await call('GET', '/api/wisdom/why/no-ranks', { token: VOL });   // answers even before any quote is verified
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

  // Non-attachment moments exist in plain words, with no quotation at all
  const moments = await Promise.all(['declined', 'closed', 'finished'].map(k => call('GET', `/api/wisdom/moment/${k}`, { token: VOL })));
  check('X17 declined / closed / finished moments: plain words, no quote, no "sorry"',
    moments.every(m => m.data?.interpretation && m.data?.practice && m.data?.teaching === null && !/sorry/i.test(m.data.interpretation + m.data.practice)),
    moments.map(m => m.status).join(','));

  // "What did they give you?": written once at finish, read back only by the writer
  const gave = 'Their patience with my Tamil.';
  const wrote = await call('POST', '/api/reflect/received', { token: VOL, body: { commitmentId: cid, text: gave } });
  const twiceGave = await call('POST', '/api/reflect/received', { token: VOL, body: { commitmentId: cid, text: 'Again' } });
  const [mineGave, otherGave] = await Promise.all([VOL, MEMBER].map(token => call('GET', `/api/reflect/received?commitmentId=${cid}`, { token })));
  check('X18 "what did they give you" is written once and private',
    wrote.status === 201 && twiceGave.status === 409 && mineGave.data?.text === gave && otherGave.data === null,
    `write ${wrote.status}, again ${twiceGave.status}, own ${JSON.stringify(mineGave.data)}, other ${JSON.stringify(otherGave.data)}`);

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

  // "What the group wanted to say": coordinator only, once the seva has finished, never money or a word we
  // avoid, only after the Dignity Check was run and approved; stored in its own language and shown to the volunteer
  const words = (token, body) => call('POST', `/api/commitments/${cid}/community-words`, { token, body });
  const wByVol = await words(VOL, { text: 'They miss you.', dignityChecked: true });
  const wMoney = await words(COORD, { text: 'They said thank you for the income of 5000.', dignityChecked: true });
  const wAvoid = await words(COORD, { text: 'The poor children miss you.', dignityChecked: true });
  const wUnchecked = await words(COORD, { text: 'They said the Saturday mornings are theirs now.' });
  const wName = await call('POST', '/api/bridge/dignity-check', { token: COORD, body: { text: 'Ravi said he misses you, his income is 5000.' } });
  const wOk = await words(COORD, { text: 'சனிக்கிழமை காலை இப்போது எங்களுடையது என்றார்கள்.', language: 'ta', dignityChecked: true });
  const wTwice = await words(COORD, { text: 'Again', dignityChecked: true });
  const seenByVol = await call('GET', `/api/commitments/${cid}`, { token: VOL });
  check('X20 "what the group wanted to say": coordinator only, after finish, checked; money or a name is rejected or flagged',
    wByVol.status === 403 && wMoney.status === 400 && wAvoid.status === 400 && wUnchecked.status === 400
      && wName.data?.flags?.length >= 1 && wOk.status === 200 && wTwice.status === 409
      && seenByVol.data?.communityWords?.language === 'ta' && seenByVol.data?.communityWords?.text === 'சனிக்கிழமை காலை இப்போது எங்களுடையது என்றார்கள்.',
    `volunteer ${wByVol.status}, money ${wMoney.status}, avoid ${wAvoid.status}, unchecked ${wUnchecked.status}, name flags ${wName.data?.flags?.length}, ok ${wOk.status} ${JSON.stringify(wOk.error || '')}, twice ${wTwice.status}, seen ${JSON.stringify(seenByVol.data?.communityWords)}`);

  // VoiceBridge through the gateway: coordinators only; with no key the rules answer (source "rules"), one
  // question at a time, in the selected language; the context is this coordinator's own cards and nothing personal
  const vbByVol = await call('POST', '/api/bridge/voicebridge', { token: VOL, body: { language: 'ta', turns: [{ role: 'coordinator', text: 'உதவி' }] } });
  const vb = await call('POST', '/api/bridge/voicebridge', { token: COORD, body: { language: 'ta', turns: [{ role: 'coordinator', text: 'பள்ளி குழந்தைகளுக்கு ஆங்கிலம் படிக்க உதவி வேண்டும்' }], draft: null, context: {} } });
  const overview = await call('GET', '/api/coordinator/overview', { token: COORD });
  const ctxCards = (overview.data?.needs || []).slice(0, 5);
  const seededOrPosted = ctxCards.every(n => n.title && n.rhythm && typeof n.weeks === 'number');
  const ctxKeys = new Set(ctxCards.flatMap(n => Object.keys(n)));
  check('X22 voicebridge: volunteers 403; no key → rules, one Tamil question; context = own cards, no personal fields',
    vbByVol.status === 403 && vb.status === 200 && vb.data?.source === 'rules' && vb.data?.question?.field === 'place'
      && /[஀-௿]/.test(vb.data?.question?.text || '') && ctxCards.length > 0 && seededOrPosted
      && ![...ctxKeys].some(k => /^(name|age|income|caste|religion|health|photo|phone|address)$/i.test(k)),
    `volunteer ${vbByVol.status}, status ${vb.status}, source ${vb.data?.source}, question ${JSON.stringify(vb.data?.question)}, context keys ${[...ctxKeys]}`);

  // The private diary through the gateway: only the writer, even with faked headers
  const ARJUN = await login(ids.users.seededVolunteer);
  const diary = token => call('GET', `/api/reflect/entries?commitmentId=${ids.commitments.seeded}`, { token, headers: { 'x-user-id': ids.users.seededVolunteer } });
  const [own, other, coord, member] = await Promise.all([ARJUN, OUTSIDER, COORD, MEMBER].map(diary));
  check('X5  diary: only the writer can read it (faked x-user-id ignored)',
    own.data?.length === 1 && other.data?.length === 0 && coord.data?.length === 0 && member.data?.length === 0,
    `own ${own.data?.length}, outsider ${other.data?.length}, coordinator ${coord.data?.length}, circle member ${member.data?.length}`);

  // The Sankalpa is sealed once and read back only by its writer
  const sankalpa = token => call('GET', `/api/reflect/sankalpa?commitmentId=${ids.commitments.seeded}`, { token, headers: { 'x-user-id': ids.users.seededVolunteer } });
  const [mine, theirs, coordS] = await Promise.all([ARJUN, MEMBER, COORD].map(sankalpa));
  const reseal = await call('POST', '/api/reflect/sankalpa', { token: ARJUN, body: { commitmentId: ids.commitments.seeded, text: 'Changed my mind' } });
  check('X8  sankalpa: sealed once, only the writer reads it',
    !!mine.data?.text && theirs.data === null && coordS.data === null && reseal.status === 409,
    `own ${!!mine.data?.text}, circle member ${JSON.stringify(theirs.data)}, coordinator ${JSON.stringify(coordS.data)}, reseal ${reseal.status}`);

  // My Seva so far, across commitments: the owner's first and latest words and Sankalpas; nothing for anyone else;
  // no counts or totals in the answer
  const mySeva = token => call('GET', '/api/reflect/my-seva', { token, headers: { 'x-user-id': ids.users.seededVolunteer } });
  const [soFar, soFarOther, soFarCoord] = await Promise.all([ARJUN, MEMBER, COORD].map(mySeva));
  check('X21 cross-commitment Then and Now: owner only, no counts',
    soFar.data?.first?.text === 'I kept correcting them.' && soFar.data?.sankalpas?.length === 1 && soFar.data?.sankalpas[0].text === mine.data?.text
      && soFarOther.data?.first === null && soFarOther.data?.sankalpas?.length === 0 && soFarCoord.data?.first === null
      && !Object.keys(soFar.data).some(k => /count|total|streak|score/i.test(k)),
    `own ${JSON.stringify(soFar.data)}, other ${JSON.stringify(soFarOther.data)}, coordinator ${JSON.stringify(soFarCoord.data)}`);

  // Silent Seva: "Session over" marks this week served; only the volunteer, never a week still to come
  const served = (token, week) => call('POST', `/api/commitments/${ids.commitments.seeded}/served`, { token, body: { week } });
  const [byOther, notYet, mineNow] = [await served(MEMBER, 2), await served(ARJUN, 3), await served(ARJUN, 2)];
  check('X10 silent seva marks only this week served, only by the volunteer',
    byOther.status === 403 && notYet.status === 409 && mineNow.data?.sessions?.find(x => x.week === 2)?.status === 'served',
    `other ${byOther.status}, future ${notYet.status}, own ${JSON.stringify(mineNow.data?.sessions || mineNow.error)}`);

  // The AI layer: every bridge job answers (AI or its fallback), and none of them publishes anything
  const card = { title: 'English Reading Support', want: 'Twelve students want to read English aloud.', place: 'Government School' };
  const [dc, lg, su, ft, ftVol] = await Promise.all([
    call('POST', '/api/bridge/dignity-check', { token: COORD, body: { text: 'poor boy Ravi, income 5000' } }),
    call('POST', '/api/bridge/listening-guide', { token: VOL, body: card }),
    call('POST', '/api/bridge/suggest-update', { token: COORD, body: { needCard: card, heardText: 'They wanted to read to me first.' } }),
    call('POST', '/api/bridge/find-teaching', { token: VOL, body: { situation: 'I had to wait and I got impatient.' } }),
    call('POST', '/api/bridge/dignity-check', { token: VOL, body: { text: 'x' } }),
  ]);
  const dcKinds = (dc.data?.flags || []).map(f => f.kind);
  check('X11 dignity check flags "poor boy Ravi, income 5000" with a rewrite (volunteers 403)',
    dcKinds.includes('name') && dcKinds.includes('money') && dcKinds.includes('word we avoid')
      && !/Ravi|poor|5000/.test(dc.data?.suggestedRewrite || 'Ravi') && ftVol.status === 403,
    JSON.stringify(dc.data || dc.error));
  check('X12 listening guide gives 3 questions', lg.data?.questions?.length === 3 && lg.data.questions.every(q => q.endsWith('?')), JSON.stringify(lg.data || lg.error));
  check('X13 suggest-update gives one line or null', su.status === 200 && (su.data.suggestion === null || typeof su.data.suggestion === 'string'), JSON.stringify(su.data || su.error));
  const verifiedIds = new Set((await call('GET', '/api/wisdom', { token: VOL })).data.map(w => w.id));
  check('X14 find-teaching returns only a verified id, or null', ft.status === 200 && (ft.data.id === null || verifiedIds.has(ft.data.id)),
    `${JSON.stringify(ft.data || ft.error)}; verified ${[...verifiedIds]}`);

  // Updated after listening: only the need's coordinator decides, once; an approved line shows on the card
  const pending = (await call('GET', '/api/coordinator/overview', { token: COORD })).data?.listeningUpdates || [];
  const fromMeera = pending.find(u => u.visitId === visitId);
  const byVolunteer = await call('PATCH', `/api/visits/${visitId}/update`, { token: VOL, body: { action: 'approve', text: 'x' } });
  r = await call('PATCH', `/api/visits/${visitId}/update`, { token: COORD, body: { action: 'approve', text: 'The students would like to speak first, and read after.' } });
  const answeredAgain = await call('PATCH', `/api/visits/${visitId}/update`, { token: COORD, body: { action: 'reject' } });
  const onCard = (await call('GET', `/api/needs/${needId}`, { token: OUTSIDER })).data?.updates || [];
  check('X15 updated after listening: coordinator approves once, the line shows on the card',
    !!fromMeera && byVolunteer.status === 403 && r.status === 200 && answeredAgain.status === 409
      && onCard.some(u => u.text === 'The students would like to speak first, and read after.'),
    `pending ${!!fromMeera}, volunteer ${byVolunteer.status}, approve ${r.status}, twice ${answeredAgain.status}, card ${JSON.stringify(onCard)}`);

  // Community Check-in every 4 weeks: only the need's coordinator, all three answers, and the community can end it
  const ci = (token, body) => call('POST', `/api/commitments/${ids.commitments.seeded}/check-in`, { token, body });
  const answers = { helping: 'Yes, they read aloud more.', change: 'Start ten minutes later.', ownNow: 'Pick their own books.' };
  const tooEarly = await ci(COORD, answers);                                                   // week 2: not due yet
  await call('POST', '/api/demo/advance', { token: COORD, body: { commitmentId: ids.commitments.seeded, toWeek: 4 } });
  const byVol = await ci(ARJUN, answers);
  const missing = await ci(COORD, { ...answers, ownNow: '' });
  const saved = await ci(COORD, { ...answers, end: true });
  const closed = await call('GET', `/api/needs/${ids.needs.englishReading}`, { token: ARJUN });
  check('X16 community check-in: due every 4 weeks, coordinator only, the community can end it',
    tooEarly.status === 409 && byVol.status === 403 && missing.status === 400 && saved.data?.checkIns?.length === 1
      && saved.data?.status === 'finished' && saved.data?.lastChoice === 'community-ended' && closed.data?.status === 'closed',
    `early ${tooEarly.status}, volunteer ${byVol.status}, missing ${missing.status}, saved ${JSON.stringify(saved.data?.checkIns || saved.error)}, status ${saved.data?.status}, need ${closed.data?.status}`);

  // A need keeps the coordinator's own words, in their language, beside the English card
  r = await call('POST', '/api/needs', { token: COORD, body: { ...newNeed, consent: { readBack: true, coordinatorConsent: true }, original: { text: 'பத்து மாணவர்கள்', language: 'ta' } } });
  const kept = await call('GET', `/api/needs/${r.data?._id}`, { token: VOL });
  check('X9  need keeps the original words', kept.data?.original?.text === 'பத்து மாணவர்கள்' && kept.data?.original?.language === 'ta',
    JSON.stringify(kept.data?.original || kept.error));

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
  // Resource Connect: the school's seeded "we lack 10 tablets" is matched with the college's "we have",
  // nearest first; connect, hand over, then "is it in use?". Never money.
  const money = await call('POST', '/api/resources', { token: COORD, body: { kind: 'request', category: 'materials', mode: 'give', type: 'cash', quantity: 1 } });
  r = await call('GET', '/api/resources/mine', { token: COORD });
  const request = (r.data || []).find(x => x._id === ids.resources.schoolTablets);
  const suggested = request?.candidates?.[0];
  const linked = await call('POST', `/api/resources/${request?._id}/connect`, { token: COORD, body: { withId: suggested?._id } });
  const twice = await call('POST', `/api/resources/${request?._id}/connect`, { token: COORD, body: { withId: suggested?._id } });
  const handed = await call('POST', `/api/resources/${request?._id}/handover`, { token: COORD });
  const inUse = await call('POST', `/api/resources/${request?._id}/in-use`, { token: COORD, body: { answer: 'yes' } });
  const volunteerBlocked = await call('GET', '/api/resources/mine', { token: VOL });
  check('X7  resource connect: nearest match, connect, hand over, in use; never money; coordinators only',
    money.status === 400 && suggested?.org?.name === 'Sri Ramana Arts College' && suggested?.type === 'tablets' && suggested?.distanceKm >= 1
      && linked.data?.status === 'matched' && twice.status === 409 && handed.data?.status === 'handed-over'
      && handed.data?.matchedWith?.status === 'handed-over' && inUse.data?.inUse?.answer === 'yes' && volunteerBlocked.status === 403,
    `money ${money.status}, suggested ${suggested?.org?.name} ${suggested?.distanceKm} km, connect ${linked.data?.status}, again ${twice.status}, handover ${handed.data?.status}, in use ${JSON.stringify(inUse.data?.inUse || inUse.error)}, volunteer ${volunteerBlocked.status}`);

  sample.push(await call('GET', '/api/resources/mine', { token: COORD }));
  const bannedKeys = keysIn(sample.map(x => x.data));
  check('X6  no hours, points, ranks, scores or personal fields in any response', bannedKeys.length === 0, `found ${[...new Set(bannedKeys)]}`);

  // Closing a need (school shut, organisation moved): coordinator only; every active commitment on it is
  // finished as complete ("need-closed"), and the volunteer is asked nothing. Built on a fresh ramp.
  const v3 = await call('POST', `/api/needs/${ids.needs.need3}/visits`, { token: OUTSIDER });
  await call('PATCH', `/api/visits/${v3.data?._id}/heard`, { token: OUTSIDER, body: { text: 'They want to choose the songs.' } });
  await call('PATCH', `/api/visits/${v3.data?._id}/decision`, { token: COORD, body: { yes: true } });
  const c3 = await call('POST', '/api/commitments', { token: OUTSIDER, body: { visitId: v3.data?._id, weeks: 4, sentence: 'I will come.' } });
  const closeByVol = await call('PATCH', `/api/needs/${ids.needs.need3}/close`, { token: OUTSIDER, body: {} });
  const closedNeed = await call('PATCH', `/api/needs/${ids.needs.need3}/close`, { token: COORD, body: { reason: 'The school has moved.' } });
  const closedAgain = await call('PATCH', `/api/needs/${ids.needs.need3}/close`, { token: COORD, body: {} });
  const c3Now = await call('GET', `/api/commitments/${c3.data?._id}`, { token: OUTSIDER });
  check('X19 closing a need marks its active commitments finished (coordinator only)',
    c3.status === 201 && closeByVol.status === 403 && closedNeed.data?.status === 'closed' && closedNeed.data?.commitmentsFinished === 1
      && closedAgain.status === 409 && c3Now.data?.status === 'finished' && c3Now.data?.lastChoice === 'need-closed' && c3Now.data?.invitation === null,
    `commit ${c3.status}, volunteer ${closeByVol.status}, close ${JSON.stringify(closedNeed.data || closedNeed.error)}, again ${closedAgain.status}, commitment ${c3Now.data?.status}/${c3Now.data?.lastChoice}`);

  const count = st => results.filter(x => x === st).length;
  console.log(`\n${count('PASS')} passed, ${count('FAIL')} failed`);
  process.exit(count('FAIL') ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
