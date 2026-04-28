# Frontend Guide: Pages, Components & Data Flow

## Directory Structure

```
src/
+-- app/                          # Next.js App Router pages & API routes
|   +-- layout.tsx                # Root layout (font, metadata, providers, shell)
|   +-- globals.css               # Tailwind theme + custom CSS variables
|   +-- providers.tsx             # React Query + AppContext (selected user)
|   +-- page.tsx                  # / -- Dashboard page
|   +-- analytics/page.tsx        # /analytics -- Analytics page
|   +-- admin/page.tsx            # /admin -- Slack parser admin
|   +-- install/[id]/page.tsx     # /install/:id -- Install detail page
|   +-- api/                      # Server-side API routes (see 03-api-reference.md)
|       +-- installs/...
|       +-- analytics/...
|       +-- parser/...
|       +-- users/...
|       +-- health/...
+-- components/
|   +-- layout/                   # App shell: sidebar, top bar, page container
|   +-- dashboard/                # Dashboard-specific: table, filters, register form
|   +-- detail/                   # Install detail: info header, pipelines, comments
|   +-- analytics/                # Chart components (6 total)
|   +-- admin/                    # Slack parser UI
|   +-- ui/                       # Reusable primitives: badge, button, card, input, kpi-card
+-- hooks/                        # React Query hooks for data fetching
|   +-- use-installs.ts           # Install CRUD, comments, activity, users
|   +-- use-analytics.ts          # KPIs, snapshots, site history
|   +-- use-parser.ts             # Parser preview & apply
+-- lib/                          # Server-side utilities
|   +-- prisma.ts                 # Prisma client singleton
|   +-- services.ts               # Business logic (processParserResults)
|   +-- parser.ts                 # Slack message parser
|   +-- utils.ts                  # Color maps, formatting, computed fields
+-- types/
    +-- index.ts                  # All TypeScript interfaces & type aliases
```

---

## Page-by-Page Breakdown

### Dashboard (`/`) -- `src/app/page.tsx`

**What it shows:**
- Stats row: Total, In Progress, Complete, On Hold counts
- Register new install form (only visible when a user is selected)
- Filter bar: search, status, region, type dropdowns
- Install table with all columns, sortable

**Data flow:**
```
page.tsx
  +- useInstalls(filters)         -> GET /api/installs?owner=X&status=Y&...
  +- useAppContext()               -> selectedUser from global context
       +- <TopBar>                 -> User selector dropdown (fetches /api/users)
       +- <MiniStat>              -> Computed from installs array
       +- <RegisterForm>          -> POST /api/installs (only if user selected)
       +- <TableFilters>          -> Local state for search/filters
       +- <InstallTable>          -> Renders table rows, clickable -> /install/[id]
```

**Key components:**

| Component        | File                                    | Purpose |
|------------------|-----------------------------------------|---------|
| `MiniStat`       | Inline in `page.tsx`                    | Colored stat card |
| `ErrorBanner`    | Inline in `page.tsx`                    | DB connection error with retry |
| `TableFilters`   | `components/dashboard/table-filters.tsx` | Search + dropdown filters |
| `RegisterForm`   | `components/dashboard/register-form.tsx` | Create new install |
| `InstallTable`   | `components/dashboard/install-table.tsx` | Main data table |

**InstallTable internals** (`components/dashboard/install-table.tsx`):

The table has helper sub-components:
- `PipelineCell` -- Renders partner badges + stage badges for one pipeline type. Takes a `PipelineTypeState` (or `null`) as its data prop.
  - When `no_data` is true: Shows ONLY a NoData badge (no stages)
  - When `null`: Shows "No pipeline" text
  - When stages exist: Shows partner badges + stage badges with frame counts
- `ModelCell` -- Shows General/Site-Specific model type + Deployed badge
- `StageBadge`, `NoDataBadge`, `PartnerBadge`, etc. from `components/ui/badge.tsx`

Multiple partners per site per pipeline type are handled natively -- each partner's stages appear as separate entries.

**Sorting:** Clicking column headers sorts by that field. The sort indicator arrow rotates based on direction.

---

### Install Detail (`/install/[id]`) -- `src/app/install/[id]/page.tsx`

