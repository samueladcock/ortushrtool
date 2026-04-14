import type { UserRole } from "@/types/database";

export const ROLE_HIERARCHY: Record<UserRole, number> = {
  employee: 0,
  manager: 1,
  hr_admin: 2,
  super_admin: 3,
};

export const DAYS_OF_WEEK = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

export const DEFAULT_TOLERANCE_MINUTES = 15;

export const LEAVE_TYPES = {
  anniversary: { label: "Anniversary Leave", universal: true },
  annual: { label: "Annual Leave", universal: true },
  birthday: { label: "Birthday Leave", universal: true },
  cto: { label: "CTO Leave", universal: true },
  trinity: { label: "Trinity Leave", universal: true },
  maternity_paternity: { label: "Maternity/Paternity Leave", universal: false },
  solo_parent: { label: "Solo Parent Leave", universal: false },
  bereavement: { label: "Bereavement Leave", universal: false },
} as const;

export const UNIVERSAL_LEAVE_TYPES = Object.entries(LEAVE_TYPES)
  .filter(([, v]) => v.universal)
  .map(([k]) => k);

export const ACTIVATABLE_LEAVE_TYPES = Object.entries(LEAVE_TYPES)
  .filter(([, v]) => !v.universal)
  .map(([k]) => k);

export const LEAVE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  Object.entries(LEAVE_TYPES).map(([k, v]) => [k, v.label])
);

export const MANILA_TIMEZONE = "Asia/Manila";
