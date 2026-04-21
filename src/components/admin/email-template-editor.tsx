"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Save, ChevronDown, RotateCcw, Eye, EyeOff } from "lucide-react";
import { cn } from "@/lib/utils";
import type { EmailTemplate } from "@/types/database";
import { EMAIL_TEMPLATE_DEFAULTS } from "@/lib/email/template-defaults";

export function EmailTemplateEditor({
  templates,
}: {
  templates: EmailTemplate[];
}) {
  const router = useRouter();
  const [expandedType, setExpandedType] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [previewing, setPreviewing] = useState<string | null>(null);

  // Merge DB templates with defaults so all templates are shown
  const merged = EMAIL_TEMPLATE_DEFAULTS.map((def) => {
    const dbTemplate = templates.find((t) => t.type === def.type);
    return dbTemplate ?? { ...def, updated_by: null, updated_at: "" };
  });

  const [edits, setEdits] = useState<
    Record<string, { subject: string; body: string }>
  >({});

  const getEdited = (tmpl: EmailTemplate) =>
    edits[tmpl.type] ?? { subject: tmpl.subject, body: tmpl.body };

  const setField = (
    type: string,
    field: "subject" | "body",
    value: string
  ) => {
    setEdits((prev) => ({
      ...prev,
      [type]: { ...getEdited(merged.find((t) => t.type === type)!), [field]: value },
    }));
  };

  const handleSave = async (tmpl: EmailTemplate) => {
    setSaving(tmpl.type);
    setMessage("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const edited = getEdited(tmpl);

    await supabase.from("email_templates").upsert({
      type: tmpl.type,
      name: tmpl.name,
      subject: edited.subject,
      body: edited.body,
      variables: tmpl.variables,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    });

    setMessage(`"${tmpl.name}" saved.`);
    setSaving(null);
    router.refresh();
  };

  const handleReset = (type: string) => {
    const def = EMAIL_TEMPLATE_DEFAULTS.find((t) => t.type === type);
    if (def) {
      setEdits((prev) => ({
        ...prev,
        [type]: { subject: def.subject, body: def.body },
      }));
    }
  };

  // Group templates by category
  const groups: { label: string; types: string[] }[] = [
    {
      label: "Authentication",
      types: ["welcome", "password_reset", "forgot_password_alert"],
    },
    {
      label: "Leave Requests",
      types: ["leave_submitted", "leave_approved", "leave_rejected"],
    },
    {
      label: "Schedule Adjustments",
      types: ["adjustment_submitted", "adjustment_approved", "adjustment_rejected"],
    },
    {
      label: "Holiday Work",
      types: ["holiday_work_submitted", "holiday_work_approved", "holiday_work_rejected"],
    },
    {
      label: "Attendance & Reminders",
      types: ["attendance_flag", "reminder"],
    },
  ];

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {message && (
        <div className="rounded-lg bg-green-50 p-3 text-sm text-green-700">
          {message}
        </div>
      )}

      {groups.map((group) => (
        <div key={group.label}>
          <p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-gray-400">
            {group.label}
          </p>
          <div className="space-y-2">
            {group.types.map((type) => {
              const tmpl = merged.find((t) => t.type === type);
              if (!tmpl) return null;
              const edited = getEdited(tmpl);
              const isExpanded = expandedType === type;
              const isPreviewing = previewing === type;

              return (
                <div
                  key={type}
                  className="rounded-xl border border-gray-200 bg-white"
                >
                  <button
                    onClick={() =>
                      setExpandedType(isExpanded ? null : type)
                    }
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                  >
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {tmpl.name}
                      </p>
                      <p className="text-xs text-gray-400">{edited.subject}</p>
                    </div>
                    <ChevronDown
                      size={16}
                      className={cn(
                        "text-gray-400 transition-transform",
                        isExpanded && "rotate-180"
                      )}
                    />
                  </button>

                  {isExpanded && (
                    <div className="border-t border-gray-100 px-4 py-4 space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Subject
                        </label>
                        <input
                          type="text"
                          value={edited.subject}
                          onChange={(e) =>
                            setField(type, "subject", e.target.value)
                          }
                          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                      </div>

                      <div>
                        <div className="flex items-center justify-between">
                          <label className="block text-sm font-medium text-gray-700">
                            Body (HTML)
                          </label>
                          <button
                            type="button"
                            onClick={() =>
                              setPreviewing(isPreviewing ? null : type)
                            }
                            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                          >
                            {isPreviewing ? (
                              <EyeOff size={14} />
                            ) : (
                              <Eye size={14} />
                            )}
                            {isPreviewing ? "Edit" : "Preview"}
                          </button>
                        </div>
                        {isPreviewing ? (
                          <div
                            className="mt-1 rounded-lg border border-gray-200 bg-gray-50 p-4"
                            dangerouslySetInnerHTML={{ __html: edited.body }}
                          />
                        ) : (
                          <textarea
                            value={edited.body}
                            onChange={(e) =>
                              setField(type, "body", e.target.value)
                            }
                            rows={12}
                            className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                          />
                        )}
                      </div>

                      <div>
                        <p className="text-xs text-gray-500">
                          <strong>Available variables:</strong>{" "}
                          {tmpl.variables
                            .split(",")
                            .map((v) => `{{${v.trim()}}}`)
                            .join(", ")}
                        </p>
                        <p className="mt-1 text-xs text-gray-400">
                          Use {"{{#if variable}}"}...{"{{/if}}"} for optional
                          sections.
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleSave(tmpl)}
                          disabled={saving === type}
                          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Save size={14} />
                          {saving === type ? "Saving..." : "Save"}
                        </button>
                        <button
                          onClick={() => handleReset(type)}
                          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                        >
                          <RotateCcw size={14} />
                          Reset to Default
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
