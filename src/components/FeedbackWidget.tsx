"use client";

import { FormEvent, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase-browser";

type FeedbackKind = "feedback" | "bug" | "safety";

const KIND_LABELS: Record<FeedbackKind, string> = {
  feedback: "General feedback",
  bug: "Report a bug",
  safety: "Safety concern",
};

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<FeedbackKind>("feedback");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 5) {
      setNotice("Please add a little more detail so we can help.");
      return;
    }

    setBusy(true);
    setNotice("");
    const { error } = await supabase.from("feedback").insert({
      user_id: userId,
      email: email.trim() || null,
      kind,
      message: trimmed,
      page_url: window.location.href,
    });

    if (error) {
      setNotice(error.message);
    } else {
      setMessage("");
      setNotice("Thanks — your message was sent to the Omegley team.");
    }
    setBusy(false);
  };

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => {
            setNotice("");
            setOpen(true);
          }}
          className="fixed bottom-20 right-4 z-[55] rounded-full border border-white/15 bg-neutral-900/95 px-3.5 py-2 text-xs font-medium text-neutral-200 shadow-xl shadow-black/30 backdrop-blur transition hover:border-indigo-400/50 hover:text-white md:bottom-5"
          aria-label="Send feedback or report an issue"
        >
          Feedback / report
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            className="w-full max-w-lg rounded-2xl border border-white/10 bg-neutral-950 p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-indigo-300">Omegley support</p>
                <h2 id="feedback-title" className="mt-2 text-xl font-semibold text-white">How can we improve?</h2>
                <p className="mt-1 text-sm text-neutral-400">Send feedback or report an issue. You can submit without an account.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg px-2 py-1 text-xl leading-none text-neutral-500 hover:bg-white/10 hover:text-white"
                aria-label="Close feedback form"
              >
                ×
              </button>
            </div>

            <form onSubmit={submit} className="mt-5 space-y-3">
              <label className="block text-sm text-neutral-300">
                Type
                <select
                  value={kind}
                  onChange={(event) => setKind(event.target.value as FeedbackKind)}
                  style={{ colorScheme: "dark" }}
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none focus:border-indigo-400"
                >
                  {Object.entries(KIND_LABELS).map(([value, label]) => (
                    <option key={value} value={value} style={{ backgroundColor: "#111119", color: "#ffffff" }}>{label}</option>
                  ))}
                </select>
              </label>
              <label className="block text-sm text-neutral-300">
                Message
                <textarea
                  required
                  minLength={5}
                  maxLength={4000}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Tell us what happened or what you would like to see."
                  className="mt-1.5 min-h-32 w-full resize-y rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-indigo-400"
                />
              </label>
              <label className="block text-sm text-neutral-300">
                Contact email <span className="text-neutral-600">(optional)</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className="mt-1.5 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-neutral-600 focus:border-indigo-400"
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <p className="text-xs text-neutral-500" role="status">{notice}</p>
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-full bg-indigo-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-wait disabled:opacity-60"
                >
                  {busy ? "Sending…" : "Send message"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
