"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAdmin } from "@/lib/admin-store";
import { Coins, Users } from "@/components/icons";
import {
  Badge,
  EmptyRow,
  Kpi,
  Panel,
  PanelHead,
  Table,
  formatCoins,
  formatDate,
  formatDollars,
  initial,
} from "@/components/ui";

const WITHDRAWAL_TONE = {
  paid: "positive",
  approved: "positive",
  pending: "caution",
  rejected: "critical",
} as const;

export default function EarningsPage() {
  const { data, busy, patch } = useAdmin();
  const usersById = new Map(data.users.map((user) => [user.id, user]));
  const topEarners = [...data.users]
    .filter((user) => user.total_earned > 0)
    .sort((a, b) => Number(b.total_earned) - Number(a.total_earned));

  return (
    <>
      <div className="grid grid--halves">
        <Kpi
          label="Coins issued"
          value={formatCoins(data.counts.coinsIssued)}
          hint={`${formatDollars(data.counts.coinsIssued)} of lifetime reward value`}
          icon={<Coins />}
        />
        <Kpi
          label="Qualified referrals"
          value={formatCoins(data.counts.referrals)}
          hint="Successful invites recorded"
          icon={<Users />}
        />
      </div>

      <CreditForm />

      <Panel>
        <PanelHead
          title="Referral earnings"
          description="Every qualified referral creates a one-time 100 coin reward ($1.00)."
          action={<span className="muted">{data.referrals.length} shown</span>}
        />
        <Table head={["Referrer", "Referred user", "Reward", "Status", "Created"]}>
          {data.referrals.map((referral) => (
            <tr key={referral.id}>
              <td>
                <div className="cell-user">
                  <span className="avatar" aria-hidden="true">
                    {initial(usersById.get(referral.referrer_id)?.email)}
                  </span>
                  <span>
                    <span className="cell-title">
                      {usersById.get(referral.referrer_id)?.email || referral.referrer_id.slice(0, 8)}
                    </span>
                    <span className="cell-sub">Code: {referral.referral_code}</span>
                  </span>
                </div>
              </td>
              <td>{usersById.get(referral.referred_id)?.email || referral.referred_id.slice(0, 8)}</td>
              <td className="mono">
                {formatCoins(referral.reward_coins)} coins · {formatDollars(referral.reward_coins)}
              </td>
              <td>
                <Badge tone={referral.status === "qualified" ? "positive" : "neutral"}>
                  {referral.status}
                </Badge>
              </td>
              <td>{formatDate(referral.created_at)}</td>
            </tr>
          ))}
          {!data.referrals.length && <EmptyRow colSpan={5} text="No referral earnings yet." />}
        </Table>
      </Panel>

      <Panel>
        <PanelHead
          title="Top earners"
          description="Users with the highest lifetime referral and connection earnings."
        />
        <Table head={["User", "Referral code", "Balance", "Lifetime earned"]}>
          {topEarners.map((user) => (
            <tr key={user.id}>
              <td>
                <span className="cell-title">{user.email || "Anonymous"}</span>
              </td>
              <td className="mono">{user.referral_code || "—"}</td>
              <td className="mono">
                {formatCoins(user.coin_balance)} coins · {formatDollars(user.coin_balance)}
              </td>
              <td className="mono">
                {formatCoins(user.total_earned)} coins · {formatDollars(user.total_earned)}
              </td>
            </tr>
          ))}
          {!topEarners.length && <EmptyRow colSpan={4} text="No earners yet." />}
        </Table>
      </Panel>

      <Panel>
        <PanelHead
          title="Withdrawal queue"
          description="Review gift-card and cash-pending requests."
          action={<span className="muted">{data.withdrawals.length} total</span>}
        />
        <Table head={["User", "Amount", "Method", "Destination", "Status", "Action"]}>
          {data.withdrawals.map((withdrawal) => {
            const open = withdrawal.status === "pending" || withdrawal.status === "approved";
            const decide = (status: string) =>
              void patch(`/api/admin/withdrawals/${withdrawal.id}`, { status });
            return (
              <tr key={withdrawal.id}>
                <td className="mono">
                  {usersById.get(withdrawal.user_id)?.email || withdrawal.user_id.slice(0, 8)}
                </td>
                <td className="mono">
                  {formatCoins(withdrawal.amount_coins)} coins · ${Number(withdrawal.amount_usd).toFixed(2)}
                </td>
                <td>{withdrawal.method === "gift_card" ? "Omegley gift card" : "Cash pending"}</td>
                <td>{withdrawal.destination}</td>
                <td>
                  <Badge
                    tone={
                      WITHDRAWAL_TONE[withdrawal.status as keyof typeof WITHDRAWAL_TONE] ?? "neutral"
                    }
                  >
                    {withdrawal.status}
                  </Badge>
                </td>
                <td>
                  {open ? (
                    <div className="row-actions">
                      {withdrawal.status === "pending" && (
                        <button
                          type="button"
                          className="btn btn--outline btn--sm"
                          disabled={busy}
                          onClick={() => decide("approved")}
                        >
                          Approve
                        </button>
                      )}
                      {withdrawal.status === "approved" && (
                        <button
                          type="button"
                          className="btn btn--primary btn--sm"
                          disabled={busy}
                          onClick={() => decide("paid")}
                        >
                          Mark paid
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn--danger btn--sm"
                        disabled={busy}
                        onClick={() => decide("rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
          {!data.withdrawals.length && <EmptyRow colSpan={6} text="No withdrawal requests yet." />}
        </Table>
      </Panel>
    </>
  );
}

function CreditForm() {
  const { data, busy, post, setMessage } = useAdmin();
  const [userId, setUserId] = useState("");
  const [amount, setAmount] = useState("10");
  const [reason, setReason] = useState("Admin bonus");

  // The user list arrives after the first render, so the default has to follow
  // it — otherwise the form posts an empty user_id.
  useEffect(() => {
    setUserId((current) => (current && data.users.some((u) => u.id === current) ? current : data.users[0]?.id ?? ""));
  }, [data.users]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const coins = Number(amount);
    if (!userId) {
      setMessage({ tone: "error", text: "Choose a user to credit." });
      return;
    }
    if (!Number.isInteger(coins) || coins <= 0) {
      setMessage({ tone: "error", text: "Enter a whole number of coins above zero." });
      return;
    }
    const ok = await post("/api/admin/earnings/credit", {
      user_id: userId,
      amount_coins: coins,
      message: reason,
    });
    if (ok) setMessage({ tone: "success", text: `Credited ${formatCoins(coins)} coins.` });
  };

  return (
    <Panel>
      <PanelHead title="Issue bonus coins" description="Credit a user with a labeled admin adjustment." />
      <form onSubmit={submit} className="panel-body grid grid--thirds" style={{ alignItems: "end" }}>
        <div className="field">
          <label htmlFor="credit-user">User</label>
          <select
            id="credit-user"
            className="select"
            value={userId}
            disabled={!data.users.length}
            onChange={(event) => setUserId(event.target.value)}
          >
            {data.users.length ? (
              data.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email || user.id.slice(0, 8)}
                </option>
              ))
            ) : (
              <option value="">No users loaded</option>
            )}
          </select>
        </div>
        <div className="field">
          <label htmlFor="credit-amount">Coins</label>
          <input
            id="credit-amount"
            className="input"
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
          <span className="field-hint">{formatDollars(Number(amount) || 0)} of reward value</span>
        </div>
        <div className="field">
          <label htmlFor="credit-reason">Reason</label>
          <input
            id="credit-reason"
            className="input"
            required
            maxLength={240}
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <button type="submit" className="btn btn--primary" disabled={busy || !userId}>
          {busy ? "Working…" : "Issue coins"}
        </button>
      </form>
    </Panel>
  );
}
