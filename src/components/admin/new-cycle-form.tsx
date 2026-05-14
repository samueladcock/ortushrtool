"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { displayName } from "@/lib/utils";

type Template = { id: string; name: string };
type User = {
  id: string;
  full_name: string;
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  department: string | null;
};

export function NewCycleForm({
  templates,
  users,
}: {
  templates: Template[];
  users: User[];
}) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [startDate, setStartDate] = useState(today);
  const [endDate, setEndDate] = useState(today);
  const [selfDue, setSelfDue] = useState("");
  const [managerDue, setManagerDue] = useState("");
  const [peerDue, setPeerDue] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const departments = useMemo(
    () => Array.from(new Set(users.map((u) => u.department).filter(Boolean))) as string[],
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = filter.toLowerCase().trim();
    return users.filter((u) => {
      if (deptFilter && u.department !== deptFilter) return false;
      if (!q) return true;
      return (
        displayName(u).toLowerCase().includes(q) ||
        (u.full_name?.toLowerCase().includes(q) ?? false) ||
        u.email.toLowerCase().includes(q)
      );
    });
  }, [users, filter, deptFilter]);

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const u of filteredUsers) next.add(u.id);
      return next;
    });

  const clearAllFiltered = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      for (const u of filteredUsers) next.delete(u.id);
      return next;
    });

  const submit = async () => {
    if (!name.trim() || !templateId || selected.size === 0) return;
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/review-cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        template_id: templateId,
        start_date: startDate,
        end_date: endDate,
        self_due: selfDue || null,
        manager_due: managerDue || null,
        peer_due: peerDue || null,
        participant_ids: Array.from(selected),
      }),
    });
    const data = await res.json();
    setBusy(false);
    if (!res.ok) {
      setError(data.error ?? "Create failed");
      return;
    }
    router.push(`/admin/performance/cycles/${data.cycle.id}`);
  };

  return (
    <div className="space-y-6 rounded-xl border border-gray-200 bg-white p-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Cycle name">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Q1 2026 Reviews"
            className={inputClass}
          />
        </Field>
        <Field label="Form template">
          <select
            value={templateId}
            onChange={(e) => setTemplateId(e.target.value)}
            className={inputClass}
          >
            {templates.length === 0 && <option value="">(no templates)</option>}
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start date">
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="End date">
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Self review due">
          <input
            type="date"
            value={selfDue}
            onChange={(e) => setSelfDue(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Manager review due">
          <input
            type="date"
            value={managerDue}
            onChange={(e) => setManagerDue(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Peer review due (optional)">
          <input
            type="date"
            value={peerDue}
            onChange={(e) => setPeerDue(e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-gray-900">
            Participants ({selected.size})
          </p>
          <input
            type="search"
            placeholder="Filter by name or email…"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={selectAllFiltered}
            className="text-xs font-medium text-blue-600 hover:underline"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={clearAllFiltered}
            className="text-xs font-medium text-gray-500 hover:underline"
          >
            Clear
          </button>
        </div>
        <div className="max-h-72 overflow-y-auto rounded-lg border border-gray-200">
          <ul className="divide-y divide-gray-100">
            {filteredUsers.map((u) => (
              <li key={u.id}>
                <label className="flex cursor-pointer items-center gap-3 px-3 py-2 hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={selected.has(u.id)}
                    onChange={() => toggle(u.id)}
                    className="h-4 w-4 rounded border-gray-300 text-blue-600"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {displayName(u)}
                    </p>
                    <p className="truncate text-xs text-gray-500">
                      {u.email}
                      {u.department && ` · ${u.department}`}
                    </p>
                  </div>
                </label>
              </li>
            ))}
            {filteredUsers.length === 0 && (
              <li className="px-3 py-4 text-center text-sm text-gray-500">
                No matches.
              </li>
            )}
          </ul>
        </div>
      </div>

      <button
        type="button"
        onClick={submit}
        disabled={
          busy || !name.trim() || !templateId || selected.size === 0
        }
        className="flex items-center gap-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        <Save size={14} /> {busy ? "Creating..." : "Create cycle (draft)"}
      </button>
    </div>
  );
}

const inputClass =
  "w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-gray-600">
        {label}
      </label>
      {children}
    </div>
  );
}
