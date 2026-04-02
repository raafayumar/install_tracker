# Install Tracker — Project Memory

> Last updated: 2026-03-28

## What Is This App?

A **Streamlit + PostgreSQL** internal tool for tracking computer vision model installs across company sites. Deployed via Docker on a home server at `192.168.0.12`, accessible at `https://installs.innovatewithraafay.com/`.

**Stack**: Python 3.10, Streamlit 1.31, SQLAlchemy 2.0, PostgreSQL 15, Plotly 5.18, Docker Compose.

---

## Architecture

```
install_tracker/
├── app/
│   ├── main.py           # Streamlit entry point, sidebar routing, query param handling
│   ├── dashboard.py      # Main dashboard — overview table + install detail panels
│   ├── admin_view.py     # Admin page — paste Slack messages to parse & process
│   ├── analytics.py      # Plotly analytics dashboard (KPI cards + 4 charts)
│   ├── parser.py         # Slack message parser (supports old + new formats)
│   ├── services.py       # Business logic — process parser results, snapshots, no-data detection
│   ├── models.py         # SQLAlchemy ORM models
│   ├── db.py             # Database connection, session management
│   ├── activity.py       # Activity logging helper
│   └── utils.py          # HTML badge helpers, formatting, computed fields
├── docker/
│   ├── Dockerfile        # Python 3.10-slim, port 8503
│   └── docker-compose.yml # app + postgres:15 services
├── requirements.txt      # streamlit, sqlalchemy, psycopg2-binary, pandas, python-dateutil, plotly
├── sample_slack_msg.txt  # Sample Slack messages for testing (4 messages, newest first)
└── MEMORY.md             # This file
```

---

## Database Schema

### `installs` — Core install records
| Column | Type | Notes |
|--------|------|-------|
| comp_site_id | VARCHAR PK | Format: `150-936` (CompanyID-SiteID) |
| site_name | VARCHAR | e.g. "P&G - Cairo - 4" |
| owner_name | VARCHAR | Assigned team member |
| install_type | VARCHAR | "New Site" or "AddOn" |
| region | VARCHAR | "US", "EU", "Asia" |
| status | VARCHAR | "In-progress", "Complete", "Blocked", "On Hold" |
| jira_link | VARCHAR | Optional Jira ticket URL |
| start_date | DATE | When registered |
| end_date | DATE | Auto-set when marked Complete |
| general_od_model | BOOLEAN | General OD model eval passed |
| general_ppe_model | BOOLEAN | General PPE model eval passed |
| ob_deployed | BOOLEAN | OB model deployed to production |
| ppe_deployed | BOOLEAN | PPE model deployed to production |

### `pipelines` — OB/PPE pipeline per install
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK | Auto |
| comp_site_id | VARCHAR FK→installs | |
| pipeline_type | ENUM(OB,PPE) | |
| partner | VARCHAR | e.g. "Cogito_v2", "Abelling-ppe" |
| data_status | VARCHAR(20) | "active" or "no_data" — set by parser |

### `pipeline_stages` — Current active stage per pipeline
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK | Auto |
| pipeline_id | INT FK→pipelines | |
| stage_name | VARCHAR | "Annotate", "Review", "Protex Review" |
| tasks | INT | Aggregate task count (partner-level) |
| frames | INT | Aggregate frame count (partner-level) |
| active | BOOLEAN | Only latest batch's stages are active |

### `stage_snapshots` — Immutable historical snapshots (partner+stage aggregate)
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK | Auto |
| batch_id | VARCHAR | UTC timestamp string, e.g. "2026-03-28T09:00:00Z" |
| partner | VARCHAR | |
| pipeline_type | ENUM(OB,PPE) | |
| stage_name | VARCHAR | |
| tasks | INT | |
| frames | INT | |
| datasets | JSON | List of comp_site_ids in this stage |
| created_at | DATETIME | |

### `site_stage_history` — Immutable per-site stage presence history
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK | Auto |
| batch_id | VARCHAR | Same batch_id as stage_snapshots |
| comp_site_id | VARCHAR | |
| partner | VARCHAR | |
| pipeline_type | ENUM(OB,PPE) | |
| stage_name | VARCHAR | |
| frames | INT nullable | Per-site task count (new Slack format only) |
| created_at | DATETIME | |

### `install_activity` — Activity log (comments, parser updates, etc.)
| Column | Type | Notes |
|--------|------|-------|
| id | INT PK | Auto |
| comp_site_id | VARCHAR FK→installs | |
| activity_type | ENUM | stage_update, comment, summary, parser_update |
| user_name | VARCHAR | |
| message | TEXT | |
| metadata | JSON | |
| created_at | DATETIME | |

---

## Key Business Logic (`services.py`)

### `process_parser_results(session, parsed_blocks)`
1. Generates a `batch_id` (UTC timestamp) per update
2. Saves **StageSnapshot** rows (immutable, aggregate per partner+stage)
3. Saves **SiteStageHistory** rows (immutable, per-site presence + task count)
4. Inserts new **PipelineStage** rows (active=True)
5. **Deactivates old stages**: tracks new stage IDs, deactivates ALL others per pipeline
6. **No-data detection**: pipelines NOT mentioned in update → `data_status = "no_data"`
7. **Cleanup**: deletes snapshots older than 30 days

### Pipeline Type Detection
- Partner name contains `-ppe` → PPE pipeline
- Otherwise → OB pipeline

