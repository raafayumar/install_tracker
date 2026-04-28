/**
 * React Query hooks for analytics data.
 *
 * - useKpis()       — fetches top-level KPI metrics (active installs, completed, avg days, no-data count)
 * - useSnapshots()  — fetches stage_snapshots (aggregate partner-level data for line/bar charts)
 * - useSiteHistory() — fetches site_stage_history (per-site data for heatmap and pipeline state)
 *
 * HOW TO MODIFY:
 * - To add a new analytics endpoint, create a new hook following the same pattern.
 * - Snapshot data comes from stage_snapshots table (pre-aggregated by parser).
 * - Site history is the raw per-site, per-partner data — the source of truth.
 */

"use client";

import { useQuery } from "@tanstack/react-query";
import { KpiData, StageSnapshot, SiteStageHistory } from "@/types";

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}`);
  return res.json();
}

export function useKpis() {
  return useQuery<KpiData>({
    queryKey: ["analytics", "kpis"],
    queryFn: () => fetchJson("/api/analytics/kpis"),
  });
}

export function useSnapshots(pipeline?: string) {
  const params = pipeline && pipeline !== "All" ? `?pipeline=${pipeline}` : "";
  return useQuery<StageSnapshot[]>({
    queryKey: ["analytics", "snapshots", pipeline],
    queryFn: () => fetchJson(`/api/analytics/snapshots${params}`),
  });
}

export function useSiteHistory(compSiteId?: string, pipeline?: string) {
  const params = new URLSearchParams();
  if (compSiteId) params.set("comp_site_id", compSiteId);
  if (pipeline && pipeline !== "All") params.set("pipeline", pipeline);

  return useQuery<SiteStageHistory[]>({
    queryKey: ["analytics", "site-history", compSiteId, pipeline],
    queryFn: () => fetchJson(`/api/analytics/site-history?${params.toString()}`),
  });
}
