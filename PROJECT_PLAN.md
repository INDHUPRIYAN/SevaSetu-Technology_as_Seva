# SevaSetu — Project Plan

> *"They alone live who live for others."* — Swami Vivekananda

SevaSetu ("bridge of service") is a mobile-first web app for **sustained, dignity-first volunteering**.
It does not help people "donate hours". It helps a volunteer find **one** right community need, **listen
before committing**, serve the same people week after week, and reflect privately on what they learn.

This page is the overview of the whole thing. The detailed build plans are:

- [person-a/PERSON_A_LEAD.md](person-a/PERSON_A_LEAD.md): gateway, core service, volunteer loop (70%)
- [person-b/PERSON_B_SUPPORT.md](person-b/PERSON_B_SUPPORT.md): diary, wisdom, Seva Bridge AI (30%)
- [shared/CONTRACT.md](shared/CONTRACT.md): the rules both halves keep to
- [docs/INTEGRATION.md](docs/INTEGRATION.md): how the two folders merge into one app

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
| "Register" button | **Visit and listen first.** No commitment until both sides say yes |
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

```text
 VOLUNTEER                                         COORDINATOR
 ─────────                                         ───────────
                                                   Post a Need (voice/text → AI draft
                                                     → edit → read back → publish)
 1. Discover    3 questions → up to 3 needs              │
 2. Understand  Need card: want / serve us well /        │
                learn / rhythm + "Why?"                  │
 3. Listen      Guest briefing → request visit ──────► sees pending visit
                → write "what I heard" → Yes  ◄──────► says Yes / No
 4. Commit      One sentence, 4 weeks, fixed day/time
 5. Serve       My Seva: Week X of N, circle,      ◄── week grid (served/covered/gap)
                "I cannot come" → member covers
 6. Reflect     Private diary, 1 question a week,
                Then and Now (week 1 vs latest)
 7. Continue    Invitation card → Continue /       ◄── sends invitation
                Pause / Finish
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
**Hosting:** Vercel (web), Render (services), Atlas (data). `mono.js` runs gateway + core in one
process as a fallback if a host misbehaves.

**Rules every service follows** (full list in [shared/CONTRACT.md](shared/CONTRACT.md)):

- `GET /health` → `{ ok: true, service }`. Success is `{ data }`, failure is `{ error: { message } }`.
- The user comes **only** from gateway headers, never from the request body.
- Services never call each other. AI keys live only in `bridge`.

---

## 6. What we build — by service

### core (Person A) — endpoints 1–20

| Area | # | What |
|---|---|---|
| Auth | 1–3 | List demo users, demo login (JWT 12h), who am I |
| Needs | 4–6 | Filtered search (max 3, with `fitReason`), need detail, post a need (coordinator + consent only) |
| Visits | 7–10 | Request visit, my visits, "what I heard", yes/no decision → `agreed` |
| Commitments | 11–17 | Commit (only after `agreed`), list, detail, absence, cover (circle only), invitation, continue/pause/finish |
| Other | 18–20 | My circle (+ open gaps), coordinator overview, demo time travel |

### reflect (Person B) — endpoints 21–27

| # | What |
|---|---|
| 21 | This week's diary question (4 themes rotate: patience, listening, effort, received) |
| 22–23 | Save / list **my own** diary entries (one per week) |
| 24 | Then and Now: first entry vs latest |
| 25–27 | Wisdom of the day, wisdom by theme, "Why?" teaching for a rule |

### bridge (Person B) — endpoints 28–29

| # | What |
|---|---|
| 28 | Coordinator's words → draft need card. Bhashini translates Tamil/Hindi → Groq (`openai/gpt-oss-20b`, strict JSON) drafts → privacy flags. 8 s timeout, falls back to a fixed draft |
| 29 | Speech → text through Bhashini. Audio is never stored |

---

## 7. Screens

| Route | Screen | Owner |
|---|---|---|
| `/login` | Demo user picker | A |
| `/` | Home: banner, tiles, Wisdom card, "Continue Your Seva" | A (+ B's `WisdomCard`) |
| `/opportunities` | 3 questions → up to 3 needs | A |
| `/needs/:id` | Need card, Verified mark, "Visit and listen" | A (+ B's `WhyLink`) |
| `/needs/:id/listen` | Guest briefing → request → what I heard → yes/no | A |
| `/commit/:visitId` | One sentence, 4 weeks | A |
| `/my-seva` | Week X of N, sessions, absence/cover, circle, invitation | A |
| `/profile` | Conduct rules, switch user, log out | A |
| `/coordinator` | Pending visits, week grid, send invitation, time travel | A |
| `/wisdom` | Teachings with sources, theme chips | B |
| `/reflect/:commitmentId` | Private diary, one question | B |
| `/reflect/:commitmentId/then-and-now` | Week 1 words beside latest words | B |
| `/coordinator/post-need` | Voice/text → AI draft → edit → read-back → publish | B |

Shared B components: `WisdomCard`, `WhyLink`, `WhyModal`, `VoiceInput` (mic on Post a Need only).

---

## 8. Data

| Database | Collections | Notes |
|---|---|---|
| `seva_core` | users, orgs, needs, visits, commitments (with sessions), circles | No hours field. No personal fields for people served |
| `seva_reflect` | questions, entries, wisdom, whys | Entries are private, indexed on `{ userId, commitmentId, week }` |

Both seed scripts use the fixed ids in [shared/ids.js](shared/ids.js), so the seeded commitment in
core and the seeded diary entry in reflect line up. Seeds clear their collections first, so they are
safe to rerun. Every Vivekananda quote must be checked against the *Complete Works* with volume and
page. Unverified quotes are left out.

---

## 9. Non-negotiable rules

These are enforced in code and covered by tests, not just hidden in the UI.

1. **Listen first.** A commitment cannot exist without a visit where both sides said yes (409 otherwise).
2. **No hours, points, ranks, streaks or badges** anywhere, in data or on screen.
3. **Dignity of the people served.** No names, ages, income, caste, religion, health or photos stored or shown.
   Words we avoid: poor, needy, beneficiary, donate.
4. **The diary is private.** No other volunteer and no coordinator can read it. No AI, scoring or sentiment on diary text.
5. **AI only drafts.** A coordinator edits, reads the card back to the community, ticks consent, and only then publishes.
6. **Identity is never trusted from the browser.** The gateway strips and resets `x-user-*` headers.
7. **Keys stay in `bridge`.** No Groq or Bhashini key in the frontend or in git.

---

## 10. Team split and status

| Part | Owner | Status |
|---|---|---|
| Gateway, core (1–20), seed-core, `mono.js` | Person A | Built, in working tree |
| App shell + 9 screens, UI kit, test scripts (T1–T28, S1–S15) | Person A | Built, in working tree |
| Render blueprint (core + gateway), Vercel config | Person A | Written |
| Stand-ins for B's components/pages (`integration/personB.jsx`) | Person A | In place ("Coming soon") |
| Bridge provider clients (`llm.js`, `bhashini.js`, `check-providers.js`) | Person B | Written |
| reflect service (21–27) + seed-reflect | Person B | Not started (parked) |
| bridge routes (28–29) + fallback draft | Person B | Not started (parked) |
| `WisdomCard`, `WhyLink`, `WhyModal`, `VoiceInput` + 4 pages | Person B | Not started (parked) |
| `docs/api.http` | Person B | Not started |

---

## 11. Roadmap

### Phase 1 — Person A's volunteer loop (done, needs commit + deploy check)

- [ ] Commit the Person A work now in the working tree
- [ ] Seed Atlas, deploy core + gateway on Render, web on Vercel
- [ ] T2–T26, T28 and S1–S5, S7–S15 pass on the live URLs, twice, in incognito

### Phase 2 — Person B's half

- [ ] Copy the service template into `reflect` and `bridge`; both answer `/health`
- [ ] Run `npm run check` in bridge to confirm Groq + Bhashini work. If Tamil speech fails, keep the text box as plan B
- [ ] reflect endpoints 21–27 + `seed-reflect.js` (8 checked quotes, 4 whys, 4 questions, 1 seeded entry)
- [ ] bridge endpoints 28–29 + `fallbackDraft.json`
- [ ] Components and 4 pages, using A's `api`, `useAuth`, `Card`, `Button`
- [ ] R1–R19 (R10–R12 diary privacy first), B1–B14, U1–U18 pass

### Phase 3 — Integration ([docs/INTEGRATION.md](docs/INTEGRATION.md))

- [ ] Check for path collisions, then `git mv` both folders to the final tree
- [ ] Fix seed imports, add reflect + bridge to `package.json` and `mono.js`
- [ ] Set `REFLECT_URL` and `BRIDGE_URL` on the gateway
- [ ] Swap stand-ins in `integration/personB.jsx` for B's real files
- [ ] T1, T27, S6, D5 now pass

### Phase 4 — Demo ready

- [ ] D1–D6 deployment checks (cold start, no console/CORS errors, `.env` not in git, real phone)
- [ ] Wording sweep: no "beneficiary / poor / needy / donate / hours / rank / points"
- [ ] Joint demo run passes **twice** without touching code
- [ ] Backup demo video recorded; README has the live URLs, local setup, seeding, demo steps

---

## 12. The demo (12 steps)

1. Open `/health/all`: every service is `true`.
2. Coordinator → Post a Need → speaks/types a Tamil sentence → draft appears → ticks read-back → publishes.
3. New volunteer → Needs → 3 questions → sees the new need.
4. Opens the card → taps "Why?" → reads the teaching.
5. Visit and listen → writes what she heard → says yes.
6. Coordinator says yes.
7. Volunteer commits for 4 weeks.
8. Switch to the seeded volunteer (week 2 of 4) → diary → answers this week's question.
9. Coordinator → time travel to week 4 → sends the invitation.
10. Volunteer → Then and Now shows week 1 beside the latest entry.
11. Volunteer → Continue → "Week 4 of 8".
12. Coordinator dashboard shows the week grid with no gaps.

**"Done" means:** every check passes on the deployed URL, in a fresh incognito window, two times in a row.

---

## 13. Risks and fallbacks

| Risk | Fallback |
|---|---|
| Groq slow or down | 8 s timeout → fixed fallback draft; demo still works with no key |
| Bhashini speech fails | Type/paste the Tamil sentence; Groq's `whisper-large-v3` as backup STT |
| Bhashini translation fails | Groq drafts from the Tamil directly |
| Render cold start | Hit `/health/all` 2 minutes before the demo |
| Multi-service hosting breaks | `node mono.js` runs gateway + core in one process |
| reflect service down | Home still loads; only the Wisdom card is hidden |
| Behind schedule | Cut in this order: Wisdom themes, voice input, privacy-flag UI. Never cut Diary, Then and Now, Post a Need |
| A quote cannot be verified | Remove it from the seed |

## 14. Not in this version

Real sign-up and passwords, push or email notifications, maps, multiple coordinators per org,
organisation verification workflow, analytics dashboards, and native mobile apps.
