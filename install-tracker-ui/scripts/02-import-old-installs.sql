-- ============================================================================
-- Import old installs from Raafay's spreadsheet
-- All marked as Complete, region defaults to US, no jira_link.
-- Start dates that were missing default to 2026-02-20.
--
-- Run this AFTER 01-extract-and-migrate.sql
-- ============================================================================

-- Upsert each install (some may already exist from parser).
-- ON CONFLICT: fill in missing details without overwriting parser-created data.

INSERT INTO installs (
  comp_site_id, site_name, install_type, region, status,
  general_od_model, general_ppe_model, ob_deployed, ppe_deployed,
  start_date, end_date, created_at
) VALUES
  -- 1. 950-978 Finning - Centro Logistico Antofagasta
  ('950-978', 'Finning - Centro Logistico Antofagasta', 'New Site', 'US', 'Complete',
   false, false, true, true,
   '2026-02-20', '2026-03-01', NOW()),

  -- 2. 150-935 P&G - Cairo - 3
  ('150-935', 'P&G - Cairo - 3', 'New Site', 'US', 'Complete',
   false, true, true, false,
   '2026-02-20', '2026-03-01', NOW()),

  -- 3. 433-977 ENI - Cote d'Ivoire
  ('433-977', 'ENI - Cote d''Ivoire', 'New Site', 'US', 'Complete',
   false, false, true, true,
   '2026-02-20', '2026-03-01', NOW()),

  -- 4. 429-998 3M - Aberdeen
  ('429-998', '3M - Aberdeen', 'AddOn', 'US', 'Complete',
   false, false, true, true,
   '2026-02-20', '2026-03-01', NOW()),

  -- 5. 672-1038 FedEx US - Hagerstown 3
  ('672-1038', 'FedEx US - Hagerstown 3', 'New Site', 'US', 'Complete',
   true, false, false, true,
   '2026-02-26', '2026-03-09', NOW()),

  -- 6. 505-764 UPS - Velocity
  ('505-764', 'UPS - Velocity', 'AddOn', 'US', 'Complete',
   false, false, true, true,
   '2026-02-18', '2026-03-09', NOW()),

  -- 7. 429-991 3M - DeKalb Dk5
  ('429-991', '3M - DeKalb Dk5', 'New Site', 'US', 'Complete',
   true, true, false, false,
   '2026-02-18', '2026-03-10', NOW()),

  -- 8. 672-1042 FedEx US - Memphis 2
  ('672-1042', 'FedEx US - Memphis 2', 'New Site', 'US', 'Complete',
   true, true, false, false,
   '2026-02-24', '2026-03-10', NOW()),

  -- 9. 672-1043 FedEx US - Memphis 3
  ('672-1043', 'FedEx US - Memphis 3', 'New Site', 'US', 'Complete',
   true, true, false, false,
   '2026-02-24', '2026-03-10', NOW()),

  -- 10. 672-1037 FedEx US - Hagerstown 2
  ('672-1037', 'FedEx US - Hagerstown 2', 'New Site', 'US', 'Complete',
   true, false, false, true,
   '2026-02-25', '2026-03-10', NOW()),

  -- 11. 990-991 GM - Oshawa
  ('990-991', 'GM - Oshawa', 'New Site', 'US', 'Complete',
   false, true, true, false,
   '2026-02-16', '2026-03-11', NOW())

ON CONFLICT (comp_site_id) DO UPDATE SET
  site_name       = COALESCE(NULLIF(installs.site_name, ''), EXCLUDED.site_name),
  install_type    = COALESCE(NULLIF(installs.install_type, ''), EXCLUDED.install_type),
  region          = COALESCE(NULLIF(installs.region, ''), EXCLUDED.region),
  status          = EXCLUDED.status,
  general_od_model  = EXCLUDED.general_od_model,
  general_ppe_model = EXCLUDED.general_ppe_model,
  ob_deployed     = EXCLUDED.ob_deployed,
  ppe_deployed    = EXCLUDED.ppe_deployed,
  start_date      = COALESCE(installs.start_date, EXCLUDED.start_date),
  end_date        = COALESCE(installs.end_date, EXCLUDED.end_date);

-- ============================================================================
-- Model type explanation (from spreadsheet columns):
--
-- The spreadsheet has 4 model columns:
--   "General OD Model"           → general_od_model (bool)
--   "General roi-ppe Model"      → general_ppe_model (bool)
--   "Site-specific OD Model"     → ob_deployed (True = site-specific OD was trained & deployed)
--   "Site-specific roi-ppe Model"→ ppe_deployed (True = site-specific PPE was trained & deployed)
--
-- Logic:
--   If general_od_model=True  → used general OD model (no site-specific training needed)
--   If ob_deployed=True       → trained site-specific OD model and deployed it
--   Same pattern for PPE side.
-- ============================================================================

-- Verify import
SELECT comp_site_id, site_name, status, start_date, end_date,
       general_od_model, general_ppe_model, ob_deployed, ppe_deployed
FROM installs
WHERE comp_site_id IN (
  '950-978','150-935','433-977','429-998','672-1038',
  '505-764','429-991','672-1042','672-1043','672-1037','990-991'
)
ORDER BY comp_site_id;
