"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CalendarClock,
  Plus,
  Save,
  Trash2,
  X,
  Users as UsersIcon,
  Pencil,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { displayName } from "@/lib/utils";
import { PeoplePicker, type PickerUser } from "@/components/performance/people-picker";
import type { OneOnOne } from "@/types/database";

export function OneOnOnesStandalone({
  viewerId,
  isAdmin,
  oneOnOnes,
  candidates,
  userIndex,
}: {
  viewerId: string;
  isAdmin: boolean;
  oneOnOnes: OneOnOne[];
  candidates: PickerUser[];
  userIndex: Record<string, PickerUser>;
}) {
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  return (
    <div className="space-y-3">
      {!creating && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={14} /> New 1-on-1
          </button>
        </div>
      )}

      {creating && (
        <StandaloneOneOnOneForm
          mode="create"
          viewerId={viewerId}
          candidates={candidates}
          onCancel={() => setCreating(false)}
          onSaved={() => {
            setCreating(false);
            router.refresh();
          }}
        />
      )}

      {oneOnOnes.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No 1-on-1s yet.
        </div>
      ) : (
        <ul className="space-y-2">
          {oneOnOnes.map((o) =>
            editingId === o.id ? (
              <StandaloneOneOnOneForm
                key={o.id}
                mode="edit"
                row={o}
                viewerId={viewerId}
                candidates={candidates}
                onCancel={() => setEditingId(null)}
                onSaved={() => {
                  setEditingId(null);
                  router.refresh();
                }}
              />
            ) : (
              <StandaloneCard
                key={o.id}
                row={o}
                viewerId={viewerId}
                isAdmin={isAdmin}
                userIndex={userIndex}
                onEdit={() => setEditingId(o.id)}
                onDeleted={() => router.refresh()}
              />
            )
          )}
        </ul>
      )}
    </div>
  );
}

