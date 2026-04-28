"use client";

import { Select } from "@/components/ui/input";
import { useUsers } from "@/hooks/use-installs";

interface TopBarProps {
  selectedUser: string;
  onUserChange: (user: string) => void;
  title: string;
  subtitle?: string;
}

export function TopBar({ selectedUser, onUserChange, title, subtitle }: TopBarProps) {
  const { data: users } = useUsers();

  const userOptions = [
    { value: "All", label: "All Team Members" },
    ...(users || []).map((u) => ({ value: u.name, label: u.name })),
  ];

  return (
    <header className="flex items-center justify-between py-5 px-8 border-b border-border bg-navy-700/50 backdrop-blur-sm">
      <div className="flex flex-col">
        <h1 className="text-2xl font-extrabold text-text-primary tracking-tight">{title}</h1>
        {subtitle && <p className="text-sky-500 text-base font-semibold mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-4">
        <Select
          options={userOptions}
          value={selectedUser}
          onChange={(e) => onUserChange(e.target.value)}
          className="w-48"
        />
        <div className="w-8 h-8 rounded-full bg-sky-500 flex items-center justify-center text-white text-xs font-bold">
          {selectedUser === "All" ? "A" : selectedUser[0]}
        </div>
      </div>
    </header>
  );
}
