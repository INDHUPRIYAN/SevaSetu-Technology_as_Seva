# SevaSetu — service contract

The rules the four backend services and the web app keep to. Code that crosses a service boundary
relies on this page, so change it together with every side it touches.

## Services

| Service | Port | Database | Paths it answers | Endpoints |
|---|---|---|---|---|
| gateway | 8080 | none | `/health`, `/health/all`, forwards everything else | — |
| core | 4001 | `seva_core` | `/api/auth`, `/api/needs`, `/api/visits`, `/api/commitments`, `/api/circles`, `/api/coordinator`, `/api/demo`, `/api/resources` | 1–20, Resource Connect |
| reflect | 4002 | `seva_reflect` | `/api/reflect`, `/api/wisdom` | 21–27, 27b (moments) |
| bridge | 4003 | none | `/api/bridge` | 28–29 |
| web | 5174 | none | talks to the gateway only | — |

Endpoint numbers are the ones used in [api.http](api.http), the test scripts and the plans in
[plans/](plans/). In `mono.js` all four services run in one process and share one database.

## Outside providers (bridge only)

| Provider | What for | Model / pipeline |
|---|---|---|
| Groq | Coordinator's words → draft need card (endpoint 28) | `openai/gpt-oss-20b`, strict JSON schema |
| Bhashini | Tamil/Hindi speech → text (endpoint 29), Tamil/Hindi → English before drafting (inside 28) | MeitY pipeline `64392f96daac500b55c543cd` (see [BHASHINI.md](BHASHINI.md)) |

No other service and no frontend code calls these providers or holds their keys.

## Rules every service follows

- Every service has `GET /health` returning `{ ok: true, service: '<name>' }`.
- Routes are mounted at the full path (`/api/reflect/...`), because the gateway forwards paths unchanged.
- Success is `{ data: ... }`. Failure is `{ error: { message } }` with the right status code.
- The user comes only from the headers the gateway sets: `x-user-id` and `x-user-role`
  (`volunteer` or `coordinator`). Never from the request body.
- Services never call each other. `commitmentId` in reflect is a plain string.
- JWT payload is `{ sub: <user _id>, role }`, signed by core, verified by the gateway, same `JWT_SECRET`.

## Environment variables

| Where | Variables |
|---|---|
| gateway | `PORT`, `JWT_SECRET`, `CORE_URL`, `REFLECT_URL`, `BRIDGE_URL`, `WEB_ORIGIN` |
| core | `PORT`, `MONGO_URI` (ends in `/seva_core`), `JWT_SECRET` |
| reflect | `PORT`, `MONGO_URI` (ends in `/seva_reflect`), `WISDOM_TIME_ZONE` |
| bridge | `PORT`, `GROQ_API_KEY`, `GROQ_MODEL`, `BHASHINI_USER_ID`, `BHASHINI_ULCA_API_KEY`, `BHASHINI_PIPELINE_ID`, `DRAFT_TIMEOUT_MS`, `TRANSLATE_TIMEOUT_MS` |
| web | `VITE_API_URL` (the gateway URL) |

## Where the services meet

| Touch point | Rule |
|---|---|
| Need card shape | Endpoint 28's `draft` has exactly the keys endpoint 6 accepts: `title, want, serveUsWell, youWillLearn, groupSize, interestTags, rhythm { day, start, end }, weeks, place`. Post a Need adds `consent: { readBack, coordinatorConsent, agreedOn }`, both `true` |
| Current week | The diary reads `currentWeek` from endpoint 13 (core); reflect never looks it up itself |
| Seeded ids | `seed-core.js` and `seed-reflect.js` both use [seed/ids.js](../seed/ids.js), so the seeded commitment and diary entry line up |
| Web building blocks | `lib/api.js` (unwraps `{ data }`), `lib/auth.js` (`useAuth`), `components/ui/*`, the Tailwind theme in `index.css` |
| `WhyLink` rule keys | `listen-first`, `no-hours`, `no-ranks`, `no-photos`, `private-diary`, `community-confirmation`, all seeded by reflect |
| Quotes | Every quote in wisdom, whys and moments is verbatim from the Complete Works and listed once in [seed/wisdom-quotes.js](../seed/wisdom-quotes.js); our own words (interpretation, decision, practice) are always separate fields |
