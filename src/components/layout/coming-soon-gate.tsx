"use client";

import { usePathname } from "next/navigation";
import { COMING_SOON_ROUTES } from "@/lib/coming-soon";
import { ComingSoon } from "./coming-soon";
import type { UserRole } from "@/types/database";

export function ComingSoonGate({
  userRole,
  children,
}: {
  userRole: UserRole;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const isComingSoon =
    userRole !== "super_admin" &&
    COMING_SOON_ROUTES.some(
      (route) => pathname === route || pathname.startsWith(route + "/")
    );

  if (isComingSoon) return <ComingSoon />;
  return <>{children}</>;
}
