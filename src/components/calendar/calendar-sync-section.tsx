"use client";

import { useState } from "react";
import { ChevronDown, CalendarSync } from "lucide-react";
import { CalendarSyncForm } from "./calendar-sync-form";
import type { HolidayCountry, UserRole } from "@/types/database";

export function CalendarSyncSection({
  initialToken,
  appUrl,
  userRole,
  defaultCountry,
}: {
  initialToken: string | null;
  appUrl: string;
  userRole: UserRole;
  defaultCountry: HolidayCountry;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2 text-left">
          <CalendarSync size={16} className="text-gray-500" />
          <div>
            <p className="text-sm font-medium text-gray-900">
              Subscribe in Google Calendar
            </p>
            <p className="text-xs text-gray-500">
              Sync birthdays, leaves, holidays, and more to your personal calendar.
            </p>
          </div>
        </div>
        <ChevronDown
          size={16}
          className={`text-gray-400 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="border-t border-gray-100 p-4">
          <CalendarSyncForm
            initialToken={initialToken}
            appUrl={appUrl}
            userRole={userRole}
            defaultCountry={defaultCountry}
          />
        </div>
      )}
    </div>
  );
}
