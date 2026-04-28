# Parser Logic & End-to-End Data Flow

## The Complete Data Pipeline

This document traces data from the moment a Slack message is pasted to how it appears on every screen.

---

## Step 1: Slack Message Input

Users post daily status updates in Slack with a standard format. Example:

```
Cogito_v2
Annotate: 477 tasks (1246 frames)
  1033-1265 (36 tasks)
  1040-1300 (114 tasks)
  1060-1380 (98 tasks)
Review: 123 tasks (300 frames)
  datasets: 1033-1265, 1060-1380
----
Sunix_v2
Protex Review: 50 tasks (200 frames)
  datasets: 1033-1265
----
Sunix-ppe
Annotate: 200 tasks (500 frames)
  2001-500 (80 tasks)
  2002-600 (120 tasks)
```

---

## Step 2: Parser (`src/lib/parser.ts`)

The parser is a pure function: `parseSlackMessage(text) -> ParsedBlock[]`

### How parsing works

1. **Split by separator**: Text is split on `----` (4+ dashes) into blocks
2. **For each block**:
   - Find first non-empty line -> match against partner regex
   - Skip summary/info blocks (lines starting with "Summary", "is working on", etc.)
   - Determine pipeline type: partner name ending in `-ppe` -> PPE, else -> OB
   - Extract stages: lines matching `StageName: N tasks (M frames)`
   - Extract datasets: either old format (`datasets: id1, id2`) or new format (`  id1 (N tasks)`)

### Regex patterns

| Pattern | Purpose | Example Match |
|---------|---------|---------------|
| `PARTNER_RE` | Partner name on its own line | `Cogito_v2` |
| `STAGE_RE` | Stage with task/frame counts | `Annotate: 477 tasks (1246 frames)` |
| `DATASET_RE` | Old-format dataset list | `datasets: 1033-1265, 1040-1300` |
| `NEW_DATASET_RE` | New-format per-dataset line | `  1033-1265 (36 tasks)` |
| `SKIP_RE` | Lines to ignore | `Total tasks to annotate...` |

### Parser output

For the example above, the parser produces:

```json
[
  {
    "partner": "Cogito_v2",
    "pipeline_type": "OB",
    "stages": [
      {
        "stage_name": "Annotate",
        "tasks": 477,
        "frames": 1246,
        "datasets": ["1033-1265", "1040-1300", "1060-1380"],
        "dataset_tasks": { "1033-1265": 36, "1040-1300": 114, "1060-1380": 98 }
      },
      {
        "stage_name": "Review",
        "tasks": 123,
        "frames": 300,
        "datasets": ["1033-1265", "1060-1380"],
        "dataset_tasks": {}
      }
    ]
  },
  {
    "partner": "Sunix_v2",
    "pipeline_type": "OB",
    "stages": [
      {
        "stage_name": "Protex Review",
        "tasks": 50,
        "frames": 200,
        "datasets": ["1033-1265"],
        "dataset_tasks": {}
      }
    ]
  },
  {
    "partner": "Sunix-ppe",
    "pipeline_type": "PPE",
    "stages": [
      {
        "stage_name": "Annotate",
        "tasks": 200,
        "frames": 500,
        "datasets": ["2001-500", "2002-600"],
        "dataset_tasks": { "2001-500": 80, "2002-600": 120 }
      }
    ]
  }
]
```

---

## Step 3: Apply to Database (`src/lib/services.ts`)

`processParserResults(parsedBlocks)` runs everything in a single Prisma transaction.

### Transaction flow (2 main steps)

```
For each ParsedBlock:
  For each stage in block.stages:
    |
    +-- 1. INSERT INTO stage_snapshots (aggregate)
    |     { batch_id, partner, pipeline_type, stage_name, tasks, frames, datasets }
    |
    +-- For each dataset in stage.datasets:
          |
          +-- 2a. UPSERT installs (create if new site ID)
          |     { comp_site_id }
          |
          +-- 2b. INSERT INTO site_stage_history (per-site)
                { batch_id, comp_site_id, partner, pipeline_type, stage_name, frames }
                frames = dataset_tasks[dataset] or null

After all blocks processed:
  |
  +-- 3. LOG activity for each touched install
  |     { activity_type: PARSER_UPDATE, message: "..." }
  |
  +-- 4. CLEANUP old data (30+ days)
        DELETE FROM stage_snapshots WHERE created_at < cutoff
        DELETE FROM site_stage_history WHERE created_at < cutoff
```

This is dramatically simpler than the old 6-step flow. There are no `pipelines` or `pipeline_stages` tables to update, no stage deactivation logic, and no `data_status` flag to sync.

### Example: What happens when parser runs with the above data

