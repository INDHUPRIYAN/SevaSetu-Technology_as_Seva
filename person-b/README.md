# Person B — Support (parked)

Nothing is built here yet. The folders are laid out so that whoever picks this up can work in this
folder alone. The full plan is [PERSON_B_SUPPORT.md](PERSON_B_SUPPORT.md). The rules shared with
Person A are in [../shared/CONTRACT.md](../shared/CONTRACT.md).

## What goes where

| Folder | What you build there | Plan section |
|---|---|---|
| `services/reflect/src/models/` | questions, entries, wisdom, whys | 4 |
| `services/reflect/src/routes/` | Endpoints 21–27: `reflect`, `wisdom` | 4 |
| `services/bridge/src/routes/` | Endpoints 28–29: `bridge`, plus `fallbackDraft.json` one level up. `llm.js` (Groq) and `bhashini.js` are already written; check them with `npm run check` | 5 |
| `apps/web/src/components/seva/` | `WisdomCard`, `WhyLink`, `WhyModal`, `VoiceInput` | 6 |
| `apps/web/src/pages/` | Diary, ThenAndNow, Wisdom, PostNeed | 6 |
| `seed/` | `seed-reflect.js`, using the ids in `../shared/ids.js` | 7 |
| `docs/` | `api.http` with all 29 requests | 8 |

## Starting

1. Copy `package.json`, `src/app.js` and `src/server.js` from `../person-a/services/core` into
   `services/reflect` and `services/bridge`. Change the service name and the port (4002, 4003).
   Bridge already has a `package.json` with the `check` script; add the `dev`/`start` scripts to it
   rather than overwriting it.
   Bridge has no database, so its `server.js` only listens, like the gateway's.
2. Run each service on its own and test it with `x-user-id` and `x-user-role` headers set by hand.
   That is what the gateway will send.
3. For the frontend pieces, import `api`, `useAuth`, `Card` and `Button` from A's paths
   (`../../lib/api` and so on). They resolve once the folders are merged.

## What changed from the plan

`seed-core.js` and the Atlas setup moved to Person A, because A could not start without them.
`seed/ids.js` now lives in `../shared/ids.js` until the folders are merged.

Do not edit anything under `../person-a`. The merge steps are in
[../docs/INTEGRATION.md](../docs/INTEGRATION.md).
