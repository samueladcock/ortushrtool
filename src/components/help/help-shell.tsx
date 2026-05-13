"use client";

import { useState } from "react";
import { Pencil, Eye } from "lucide-react";
import { HelpContent, type HelpArticle } from "@/components/help/help-content";
import { HelpArticlesManager } from "@/components/admin/help-articles-manager";

export function HelpShell({
  articles,
  isManager,
  isAdmin,
  isSuperAdmin,
  canEdit,
  queueWarning,
}: {
  articles: HelpArticle[];
  isManager: boolean;
  isAdmin: boolean;
  isSuperAdmin: boolean;
  canEdit: boolean;
  /** If true, show a "your edits will be queued" banner in edit mode. */
  queueWarning: boolean;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="space-y-4">
      {canEdit && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            {editing ? <Eye size={14} /> : <Pencil size={14} />}
            {editing ? "View" : "Edit"}
          </button>
        </div>
      )}
      {editing && queueWarning && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
          Your edits will be queued for admin approval before they go live.
        </div>
      )}
      {editing ? (
        <HelpArticlesManager articles={articles} />
      ) : (
        <HelpContent
          articles={articles}
          isManager={isManager}
          isAdmin={isAdmin}
          isSuperAdmin={isSuperAdmin}
        />
      )}
    </div>
  );
}
