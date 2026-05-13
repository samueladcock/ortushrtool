"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save, Send, Star, X } from "lucide-react";
import type { ReviewFormTemplate, ReviewResponses } from "@/types/database";

export function PeerFeedbackForm({
  requestId,
  template,
  initialResponse,
  initialAnonymous,
  alreadyCompleted,
}: {
  requestId: string;
  template: ReviewFormTemplate;
  initialResponse: ReviewResponses;
  initialAnonymous: boolean;
  alreadyCompleted: boolean;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState<ReviewResponses>(() => ({ ...initialResponse }));
  const [anonymous, setAnonymous] = useState(initialAnonymous);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const questions = template.questions.filter((q) => q.roles.includes("peer"));

  const setRating = (qid: string, rating: number) =>
    setDraft({
      ...draft,
      [qid]: { rating, comment: draft[qid]?.comment ?? "" },
    });
  const setComment = (qid: string, comment: string) =>
    setDraft({
      ...draft,
      [qid]: { rating: draft[qid]?.rating ?? null, comment },
    });

  const send = async (
    action: "save" | "submit" | "decline"
  ) => {
    setBusy(true);
    setError(null);
    const body =
      action === "decline"
        ? { status: "declined" }
        : action === "submit"
          ? { response: draft, anonymous, status: "completed" }
          : { response: draft, anonymous };
    const res = await fetch(`/api/peer-feedback/${requestId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setBusy(false);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Save failed");
      return;
    }
    router.push("/performance");
    router.refresh();
  };

  if (alreadyCompleted) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6 text-sm text-emerald-900">
        You&apos;ve already submitted this peer feedback. Thanks!
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">
        This template has no peer-role questions. Nothing to fill in.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
      )}

      <div className="space-y-4">
        {questions.map((q) => {
          const v = draft[q.id];
          return (
            <div key={q.id} className="rounded-lg border border-gray-200 p-4">
              <p className="text-sm font-medium text-gray-900">{q.text}</p>
              <div className="mt-2 flex gap-0.5">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(q.id, n)}
                    className="cursor-pointer p-0.5"
                  >
                    <Star
                      size={18}
                      className={
                        (v?.rating ?? 0) >= n
                          ? "fill-amber-400 text-amber-400"
                          : "text-gray-300"
                      }
                    />
                  </button>
                ))}
              </div>
              <textarea
                value={v?.comment ?? ""}
                onChange={(e) => setComment(q.id, e.target.value)}
                rows={3}
                placeholder="Comment…"
                className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-1.5 text-sm"
              />
            </div>
          );
        })}
      </div>

      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={anonymous}
          onChange={(e) => setAnonymous(e.target.checked)}
          className="h-4 w-4 rounded border-gray-300"
        />
        Submit anonymously
      </label>

      <div className="flex flex-wrap gap-2 border-t border-gray-100 pt-4">
        <button
          type="button"
          onClick={() => send("save")}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          <Save size={12} /> Save draft
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirm("Submit your peer feedback? You can't edit it after this.")) return;
            send("submit");
          }}
          disabled={busy}
          className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          <Send size={12} /> Submit feedback
        </button>
        <button
          type="button"
          onClick={() => {
            if (!confirm("Decline this feedback request?")) return;
            send("decline");
          }}
          disabled={busy}
          className="ml-auto flex items-center gap-1 rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          <X size={12} /> Decline
        </button>
      </div>
    </div>
  );
}
