# SevaSetu — Project Plan

> *"They alone live who live for others."* — Swami Vivekananda

SevaSetu ("bridge of service") is a mobile-first web app for **sustained, dignity-first volunteering**.
It does not help people "donate hours". It helps a volunteer find **one** right community need, **listen
before committing**, serve the same people week after week, and reflect privately on what they learn.

This page is the overview of the whole thing. How to run it is in [README.md](README.md). Related docs:

- [docs/CONTRACT.md](docs/CONTRACT.md): the rules every service keeps to
- [tests.http](tests.http): every endpoint as a runnable request, and the checks that must pass
- [docs/plans/](docs/plans/): the original two-person build plans (endpoint numbers and test ids come from these)

---

## 1. The problem

Most volunteering platforms are built like job boards with a leaderboard: long lists, a "Register"
button, hours logged, badges earned, photos of "beneficiaries" posted. The result is one-off visits,
volunteers who show up without understanding the community, and people served being treated as
content.

## 2. What SevaSetu does differently

| Typical platform | SevaSetu |
|---|---|
| Endless list of opportunities | **At most 3** needs, each with a plain "why this fits you" line |
| "Register" button | **One visit, only to listen.** The volunteer is never asked to commit; the community invites, or not |
| Log hours, earn points | Progress is only **"Week X of N"**. No hours, points, ranks or streaks |
| One-off visits | **4-week commitments**, a circle that covers absences, an invitation to continue |
| Photos of the people served | **No photos, names, income, caste, religion or health details** of people served, anywhere |
| Public impact posts | **Private Seva Diary**: one question a week, visible only to the writer |
| Coordinator fills a long form | Coordinator **speaks in Tamil/Hindi/English**, AI drafts the need card, a human reads it back to the community and publishes |
| Rules hidden in a policy page | A **"Why?"** link next to each rule explains the teaching behind it |

## 3. Who uses it

| Person | What they want | Demo user (seeded) |
|---|---|---|
| New volunteer | Find one need that fits their day, distance and interest | Meera Krishnan |
| Ongoing volunteer | Keep serving, cover for a circle member, reflect | Arjun Raman (week 2 of 4) |
| Circle member | Cover a week someone cannot come | Kavya Suresh |
| Outside volunteer | (Shows that only circle members can cover) | Rahul Menon |
| Community coordinator | Post a need, meet volunteers, see the week grid, invite them to continue | Lakshmi Narayanan, Government School Kanchipuram |

Login is a demo picker (tap a person). There are no passwords in this version.

---

## 4. The journey we are building

The ramp is always **One visit → Invitation → 4 weeks → Continue**. The volunteer is asked for nothing
after the visit; the community speaks first.

```text
 VOLUNTEER                                         COORDINATOR
 ─────────                                         ───────────
                                                   Post a Need (voice/text → AI draft
                                                     → Dignity Check → read back → publish)
 1. Discover    3 questions → up to 3 needs              │
 2. Understand  Need card: want / serve us well /        │
                learn / rhythm + "Why?"                  │
 3. One visit   Guest briefing + Listening Guide         │
                → request visit ─────────────────────► sees the visit
                → "What did you hear that you          │
                   did not expect?"  → nothing more     │
 4. Their word  "The next word is theirs"    ◄──────── invites ("They would like you to
                invited → Commit screen                 come back") or declines
                declined → the "declined" moment
 5. Commit      One sentence, 4 weeks, Sankalpa
                ("what do you hope to learn here?")
 6. Serve       My Seva: Week X of N, circle,      ◄── week grid (served/covered/gap)
                "I have arrived" → Silent Seva,
                "I cannot come" → member covers
 7. Reflect     Private diary, 1 question a week
                (5 themes, one on pride),
                Then and Now (week 1 vs latest)
 8. Continue    Invitation → Continue / Pause /    ◄── sends invitation; check-in every 4 weeks
                Finish ("What did they give you?"
                first, then the handover)          ◄── relays "what the group wanted to say"
    or Closed   the need ends → "closed" moment    ◄── closes the need; nothing to choose
```

---

## 5. Architecture

