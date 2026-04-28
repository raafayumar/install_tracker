@AGENTS.md

# Install Tracker -- Next.js Frontend

## Quick Start

```bash
cd install-tracker-ui
npm install
npm run dev          # Dev server on http://localhost:3000
npm run build        # Production build (uses --webpack flag to avoid Turbopack panics)
```

Docker:
```bash
cd docker
docker compose up --build
# Next.js on port 3001, Streamlit on 8503, PostgreSQL on 5433
```

## Architecture

- **Next.js 16** App Router + **React 19** + **TypeScript**
- **Prisma v6** ORM connecting to PostgreSQL 15 (DB created by Streamlit/SQLAlchemy)
- **React Query** (`@tanstack/react-query`) for data fetching, `staleTime: 0`
- **Recharts** for analytics charts
- **Tailwind CSS v4** with CSS custom properties (theme in `globals.css`, NOT `tailwind.config`)
- **Lucide React** for icons

## Key Conventions

- All API routes: `src/app/api/` -- every route exports `export const dynamic = "force-dynamic"`
- Build: `next build --webpack` (Turbopack has known Rust panics in Docker)
- Prisma singleton: `src/lib/prisma.ts` -- prevents multiple clients in dev hot-reload
- Enums are UPPERCASE in PostgreSQL (`STAGE_UPDATE`, `COMMENT`, `OB`, `PPE`) -- Prisma schema must match exactly

## Database Schema (5 tables)

- **`installs`** -- Master record per customer site
- **`site_stage_history`** -- Single source of truth for pipeline state (per-site, per-partner, per-stage, per-batch)
- **`stage_snapshots`** -- Pre-aggregated analytics data (partner-level totals)
- **`install_activity`** -- Audit log (comments, parser updates, status changes)
- **`users`** -- Simple user list

The `pipelines` and `pipeline_stages` tables have been dropped. Pipeline state is now derived from the latest batch in `site_stage_history`.

## Data Model

- **`Install`** has `pipeline_state?: PipelineState` (not `pipelines: Pipeline[]`)
- **`PipelineState`** = `{ OB: PipelineTypeState | null, PPE: PipelineTypeState | null }`
- **`PipelineTypeState`** = `{ partners: string[], stages: StageEntry[], no_data: boolean }`
- **`StageEntry`** = `{ partner, stage_name, frames }`
- Multiple partners per site per pipeline type are handled natively

## Data Flow

1. User pastes Slack message -> `/api/parser/apply` -> `processParserResults()` in `src/lib/services.ts`
2. Parser writes to `stage_snapshots` (aggregate) + `site_stage_history` (per-site) + upserts installs (2 main steps)
3. Dashboard reads from `/api/installs` which derives `pipeline_state` from `site_stage_history` latest batch
4. Analytics reads from `/api/analytics/snapshots` and `/api/analytics/site-history`

## Important Business Rules

- **Per-site counts**: Dashboard shows per-site frame counts from `site_stage_history.frames`. If no per-site data, frames = `null` (shows "---")
- **No Data**: When `pipeline_state.OB.no_data === true` (or PPE), UI shows ONLY a "No Data" badge and hides stages entirely. This is computed at query time -- no stored flag.
- **Multiple partners**: A site can have data from multiple annotation partners simultaneously. All partners appear in `pipeline_state.{type}.partners` and `stages`.
- **Model type display**: "General"/"Site-Specific" label only shows when `status === "Complete"` or `general_*_model` is explicitly true. Otherwise shows "---"
- **Partner Workload chart**: Excludes "Protex Review" stage -- only considers Annotate and Review
- **Pipeline types**: `-ppe` suffix in partner name -> PPE pipeline, otherwise OB
- **KPI noDataCount**: Counts installs with no data in latest batch (not pipelines)

## Directory Structure

```
src/
+-- app/                    # Pages + API routes
|   +-- api/installs/       # CRUD + comments + activity + pipelines + stage-history
|   +-- api/analytics/      # kpis, snapshots, site-history
|   +-- api/parser/         # preview + apply
|   +-- api/users/          # user list + create
|   +-- api/health/         # DB diagnostic endpoint
+-- components/
|   +-- layout/             # PageShell, Sidebar, TopBar
|   +-- dashboard/          # InstallTable, TableFilters, RegisterForm
|   +-- detail/             # InfoHeader, StatusForm, PipelineCard, PipelineFlow, CommentsSection, ActivityLog
|   +-- analytics/          # PartnerWorkload, StageDistribution, PartnerBreakdown, DataVolumeTrend, InstallHeatmap, InstallTimeline, KpiRow
|   +-- ui/                 # Badge, Button, Card, Input, KpiCard
+-- hooks/                  # use-installs.ts, use-analytics.ts, use-parser.ts
+-- lib/                    # prisma.ts, services.ts, parser.ts, utils.ts
+-- types/index.ts          # All TypeScript interfaces
```

## Documentation

Detailed technical docs are in `docs/`:
- `01-architecture.md` -- System overview, Docker, infrastructure
- `02-database-schema.md` -- All 5 tables, enums, relationships, data lifecycle
- `03-api-reference.md` -- Every API endpoint with request/response formats
- `04-frontend-guide.md` -- Page-by-page breakdown, components, hooks, patterns
- `05-parser-and-data-flow.md` -- End-to-end data trace from Slack -> DB -> UI
- `06-schema-analysis-report.md` -- Schema analysis with IMPLEMENTED status
