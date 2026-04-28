"use client";

import { useState } from "react";
import { Install, InstallStatus } from "@/types";
import { Card, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Save } from "lucide-react";

interface StatusFormProps {
  install: Install;
  onSave?: (updates: Partial<Install>) => void;
}

export function StatusForm({ install, onSave }: StatusFormProps) {
  const [status, setStatus] = useState<InstallStatus>(install.status);
  const [generalOd, setGeneralOd] = useState(install.general_od_model);
  const [generalPpe, setGeneralPpe] = useState(install.general_ppe_model);
  const [obDeployed, setObDeployed] = useState(install.ob_deployed);
  const [ppeDeployed, setPpeDeployed] = useState(install.ppe_deployed);

  const handleSave = () => {
    onSave?.({
      status,
      general_od_model: generalOd,
      general_ppe_model: generalPpe,
      ob_deployed: obDeployed,
      ppe_deployed: ppeDeployed,
      end_date: status === "Complete" && !install.end_date ? new Date().toISOString().split("T")[0] : install.end_date,
    });
  };

  return (
    <Card>
      <CardTitle>Status & Model Tracking</CardTitle>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-4">
        {/* Status */}
        <Select
          label="Status"
          options={[
            { value: "In-progress", label: "In-progress" },
            { value: "Complete", label: "Complete" },
            { value: "On Hold", label: "On Hold" },
            { value: "Cancelled", label: "Cancelled" },
          ]}
          value={status}
          onChange={(e) => setStatus(e.target.value as InstallStatus)}
        />

        {/* Model Eval */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">
            General Model Eval
          </span>
          <Checkbox label="OD Model Passed" checked={generalOd} onChange={(e) => setGeneralOd(e.target.checked)} />
          <Checkbox label="PPE Model Passed" checked={generalPpe} onChange={(e) => setGeneralPpe(e.target.checked)} />
        </div>

        {/* Deployment */}
        <div className="flex flex-col gap-3">
          <span className="text-xs font-bold uppercase tracking-[0.06em] text-text-secondary">
            Deployment Confirmation
          </span>
          <Checkbox label="OB Deployed" checked={obDeployed} onChange={(e) => setObDeployed(e.target.checked)} />
          <Checkbox label="PPE Deployed" checked={ppeDeployed} onChange={(e) => setPpeDeployed(e.target.checked)} />
        </div>
      </div>

      <div className="flex justify-end mt-6">
        <Button onClick={handleSave} size="md">
          <Save size={14} />
          Save Changes
        </Button>
      </div>
    </Card>
  );
}
