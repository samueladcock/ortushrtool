"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight } from "lucide-react";
import type { HelpArticle } from "@/components/help/help-content";

type Role = "manager" | "admin" | "super_admin" | null;

interface Section {
  title: string;
  role: Role;
  position: number;
  items: HelpArticle[];
}

type Op =
  | { op: "insert"; row: Record<string, unknown> }
  | { op: "update"; id: string; patch: Record<string, unknown> }
  | { op: "delete"; id: string }
  | {
      op: "bulk_update";
      filter: Record<string, unknown>;
      patch: Record<string, unknown>;
    }
  | { op: "bulk_delete"; filter: Record<string, unknown> };

async function callApi(op: Op): Promise<{ error: string | null; queued: boolean }> {
  const res = await fetch("/api/help-articles", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(op),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) return { error: data.error ?? "Failed", queued: false };
  return { error: null, queued: !!data.queued };
}

function groupSections(articles: HelpArticle[]): Section[] {
  const map = new Map<string, Section>();
  for (const a of articles) {
    let s = map.get(a.section_title);
    if (!s) {
      s = {
        title: a.section_title,
        role: a.section_role,
        position: a.section_position,
        items: [],
      };
      map.set(a.section_title, s);
    }
    s.items.push(a);
  }
  for (const s of map.values()) {
    s.items.sort((x, y) => x.position - y.position);
  }
  return [...map.values()].sort((a, b) => a.position - b.position);
}

const ROLE_OPTIONS: { value: string; label: string }[] = [
  { value: "", label: "Everyone" },
  { value: "manager", label: "Manager & above" },
  { value: "admin", label: "HR Admin & above" },
  { value: "super_admin", label: "Super Admin only" },
];

function roleToValue(r: Role): string {
  return r ?? "";
}
function valueToRole(v: string): Role {
  if (v === "manager" || v === "admin" || v === "super_admin") return v;
  return null;
}

