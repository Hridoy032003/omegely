"use client";

import { useEffect, useState } from "react";
import { useAdmin } from "@/lib/admin-store";
import { Panel, PanelHead, formatCoins } from "@/components/ui";

type Settings = {
  withdrawals_enabled: boolean;
  withdrawal_minimum_coins: number;
  connection_rewards_enabled: boolean;
  referral_rewards_enabled: boolean;
  connection_reward_coins: number;
  referral_reward_coins: number;
  daily_connection_reward_limit: number;
  referral_qualification_days: number;
  mutual_connection_required: boolean;
  coin_sends_enabled: boolean;
  minimum_send_coins: number;
  daily_send_limit_coins: number;
  daily_send_count_limit: number;
};

const DEFAULTS: Settings = {
  withdrawals_enabled: true,
  withdrawal_minimum_coins: 5000,
  connection_rewards_enabled: true,
  referral_rewards_enabled: true,
  connection_reward_coins: 10,
  referral_reward_coins: 100,
  daily_connection_reward_limit: 100,
  referral_qualification_days: 7,
  mutual_connection_required: true,
  coin_sends_enabled: true,
  minimum_send_coins: 1,
  daily_send_limit_coins: 100000,
  daily_send_count_limit: 20,
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
              description="Issue the configured coins when a completed connection ends."
              checked={draft.connection_rewards_enabled}
              disabled={loading}
              onChange={(value) => set("connection_rewards_enabled", value)}
            />
            <Toggle
              label="Referral rewards enabled"
              description="Issue the configured reward after the qualification window."
              checked={draft.referral_rewards_enabled}
              disabled={loading}
              onChange={(value) => set("referral_rewards_enabled", value)}
            />
            <Toggle
              label="Coin sending enabled"
              description="Allow registered members to send available coins to each other."
              checked={draft.coin_sends_enabled}
              disabled={loading}
              onChange={(value) => set("coin_sends_enabled", value)}
            />
            <Toggle
              label="Mutual connection required"
              description="Keep rewards tied to a completed two-person connection."
              checked={draft.mutual_connection_required}
              disabled={loading}
              onChange={(value) => set("mutual_connection_required", value)}
            />
          </div>
        </Panel>

        <Panel>
          <PanelHead
            title="Wallet policy"
            description="Control earning, sending, and withdrawal limits."
          />
          <div className="panel-body grid">
            <div className="grid grid--halves">
              <div className="field">
                <label htmlFor="connection-reward-coins">Connection reward</label>
                <input id="connection-reward-coins" className="input" type="number" min="1" max="1000" step="1" disabled={loading} value={draft.connection_reward_coins} onChange={(event) => set("connection_reward_coins", Number(event.target.value))} />
                <span className="field-hint">Coins issued after a completed connection.</span>
              </div>
              <div className="field">
                <label htmlFor="daily-connection-limit">Daily connection cap</label>
                <input id="daily-connection-limit" className="input" type="number" min="1" max="10000" step="1" disabled={loading} value={draft.daily_connection_reward_limit} onChange={(event) => set("daily_connection_reward_limit", Number(event.target.value))} />
                <span className="field-hint">Maximum connection coins per user per day.</span>
              </div>
              <div className="field">
                <label htmlFor="referral-reward-coins">Referral reward</label>
                <input id="referral-reward-coins" className="input" type="number" min="1" max="5000" step="1" disabled={loading} value={draft.referral_reward_coins} onChange={(event) => set("referral_reward_coins", Number(event.target.value))} />
                <span className="field-hint">Paid only after the referral qualifies.</span>
              </div>
              <div className="field">
                <label htmlFor="referral-qualification-days">Referral qualification days</label>
                <input id="referral-qualification-days" className="input" type="number" min="1" max="30" step="1" disabled={loading} value={draft.referral_qualification_days} onChange={(event) => set("referral_qualification_days", Number(event.target.value))} />
                <span className="field-hint">The referred user must return after this window.</span>
              </div>
              <div className="field">
                <label htmlFor="minimum-send-coins">Minimum send</label>
                <input id="minimum-send-coins" className="input" type="number" min="1" max="100000" step="1" disabled={loading} value={draft.minimum_send_coins} onChange={(event) => set("minimum_send_coins", Number(event.target.value))} />
                <span className="field-hint">Smallest coin send a member can submit.</span>
              </div>
              <div className="field">
                <label htmlFor="daily-send-limit">Daily send amount</label>
                <input id="daily-send-limit" className="input" type="number" min="1" max="10000000" step="1" disabled={loading} value={draft.daily_send_limit_coins} onChange={(event) => set("daily_send_limit_coins", Number(event.target.value))} />
                <span className="field-hint">Maximum coins one member can send in 24 hours.</span>
              </div>
              <div className="field">
                <label htmlFor="daily-send-count">Daily send count</label>
                <input id="daily-send-count" className="input" type="number" min="1" max="100" step="1" disabled={loading} value={draft.daily_send_count_limit} onChange={(event) => set("daily_send_count_limit", Number(event.target.value))} />
                <span className="field-hint">Maximum completed sends per member in 24 hours.</span>
              </div>
            </div>
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
