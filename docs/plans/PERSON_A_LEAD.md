# SevaSetu — Person A (Lead, 70%)

> **Historical build plan.** The two halves have since been merged into one app at the repo root
> (see [README.md](../../README.md)). Paths like `person-a/…` and `services/…` below refer to the
> original split; endpoint numbers and test ids (T, S, R, B, U, D) are still the ones the code uses.

You build the **critical path**: the gateway, the core service, and the full volunteer loop
(Discover → Understand → Listen → Commit → Serve → Continue). If your part works, the demo works.

Read this with the shared doc "SevaSetu — Architecture and 12-Hour Build Plan". Endpoint numbers
(1 to 29) are the same in both. Endpoint 29 (speech to text) was added later for Bhashini.

---

## 1. What you own

| Type | Items |
|---|---|
| Services | `services/gateway` (port 8080), `services/core` (port 4001) |
| Database | `seva_core` (users, orgs, needs, visits, commitments, circles) |
| Frontend shell | `main.jsx`, `App.jsx`, `routes.jsx`, `lib/api.js`, `lib/auth.js`, `components/ui/*` |
| Screens | Login, Home, Opportunities, Need detail, Listen First, Commit, My Seva, Profile, Coordinator dashboard |
| Chores | Repo setup, service template, Tailwind theme, deployment, final merge, `mono.js` fallback |

**You do NOT build:** diary, Then and Now, Wisdom, "Why?" popup, Post a Need, the AI call, seed scripts.
Those are Person B's.

---

## 2. Your timeline

| Hours | Work | Done when |
|---|---|---|
| 0–1 | Repo, template, gateway + core "hello", deploy all 4 services + web empty | 5 live URLs answer `/health` |
| 1–3 | Core models, demo login, needs filter, gateway JWT + routing | Endpoints 1–6 work through the gateway |
| 3–4 | Visits + commitments endpoints | Endpoints 7–20 work. Merge to `main` |
| 4–6 | App shell, Login, Home, Opportunities, Need detail | You can log in and open a need on the live site |
| 6–8 | Listen First, Commit, My Seva | Full volunteer path works on the live site |
| 8–10 | Coordinator dashboard, invitation, continue, time travel, absence/cover | Feature freeze |
| 10–12 | Demo runs, bug fixes only, final deploy | Section 8 checklist is all ticked |

---

## 3. Step 1 — Repo and service template (hour 0–1)

```text
sevasetu/
  package.json          # npm workspaces: ["apps/*", "services/*"]
  apps/web/
  services/gateway/  services/core/  services/reflect/  services/bridge/
  seed/   docs/   mono.js   .env.example
```

Every service has the same shape. Write it once; B copies it.

```js
// services/core/src/app.js  — builds the app, does NOT listen
const express = require('express');
const cors = require('cors');

function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json());                       // services parse JSON (the gateway does not)

  app.get('/health', (req, res) => res.json({ ok: true, service: 'core' }));

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/needs', require('./routes/needs'));
  // ...more routes

  // one error handler for the whole service
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({ error: { message: err.message } });
  });
  return app;
}
module.exports = { createApp };
```

```js
// services/core/src/server.js — connects to MongoDB, then listens
require('dotenv').config();
const mongoose = require('mongoose');
const { createApp } = require('./app');

mongoose.connect(process.env.MONGO_URI).then(() => {
  createApp().listen(process.env.PORT || 4001, () => console.log('core up'));
});
```

Root `package.json` script so one command starts everything:

```json
"scripts": {
  "dev": "concurrently \"npm:dev -w services/gateway\" \"npm:dev -w services/core\" \"npm:dev -w services/reflect\" \"npm:dev -w services/bridge\" \"npm:dev -w apps/web\""
}
```

**Deploy now**, while everything is still "hello". Do not wait.

---

## 4. Step 2 — Gateway (hour 1–2)

The gateway does three things: check the token, add user headers, forward the request.

