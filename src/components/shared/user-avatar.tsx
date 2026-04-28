import Link from "next/link";

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

const sizeClasses = {
  xs: "h-6 w-6 text-[10px]",
  sm: "h-7 w-7 text-[10px]",
  md: "h-9 w-9 text-xs",
  lg: "h-16 w-16 text-xl",
} as const;

export function UserAvatar({
  name,
  avatarUrl,
  size = "md",
  className = "",
  userId,
}: {
  name: string;
  avatarUrl?: string | null;
  size?: keyof typeof sizeClasses;
  className?: string;
  /** When provided, the avatar becomes a link to /team/{userId}. */
  userId?: string | null;
}) {
  const initials = getInitials(name || "?");
  const sizeClass = sizeClasses[size];

  const inner = avatarUrl ? (
    <img
      src={avatarUrl}
      alt={name}
      className={`${sizeClass} shrink-0 rounded-full object-cover ${className}`}
    />
  ) : (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full bg-blue-100 font-semibold text-blue-700 ${className}`}
    >
      {initials}
    </div>
  );

  if (userId) {
    return (
      <Link
        href={`/team/${userId}`}
        aria-label={`View ${name}'s profile`}
        className="inline-block transition-opacity hover:opacity-80"
      >
        {inner}
      </Link>
    );
  }

  return inner;
}
