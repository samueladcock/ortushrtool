"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { displayName } from "@/lib/utils";

export type PickerUser = {
  id: string;
  full_name: string;
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
};

export function PeoplePicker({
  candidates,
  selectedIds,
  onChange,
  placeholder,
  excludeIds = [],
  singleSelect,
}: {
  candidates: PickerUser[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  excludeIds?: string[];
  singleSelect?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const byId = useMemo(
    () => new Map(candidates.map((c) => [c.id, c] as const)),
    [candidates]
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return candidates
      .filter((u) => !excludeIds.includes(u.id))
      .filter((u) => !selectedIds.includes(u.id))
      .filter((u) => {
        if (!q) return true;
        return (
          displayName(u).toLowerCase().includes(q) ||
          (u.full_name?.toLowerCase().includes(q) ?? false) ||
          u.email.toLowerCase().includes(q) ||
          (u.preferred_name?.toLowerCase().includes(q) ?? false)
        );
      })
      .slice(0, 10);
  }, [candidates, excludeIds, selectedIds, query]);

  const add = (id: string) => {
    if (singleSelect) onChange([id]);
    else onChange([...selectedIds, id]);
    setQuery("");
  };

  const remove = (id: string) =>
    onChange(selectedIds.filter((x) => x !== id));

  return (
    <div className="space-y-2">
      {selectedIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selectedIds.map((id) => {
            const u = byId.get(id);
            return (
              <span
                key={id}
                className="flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800"
              >
                {u ? displayName(u) : id}
                <button
                  type="button"
                  onClick={() => remove(id)}
                  className="rounded-full p-0.5 hover:bg-blue-200"
                >
                  <X size={10} />
                </button>
              </span>
            );
          })}
        </div>
      )}
      <div className="relative">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
        />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setTimeout(() => setFocused(false), 150)}
          placeholder={placeholder ?? "Search people…"}
          className="w-full rounded-lg border border-gray-300 py-1.5 pl-8 pr-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {focused && filtered.length > 0 && (
          <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
            {filtered.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => add(u.id)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-gray-50"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">
                      {displayName(u)}
                    </p>
                    <p className="truncate text-xs text-gray-500">{u.email}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