```js
// services/gateway/src/app.js
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { createProxyMiddleware } = require('http-proxy-middleware');

const PUBLIC = ['/api/auth/users', '/api/auth/demo-login'];   // no token needed

function pickTarget(url) {
  if (url.startsWith('/api/reflect') || url.startsWith('/api/wisdom')) return process.env.REFLECT_URL;
  if (url.startsWith('/api/bridge')) return process.env.BRIDGE_URL;
  return process.env.CORE_URL;
}

function createApp() {
  const app = express();
  app.use(cors({ origin: process.env.WEB_ORIGIN || true }));
  // IMPORTANT: no express.json() here. If the gateway reads the body, the proxy sends an empty one.

  app.get('/health', (req, res) => res.json({ ok: true, service: 'gateway' }));

  // wake-up route: call this 2 minutes before the demo
  app.get('/health/all', async (req, res) => {
    const urls = [process.env.CORE_URL, process.env.REFLECT_URL, process.env.BRIDGE_URL];
    const results = await Promise.all(
      urls.map(u => fetch(u + '/health').then(r => r.ok).catch(() => false))
    );
    res.json({ core: results[0], reflect: results[1], bridge: results[2] });
  });

  // auth: check the token, then tell the services who the user is
  app.use((req, res, next) => {
    delete req.headers['x-user-id'];             // never trust these from the browser
    delete req.headers['x-user-role'];
    if (PUBLIC.some(p => req.url.startsWith(p))) return next();
    try {
      const token = (req.headers.authorization || '').replace('Bearer ', '');
      const user = jwt.verify(token, process.env.JWT_SECRET);
      req.headers['x-user-id'] = user.sub;
      req.headers['x-user-role'] = user.role;
      next();
    } catch (e) {
      res.status(401).json({ error: { message: 'Please log in' } });
    }
  });

  // forward everything else, path unchanged
  app.use(createProxyMiddleware({
    target: process.env.CORE_URL,
    changeOrigin: true,
    router: req => pickTarget(req.url),
  }));
  return app;
}
module.exports = { createApp };
```

If the proxy library version behaves differently, check its README for the `router` option. The idea
stays the same: mount at the root so the path is not changed.

---

## 5. Step 3 — core-service endpoints (hour 1–4)

Read the user from headers in every route:

```js
const me = req => ({ id: req.headers['x-user-id'], role: req.headers['x-user-role'] });
```

### Auth (endpoints 1–3)

| # | Endpoint | Logic |
|---|---|---|
| 1 | `GET /api/auth/users` | Return all seeded users: `_id, name, role` only |
| 2 | `POST /api/auth/demo-login` | Find user by `userId`. Sign JWT `{ sub: user._id, role }` with `JWT_SECRET`, 12h expiry. Return `{ token, user }`. Unknown id → 404 |
| 3 | `GET /api/auth/me` | Return the user from `x-user-id` |

### Needs (endpoints 4–6)

| # | Endpoint | Logic |
|---|---|---|
| 4 | `GET /api/needs?day=&maxKm=&interest=` | Filter: `status = open`, `rhythm.day = day`, org `distanceKm <= maxKm`, `interestTags` contains `interest`. Sort by distance. **Limit 3.** Add `fitReason` to each |
| 5 | `GET /api/needs/:id` | Full card + org name + `verified`. Unknown → 404 |
| 6 | `POST /api/needs` | Coordinator only (else 403). Reject if `consent.readBack` is not `true` (400). Save with `status: 'open'` |

`fitReason` is a plain sentence built in code, no AI:

```js
// "Saturday morning, 3 km away, you said you enjoy teaching."
const fitReason = `${need.rhythm.day}, ${org.distanceKm} km away, you said you enjoy ${interest}.`;
```

### Listen-First visits (endpoints 7–10)

| # | Endpoint | Logic |
|---|---|---|
| 7 | `POST /api/needs/:id/visits` | Volunteer only. Create `{ status: 'requested' }`. If this volunteer already has a visit for this need → 409 |
| 8 | `GET /api/visits/mine` | Volunteer: own visits. Coordinator: visits for needs they coordinate. Include need title and volunteer name |
| 9 | `PATCH /api/visits/:id/heard` | Volunteer who owns it. Save `heardText`, set `status: 'visited'`. Empty text → 400 |
| 10 | `PATCH /api/visits/:id/decision` | Body `{ yes }`. Volunteer sets `volunteerYes`, coordinator sets `coordinatorYes`. Both `true` → `status: 'agreed'`. Any `false` → `status: 'declined'` |

### Commitments (endpoints 11–17)