**What it shows:**
- Back button to dashboard
- Info header (ID, name, status, owner, region, type, dates)
- Status form (edit status, model type, deployment flags)
- OB and PPE pipeline cards with stage flow visualization
- Comments section with post form
- Full activity log

**Data flow:**
```
page.tsx
  +- useInstall(id)               -> GET /api/installs/:id
  +- useComments(id)              -> GET /api/installs/:id/comments
  +- useActivity(id)              -> GET /api/installs/:id/activity
  +- useUsers()                   -> GET /api/users
  +- useAddComment(id)            -> POST /api/installs/:id/comments (mutation)
  +- useUpdateInstall(id)         -> PATCH /api/installs/:id (mutation)
       +- <InfoHeader>            -> Read-only install metadata
       +- <StatusForm>            -> Editable status, models, deployment
       +- <PipelineCard>          -> Pipeline visualization (x2: OB + PPE)
       |    +- <PipelineFlow>     -> Stage flow diagram with arrows
       +- <CommentsSection>       -> Comment list + post form
       +- <ActivityLog>           -> All activity types
```

**Key components:**

| Component        | File                                    | Purpose |
|------------------|-----------------------------------------|---------|
| `InfoHeader`     | `components/detail/info-header.tsx`      | Badges for status, region, type, dates |
| `StatusForm`     | `components/detail/status-form.tsx`      | Dropdown + toggles for status/models |
| `PipelineCard`   | `components/detail/pipeline-card.tsx`    | Card for one pipeline type (OB or PPE) |
| `PipelineFlow`   | `components/detail/pipeline-flow.tsx`    | Visual stage flow: Annotate -> Review -> Protex Review |
| `CommentsSection`| `components/detail/comments-section.tsx` | Comment list with post form |
| `ActivityLog`    | `components/detail/activity-log.tsx`     | Chronological activity feed |

**PipelineCard behavior:**
- Takes a `state: PipelineTypeState | null` prop (from `install.pipeline_state.OB` or `.PPE`)
- `null`: Shows "No {OB/PPE} Pipeline" placeholder
- `no_data === true`: Shows partner badges + NoData badge, hides PipelineFlow entirely
- Normal: Shows partner badges + PipelineFlow with stage boxes, frame counts

**PipelineFlow** (`components/detail/pipeline-flow.tsx`):
Renders 3 fixed stages (Annotate -> Review -> Protex Review) as colored boxes connected by arrows. Stages present in the `stages` array are highlighted; missing stages are dimmed. Each box shows the frame count. If `frames` is `null`, shows "---". Supports multiple partners per stage.

---

### Analytics (`/analytics`) -- `src/app/analytics/page.tsx`

**What it shows:**
- KPI row (4 metrics)
- 6 chart components in a grid layout

**Data flow:**
```
page.tsx
  +- useKpis()                    -> GET /api/analytics/kpis
  +- useSnapshots()               -> GET /api/analytics/snapshots
  +- useSiteHistory()             -> GET /api/analytics/site-history
  +- useInstalls({})              -> GET /api/installs
       +- <KpiRow>                -> 4 KPI cards
       +- <PartnerWorkload>       -> Line chart: partner workload over time
       +- <StageDistribution>     -> Stacked bar: stages over time
       +- <PartnerBreakdown>      -> Grouped bar: latest batch partner x stage
       +- <DataVolumeTrend>       -> Area chart: total frames/tasks over time
       +- <InstallHeatmap>        -> Grid: data presence per install per date
       +- <InstallTimeline>       -> Horizontal bars: install duration
```

**KPI cards:**
- Active Installs (status "In-progress")
- Completed (status "Complete")
- Avg Days to Complete
- No Data Count (installs with no data in latest batch)

**Chart details:**

| Chart               | Data Source       | Filters                              | Key Feature |
|---------------------|-------------------|--------------------------------------|-------------|
| `PartnerWorkload`   | `stage_snapshots` | Partner dropdown, OB/PPE, Tasks/Frames | Each partner+type gets its own line |
| `StageDistribution` | `stage_snapshots` | Partner+type dropdown, OB/PPE        | Per-partner stage breakdown |
| `PartnerBreakdown`  | `stage_snapshots` | None (latest batch only)             | Grouped bar of current state |
| `DataVolumeTrend`   | `stage_snapshots` | OB/PPE split or total, Tasks/Frames  | Area chart showing volume trends |
| `InstallHeatmap`    | `site_stage_history` + `installs` | Install selector, OB/PPE | Shows site name, partner, frame counts |
| `InstallTimeline`   | `installs`        | None                                 | Horizontal bars colored by status |

