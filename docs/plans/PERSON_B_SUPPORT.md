# SevaSetu — Person B (Support, 30%)

> **Historical build plan.** The two halves have since been merged into one app at the repo root
> (see [README.md](../../README.md)). Paths like `person-a/…` and `services/…` below refer to the
> original split; endpoint numbers and test ids (T, S, R, B, U, D) are still the ones the code uses.

You build the **heart of the idea**: the private Seva Diary, Then and Now, Swamiji's teachings
(Wisdom and "Why?"), and the Seva Bridge (coordinator's words → draft need card). You also own the
seed data and the final testing of the whole app.

Read this with the shared doc "SevaSetu — Architecture and 12-Hour Build Plan". Endpoint numbers
(1 to 29) are the same in both. Endpoint 29 (speech to text) was added later for Bhashini.

---

## 1. What you own

| Type | Items |
|---|---|
| Services | `services/reflect` (port 4002), `services/bridge` (port 4003) |
| Database | `seva_reflect` (questions, entries, wisdom, whys) |
| Components | `components/seva/`: `WisdomCard`, `WhyLink`, `WhyModal`, `VoiceInput` |
| Screens | Diary, Then and Now, Wisdom, Post a Need |
| Chores | `seed/seed-core.js`, `seed/seed-reflect.js`, `docs/api.http`, README, full-app testing, backup demo video |

**You do NOT build:** gateway, login, needs, visits, commitments, Home, My Seva, coordinator dashboard,
deployment setup. Those are Person A's. Do not edit `routes.jsx`, the root `package.json` or the
gateway. Ask A to add your routes.

---

## 2. Your timeline

| Hours | Work | Done when |
|---|---|---|
| 0–1 | Atlas cluster, copy A's template to reflect + bridge, test one LLM call, test Tamil speech in Chrome | Both services answer `/health` on Render |
| 1–3 | All 7 reflect endpoints + `seed-reflect.js` | Endpoints 21–27 work through the gateway |
| 3–4 | `draft-need` + privacy flags, `transcribe`, `seed-core.js`, `docs/api.http` | Endpoints 28 and 29 work. Both databases seeded. Merge to `main` |
| 4–6 | `WisdomCard`, `WhyLink`/`WhyModal`, Wisdom page, Diary | A can drop your two components into Home and Need detail |
| 6–8 | Then and Now, `VoiceInput`, Post a Need | A coordinator can publish a need from your screen |
| 8–10 | Test the whole app on a phone-size screen, fix styling, polish seed data | Feature freeze |
| 10–12 | Joint demo runs, backup video, README | Section 9 checklist is all ticked |

At hour 6, check with A. If A is behind, you take the coordinator dashboard.

---

## 3. Step 1 — Setup (hour 0–1)

1. **Atlas:** create a free cluster and a database user. Allow access from anywhere (hackathon only).
   Send A the connection string. Yours ends in `/seva_reflect`; A's ends in `/seva_core`.
2. **Copy the template:** A's `app.js` + `server.js` into `services/reflect` and `services/bridge`.
   Change the service name and port. `bridge` has no database, so its `server.js` just listens.
3. **Test the two risky things now, not at hour 7:** fill `services/bridge/.env` from
   `.env.example` (Groq key, Bhashini user id and key), then from `services/bridge` run
   `npm run check -- path/to/tamil-16khz.wav`. It tests one Groq draft, one Bhashini Tamil → English
   translation and one Bhashini Tamil speech-to-text call. If Bhashini speech fails, the text box
   is your plan. Decide now.

Read the user in every route (the gateway sets these headers):

```js
const me = req => ({ id: req.headers['x-user-id'], role: req.headers['x-user-role'] });
```

Every response is `{ data: ... }` on success and `{ error: { message } }` on failure.

---

## 4. Step 2 — reflect-service (hour 1–3)

### Models

```js
// questions — seeded, one per week, themes rotate
{ order: 1, theme: 'patience', text: 'When did you have to wait today?',
  teaching: 'Patience and perseverance' }

// entries — PRIVATE to the user
{ userId, commitmentId, week, questionId, text, hardDay, createdAt }
// add a unique index on { userId, commitmentId, week } so there is one entry per week

// wisdom — seeded, human-checked only
{ theme, text, source }

// whys — seeded
{ ruleKey: 'no-ranks', title: 'Why no leaderboard?', teaching }
```

### Endpoints

| # | Endpoint | Logic |
|---|---|---|
| 21 | `GET /api/reflect/question?commitmentId=&week=` | Pick the question by `((week - 1) % 4) + 1` = `order`. Return `{ _id, theme, text, teaching }`. Missing `week` → 400 |
| 22 | `POST /api/reflect/entries` | Body `{ commitmentId, week, questionId, text, hardDay }`. `userId` comes **only** from `x-user-id`, never from the body. Empty text → 400. Same week again → update that entry (no duplicates) |
| 23 | `GET /api/reflect/entries?commitmentId=` | Filter by `userId = x-user-id` AND `commitmentId`. Sort by week |
| 24 | `GET /api/reflect/then-and-now?commitmentId=` | Same filter. Return `{ first, latest }` with the question text for each. Fewer than 2 entries → `{ first, latest: null }` |
| 25 | `GET /api/wisdom/today` | Pick one by day of year: `dayOfYear % count`. Same quote all day |
| 26 | `GET /api/wisdom?theme=` | All wisdom, or one theme |
| 27 | `GET /api/wisdom/why/:ruleKey` | One `whys` doc. Unknown key → 404 |

Mount routes at the full path, because the gateway forwards paths unchanged:

```js
app.use('/api/reflect', require('./routes/reflect'));
app.use('/api/wisdom', require('./routes/wisdom'));
```

### The four diary questions (week 1 to 4)

| Week | Theme | Question | Teaching line shown under it |
|---|---|---|---|
| 1 | patience | When did you have to wait today? | Patience and perseverance |
| 2 | listening | What did someone tell you that surprised you? | Feel first, organize afterwards |
| 3 | effort | What was in your hands today, and what was not? | Work fully, leave the results |
| 4 | received | What did you receive today? | The giver receives more than the receiver |

### Rules you must not break (judges may check)

- **No endpoint ever returns another user's diary.** Every `entries` query includes `userId` from the header.
- **No score, no sentiment, no AI on diary text.** The service only stores and returns the user's words.
- **No coordinator access.** A coordinator token calling endpoint 23 gets only their own (empty) list.
- `commitmentId` is stored as a plain string. Never call core-service to look it up.

---

## 5. Step 3 — bridge-service (hour 3–4)

Two endpoints. No database. Two outside providers, each already wrapped in one file:

| File | Provider | Used for |
|---|---|---|
| `src/llm.js` | **Groq** (`openai/gpt-oss-20b`, strict JSON schema) | Turning the coordinator's words into a draft card. Strict mode means the draft always has exactly the 9 keys |
| `src/bhashini.js` | **Bhashini** (MeitY pipeline) | `transcribe()`: Tamil/Hindi speech → text. `translate()`: Tamil/Hindi → English before Groq drafts |

**28. `POST /api/bridge/draft-need`** — Body `{ text, language }` → `{ draft, privacyFlags, source }`

```js
// services/bridge/src/routes/bridge.js
const router = require('express').Router();
const { callLLM } = require('../llm');          // Groq
const { translate, transcribe } = require('../bhashini');
const FALLBACK = require('../fallbackDraft.json');

const PROMPT = `You turn a community coordinator's words into a need card.
Return ONLY JSON with these keys:
title, want, serveUsWell, youWillLearn, groupSize, interestTags, rhythm {day,start,end}, weeks, place.
Rules: describe the GROUP, never one person. Do not include any person's name, age, income,
caste, religion or health detail. Use respectful words: never "poor", "needy", "beneficiary".
Write the card in English. If something is not said, leave it as an empty string.`;

// simple checks that run even if the AI is off
function findPrivacyFlags(text) {
  const flags = [];
  if (/\b(income|salary|rs\.?|rupees|₹)\b/i.test(text)) flags.push('Mentions money or income');
  if (/\b(caste|religion|hindu|muslim|christian)\b/i.test(text)) flags.push('Mentions caste or religion');
  if (/\b(disease|illness|disabled|hiv|tb)\b/i.test(text)) flags.push('Mentions a health detail');
  if (/\b(poor|needy|beneficiar)/i.test(text)) flags.push('Uses a word we avoid (poor / needy / beneficiary)');
  return flags;
}

router.post('/draft-need', async (req, res) => {
  if (req.headers['x-user-role'] !== 'coordinator')
    return res.status(403).json({ error: { message: 'Coordinators only' } });

  const { text, language } = req.body;
  if (!text || !text.trim())
    return res.status(400).json({ error: { message: 'Please say or type the need' } });

  // Bhashini translates first, so Groq drafts from good English. If it fails, Groq gets the original.
  let english = text;
  if (language && language !== 'en') {
    try { english = await translate({ text, from: language }) + '\n\nOriginal: ' + text; } catch (e) {}
  }

  let draft = FALLBACK, source = 'fallback';
  try {
    // never wait more than 8 seconds on stage
    const raw = await Promise.race([
      callLLM(PROMPT, english, language),
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
    ]);
    draft = JSON.parse(raw);
    source = 'ai';
  } catch (e) { /* keep the fallback draft */ }

  // check both what was said and what was drafted
  const privacyFlags = findPrivacyFlags(text + ' ' + JSON.stringify(draft));
  res.json({ data: { draft, privacyFlags, source } });
});

// 29. speech to text through Bhashini. The browser never sees the Bhashini key.
router.post('/transcribe', async (req, res) => {
  const { audio, language, samplingRate } = req.body;   // audio = base64 WAV
  if (!audio) return res.status(400).json({ error: { message: 'No audio' } });
  try {
    const text = await transcribe({ audioBase64: audio, language: language || 'ta', samplingRate });
    res.json({ data: { text } });
  } catch (e) {
    res.status(502).json({ error: { message: 'Could not hear that. Please type instead.' } });
  }
});
module.exports = router;
```

**29. `POST /api/bridge/transcribe`** — Body `{ audio, language, samplingRate }` → `{ text }`. Any
logged-in user. Audio is passed to Bhashini and dropped; it is never stored or logged. Raise the JSON
body limit for this service (`express.json({ limit: '5mb' })`), since a 30-second WAV is about 1 MB.

- `fallbackDraft.json` is the "English Reading Support" card from the shared doc. With it, the demo
  works even with no API key and no internet to the AI.
- The `draft` keys must match the body of A's `POST /api/needs` (endpoint 6) exactly, plus `consent`
  which your screen adds.
- The Groq and Bhashini keys live only in the Render environment of `bridge` (and your local
  `.env`, which git ignores). Never in the frontend, never in git.
- The AI **never publishes**. It only drafts. A human edits, ticks read-back, and presses Publish.

---

## 6. Step 4 — Components and screens (hour 4–8)

Use A's `api` client (`lib/api.js`), `Card` and `Button`. A's client already unwraps `{ data }`.

### Components

| Component | Props | Behaviour | Calls |
|---|---|---|---|
| `WisdomCard` | none | "Seva Wisdom for Today": quote, source line, "Read More" → `/wisdom`. If the call fails, show nothing (do not break Home) | 25 |
| `WhyLink` | `rule` | Small "Why?" text button. Opens `WhyModal` | — |
| `WhyModal` | `rule`, `onClose` | Title + teaching. Close button and tap-outside both close it | 27 |
| `VoiceInput` | `value`, `onChange`, `lang` (`ta`, `hi`, `en`) | Text area that is **always visible** + a mic button. Tap to record, tap to stop, the words are added to the box. Mic is hidden if the browser cannot record | 29 |

How `VoiceInput` works with Bhashini:

1. Record with `navigator.mediaDevices.getUserMedia({ audio: true })` and `MediaRecorder`.
2. On stop, Bhashini cannot read the browser's WebM, so convert it: decode with
   `AudioContext.decodeAudioData`, resample to **16 000 Hz mono** with an `OfflineAudioContext`, and
   write a 16-bit PCM WAV (44-byte header + samples). Put this in `components/seva/toWav.js`.
3. Send `{ audio: <base64 WAV>, language: lang, samplingRate: 16000 }` to endpoint 29 and append the
   returned `text` to the box.
4. Any error: stop the spinner and leave the text box as it is. No error popup.

Cap a recording at 30 seconds. This works in Chrome, Firefox and Safari, unlike the browser's own
speech recognition.

Audio goes to Bhashini only to be turned into text. Nothing stores it, and only the text is kept.
Use the mic on **Post a Need** only. The diary stays type-only, so a private diary never leaves for a
third party.

### Screens

| Route | Shows | Calls | Done when |
|---|---|---|---|
| `/reflect/:commitmentId` | "Week X" label, **one** question, teaching line under it, a text box (no mic, see above), "This was a hard day" tick, Save, Skip, "Only you can see this" note, list of past entries, link to Then and Now | 21, 22, 23 (week from A's endpoint 13) | Saving shows the entry in the list. Skip goes back without saving |
| `/reflect/:commitmentId/then-and-now` | Two cards side by side (stacked on phone): "Then — Week 1" and "Now — Week N", each with its question and her words. Under them, once: "They alone live who live for others." | 24 | With fewer than 2 entries it shows a kind message, not a blank page |
| `/wisdom` | Theme chips (Service, Strength, Patience, Work), teachings with source | 26 | Every item shows a source. Chips filter the list |
| `/coordinator/post-need` | Step 1: language picker + `VoiceInput` → "Make draft". Step 2: editable form of all draft fields + yellow privacy warnings. Step 3: tick "I read this back to the community and they agreed" → Publish | 28, then A's 6 | Publish is disabled until the tick is on. After publish → back to `/coordinator` |

On Post a Need, send `consent: { readBack: true, agreedOn: <today> }` with the draft to endpoint 6.

**Must not appear on any of your screens:** a score, a streak, a count of entries as an achievement,
a share button, a photo upload, or anything that grades the diary.

---

## 7. Step 5 — Seed data (hour 1–4, polish at hour 8)

Two scripts, run from your laptop against Atlas. Each one **clears its collections first**, so it is
safe to run again and again.

```bash
MONGO_URI="...seva_core"    node seed/seed-core.js
MONGO_URI="...seva_reflect" node seed/seed-reflect.js
```

Use **fixed `_id` values** (write them in a shared `seed/ids.js`) so the seeded commitment in core
and the seeded diary entries in reflect point to the same `commitmentId`.

| Script | Collection | Seed |
|---|---|---|
| core | users | New volunteer (for the live demo), seeded volunteer (already at week 2), one more circle member, one coordinator |
| core | orgs | Government School, Kanchipuram (verified, 3 km) + 2 more |
| core | needs | 3 open needs on Saturday. "English Reading Support" is the demo one |
| core | visits + commitments | Seeded volunteer: agreed visit + commitment at week 2 of 4, weeks 1–2 `served` |
| core | circles | One circle with the three volunteers |
| reflect | questions | The 4 questions in section 4 |
| reflect | entries | Seeded volunteer, week 1 only: "I kept correcting them." (week 2 is written live in the demo) |
| reflect | wisdom | 8 teachings with `source` |
| reflect | whys | `no-ranks`, `no-photos`, `no-hours`, `listen-first` |

**Quotes:** copy every quote from the *Complete Works of Swami Vivekananda* and fill `source` with
volume and page. Do not write quotes from memory and do not let an AI write them. If you cannot
verify one, leave it out. Eight checked quotes beat twenty doubtful ones.

All names in the seed are invented. No real child's or parent's name anywhere.

---

## 8. What you give A and need from A

| You give A | When |
|---|---|
| Atlas connection string | Hour 0.5 |
| Both databases seeded | Hour 4 |
| `docs/api.http` with all 29 requests | Hour 4 |
| `<WisdomCard />` and `<WhyLink rule="..." />` | Hour 6 |
| Your route names and page files | Hour 6 |
| Bug list from full-app testing | Hour 9 |

| You need from A | When |
|---|---|
| Service template | Hour 1 |
| Gateway live with routing to your services | Hour 2 |
| `api.js`, `useAuth`, `Card`, `Button`, theme | Hour 4.5 |
| Endpoint 6 (`POST /api/needs`) and 13 (`GET /api/commitments/:id`) | Hour 4 |

Until A's part is ready, use a hard-coded JSON of the agreed shape. Never wait.

---

## 9. Testing — how to say "100% working"

A feature is **done** only when its checks pass **on the deployed URL**, in a **fresh incognito window**,
**two times in a row**. Passing on localhost does not count.

```bash
GW=https://your-gateway.onrender.com
# get tokens with A's demo-login for: seeded volunteer (VOL), another volunteer (VOL2), coordinator (COORD)
```

### 9.1 reflect-service API tests

| # | Test | Call | Pass if |
|---|---|---|---|
| R1 | Alive | `curl $GW/health/all` | `reflect: true`, `bridge: true` |
| R2 | Token needed | `GET /api/reflect/entries?commitmentId=X` with no token | **401** |
| R3 | Question for week 1 | `GET /api/reflect/question?commitmentId=X&week=1` (VOL) | Patience question + `teaching` line |
| R4 | Questions rotate | Same with `week=2`, `3`, `4`, `5` | 4 different questions; week 5 = week 1's |
| R5 | Missing week | Same with no `week` | **400** |
| R6 | Seeded entry | `GET /api/reflect/entries?commitmentId=X` (VOL) | Exactly 1 entry, week 1 |
| R7 | Save entry | `POST /api/reflect/entries` `{ commitmentId, week: 2, questionId, text: "I waited, and he finished the sentence himself.", hardDay: false }` (VOL) | 201; R6 now returns 2 entries in week order |
| R8 | No duplicates | Repeat R7 with different text | Still 2 entries; week 2 text is updated |
| R9 | Empty text | R7 with `text: ""` | **400** |
| R10 | **Privacy: other volunteer** | R6 with VOL2's token, same `commitmentId` | **Empty list** |
| R11 | **Privacy: coordinator** | R6 with COORD's token | **Empty list** |
| R12 | **Privacy: fake userId** | R7 as VOL2 with `"userId": "<VOL id>"` added in the body | Entry is saved under VOL2, not VOL. VOL's list is unchanged |
| R13 | Then and Now | `GET /api/reflect/then-and-now?commitmentId=X` (VOL) | `first` = week 1 text, `latest` = week 2 text, each with its question |
| R14 | Then and Now, new user | Same with a commitment that has no entries | `{ first: null, latest: null }`, status 200 |
| R15 | Wisdom today | `GET /api/wisdom/today` twice | Same quote both times, has `source` |
| R16 | Wisdom list | `GET /api/wisdom` and `?theme=patience` | 8 items; filter returns fewer; **every item has a non-empty `source`** |
| R17 | Why | `GET /api/wisdom/why/no-ranks`, `no-photos`, `no-hours`, `listen-first` | All 4 return title + teaching |
| R18 | Why, unknown | `GET /api/wisdom/why/abc` | **404** |
| R19 | No score anywhere | Read the JSON of R3, R6, R13 | No field named score, rating, points, streak or sentiment |

R10, R11 and R12 are the most important tests in your whole part. If any of them fails, stop and fix
it before anything else. A private diary that leaks is worse than no diary.

### 9.2 bridge-service API tests

| # | Test | Call | Pass if |
|---|---|---|---|
| B1 | Draft from English | `POST /api/bridge/draft-need` `{ "text": "12 students of class 6 to 8 want help reading English aloud, Saturday mornings at the government school in Kanchipuram", "language": "en" }` (COORD) | 200, `draft` has all 9 keys, `source: "ai"` |
| B2 | Draft from Tamil | Same idea typed in Tamil, `"language": "ta"` | 200, draft is in English, `groupSize` is 12 |
| B3 | Shape matches endpoint 6 | Take B1's `draft`, add `consent`, send to `POST /api/needs` | 201, no field errors |
| B4 | Volunteer blocked | B1 with VOL's token | **403** |
| B5 | Empty text | `{ "text": "" }` | **400** |
| B6 | Privacy flags | Text: "Ravi, a poor boy, father's income is Rs 5000" | `privacyFlags` has at least 2 warnings |
| B7 | No person in the draft | Read B6's `draft` | No name "Ravi", no income figure, no "poor" |
| B8 | Fallback without key | Remove `GROQ_API_KEY` locally, call B1 | 200 within 1 second, `source: "fallback"` |
| B9 | Fallback on slow AI | Set the timeout to 1 ms locally, call B1 | 200, `source: "fallback"` |
| B10 | Keys are not exposed | Search the built frontend and the repo for the first 8 characters of the Groq key and the Bhashini key | Not found |
| B11 | Tamil goes through Bhashini | B2 with `BHASHINI_*` keys removed locally | Still 200 with a draft (Groq read the Tamil directly) |
| B12 | Speech to text | `POST /api/bridge/transcribe` with a short Tamil 16 kHz WAV as base64 (VOL or COORD) | 200, `text` is Tamil words |
| B13 | Speech, no audio | Same with `{}` | **400** |
| B14 | Speech, Bhashini down | Wrong `BHASHINI_ULCA_API_KEY` locally, repeat B12 | **502** with "Please type instead", service stays up |

If B7 fails sometimes (AI output varies), strengthen the prompt and keep the flags as the safety net.
The coordinator's review is the final check, so B6 must always pass.

### 9.3 Screen tests (phone-size window, 390 px wide)

| # | Do this | Pass if |
|---|---|---|
| U1 | Home, as volunteer | Wisdom card shows a quote and a source |
| U2 | Stop reflect-service locally, reload Home | Home still loads; only the Wisdom card is missing |
| U3 | Tap "Read More" | Wisdom page opens; theme chips filter the list |
| U4 | Tap "Why?" on Need detail, My Seva, guest briefing | Right teaching for each rule; closes with the button and with tap-outside |
| U5 | My Seva → Reflect (seeded volunteer, week 2) | One question only, "Only you can see this" note, week 1 entry in the list |
| U6 | Type an answer → Save | Entry appears in the list at once; refresh keeps it |
| U7 | Tap Skip | Goes back; nothing is saved |
| U8 | Post a Need → tap the mic in Chrome, speak one Tamil sentence, tap stop | Tamil words appear in the box within a few seconds |
| U9 | Same in Firefox, then refuse the microphone permission | Firefox works; after refusing, the text box still works and there is no error popup |
| U10 | Open Then and Now | Week 1 words beside the newest words; no number, score or chart |
| U11 | Then and Now for the new volunteer (no entries) | Friendly message, not a blank or broken page |
| U12 | Look at Diary and Then and Now carefully | No hours, streak, badge, share button or photo upload |
| U13 | Coordinator → Post a Need → type the sentence → Make draft | Draft form appears within 8 seconds, all fields editable |
| U14 | Type "poor boy Ravi, income 5000" → Make draft | Yellow privacy warnings show above the form |
| U15 | Try Publish without the read-back tick | Button is disabled |
| U16 | Tick read-back → Publish | Returns to the dashboard; the need shows in the volunteer's Needs search |
| U17 | Log in as a volunteer and type `/coordinator/post-need` in the address bar | Redirected or blocked |
| U18 | Log in as the coordinator and open the seeded volunteer's diary URL | No entries shown |

### 9.4 Seed tests

| # | Check | Pass if |
|---|---|---|
| D1 | Run both seed scripts twice | No errors, no duplicate documents |
| D2 | After seeding, log in as the seeded volunteer | Home shows "Week 2 of 4 — English Reading Support" |
| D3 | Open that volunteer's diary | Exactly one entry (week 1) |
| D4 | Search both databases for a child's or parent's name, a photo URL, an income | Nothing found |
| D5 | Every `wisdom` doc | Has a `source` you personally checked in the Complete Works |

### 9.5 Whole-app testing (hours 8–10, your job)

Test A's part too, as a fresh pair of eyes. For each bug, write one line in the team chat:
**screen → what you did → what happened → what should happen.**

- Run A's screen tests S1–S15 from A's file.
- Check every screen at 390 px wide and on one real phone.
- Check the browser console on every screen: no red errors.
- Search every screen for these words and remove them: "beneficiary", "poor", "needy", "donate",
  "hours", "rank", "points".
- Check that no screen shows a photo of the people served.

### 9.6 Final sign-off

Tick every line. If one is unticked, the feature is not done.

- [ ] R1–R19 pass on the deployed gateway
- [ ] R10, R11, R12 (diary privacy) pass — checked by **both** of you
- [ ] B1–B14 pass
- [ ] U1–U18 pass in incognito, two times in a row
- [ ] D1–D5 pass
- [ ] The joint demo run in Person A's file (section 9) passes two times in a row
- [ ] Backup video of the full demo is recorded and saved on both laptops
- [ ] README has: what it is, the 5 live URLs, how to run locally, how to seed, the demo steps

One honest note: this checklist proves the demo path, the privacy rules and the fallbacks work. It
does not prove there are zero bugs anywhere. For a 12-hour build, "every check passes twice on the
live site" is the right meaning of 100%.

---

## 10. If things go wrong

| Problem | Do this |
|---|---|
| LLM call fails or is slow | The fallback draft already covers it. Do not debug the AI after hour 8 |
| Tamil speech does not work | Type or paste the Tamil sentence. The demo point is the draft, not the mic. Backup: Groq's `whisper-large-v3` also does Tamil speech to text with the same Groq key |
| Bhashini translation fails | Nothing to do. Groq drafts from the Tamil directly (test B11) |
| You are behind at hour 6 | Cut in this order: Wisdom themes, voice input, privacy flags UI. Never cut Diary, Then and Now or Post a Need |
| A is behind at hour 6 | Take the coordinator dashboard (endpoints 8, 10, 16, 19, 20 are A's; you build only the screen) |
| A quote cannot be verified | Remove it from the seed |
