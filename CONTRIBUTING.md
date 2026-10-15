# Contributing to Leaseweb Dock

Thanks for helping. Bug reports, ideas and pull requests are all welcome.

## Report a bug or ask for a feature

Open an [issue](https://github.com/MahdiGraph/LWDock/issues/new/choose) and pick the matching form. For bugs, the version (shown in `docker image inspect ghcr.io/mahdigraph/lwdock`), how you installed it and the exact error text help most. Never paste API keys, passwords or real IP addresses.

Security problems go through [SECURITY.md](SECURITY.md), not public issues.

## Run it locally

You need Node.js 20.9 or newer.

```bash
git clone https://github.com/MahdiGraph/LWDock.git
cd LWDock
npm install
npm run dev
```

Open http://localhost:3000 (use `localhost`, not `127.0.0.1`: the dev server only serves its scripts to the host it started on). The first visit asks you to create the admin. The database goes to `./data`, which is ignored by git.

To try it without touching real servers, add a Leaseweb API key from a test account, or point *Settings → API address* at a mock server of your own.

## Where things live

| Path | What it holds |
| --- | --- |
| `src/lib/leaseweb.ts` | The only code that talks to the Leaseweb API, including the outbound proxy. |
| `src/lib/permissions.ts` | The allow-list of Leaseweb endpoints users can reach. A new feature usually starts here. |
| `src/lib/db.ts` | SQLite schema and numbered migrations. Never edit an old migration; add a new one. |
| `src/app/api/` | Route handlers. Every one goes through `route()` in `src/lib/http.ts`. |
| `src/components/server/` | The server page tabs. |
| `src/components/ui/` | shadcn/ui components. |

## Before you open a pull request

```bash
npm run lint
npm run typecheck
npm run build
```

All three must pass. Please also:

- keep the user interface in English,
- follow the existing look: flat surfaces, no gradients, no shadows on things at rest, square corners (see the house rules in `.claude/skills/design-taste-frontend/SKILL.md`),
- check both the light and the dark theme, and a phone-sized window,
- describe in the pull request what you changed and how you tested it.

Small, focused pull requests are reviewed fastest.
