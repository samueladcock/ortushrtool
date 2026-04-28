import Link from "next/link";

/**
 * Renders a user's name as a link to their profile page (/team/{userId}).
 * Falls back to a plain span when userId is missing — keeps callers ergonomic
 * when the upstream data is unreliable.
 */
export function UserNameLink({
  userId,
  name,
  className = "",
}: {
  userId: string | null | undefined;
  name: string;
  className?: string;
}) {
  if (!userId) {
    return <span className={className}>{name}</span>;
  }
  return (
    <Link
      href={`/team/${userId}`}
      className={`hover:text-blue-600 hover:underline ${className}`}
    >
      {name}
    </Link>
  );
}
