"use client";

import { useState } from "react";
import { Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Input, Select } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useCreateInstall } from "@/hooks/use-installs";

interface RegisterFormProps {
  defaultOwner: string;
}

export function RegisterForm({ defaultOwner }: RegisterFormProps) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    comp_site_id: "",
    site_name: "",
    install_type: "New Site",
    region: "US",
    jira_link: "",
  });

  const createInstall = useCreateInstall();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createInstall.mutate(
      { ...form, owner_name: defaultOwner },
      {
        onSuccess: () => {
          setForm({ comp_site_id: "", site_name: "", install_type: "New Site", region: "US", jira_link: "" });
          setOpen(false);
        },
      }
    );
  };

  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between cursor-pointer"
      >
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-sky-500 flex items-center justify-center">
            <Plus size={14} className="text-white" />
          </div>
          <span className="text-sm font-bold text-text-primary">Register New Install</span>
        </div>
        {open ? <ChevronUp size={16} className="text-text-tertiary" /> : <ChevronDown size={16} className="text-text-tertiary" />}
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="mt-5 grid grid-cols-2 md:grid-cols-3 gap-4">
          <Input
            label="CompID-SiteID"
            placeholder="e.g. 150-936"
            required
            value={form.comp_site_id}
            onChange={(e) => setForm({ ...form, comp_site_id: e.target.value })}
          />
          <Input
            label="Site Name"
            placeholder="e.g. P&G - Cairo - 4"
            value={form.site_name}
            onChange={(e) => setForm({ ...form, site_name: e.target.value })}
          />
          <Select
            label="Install Type"
            options={[
              { value: "New Site", label: "New Site" },
              { value: "AddOn", label: "AddOn" },
            ]}
            value={form.install_type}
            onChange={(e) => setForm({ ...form, install_type: e.target.value })}
          />
          <Select
            label="Region"
            options={[
              { value: "US", label: "US" },
              { value: "EU", label: "EU" },
              { value: "CA", label: "CA" },
              { value: "Tesla", label: "Tesla" },
              { value: "Asia", label: "Asia" },
            ]}
            value={form.region}
            onChange={(e) => setForm({ ...form, region: e.target.value })}
          />
          <Input
            label="Jira Link"
            placeholder="https://..."
            value={form.jira_link}
            onChange={(e) => setForm({ ...form, jira_link: e.target.value })}
          />
          <div className="flex items-end">
            <Button type="submit" size="md" disabled={createInstall.isPending}>
              {createInstall.isPending ? "Registering..." : "Register"}
            </Button>
          </div>
          {createInstall.isError && (
            <div className="col-span-full text-sm text-red-400 bg-[rgba(240,82,82,0.08)] border border-[rgba(240,82,82,0.3)] rounded-[8px] px-3 py-2">
              {createInstall.error?.message || "Failed to register install"}
            </div>
          )}
        </form>
      )}
    </Card>
  );
}