### Partner Names (from Slack)
`Cogito_v2`, `Cogito-ppe`, `Sunix_v2`, `Sunix-ppe`, `Abelling_v2`, `Abelling-ppe`, `Abelling`

---

## Slack Message Formats

The parser (`parser.py`) handles **two formats**:

### Old Format (pre-March 13, 2026)
```
Sunix_v2
Protex Review: 640 tasks (17510 frames)
     datasets: 672-1036, 151-274, 320-1078
```

### New Format (March 13+ 2026)
```
Sunix_v2
Protex Review: 36 tasks (1000 frames)
     151-274 (36 tasks)
```
- No `datasets:` prefix
- Per-site task counts: `151-274 (36 tasks)`
- New "Annotation task lifetime" section (skipped by parser)
- "Total tasks to annotate" lines (skipped)

---

## Dashboard Features

### Overview Table (Both "All" and Individual views)
- **Column order**: ID (clickable link), Name, (Owner if All), Type, Region, OB Partner, PPE Partner, OB Stage, PPE Stage, OB Model, PPE Model, Start, Days, Summary
- **Sorted**: Complete → Blocked/On Hold → In-progress
- **Clickable IDs**: `?view=Raafay&install=150-936` — preserves sidebar view
- **Model column**: Shows "General" (blue), "Site-Specific" (green), with ✅ if deployed
- **Stage column**: Shows per-site task counts like "Protex Review (200)"
- **No-data badge**: Orange "⚠ No New Data" when pipeline drops from Slack update

### Detail Panel (Individual user view only)
- **Selectbox navigation** — pre-selects from query params
- **Frozen info header** — ID, Name, Owner, Type, Region, Jira, Start/End dates (admin-editable)
- **Editable form** — Status, General Model checkboxes, Deployment checkboxes
- **Pipeline snapshot** — OB and PPE columns with partner badge + active stages with task counts
- **Comments** — Shown by default with inline display of recent comments
- **Stage History** — Collapsible table from SiteStageHistory
- **Activity History** — Collapsible full activity log

### Analytics Page (`📊 Analytics` in sidebar)
4 Plotly charts + KPI cards:
1. **KPI Cards**: Active installs, Completed, Avg Days to Complete, No-Data Pipelines
2. **Partner Workload Trend** — Line chart (tasks/frames over time per partner)
3. **Stage Distribution Over Time** — Stacked bar (tasks per stage per day)
4. **Current Partner × Stage Breakdown** — Grouped bar (latest batch)
5. **Install Data Presence Timeline** — Heatmap per selected install

---

## Deployment

### Docker (on server at 192.168.0.12)
```bash
cd ~/apps/install_tracker/docker
docker compose build app
docker compose up -d
```

### Database Connection
```
postgresql://install_tracker:install_tracker@db:5432/install_tracker
```
Port 5433 exposed on host for direct DB access.

### Useful DB Commands
```bash
# Connect to DB
docker exec -it install_tracker_db psql -U install_tracker -d install_tracker

# Clear parsed data for re-testing
docker exec -it install_tracker_db psql -U install_tracker -d install_tracker -c "
DELETE FROM stage_snapshots;
DELETE FROM site_stage_history;
DELETE FROM pipeline_stages;
DELETE FROM install_activity;
UPDATE pipelines SET data_status = 'active';
"
```

---

## Users & Access
- **Raafay** — Primary user, manages installs
- **Alex** — Team member
- Admin features gated behind "All" view or "— Admin Update —" sidebar option
- Team members managed via sidebar expander

---

## What's Been Done (Chronological)

### Session 1 (March 14, 2026)
- Built initial UI with color-coded badges (type, region, status, partner)
- Added install registration form with region dropdown
- Separated frozen (admin-only) info from editable fields
- Cleaned up detail panels

### Session 2 (March 24, 2026)
- **Data model**: Added `StageSnapshot`, `SiteStageHistory`, `Pipeline.data_status`
- **Snapshot system**: Reworked `process_parser_results` for immutable history
- **No-data detection**: Pipelines absent from update → "no_data" badge
- **Analytics page**: Created with 4 Plotly charts
- **Routing**: Added Analytics to sidebar

### Session 3 (March 27-28, 2026)
- **Fixed stage deactivation bug**: Only keeps stages from current batch
- **Fixed no-data display**: Shows clean badge, not stale stages
- **Updated parser**: Handles new Slack format with per-site task counts
- **Per-site task display**: Shows counts in overview table and detail panel
- **UI overhaul**:
  - Sorted installs by status (Complete first)
  - Consolidated 4 model columns → 2 (with deployed ✅ indicator)
  - Replaced tabs with selectbox for install selection
  - Made IDs clickable links (query param navigation)
  - Added Start Date + Days columns
  - Comments shown by default with inline display

---

## Known Issues / Future Work
- **Lint errors are false positives** — Pyre2 can't resolve imports because packages are in Docker, not on the network share
- **Per-site frame counts**: `SiteStageHistory.frames` stores per-site task counts for new format, NULL for old. Column named `frames` for legacy reasons but really stores task counts
- **Batch/frame tracking**: Slack messages will eventually include per-site frame counts — schema already has the column ready
- **Analytics dashboard uses dark theme** (`plotly_dark` template) — matches Streamlit dark theme
- **30-day rolling window**: `cleanup_old_snapshots` deletes snapshot data older than 30 days
