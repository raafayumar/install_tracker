// ── Enums ────────────────────────────────────────────────────────────────────

export type InstallStatus = "In-progress" | "Complete" | "On Hold" | "Cancelled";
export type InstallType = "New Site" | "AddOn";
export type Region = "US" | "EU" | "CA" | "Tesla" | "Asia";
export type PipelineType = "OB" | "PPE";
export type ActivityType = "STAGE_UPDATE" | "COMMENT" | "SUMMARY" | "PARSER_UPDATE";
export type StageName = "Annotate" | "Review" | "Protex Review";

// ── Core models ─────────────────────────────────────────────────────────────

export interface User {
  name: string;
}

/**
 * Master install record. One per customer site.
 * Pipeline state is NOT stored here — it's derived from site_stage_history at query time.
 */
export interface Install {
  comp_site_id: string;
  site_name: string;
  owner_name: string;
  install_type: InstallType;
  region: Region;
  status: InstallStatus;
  jira_link: string | null;
  start_date: string;
  end_date: string | null;
  general_od_model: boolean;
  general_ppe_model: boolean;
  ob_deployed: boolean;
  ppe_deployed: boolean;
  created_at: string;
  /** Current pipeline state — derived from latest batch in site_stage_history */
  pipeline_state?: PipelineState;
  /** Latest user comment on this install (null if none) */
  latest_comment?: { message: string | null; user_name: string | null; created_at: string } | null;
}

// ── Pipeline state (derived, not stored) ────────────────────────────────────

/**
 * The current pipeline state for a single install, derived from the latest
 * batch in site_stage_history. Grouped by pipeline_type → partner → stages.
 *
 * Example:
 *   OB: { partners: ["Cogito_v2"], stages: [{ partner: "Cogito_v2", stage_name: "Annotate", frames: 36 }] }
 *   PPE: { partners: ["Sunix-ppe"], stages: [{ partner: "Sunix-ppe", stage_name: "Review", frames: 20 }] }
 */
export interface PipelineState {
  OB: PipelineTypeState | null;
  PPE: PipelineTypeState | null;
}

export interface PipelineTypeState {
  /** All unique partners for this pipeline type (can be multiple simultaneously) */
  partners: string[];
  /** All active stage entries (one per partner × stage combo) */
  stages: StageEntry[];
  /** True if this pipeline type has no data in the latest batch */
  no_data: boolean;
}

/** A single stage entry from site_stage_history — one partner's data for one stage */
export interface StageEntry {
  partner: string;
  stage_name: StageName;
  frames: number | null;
}

// ── Analytics models ────────────────────────────────────────────────────────

/** Aggregate snapshot — one row per partner × pipeline × stage per batch (for charts) */
export interface StageSnapshot {
  id: number;
  batch_id: string;
  batch_date: string;
  partner: string;
  pipeline_type: PipelineType;
  stage_name: StageName;
  tasks: number;
  frames: number;
}

/** Per-site history row — source of truth for pipeline state */
export interface SiteStageHistory {
  id: number;
  batch_id: string;
  batch_date: string;
  comp_site_id: string;
  partner: string;
  pipeline_type: PipelineType;
  stage_name: StageName;
  frames: number | null;
}

// ── Activity & KPIs ─────────────────────────────────────────────────────────

export interface InstallActivity {
  id: number;
  comp_site_id: string;
  activity_type: ActivityType;
  user_name: string;
  message: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface KpiData {
  activeInstalls: number;
  completed: number;
  avgDaysToComplete: number;
  /** Count of installs with at least one pipeline type having no data */
  noDataCount: number;
}

// ── Parser types ────────────────────────────────────────────────────────────

export interface ParsedStage {
  stage_name: StageName;
  tasks: number;
  frames: number;
  datasets: string[];
  dataset_tasks: Record<string, number>;
}

export interface ParsedBlock {
  partner: string;
  pipeline_type: PipelineType;
  stages: ParsedStage[];
}
