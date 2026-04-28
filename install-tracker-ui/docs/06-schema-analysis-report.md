# Install Tracker -- Schema & Architecture Analysis Report

## Status: IMPLEMENTED

The schema simplification proposed in this report has been fully implemented. The `pipelines` and `pipeline_stages` tables have been dropped. `site_stage_history` is now the single source of truth for pipeline state. Key changes:

- **Dropped tables:** `pipelines`, `pipeline_stages`
- **Remaining tables (5):** `installs`, `site_stage_history`, `stage_snapshots`, `install_activity`, `users`
- **New data model:** `Install` now has `pipeline_state?: PipelineState` instead of `pipelines: Pipeline[]`
- **PipelineState shape:** `{ OB: PipelineTypeState | null, PPE: PipelineTypeState | null }`
- **PipelineTypeState shape:** `{ partners: string[], stages: StageEntry[], no_data: boolean }`
- **StageEntry shape:** `{ partner, stage_name, frames }`
- **Parser simplified:** Now writes only to `site_stage_history` + `stage_snapshots` (2 steps, not 6)
- **Removed concepts:** `data_status` field, `active/inactive` toggle on stages, `noDataPipelines` KPI
- **New KPI:** `noDataCount` counts installs with no data (not pipelines)
- **Multi-partner:** Handled natively via `site_stage_history` rows -- no single-partner limitation

---

## 1. What This Tool Does (Full Scope)

### Purpose
Track the lifecycle of customer site installations -- from initial data annotation through model deployment. Each "install" is a customer site (identified by `CompanyID-SiteID`) that goes through a pipeline of annotation stages performed by third-party annotation partners.

### Core Functionality

| Feature | Description |
|---------|-------------|
| **Install Registry** | Track each site: owner, status, type, region, jira link, start/end dates |
| **Pipeline Tracking** | Each site has up to 2 pipeline types (OB = Object Detection, PPE = PPE Detection) |
| **Stage Tracking** | Each pipeline goes through stages: Annotate -> Review -> Protex Review |
| **Partner Tracking** | Third-party partners (Cogito_v2, Sunix_v2, etc.) do the annotation work |
| **Slack Parser** | Daily Slack status messages are parsed to extract stage/task/frame counts per partner per site |
| **Model Tracking** | Whether the site uses a General or Site-Specific model, and deployment status |
| **Analytics** | Trends over time: partner workload, stage distribution, data volume, per-site heatmap |
| **Comments & Activity** | Users can comment on installs; all changes are logged |

### Edge Cases That Are Now Handled Natively

1. **Multiple partners per site per pipeline type** -- Site `243-1196` can have data being annotated by both `Cogito_v2` AND `Sunix_v2` for OB simultaneously. Each partner gets its own rows in `site_stage_history`.
2. **Partner changes over time** -- A site might start with `Cogito_v2` for annotation and later switch to `Sunix_v2` for review. The history captures this naturally.
3. **Parser-created vs user-registered installs** -- Parser creates skeleton installs (just comp_site_id). Users later "register" them by adding owner, site name, jira link, etc.
4. **No-data status** -- Computed at query time: if an install has no entries in the latest global batch for a pipeline type, `no_data` is true. No stored flag needed.
5. **Per-site vs aggregate counts** -- Slack messages contain both aggregate totals and per-site breakdowns. Aggregates go to `stage_snapshots`; per-site data goes to `site_stage_history`.

---

## 2. Current Database Schema (5 Tables)

```
+---------------------+     +------------------------+
|      installs       |----<|  site_stage_history    |  <- Source of truth for pipeline state
| (PK: comp_site_id)  |     | (PK: id)              |
|                     |     | batch_id               |
| owner_name          |     | comp_site_id (FK)      |
| site_name           |     | partner                |
| status              |     | pipeline_type (OB/PPE) |
| install_type        |     | stage_name             |
| region, jira_link   |     | frames                 |
| general_od_model    |     | created_at             |
| general_ppe_model   |     +------------------------+
| ob_deployed         |
| ppe_deployed        |     +----------------------+
| start_date          |     |  stage_snapshots     |  <- Pre-aggregated for analytics
| end_date            |     | (PK: id)             |
| created_at          |     | batch_id, partner    |
|                     |     | pipeline_type        |
|                     |----<| stage_name           |
|                     |     | tasks, frames        |
|                     |     | datasets (JSON)      |
|                     |     +----------------------+
|                     |
|                     |----<+----------------------+
|                     |     |  install_activity    |
|                     |     +----------------------+
+---------------------+
                            +------------------+
                            |     users        |
                            +------------------+
```

### Table-by-Table Purpose

