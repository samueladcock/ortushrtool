"use client";

import { useState } from "react";
import { Bell } from "lucide-react";

interface Props {
  requestId: string;
  requestType: "schedule_adjustment" | "leave" | "holiday_work" | "overtime";
}

export function BuzzManager({ requestId, requestType }: Props) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleBuzz = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications/buzz-manager", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request_type: requestType, request_id: requestId }),
      });

      if (res.ok) {
        setSent(true);
      }
    } catch {
      // Non-blocking
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <span className="flex items-center gap-1 text-xs text-green-600">
        <Bell size={14} />
        Reminder sent
      </span>
    );
  }

  return (
    <button
      onClick={handleBuzz}
      disabled={loading}
      className="flex items-center gap-1 rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-600 hover:bg-blue-50 disabled:opacity-50"
    >
      <Bell size={14} />
      {loading ? "Sending..." : "Remind Manager"}
    </button>
  );
}
