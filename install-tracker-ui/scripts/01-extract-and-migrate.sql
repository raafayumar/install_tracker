-- ============================================================================
-- STEP 1: EXTRACT existing pipelines/pipeline_stages data as backup
-- Run this FIRST to preserve data before dropping tables.
-- ============================================================================

-- Export current pipelines data to a backup table
CREATE TABLE IF NOT EXISTS _backup_pipelines AS
SELECT * FROM pipelines;

-- Export current pipeline_stages data to a backup table
CREATE TABLE IF NOT EXISTS _backup_pipeline_stages AS
SELECT * FROM pipeline_stages;

-- Verify backup row counts
SELECT 'pipelines backup' AS what, COUNT(*) AS rows FROM _backup_pipelines
UNION ALL
SELECT 'pipeline_stages backup', COUNT(*) FROM _backup_pipeline_stages
UNION ALL
SELECT 'site_stage_history (kept)', COUNT(*) FROM site_stage_history
UNION ALL
SELECT 'stage_snapshots (kept)', COUNT(*) FROM stage_snapshots;

-- ============================================================================
-- STEP 2: DROP the redundant tables
-- The FK from pipeline_stages → pipelines means we drop stages first.
-- ============================================================================

DROP TABLE IF EXISTS pipeline_stages CASCADE;
DROP TABLE IF EXISTS pipelines CASCADE;

-- ============================================================================
-- STEP 3: Verify everything else is intact
-- ============================================================================

SELECT 'installs' AS table_name, COUNT(*) AS rows FROM installs
UNION ALL
SELECT 'site_stage_history', COUNT(*) FROM site_stage_history
UNION ALL
SELECT 'stage_snapshots', COUNT(*) FROM stage_snapshots
UNION ALL
SELECT 'install_activity', COUNT(*) FROM install_activity
UNION ALL
SELECT 'users', COUNT(*) FROM users;

-- Done! The backup tables (_backup_pipelines, _backup_pipeline_stages) remain
-- in the DB in case you ever need to reference the old data.
-- You can drop them later with:
--   DROP TABLE _backup_pipelines;
--   DROP TABLE _backup_pipeline_stages;
