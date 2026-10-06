# SevaSetu — Technology as Seva

Dignity-first technology for meaningful and sustained seva, inspired by Swami Vivekananda.

SevaSetu helps a volunteer find **one** right community need, **listen before committing**, serve the
same people week after week with a circle beside them, and reflect privately on what they learn. A
coordinator can speak a need in Tamil, Hindi or English and get a draft need card, which they read
back to the community before publishing. The full picture is in [PROJECT_PLAN.md](PROJECT_PLAN.md).

## What is in the app

| For | Screens |
|---|---|
| Volunteers | Home, Find a Need (3 questions → at most 3 needs), Need card with "Why?", Listen First (briefing → visit → what I heard → yes/no), Commit, My Seva (Week X of N, "I cannot come" with a note, circle cover, invitation → continue / pause with a return date / finish with a handover), private Seva Diary, Then and Now, Wisdom, Profile |
| Coordinators | Dashboard (visits to answer, open gaps, week grid, "would the community like them to continue?", invitation, demo time travel), Post a Need (voice or text → AI draft → privacy warnings → read back → community confirms + coordinator consents → publish), Resource Connect (offer or ask for things → suggested match → connect → hand over) |

**Wisdom, never invented.** Every quotation is copied verbatim from *The Complete Works of Swami
Vivekananda*, matched against two online copies, and stored with its volume and piece
([seed/wisdom-quotes.js](seed/wisdom-quotes.js)). Each "Why?" shows *Verified teaching →
Interpretation → What SevaSetu does*, and teachings appear in context (before a listening visit,
before committing, after a hard diary day, on an invitation to continue) as *Verified teaching →
Interpretation → Practice*. Our own words are always labelled as ours: "Feel first, organize
afterwards", for example, is our paraphrase, because it is not in the Complete Works. A person still
needs to tick each quote off against a printed volume (`checked: true`); the seed warns until then.

Phones get a 430 px layout with a bottom nav. Screens 1024 px and wider get a sidebar, and from
1280 px the busy pages use two columns.

## How it is built

```text
apps/web            React + Vite + Tailwind web app (talks only to the gateway)
services/gateway    :8080  checks the login token, sets x-user-id / x-user-role, forwards
services/core       :4001  users, needs, visits, commitments, circles, resources → MongoDB seva_core
services/reflect    :4002  diary, Then and Now, wisdom, "Why?", moments  → MongoDB seva_reflect
services/bridge     :4003  Post a Need drafting (Groq) and speech (Bhashini); no database
seed/               seed-core.js, seed-reflect.js, fixed shared ids
scripts/            api-test.js (T1–T28), ui-test.js (screen checks in Chrome)
mono.js             the whole backend in one process (fallback / single-service deploy)
docs/               CONTRACT.md (service rules), api.http, BHASHINI.md, plans/ (original build plans)
```

Every endpoint answers `{ data }` or `{ error: { message } }`. The user comes only from the headers
the gateway sets, never from the request body. Every endpoint is listed, runnable, in [docs/api.http](docs/api.http).

## Run it locally

Needs Node 20+, MongoDB (a local `mongod` or Atlas) and, for the screen tests, Google Chrome.

```bash
npm install
cp services/core/.env.example     services/core/.env       # MONGO_URI (…/seva_core), JWT_SECRET
cp services/gateway/.env.example  services/gateway/.env    # the same JWT_SECRET
cp services/reflect/.env.example  services/reflect/.env    # MONGO_URI (…/seva_reflect)
cp services/bridge/.env.example   services/bridge/.env     # optional: Groq and Bhashini keys
cp apps/web/.env.example          apps/web/.env
npm run seed        # fills both databases; safe to repeat
npm run dev         # all five parts; open http://localhost:5174
```

The web app runs on **5174** (another local project uses Vite's default 5173).

**AI and voice keys are optional.** Without `GROQ_API_KEY`, Post a Need gives a sample draft card
to edit. Without the Bhashini keys, a recording adds no words (type instead) and Tamil or Hindi
words go to Groq untranslated. To check real keys: `npm run check` (add a 16 kHz Tamil `.wav` path after
`--` to test speech too). Keys live only in `services/bridge/.env`, which git ignores;
`npm run scan-keys` confirms they appear nowhere else in the repo.

| Command | What it does |
|---|---|
| `npm run dev` | Gateway, core, reflect, bridge and web, each in its own process |
| `npm run mono` | The whole backend in one process on :8080 (seed reflect into the same database: `MONGO_URI=…/seva_core node seed/seed-reflect.js`) |
| `npm run seed` | Reseed both databases |
| `npm test` | Unit and component tests: reflect, bridge, web |
| `npm run test:api` | Reseed, then API checks T1–T28 and product-rule checks X1–X7 against `GW` (default `http://localhost:8080`) |
| `npm run test:ui` / `test:ui:desktop` | Reseed, then click through every screen in Chrome at 390 px / 1440 px against `WEB` (default `http://localhost:5174`) |
| `npm run build` | Production build of the web app |

The reflect tests start an in-memory MongoDB. To use your installed `mongod` instead of a download,
set `MONGOMS_SYSTEM_BINARY` to its path first.

## Demo people (from the seed)

| Name | Who | Use for |
|---|---|---|
| Meera Krishnan | New volunteer | The live demo: find, listen, commit |
| Arjun Raman | Volunteer at week 2 of 4 | Diary, Then and Now, "Continue Your Seva" |
| Kavya Suresh | Volunteer in the same circle | Covering a week someone cannot come |
| Rahul Menon | Volunteer outside the circle | Shows that outsiders cannot cover |
| Lakshmi Narayanan | Coordinator, Government School Kanchipuram | Post a Need, saying yes, invitation, time travel |

The 12-step demo script is in [PROJECT_PLAN.md](PROJECT_PLAN.md#12-the-demo-12-steps).

## Deploy

1. **Atlas:** create a free cluster, then seed it from your laptop:
   `MONGO_URI="…/seva_core" node seed/seed-core.js` and `MONGO_URI="…/seva_reflect" node seed/seed-reflect.js`.
2. **Render:** New → Blueprint → this repo. [render.yaml](render.yaml) creates core, reflect, bridge
   and gateway. Fill in the secrets it asks for; the gateway needs the other three URLs.
3. **Vercel:** import the repo with root directory `apps/web` and env `VITE_API_URL` = the gateway URL.
4. Set the gateway's `WEB_ORIGIN` to the Vercel URL, then run `test:api` and `test:ui` against the live URLs.

## Rules the code enforces

Listen first (no commitment without both sides saying yes, 409 otherwise) · no hours, points, ranks or streaks ·
no names, ages, income, caste, religion, health details or photos of the people served · the diary
is private to its writer, with no AI or scoring on it · AI only drafts; nothing is published until
the community confirms the read-back and the coordinator consents · identity never comes from the
browser · AI keys stay in the bridge service.