```text
            ┌──────────────────────────┐
            │  Web app (React + Vite)  │  Vercel
            │  mobile, 430px shell     │
            └────────────┬─────────────┘
                         │  only talks to the gateway
            ┌────────────▼─────────────┐
            │  gateway :8080           │  Render
            │  JWT check → x-user-id / │
            │  x-user-role → forward   │
            └──┬──────────┬─────────┬──┘
   /api/auth,  │          │         │ /api/bridge
   needs,      │          │ /api/reflect,
   visits, …   │          │ /api/wisdom
      ┌────────▼───┐ ┌────▼──────┐ ┌▼───────────┐
      │ core :4001 │ │reflect    │ │ bridge     │
      │ (A)        │ │:4002 (B)  │ │ :4003 (B)  │
      └─────┬──────┘ └────┬──────┘ └──┬──────┬──┘
            │             │           │      │
       seva_core     seva_reflect   Groq   Bhashini
       (MongoDB Atlas)              (LLM)  (speech, translation)
```

**Stack:** Node 20, Express, Mongoose, MongoDB Atlas, React, Vite, Tailwind, Zustand, axios.
**Hosting:** Vercel (web), Render (services), Atlas (data). `mono.js` runs the whole backend in one
process as a fallback if a host misbehaves.

**Rules every service follows** (full list in [docs/CONTRACT.md](docs/CONTRACT.md)):

- `GET /health` → `{ ok: true, service }`. Success is `{ data }`, failure is `{ error: { message } }`.
- The user comes **only** from gateway headers, never from the request body.
- Services never call each other. AI keys live only in `bridge`.

---

## 6. What we build — by service

### core — endpoints 1–20, plus Resource Connect

