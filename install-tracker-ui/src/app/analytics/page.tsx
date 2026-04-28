"use client";

import { TopBar } from "@/components/layout/top-bar";
import { KpiRow } from "@/components/analytics/kpi-row";
import { PartnerWorkload } from "@/components/analytics/partner-workload";
import { StageDistribution } from "@/components/analytics/stage-distribution";
import { PartnerBreakdown } from "@/components/analytics/partner-breakdown";
import { InstallHeatmap } from "@/components/analytics/install-heatmap";
import { InstallTimeline } from "@/components/analytics/install-timeline";
import { DataVolumeTrend } from "@/components/analytics/data-volume-trend";
import { useKpis, useSnapshots, useSiteHistory } from "@/hooks/use-analytics";
import { useInstalls } from "@/hooks/use-installs";
import { useAppContext } from "../providers";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function AnalyticsPage() {
  const { selectedUser, setSelectedUser } = useAppContext();

  const { data: kpis, isError: kpiError, isLoading: kpiLoading, error: kpiErrMsg, refetch: retryKpis } = useKpis();
  const { data: snapshots, isError: snapError, isLoading: snapLoading } = useSnapshots();
  const { data: siteHistory, isError: histError } = useSiteHistory();
  const { data: installs, isError: installError } = useInstalls({});

  const hasError = kpiError || snapError || histError || installError;
  const isLoading = kpiLoading || snapLoading;

  return (
    <div className="flex flex-col">
      <TopBar
        selectedUser={selectedUser}
        onUserChange={setSelectedUser}
        title="Analytics"
        subtitle="Pipeline & Install Performance Metrics"
      />
      <div className="p-8 flex flex-col gap-6">
        {hasError ? (
          <div className="bg-[rgba(240,82,82,0.08)] border border-[rgba(240,82,82,0.3)] rounded-[12px] p-6 flex items-start gap-4">
            <div className="w-10 h-10 rounded-[8px] bg-[rgba(240,82,82,0.15)] flex items-center justify-center shrink-0">
              <AlertTriangle size={20} className="text-red-400" />
            </div>
            <div className="flex flex-col gap-2 flex-1">
              <h3 className="text-base font-bold text-text-primary">Unable to load analytics data</h3>
              <p className="text-sm text-text-secondary">
                Could not connect to the database. Please check that PostgreSQL is running and the connection is configured correctly.
              </p>
              {kpiErrMsg && (
                <pre className="text-xs text-red-400/80 bg-[rgba(0,0,0,0.2)] rounded-[8px] p-3 mt-1 overflow-x-auto">
                  {kpiErrMsg.message}
                </pre>
              )}
              <button
                onClick={() => retryKpis()}
                className="mt-2 self-start flex items-center gap-2 px-4 py-2 rounded-full bg-sky-500 text-white text-sm font-bold hover:bg-sky-400 transition-colors cursor-pointer"
              >
                <RefreshCw size={14} />
                Retry
              </button>
            </div>
          </div>
        ) : isLoading || !kpis ? (
          <div className="flex items-center justify-center py-20 text-text-tertiary">
            <RefreshCw size={18} className="animate-spin mr-2" />
            Loading analytics...
          </div>
        ) : (
          <>
            <KpiRow data={kpis} />

            {/* Row 1: Partner Workload + Stage Distribution */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <PartnerWorkload snapshots={snapshots ?? []} />
              <StageDistribution snapshots={snapshots ?? []} />
            </div>

            {/* Row 2: Partner Breakdown + Data Volume Trend */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <PartnerBreakdown snapshots={snapshots ?? []} />
              <DataVolumeTrend snapshots={snapshots ?? []} />
            </div>

            {/* Row 3: Install Heatmap (full width) */}
            <InstallHeatmap
              siteHistory={siteHistory ?? []}
              installs={installs ?? []}
            />

            {/* Row 4: Install Timeline (full width) */}
            <InstallTimeline installs={installs ?? []} />
          </>
        )}
      </div>
    </div>
  );
}
