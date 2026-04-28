/**
 * Dashboard install table — main data grid showing all installs.
 *
 * Pipeline state now comes from `install.pipeline_state` (derived from site_stage_history)
 * instead of the old `install.pipelines` array. This correctly handles:
 *   - Multiple partners per pipeline type
 *   - Per-site frame counts (not aggregates)
 *   - "No data" detection (pipeline_state is null or missing)
 */

"use client";

import Link from "next/link";
import { ArrowUpDown } from "lucide-react";
import { Install, PipelineTypeState } from "@/types";
import { StatusBadge, RegionBadge, TypeBadge, PartnerBadge, StageBadge, NoDataBadge, DeployedBadge } from "@/components/ui/badge";
import { formatDate, daysToComplete, generateAutoSummary, sortByStatus } from "@/lib/utils";
import { useState } from "react";

interface InstallTableProps {
  installs: Install[];
  showOwner: boolean;
}

type SortKey = "id" | "status" | "start" | "days";

export function InstallTable({ installs, showOwner }: InstallTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("status");
  const [sortAsc, setSortAsc] = useState(true);

  const sorted = [...installs].sort((a, b) => {
    let cmp = 0;
    switch (sortKey) {
      case "status": cmp = sortByStatus(a, b); break;
      case "id": cmp = a.comp_site_id.localeCompare(b.comp_site_id); break;
      case "start": cmp = new Date(a.start_date).getTime() - new Date(b.start_date).getTime(); break;
      case "days": cmp = (daysToComplete(a) ?? 999) - (daysToComplete(b) ?? 999); break;
    }
    return sortAsc ? cmp : -cmp;
  });

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(true); }
  };

  return (
    <div className="rounded-[12px] border border-border overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[rgba(0,0,0,0.3)]">
              <SortTh label="ID" sortKey="id" current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <Th>Name</Th>
              {showOwner && <Th>Owner</Th>}
              <Th>Type</Th>
              <Th>Region</Th>
              <SortTh label="Status" sortKey="status" current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <Th>OB Pipeline</Th>
              <Th>PPE Pipeline</Th>
              <Th>OB Model</Th>
              <Th>PPE Model</Th>
              <SortTh label="Start" sortKey="start" current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <SortTh label="Days" sortKey="days" current={sortKey} asc={sortAsc} onSort={toggleSort} />
              <Th>Summary</Th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((install) => {
              const obState = install.pipeline_state?.OB ?? null;
              const ppeState = install.pipeline_state?.PPE ?? null;
              const days = daysToComplete(install);

              return (
                <tr
                  key={install.comp_site_id}
                  className="border-b border-dashed border-border bg-card hover:bg-card-hi transition-colors"
                >
                  {/* ID */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/install/${install.comp_site_id}`}
                      className="text-sky-500 font-bold hover:underline"
                    >
                      {install.comp_site_id}
                    </Link>
                  </td>

                  {/* Name */}
                  <td className="px-4 py-3 text-text-primary font-medium max-w-[180px] truncate">
                    {install.site_name || "—"}
                  </td>

                  {/* Owner */}
                  {showOwner && (
                    <td className="px-4 py-3 text-text-secondary font-medium">{install.owner_name}</td>
                  )}

                  {/* Type */}
                  <td className="px-4 py-3"><TypeBadge type={install.install_type} /></td>

                  {/* Region */}
                  <td className="px-4 py-3"><RegionBadge region={install.region} /></td>

                  {/* Status */}
                  <td className="px-4 py-3"><StatusBadge status={install.status} /></td>

                  {/* OB Pipeline — shows all partners + their stages */}
                  <td className="px-4 py-3">
                    <PipelineCell state={obState} />
                  </td>

                  {/* PPE Pipeline */}
                  <td className="px-4 py-3">
                    <PipelineCell state={ppeState} />
                  </td>

                  {/* OB Model — only show "Site-Specific" when Complete or general is explicitly set */}
                  <td className="px-4 py-3">
                    <ModelCell general={install.general_od_model} deployed={install.ob_deployed} status={install.status} />
                  </td>

                  {/* PPE Model */}
                  <td className="px-4 py-3">
                    <ModelCell general={install.general_ppe_model} deployed={install.ppe_deployed} status={install.status} />
                  </td>

                  {/* Start */}
                  <td className="px-4 py-3 text-text-tertiary text-xs whitespace-nowrap">
                    {formatDate(install.start_date)}
                  </td>

                  {/* Days */}
                  <td className="px-4 py-3 text-text-tertiary text-xs text-center">
                    {days !== null ? days : "—"}
                  </td>

                  {/* Summary */}
                  <td className="px-4 py-3 text-text-secondary text-xs max-w-[160px] truncate">
                    {generateAutoSummary(install)}
                  </td>
                </tr>
              );
            })}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={showOwner ? 13 : 12} className="px-4 py-12 text-center text-text-tertiary">
                  No installs found matching your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/**
 * Renders the pipeline state for one pipeline type (OB or PPE).
 * Shows all partners and their stages with per-site frame counts.
 * If state is null → no pipeline data exists at all (show dash).
 * If state.no_data → the pipeline existed but has no data in latest batch.
 */
function PipelineCell({ state }: { state: PipelineTypeState | null }) {
  // No pipeline data at all for this type
  if (!state) return <span className="text-text-tertiary text-xs">—</span>;

  // Pipeline exists but no_data in latest batch
  if (state.no_data || state.stages.length === 0) {
    return (
      <div className="flex flex-col gap-1">
        {state.partners.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {state.partners.map((p) => <PartnerBadge key={p} partner={p} />)}
          </div>
        )}
        <div className="flex flex-wrap gap-1 mt-0.5">
          <NoDataBadge />
        </div>
      </div>
    );
  }

  // Group stages by partner for clean display
  const byPartner = new Map<string, typeof state.stages>();
  for (const s of state.stages) {
    if (!byPartner.has(s.partner)) byPartner.set(s.partner, []);
    byPartner.get(s.partner)!.push(s);
  }

  return (
    <div className="flex flex-col gap-1.5">
      {[...byPartner.entries()].map(([partner, stages]) => (
        <div key={partner} className="flex flex-col gap-0.5">
          <PartnerBadge partner={partner} />
          <div className="flex flex-wrap gap-1 mt-0.5">
            {stages.map((s, i) => (
              <StageBadge key={`${s.stage_name}-${i}`} stage={s.stage_name} tasks={s.frames} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Model cell — shows General/Site-Specific label.
 * Only displays model type when status is Complete or general flag is explicitly true.
 * Otherwise shows "—" to avoid misleading "Site-Specific" on in-progress installs.
 */
function ModelCell({ general, deployed, status }: { general: boolean; deployed: boolean; status: string }) {
  const showModelType = status === "Complete" || general;
  if (!showModelType && !deployed) {
    return <span className="text-text-tertiary text-xs">—</span>;
  }
  return (
    <div className="flex flex-col gap-1">
      {showModelType ? (
        <span className={`text-xs font-bold ${general ? "text-sky-500" : "text-semantic-yellow"}`}>
          {general ? "General" : "Site-Specific"}
        </span>
      ) : (
        <span className="text-text-tertiary text-xs">—</span>
      )}
      {deployed && <DeployedBadge />}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-text-tertiary whitespace-nowrap">
      {children}
    </th>
  );
}

function SortTh({
  label, sortKey, current, asc, onSort,
}: {
  label: string; sortKey: SortKey; current: SortKey; asc: boolean; onSort: (k: SortKey) => void;
}) {
  const isActive = current === sortKey;
  return (
    <th
      className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-text-tertiary whitespace-nowrap cursor-pointer hover:text-sky-500 transition-colors"
      onClick={() => onSort(sortKey)}
    >
      <span className="flex items-center gap-1">
        {label}
        <ArrowUpDown size={12} className={isActive ? "text-sky-500" : "opacity-30"} />
      </span>
    </th>
  );
}
