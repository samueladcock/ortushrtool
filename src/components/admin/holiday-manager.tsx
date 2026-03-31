"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { Plus, Trash2 } from "lucide-react";
import type { Holiday, HolidayCountry } from "@/types/database";
import { HOLIDAY_COUNTRY_LABELS } from "@/types/database";
import { format, parseISO } from "date-fns";

const COUNTRIES: HolidayCountry[] = ["PH", "XK", "IT", "AE"];

export function HolidayManager({ holidays }: { holidays: Holiday[] }) {
  const router = useRouter();
  const [filterCountry, setFilterCountry] = useState<HolidayCountry | "all">(
    "all"
  );
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [message, setMessage] = useState("");

  // Form state
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [country, setCountry] = useState<HolidayCountry>("PH");
  const [isRecurring, setIsRecurring] = useState(false);

  const filtered =
    filterCountry === "all"
      ? holidays
      : holidays.filter((h) => h.country === filterCountry);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error } = await supabase.from("holidays").insert({
      name,
      date,
      country,
      is_recurring: isRecurring,
      created_by: user?.id,
    });

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Holiday added successfully.");
      setName("");
      setDate("");
      setIsRecurring(false);
      setShowForm(false);
      router.refresh();
    }
    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this holiday?")) return;
    setDeleting(id);

    const supabase = createClient();
    const { error } = await supabase.from("holidays").delete().eq("id", id);

    if (error) {
      setMessage(`Error: ${error.message}`);
    } else {
      setMessage("Holiday deleted.");
      router.refresh();
    }
    setDeleting(null);
  };

  return (
    <div className="space-y-4">
      {message && (
        <div
          className={`rounded-lg p-3 text-sm ${message.startsWith("Error") ? "bg-red-50 text-red-700" : "bg-green-50 text-green-700"}`}
        >
          {message}
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterCountry}
          onChange={(e) =>
            setFilterCountry(e.target.value as HolidayCountry | "all")
          }
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          <option value="all">All Countries</option>
          {COUNTRIES.map((c) => (
            <option key={c} value={c}>
              {HOLIDAY_COUNTRY_LABELS[c]}
            </option>
          ))}
        </select>

        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          <Plus size={16} />
          Add Holiday
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <form
          onSubmit={handleAdd}
          className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm"
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Holiday Name
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Independence Day"
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Date
              </label>
              <input
                type="date"
                required
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Country
              </label>
              <select
                value={country}
                onChange={(e) => setCountry(e.target.value as HolidayCountry)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {COUNTRIES.map((c) => (
                  <option key={c} value={c}>
                    {HOLIDAY_COUNTRY_LABELS[c]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => setIsRecurring(e.target.checked)}
                  className="rounded border-gray-300"
                />
                Recurring annually
              </label>
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Holiday"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Holiday list */}
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-left text-gray-600">
                <th className="px-6 py-3 font-medium">Date</th>
                <th className="px-6 py-3 font-medium">Holiday</th>
                <th className="px-6 py-3 font-medium">Country</th>
                <th className="px-6 py-3 font-medium">Recurring</th>
                <th className="px-6 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.length > 0 ? (
                filtered.map((holiday) => (
                  <tr key={holiday.id}>
                    <td className="px-6 py-3">
                      {format(parseISO(holiday.date), "MMM d, yyyy")}
                    </td>
                    <td className="px-6 py-3 font-medium text-gray-900">
                      {holiday.name}
                    </td>
                    <td className="px-6 py-3">
                      <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {HOLIDAY_COUNTRY_LABELS[holiday.country as HolidayCountry]}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {holiday.is_recurring ? (
                        <span className="text-blue-600">Yes</span>
                      ) : (
                        <span className="text-gray-400">No</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      <button
                        onClick={() => handleDelete(holiday.id)}
                        disabled={deleting === holiday.id}
                        className="rounded p-1 text-red-500 hover:bg-red-50 disabled:opacity-50"
                        title="Delete holiday"
                      >
                        <Trash2 size={16} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={5}
                    className="px-6 py-8 text-center text-gray-500"
                  >
                    No holidays found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