| # | Endpoint | Logic |
|---|---|---|
| 11 | `POST /api/commitments` | Visit must belong to this volunteer AND be `agreed`, else **409**. Create sessions for week 1..N as `upcoming`, `currentWeek: 1`. Set need `status: 'filled'` |
| 12 | `GET /api/commitments/mine` | This volunteer's commitments with need title, place, rhythm |
| 13 | `GET /api/commitments/:id` | One commitment + sessions + invitation. Only the volunteer, a circle member or the need's coordinator |
| 14 | `POST /api/commitments/:id/absence` | Body `{ week }`. Owner only. Set that session `status: 'gap'` |
| 15 | `POST /api/commitments/:id/cover` | Body `{ week }`. Caller must be in the same circle and not the owner. Set `status: 'covered'`, `coveredBy` |
| 16 | `POST /api/commitments/:id/invitation` | Coordinator of that need only. Save `invitation: { text, sentAt }` |
| 17 | `PATCH /api/commitments/:id/continue` | Body `{ choice }` = `continue` / `pause` / `finish`. Needs an invitation first (else 409). On `continue`: add 4 more weeks of `upcoming` sessions |

### Other (endpoints 18–20)

| # | Endpoint | Logic |
|---|---|---|
| 18 | `GET /api/circles/mine` | The volunteer's circle with member names |
| 19 | `GET /api/coordinator/overview` | Coordinator only. `{ needs, pendingVisits, commitments }` where each commitment has its sessions (the week grid) |
| 20 | `POST /api/demo/advance` | Body `{ commitmentId, toWeek }`. Set `currentWeek = toWeek`. Every `upcoming` session with `week < toWeek` becomes `served` |

**Rules you must not break (judges may check):**

- No schema has a field for a served person's name, age, income, caste, religion or photo.
- No field stores hours. Progress is `currentWeek` of `weeks`.
- A commitment cannot exist without a visit where both sides said yes.

---

## 6. Step 4 — Frontend (hour 4–10)

### Shell first

```js
// apps/web/src/lib/api.js — one axios client for the whole app
import axios from 'axios';
import { useAuth } from './auth';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use(cfg => {
  const token = useAuth.getState().token;        // zustand store
  if (token) cfg.headers.Authorization = `Bearer ${token}`;
  return cfg;
});

// every response is { data: ... } so unwrap it once here
api.interceptors.response.use(r => r.data.data, e => Promise.reject(e.response?.data?.error || e));
```

- `AppShell`: max width 430 px, centred, cream background, bottom nav with 5 tabs
  (Home, Needs, My Seva, Wisdom, Profile).
- Tailwind theme: saffron accent, cream background, dark brown text. Take the values from the mockup.
- `routes.jsx`: add B's routes as soon as B gives you the page names. Until then, use a placeholder page.

### Screens

| Route | Shows | Calls | Done when |
|---|---|---|---|
| `/login` | List of demo users as cards | 1, 2 | Tap a user → token saved → goes to `/` (volunteer) or `/coordinator` |
| `/` | Banner, "Begin Your Seva Journey", 4 tiles, B's `<WisdomCard />`, "Continue Your Seva" card | 3, 12 | Card shows "Week X of N" from real data. No photo of people |
| `/opportunities` | 3 questions (day, distance, interest) → up to 3 cards with `fitReason` | 4 | Never more than 3 cards. Empty state if none |
| `/needs/:id` | 4 parts: What we want, How to serve us well, What you will learn, Rhythm. "Verified" mark. Button: **Visit and listen** | 5 | There is no "Register" button anywhere |
| `/needs/:id/listen` | Step 1 guest briefing → Step 2 request visit → Step 3 "What did you hear that you did not expect?" → Step 4 yes/no, shows the other side's answer | 7–10 | "Commit" button appears only when both said yes |
| `/commit/:visitId` | One text box for the sentence, 4 weeks fixed, day and time shown | 11 | After save → goes to `/my-seva` |
| `/my-seva` | "Week X of N" progress, session list, "I cannot come this week", circle members, invitation card with Continue / Pause / Finish, link to B's diary | 12–18 | No hours shown. Invitation card appears only after the coordinator sends it |
| `/profile` | Name, conduct rules, switch user, log out | 3 | Switch user returns to `/login` |
| `/coordinator` | Pending visits with Yes/No, week grid per commitment, "Send invitation" box, link to B's Post a Need, **demo time-travel** control | 8, 10, 16, 19, 20 | Grid shows served / covered / gap / upcoming per week |