| Area | # | What |
|---|---|---|
| Auth | 1–3 | List demo users, demo login (JWT 12h), who am I |
| Needs | 4–6, 6b | Filtered search (max 3, with `fitReason`), need detail (with the last volunteer's handover note), post a need (coordinator only; community confirmation **and** coordinator consent, else 400), close a need (coordinator only; its active commitments finish as `need-closed`) |
| Visits | 7–10 | Request visit, my visits, "what I heard", the community's answer (coordinator only: invite with the group's words → `invited`, or decline → `declined`; before the visit 409; a volunteer 403) |
| Commitments | 11–17, 17b | Commit (only an `invited` visit; that POST is the volunteer's acceptance, else 409), list, detail, absence (with an optional note for whoever covers), served (Silent Seva), cover (circle only), invitation, check-in, continue / pause (with a return date) / finish (with a handover note; the need opens again), community words (coordinator relays one checked line once the seva has finished) |
| Other | 18–20 | My circle (+ open gaps with notes, + handover notes), coordinator overview, demo time travel |
| Resource Connect | — | Offer or ask for things; matches of the same type from other organisations (same city first); connect; hand over |

### reflect — endpoints 21–27, plus 27b

| # | What |
|---|---|
| 21 | This week's diary question (5 themes rotate: patience, listening, effort, received, pride) |
| 22–23 | Save / list **my own** diary entries (one per week) |
| 24 | Then and Now: first entry vs latest |
| 24b–c | Seal / read **my own** Sankalpa (one line per commitment, written once) |
| 24d–e | Write / read **my own** "What did they give you?" (one per commitment, written at finish) |
| 25–26 | Wisdom of the day, wisdom by theme — verbatim quotes with their source |
| 27 | "Why?" for a rule: verified teaching (or none) → interpretation → product decision |
| 27b | A teaching for one moment (before-listen, commit, hard-day, continue): verified teaching → interpretation → practice. The non-attachment moments (declined, closed, finished) carry no quotation: plain words → practice |

### bridge — endpoints 28–30 and the AI jobs

The AI principle: AI understands, suggests and organises; humans decide. Providers sit behind two modules
(`providers/llm.js`, `providers/language.js`); every model answer is JSON checked against its schema on the
server, retried once, then dropped for the rule-based fallback; every call times out at 8 s; nothing is
stored (no audio, no transcripts, no turns, no raw model output). Coordinators only for anything that drafts.

| # | What |
|---|---|
| 28 | Coordinator's words → draft need card (the one-shot path; kept for the API tests). Never publishes |
| 29 | Speech → text through Bhashini. Audio is never stored |
| 30 | `POST /speak`: text → speech through Bhashini for Read It Aloud; 503 with no provider, and the browser's `speechSynthesis` reads instead |
| — | `GET /capabilities`: `{ llm, speech }`, so the UI labels "Suggested" only when a model answered and starts the mic in the browser when there is no speech provider |
| — | `POST /voicebridge` (**VoiceBridge**): stateless; `{ language, turns, draft, context }` → `{ draft, missing, question, readBack, relatedCardId, privacyFlags, source }`. Rules always run (weekday / time / weeks / size in en, ta, hi; sentence roles; "change Wednesday to Thursday"; the related-card question once). With a model: extraction and the question / read-back wording in the coordinator's language, but the server decides what is missing, caps the questions at 3, cleans every string through the dignity rules and rejects any model sentence carrying a flagged word |
| — | `POST /dignity-check`: rule flags (name, money, caste, religion, health, age, the words we avoid) with a one-line reason and a rewrite; a model may add flags and a better rewrite. Publish waits until the check ran on the current words and every flag has an answer; a rules-only answer is said plainly |
| — | `POST /listening-guide`: 3 open questions for the visit; a model question that assumes anything about the group is dropped; fallback 3 fixed questions |
| — | `POST /suggest-update`: one line for the card after a visit, or null |
| — | `POST /find-teaching`: the id of the closest *verified* teaching, or null; the text shown is always the stored one |

---

## 7. Screens

| Route | Screen |
|---|---|
| `/login` | Demo user picker |
| `/` | Home: banner, tiles, Wisdom card, "Continue Your Seva" |
| `/opportunities` | 3 questions → up to 3 needs |
| `/needs/:id` | Need card, Verified mark, "Why?", handover from the last volunteer, "Visit and listen" |
| `/needs/:id/listen` | Ramp strip, guest briefing + Listening Guide + teaching → request → what I heard → "The next word is theirs" → the community's invitation and Commit, or the declined moment |
| `/commit/:visitId` | The community's invitation, one commitment sentence (prefilled from the rhythm), 4 weeks, teaching, Sankalpa ("what do you hope to learn here?") |
| `/my-seva` | Week X of N, weeks, "I have arrived" → Silent Seva, "I cannot come" + note, circle cover, invitation + teaching, pause / finish, the community's words once relayed |
| `/my-seva/:id/silent` | Silent Seva: a calm full screen, "Session over" |
| `/moments/declined`, `/moments/closed/:id`, `/moments/finished/:id` | The non-attachment moments: calm full screens, one action each; finished asks "What did they give you?" then "What did you give?" |
| `/profile` | "My Seva so far" (first words, latest words, every Sankalpa, what they gave you; owner only, no counts), conduct rules with "Why?", switch user, log out |
| `/coordinator` | Visits waiting (invite with the group's words / not now), "Updated after listening", open gaps, week grid, check-in, invitation, "what the group wanted to say" (with Dignity Check), "this need has ended", time travel |
| `/coordinator/post-need` | Voice/text → AI draft → edit → read back → community confirms + coordinator consents → publish |
| `/coordinator/resources` | Resource Connect |
| `/wisdom` | Teachings with sources, theme chips |
| `/reflect/:commitmentId` | Private diary, one question, "Why private?", teaching after a hard day |
| `/reflect/:commitmentId/then-and-now` | Week 1 words beside latest words |

Shared components: `WisdomCard`, `WhyLink`, `WhyModal`, `WisdomMoment`, `DignityCheck`, `ListeningGuide`,
`TeachingFinder`, `VoiceInput` (mic on Post a Need only; the diary stays type-only so private words never leave
for a third party), `Card`, `Button`, `AppShell`.

### 7b. What is built, and which question of the case study it answers

- **The One Visit ramp** (One visit → Invitation → 4 weeks → Continue). A first-time volunteer requests exactly one
  listening visit and is asked nothing afterwards except what they heard. The community, through its coordinator,
  invites them back or not; only an invitation opens the Commit screen, and a commitment without one is refused
  (409). *Answers:* "how does it draw a young volunteer from a single act into a sustained practice", and keeps the
  dignity of the community as host. *Code:* [`visits.js`](services/core/src/routes/visits.js) (decision),
  [`commitments.js`](services/core/src/routes/commitments.js) (11), [`ListenFirst.jsx`](apps/web/src/pages/ListenFirst.jsx)
  (`Ramp`, `TheirAnswer`), [`Commit.jsx`](apps/web/src/pages/Commit.jsx), `PendingVisit` in
  [`Coordinator.jsx`](apps/web/src/pages/Coordinator.jsx).
- **Listening Guide.** Three open questions for the listening visit, suggested by the bridge (with a fixed fallback
  when the AI is off), labelled as suggestions. *Answers:* "feel first, organize afterwards": the visit is for
  understanding, not for pitching. *Code:* [`ListeningGuide.jsx`](apps/web/src/components/seva/ListeningGuide.jsx),
  `/listening-guide` in [`ai.js`](services/bridge/src/routes/ai.js).
- **Sankalpa.** One private line written when committing, "what do you hope to learn here?", sealed once, and shown
  again only to its writer at Then and Now. *Answers:* "help them see their own growth in patience, humility and
  steadiness", and warns against pride by framing the commitment as learning, not delivering. *Code:*
  [`Sankalpa.js`](services/reflect/src/models/Sankalpa.js), 24b–c in [`reflect.js`](services/reflect/src/routes/reflect.js),
  [`Commit.jsx`](apps/web/src/pages/Commit.jsx), [`ThenAndNow.jsx`](apps/web/src/pages/ThenAndNow.jsx).
- **Silent Seva.** After "I have arrived", a calm full screen with no nav: "You are with them now. Put the phone away."
  The only tap is "Session over", which marks the week served and opens the diary. *Answers:* "hold together feeling
  and organization, so that efficiency does not hollow out the spirit of the work". *Code:*
  [`SilentSeva.jsx`](apps/web/src/pages/SilentSeva.jsx), 14b in [`commitments.js`](services/core/src/routes/commitments.js).
- **Dignity Check.** Every line that will be published about a group (the need card, "what the group wanted to say")
  is checked for a name, money, caste, religion, health detail or a word we avoid; rules answer even with the AI off,
  and the AI may add flags and a respectful rewrite that the coordinator uses or not. Nothing is saved until a person
  approves. *Answers:* "protect the dignity of the person served, so that no one is reduced to a case". *Code:*
  [`DignityCheck.jsx`](apps/web/src/components/seva/DignityCheck.jsx), [`dignity.js`](services/bridge/src/dignity.js),
  `/dignity-check` in [`ai.js`](services/bridge/src/routes/ai.js).
- **Teaching Finder.** On the Wisdom page, a volunteer describes a situation in its own box (never the diary, never
  saved) and the bridge picks the closest *verified* teaching by id; the text shown is always the stored one.
  *Answers:* a tool "through which young people learn what Vivekananda meant", without ever inventing his words.
  *Code:* [`TeachingFinder.jsx`](apps/web/src/components/seva/TeachingFinder.jsx), `/find-teaching` in
  [`ai.js`](services/bridge/src/routes/ai.js), [`teachings.js`](services/bridge/src/teachings.js).
- **The non-attachment moments: declined, closed, finished.** Calm full screens in our own plain words (no
  quotation), one next action, no apology and no retry. *Declined:* the community said no; listening was the seva,
  the answer was theirs to give. *Closed:* the need ended (school shut, organisation moved); the coordinator closes it,
  the commitment is complete, the volunteer chooses nothing. *Finished:* "What did they give you?" is asked first and
  kept privately; only then the handover, "What did you give?". *Answers:* "make the volunteer feel better about
  himself or herself regardless of the results", and "the one served offers the server the opportunity to grow".
  *Code:* [`Moment.jsx`](apps/web/src/pages/Moment.jsx), moments in [`reflect-data.js`](seed/reflect-data.js), 6b in
  [`needs.js`](services/core/src/routes/needs.js), 24d–e in [`reflect.js`](services/reflect/src/routes/reflect.js).
- **The community's voice back.** Once a seva has finished, the coordinator may relay one line from the group, "what
  the group wanted to say", in the language it was said, through the Dignity Check and with their approval. The
  volunteer reads it as the community's words on My Seva and at Then and Now. *Answers:* "the giver receives more than
  the receiver", made concrete. *Code:* 17b in [`commitments.js`](services/core/src/routes/commitments.js),
  `CommunityWords` in [`Coordinator.jsx`](apps/web/src/pages/Coordinator.jsx).
- **The humility check.** The fifth diary question, "Was there a moment this week I felt I knew better than them?",
  rotates with the other four. Private, never scored. *Answers:* his warning "against the pride that turns help into
  feeling superior to the receiver". *Code:* `QUESTIONS` in [`reflect-data.js`](seed/reflect-data.js).

---

## 8. Data

| Database | Collections | Notes |
|---|---|---|
| `seva_core` | users, orgs, needs, visits, commitments (with embedded weekly sessions), circles, resources | No hours field. No personal fields for people served |
| `seva_reflect` | questions, entries, wisdom, whys, moments | Entries are private, indexed on `{ userId, commitmentId, week }` |

Both seed scripts use the fixed ids in [seed/ids.js](seed/ids.js), so the seeded commitment in
core and the seeded diary entry in reflect line up. Seeds clear their collections first, so they are
safe to rerun. Every Vivekananda quote is verbatim from the *Complete Works* with its volume and piece
([seed/wisdom.json](seed/wisdom.json)); a quote is shown only after someone finds it in a printed
volume and sets `verified: true` with the page.

---

## 9. Non-negotiable rules

These are enforced in code and covered by tests, not just hidden in the UI.

1. **Listen first, and the community speaks first.** A commitment needs a completed visit, the community's invitation and the volunteer's acceptance (409 otherwise). A volunteer cannot send an invitation (403).
2. **No hours, points, ranks, streaks or badges** anywhere, in data or on screen.
3. **Dignity of the people served.** No names, ages, income, caste, religion, health or photos stored or shown.
   Words we avoid: poor, needy, beneficiary, donate.
4. **The diary is private.** No other volunteer and no coordinator can read it. No AI, scoring or sentiment on diary text. The same holds for the Sankalpa and "What did they give you?".
5. **AI only drafts.** A coordinator edits, reads the card back, the community confirms, the coordinator consents, and only then publishes. "What the group wanted to say" goes through the Dignity Check and the coordinator's approval before it is saved; money and the words we avoid are refused outright.
6. **Identity is never trusted from the browser.** The gateway strips and resets `x-user-*` headers.
7. **Keys stay in `bridge`.** No Groq or Bhashini key in the frontend or in git.

---

## 10. Status

The two halves (Person A and Person B's `person-b-build` branch) are merged into one app at the repo
root. Everything in sections 6–9 is built and covered by tests:

| Suite | Command | Checks |
|---|---|---|
| API and product rules | `npm run test:api` | T1–T28 (T13 = volunteer cannot invite, T13b = no commitment without an invitation), X1–X21 (X17–X21: the moments, "what they gave you", closing a need, the community's words, My Seva so far) |
| Screens in Chrome | `npm run test:ui`, `npm run test:ui:desktop` | 33 checks at 390 px and at 1440 px (M1 declined, M2 closed, V1 the community's words, H1 finish in the right order, P1 My Seva so far, L1 Tamil toggle) |
| Unit and component | `npm test` | reflect, bridge, web |

## 11. Roadmap

### Done

- [x] Core volunteer loop, coordinator dashboard, Post a Need, diary, Then and Now, wisdom, "Why?"
- [x] Pause with a return date, finish with a handover, absence notes, Resource Connect
- [x] Wording sweep: no "beneficiary / poor / needy / donate / hours / rank / points" in the UI
- [x] `mono.js` runs all four services in one process
- [x] Sankalpa, Silent Seva, Listening Guide, Teaching Finder, Dignity Check, "Updated after listening", Community Check-in
- [x] The One Visit ramp: the community invites first; no commitment without an invitation (409)
- [x] The non-attachment moments (declined, closed, finished) and "What did they give you?" before the handover
- [x] The community's voice back: "what the group wanted to say", checked and approved, shown as their words
- [x] The humility check (fifth diary question) and the Sankalpa as "what do you hope to learn here?"
- [x] Then and Now across commitments: "My Seva so far" on Profile (`GET /api/reflect/my-seva`, owner only, no counts)
- [x] Tamil on the coordinator screens: `apps/web/src/i18n/` (English keys, `ta.js` marked *needs review by a Tamil speaker*), a toggle on the dashboard and Post a Need; teachings, quotes and anything a person wrote are never translated

### Still to do

- [ ] **Deploy.** Atlas cluster + two URIs, push `main` from the INDHUPRIYAN account, Render Blueprint, Vercel with `VITE_API_URL`, gateway `WEB_ORIGIN`; then `/health/all` green on the live gateway
- [ ] Tick each quote off against a printed volume (`verified: true` in `seed/wisdom.json`, add the page); all 12 are still hidden. Verify w01, w02 and w09 first: they carry the "Why?" on the need card and the listening moment
- [ ] Add the Groq and Bhashini keys to `services/bridge/.env` (the file does not exist yet), run `npm run check` with a Tamil recording; without the Groq key, Post a Need gives the fixed draft and the Dignity Check is rules-only (money and the words we avoid, but not names)
- [ ] Run `test:api` and `test:ui` against the live URLs, twice, in incognito; check on a real phone
- [ ] Record a backup demo video; add the live URLs to the README

### Next steps (not in this version)

- [ ] **Walk with someone**: the first listening visit beside a circle member who has served there before
- [ ] A Tamil speaker reads every line of `apps/web/src/i18n/ta.js` aloud with a coordinator and fixes the wording; then Hindi the same way

---

## 12. The demo (12 steps)

Two browsers: Meera (new volunteer) and Lakshmi (coordinator). Rahul plays the volunteer who is not invited back.

1. Open `/health/all`: every service is `true`. Lakshmi → Post a Need → speaks/types a Tamil sentence → the draft appears → the Dignity Check flags a name, she uses the rewrite → reads it back → community confirms + consent → publishes.
2. Meera → Needs → 3 questions → sees the new need → opens the card → taps "Why?" → reads the teaching.
3. **One visit.** Meera → "Visit and listen" → the Listening Guide's three questions → requests the visit → writes "What did you hear that you did not expect?" → the screen says *The next word is theirs*. Nothing asks her to commit.
4. **A declined moment.** Rahul has visited the Reading Corner and written what he heard. Lakshmi → "Not now". Rahul opens his visit and lands on the calm *Not this time* screen: listening was the seva; one button, "See the next need".
5. **The invitation.** Lakshmi → Meera's visit → edits the group's words ("The children asked when you are coming back") → "Invite them back". Meera refreshes: the community's words, and only now, Commit.
6. **Commit.** Meera → the sentence (prefilled from the rhythm), 4 weeks, her Sankalpa: *what do you hope to learn here?* → "Begin 4 weeks". The ramp strip reads One visit → Invitation → **4 weeks** → Continue.
7. Switch to Arjun (week 2 of 4) → "I have arrived" → **Silent Seva**: *You are with them now. Put the phone away.* → "Session over" → the diary opens on this week's question → he answers; mark it a hard day and the teaching appears.
8. Lakshmi → time travel Meera to week 4 → the Community Check-in (three answers) → "would the community like her to continue?" → sends the invitation.
9. Meera → Then and Now: her Sankalpa, week 1 beside the latest entry. → Continue → "Week 4 of 8".
10. **Finish, in the right order.** Meera → "Need to step away?" → Finish → first *What did they give you?* → then *What did you give?* (the handover) → My Seva says Finished; the need is open again with her handover on the card.
11. **The community's words.** Lakshmi → Meera's finished card → "Add what the group wanted to say" → the Dignity Check runs → she approves → "Relay to Meera". Meera → My Seva and Then and Now show *The community's words*, as said.
12. Lakshmi's dashboard: the week grid with no gaps, *The children were never left waiting.* (If time: "This need has ended" on Arjun's need → Arjun lands on *This seva is complete*, with nothing to choose.)

**"Done" means:** every check passes on the deployed URL, in a fresh incognito window, two times in a row.

---

## 13. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Groq slow or down | 8 s timeout → fixed fallback draft; demo still works with no key |
| Bhashini speech fails | Type/paste the Tamil sentence; Groq's `whisper-large-v3` as backup STT |
| Bhashini translation fails | Groq drafts from the Tamil directly |
| Render cold start | Hit `/health/all` 2 minutes before the demo |
| Multi-service hosting breaks | `node mono.js` runs the whole backend in one process |
| reflect service down | Home still loads; only the Wisdom card is hidden |
| Behind schedule | Cut in this order: Wisdom themes, voice input, privacy-flag UI. Never cut Diary, Then and Now, Post a Need |
| A quote cannot be verified | Remove it from the seed |

## 14. Not in this version

Real sign-up and passwords, push or email notifications, maps, multiple coordinators per org,
organisation verification workflow, analytics dashboards, and native mobile apps.
