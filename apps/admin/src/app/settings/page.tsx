"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/admin-store";
import { Panel, PanelHead, formatCoins } from "@/components/ui";

type Settings = {
  withdrawals_enabled: boolean;
  withdrawal_minimum_coins: number;
  connection_rewards_enabled: boolean;
  referral_rewards_enabled: boolean;
};

const DEFAULTS: Settings = {
  withdrawals_enabled: true,
  withdrawal_minimum_coins: 5000,
  connection_rewards_enabled: true,
  referral_rewards_enabled: true,
};

export default function SettingsPage() {
  const { session, setMessage } = useAdmin();
  const [saved, setSaved] = useState<Settings>(DEFAULTS);
  const [draft, setDraft] = useState<Settings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    void fetch("/api/admin/settings", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      cache: "no-store",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(((await response.json().catch(() => ({}))) as { error?: string }).error || "Could not load settings.");
        }
        const next = (await response.json()) as Settings;
        setSaved(next);
        setDraft(next);
      })
      .catch((error: Error) => setMessage({ tone: "error", text: error.message }))
      .finally(() => setLoading(false));
  }, [session.access_token, setMessage]);

  const dirty = JSON.stringify(saved) !== JSON.stringify(draft);

  const save = async () => {
    setSaving(true);
    setMessage(null);
    const response = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(draft),
    });
    if (response.ok) {
      const next = (await response.json()) as Settings;
      setSaved(next);
      setDraft(next);
      setMessage({ tone: "success", text: "Settings saved." });
    } else {
      setMessage({
        tone: "error",
        text: ((await response.json().catch(() => ({}))) as { error?: string }).error || "Could not save settings.",
      });
    }
    setSaving(false);
  };

  const set = <K extends keyof Settings>(key: K, value: Settings[K]) =>
    setDraft((current) => ({ ...current, [key]: value }));

  return (
    <>
      <div className="grid grid--halves">
        <Panel>
          <PanelHead
            title="Global controls"
            description="Pause rewards or change withdrawal rules without redeploying."
          />
          <div className="panel-body" style={{ paddingTop: 4, paddingBottom: 4 }}>
            <Toggle
              label="Withdrawals enabled"
              description="Allow users to submit new payout requests."
              checked={draft.withdrawals_enabled}
              disabled={loading}
              onChange={(value) => set("withdrawals_enabled", value)}
            />
            <Toggle
              label="Connection rewards enabled"
              description="Issue 10 coins when a completed connection ends."
              checked={draft.connection_rewards_enabled}
              disabled={loading}
              onChange={(value) => set("connection_rewards_enabled", value)}
            />
            <Toggle
              label="Referral rewards enabled"
              description="Issue 100 coins for each qualified referral."
              checked={draft.referral_rewards_enabled}
              disabled={loading}
              onChange={(value) => set("referral_rewards_enabled", value)}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title="Withdrawal policy"
            description="Users must reach this balance before they can request a payout."
          />
          <div className="panel-body grid">
            <div className="field">
              <label htmlFor="minimum-coins">Minimum withdrawal coins</label>
              <input
                id="minimum-coins"
                className="input"
                type="number"
                min="100"
                step="100"
                disabled={loading}
                value={draft.withdrawal_minimum_coins}
                onChange={(event) => set("withdrawal_minimum_coins", Number(event.target.value))}
              />
              <span className="field-hint">Must be a whole number of coins divisible by 100.</span>
            </div>
            <p className="muted" style={{ margin: 0 }}>
              Current threshold{" "}
              <strong className="mono" style={{ color: "var(--ink)" }}>
                {formatCoins(draft.withdrawal_minimum_coins)} coins
              </strong>
            </p>
          </div>
        </Panel>
      </div>

      {/* One save action for the whole page — the toggles and the threshold used
          to live in separate panels with the only button under the second. */}
      <Panel>
        <div className="panel-body" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 16 }}>
          <button type="button" className="btn btn--primary" disabled={loading || saving || !dirty} onClick={() => void save()}>
            {saving ? "Saving…" : "Save settings"}
          </button>
          <button
            type="button"
            className="btn btn--outline"
            disabled={loading || saving || !dirty}
            onClick={() => setDraft(saved)}
          >
            Discard changes
          </button>
          <span className="muted">
            {loading ? "Loading current settings…" : dirty ? "You have unsaved changes." : "All changes saved."}
          </span>
        </div>
      </Panel>
    </>
  );
}

function Toggle({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="toggle">
      <span>
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <i aria-hidden="true" />
    </label>
  );
}