function StandaloneCard({
  row,
  viewerId,
  isAdmin,
  userIndex,
  onEdit,
  onDeleted,
}: {
  row: OneOnOne;
  viewerId: string;
  isAdmin: boolean;
  userIndex: Record<string, PickerUser>;
  onEdit: () => void;
  onDeleted: () => void;
}) {
  const subject = userIndex[row.employee_id];
  const attendees = Array.from(
    new Set(
      [row.manager_id, ...(row.participants ?? [])].filter(
        (id): id is string => !!id
      )
    )
  );
  const showManagerPrivate = isAdmin || row.manager_id === viewerId;
  const showEmployeePrivate = isAdmin || row.employee_id === viewerId;
  const canDelete = isAdmin || row.manager_id === viewerId;

  const remove = async () => {
    if (!confirm("Delete this 1-on-1?")) return;
    const res = await fetch(`/api/one-on-ones/${row.id}`, { method: "DELETE" });
    if (res.ok) onDeleted();
  };

  return (
    <li className="rounded-xl border border-gray-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-baseline gap-2">
            <p className="text-sm font-semibold text-gray-900">
              {format(parseISO(row.scheduled_date), "MMM d, yyyy")}
            </p>
            <p className="text-xs text-gray-500">
              with{" "}
              <strong className="text-gray-700">
                {subject ? displayName(subject) : "Unknown"}
              </strong>
            </p>
          </div>
          {attendees.length > 0 && (
            <p className="mt-1 flex items-center gap-1 text-xs text-gray-600">
              <UsersIcon size={12} className="text-gray-400" />
              Other attendees:{" "}
              {attendees
                .map((id) => {
                  const u = userIndex[id];
                  return u ? displayName(u) : "Unknown";
                })
                .join(", ")}
            </p>
          )}
          {row.agenda && (
            <p className="mt-1 text-xs">
              <span className="font-medium text-gray-500">Agenda:</span>{" "}
              <span className="text-gray-700">{row.agenda}</span>
            </p>
          )}
          {row.shared_notes && (
            <p className="mt-1 whitespace-pre-wrap text-xs text-gray-700">
              {row.shared_notes}
            </p>
          )}
          {showManagerPrivate && row.manager_private_notes && (
            <div className="mt-2 rounded border border-amber-200 bg-amber-50 p-2 text-xs text-amber-900">
              <p className="font-medium">Facilitator notes</p>
              <p className="mt-0.5 whitespace-pre-wrap">
                {row.manager_private_notes}
              </p>
            </div>
          )}
          {showEmployeePrivate && row.employee_private_notes && (
            <div className="mt-2 rounded border border-blue-200 bg-blue-50 p-2 text-xs text-blue-900">
              <p className="font-medium">Subject&apos;s private notes</p>
              <p className="mt-0.5 whitespace-pre-wrap">
                {row.employee_private_notes}
              </p>
            </div>
          )}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            className="rounded p-1 text-gray-500 hover:bg-gray-100"
            title="Edit"
          >
            <Pencil size={12} />
          </button>
          {canDelete && (
            <button
              type="button"
              onClick={remove}
              className="rounded p-1 text-red-500 hover:bg-red-50"
              title="Delete"
            >
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </div>
    </li>
  );
}

function StandaloneOneOnOneForm({
  mode,
  row,
  viewerId,
  candidates,
  onCancel,
  onSaved,
}: {
  mode: "create" | "edit";
  row?: OneOnOne;
  viewerId: string;
  candidates: PickerUser[];
  onCancel: () => void;
  onSaved: () => void;
}) {
  const [subjectId, setSubjectId] = useState<string>(row?.employee_id ?? "");
  const [scheduledDate, setScheduledDate] = useState(
    row?.scheduled_date ?? new Date().toISOString().slice(0, 10)
  );
  const [agenda, setAgenda] = useState(row?.agenda ?? "");
  const [sharedNotes, setSharedNotes] = useState(row?.shared_notes ?? "");
  const [managerPrivate, setManagerPrivate] = useState(
    row?.manager_private_notes ?? ""
  );
  const [attendees, setAttendees] = useState<string[]>(() => {
    const existing = [
      row?.manager_id,
      ...(row?.participants ?? []),
    ].filter((x): x is string => !!x);
    return Array.from(new Set(existing));
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // When the form opens for creation, default to the viewer being an attendee.
  useState(() => {
    if (mode === "create" && attendees.length === 0) {
      setAttendees([viewerId]);
    }
    return null;
  });

  const submit = async () => {
    if (!subjectId) {
      setError("Pick a subject for this 1-on-1.");
      return;
    }
    setBusy(true);
    setError(null);
    const body = {
      employee_id: subjectId,
      scheduled_date: scheduledDate,
      agenda: agenda || null,
      shared_notes: sharedNotes || null,
      manager_private_notes: managerPrivate || null,
      participants: attendees,
    };
    const url = mode === "create" ? "/api/one-on-ones" : `/api/one-on-ones/${row!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
      return;
    }
    onSaved();
  };

  return (
    <li className="rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="mb-2 flex items-center gap-2">
        <CalendarClock size={14} className="text-gray-500" />
        <p className="text-sm font-semibold text-gray-800">
          {mode === "create" ? "New 1-on-1" : "Edit 1-on-1"}
        </p>
      </div>
      {error && (
        <p className="mb-2 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      <div className="space-y-3">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Subject (whose 1-on-1 is this?)
          </label>
          <PeoplePicker
            candidates={candidates}
            selectedIds={subjectId ? [subjectId] : []}
            onChange={(ids) => setSubjectId(ids[ids.length - 1] ?? "")}
            singleSelect
            placeholder="Search for the subject…"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Other attendees
          </label>
          <PeoplePicker
            candidates={candidates}
            selectedIds={attendees}
            onChange={setAttendees}
            excludeIds={subjectId ? [subjectId] : []}
            placeholder="Search by name or email…"
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Date
            </label>
            <input
              type="date"
              value={scheduledDate}
              onChange={(e) => setScheduledDate(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Agenda
            </label>
            <input
              type="text"
              value={agenda}
              onChange={(e) => setAgenda(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Shared notes (visible to all attendees)
            </label>
            <textarea
              rows={3}
              value={sharedNotes}
              onChange={(e) => setSharedNotes(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-amber-700">
              Facilitator notes (visible to you + HR admin)
            </label>
            <textarea
              rows={2}
              value={managerPrivate}
              onChange={(e) => setManagerPrivate(e.target.value)}
              className="w-full rounded-lg border border-amber-200 px-3 py-1.5 text-sm"
            />
          </div>
        </div>
      </div>
      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !subjectId}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={12} /> {busy ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <X size={12} /> Cancel
        </button>
      </div>
    </li>
  );
}
