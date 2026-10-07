# SevaSetu — Technology as Seva

Dignity-first technology for meaningful and sustained seva, inspired by Swami Vivekananda.

SevaSetu helps a volunteer find **one** right community need, visit **once, only to listen**, and, if the
community invites them back, serve the same people week after week with a circle beside them and reflect
privately on what they learn. The ramp is always One visit → Invitation → 4 weeks → Continue. A
coordinator can speak a need in Tamil, Hindi or English and get a draft need card, which they read
back to the community before publishing. The full picture is in [PROJECT_PLAN.md](PROJECT_PLAN.md).

## What is in the app

| For | Screens |
|---|---|
| Volunteers | Home, Find a Need (3 questions → at most 3 needs), Need card with "Why?", Listen First (briefing + Listening Guide → one visit → what I heard → *the next word is theirs*), the community's invitation → Commit (sentence, 4 weeks, Sankalpa: "what do you hope to learn here?"), My Seva (Week X of N, "I have arrived" → Silent Seva, "I cannot come" with a note, circle cover, invitation → continue / pause with a return date / finish: "What did they give you?" then the handover), the calm moments when the community says no or a need ends, private Seva Diary (five questions, one on pride), Then and Now (with the community's words), Wisdom with the Teaching Finder, Profile |
| Coordinators | Dashboard (visits waiting: invite them back in the group's words, or not now; "Updated after listening"; open gaps; week grid; check-in; invitation; "what the group wanted to say" through the Dignity Check; "this need has ended"; demo time travel), Post a Need (voice or text → AI draft → Dignity Check → read back → community confirms + coordinator consents → publish), Resource Connect (offer or ask for things → suggested match → connect → hand over) |

**Wisdom, never invented.** Every quotation is copied verbatim from *The Complete Works of Swami
Vivekananda*, matched against two online copies, and stored with its volume and piece
([seed/wisdom.json](seed/wisdom.json)). Each "Why?" shows *Verified teaching →
Interpretation → What SevaSetu does*, and teachings appear in context (before a listening visit,
before committing, after a hard diary day, on an invitation to continue) as *Verified teaching →
Interpretation → Practice*. Our own words are always labelled as ours: "Feel first, organize
afterwards", for example, is our paraphrase, because it is not in the Complete Works. The app shows a
quote only after a person has found it in a printed volume and set `verified: true` (and its `page`)
in that file. Until then the quote is hidden everywhere, and the "Why?" notes and moments show only
our own words.

The coordinator screens have an English / தமிழ் toggle ([apps/web/src/i18n/ta.js](apps/web/src/i18n/ta.js) still
needs a Tamil speaker's review). Teachings, quotations and anything a person wrote are never translated.

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
docs/               CONTRACT.md (service rules), BHASHINI.md, plans/ (original build plans)
```

Every endpoint answers `{ data }` or `{ error: { message } }`. The user comes only from the headers
the gateway sets, never from the request body. Every endpoint is listed, runnable, in [tests.http](tests.http).

## Run it locally

Needs Node 20+, MongoDB (a local `mongod` or Atlas) and, for the screen tests, Google Chrome.

```bash
npm install
cp .env.example .env   # ONE file for every setting and token: databases, JWT, ports, Groq, Bhashini, VITE_API_URL
npm run seed           # fills both databases; safe to repeat
npm run dev            # all five parts; open http://localhost:5174
```

Every service, the seeds, `mono.js` and the web app read the root `.env` (git ignores it; `.env.example` is the
tracked template). A `services/<name>/.env` or `apps/web/.env`, if you create one, overrides it for that part
only. Names that would clash carry a prefix: `CORE_MONGO_URI`, `REFLECT_MONGO_URI`, `CORE_PORT`, `REFLECT_PORT`,
`BRIDGE_PORT`, `GATEWAY_PORT`.

The web app runs on **5174** (another local project uses Vite's default 5173).

**AI and voice keys are optional; the app works with none.** The AI layer lives in `services/bridge`
behind two small modules, `providers/llm.js` (Groq) and `providers/language.js` (Bhashini), so providers
can be swapped. Every model answer is JSON checked against a schema on the server, retried once, and
dropped for the rule-based fallback if it still does not fit; every call times out at 8 s.

| Variable (in the root `.env`) | What it does | Without it |
|---|---|---|
| `LLM_PROVIDER` | `groq` (default) or `none` | — |
| `LLM_API_KEY` | Groq key (console.groq.com) | VoiceBridge, Dignity rewrite, Listening Guide, Teaching Finder answer with their rule-based fallbacks and are never labelled "Suggested" |
| `LLM_MODEL` | the model name, e.g. `openai/gpt-oss-120b`; never written in the code | same as no key |
| `LLM_RESPONSE_FORMAT` | `json_schema` (Groq constrained decoding, gpt-oss / qwen3 models) or `json_object` (any model) | `json_schema` |
| `LLM_BASE_URL` | another OpenAI-compatible chat endpoint | Groq's |
| `LANGUAGE_PROVIDER` | `bhashini` (default) or `none` | — |
| `BHASHINI_USER_ID`, `BHASHINI_ULCA_API_KEY` | speech to text, translation, text to speech (bhashini.gov.in → profile) | the browser's own Web Speech and speechSynthesis are used for the mic and Read It Aloud; Tamil/Hindi words go to the model untranslated |
| `BHASHINI_PIPELINE_ID`, `BHASHINI_TTS_GENDER` | public pipeline id (docs/BHASHINI.md); `female` or `male` voice | defaults |
| `DRAFT_TIMEOUT_MS`, `TRANSLATE_TIMEOUT_MS` | provider timeouts | 8000 / 4000 |

To check real keys: `npm run check` (add a 16 kHz Tamil `.wav` path after
`--` to test speech too). Keys live only in the root `.env`, which git ignores;
`npm run scan-keys` confirms they appear nowhere else in the repo.

| Command | What it does |
|---|---|
| `npm run dev` | Gateway, core, reflect, bridge and web, each in its own process |
| `npm run mono` | The whole backend in one process on :8080 (seed reflect into the same database: `MONGO_URI=…/seva_core node seed/seed-reflect.js`) |
| `npm run seed` | Reseed both databases |
| `npm test` | Unit and component tests: reflect, bridge, web |
| `npm run test:api` | Reseed, then API checks T1–T28 and product-rule checks X1–X21 against `GW` (default `http://localhost:8080`) |
| `npm run test:ui` / `test:ui:desktop` | Reseed, then click through every screen in Chrome at 390 px / 1440 px against `WEB` (default `http://localhost:5174`; set `GW` too for a deployed site), 33 checks |
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

One visit first, and the community speaks first (no commitment without a completed visit and the community's invitation, 409; a volunteer cannot invite, 403) · no hours, points, ranks or streaks ·
no names, ages, income, caste, religion, health details or photos of the people served · the diary
is private to its writer, with no AI or scoring on it · AI only drafts; nothing is published until
the community confirms the read-back and the coordinator consents · identity never comes from the
browser · AI keys stay in the bridge service.
