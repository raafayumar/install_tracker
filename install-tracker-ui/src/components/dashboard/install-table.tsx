/**
 * Dashboard install table — main data grid showing all installs.
 *
 * Sort order (fixed, not user-adjustable):
 *   1. In-progress  → sorted by created_at DESC (newest first)
 *   2. On Hold      → sorted by created_at DESC
 *   3. Complete     → sorted by end_date DESC (most recently completed first)
 *   4. Cancelled    → sorted by created_at DESC
 *
 * Column order:
 *   ID | Name | [Owner] | Type | Region | Status | OB Pipeline | PPE Pipeline |
 *   OB Model | PPE Model | Latest Comment | Start | Days
 *
 * Column sizing strategy:
 *   - Compact columns (Type, Region, Status, OB Model, PPE Model, Start, Days):
 *     width=1% + whitespace-nowrap → browser shrinks them to content width
 *   - Pipeline columns: capped at maxWidth 160px (content can stack vertically)
 *   - Name: min 140px, grows freely
 *   - Latest Comment: min 220px, grows freely
 *
 * HOW TO MODIFY:
 * - To reorder columns: move the matching <Th> + <td> blocks together.
 * - To change which columns are compact: toggle the `compact` prop on <Th> and add/remove
 *   `whitespace-nowrap` on the corresponding <td>.
 * - To change sort order: edit `sortInstalls()` below.
 * - To change comment display: edit the "Latest Comment" td block.
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
              {/* compact=true → width:1% + whitespace-nowrap → shrinks to content */}
              <Th compact>ID</Th>
              <Th minWidth={140}>Name</Th>
              {showOwner && <Th compact>Owner</Th>}
              <Th compact>Type</Th>
              <Th compact>Region</Th>
              <Th compact>Status</Th>
              <Th maxWidth={160}>OB Pipeline</Th>
              <Th maxWidth={160}>PPE Pipeline</Th>
              <Th compact>OB Model</Th>
              <Th compact>PPE Model</Th>
              <Th minWidth={220}>Latest Comment</Th>
              <Th compact>Start</Th>
              <Th compact>Days</Th>
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
                  {/* ID — compact */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link
                      href={`/install/${install.comp_site_id}`}
                      className="text-sky-500 font-bold hover:underline"
                    >
                      {install.comp_site_id}
                    </Link>
                  </td>

                  {/* Name — wide, truncates if very long */}
                  <td className="px-4 py-3 text-text-primary font-medium" style={{ minWidth: 140, maxWidth: 220 }}>
                    <span className="block truncate">{install.site_name || "—"}</span>
                  </td>

                  {/* Owner (only in All view) — compact */}
                  {showOwner && (
                    <td className="px-4 py-3 text-text-secondary font-medium whitespace-nowrap">{install.owner_name}</td>
                  )}

                  {/* Type — compact badge */}
                  <td className="px-4 py-3 whitespace-nowrap"><TypeBadge type={install.install_type} /></td>

                  {/* Region — compact badge */}
                  <td className="px-4 py-3 whitespace-nowrap"><RegionBadge region={install.region} /></td>

                  {/* Status — compact badge */}
                  <td className="px-4 py-3 whitespace-nowrap"><StatusBadge status={install.status} /></td>

                  {/* OB Pipeline — capped width, content stacks vertically */}
                  <td className="px-4 py-3" style={{ maxWidth: 160 }}>
                    <PipelineCell state={obState} />
                  </td>

                  {/* PPE Pipeline */}
                  <td className="px-4 py-3" style={{ maxWidth: 160 }}>
                    <PipelineCell state={ppeState} />
                  </td>

                  {/* OB Model — compact, short text */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ModelCell general={install.general_od_model} deployed={install.ob_deployed} status={install.status} />
                  </td>

                  {/* PPE Model — compact */}
                  <td className="px-4 py-3 whitespace-nowrap">
                    <ModelCell general={install.general_ppe_model} deployed={install.ppe_deployed} status={install.status} />
                  </td>

                  {/* Latest Comment — wide, 2-line clamp */}
                  <td className="px-4 py-3" style={{ minWidth: 220, maxWidth: 320 }}>
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

                  {/* Start date — compact */}
                  <td className="px-4 py-3 text-text-tertiary text-xs whitespace-nowrap">
                    {formatDate(install.start_date)}
                  </td>

                  {/* Days to complete — compact */}
                  <td className="px-4 py-3 text-text-tertiary text-xs text-center whitespace-nowrap">
                    {days !== null ? days : "—"}
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
 * If state.no_data → pipeline existed but has no data in the latest batch.
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

/**
 * Table header cell.
 * - compact: width=1% + whitespace-nowrap → column shrinks to its content width
 * - minWidth: sets a minimum px width (for wide columns like Name, Comments)
 * - maxWidth: caps the column (for pipeline columns)
 */
function Th({
  children,
  compact,
  minWidth,
  maxWidth,
}: {
  children: React.ReactNode;
  compact?: boolean;
  minWidth?: number;
  maxWidth?: number;
}) {
  const style: React.CSSProperties = {};
  if (compact) { style.width = "1%"; }
  if (minWidth) { style.minWidth = minWidth; }
  if (maxWidth) { style.maxWidth = maxWidth; style.width = maxWidth; }

  return (
    <th
      className="px-4 py-3 text-left text-[11px] font-bold uppercase tracking-wider text-text-tertiary whitespace-nowrap"
      style={style}
    >
      {children}
    </th>
  );
}