---

### Admin (`/admin`) -- `src/app/admin/page.tsx`

**What it shows:**
- Large text area for pasting Slack messages
- Preview button -> shows parsed blocks
- Apply button -> writes to database
- Success/error feedback

**Data flow:**
```
page.tsx
  +- <SlackParser>
       +- useParserPreview()      -> POST /api/parser/preview
       +- useParserApply()        -> POST /api/parser/apply
            +- <ParserPreview>    -> Renders parsed blocks as cards
```

---

## Layout Components

### PageShell (`components/layout/page-shell.tsx`)

Root layout wrapper. Manages sidebar collapse state. Renders sidebar + main content area.

```
<div className="flex min-h-screen">
  <Sidebar collapsed={collapsed} onToggle={...} />
  <main className={collapsed ? "ml-16" : "ml-60"}>
    {children}
  </main>
</div>
```

When the sidebar is collapsed, main content extends to fill the extra space.

### Sidebar (`components/layout/sidebar.tsx`)

Fixed left sidebar with:
- Protex AI logo + branding
- Navigation links: Dashboard, Analytics, Admin
- Collapse/expand button

Props: `collapsed: boolean`, `onToggle: () => void`

Width: 240px expanded, 64px collapsed.

### TopBar (`components/layout/top-bar.tsx`)

Horizontal header bar with:
- Page title + subtitle
- User selector dropdown (fetches users from `/api/users`)
- Avatar circle showing initials

Props: `selectedUser`, `onUserChange`, `title`, `subtitle`

---

## Reusable UI Components (`components/ui/`)

### badge.tsx

Badge components for consistent styling:
- `StatusBadge` -- Install status with dot indicator
- `RegionBadge` -- Region code
- `TypeBadge` -- Install type
- `StageBadge` -- Pipeline stage with optional frame count
- `PartnerBadge` -- Partner name
- `PipelineBadge` -- OB or PPE
- `NoDataBadge` -- "No Data" indicator
- `DeployedBadge` -- Green "Deployed" badge

Each badge uses color maps from `src/lib/utils.ts`.

### card.tsx

`Card`, `CardTitle`, `CardDescription` -- Styled card container with dark theme, optional hover/active/muted variants.

### button.tsx

`Button` -- Styled button with `primary` and `secondary` variants.

### input.tsx

`Input` -- Styled text input with dark theme.

### kpi-card.tsx

`KpiCard` -- Metrics card with icon, label, value, and accent color bar.

---

## Hooks (`hooks/`)

### use-installs.ts

| Hook                | Method   | Endpoint                              | Purpose |
|---------------------|----------|---------------------------------------|---------|
| `useInstalls(filters)` | GET   | `/api/installs?...`                   | List installs with pipeline_state |
| `useInstall(id)`    | GET      | `/api/installs/:id`                   | Single install detail |
| `useCreateInstall()` | POST    | `/api/installs`                       | Create new install (mutation) |
| `useUpdateInstall(id)` | PATCH | `/api/installs/:id`                   | Update install (mutation) |
| `useComments(id)`   | GET      | `/api/installs/:id/comments`          | Fetch comments |
| `useAddComment(id)` | POST     | `/api/installs/:id/comments`          | Post comment (mutation) |
| `useActivity(id)`   | GET      | `/api/installs/:id/activity`          | Fetch all activity |
| `useStageHistory(id, pipeline?)` | GET | `/api/installs/:id/stage-history` | Historical stages |
| `useUsers()`        | GET      | `/api/users`                          | Fetch user list |

Mutations automatically invalidate related queries via `queryClient.invalidateQueries()`.

### use-analytics.ts

| Hook                     | Endpoint                           | Purpose |
|--------------------------|------------------------------------|---------|
| `useKpis()`              | `/api/analytics/kpis`              | KPI metrics |
| `useSnapshots(pipeline?)` | `/api/analytics/snapshots?...`    | Stage snapshots for charts |
| `useSiteHistory(id?, pipeline?)` | `/api/analytics/site-history?...` | Per-site history for heatmap |

