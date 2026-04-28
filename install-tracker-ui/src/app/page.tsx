"use client";

import { useState } from "react";
import { TopBar } from "@/components/layout/top-bar";
import { InstallTable } from "@/components/dashboard/install-table";
import { TableFilters, Filters } from "@/components/dashboard/table-filters";
import { RegisterForm } from "@/components/dashboard/register-form";
import { useInstalls } from "@/hooks/use-installs";
import { useAppContext } from "./providers";
import { AlertTriangle, RefreshCw } from "lucide-react";

export default function DashboardPage() {
  const { selectedUser, setSelectedUser } = useAppContext();
  const [filters, setFilters] = useState<Filters>({
    search: "",
    status: "All",
    region: "All",
    type: "All",
  });

  const { data: installs, isError, isLoading, error, refetch } = useInstalls({
    owner: selectedUser,
    status: filters.status,
    region: filters.region,
    type: filters.type,
    search: filters.search,
  });

  return (
    <div className="flex flex-col">
      <TopBar
        selectedUser={selectedUser}
        onUserChange={setSelectedUser}
        title="Install Tracker"
        subtitle="Manage CV Model Deployments"
      />
      <div className="p-8 flex flex-col gap-6">
        {isError ? (
          <ErrorBanner message={error?.message} onRetry={() => refetch()} />
        ) : (
          <>
            {/* Stats Row */}
            <div className="grid grid-cols-4 gap-4">
              <MiniStat label="Total" value={isLoading ? "—" : (installs?.length ?? 0)} color="#00a0f2" />
              <MiniStat label="In Progress" value={isLoading ? "—" : (installs?.filter((i) => i.status === "In-progress").length ?? 0)} color="#f5a623" />
              <MiniStat label="Complete" value={isLoading ? "—" : (installs?.filter((i) => i.status === "Complete").length ?? 0)} color="#22c55e" />
              <MiniStat label="On Hold" value={isLoading ? "—" : (installs?.filter((i) => i.status === "On Hold" || i.status === "Cancelled").length ?? 0)} color="#f05252" />
            </div>

            {selectedUser !== "All" && <RegisterForm defaultOwner={selectedUser} />}
            <TableFilters filters={filters} onChange={setFilters} />

            {isLoading ? (
              <div className="flex items-center justify-center py-16 text-text-tertiary">
                <RefreshCw size={18} className="animate-spin mr-2" />
                Loading installs...
              </div>
            ) : (
              <InstallTable installs={installs ?? []} showOwner={selectedUser === "All"} />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <div className="bg-card border border-border rounded-[12px] p-4 flex items-center gap-3 shadow-[var(--shadow-sm)]">
      <div className="w-2 h-8 rounded-full shrink-0" style={{ background: color }} />
      <div className="flex flex-col">
        <span className="text-2xl font-extrabold text-text-primary">{value}</span>
        <span className="text-[11px] font-bold uppercase tracking-wider text-text-tertiary">{label}</span>
      </div>
    </div>
  );
}

function ErrorBanner({ message, onRetry }: { message?: string; onRetry: () => void }) {
  return (
    <div className="bg-[rgba(240,82,82,0.08)] border border-[rgba(240,82,82,0.3)] rounded-[12px] p-6 flex items-start gap-4">
      <div className="w-10 h-10 rounded-[8px] bg-[rgba(240,82,82,0.15)] flex items-center justify-center shrink-0">
        <AlertTriangle size={20} className="text-red-400" />
      </div>
      <div className="flex flex-col gap-2 flex-1">
        <h3 className="text-base font-bold text-text-primary">Unable to connect to database</h3>
        <p className="text-sm text-text-secondary">
          The dashboard could not load data from the database. Please check that PostgreSQL is running and the connection is configured correctly.
        </p>
        {message && (
          <pre className="text-xs text-red-400/80 bg-[rgba(0,0,0,0.2)] rounded-[8px] p-3 mt-1 overflow-x-auto">
            {message}
          </pre>
        )}
        <button
          onClick={onRetry}
          className="mt-2 self-start flex items-center gap-2 px-4 py-2 rounded-full bg-sky-500 text-white text-sm font-bold hover:bg-sky-400 transition-colors cursor-pointer"
        >
          <RefreshCw size={14} />
          Retry
        </button>
      </div>
    </div>
  );
}
