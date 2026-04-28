"use client";

import { TopBar } from "@/components/layout/top-bar";
import { SlackParser } from "@/components/admin/slack-parser";
import { useAppContext } from "../providers";

export default function AdminPage() {
  const { selectedUser, setSelectedUser } = useAppContext();

  return (
    <div className="flex flex-col">
      <TopBar
        selectedUser={selectedUser}
        onUserChange={setSelectedUser}
        title="Admin"
        subtitle="Slack Pipeline Parser"
      />
      <div className="p-8 max-w-4xl">
        <SlackParser />
      </div>
    </div>
  );
}
