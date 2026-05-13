"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type PerfTab = { label: string; href: string };

export function PerformanceTabs({ tabs }: { tabs: PerfTab[] }) {
  const pathname = usePathname();
  return (
    <div className="flex flex-wrap gap-1 border-b border-gray-200">
      {tabs.map((t) => {
        const isActive =
          t.href === pathname ||
          (t.href !== tabs[0].href && pathname.startsWith(t.href));
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "border-blue-600 text-blue-700"
                : "border-transparent text-gray-600 hover:text-gray-900"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </div>
  );
}
