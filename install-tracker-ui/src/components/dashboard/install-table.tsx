/**
 * Dashboard install table — main data grid showing all installs.
 *
 * Sort order (fixed, not user-adjustable):
 *   1. In-progress  → sorted by created_at DESC (newest first)
 *   2. On Hold      → sorted by created_at DESC
 *   3. Complete     → sorted by end_date DESC (most recently completed first)
 *   4. Cancelled    → sorted by created_at DESC
 *
 * Status display: DB stores "On Hold" / "Complete"; UI shows "Blocked" / "Done".
 * See lib/utils.ts → STATUS_DISPLAY to change labels.
 *
 * Pipeline state comes from `install.pipeline_state` (derived from site_stage_history)
 * — correctly handles multiple partners per pipeline type and per-site frame counts.
 *
 * HOW TO MODIFY:
 * - To add a column: add a <Th> in thead, a <td> in the row, and update the colSpan in the empty-state row.
 * - To change sort order: edit the `sorted` computation below.
 * - To change comment display (author, date format): edit the "Latest Comment" td block.
 */

"use client";

import Link from "next/link";
import { Install, PipelineTypeState } from "@/types";
import { StatusBadge, RegionBadge, TypeBadge, PartnerBadge, StageBadge, NoDataBadge, DeployedBadge } from "@/components/ui/badge";
import { formatDate, daysToComplete } from "@/lib/utils";

interface InstallTableProps {
  installs: Install[];
  showOwner: boolean;
}

/** Fixed sort: groups by status priority, then within each group by date (DESC). */
const STATUS_GROUP_ORDER: Record<string, number> = {
  "In-progress": 0,
  "On Hold": 1,
  "Complete": 2,
  "Cancelled": 3,
};

function sortInstalls(a: Install, b: Install): number {
  const groupA = STATUS_GROUP_ORDER[a.status] ?? 99;
  const groupB = STATUS_GROUP_ORDER[b.status] ?? 99;

  // Primary: group order
  if (groupA !== groupB) return groupA - groupB;

  // Secondary: Complete installs sorted by end_date DESC (latest completed on top)
  if (a.status === "Complete") {
    const endA = a.end_date ? new Date(a.end_date).getTime() : 0;
    const endB = b.end_date ? new Date(b.end_date).getTime() : 0;
    return endB - endA;
  }

  // All other groups: sorted by created_at DESC (newest first)
  return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
}

export function InstallTable({ installs, showOwner }: InstallTableProps) {
  const sorted = [...installs].sort(sortInstalls);

  return (
    <div className="rounded-[12px] border border-border overflow-hidden shadow-[var(--shadow-sm)]">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-[rgba(0,0,0,0.3)]">
              <Th>ID</Th>
              <Th>Name</Th>
              {showOwner && <Th>Owner</Th>}
              <Th>Type</Th>
              <Th>Region</Th>
              <Th>Status</Th>
              {/* Narrower pipeline columns — they stack partner + stage badges vertically */}
              <Th width={160}>OB Pipeline</Th>
              <Th width={160}>PPE Pipeline</Th>
              <Th>OB Model</Th>
              <Th>PPE Model</Th>
              <Th>Start</Th>
              <Th>Days</Th>
              {/* Wider comments column so messages aren't too truncated */}
              <Th width={260}>Latest Comment</Th>
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

                  {/* Owner (only in All view) */}
                  {showOwner && (
                    <td className="px-4 py-3 text-text-secondary font-medium">{install.owner_name}</td>
                  )}

                  {/* Type */}
                  <td className="px-4 py-3"><TypeBadge type={install.install_type} /></td>

                  {/* Region */}
                  <td className="px-4 py-3"><RegionBadge region={install.region} /></td>

                  {/* Status — badge displays "Blocked"/"Done" via getStatusDisplay() */}
                  <td className="px-4 py-3"><StatusBadge status={install.status} /></td>

                  {/* OB Pipeline */}
                  <td className="px-4 py-3" style={{ maxWidth: 160 }}>
                    <PipelineCell state={obState} />
                  </td>

                  {/* PPE Pipeline */}
                  <td className="px-4 py-3" style={{ maxWidth: 160 }}>
                    <PipelineCell state={ppeState} />
                  </td>

                  {/* OB Model — only shown when Complete or general flag is true */}
                  <td className="px-4 py-3">
                    <ModelCell general={install.general_od_model} deployed={install.ob_deployed} status={install.status} />
                  </td>

                  {/* PPE Model */}
                  <td className="px-4 py-3">
                    <ModelCell general={install.general_ppe_model} deployed={install.ppe_deployed} status={install.status} />
                  </td>

                  {/* Start date */}
                  <td className="px-4 py-3 text-text-tertiary text-xs whitespace-nowrap">
                    {formatDate(install.start_date)}
                  </td>

                  {/* Days to complete */}
                  <td className="px-4 py-3 text-text-tertiary text-xs text-center">
                    {days !== null ? days : "—"}
                  </td>

                  {/* Latest Comment — shows most recent user comment + author + date */}
                  <td className="px-4 py-3" style={{ minWidth: 200, maxWidth: 260 }}>
                    {install.latest_comment?.message ? (
                      <div className="flex flex-col gap-0.5">
                        <span className="text-text-secondary text-xs line-clamp-2 leading-snug">
                          {install.latest_comment.message}
                        </span>
                        <span className="text-text-tertiary text-[10px] whitespace-nowrap">
                          {install.latest_comment.user_name ?? "Unknown"} · {formatDate(install.latest_comment.created_at)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-text-tertiary text-xs">—</span>
                    )}
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
 * If state.no_data → the pipeline existed but has no data in the latest batch.
 */
function PipelineCell({ state }: { state: PipelineTypeState | null }) {
  if (!state) return <span className="text-text-tertiary text-xs">—</span>;

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
 * Model cell — shows General/Site-Specific + Deployed badge.
 * Only shows model type when status is Complete or the general flag is explicitly true.
 * Shows "—" for in-progress installs to avoid misleading "Site-Specific" label.
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

function Th({ children, width }: { children: React.ReactNode; width?: number }) {
  return (
    <th
      className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-text-tertiary whitespace-nowrap"
      style={width ? { width, minWidth: width } : undefined}
    >
      {children}
    </th>
  );
}
