# SevaSetu — Project Plan

> *"They alone live who live for others."* — Swami Vivekananda

SevaSetu ("bridge of service") is a mobile-first web app for **sustained, dignity-first volunteering**.
It does not help people "donate hours". It helps a volunteer find **one** right community need, **listen
before committing**, serve the same people week after week, and reflect privately on what they learn.

This page is the overview of the whole thing. How to run it is in [README.md](README.md). Related docs:

- [docs/CONTRACT.md](docs/CONTRACT.md): the rules every service keeps to
- [docs/api.http](docs/api.http): all 29 endpoints as runnable requests
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
| Needs | 4–6 | Filtered search (max 3, with `fitReason`), need detail (with the last volunteer's handover note), post a need (coordinator only; community confirmation **and** coordinator consent, else 400) |
| Visits | 7–10 | Request visit, my visits, "what I heard", yes/no decision → `agreed` (no decision before the visit, 409) |
| Commitments | 11–17 | Commit (only after `agreed`), list, detail, absence (with an optional note for whoever covers), cover (circle only), invitation, continue / pause (with a return date) / finish (with a handover note; the need opens again) |
| Other | 18–20 | My circle (+ open gaps with notes, + handover notes), coordinator overview, demo time travel |
| Resource Connect | — | Offer or ask for things; matches of the same type from other organisations (same city first); connect; hand over |

### reflect — endpoints 21–27, plus 27b

| # | What |
|---|---|
| 21 | This week's diary question (4 themes rotate: patience, listening, effort, received) |
| 22–23 | Save / list **my own** diary entries (one per week) |
| 24 | Then and Now: first entry vs latest |
| 25–26 | Wisdom of the day, wisdom by theme — verbatim quotes with their source |
| 27 | "Why?" for a rule: verified teaching (or none) → interpretation → product decision |
| 27b | A teaching for one moment (before-listen, commit, hard-day, continue): verified teaching → interpretation → practice |

### bridge — endpoints 28–29

| # | What |
|---|---|
| 28 | Coordinator's words → draft need card. Bhashini translates Tamil/Hindi → Groq (`openai/gpt-oss-20b`, strict JSON) drafts → privacy flags. 8 s timeout, falls back to a fixed draft. Never publishes |
| 29 | Speech → text through Bhashini. Audio is never stored |

---

## 7. Screens

| Route | Screen |
|---|---|
| `/login` | Demo user picker |
| `/` | Home: banner, tiles, Wisdom card, "Continue Your Seva" |
| `/opportunities` | 3 questions → up to 3 needs |
| `/needs/:id` | Need card, Verified mark, "Why?", handover from the last volunteer, "Visit and listen" |
| `/needs/:id/listen` | Guest briefing + teaching → request → what I heard → yes/no |
| `/commit/:visitId` | One commitment sentence (prefilled from the rhythm), 4 weeks, teaching |
| `/my-seva` | Week X of N, weeks, "I cannot come" + note, circle cover, invitation + teaching, pause / finish with handover |
| `/profile` | Conduct rules with "Why?", switch user, log out |
| `/coordinator` | Pending visits, open gaps, week grid, "would the community like them to continue?", invitation, time travel |
| `/coordinator/post-need` | Voice/text → AI draft → edit → read back → community confirms + coordinator consents → publish |
| `/coordinator/resources` | Resource Connect |
| `/wisdom` | Teachings with sources, theme chips |
| `/reflect/:commitmentId` | Private diary, one question, "Why private?", teaching after a hard day |
| `/reflect/:commitmentId/then-and-now` | Week 1 words beside latest words |

Shared components: `WisdomCard`, `WhyLink`, `WhyModal`, `WisdomMoment`, `VoiceInput` (mic on Post a Need only;
the diary stays type-only so private words never leave for a third party), `Card`, `Button`, `AppShell`.

---

## 8. Data

| Database | Collections | Notes |
|---|---|---|
| `seva_core` | users, orgs, needs, visits, commitments (with embedded weekly sessions), circles, resources | No hours field. No personal fields for people served |
| `seva_reflect` | questions, entries, wisdom, whys, moments | Entries are private, indexed on `{ userId, commitmentId, week }` |

Both seed scripts use the fixed ids in [seed/ids.js](seed/ids.js), so the seeded commitment in
core and the seeded diary entry in reflect line up. Seeds clear their collections first, so they are
safe to rerun. Every Vivekananda quote is verbatim from the *Complete Works* with its volume and piece
([seed/wisdom-quotes.js](seed/wisdom-quotes.js)); page numbers and the final `checked: true` wait for
someone to look in a printed volume.

---

## 9. Non-negotiable rules

These are enforced in code and covered by tests, not just hidden in the UI.

1. **Listen first.** A commitment cannot exist without a visit where both sides said yes (409 otherwise).
2. **No hours, points, ranks, streaks or badges** anywhere, in data or on screen.
3. **Dignity of the people served.** No names, ages, income, caste, religion, health or photos stored or shown.
   Words we avoid: poor, needy, beneficiary, donate.
4. **The diary is private.** No other volunteer and no coordinator can read it. No AI, scoring or sentiment on diary text.
5. **AI only drafts.** A coordinator edits, reads the card back, the community confirms, the coordinator consents, and only then publishes.
6. **Identity is never trusted from the browser.** The gateway strips and resets `x-user-*` headers.
7. **Keys stay in `bridge`.** No Groq or Bhashini key in the frontend or in git.

---

## 10. Status

The two halves (Person A and Person B's `person-b-build` branch) are merged into one app at the repo
root. Everything in sections 6–9 is built and covered by tests:

| Suite | Command | Checks |
|---|---|---|
| API and product rules | `npm run test:api` | T1–T28, T25b, X1–X7 |
| Screens in Chrome | `npm run test:ui`, `npm run test:ui:desktop` | 28 checks at 390 px and at 1440 px |
| Unit and component | `npm test` | reflect, bridge, web |

## 11. Roadmap

### Done

- [x] Core volunteer loop, coordinator dashboard, Post a Need, diary, Then and Now, wisdom, "Why?"
- [x] Pause with a return date, finish with a handover, absence notes, Resource Connect
- [x] Wording sweep: no "beneficiary / poor / needy / donate / hours / rank / points" in the UI
- [x] `mono.js` runs all four services in one process

### Still to do

- [ ] Add the Groq and Bhashini keys to `services/bridge/.env`, run `npm run check` with a Tamil recording
- [ ] Tick each quote off against a printed volume (`checked: true`, add the page)
- [ ] Seed Atlas, deploy the four services on Render and the web app on Vercel
- [ ] Run `test:api` and `test:ui` against the live URLs, twice, in incognito; check on a real phone
- [ ] Record a backup demo video; add the live URLs to the README

---

## 12. The demo (12 steps)

1. Open `/health/all`: every service is `true`.
2. Coordinator → Post a Need → speaks/types a Tamil sentence → draft appears → edits → reads it back → community confirms + consent → publishes.
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
| Multi-service hosting breaks | `node mono.js` runs the whole backend in one process |
| reflect service down | Home still loads; only the Wisdom card is hidden |
| Behind schedule | Cut in this order: Wisdom themes, voice input, privacy-flag UI. Never cut Diary, Then and Now, Post a Need |
| A quote cannot be verified | Remove it from the seed |

## 14. Not in this version

Real sign-up and passwords, push or email notifications, maps, multiple coordinators per org,
organisation verification workflow, analytics dashboards, and native mobile apps.
