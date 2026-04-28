"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ParsedBlock } from "@/types";

export function useParserPreview() {
  return useMutation<ParsedBlock[], Error, string>({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/parser/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Parse failed");
      return res.json();
    },
  });
}

export function useParserApply() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (text: string) => {
      const res = await fetch("/api/parser/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) throw new Error("Apply failed");
      return res.json();
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["installs"] });
      qc.invalidateQueries({ queryKey: ["analytics"] });
    },
  });
}
