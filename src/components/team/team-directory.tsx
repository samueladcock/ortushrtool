"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  HOLIDAY_COUNTRY_LABELS,
  type HolidayCountry,
} from "@/types/database";
import { Search, LayoutGrid, List } from "lucide-react";
import { cn, displayName } from "@/lib/utils";

interface TeamUser {
  id: string;
  full_name: string;
  preferred_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string;
  department: string | null;
  job_title: string | null;
  location: string | null;
  holiday_country: HolidayCountry;
  is_active: boolean;
  end_date: string | null;
  manager_id: string | null;
  manager_name: string | null;
}

type EmploymentStatus = "active" | "inactive" | "terminated";

const STATUS_LABELS: Record<EmploymentStatus, string> = {
  active: "Active",
  inactive: "Inactive",
  terminated: "Terminated",
};

const STATUS_STYLES: Record<EmploymentStatus, string> = {
  active: "bg-green-100 text-green-700",
  inactive: "bg-gray-200 text-gray-700",
  terminated: "bg-red-100 text-red-700",
};

function statusFor(user: TeamUser): EmploymentStatus {
  const today = new Date().toISOString().slice(0, 10);
  if (user.end_date && user.end_date <= today) return "terminated";
  if (!user.is_active) return "inactive";
  return "active";
}

function getInitials(user: TeamUser): string {
  const name = displayName(user);
  return name && name !== "Unknown"
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : user.email[0].toUpperCase();
}

type ViewMode = "grid" | "list";

export function TeamDirectory({ users }: { users: TeamUser[] }) {
  const [search, setSearch] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [jobTitleFilter, setJobTitleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<EmploymentStatus | "all">(
    "active"
  );
  const [view, setView] = useState<ViewMode>("grid");

  const departments = useMemo(() => {
    const s = new Set<string>();
    for (const u of users) if (u.department) s.add(u.department);
    return Array.from(s).sort();
  }, [users]);

  const jobTitles = useMemo(() => {
    const s = new Set<string>();
    for (const u of users) if (u.job_title) s.add(u.job_title);
    return Array.from(s).sort();
  }, [users]);

  const countries = useMemo(() => {
    const s = new Set<HolidayCountry>();
    for (const u of users) if (u.holiday_country) s.add(u.holiday_country);
    return Array.from(s).sort();
  }, [users]);

  const filtered = useMemo(() => {
    let result = users;
    if (statusFilter !== "all") {
      result = result.filter((u) => statusFor(u) === statusFilter);
    }
    if (departmentFilter) {
      result = result.filter((u) => u.department === departmentFilter);
    }
    if (jobTitleFilter) {
      result = result.filter((u) => u.job_title === jobTitleFilter);
    }
    if (countryFilter) {
      result = result.filter((u) => u.holiday_country === countryFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(
        (u) =>
          displayName(u).toLowerCase().includes(q) ||
          u.full_name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          (u.department && u.department.toLowerCase().includes(q)) ||
          (u.job_title && u.job_title.toLowerCase().includes(q))
      );
    }
    return result;
  }, [
    users,
    statusFilter,
    departmentFilter,
    jobTitleFilter,
    countryFilter,
    search,
  ]);

  return (
    <div className="space-y-4">
      {/* View Toggle + Search & Filters */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div>
          <label className="block text-xs font-medium text-gray-600">View</label>
          <div className="mt-1 flex rounded-lg border border-gray-300">
            <button
              onClick={() => setView("grid")}
              className={cn(
                "flex items-center gap-1 rounded-l-lg px-3 py-2 text-sm",
                view === "grid"
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50"
              )}
              title="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn(
                "flex items-center gap-1 rounded-r-lg border-l border-gray-300 px-3 py-2 text-sm",
                view === "list"
                  ? "bg-blue-50 text-blue-700"
                  : "text-gray-600 hover:bg-gray-50"
              )}
              title="List view"
            >
              <List size={16} />
            </button>
          </div>
        </div>

        <div className="min-w-[200px] flex-1">
          <label className="block text-xs font-medium text-gray-600">
            Search
          </label>
          <div className="relative mt-1">
            <Search
              size={16}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, dept, or title..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-600">
            Status
          </label>
          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as EmploymentStatus | "all")
            }
            className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
            <option value="terminated">Terminated</option>
          </select>
        </div>

        {countries.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600">
              Country
            </label>
            <select
              value={countryFilter}
              onChange={(e) => setCountryFilter(e.target.value)}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {countries.map((c) => (
                <option key={c} value={c}>
                  {HOLIDAY_COUNTRY_LABELS[c]}
                </option>
              ))}
            </select>
          </div>
        )}

        {departments.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600">
              Department
            </label>
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {departments.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        )}

        {jobTitles.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-600">
              Position
            </label>
            <select
              value={jobTitleFilter}
              onChange={(e) => setJobTitleFilter(e.target.value)}
              className="mt-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">All</option>
              {jobTitles.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
        )}

        <p className="ml-auto text-sm text-gray-500">
          {filtered.length} {filtered.length === 1 ? "person" : "people"}
        </p>
      </div>

      {/* Content */}
      {view === "list" ? (
        <ListView users={filtered} />
      ) : (
        <GridView users={filtered} />
      )}
    </div>
  );
}

