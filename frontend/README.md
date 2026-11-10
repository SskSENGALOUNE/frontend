# Money Manager — frontend

Next.js 16 (App Router) + Tailwind v4 + lucide-react. Mobile-first, Lao UI (Noto Sans Lao).
All pages are client-rendered and talk to the Go API.

```bash
cp .env.example .env.local   # BACKEND_URL=http://localhost:8080
npm install
npm run dev                  # http://localhost:3000
```

`/api/v1/*` is proxied to `BACKEND_URL` by the rewrite in `next.config.ts`, so the browser never calls the
Go server directly and no CORS setup is needed. **The target is fixed when `next build` runs (or when
`next dev` starts)**, so set `BACKEND_URL` before building. The JWT is kept in `localStorage`; a 401 sends
the user to `/login`, while a network or server error keeps the session and shows a retry button.

## Pages

| Route | Page |
|---|---|
| `/login` | login / register |
| `/` | month overview: balance, income/expense vs last month, daily expense chart, top categories, budgets, recent |
| `/entry` | quick entry: amount → category icon → save; expenses can be queued and saved in one `POST /expenses` |
| `/transactions` | grouped by day, debounced search, filter sheet, edit/delete sheet, load more |
| `/budgets` | monthly budget per expense category, copy missing budgets from last month |
| `/more` | links to recurring, categories, profile; logout |
| `/recurring` | recurring income/expense: create, edit, pause/resume, delete |
| `/categories` | add, rename, pick icon and color, delete |
| `/profile` | name, currency, password |

Phones get a bottom tab bar with a raised + button; screens ≥1024px get a sidebar.

## Code

- `src/lib/api.ts` types, fetch helpers, Lao error messages
- `src/lib/auth.tsx` session; `src/lib/use-data.ts` fetch hook (+ `useDebounced`)
- `src/lib/format.ts` money/date helpers and amount-input parsing
- `src/lib/basket.ts` multi-expense logic; `src/lib/category-icons.ts` icon and color keys
- `src/components/` app shell, sheet, toast, category grid/icon, amount input, chart, shared UI
- `src/app/(app)/` pages that require login

## Tests

```bash
npm test                 # unit (vitest)
./scripts/e2e.sh         # e2e (Playwright, local Chrome) on a throwaway Postgres in Docker
SCREENSHOTS=1 ./scripts/e2e.sh screenshots --project=mobile   # docs/screenshots
E2E_CMD="node scripts/lighthouse.mjs" ./scripts/e2e.sh          # docs/lighthouse.json
```

`scripts/e2e.sh` starts Postgres in Docker and a fresh backend on :18081, builds the app into `.next-e2e`
pointed at that backend, and refuses to run if the build points anywhere else. It never touches the real
database. Results and the bug list are in `../docs/qa-report.md`.
