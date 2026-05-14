"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Plus, Save, Trash2, X, Pencil, Copy } from "lucide-react";
import {
  HOLIDAY_COUNTRY_LABELS,
  type HolidayCountry,
} from "@/types/database";
import { RichTextEditor } from "./rich-text-editor";

type Benefit = {
  id: string;
  country: string;
  years: number;
  body: string;
  updated_at: string;
};

const COUNTRY_VALUES = Object.keys(HOLIDAY_COUNTRY_LABELS) as HolidayCountry[];

const DEFAULT_BODY =
  "<ul>\n  <li>Add the benefits earned at this milestone here.</li>\n</ul>";

export function AnniversaryBenefitsManager({
  initialBenefits,
}: {
  initialBenefits: Benefit[];
}) {
  const router = useRouter();
  const [benefits, setBenefits] = useState<Benefit[]>(initialBenefits);
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<{
    country: string;
    years: number;
    body: string;
  }>({ country: COUNTRY_VALUES[0], years: 1, body: DEFAULT_BODY });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [duplicatingFrom, setDuplicatingFrom] = useState<Benefit | null>(null);
  const [duplicateYearsInput, setDuplicateYearsInput] = useState("");
  const [duplicateCountries, setDuplicateCountries] = useState<string[]>([]);

  const grouped = useMemo(() => {
    const map = new Map<string, Benefit[]>();
    for (const b of benefits) {
      const list = map.get(b.country) ?? [];
      list.push(b);
      map.set(b.country, list);
    }
    for (const list of map.values()) list.sort((a, b) => a.years - b.years);
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [benefits]);

  const startNew = () => {
    setDraft({ country: COUNTRY_VALUES[0], years: 1, body: DEFAULT_BODY });
    setEditingId("new");
    setMessage("");
  };

  const startEdit = (b: Benefit) => {
    setDraft({ country: b.country, years: b.years, body: b.body });
    setEditingId(b.id);
    setMessage("");
  };

  const cancel = () => {
    setEditingId(null);
    setMessage("");
  };

  const save = async () => {
    if (draft.years < 1) {
      setMessage("Years must be 1 or more.");
      return;
    }
    if (!draft.body.trim()) {
      setMessage("Body cannot be empty.");
      return;
    }
    setSaving(true);
    setMessage("");
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const row = {
      country: draft.country,
      years: draft.years,
      body: draft.body,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    };

    if (editingId === "new") {
      const conflict = benefits.find(
        (b) => b.country === draft.country && b.years === draft.years
      );
      if (conflict) {
        setMessage(
          `A benefit for ${HOLIDAY_COUNTRY_LABELS[draft.country as HolidayCountry]} year ${draft.years} already exists. Edit it instead.`
        );
        setSaving(false);
        return;
      }
      const { data, error } = await supabase
        .from("anniversary_benefits")
        .insert(row)
        .select("id, country, years, body, updated_at")
        .single();
      if (error) {
        setMessage(`Save failed: ${error.message}`);
      } else if (data) {
        setBenefits((prev) => [...prev, data]);
        setEditingId(null);
      }
    } else if (editingId) {
      const { data, error } = await supabase
        .from("anniversary_benefits")
        .update(row)
        .eq("id", editingId)
        .select("id, country, years, body, updated_at")
        .single();
      if (error) {
        setMessage(`Save failed: ${error.message}`);
      } else if (data) {
        setBenefits((prev) =>
          prev.map((b) => (b.id === editingId ? data : b))
        );
        setEditingId(null);
      }
    }
    setSaving(false);
    router.refresh();
  };

  const startDuplicate = (b: Benefit) => {
    setDuplicatingFrom(b);
    setDuplicateYearsInput("");
    setDuplicateCountries([b.country]);
    setMessage("");
  };

  const cancelDuplicate = () => {
    setDuplicatingFrom(null);
    setDuplicateYearsInput("");
    setDuplicateCountries([]);
  };

  const toggleDuplicateCountry = (c: string) => {
    setDuplicateCountries((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  };

  /**
   * Parse a string like "6-9, 11, 13-14" into [6,7,8,9,11,13,14].
   * Returns null on parse error.
   */
  function parseYearsInput(input: string): number[] | null {
    const out: number[] = [];
    const parts = input
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length === 0) return null;
    for (const part of parts) {
      const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
      if (rangeMatch) {
        const a = parseInt(rangeMatch[1]);
        const b = parseInt(rangeMatch[2]);
        if (a < 1 || b < 1 || a > b) return null;
        for (let y = a; y <= b; y++) out.push(y);
      } else if (/^\d+$/.test(part)) {
        const y = parseInt(part);
        if (y < 1) return null;
        out.push(y);
      } else {
        return null;
      }
    }
    return Array.from(new Set(out)).sort((a, b) => a - b);
  }

  const applyDuplicate = async () => {
    if (!duplicatingFrom) return;
    const years = parseYearsInput(duplicateYearsInput);
    if (!years) {
      setMessage(
        "Enter years as numbers or ranges, e.g. \"6-9\" or \"6, 8, 10-12\"."
      );
      return;
    }
    if (duplicateCountries.length === 0) {
      setMessage("Pick at least one country to duplicate to.");
      return;
    }
    // Build (country, year) pairs and split into to-create vs skipped.
    type Pair = { country: string; year: number };
    const wanted: Pair[] = [];
    for (const c of duplicateCountries) {
      for (const y of years) wanted.push({ country: c, year: y });
    }
    const existing = new Set(
      benefits.map((b) => `${b.country}|${b.years}`)
    );
    const toCreate = wanted.filter(
      (p) => !existing.has(`${p.country}|${p.year}`)
    );
    const skipped = wanted.filter((p) =>
      existing.has(`${p.country}|${p.year}`)
    );
    if (toCreate.length === 0) {
      setMessage(
        "All those country/year combinations already have a benefit — nothing to duplicate."
      );
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const rows = toCreate.map((p) => ({
      country: p.country,
      years: p.year,
      body: duplicatingFrom.body,
      updated_by: user?.id,
      updated_at: new Date().toISOString(),
    }));
    const { data, error } = await supabase
      .from("anniversary_benefits")
      .insert(rows)
      .select("id, country, years, body, updated_at");
    setSaving(false);
    if (error) {
      setMessage(`Duplicate failed: ${error.message}`);
      return;
    }
    if (data) setBenefits((prev) => [...prev, ...data]);
    setDuplicatingFrom(null);
    setDuplicateYearsInput("");
    setDuplicateCountries([]);
    const created = toCreate.length;
    setMessage(
      skipped.length === 0
        ? `Created ${created} benefit${created === 1 ? "" : "s"}.`
        : `Created ${created} benefit${created === 1 ? "" : "s"}; skipped ${skipped.length} that already existed (${skipped
            .map(
              (p) =>
                `${HOLIDAY_COUNTRY_LABELS[p.country as HolidayCountry] ?? p.country} year ${p.year}`
            )
            .join(", ")}).`
    );
    router.refresh();
  };

  const remove = async (b: Benefit) => {
    if (
      !confirm(
        `Delete the year ${b.years} benefit for ${HOLIDAY_COUNTRY_LABELS[b.country as HolidayCountry] ?? b.country}? This cannot be undone.`
      )
    ) {
      return;
    }
    const supabase = createClient();
    const { error } = await supabase
      .from("anniversary_benefits")
      .delete()
      .eq("id", b.id);
    if (error) {
      setMessage(`Delete failed: ${error.message}`);
      return;
    }
    setBenefits((prev) => prev.filter((x) => x.id !== b.id));
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {message && (
        <div className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {message}
        </div>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={startNew}
          disabled={editingId === "new"}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Plus size={14} /> Add benefit
        </button>
      </div>

      {editingId === "new" && (
        <BenefitEditor
          draft={draft}
          setDraft={setDraft}
          saving={saving}
          onSave={save}
          onCancel={cancel}
        />
      )}

      {grouped.length === 0 && editingId !== "new" && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
          No benefits defined yet. Click <strong>Add benefit</strong> to start.
        </div>
      )}

      {grouped.map(([country, rows]) => (
        <div key={country} className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-gray-500">
            {HOLIDAY_COUNTRY_LABELS[country as HolidayCountry] ?? country}
          </p>
          <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
            {rows.map((b) => (
              <div key={b.id} className="border-b border-gray-100 last:border-b-0">
                {editingId === b.id ? (
                  <div className="p-4">
                    <BenefitEditor
                      draft={draft}
                      setDraft={setDraft}
                      saving={saving}
                      onSave={save}
                      onCancel={cancel}
                    />
                  </div>
                ) : (
                  <>
                    <div className="flex items-start gap-4 p-4">
                      <div className="w-16 shrink-0 text-sm font-semibold text-gray-700">
                        Year {b.years}
                      </div>
                      <div
                        className="prose prose-sm min-w-0 flex-1 text-sm text-gray-700 [&_li]:my-0.5 [&_ul]:list-disc [&_ul]:pl-5"
                        dangerouslySetInnerHTML={{ __html: b.body }}
                      />
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => startDuplicate(b)}
                          className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-100"
                          title="Duplicate to other years"
                        >
                          <Copy size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => startEdit(b)}
                          className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-100"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => remove(b)}
                          className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50"
                          title="Delete"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                    {duplicatingFrom?.id === b.id && (
                      <div className="space-y-3 border-t border-blue-200 bg-blue-50/40 p-4">
                        <div>
                          <p className="mb-1 text-xs font-medium text-gray-700">
                            Year(s) to copy to
                          </p>
                          <p className="mb-2 text-[11px] text-gray-500">
                            Comma-separated and ranges allowed (e.g.{" "}
                            <code className="rounded bg-white px-1">6-9</code>,{" "}
                            <code className="rounded bg-white px-1">6, 8, 10-12</code>).
                          </p>
                          <input
                            type="text"
                            autoFocus
                            value={duplicateYearsInput}
                            onChange={(e) => setDuplicateYearsInput(e.target.value)}
                            placeholder="e.g. 6-9"
                            className="w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2 text-sm"
                          />
                        </div>
                        <div>
                          <p className="mb-1 text-xs font-medium text-gray-700">
                            Country/countries to apply to
                          </p>
                          <div className="flex flex-wrap gap-3">
                            {COUNTRY_VALUES.map((c) => (
                              <label
                                key={c}
                                className="flex items-center gap-1.5 text-xs text-gray-700"
                              >
                                <input
                                  type="checkbox"
                                  checked={duplicateCountries.includes(c)}
                                  onChange={() => toggleDuplicateCountry(c)}
                                  className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                />
                                {HOLIDAY_COUNTRY_LABELS[c]}
                              </label>
                            ))}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={applyDuplicate}
                            disabled={
                              saving ||
                              !duplicateYearsInput.trim() ||
                              duplicateCountries.length === 0
                            }
                            className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            <Copy size={14} />
                            {saving ? "Duplicating..." : "Duplicate"}
                          </button>
                          <button
                            type="button"
                            onClick={cancelDuplicate}
                            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                          >
                            <X size={14} /> Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function BenefitEditor({
  draft,
  setDraft,
  saving,
  onSave,
  onCancel,
}: {
  draft: { country: string; years: number; body: string };
  setDraft: (d: { country: string; years: number; body: string }) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="space-y-4 rounded-xl border border-blue-200 bg-blue-50/40 p-4">
      <div className="flex flex-wrap gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600">Country</label>
          <select
            value={draft.country}
            onChange={(e) => setDraft({ ...draft, country: e.target.value })}
            className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {COUNTRY_VALUES.map((c) => (
              <option key={c} value={c}>
                {HOLIDAY_COUNTRY_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600">Years</label>
          <input
            type="number"
            min={1}
            value={draft.years}
            onChange={(e) =>
              setDraft({ ...draft, years: parseInt(e.target.value) || 1 })
            }
            className="mt-1 w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600">
          Benefits (shown in the email)
        </label>
        <div className="mt-1">
          <RichTextEditor
            value={draft.body}
            onChange={(html) => setDraft({ ...draft, body: html })}
          />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Save size={14} />
          {saving ? "Saving..." : "Save"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <X size={14} /> Cancel
        </button>
      </div>
    </div>
  );
}
