"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, X } from "lucide-react";

type Plan = { id: string; name: string; description: string | null };
type Assigned = { plan_id: string; name: string; description: string | null };

export function LeavePlansEditor({
  employeeId,
  assigned,
  allPlans,
  canEdit,
}: {
  employeeId: string;
  assigned: Assigned[];
  allPlans: Plan[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [adding, setAdding] = useState(false);
  const [picked, setPicked] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assignableOptions = useMemo(() => {
    const taken = new Set(assigned.map((a) => a.plan_id));
    return allPlans.filter((p) => !taken.has(p.id));
  }, [allPlans, assigned]);

  const add = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/employee-leave-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ employee_id: employeeId, plan_id: picked }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Add failed");
      return;
    }
    setAdding(false);
    setPicked("");
    router.refresh();
  };

  const remove = async (plan_id: string) => {
    if (!confirm("Unassign this leave plan?")) return;
    setBusy(true);
    setError(null);
    const res = await fetch(
      `/api/admin/employee-leave-plans?employee_id=${employeeId}&plan_id=${plan_id}`,
      { method: "DELETE" }
    );
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Remove failed");
      return;
    }
    router.refresh();
  };

  return (
    <div className="space-y-2">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      {assigned.length === 0 && !adding ? (
        <p className="text-sm text-gray-500">No leave plans assigned.</p>
      ) : (
        <ul className="space-y-2">
          {assigned.map((pa) => (
            <li
              key={pa.plan_id}
              className="flex items-start justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2"
            >
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900">{pa.name}</p>
                {pa.description && (
                  <p className="text-xs text-gray-500">{pa.description}</p>
                )}
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(pa.plan_id)}
                  disabled={busy}
                  className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
                  title="Unassign"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canEdit && (
        <>
          {adding ? (
            <div className="flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50/40 p-2">
              <select
                value={picked}
                onChange={(e) => setPicked(e.target.value)}
                className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              >
                <option value="">Pick a plan…</option>
                {assignableOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={add}
                disabled={busy || !picked}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setPicked("");
                }}
                className="rounded p-1 text-gray-500 hover:bg-gray-100"
              >
                <X size={14} />
              </button>
            </div>
          ) : assignableOptions.length > 0 ? (
            <button
              type="button"
              onClick={() => setAdding(true)}
              className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
            >
              <Plus size={12} /> Assign plan
            </button>
          ) : null}
        </>
      )}
    </div>
  );
}