/* ─── Grid View ─── */

function GridView({ users }: { users: TeamUser[] }) {
  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
        No people found matching your search.
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {users.map((user) => {
        const status = statusFor(user);
        return (
          <Link
            key={user.id}
            href={`/team/${user.id}`}
            className="rounded-xl border border-gray-200 bg-white p-4 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-100 text-sm font-semibold text-blue-700">
                {getInitials(user)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-medium text-gray-900">
                    {displayName(user)}
                  </p>
                  {status !== "active" && (
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_STYLES[status]}`}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-gray-500">{user.email}</p>
                {user.job_title && (
                  <p className="mt-1 truncate text-xs text-gray-600">
                    {user.job_title}
                  </p>
                )}
                {(user.department ||
                  user.location ||
                  user.holiday_country) && (
                  <p className="mt-0.5 truncate text-xs text-gray-500">
                    {[
                      user.department,
                      user.location,
                      HOLIDAY_COUNTRY_LABELS[user.holiday_country],
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                )}
                {user.manager_name && user.manager_id && (
                  <p className="mt-2 text-xs text-gray-400">
                    Reports to{" "}
                    <Link
                      href={`/team/${user.manager_id}`}
                      className="text-blue-600 hover:underline"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {user.manager_name}
                    </Link>
                  </p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

/* ─── List View ─── */

function ListView({ users }: { users: TeamUser[] }) {
  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-center text-gray-500">
        No people found matching your search.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left">
              <th className="px-6 py-3 font-medium text-gray-600">Name</th>
              <th className="px-6 py-3 font-medium text-gray-600">Email</th>
              <th className="px-6 py-3 font-medium text-gray-600">Position</th>
              <th className="px-6 py-3 font-medium text-gray-600">Department</th>
              <th className="px-6 py-3 font-medium text-gray-600">Country</th>
              <th className="px-6 py-3 font-medium text-gray-600">Location</th>
              <th className="px-6 py-3 font-medium text-gray-600">Reports To</th>
              <th className="px-6 py-3 font-medium text-gray-600">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {users.map((user) => {
              const status = statusFor(user);
              return (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <Link
                      href={`/team/${user.id}`}
                      className="flex items-center gap-3"
                    >
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-700">
                        {getInitials(user)}
                      </div>
                      <span className="font-medium text-gray-900 hover:text-blue-600">
                        {displayName(user)}
                      </span>
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-gray-600">{user.email}</td>
                  <td className="px-6 py-3 text-gray-600">
                    {user.job_title || "—"}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {user.department || "—"}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {HOLIDAY_COUNTRY_LABELS[user.holiday_country] ?? "—"}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {user.location || "—"}
                  </td>
                  <td className="px-6 py-3 text-gray-600">
                    {user.manager_name && user.manager_id ? (
                      <Link
                        href={`/team/${user.manager_id}`}
                        className="text-blue-600 hover:underline"
                      >
                        {user.manager_name}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-6 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
                    >
                      {STATUS_LABELS[status]}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
