# SevaSetu — the contract between Person A and Person B

These are the only things the two halves must agree on. If both sides keep to this page, the two
folders can be built at different times and still fit together. Change something here only after
telling the other person.

## Services

| Service | Owner | Port | Database | Paths it answers |
|---|---|---|---|---|
| gateway | A | 8080 | none | `/health`, `/health/all`, forwards everything else |
| core | A | 4001 | `seva_core` | `/api/auth`, `/api/needs`, `/api/visits`, `/api/commitments`, `/api/circles`, `/api/coordinator`, `/api/demo` |
| reflect | B | 4002 | `seva_reflect` | `/api/reflect`, `/api/wisdom` |
| bridge | B | 4003 | none | `/api/bridge` |
| web | A (shell) + B (4 pages) | 5173 | none | talks to the gateway only |

Endpoints 1–20 are A's. Endpoints 21–29 are B's. The numbers are the ones in the two plan files.
Endpoint 29 (`POST /api/bridge/transcribe`) was added when Bhashini was chosen. The gateway already
routes it, because everything under `/api/bridge` goes to bridge.

## Outside providers (bridge only)

| Provider | What for | Model / pipeline |
|---|---|---|
| Groq | Coordinator's words → draft need card (endpoint 28) | `openai/gpt-oss-20b`, strict JSON schema |
| Bhashini | Tamil/Hindi speech → text (endpoint 29), Tamil/Hindi → English before drafting (inside 28) | MeitY pipeline `64392f96daac500b55c543cd` |

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
| reflect | `PORT`, `MONGO_URI` (ends in `/seva_reflect`) |
| bridge | `PORT`, `GROQ_API_KEY`, `GROQ_MODEL`, `BHASHINI_USER_ID`, `BHASHINI_ULCA_API_KEY`, `BHASHINI_PIPELINE_ID` |
| web | `VITE_API_URL` (the gateway URL) |

## Where A's code and B's code touch

| Touch point | A's side | B's side |
|---|---|---|
| Need card shape | Endpoint 6 body and the `needs` model | Endpoint 28 `draft` has exactly these keys: `title, want, serveUsWell, youWillLearn, groupSize, interestTags, rhythm { day, start, end }, weeks, place`. B's screen adds `consent: { readBack, agreedOn }` |
| Current week | Endpoint 13 returns `currentWeek` and `weeks` | Diary reads the week from endpoint 13 |
| Seeded ids | `seed-core.js` uses `shared/ids.js` | `seed-reflect.js` uses the same file |
| Shared UI | `lib/api.js` (already unwraps `{ data }`), `lib/auth.js` (`useAuth`), `components/ui/Card`, `components/ui/Button`, Tailwind theme | B imports these, never copies them |
| B's components | A places them on Home, Need detail, My Seva, guest briefing | `WisdomCard` (no props), `WhyLink` (`rule`) |
| B's pages | A's `routes.jsx` mounts them | `/wisdom`, `/reflect/:commitmentId`, `/reflect/:commitmentId/then-and-now`, `/coordinator/post-need` |
| `WhyLink` rule keys | A passes `no-hours`, `listen-first`, `no-photos` | B seeds `no-ranks`, `no-photos`, `no-hours`, `listen-first` |
