# Person A — Lead (active)

Everything Person A builds lives in this folder. The full plan is [PERSON_A_LEAD.md](PERSON_A_LEAD.md).
The rules shared with Person B are in [../shared/CONTRACT.md](../shared/CONTRACT.md).

## Run it

```bash
cd person-a
npm install
cp services/core/.env.example services/core/.env          # set MONGO_URI
cp services/gateway/.env.example services/gateway/.env
cp apps/web/.env.example apps/web/.env
npm run dev          # gateway :8080, core :4001, web :5173
```

Core needs a MongoDB to start: a local `mongod` or an Atlas cluster.

## What goes where

| Folder | What you build there | Plan section |
|---|---|---|
| `services/gateway/src/` | Token check, user headers, forwarding. Already written | 4 |
| `services/core/src/models/` | users, orgs, needs, visits, commitments, circles | 5 |
| `services/core/src/routes/` | Endpoints 1–20: `auth`, `needs`, `visits`, `commitments`, `circles`, `coordinator`, `demo` | 5 |
| `apps/web/src/lib/` | `api.js`, `auth.js` | 6 |
| `apps/web/src/components/ui/` | `Card`, `Button`, `AppShell` | 6 |
| `apps/web/src/pages/` | Login, Home, Opportunities, NeedDetail, ListenFirst, Commit, MySeva, Profile, CoordinatorDashboard | 6 |
| `apps/web/src/routes.jsx` | All routes, including `personBRoutes` from the file below | 6 |
| `apps/web/src/integration/personB.jsx` | Stand-ins for B's components and pages. The only place B's work is named | — |
| `seed/` | `seed-core.js` (see below) | B's plan, 7 |
| `mono.js` | One-process fallback | 8.3 |

## Because Person B is parked

Three things in the plan were B's job but A cannot work without them, so A does them now:

- **MongoDB.** B was to create the Atlas cluster. Create it yourself, or use a local `mongod`.
- **`seed/seed-core.js`.** Without it the login screen has no users and there are no needs. Write it
  here, using the ids in `../shared/ids.js`. The data to seed is listed in section 7 of B's plan.
- **Request file for testing.** B was to write `docs/api.http`. Use the curl commands in section 8.1.

Import B's components only from `integration/personB.jsx`. They show nothing for now, and the four
B pages show "coming soon". [../docs/INTEGRATION.md](../docs/INTEGRATION.md) lists the tests that
cannot pass until B's half is in.
