# API Reference

## Overview

All API routes are Next.js App Router server-side functions in `src/app/api/`. They use Prisma ORM to query the PostgreSQL database. Every route exports `export const dynamic = "force-dynamic"` to prevent caching.

**Base URL:** `/api` (same origin as the frontend, served by Next.js)

---

## Installs

### GET /api/installs

Fetch all installs with optional filters. Returns installs with their pipeline state derived from `site_stage_history`.

**Query Parameters:**

| Param    | Type   | Default | Description                          |
|----------|--------|---------|--------------------------------------|
| `owner`  | string | All     | Filter by `owner_name`               |
| `status` | string | All     | Filter by `status`                   |
| `region` | string | All     | Filter by `region`                   |
| `type`   | string | All     | Filter by `install_type`             |
| `search` | string | ---     | Search in `comp_site_id`, `site_name`, `owner_name` (case-insensitive) |

**Response:** `Install[]` where each install includes a `pipeline_state` field:

```json
{
  "comp_site_id": "1033-1265",
  "site_name": "Neovia - Pineham",
  "owner_name": "Raafay",
  "status": "In-progress",
  "pipeline_state": {
    "OB": {
      "partners": ["Cogito_v2", "Sunix_v2"],
      "stages": [
        { "partner": "Cogito_v2", "stage_name": "Annotate", "frames": 36 },
        { "partner": "Sunix_v2", "stage_name": "Annotate", "frames": 20 }
      ],
      "no_data": false
    },
    "PPE": {
      "partners": ["Sunix-ppe"],
      "stages": [
        { "partner": "Sunix-ppe", "stage_name": "Annotate", "frames": 80 }
      ],
      "no_data": false
    }
  }
}
```

When a pipeline type has no data in the latest batch: `{ "partners": [], "stages": [], "no_data": true }`.
When a pipeline type has never existed for the install: `null`.

**File:** `src/app/api/installs/route.ts`

---

### POST /api/installs

Create a new install.

**Body:**
```json
{
  "comp_site_id": "1033-1265",     // Required
  "site_name": "Neovia - Pineham", // Optional
  "install_type": "New Site",      // Optional, default "New Site"
  "region": "US",                  // Optional, default "US"
  "jira_link": "https://...",      // Optional
  "owner_name": "Raafay"           // Optional
}
```

**Response:** `Install` (201 Created)

**File:** `src/app/api/installs/route.ts`

---

### GET /api/installs/[id]

Fetch a single install by `comp_site_id`. Includes `pipeline_state` derived from `site_stage_history` (same shape as list endpoint).

**Response:** `Install` or `{ error: "Not found" }` (404)

**File:** `src/app/api/installs/[id]/route.ts`

---

### PATCH /api/installs/[id]

Update install fields. Only allowed fields are updated (whitelist approach).

**Allowed fields:**
`status`, `site_name`, `owner_name`, `install_type`, `region`, `jira_link`, `general_od_model`, `general_ppe_model`, `ob_deployed`, `ppe_deployed`, `start_date`, `end_date`

**Auto-behavior:** When `status` is set to `"Complete"` and no `end_date` is provided, `end_date` is automatically set to today.

**Body:** Partial object with any of the allowed fields.

**Response:** `Install`

**File:** `src/app/api/installs/[id]/route.ts`

---

### GET /api/installs/[id]/comments

Fetch comments (activity type = `COMMENT`) for an install. Returns newest first, max 50.

**Response:** `InstallActivity[]`

**File:** `src/app/api/installs/[id]/comments/route.ts`

---

### POST /api/installs/[id]/comments

Add a comment to an install.

**Body:**
```json
{
  "message": "Comment text here",   // Required
  "user_name": "Raafay"             // Optional, defaults to "system"
}
```

**Response:** `InstallActivity` (201 Created)

**File:** `src/app/api/installs/[id]/comments/route.ts`

---

### GET /api/installs/[id]/activity

Fetch all activity (all types) for an install. Returns newest first, max 50.

**Response:** `InstallActivity[]`

**File:** `src/app/api/installs/[id]/activity/route.ts`

---

### GET /api/installs/[id]/pipelines

Fetch pipeline state for an install, derived from the latest `site_stage_history` batch.

**Response:** `PipelineState`

```json
{
  "OB": {
    "partners": ["Cogito_v2"],
    "stages": [
      { "partner": "Cogito_v2", "stage_name": "Annotate", "frames": 36 },
      { "partner": "Cogito_v2", "stage_name": "Review", "frames": null }
    ],
    "no_data": false
  },
  "PPE": null
}
```

**File:** `src/app/api/installs/[id]/pipelines/route.ts`

---

### GET /api/installs/[id]/stage-history

Fetch historical stage data for an install from `site_stage_history`.

**Query Parameters:**

| Param      | Type   | Default | Description                    |
|------------|--------|---------|--------------------------------|
| `pipeline` | string | All     | Filter by pipeline type (OB/PPE) |

**Response:** `SiteStageHistory[]` (newest first, max 100)

**File:** `src/app/api/installs/[id]/stage-history/route.ts`

---

## Analytics

### GET /api/analytics/kpis

Fetch aggregated KPI metrics for the analytics dashboard.

