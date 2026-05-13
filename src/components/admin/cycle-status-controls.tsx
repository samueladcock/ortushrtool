"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Play, Lock } from "lucide-react";
import type { ReviewCycleStatus } from "@/types/database";

export function CycleStatusControls({
  cycleId,
  status,
}: {
  cycleId: string;
  status: ReviewCycleStatus;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const setStatus = async (next: ReviewCycleStatus) => {
    setBusy(true);
    await fetch(`/api/admin/review-cycles/${cycleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: next }),
    });
    setBusy(false);
    router.refresh();
  };
  const remove = async () => {
    if (!confirm("Delete this cycle and all its reviews?")) return;
    setBusy(true);
    const res = await fetch(`/api/admin/review-cycles/${cycleId}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) router.push("/admin/performance");
  };
  return (
    <div className="flex gap-2">
      {status === "draft" && (
        <button
          type="button"
          onClick={() => setStatus("open")}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          <Play size={12} /> Open cycle
        </button>
      )}
      {status === "open" && (
        <button
          type="button"
          onClick={() => setStatus("closed")}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg bg-gray-700 px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-50"
        >
          <Lock size={12} /> Close cycle
        </button>
      )}
      {status === "closed" && (
        <button
          type="button"
          onClick={() => setStatus("open")}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Reopen
        </button>
      )}
      <button
        type="button"
        onClick={remove}
        disabled={busy}
        className="flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
      >
        <Trash2 size={12} /> Delete
      </button>
    </div>
  );
}