export function HelpArticlesManager({ articles }: { articles: HelpArticle[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [queuedMessage, setQueuedMessage] = useState("");
  const [showAddSection, setShowAddSection] = useState(false);
  const [draggingArticleId, setDraggingArticleId] = useState<string | null>(null);
  const [draggingSectionTitle, setDraggingSectionTitle] = useState<string | null>(
    null
  );
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set()
  );
  const toggleSection = (title: string) =>
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });

  const sections = groupSections(articles);

  const runOps = async (ops: Op[]) => {
    if (ops.length === 0) return;
    setBusy(true);
    setError("");
    let queued = false;
    for (const op of ops) {
      const res = await callApi(op);
      if (res.error) {
        setError(res.error);
        setBusy(false);
        return;
      }
      if (res.queued) queued = true;
    }
    setBusy(false);
    if (queued) {
      setQueuedMessage(
        ops.length === 1
          ? "Change submitted for admin approval."
          : `${ops.length} changes submitted for admin approval.`
      );
    } else {
      setQueuedMessage("");
      router.refresh();
    }
  };

  // ---- Article ops ----
  const saveArticle = (id: string, patch: Partial<HelpArticle>) =>
    runOps([{ op: "update", id, patch }]);

  const deleteArticle = (id: string) => {
    if (!confirm("Delete this Q&A?")) return;
    return runOps([{ op: "delete", id }]);
  };

  const addArticleToSection = (section: Section) => {
    const nextPosition =
      section.items.length === 0
        ? 0
        : Math.max(...section.items.map((i) => i.position)) + 1;
    return runOps([
      {
        op: "insert",
        row: {
          section_title: section.title,
          section_position: section.position,
          section_role: section.role,
          question: "New question",
          answer: "Answer goes here.",
          position: nextPosition,
        },
      },
    ]);
  };

  /**
   * Move a dragged article either within the same section or into another
   * section, inserting at the given target index. Computes the minimum-diff
   * set of update ops to renumber positions.
   */
  const moveArticleTo = (
    sourceSectionTitle: string,
    articleId: string,
    targetSectionTitle: string,
    targetIndex: number
  ) => {
    const source = sections.find((s) => s.title === sourceSectionTitle);
    const target = sections.find((s) => s.title === targetSectionTitle);
    if (!source || !target) return;
    const article = source.items.find((a) => a.id === articleId);
    if (!article) return;

    const ops: Op[] = [];

    if (source.title === target.title) {
      const list = source.items.filter((a) => a.id !== articleId);
      const clamped = Math.max(0, Math.min(targetIndex, list.length));
      list.splice(clamped, 0, article);
      list.forEach((a, idx) => {
        if (a.position !== idx) {
          ops.push({ op: "update", id: a.id, patch: { position: idx } });
        }
      });
    } else {
      // Source: re-pack remaining items
      const remaining = source.items.filter((a) => a.id !== articleId);
      remaining.forEach((a, idx) => {
        if (a.position !== idx) {
          ops.push({ op: "update", id: a.id, patch: { position: idx } });
        }
      });
      // Target: insert article at targetIndex
      const targetList = [...target.items];
      const clamped = Math.max(0, Math.min(targetIndex, targetList.length));
      targetList.splice(clamped, 0, article);
      targetList.forEach((a, idx) => {
        if (a.id === articleId) {
          ops.push({
            op: "update",
            id: a.id,
            patch: {
              section_title: target.title,
              section_position: target.position,
              section_role: target.role,
              position: idx,
            },
          });
        } else if (a.position !== idx) {
          ops.push({ op: "update", id: a.id, patch: { position: idx } });
        }
      });
    }

    return runOps(ops);
  };

  // ---- Section ops ----
  const renameSection = (oldTitle: string, newTitle: string) => {
    if (!newTitle.trim() || newTitle === oldTitle) return;
    return runOps([
      {
        op: "bulk_update",
        filter: { section_title: oldTitle },
        patch: { section_title: newTitle },
      },
    ]);
  };

  const updateSectionRole = (sectionTitle: string, role: Role) =>
    runOps([
      {
        op: "bulk_update",
        filter: { section_title: sectionTitle },
        patch: { section_role: role },
      },
    ]);

  const deleteSection = (section: Section) => {
    if (
      !confirm(
        `Delete the entire "${section.title}" section and all ${section.items.length} Q&A inside?`
      )
    )
      return;
    return runOps([
      { op: "bulk_delete", filter: { section_title: section.title } },
    ]);
  };

  const reorderSections = (sourceTitle: string, targetTitle: string) => {
    if (sourceTitle === targetTitle) return;
    const fromIdx = sections.findIndex((s) => s.title === sourceTitle);
    const toIdx = sections.findIndex((s) => s.title === targetTitle);
    if (fromIdx === -1 || toIdx === -1) return;
    const list = [...sections];
    const [src] = list.splice(fromIdx, 1);
    list.splice(toIdx, 0, src);
    const ops: Op[] = [];
    list.forEach((s, idx) => {
      if (s.position !== idx) {
        ops.push({
          op: "bulk_update",
          filter: { section_title: s.title },
          patch: { section_position: idx },
        });
      }
    });
    return runOps(ops);
  };

  const addSection = (title: string, role: Role) => {
    if (!title.trim()) return;
    const nextSectionPos =
      sections.length === 0
        ? 0
        : Math.max(...sections.map((s) => s.position)) + 1;
    setShowAddSection(false);
    return runOps([
      {
        op: "insert",
        row: {
          section_title: title,
          section_position: nextSectionPos,
          section_role: role,
          question: "New question",
          answer: "Answer goes here.",
          position: 0,
        },
      },
    ]);
  };

  return (
    <div className="space-y-4">
      {error && (
        <div className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {queuedMessage && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          {queuedMessage}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowAddSection((v) => !v)}
          disabled={busy}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={16} />
          {showAddSection ? "Cancel" : "Add Section"}
        </button>
      </div>

      {showAddSection && (
        <AddSectionForm onSubmit={addSection} disabled={busy} />
      )}

      {sections.map((section) => (
        <SectionCard
          key={section.title}
          section={section}
          busy={busy}
          expanded={expandedSections.has(section.title)}
          onToggleExpand={() => toggleSection(section.title)}
          draggingArticleId={draggingArticleId}
          draggingSectionTitle={draggingSectionTitle}
          onArticleDragStart={(id) => setDraggingArticleId(id)}
          onArticleDragEnd={() => setDraggingArticleId(null)}
          onArticleDropOnto={(sourceSectionTitle, targetIndex) => {
            if (!draggingArticleId) return;
            moveArticleTo(
              sourceSectionTitle,
              draggingArticleId,
              section.title,
              targetIndex
            );
            setDraggingArticleId(null);
          }}
          onSectionDragStart={(title) => setDraggingSectionTitle(title)}
          onSectionDragEnd={() => setDraggingSectionTitle(null)}
          onSectionDropOnto={(targetTitle) => {
            if (draggingSectionTitle) {
              reorderSections(draggingSectionTitle, targetTitle);
            }
            setDraggingSectionTitle(null);
          }}
          onRename={(newTitle) => renameSection(section.title, newTitle)}
          onRoleChange={(role) => updateSectionRole(section.title, role)}
          onDelete={() => deleteSection(section)}
          onAddArticle={() => addArticleToSection(section)}
          onSaveArticle={saveArticle}
          onDeleteArticle={deleteArticle}
          findArticleSourceSection={(id) =>
            sections.find((s) => s.items.some((a) => a.id === id))?.title
          }
        />
      ))}
    </div>
  );
}

function AddSectionForm({
  onSubmit,
  disabled,
}: {
  onSubmit: (title: string, role: Role) => void;
  disabled: boolean;
}) {
  const [title, setTitle] = useState("");
  const [role, setRole] = useState<Role>(null);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit(title, role);
        setTitle("");
        setRole(null);
      }}
      className="flex flex-wrap items-end gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4"
    >
      <div className="min-w-[200px] flex-1">
        <label className="block text-xs font-medium text-gray-600">
          Section title
        </label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600">
          Visible to
        </label>
        <select
          value={roleToValue(role)}
          onChange={(e) => setRole(valueToRole(e.target.value))}
          className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
        >
          {ROLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="submit"
        disabled={disabled}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        Create
      </button>
    </form>
  );
}

