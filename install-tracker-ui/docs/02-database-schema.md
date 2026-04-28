# Database Schema & Data Model

## Overview

The database is PostgreSQL 15, created and managed by SQLAlchemy (Streamlit app). The Next.js app connects via Prisma ORM with a schema that mirrors the existing tables.

**Schema file:** `install-tracker-ui/prisma/schema.prisma`

**Tables:** 5 tables total. The `pipelines` and `pipeline_stages` tables have been dropped as part of a schema simplification. `site_stage_history` is now the single source of truth for pipeline state.

---

## Entity Relationship Diagram

```
users
  id (PK, serial)
  name (unique, varchar 255)

installs
  comp_site_id (PK, varchar 50)   <- e.g., "1033-1265"
  owner_name (varchar 255)
  site_name (varchar 255)          <- e.g., "Neovia - Pineham"
  jira_link (varchar 512)
  install_type (varchar 50)        <- "New Site" | "AddOn"
  region (varchar 50)              <- "US" | "EU" | "CA" | "Tesla" | "Asia"
  status (varchar 50)              <- "In-progress" | "Complete" | "On Hold" | "Cancelled"
  general_od_model (boolean)
  general_ppe_model (boolean)
  ob_deployed (boolean)
  ppe_deployed (boolean)
  start_date (date)
  end_date (date)
  created_at (timestamp)
    |
    +-- 1:N -> site_stage_history
    +-- 1:N -> install_activity

site_stage_history
  id (PK, serial)
  batch_id (varchar 50)            <- Same batch_id as stage_snapshots
  comp_site_id (FK -> installs)
  partner (varchar 255)
  pipeline_type (enum: OB | PPE)
  stage_name (varchar 100)
  frames (int, nullable)           <- Per-site frame count (null if unknown)
  created_at (timestamp)
  INDEX(batch_id)
  INDEX(comp_site_id)

install_activity
  id (PK, serial)
  comp_site_id (FK -> installs)
  user_name (varchar 255)
  activity_type (enum: STAGE_UPDATE | COMMENT | SUMMARY | PARSER_UPDATE)
  message (text)
  metadata (json)
  created_at (timestamp)

stage_snapshots
  id (PK, serial)
  batch_id (varchar 50)            <- ISO timestamp, e.g., "2026-04-08T10:30:00Z"
  partner (varchar 255)
  pipeline_type (enum: OB | PPE)
  stage_name (varchar 100)
  tasks (int)                      <- Aggregate across ALL sites for this partner+stage
  frames (int)
  datasets (json)                  <- List of dataset IDs included
  created_at (timestamp)
  INDEX(batch_id)
```

---

## Enums

PostgreSQL stores enum values in UPPERCASE. The Prisma schema must match exactly.

### `pipelinetype`
```sql
CREATE TYPE pipelinetype AS ENUM ('OB', 'PPE');
```

### `activitytype`
```sql
CREATE TYPE activitytype AS ENUM ('STAGE_UPDATE', 'COMMENT', 'SUMMARY', 'PARSER_UPDATE');
```

**Critical:** If the Prisma schema has lowercase enum values but the DB has UPPERCASE, Prisma queries will fail with `Value 'COMMENT' not found in enum 'activitytype'`. The `/api/health` endpoint verifies this.

---

## Key Concepts

### comp_site_id

The primary identifier for an install. Format: `{company_id}-{site_id}`, e.g., `"1033-1265"`. This comes from the external system (annotation platform dataset IDs).

### Pipeline State (derived from site_stage_history)

Each install can have pipeline activity for two types: **OB** (Object Detection) and **PPE** (PPE Detection). Pipeline stages follow this progression:

```
Annotate -> Review -> Protex Review
```

There are no dedicated `pipelines` or `pipeline_stages` tables. Instead, the "current state" of a site's pipeline is derived from the **latest batch** in `site_stage_history` for that site. This is represented in the API as:

```typescript
PipelineState = {
  OB: PipelineTypeState | null,
  PPE: PipelineTypeState | null
}

PipelineTypeState = {
  partners: string[],
  stages: StageEntry[],
  no_data: boolean
}

StageEntry = {
  partner: string,
  stage_name: string,
  frames: number | null
}
```

Multiple partners per site per pipeline type are handled natively -- if both Cogito_v2 and Sunix_v2 have data for the same site's OB pipeline, both appear in `stages` and `partners`.

### No Data Detection

A pipeline type has `no_data: true` when the install exists but has no entries in the latest global batch for that pipeline type. This is computed at query time -- there is no stored flag.

### Frames

- **Frames**: Number of video frames in the dataset (per-site count from `site_stage_history.frames`)
- **Tasks/Frames (aggregate)**: Total across ALL sites for a partner+stage combo (stored in `stage_snapshots`)

The UI shows per-site counts from `site_stage_history`. If no per-site data exists, `frames` is `null` (no number displayed).

### batch_id

A timestamp string (ISO format) that groups data from a single parser run. Example: `"2026-04-08T10:30:00Z"`.

All `stage_snapshots` and `site_stage_history` rows from one parser run share the same `batch_id`. This is how the system finds the "latest" data for a site: find the most recent `batch_id` for that `comp_site_id`.

### Derived field: batch_date

The analytics API routes derive `batch_date` from `batch_id`:
```typescript
batch_date = batch_id.slice(0, 10)  // "2026-04-08T10:30:00Z" -> "2026-04-08"
```

This is used as the x-axis for time series charts.

---

## Data Lifecycle

### How data enters the system

1. User pastes a daily Slack status message into the Admin parser
2. Parser extracts partner blocks with stages, tasks, frames, and dataset IDs
3. `processParserResults()` (in `src/lib/services.ts`) runs a transaction:
   - Creates `stage_snapshots` (aggregate data for analytics)
   - Upserts `installs` (creates new sites if not seen before)
   - Creates `site_stage_history` rows (per-site data for dashboard)
   - Logs `PARSER_UPDATE` activity

### How data is cleaned up

The parser also prunes old data:
```typescript
// Delete snapshots and history older than 30 days
const cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
await tx.stage_snapshots.deleteMany({ where: { created_at: { lt: cutoff } } });
await tx.site_stage_history.deleteMany({ where: { created_at: { lt: cutoff } } });
```

---

## Common Queries

### Get current pipeline state for an install
```typescript
// 1. Find latest batch for this site
const latestEntry = await prisma.site_stage_history.findFirst({
  where: { comp_site_id: id },
  orderBy: { created_at: "desc" },
  select: { batch_id: true },
});

// 2. Get all entries from that batch
const historyEntries = await prisma.site_stage_history.findMany({
  where: { comp_site_id: id, batch_id: latestEntry.batch_id },
});

// 3. Group by pipeline_type to build PipelineState
// OB entries -> { partners: [...], stages: [...], no_data: false }
// PPE entries -> { partners: [...], stages: [...], no_data: false }
// Missing type -> null (or { ..., no_data: true } if install has deployed flags)
```

### Get analytics KPIs
```typescript
const [active, completed, allComplete, noDataCount] = await Promise.all([
  prisma.installs.count({ where: { status: "In-progress" } }),
  prisma.installs.count({ where: { status: "Complete" } }),
  prisma.installs.findMany({
    where: { status: "Complete", start_date: { not: null }, end_date: { not: null } },
    select: { start_date: true, end_date: true },
  }),
  // Count installs with no data in latest batch (not pipelines)
  // Computed by finding installs NOT present in the latest global batch
]);
```