**Response:**
```json
{
  "activeInstalls": 15,       // installs with status "In-progress"
  "completed": 8,             // installs with status "Complete"
  "avgDaysToComplete": 42,    // average days from start_date to end_date
  "noDataCount": 3            // installs with no data in the latest batch
}
```

Note: `noDataCount` counts installs (not pipelines) that have no entries in the latest global batch.

**File:** `src/app/api/analytics/kpis/route.ts`

---

### GET /api/analytics/snapshots

Fetch stage snapshot time series for charts. Each row represents one partner + stage + pipeline type at one point in time.

**Query Parameters:**

| Param      | Type   | Default | Description                    |
|------------|--------|---------|--------------------------------|
| `pipeline` | string | All     | Filter by pipeline type (OB/PPE) |

**Response:** `StageSnapshot[]` with derived `batch_date` field.

**File:** `src/app/api/analytics/snapshots/route.ts`

---

### GET /api/analytics/site-history

Fetch per-site stage history for the heatmap chart.

**Query Parameters:**

| Param          | Type   | Default | Description                    |
|----------------|--------|---------|--------------------------------|
| `comp_site_id` | string | ---     | Filter by install ID           |
| `pipeline`     | string | All     | Filter by pipeline type (OB/PPE) |

**Response:** `SiteStageHistory[]` with derived `batch_date` field.

**File:** `src/app/api/analytics/site-history/route.ts`

---

## Parser

### POST /api/parser/preview

Parse a Slack message and return the extracted blocks without applying to the database.

**Body:**
```json
{
  "text": "Cogito_v2\nAnnotate: 150 tasks (300 frames)\n  datasets: 1033-1265, 1040-1300\n----\nSunix_v2\n..."
}
```

**Response:** `ParsedBlock[]`

**File:** `src/app/api/parser/preview/route.ts`

---

### POST /api/parser/apply

Parse a Slack message AND apply the results to the database. This is the main data ingestion endpoint. The parser writes to only 2 tables: `site_stage_history` and `stage_snapshots` (plus upserting `installs` for new sites).

**Body:** Same as preview.

**Response:**
```json
{
  "installs_touched": ["1033-1265", "1040-1300"],
  "stages_created": 12,
  "errors": []
}
```

**File:** `src/app/api/parser/apply/route.ts`

---

## Users

### GET /api/users

Fetch all registered users, sorted by name.

**Response:** `{ id: number, name: string }[]`

---

### POST /api/users

Create or upsert a user.

**Body:** `{ "name": "Raafay" }`

**Response:** `{ id: number, name: string }` (201 Created)

**File:** `src/app/api/users/route.ts`

---

## Health

### GET /api/health

Comprehensive health check endpoint. Tests:
1. Raw DB connection (`SELECT 1`)
2. Table row counts for all tables
3. Raw SQL activity query (bypasses Prisma enum mapping)
4. Prisma ORM activity query (tests enum handling)
5. PostgreSQL `activitytype` enum values from `pg_enum`
6. PostgreSQL `pipelinetype` enum values from `pg_enum`

Useful for diagnosing connection issues, enum mismatches, and verifying the database state.

**Response:**
```json
{
  "status": "ok",           // or "partial_errors" or "error"
  "timestamp": "2026-04-08T...",
  "db_connection": "ok",
  "table_counts": { "installs": 25, "site_stage_history": 500, ... },
  "raw_activity_query": [...],
  "orm_activity_query": {...},
  "db_activitytype_enum": [{"enumlabel": "STAGE_UPDATE"}, ...],
  "db_pipelinetype_enum": [{"enumlabel": "OB"}, {"enumlabel": "PPE"}]
}
```

**File:** `src/app/api/health/route.ts`

---

## TypeScript Interfaces

All types are in `src/types/index.ts`:

```typescript
// Domain types
type InstallStatus = "In-progress" | "Complete" | "On Hold" | "Cancelled"
type InstallType   = "New Site" | "AddOn"
type Region        = "US" | "EU" | "CA" | "Tesla" | "Asia"
type PipelineType  = "OB" | "PPE"
type StageName     = "Annotate" | "Review" | "Protex Review"
type ActivityType  = "STAGE_UPDATE" | "COMMENT" | "SUMMARY" | "PARSER_UPDATE"

// Entities
interface Install { ... }          // Main install record with pipeline_state
interface PipelineState {          // { OB: PipelineTypeState | null, PPE: ... }
  OB: PipelineTypeState | null
  PPE: PipelineTypeState | null
}
interface PipelineTypeState {      // State for one pipeline type
  partners: string[]
  stages: StageEntry[]
  no_data: boolean
}
interface StageEntry {             // One stage row from site_stage_history
  partner: string
  stage_name: string
  frames: number | null
}
interface InstallActivity { ... }  // Comment or system event
interface StageSnapshot { ... }    // Aggregate snapshot for analytics
interface SiteStageHistory { ... } // Per-site stage data for heatmap
interface KpiData { ... }          // Analytics KPI aggregates (noDataCount, not noDataPipelines)

// Parser
interface ParsedStage { ... }      // Extracted stage from Slack message
interface ParsedBlock { ... }      // Extracted partner block from Slack message
```
