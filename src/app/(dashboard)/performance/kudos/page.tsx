import { getCurrentUser } from "@/lib/auth/helpers";
import { createAdminClient } from "@/lib/supabase/admin";
import { Heart, Lock } from "lucide-react";
import { format, parseISO } from "date-fns";
import { displayName } from "@/lib/utils";
import type { KudosWithUsers } from "@/types/database";

export default async function PerformanceKudosPage() {
  const user = await getCurrentUser();
  const admin = createAdminClient();
  const { data: rows } = await admin
    .from("kudos")
    .select(
      "*, sender:users!kudos_sender_id_fkey(full_name, preferred_name, email), recipient:users!kudos_recipient_id_fkey(full_name, preferred_name, email)"
    )
    .eq("recipient_id", user.id)
    .order("created_at", { ascending: false });
  type RawKudosRow = Omit<KudosWithUsers, "sender" | "recipient"> & {
    sender: Array<{ full_name: string; preferred_name: string | null; email: string }> | null;
    recipient: Array<{ full_name: string; preferred_name: string | null; email: string }> | null;
  };
  const kudos = ((rows ?? []) as unknown as RawKudosRow[]).map((k) => ({
    ...k,
    sender:
      Array.isArray(k.sender) && k.sender.length > 0 ? k.sender[0] : null,
    recipient:
      Array.isArray(k.recipient) && k.recipient.length > 0 ? k.recipient[0] : null,
  }));

  if (kudos.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center text-sm text-gray-500">
        No kudos yet. They&apos;ll show up here when a teammate recognizes you.
      </div>
    );
  }

  return (
    <ul className="space-y-2">
      {kudos.map((k) => (
        <li
          key={k.id}
          className="rounded-xl border border-gray-200 bg-white p-4"
        >
          <p className="text-sm text-gray-800">
            <Heart
              size={14}
              className="mr-1 inline -translate-y-0.5 text-rose-500"
            />
            {k.message}
          </p>
          <p className="mt-1 flex items-center gap-1.5 text-[11px] text-gray-500">
            {k.visibility === "private" && <Lock size={10} />}
            from{" "}
            <strong className="text-gray-700">
              {displayName(k.sender ?? null)}
            </strong>{" "}
            · {format(parseISO(k.created_at), "MMM d, yyyy")}
          </p>
        </li>
      ))}
    </ul>
  );
}