Put B's `<WhyLink rule="no-hours" />` on My Seva, `rule="listen-first"` on Need detail and
`rule="no-photos"` on the guest briefing.

---

## 7. What you give B and need from B

| You give B | When |
|---|---|
| Service template (`app.js`, `server.js`) | Hour 1 |
| Gateway URL + routing live | Hour 2 |
| `api.js`, `useAuth`, `Card`, `Button`, Tailwind theme | Hour 4.5 |
| Routes added for B's pages | When B asks |

| You need from B | When |
|---|---|
| `seed-core.js` run on Atlas | Hour 4 |
| `<WisdomCard />`, `<WhyLink />` | Hour 6 |
| Diary route name for the My Seva link | Hour 6 |

---

## 8. Testing — how to say "100% working"

A feature is **done** only when its checks pass **on the deployed URL**, in a **fresh incognito window**,
**two times in a row**. Passing on localhost does not count.

Set these first:

```bash
GW=https://your-gateway.onrender.com
```

### 8.1 API tests (run in order)

| # | Test | Command | Pass if |
|---|---|---|---|
| T1 | Services alive | `curl $GW/health/all` | `core`, `reflect`, `bridge` are all `true` |
| T2 | User list is public | `curl $GW/api/auth/users` | 200, list of users, no token needed |
| T3 | Token is required | `curl -i $GW/api/needs` | **401** |
| T4 | Demo login | `curl -X POST $GW/api/auth/demo-login -H "Content-Type: application/json" -d '{"userId":"<volunteer id>"}'` | 200 with `token`. Save it as `TOKEN` |
| T5 | Me | `curl $GW/api/auth/me -H "Authorization: Bearer $TOKEN"` | Same user comes back |
| T6 | Filter | `curl "$GW/api/needs?day=Saturday&maxKm=5&interest=teaching" -H "Authorization: Bearer $TOKEN"` | 1 to 3 needs, each has `fitReason` |
| T7 | Max 3 | Same call with `maxKm=100` | **Never more than 3** |
| T8 | Need detail | `GET /api/needs/<id>` | All 4 card parts present, `verified: true` |
| T9 | Request visit | `POST /api/needs/<id>/visits` | 201, `status: requested` |
| T10 | No duplicate visit | Repeat T9 | **409** |
| T11 | Commit too early | `POST /api/commitments` with that `visitId` | **409** (both sides have not said yes) |
| T12 | Heard | `PATCH /api/visits/<id>/heard` `{ "text": "..." }` | `status: visited` |
| T13 | Volunteer yes | `PATCH /api/visits/<id>/decision` `{ "yes": true }` | `volunteerYes: true`, status still `visited` |
| T14 | Coordinator yes | Log in as coordinator, same call | `status: agreed` |
| T15 | Commit | As volunteer: `POST /api/commitments` `{ visitId, weeks: 4, sentence }` | 201, 4 sessions `upcoming`, `currentWeek: 1` |
| T16 | Need is filled | `GET /api/needs/<id>` | `status: filled`, and it no longer appears in T6 |
| T17 | Absence | `POST /api/commitments/<id>/absence` `{ "week": 2 }` | Week 2 is `gap` |
| T18 | Cover | Log in as a circle member, `POST .../cover` `{ "week": 2 }` | Week 2 is `covered`, `coveredBy` set |
| T19 | Cover by outsider | Same call as a non-member | **403** |
| T20 | Time travel | `POST /api/demo/advance` `{ commitmentId, toWeek: 4 }` | `currentWeek: 4`, weeks 1 and 3 are `served`, week 2 stays `covered` |
| T21 | Continue too early | `PATCH .../continue` before any invitation | **409** |
| T22 | Invitation | As coordinator: `POST .../invitation` `{ "text": "The children asked if you are coming next month." }` | Saved with `sentAt` |
| T23 | Invitation by volunteer | Same call as volunteer | **403** |
| T24 | Continue | As volunteer: `PATCH .../continue` `{ "choice": "continue" }` | `weeks: 8`, 4 new `upcoming` sessions |
| T25 | Post need needs consent | As coordinator: `POST /api/needs` with `consent.readBack: false` | **400** |
| T26 | Post need by volunteer | Same call as volunteer, with consent | **403** |
| T27 | Routing to B | `GET /api/wisdom/today` and `POST /api/bridge/draft-need` with token | Both answer (not 404, not 502) |
| T28 | Headers cannot be faked | Call T5 with a volunteer token plus header `x-user-role: coordinator`, then try T22 | Still **403** |