### use-parser.ts

| Hook                  | Endpoint                 | Purpose |
|-----------------------|--------------------------|---------|
| `useParserPreview()`  | `/api/parser/preview`    | Preview parsed blocks (mutation) |
| `useParserApply()`    | `/api/parser/apply`      | Apply to DB (mutation) |

---

## Business Logic (`lib/`)

### parser.ts -- Slack Message Parser

Parses daily Slack status messages into structured `ParsedBlock[]`.

**Input format (example):**
```
Cogito_v2
Annotate: 150 tasks (300 frames)
  1033-1265 (36 tasks)
  1040-1300 (114 tasks)
Review: 50 tasks (100 frames)
  datasets: 1033-1265, 1050-1400
----
Sunix-ppe
Annotate: 200 tasks (400 frames)
  datasets: 2001-500, 2002-600
```

**Key rules:**
- Blocks separated by `----` (4+ dashes)
- First line of each block = partner name
- Partner name ending in `-ppe` -> `pipeline_type = "PPE"`, otherwise `"OB"`
- Stage lines: `StageName: N tasks (M frames)`
- Dataset lines: either `datasets: id1, id2` (old format) or `  id1 (N tasks)` (new format, per-dataset counts)

**Output:** `ParsedBlock[]` where each block has `partner`, `pipeline_type`, and `stages[]` (each with `stage_name`, `tasks`, `frames`, `datasets[]`, `dataset_tasks{}`).

### services.ts -- processParserResults()

Takes `ParsedBlock[]` and runs a single database transaction with 2 main steps:

1. **Save aggregate snapshots** -> `stage_snapshots` table
2. **For each dataset (site):** Upsert install + create `site_stage_history` row
3. **Log activity** for each touched install
4. **Cleanup** old snapshots/history (30+ days)

The function is idempotent -- safe to re-run. Uses `batch_id` (ISO timestamp) for deduplication.

### utils.ts -- Color Maps & Formatting

- `STATUS_COLORS`, `REGION_COLORS`, `TYPE_COLORS`, `PARTNER_COLORS`, `STAGE_COLORS`, `PIPELINE_COLORS` -- Badge color definitions
- `getPartnerColor(partner)` -- Looks up partner color, falls back to base name
- `formatDate()`, `formatDateTime()` -- Date formatting helpers
- `daysToComplete()` -- Days between start and end date
- `generateAutoSummary()` -- Auto-generate install summary based on status and model type
- `sortByStatus()` -- Sort installs by status priority

---

## Common Patterns

### Adding a new page

1. Create `src/app/my-page/page.tsx` with `"use client"` directive
2. Import `TopBar` + `useAppContext()` for consistent header
3. Create data hooks in `src/hooks/` if needed
4. Add navigation link in `src/components/layout/sidebar.tsx`

### Adding a new API route

1. Create `src/app/api/my-route/route.ts`
2. Add `export const dynamic = "force-dynamic"` at the top
3. Import `prisma` from `@/lib/prisma`
4. Export `GET`, `POST`, `PATCH`, or `DELETE` async functions
5. Create corresponding hook in `src/hooks/`

### Adding a new chart to Analytics

1. Create component in `src/components/analytics/my-chart.tsx`
2. Accept data via props (usually `snapshots`, `installs`, or `siteHistory`)
3. Import and render in `src/app/analytics/page.tsx`
4. If new data is needed, add API route + hook

### Adding a new filter

1. Add filter state to the page component
2. Pass as query parameter to the hook
3. Add the parameter to the API route's query handling
4. Add UI control (dropdown/input) to the filter bar

### Error handling pattern

All pages follow the same pattern:
```typescript
if (isError) return <ErrorBanner />
if (isLoading) return <LoadingSpinner />
if (!data) return <EmptyState />
return <ActualContent data={data} />
```

API routes follow:
```typescript
try {
  // ... Prisma query
  return NextResponse.json(result);
} catch (err) {
  console.error("...", err);
  return NextResponse.json({ error: String(err) }, { status: 500 });
}
```
