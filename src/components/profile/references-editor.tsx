"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Save, Trash2, X, Pencil } from "lucide-react";
import type { EmployeeReference } from "@/types/database";

const inputClass =
  "mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500";

type Draft = {
  name: string;
  relationship: string;
  company: string;
  email: string;
  phone: string;
  notes: string;
};

const emptyDraft: Draft = {
  name: "",
  relationship: "",
  company: "",
  email: "",
  phone: "",
  notes: "",
};

export function ReferencesEditor({
  employeeId,
  initialReferences,
  canEdit,
}: {
  employeeId: string;
  initialReferences: EmployeeReference[];
  /** True if the viewer can add / edit / delete references. */
  canEdit: boolean;
}) {
  const router = useRouter();
  const [refs, setRefs] = useState(initialReferences);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const startNew = () => {
    setDraft(emptyDraft);
    setEditingId("new");
    setMessage("");
  };

  const startEdit = (r: EmployeeReference) => {
    setDraft({
      name: r.name,
      relationship: r.relationship ?? "",
      company: r.company ?? "",
      email: r.email ?? "",
      phone: r.phone ?? "",
      notes: r.notes ?? "",
    });
    setEditingId(r.id);
    setMessage("");
  };

  const cancel = () => {
    setEditingId(null);
    setMessage("");
  };

  const save = async () => {
    if (!draft.name.trim()) {
      setMessage("Name is required.");
      return;
    }
    setSaving(true);
    setMessage("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const row = {
      employee_id: employeeId,
      name: draft.name.trim(),
      relationship: draft.relationship.trim() || null,
      company: draft.company.trim() || null,
      email: draft.email.trim() || null,
      phone: draft.phone.trim() || null,
      notes: draft.notes.trim() || null,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    };

    if (editingId === "new") {
      const { data, error } = await supabase
        .from("employee_references")
        .insert(row)
        .select("*")
        .single();
      if (error) setMessage(`Save failed: ${error.message}`);
      else if (data) {
        setRefs((prev) => [...prev, data]);
        setEditingId(null);
      }
    } else if (editingId) {
      const { data, error } = await supabase
        .from("employee_references")
        .update(row)
        .eq("id", editingId)
        .select("*")
        .single();
      if (error) setMessage(`Save failed: ${error.message}`);
      else if (data) {
        setRefs((prev) => prev.map((r) => (r.id === editingId ? data : r)));
        setEditingId(null);
      }
    }
    setSaving(false);
    router.refresh();
  };

  const remove = async (r: EmployeeReference) => {
    if (!confirm(`Delete the reference for ${r.name}? This cannot be undone.`)) {
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("employee_references")
      .delete()
      .eq("id", r.id);
    if (error) {
      setMessage(`Delete failed: ${error.message}`);
      return;
    }
    setRefs((prev) => prev.filter((x) => x.id !== r.id));
    router.refresh();
  };

  return (
    <div className="space-y-3">
      {message && (
        <div className="rounded-lg bg-amber-50 p-2 text-xs text-amber-800">
          {message}
        </div>
      )}

      {refs.length === 0 && editingId !== "new" && (
        <p className="text-sm text-gray-500">No references on file.</p>
      )}

      {refs.map((r) => (
        <div
          key={r.id}
          className="rounded-lg border border-gray-200 bg-gray-50 p-3"
        >
          {editingId === r.id ? (
            <ReferenceForm
              draft={draft}
              setDraft={setDraft}
              saving={saving}
              onSave={save}
              onCancel={cancel}
              canEdit={canEdit}
            />
          ) : (
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-medium text-gray-900">{r.name}</p>
                {(r.relationship || r.company) && (
                  <p className="text-xs text-gray-600">
                    {[r.relationship, r.company].filter(Boolean).join(" · ")}
                  </p>
                )}
                {(r.email || r.phone) && (
                  <p className="text-xs text-gray-500">
                    {[r.email, r.phone].filter(Boolean).join(" · ")}
                  </p>
                )}
                {r.notes && (
                  <p className="text-xs italic text-gray-600">{r.notes}</p>
                )}
              </div>
              {canEdit && (
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(r)}
                    className="rounded p-1 text-gray-500 hover:bg-gray-200"
                    title="Edit"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(r)}
                    className="rounded p-1 text-red-500 hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {editingId === "new" && (
        <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
          <ReferenceForm
            draft={draft}
            setDraft={setDraft}
            saving={saving}
            onSave={save}
            onCancel={cancel}
            canEdit={canEdit}
          />
        </div>
      )}

      {canEdit && editingId === null && (
        <button
          type="button"
          onClick={startNew}
          className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          <Plus size={14} /> Add reference
        </button>
      )}
    </div>
  );
}

function ReferenceForm({
  draft,
  setDraft,
  saving,
  onSave,
  onCancel,
  canEdit,
}: {
  draft: Draft;
  setDraft: (d: Draft) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
  canEdit: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-gray-600">
            Reference name
          </label>
          <input
            type="text"
            required
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            disabled={!canEdit}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">
            Relationship
          </label>
          <input
            type="text"
            value={draft.relationship}
            placeholder="e.g. Former manager, Colleague"
            onChange={(e) =>
              setDraft({ ...draft, relationship: e.target.value })
            }
            disabled={!canEdit}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">
            Company
          </label>
          <input
            type="text"
            value={draft.company}
            onChange={(e) => setDraft({ ...draft, company: e.target.value })}
            disabled={!canEdit}
            className={inputClass}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">
            Email
          </label>
          <input
            type="email"
            value={draft.email}
            onChange={(e) => setDraft({ ...draft, email: e.target.value })}
            disabled={!canEdit}
            className={inputClass}
          />
        </div>
        <div className="sm:col-span-2">
          <label className="block text-xs font-medium text-gray-600">
            Phone
          </label>
          <input
            type="tel"
            value={draft.phone}
            onChange={(e) => setDraft({ ...draft, phone: e.target.value })}
            disabled={!canEdit}
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600">Notes</label>
        <textarea
          rows={2}
          value={draft.notes}
          onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
          className={inputClass}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={12} />
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <X size={12} /> Cancel
        </button>
      </div>
    </div>
  );
}