All 28 must pass. T3, T10, T11, T19, T21, T23, T25, T26, T28 are the "rule" tests: they prove the
product's rules are enforced by code, not only by the UI.

### 8.2 Screen tests (on a phone-size window, 390 px wide)

| # | Do this | Pass if |
|---|---|---|
| S1 | Open the site in incognito | Goes to `/login`, shows demo users |
| S2 | Pick the new volunteer | Home loads within 3 seconds, name shown, bottom nav works on all 5 tabs |
| S3 | Refresh the page on `/my-seva` | Page reloads correctly (no 404 from Vercel), still logged in |
| S4 | Needs tab → answer 3 questions | 1–3 cards, each with a "why this fits" line |
| S5 | Open a card | 4 parts visible, "Verified" mark, only one button: "Visit and listen" |
| S6 | Tap "Why?" on the card | B's popup opens with the teaching and closes cleanly |
| S7 | Listen flow: briefing → request → write what you heard → say yes | Screen shows "Waiting for the community's answer" |
| S8 | Second browser: log in as coordinator → say yes | Volunteer's screen (after refresh) shows the Commit button |
| S9 | Write the sentence → commit | Lands on My Seva with "Week 1 of 4" |
| S10 | My Seva | No hours, no points, no rank anywhere on the page |
| S11 | Tap "I cannot come this week" | Week shows as gap; circle member can cover it from their login |
| S12 | Coordinator → time travel to week 4 → send invitation | Volunteer sees the invitation card with 3 choices |
| S13 | Choose Continue | Shows "Week 4 of 8" |
| S14 | Home | "Continue Your Seva" card shows real week numbers and **no photo of people** |
| S15 | Log out, log in as a different volunteer | You do not see the first volunteer's commitment |

### 8.3 Deployment tests

| # | Check | Pass if |
|---|---|---|
| D1 | Leave the site idle 20 minutes, then open `/health/all` | All `true` within about 90 seconds |
| D2 | Browser console on every screen | No red errors, no CORS errors |
| D3 | Network tab | Every request goes to the gateway URL only |
| D4 | `.env` files | Not in the GitHub repo. `.env.example` is |
| D5 | `node mono.js` locally | All 29 endpoints still answer from one process (fallback ready) |
| D6 | Open the site on a real phone | Layout is not broken |

### 8.4 Final sign-off

Tick every line. If one is unticked, the feature is not done.

- [ ] T1–T28 pass on the deployed gateway
- [ ] S1–S15 pass in incognito, two times in a row
- [ ] D1–D6 pass
- [ ] The joint demo run (section 9) passes two times in a row
- [ ] `main` is the deployed version, and nothing new was merged after hour 10 except bug fixes

One honest note: this checklist proves the demo path and the rules work. It does not prove there are
zero bugs anywhere. For a 12-hour build, "every check passes twice on the live site" is the right
meaning of 100%.

---

## 9. Joint demo run (do this with Person B, twice)

1. Open `/health/all`. All true.
2. Coordinator logs in → Post a Need → types the Tamil sentence → draft appears → ticks read-back → publishes. *(B)*
3. New volunteer logs in → Needs → 3 questions → sees the new need.
4. Opens the card → taps "Why?" → closes. *(B's popup)*
5. Visit and listen → writes what she heard → says yes.
6. Coordinator says yes.
7. Volunteer commits for 4 weeks.
8. Switch to the seeded volunteer (week 2 of 4) → opens diary → answers the question. *(B)*
9. Coordinator → time travel to week 4 → sends the invitation.
10. Volunteer → Then and Now shows first and latest entry. *(B)*
11. Volunteer sees the invitation → Continue → "Week 4 of 8".
12. Coordinator dashboard shows the week grid with no gap.

If all 12 steps work twice without touching the code, you are ready.
