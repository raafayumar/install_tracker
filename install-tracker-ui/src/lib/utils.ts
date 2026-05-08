/**
 * Shared utility functions and color constants used across the app.
 *
 * HOW TO MODIFY:
 * - To add a new partner color: add an entry to PARTNER_COLORS below.
 *   The key must match the partner name exactly (e.g., "NewPartner_v2").
 *   The getPartnerColor() function also tries stripping _v2/-ppe suffixes as fallback.
 *
 * - To add a new status/region/type: add to the corresponding COLORS map AND
 *   the matching TypeScript type in types/index.ts.
 *
 * - To change how the auto-summary works (shown in dashboard table), edit generateAutoSummary().
 */

import { Install, InstallStatus, Region, InstallType, PipelineType, StageName } from "@/types";

// ---------- Badge color maps ----------

export const STATUS_COLORS: Record<InstallStatus, { bg: string; text: string; dot: string }> = {
  "In-progress": { bg: "rgba(245, 166, 35, 0.12)", text: "#f5a623", dot: "#f5a623" },
  "Complete": { bg: "rgba(34, 197, 94, 0.12)", text: "#22c55e", dot: "#22c55e" },
  "On Hold": { bg: "rgba(240, 82, 82, 0.12)", text: "#f05252", dot: "#f05252" },
  "Cancelled": { bg: "rgba(255, 255, 255, 0.06)", text: "rgba(255,255,255,0.45)", dot: "rgba(255,255,255,0.35)" },
};

export const REGION_COLORS: Record<Region, { bg: string; text: string }> = {
  US: { bg: "rgba(34, 197, 94, 0.12)", text: "#22c55e" },
  EU: { bg: "rgba(0, 160, 242, 0.12)", text: "#00a0f2" },
  CA: { bg: "rgba(240, 82, 82, 0.12)", text: "#f05252" },
  Tesla: { bg: "rgba(244, 63, 94, 0.12)", text: "#fb7185" },
  Asia: { bg: "rgba(245, 166, 35, 0.12)", text: "#f5a623" },
};

export const TYPE_COLORS: Record<InstallType, { bg: string; text: string }> = {
  "New Site": { bg: "rgba(0, 160, 242, 0.12)", text: "#00a0f2" },
  AddOn: { bg: "rgba(192, 38, 211, 0.12)", text: "#c026d3" },
};

export const PARTNER_COLORS: Record<string, { bg: string; text: string }> = {
  Cogito: { bg: "rgba(99, 102, 241, 0.12)", text: "#6366f1" },
  Cogito_v2: { bg: "rgba(99, 102, 241, 0.12)", text: "#6366f1" },
  "Cogito-ppe": { bg: "rgba(99, 102, 241, 0.12)", text: "#818cf8" },
  Sunix: { bg: "rgba(8, 145, 178, 0.12)", text: "#0891b2" },
  Sunix_v2: { bg: "rgba(8, 145, 178, 0.12)", text: "#0891b2" },
  "Sunix-ppe": { bg: "rgba(8, 145, 178, 0.12)", text: "#22d3ee" },
  Abelling: { bg: "rgba(192, 38, 211, 0.12)", text: "#c026d3" },
  Abelling_v2: { bg: "rgba(192, 38, 211, 0.12)", text: "#c026d3" },
  "Abelling-ppe": { bg: "rgba(192, 38, 211, 0.12)", text: "#e879f9" },
  Bants: { bg: "rgba(245, 158, 11, 0.12)", text: "#f59e0b" },
};

export const STAGE_COLORS: Record<StageName, { bg: string; text: string }> = {
  Annotate: { bg: "rgba(0, 160, 242, 0.12)", text: "#00a0f2" },
  Review: { bg: "rgba(245, 166, 35, 0.12)", text: "#f5a623" },
  "Protex Review": { bg: "rgba(34, 197, 94, 0.12)", text: "#22c55e" },
};

export const PIPELINE_COLORS: Record<PipelineType, { bg: string; text: string }> = {
  OB: { bg: "rgba(0, 160, 242, 0.12)", text: "#00a0f2" },
  PPE: { bg: "rgba(245, 166, 35, 0.12)", text: "#f5a623" },
};

// ---------- Computed fields ----------

export function computeSiteSpecific(install: Install, modelType: "od" | "ppe"): boolean | null {
  if (install.status !== "Complete") return null;
  return modelType === "od" ? !install.general_od_model : !install.general_ppe_model;
}

export function generateAutoSummary(install: Install): string {
  if (install.status === "On Hold") return "On Hold";
  if (install.status === "Cancelled") return "Cancelled";
  if (install.status !== "Complete") return "In Progress";

  const parts: string[] = [];
  if (install.general_od_model) parts.push("General OD");
  else parts.push("Site-Specific OD");
  if (install.general_ppe_model) parts.push("General PPE");
  else parts.push("Site-Specific PPE");
  return parts.join(" + ");
}

export function daysToComplete(install: Install): number | null {
  if (!install.start_date || !install.end_date) return null;
  const start = new Date(install.start_date);
  const end = new Date(install.end_date);
  return Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
}

export function modelDisplay(isGeneral: boolean, isDeployed: boolean): { label: string; deployed: boolean } {
  return {
    label: isGeneral ? "General" : "Site-Specific",
    deployed: isDeployed,
  };
}

// ---------- Formatting ----------

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export function formatDateTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("en-US", {
    year: "numeric", month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });
}

// ---------- Status display names ----------

/**
 * Maps DB status values → UI display labels.
 * DB stores "On Hold" and "Complete"; UI shows "Blocked" and "Done".
 * To change a display name, edit this map. StatusBadge and filter pills use it automatically.
 */
export const STATUS_DISPLAY: Partial<Record<InstallStatus, string>> = {
  "On Hold": "Blocked",
  "Complete": "Done",
};

/** Returns the UI display name for a status (falls back to the raw DB value). */
export function getStatusDisplay(status: InstallStatus): string {
  return STATUS_DISPLAY[status] ?? status;
}

// ---------- Status sort ----------

const STATUS_SORT_ORDER: Record<string, number> = {
  "In-progress": 0,
  "On Hold": 1,
  Complete: 2,
  Cancelled: 3,
};

export function sortByStatus(a: Install, b: Install): number {
  return (STATUS_SORT_ORDER[a.status] ?? 99) - (STATUS_SORT_ORDER[b.status] ?? 99);
}

export function getPartnerColor(partner: string): { bg: string; text: string } {
  if (partner in PARTNER_COLORS) return PARTNER_COLORS[partner];
  // Fallback: try base name
  const base = partner.replace(/_v\d+$/, "").replace(/-ppe$/, "");
  if (base in PARTNER_COLORS) return PARTNER_COLORS[base];
  return { bg: "rgba(255,255,255,0.06)", text: "rgba(255,255,255,0.62)" };
}