For site `1033-1265`:
- **Install** `1033-1265` is upserted (created if new)
- **site_stage_history** gets 3 rows:
  - `{ comp_site_id: "1033-1265", partner: "Cogito_v2", pipeline_type: "OB", stage_name: "Annotate", frames: 36 }`
  - `{ comp_site_id: "1033-1265", partner: "Cogito_v2", pipeline_type: "OB", stage_name: "Review", frames: null }` (old format, no per-site count)
  - `{ comp_site_id: "1033-1265", partner: "Sunix_v2", pipeline_type: "OB", stage_name: "Protex Review", frames: null }`
- **Multiple partners** are captured naturally: both Cogito_v2 and Sunix_v2 appear in history rows for the same site

No pipeline records to worry about -- the latest batch in `site_stage_history` IS the current pipeline state.

---

## Step 4: Dashboard Display

### How the dashboard table shows pipeline state

The API route `GET /api/installs` derives `pipeline_state` from `site_stage_history`:

```
For each install:
  1. Find latest batch_id from site_stage_history for this comp_site_id
  2. Get all rows from that batch
  3. Group by pipeline_type (OB / PPE)
  4. For each type, build PipelineTypeState:
     - partners: unique partner names
     - stages: array of { partner, stage_name, frames }
     - no_data: false (data exists in this batch)
  5. If a pipeline type has no entries -> null (or no_data: true if install has deployment flags)
```

The response includes `pipeline_state` directly on each install:
```json
{
  "comp_site_id": "1033-1265",
  "pipeline_state": {
    "OB": {
      "partners": ["Cogito_v2", "Sunix_v2"],
      "stages": [
        { "partner": "Cogito_v2", "stage_name": "Annotate", "frames": 36 },
        { "partner": "Cogito_v2", "stage_name": "Review", "frames": null },
        { "partner": "Sunix_v2", "stage_name": "Protex Review", "frames": null }
      ],
      "no_data": false
    },
    "PPE": null
  }
}
```

### How "No Data" works

An install has "no data" for a pipeline type when it has no entries in the latest global batch for that type. This is computed at query time -- there is no stored flag.

In the UI:
- **Dashboard table** (`PipelineCell`): Shows ONLY a "No Data" badge when `no_data` is true. Stages are hidden entirely.
- **Detail page** (`PipelineCard`): Shows partner badges + "No Data" badge when `no_data` is true. `PipelineFlow` is hidden.

---

## Step 5: Analytics Display

### Partner Workload Trend

Uses `stage_snapshots` table. Aggregates `tasks` or `frames` by `batch_date + partner`. Each partner+pipeline_type combo gets its own line.

### Stage Distribution Over Time

Uses `stage_snapshots`. Aggregates `tasks` by `batch_date + stage_name`. Can be filtered by partner and pipeline type.

### Partner Breakdown

Uses `stage_snapshots`. Shows ONLY the latest `batch_date`. Groups by partner, bars represent stages.

### Data Volume Trend

Uses `stage_snapshots`. Sums all tasks/frames by date, split by pipeline type (OB vs PPE) or combined total.

### Install Heatmap

Uses `site_stage_history`. For each install, shows a grid: rows = stages, columns = dates. Green cell = data present in that batch. Shows partner name and frame count on hover.

### Install Timeline

Uses `installs` table directly. Shows horizontal bars from `start_date` to `end_date` (or now), colored by status.

---

## Troubleshooting Data Issues

### Numbers seem wrong

1. Check if both apps are using the same database (`DATABASE_URL` in docker-compose)
2. Verify `site_stage_history` has recent entries: `GET /api/health` -> check table counts
3. Pipeline state is derived from the latest batch in `site_stage_history` for each install
4. If a site shows no pipeline data, check if it has any `site_stage_history` rows

### "No Data" showing incorrectly

1. "No data" is computed at query time: a pipeline type shows "no data" when the install has no entries for that type in the latest global batch
2. If the parser hasn't been run recently, or the site wasn't mentioned in the latest batch, it will show "no data"
3. Check the latest batch: `SELECT DISTINCT batch_id FROM site_stage_history ORDER BY created_at DESC LIMIT 1`

### Comments/Activity 500 errors

1. Check enum case: `GET /api/health` -> look at `db_activitytype_enum`
2. PostgreSQL stores `STAGE_UPDATE`, `COMMENT`, `SUMMARY`, `PARSER_UPDATE` (UPPERCASE)
3. Prisma schema must match exactly: `enum activitytype { STAGE_UPDATE COMMENT SUMMARY PARSER_UPDATE }`
4. Code must use `activitytype.COMMENT` (not lowercase)

### Stale data / caching issues

1. All API routes have `export const dynamic = "force-dynamic"` -- if missing, Next.js may cache
2. React Query `staleTime: 0` -- if changed, data may be stale
3. Browser cache: Hard refresh (Ctrl+Shift+R) to bypass
4. Docker cache: `docker compose build --no-cache nextjs` to rebuild
