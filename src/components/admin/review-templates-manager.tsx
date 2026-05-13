"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Save, Trash2, X, ChevronDown, ChevronRight } from "lucide-react";
import type {
  ReviewFormTemplate,
  ReviewQuestion,
  ReviewQuestionRole,
} from "@/types/database";

const ROLES: ReviewQuestionRole[] = ["self", "manager", "peer"];

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function ReviewTemplatesManager({
  initialTemplates,
}: {
  initialTemplates: ReviewFormTemplate[];
}) {
  const router = useRouter();
  const [templates, setTemplates] = useState(initialTemplates);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const refreshFromServer = () => router.refresh();

  return (
    <div className="space-y-3">
      {creating ? (
        <TemplateForm
          mode="create"
          onCancel={() => setCreating(false)}
          onSaved={(t) => {
            setTemplates([t, ...templates]);
            setCreating(false);
          }}
        />
      ) : (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus size={14} /> New template
          </button>
        </div>
      )}

      {templates.length === 0 && !creating ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No review templates yet.
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t) => {
            const isOpen = expanded === t.id;
            return (
              <div
                key={t.id}
                className="overflow-hidden rounded-xl border border-gray-200 bg-white"
              >
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : t.id)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-gray-50"
                >
                  {isOpen ? (
                    <ChevronDown size={14} className="text-gray-400" />
                  ) : (
                    <ChevronRight size={14} className="text-gray-400" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-gray-900">
                      {t.name}
                    </p>
                    {t.description && (
                      <p className="text-xs text-gray-500">{t.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {t.questions.length} question
                    {t.questions.length === 1 ? "" : "s"}
                  </span>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-100">
                    <TemplateForm
                      mode="edit"
                      initial={t}
                      onCancel={() => setExpanded(null)}
                      onSaved={(next) => {
                        setTemplates(
                          templates.map((x) => (x.id === next.id ? next : x))
                        );
                        setExpanded(null);
                      }}
                      onDeleted={() => {
                        setTemplates(templates.filter((x) => x.id !== t.id));
                        setExpanded(null);
                        refreshFromServer();
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TemplateForm({
  mode,
  initial,
  onCancel,
  onSaved,
  onDeleted,
}: {
  mode: "create" | "edit";
  initial?: ReviewFormTemplate;
  onCancel: () => void;
  onSaved: (t: ReviewFormTemplate) => void;
  onDeleted?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [questions, setQuestions] = useState<ReviewQuestion[]>(
    initial?.questions ?? []
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addQuestion = () =>
    setQuestions([...questions, { id: randomId(), text: "", roles: ["self", "manager"] }]);

  const updateQuestion = (idx: number, patch: Partial<ReviewQuestion>) =>
    setQuestions(questions.map((q, i) => (i === idx ? { ...q, ...patch } : q)));

  const removeQuestion = (idx: number) =>
    setQuestions(questions.filter((_, i) => i !== idx));

  const toggleRole = (idx: number, role: ReviewQuestionRole) =>
    setQuestions(
      questions.map((q, i) => {
        if (i !== idx) return q;
        const has = q.roles.includes(role);
        return {
          ...q,
          roles: has ? q.roles.filter((r) => r !== role) : [...q.roles, role],
        };
      })
    );

  const submit = async () => {
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    const url =
      mode === "create"
        ? "/api/admin/review-templates"
        : `/api/admin/review-templates/${initial!.id}`;
    const method = mode === "create" ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        description: description.trim() || null,
        questions,
      }),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
      return;
    }
    if (mode === "create") {
      const { template } = await res.json();
      onSaved(template);
    } else {
      onSaved({
        ...initial!,
        name: name.trim(),
        description: description.trim() || null,
        questions,
      });
    }
  };

  const remove = async () => {
    if (!initial) return;
    if (!confirm(`Delete template "${initial.name}"?`)) return;
    setBusy(true);
    const res = await fetch(`/api/admin/review-templates/${initial.id}`, {
      method: "DELETE",
    });
    setBusy(false);
    if (res.ok) onDeleted?.();
    else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Delete failed");
    }
  };

  return (
    <div className="space-y-3 p-4">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Template name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
            placeholder="e.g. Quarterly Review"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Description (optional)
          </label>
          <input
            type="text"
            value={description ?? ""}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
          />
        </div>
      </div>

      <div>
        <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
          Questions
        </p>
        <div className="space-y-2">
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className="rounded-lg border border-gray-200 bg-gray-50 p-3"
            >
              <div className="flex items-start gap-2">
                <input
                  type="text"
                  value={q.text}
                  onChange={(e) => updateQuestion(idx, { text: e.target.value })}
                  placeholder="Question text"
                  className="flex-1 rounded border border-gray-300 px-2 py-1 text-sm"
                />
                <button
                  type="button"
                  onClick={() => removeQuestion(idx)}
                  className="rounded p-1 text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={12} />
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2 text-xs">
                <span className="text-gray-500">Answered by:</span>
                {ROLES.map((r) => {
                  const on = q.roles.includes(r);
                  return (
                    <button
                      key={r}
                      type="button"
                      onClick={() => toggleRole(idx, r)}
                      className={`rounded-full px-2 py-0.5 font-medium capitalize ${
                        on
                          ? "bg-blue-100 text-blue-700"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addQuestion}
          className="mt-2 flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700"
        >
          <Plus size={12} /> Add question
        </button>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !name.trim()}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={12} /> {busy ? "Saving..." : "Save template"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <X size={12} /> Cancel
        </button>
        {mode === "edit" && (
          <button
            type="button"
            onClick={remove}
            disabled={busy}
            className="ml-auto flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={12} /> Delete
          </button>
        )}
      </div>
    </div>
  );
}
