"use client";

import { Search, X } from "lucide-react";
import { InstallStatus, Region, InstallType } from "@/types";

interface Filters {
  search: string;
  status: InstallStatus | "All";
  region: Region | "All";
  type: InstallType | "All";
}

interface TableFiltersProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
}

export function TableFilters({ filters, onChange }: TableFiltersProps) {
  const set = <K extends keyof Filters>(key: K, value: Filters[K]) =>
    onChange({ ...filters, [key]: value });

  return (
    <div className="flex items-center gap-3 flex-wrap">
      {/* Search */}
      <div className="relative flex-1 min-w-[200px] max-w-sm">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary" />
        <input
          type="text"
          placeholder="Search by ID, name, or owner..."
          value={filters.search}
          onChange={(e) => set("search", e.target.value)}
          className="w-full bg-card border border-border rounded-full text-sm font-medium text-text-primary pl-9 pr-8 py-2 outline-none placeholder:text-text-tertiary focus:border-sky-500 transition-colors"
        />
        {filters.search && (
          <button onClick={() => set("search", "")} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary cursor-pointer">
            <X size={14} />
          </button>
        )}
      </div>

      {/* Status filter — options use DB values; labels show the UI display names */}
      <FilterPill
        label="Status"
        value={filters.status}
        options={["All", "In-progress", "Complete", "On Hold", "Cancelled"]}
        displayLabels={{ "Complete": "Done", "On Hold": "Blocked" }}
        onChange={(v) => set("status", v as Filters["status"])}
      />

      {/* Region filter */}
      <FilterPill
        label="Region"
        value={filters.region}
        options={["All", "US", "EU", "CA", "Tesla", "Asia"]}
        onChange={(v) => set("region", v as Filters["region"])}
      />

      {/* Type filter */}
      <FilterPill
        label="Type"
        value={filters.type}
        options={["All", "New Site", "AddOn"]}
        onChange={(v) => set("type", v as Filters["type"])}
      />
    </div>
  );
}

function FilterPill({
  label,
  value,
  options,
  displayLabels,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  /** Optional map of option value → display label (e.g. "On Hold" → "Blocked") */
  displayLabels?: Record<string, string>;
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-card border border-border rounded-full text-xs font-bold text-text-secondary px-3 py-2 outline-none cursor-pointer hover:border-sky-500/30 focus:border-sky-500 transition-colors"
    >
      {options.map((opt) => (
        <option key={opt} value={opt} className="bg-card">
          {opt === "All" ? `${label}: All` : (displayLabels?.[opt] ?? opt)}
        </option>
      ))}
    </select>
  );
}

export type { Filters };