function SectionCard({
  section,
  busy,
  expanded,
  onToggleExpand,
  draggingArticleId,
  draggingSectionTitle,
  onArticleDragStart,
  onArticleDragEnd,
  onArticleDropOnto,
  onSectionDragStart,
  onSectionDragEnd,
  onSectionDropOnto,
  onRename,
  onRoleChange,
  onDelete,
  onAddArticle,
  onSaveArticle,
  onDeleteArticle,
  findArticleSourceSection,
}: {
  section: Section;
  busy: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  draggingArticleId: string | null;
  draggingSectionTitle: string | null;
  onArticleDragStart: (id: string) => void;
  onArticleDragEnd: () => void;
  onArticleDropOnto: (sourceSectionTitle: string, targetIndex: number) => void;
  onSectionDragStart: (title: string) => void;
  onSectionDragEnd: () => void;
  onSectionDropOnto: (targetTitle: string) => void;
  onRename: (newTitle: string) => void;
  onRoleChange: (role: Role) => void;
  onDelete: () => void;
  onAddArticle: () => void;
  onSaveArticle: (id: string, patch: Partial<HelpArticle>) => void;
  onDeleteArticle: (id: string) => void;
  findArticleSourceSection: (id: string) => string | undefined;
}) {
  const [title, setTitle] = useState(section.title);
  const titleDirty = title !== section.title;
  const isSectionDragging = draggingSectionTitle === section.title;
  const roleLabel = section.role
    ? ROLE_OPTIONS.find((o) => o.value === section.role)?.label
    : "Everyone";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onSectionDragStart(section.title);
      }}
      onDragOver={(e) => {
        // Accept either section reorder OR an article drop onto a (collapsed)
        // section header.
        if (draggingSectionTitle && draggingSectionTitle !== section.title) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        } else if (draggingArticleId) {
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(e) => {
        if (draggingSectionTitle && draggingSectionTitle !== section.title) {
          e.preventDefault();
          onSectionDropOnto(section.title);
          return;
        }
        if (draggingArticleId) {
          e.preventDefault();
          const sourceTitle = findArticleSourceSection(draggingArticleId);
          if (sourceTitle) {
            onArticleDropOnto(sourceTitle, section.items.length);
          }
        }
      }}
      onDragEnd={onSectionDragEnd}
      className={`rounded-xl border border-gray-200 bg-white shadow-sm ${
        isSectionDragging ? "opacity-50" : ""
      }`}
    >
      {/* Compact header — always visible, drag target */}
      <div className="flex items-center gap-3 px-4 py-3">
        <GripVertical
          size={16}
          className="shrink-0 cursor-grab text-gray-400 active:cursor-grabbing"
        />
        <button
          type="button"
          onClick={onToggleExpand}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          {expanded ? (
            <ChevronDown size={14} className="shrink-0 text-gray-400" />
          ) : (
            <ChevronRight size={14} className="shrink-0 text-gray-400" />
          )}
          <span className="truncate text-sm font-semibold text-gray-900">
            {section.title}
          </span>
          <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-medium text-gray-500">
            {section.items.length} Q&amp;A
          </span>
          <span className="shrink-0 text-xs text-gray-400">{roleLabel}</span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          disabled={busy}
          title="Delete entire section"
          className="rounded p-1.5 text-red-500 hover:bg-red-50 disabled:opacity-50"
        >
          <Trash2 size={14} />
        </button>
      </div>

      {expanded && (
        <div className="border-t border-gray-100">
          {/* Section meta edits */}
          <div className="flex flex-wrap items-end gap-3 px-6 py-4">
            <div className="min-w-[200px] flex-1">
              <label className="block text-xs font-medium text-gray-600">
                Section title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600">
                Visible to
              </label>
              <select
                value={roleToValue(section.role)}
                onChange={(e) => onRoleChange(valueToRole(e.target.value))}
                disabled={busy}
                className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                {ROLE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={() => onRename(title)}
              disabled={busy || !titleDirty || !title.trim()}
              className="rounded-lg bg-gray-900 px-3 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-40"
            >
              Save Title
            </button>
          </div>

          {/* Articles */}
          <div className="space-y-2 px-6">
            {section.items.map((article, idx) => (
              <ArticleRow
                key={article.id}
                article={article}
                busy={busy}
                isDragging={draggingArticleId === article.id}
                onDragStart={() => onArticleDragStart(article.id)}
                onDragEnd={onArticleDragEnd}
                onDropOnto={() => {
                  if (!draggingArticleId) return;
                  const sourceTitle =
                    findArticleSourceSection(draggingArticleId);
                  if (!sourceTitle) return;
                  onArticleDropOnto(sourceTitle, idx);
                }}
                canAcceptDrop={
                  draggingArticleId !== null && draggingArticleId !== article.id
                }
                onSave={(patch) => onSaveArticle(article.id, patch)}
                onDelete={() => onDeleteArticle(article.id)}
              />
            ))}
            {/* End-of-section drop zone */}
            <div
              onDragOver={(e) => {
                if (draggingArticleId) {
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                }
              }}
              onDrop={(e) => {
                if (!draggingArticleId) return;
                e.preventDefault();
                const sourceTitle = findArticleSourceSection(draggingArticleId);
                if (!sourceTitle) return;
                onArticleDropOnto(sourceTitle, section.items.length);
              }}
              className={`rounded-lg border border-dashed py-3 text-center text-xs ${
                draggingArticleId
                  ? "border-blue-300 bg-blue-50/30 text-blue-600"
                  : "border-transparent text-transparent"
              }`}
            >
              Drop here to move to end of {section.title}
            </div>
          </div>

          <div className="flex justify-end p-6 pt-2">
            <button
              type="button"
              onClick={onAddArticle}
              disabled={busy}
              className="flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              <Plus size={14} />
              Add Q&amp;A
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ArticleRow({
  article,
  busy,
  isDragging,
  onDragStart,
  onDragEnd,
  onDropOnto,
  canAcceptDrop,
  onSave,
  onDelete,
}: {
  article: HelpArticle;
  busy: boolean;
  isDragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onDropOnto: () => void;
  canAcceptDrop: boolean;
  onSave: (patch: Partial<HelpArticle>) => void;
  onDelete: () => void;
}) {
  const [question, setQuestion] = useState(article.question);
  const [answer, setAnswer] = useState(article.answer);
  const dirty = question !== article.question || answer !== article.answer;

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.stopPropagation();
        onDragStart();
      }}
      onDragOver={(e) => {
        if (canAcceptDrop) {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "move";
        }
      }}
      onDrop={(e) => {
        if (canAcceptDrop) {
          e.preventDefault();
          e.stopPropagation();
          onDropOnto();
        }
      }}
      onDragEnd={onDragEnd}
      className={`flex items-start gap-2 rounded-lg border border-gray-200 p-3 ${
        isDragging ? "opacity-50" : ""
      }`}
    >
      <GripVertical
        size={14}
        className="mt-1 shrink-0 cursor-grab text-gray-400 active:cursor-grabbing"
      />
      <div className="min-w-0 flex-1">
        <input
          type="text"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          className="w-full rounded border border-gray-200 px-2 py-1.5 text-sm font-medium text-gray-900 focus:border-blue-500 focus:outline-none"
        />
        <textarea
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          rows={3}
          className="mt-2 w-full rounded border border-gray-200 px-2 py-1.5 text-sm text-gray-700 focus:border-blue-500 focus:outline-none"
        />
        <div className="mt-2 flex items-center gap-2">
          <button
            type="button"
            onClick={() => onSave({ question, answer })}
            disabled={busy || !dirty || !question.trim()}
            className="rounded bg-gray-900 px-3 py-1 text-xs font-medium text-white hover:bg-gray-800 disabled:opacity-40"
          >
            Save
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={busy}
            title="Delete Q&A"
            className="ml-auto rounded border border-red-200 p-1.5 text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            <Trash2 size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
