# SevaSetu — how the two folders become one app

`person-a/` and `person-b/` are two slices of the same final tree. Inside each folder the paths are
already the final ones (`services/...`, `apps/web/src/...`, `seed/...`), and no file exists in both.
So integration is laying one folder over the other, then changing a few lines.

## Final tree after integration

```text
package.json          from person-a
mono.js               from person-a
apps/web/             shell and 9 screens from person-a, components/seva and 4 pages from person-b
services/gateway/     from person-a
services/core/        from person-a
services/reflect/     from person-b
services/bridge/      from person-b
seed/                 seed-core.js from person-a, seed-reflect.js from person-b, ids.js from shared
docs/                 api.http from person-b, plus this folder
```

## Steps

1. **Check that nothing collides.** List the files of both folders with the folder name removed.
   Apart from `.gitkeep` and `README.md`, no path may appear twice.
2. **Move the files** with `git mv` so history is kept: `person-a/*` to the repo root, then
   `person-b/services/*`, `person-b/apps/web/src/*`, `person-b/seed/*` and `person-b/docs/*` into
   the matching folders. Move `shared/ids.js` to `seed/ids.js`.
3. **Fix the one moved import.** Both seed scripts change `require('../../shared/ids')` to
   `require('./ids')`.
4. **Add B's services to the root `package.json`** `dev` script (`npm:dev -w services/reflect`,
   `npm:dev -w services/bridge`), then run `npm install`.
5. **Fill the gateway's `REFLECT_URL` and `BRIDGE_URL`**, locally and on the host. Until they are
   set, the gateway answers 503 for `/api/reflect`, `/api/wisdom` and `/api/bridge`.
6. **Swap the stand-ins.** In `apps/web/src/integration/personB.jsx`, replace the stand-in
   `WisdomCard`, `WhyLink` and the four `ComingSoon` routes with imports of B's real files. No other
   file in A's app needs to change.
7. **Add reflect and bridge to `mono.js`.**
8. **Seed both databases**, then run the tests that could not pass before: A's T1 and T27, S6, D5,
   and all of B's section 9. Finish with the joint demo run (section 9 of A's plan), twice.

## What cannot pass until B's half is in

| Item in A's plan | Why |
|---|---|
| T1 `/health/all` | `reflect` and `bridge` report `false` |
| T27 routing to B | Gateway answers 503 |
| S6 "Why?" popup | `WhyLink` is a stand-in that shows nothing |
| D5 all 29 endpoints from `mono.js` | Only 1–20 exist |
| Joint demo steps 2, 4, 8, 10 | Post a Need, "Why?", Diary, Then and Now are B's |
