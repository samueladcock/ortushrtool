"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

type Option = { value: string; label: string };

export function FilterCombobox({
  options,
  value,
  onChange,
  placeholder,
}: {
  options: Option[];
  value: string;
  onChange: (next: string) => void;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label ?? "",
    [options, value]
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options.slice(0, 12);
    return options
      .filter((o) => o.label.toLowerCase().includes(q))
      .slice(0, 12);
  }, [options, query]);

  // When a value is set, show it as the input text (read-only feel).
  const displayValue = value ? selectedLabel : query;

  return (
    <div className="relative">
      <Search
        size={12}
        className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <input
        type="text"
        value={displayValue}
        onChange={(e) => {
          if (value) onChange(""); // editing implicitly clears the selection
          setQuery(e.target.value);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        className="w-44 rounded-lg border border-gray-300 py-1.5 pl-7 pr-7 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
      />
      {value && (
        <button
          type="button"
          onClick={() => {
            onChange("");
            setQuery("");
          }}
          className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-gray-400 hover:bg-gray-100"
          title="Clear"
        >
          <X size={12} />
        </button>
      )}
      {focused && !value && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full min-w-[14rem] overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {matches.map((m) => (
            <li key={m.value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange(m.value);
                  setQuery("");
                }}
                className="block w-full px-3 py-1.5 text-left text-sm hover:bg-gray-50"
              >
                {m.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
