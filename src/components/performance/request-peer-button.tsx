"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { UserPlus, X } from "lucide-react";
import { PeoplePicker, type PickerUser } from "@/components/performance/people-picker";

export function RequestPeerButton({
  reviewId,
  candidates,
}: {
  reviewId: string;
  candidates: PickerUser[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<number | null>(null);

  const submit = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    setError(null);
    let successCount = 0;
    for (const reviewer_id of selected) {
      const res = await fetch("/api/peer-feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ review_id: reviewId, reviewer_id, anonymous }),
      });
      if (res.ok) successCount++;
    }
    setBusy(false);
    if (successCount === 0) {
      setError("Couldn't send the request(s). They may already be assigned.");
      return;
    }
    setDone(successCount);
    setSelected([]);
    setOpen(false);
    router.refresh();
  };

  if (done !== null && !open) {
    return (
      <span className="text-xs text-emerald-700">
        {done} peer request{done === 1 ? "" : "s"} sent
      </span>
    );
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
      >
        <UserPlus size={12} /> Request peer feedback
      </button>
    );
  }

  return (
    <div className="w-full space-y-2 rounded-lg border border-blue-200 bg-blue-50/40 p-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-800">
          Pick reviewers (you can pick multiple)
        </p>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="rounded p-1 text-gray-500 hover:bg-gray-100"
        >
          <X size={12} />
        </button>
      </div>
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      <PeoplePicker
        candidates={candidates}
        selectedIds={selected}
        onChange={setSelected}
        placeholder="Search colleagues to request…"
      />
      <label className="flex items-center gap-1.5 text-xs text-gray-700">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
        />
        Anonymous responses
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || selected.length === 0}
          className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {busy ? "Sending..." : `Send to ${selected.length}`}
        </button>
      </div>
    </div>
  );
}