| Table | Rows grow how? | Purpose |
|-------|---------------|---------|
| `installs` | 1 per site (stable) | Master record for each customer site |
| `site_stage_history` | Grows every parser run | Per-site per-partner per-stage history. The single source of truth for pipeline state |
| `stage_snapshots` | Grows every parser run | Aggregate partner-level metrics (not per-site). Used for analytics charts |
| `install_activity` | Grows on every action | Audit log (comments, parser updates, status changes) |
| `users` | Tiny, stable | Just a list of user names |

---

## 3. How Each Table Is Used

### `installs` -- The anchor
- **Written by**: Parser (skeleton), Registration form (fills details), Status form (updates)
- **Read by**: Dashboard table, detail page, analytics (install timeline, heatmap install picker)
- **Verdict**: Essential. Clean design. No issues.

### `site_stage_history` -- The single source of truth
- **Written by**: Parser (one row per site x partner x stage per batch)
- **Read by**: Dashboard API (to derive pipeline_state), analytics heatmap, detail page
- **What it stores**: The ground truth -- "On 2026-04-13, site 243-1196 had 36 frames in Annotate OB with partner Cogito_v2"
- **Verdict**: Core table. Multi-partner support is native. The "current state" of any site's pipeline = latest batch for that site.

### `stage_snapshots` -- Pre-aggregated analytics
- **Written by**: Parser (one row per partner x stage per batch)
- **Read by**: Analytics (partner workload, stage distribution, partner breakdown, data volume)
- **What it stores**: Aggregate numbers -- "Cogito_v2 has 100 tasks across ALL sites in Annotate OB"
- **Verdict**: Mildly redundant (could be derived from site_stage_history with GROUP BY) but defensible for query performance. The `datasets` JSON field is unique to this table.

### `install_activity` -- Audit log
- **Verdict**: Clean audit log. No issues.

### `users` -- Lookup table
- **Verdict**: Simple lookup table. No issues.

---

## 4. Multi-Partner: Now Handled Natively

Here's what happens when site `243-1196` has data with TWO partners for OB:

### What the Slack message says:
```
Cogito_v2
Annotate: 100 tasks (500 frames)
    243-1196 (36 tasks)
    150-936 (64 tasks)
----
Sunix_v2
Annotate: 80 tasks (400 frames)
    243-1196 (20 tasks)
    320-1163 (60 tasks)
```

### What gets stored in `site_stage_history`:
| batch_id | comp_site_id | partner | pipeline_type | stage_name | frames |
|----------|-------------|---------|--------------|------------|--------|
| 2026-04-13T... | 243-1196 | Cogito_v2 | OB | Annotate | 36 |
| 2026-04-13T... | 243-1196 | Sunix_v2 | OB | Annotate | 20 |

Both partners are preserved. No overwriting.

### What the API returns for `pipeline_state`:
```json
{
  "OB": {
    "partners": ["Cogito_v2", "Sunix_v2"],
    "stages": [
      { "partner": "Cogito_v2", "stage_name": "Annotate", "frames": 36 },
      { "partner": "Sunix_v2", "stage_name": "Annotate", "frames": 20 }
    ],
    "no_data": false
  }
}
```

### What the dashboard shows:
```
OB Pipeline:
  Partners: Cogito_v2, Sunix_v2
  Cogito_v2: Annotate (36)
  Sunix_v2: Annotate (20)
```

---

## 5. What Changed in the Simplification

| Before (old) | After (current) |
|--------------|----------------|
| 7 tables (including `pipelines`, `pipeline_stages`) | 5 tables |
| Parser creates `pipeline_stages` rows, deactivates old ones, updates `data_status` | Parser only writes to `site_stage_history` + `stage_snapshots` |
| Dashboard API reads `pipelines` -> `pipeline_stages`, then overrides tasks from `site_stage_history` | Dashboard API reads directly from `site_stage_history` latest batch |
| `all_partners` computed as workaround from history | Partners come naturally from history (no workaround needed) |
| `data_status` is a stored flag requiring sync logic | "No data" = site not in latest batch (computed on read) |
| `pipeline_stages` grows with dead `active: false` rows | No dead rows. History is append-only by design |
| Parser transaction: 6 steps with deactivation + data_status update | Parser transaction: 2 steps (write history + snapshots) |
| `pipelines.partner` single field, last-write-wins | Multiple partners per site per type handled natively |
| `noDataPipelines` KPI (counted pipelines) | `noDataCount` KPI (counts installs) |

---

## 6. Summary

| Component | Status |
|-----------|--------|
| `installs` table | Essential, well-designed |
| `pipelines` table | DROPPED -- was broken for multi-partner |
| `pipeline_stages` table | DROPPED -- was redundant with `site_stage_history` |
| `stage_snapshots` table | Kept -- useful for analytics performance |
| `site_stage_history` table | The single source of truth for pipeline state |
| `install_activity` table | Clean audit log |
| `users` table | Simple, correct |
| Parser logic | Simplified -- 2-step transaction |
| Dashboard API | Simplified -- reads directly from `site_stage_history` |
