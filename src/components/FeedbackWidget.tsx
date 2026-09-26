"use client";

import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase-browser";
import { useConsentResolved } from "@/lib/consent";
import { Button, CONTROL, Field, Notice } from "@/components/ui";

type FeedbackKind = "feedback" | "bug" | "safety";
type FeedbackTopic = "video" | "audio" | "matching" | "report" | "suggestion" | "other";

const TOPICS: Array<{ value: FeedbackTopic; label: string; kind: FeedbackKind }> = [
  { value: "video", label: "Video is not working", kind: "bug" },
  { value: "audio", label: "Microphone or audio issue", kind: "bug" },
  { value: "matching", label: "I cannot find a match", kind: "bug" },
  { value: "report", label: "Report a user or safety issue", kind: "safety" },
  { value: "suggestion", label: "Suggest an improvement", kind: "feedback" },
  { value: "other", label: "Other", kind: "feedback" },
];

export default function FeedbackWidget() {
  const consentResolved = useConsentResolved();
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState<FeedbackTopic>("video");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const launcherRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    launcherRef.current?.focus();
  }, []);

  // Escape to close, focus moved into the dialog, and the page behind it locked.
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.querySelector<HTMLElement>("select, textarea, button")?.focus();
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, close]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = message.trim();
    if (trimmed.length < 5) {
      setNotice({ tone: "error", text: "Please add a little more detail so we can help." });
      return;
    }

    setBusy(true);
    setNotice(null);
    const selectedTopic = TOPICS.find((item) => item.value === topic) ?? TOPICS[0];
    const { error } = await supabase.from("feedback").insert({
      user_id: userId,
      email: email.trim() || null,
      kind: selectedTopic.kind,
      message: `[${selectedTopic.label}] ${trimmed}`.slice(0, 4000),
      page_url: window.location.href,
    });

    if (error) setNotice({ tone: "error", text: error.message });
    else {
      setMessage("");
      setNotice({ tone: "success", text: "Thanks — your message was sent to the Omegley team." });
    }
    setBusy(false);
  };

  if (!consentResolved) return null;

  return (
    <>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => {
            setNotice(null);
            setOpen(true);
          }}
          // Below the mobile chat sheet (z-50) so it can never float over it.
          className="fixed bottom-4 right-4 z-40 rounded-full border border-line-hi bg-panel/95 px-3.5 py-2 text-2xs font-medium text-ink-2 shadow-xl shadow-black/30 backdrop-blur transition hover:border-brand/50 hover:text-ink"
        >
          Feedback / report
        </button>
      )}

      {open && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center">
          <button
            type="button"
            aria-label="Close feedback form"
            className="absolute inset-0 cursor-default"
            onClick={close}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
            className="relative w-full max-w-lg rounded-panel border border-line bg-panel p-5 shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="eyebrow">Omegley support</p>
                <h2 id="feedback-title" className="mt-2 font-display text-xl font-semibold text-ink">
                  How can we improve?
                </h2>
                <p className="mt-1.5 text-sm text-ink-3">
                  Send feedback or report an issue. You can submit without an account.
                </p>
              </div>
              <button
                type="button"
                onClick={close}
                className="rounded-lg px-2 py-1 text-xl leading-none text-ink-4 transition hover:bg-white/10 hover:text-ink"
                aria-label="Close feedback form"
              >
                ×
              </button>
            </div>

            <form onSubmit={submit} className="mt-6 grid gap-4">
              <Field label="What do you need help with?" htmlFor="feedback-topic">
                <select
                  id="feedback-topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value as FeedbackTopic)}
                  className={CONTROL}
                >
                  {TOPICS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>

              <Field label="Message" htmlFor="feedback-message">
                <textarea
                  id="feedback-message"
                  required
                  minLength={5}
                  maxLength={4000}
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Tell us what happened or what you would like to see."
                  className={`${CONTROL} min-h-32 resize-y`}
                />
              </Field>

              <Field label="Contact email" hint="Optional" htmlFor="feedback-email">
                <input
                  id="feedback-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  className={CONTROL}
                />
              </Field>

              {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}

              <div className="flex flex-wrap items-center justify-end gap-3 pt-1">
                <Button type="button" variant="ghost" size="sm" onClick={close}>
                  {notice?.tone === "success" ? "Done" : "Cancel"}
                </Button>
                <Button type="submit" variant="brand" disabled={busy}>
                  {busy ? "Sending…" : "Send message"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
