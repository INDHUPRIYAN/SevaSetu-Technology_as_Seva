# Person A — Lead

Everything Person A owns lives in this folder: the gateway, core service (endpoints 1–20), app
shell and 9 screens, seed data, the one-process fallback and the tests. The full plan is
[PERSON_A_LEAD.md](PERSON_A_LEAD.md). The rules shared with Person B are in
[../shared/CONTRACT.md](../shared/CONTRACT.md). The UI follows [../docs/Reference-ui-page.png](../docs/Reference-ui-page.png).

## Run it locally

Needs Node 20+, MongoDB (local `mongod` or Atlas) and, for the screen tests, Google Chrome.

```bash
cd person-a
npm install
cp services/core/.env.example services/core/.env          # set MONGO_URI and JWT_SECRET
cp services/gateway/.env.example services/gateway/.env    # same JWT_SECRET
cp apps/web/.env.example apps/web/.env
npm run seed         # clears and fills seva_core; safe to repeat
npm run dev          # gateway :8080, core :4001, web http://localhost:5174
```

The web app uses port **5174**, because another local project already holds Vite's default 5173.

The layout adapts to the screen:

| Width | Layout |
|---|---|
| Under 1024 px (phones, tablets) | One 430 px column with a bottom nav, as in the mockup |
| 1024 px and up | A sidebar on the left replaces the bottom nav. Pages use the full width, and Login is split-screen |
| 1280 px and up | Opportunities, Need detail, My Seva and the dashboard get a second column beside the main one |

| Command | What it does |
|---|---|
| `npm run dev` | Gateway, core and web, each in its own process |
| `npm run mono` | Gateway and core in **one** process on :8080 (the `mono.js` fallback). Use instead of the two services |
| `npm run seed` | Reseed `seva_core` |
| `npm run test:api` | Reseed, then run API tests T1–T28 against `GW` (default `http://localhost:8080`) |
| `npm run test:ui` | Reseed, then click through screen tests S1–S15 in Chrome at 390 px against `WEB` (default `http://localhost:5174`) |
| `npm run test:ui:desktop` | The same screen tests at 1440 px, in the desktop sidebar layout |
| `npm run build` | Production build of the web app |

Both test scripts need the backend running. `test:ui` also needs the web app running. To test the
deployed site, seed Atlas, then run `GW=https://… node scripts/api-test.js` or
`WEB=https://… node scripts/ui-test.js`.

## Demo people (from the seed)

| Name | Who | Use for |
|---|---|---|
| Meera Krishnan | New volunteer, no seva yet | The live demo: find, listen, commit |
| Arjun Raman | Volunteer at week 2 of 4, English Reading Support | Home's "Continue Your Seva", diary later |
| Kavya Suresh | Volunteer in the same circle | Covering a week someone cannot come |
| Rahul Menon | Volunteer outside the circle | Shows that outsiders cannot cover |
| Lakshmi Narayanan | Coordinator, Government School Kanchipuram | Saying yes, invitation, time travel |

## Where things are

| Path | What |
|---|---|
| `services/gateway/src/app.js` | Token check, user headers, forwarding. `createApp({ local })` runs services in-process (used by `mono.js`) |
| `services/core/src/models/index.js` | users, orgs, needs, visits, commitments, circles. No fields for hours or personal details of people served |
| `services/core/src/routes/` | `auth` (1–3), `needs` (4–7), `visits` (8–10), `commitments` (11–17), `other` (18–20) |
| `apps/web/src/lib/` | `api.js` (one axios client, unwraps `{ data }`), `auth.js` (`useAuth`), `useLoad.js`, `format.js` |
| `apps/web/src/components/ui/` | `AppShell`, `Button`, `Card`, `Brand`, `Bits` (small parts), `Art` (SVG illustrations, never people) |
| `apps/web/src/pages/` | Login, Home, Opportunities, NeedDetail, ListenFirst, Commit, MySeva, Profile, Coordinator |
| `apps/web/src/integration/personB.jsx` | Stand-ins for B's `WisdomCard`, `WhyLink` and 4 pages. The only file that names B's work |
| `seed/seed-core.js` | Seed data, using the fixed ids in `../shared/ids.js` |
| `scripts/` | `api-test.js` (T1–T28), `ui-test.js` (S1–S15) |

## Changes from the plan

- **Endpoint 18** also returns `openGaps`: weeks other circle members cannot come. My Seva needs this
  to show "I will cover" (test S11).
- **Endpoint 10** answers 409 until the volunteer has visited and written what they heard. Nobody
  decides before listening.
- **Endpoint 20** (time travel) is limited to the coordinator of that need.
- **Home's "Continue Your Seva" card** shows a drawn schoolhouse instead of the mockup's photo of
  children, because the plan forbids photos of the people served (S14).
- **The hero** quotes only "They alone live who live for others." The other slides are SevaSetu's
  own words, so no quote is attributed without being checked.

## Waiting for Person B

These checks report `WAIT` rather than `FAIL`, and pass after integration
([../docs/INTEGRATION.md](../docs/INTEGRATION.md)): T1 and T27 (B's services), S6 (the "Why?" popup).
The Wisdom tab, Seva Diary, Then and Now and Post a Need show "Coming soon".

## Deploy

1. **Atlas:** create a free cluster, then seed it from your laptop: `MONGO_URI="…/seva_core" npm run seed`.
2. **Render:** New → Blueprint → this repo. [../render.yaml](../render.yaml) creates `sevasetu-core`
   and `sevasetu-gateway`. Fill in the secrets it asks for (core's URL goes into the gateway's `CORE_URL`).
   To run one service instead of two, create one web service with start command `node mono.js`
   and `MONGO_URI` and `JWT_SECRET` set.
3. **Vercel:** import the repo, root directory `person-a/apps/web`, env `VITE_API_URL` = the gateway
   URL. `vercel.json` already sends every path to the app, so a refresh on `/my-seva` works.
4. Set the gateway's `WEB_ORIGIN` to the Vercel URL, then run both test scripts against the live URLs.
