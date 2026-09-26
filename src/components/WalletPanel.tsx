"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { LogoMark } from "@/components/logo";
import { supabase } from "@/lib/supabase-browser";

type WalletProfile = {
  displayName: string;
  referralCode: string;
  coinBalance: number;
  totalEarned: number;
  reservedCoins: number;
};

type CoinTransaction = {
  id: string;
  amount: number;
  description: string;
  created_at: string;
};

type WithdrawalRequest = {
  id: string;
  amount_coins: number;
  amount_usd: number;
  method: "gift_card" | "cash_pending";
  status: "pending" | "approved" | "rejected" | "paid";
  created_at: string;
};

const COINS_PER_DOLLAR = 100;
const DEFAULT_WITHDRAWAL_MINIMUM = 5000;
const EMPTY_WALLET: WalletProfile = {
  displayName: "Omegley user",
  referralCode: "",
  coinBalance: 0,
  totalEarned: 0,
  reservedCoins: 0,
};

function nameFromUser(user: User) {
  const metadata = user.user_metadata ?? {};
  if (typeof metadata.full_name === "string" && metadata.full_name.trim()) return metadata.full_name;
  if (typeof metadata.name === "string" && metadata.name.trim()) return metadata.name;
  return user.email?.split("@")[0] || "Omegley user";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
}

function formatCoins(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatDollars(coins: number) {
  return (coins / COINS_PER_DOLLAR).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function WalletIcon({ name }: { name: "coins" | "chat" | "referral" | "bonus" | "redeem" | "history" }) {
  const paths = {
    coins: <><ellipse cx="12" cy="6" rx="7" ry="3" /><path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6" /><path d="M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" /></>,
    chat: <><path d="M20 14a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4Z" /><path d="M8 9h8M8 13h5" /></>,
    referral: <><circle cx="9" cy="8" r="3" /><path d="M3 19c.5-3.4 2.5-5 6-5s5.5 1.6 6 5M17 8h4M19 6v4" /></>,
    bonus: <><path d="m12 3 1.7 5.3H19l-4.3 3.2 1.6 5.3-4.3-3.2-4.3 3.2 1.6-5.3L5 8.3h5.3Z" /><path d="M18 17v4M16 19h4" /></>,
    redeem: <><rect x="3" y="6" width="18" height="13" rx="3" /><path d="M3 10h18M16 15h2" /></>,
    history: <><path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" /><path d="M4 4v4.6h4.6M12 8v4l3 2" /></>,
  };

  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>;
}

export default function WalletPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<WalletProfile>(EMPTY_WALLET);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"add" | "redeem">("add");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  const [noticeKind, setNoticeKind] = useState<"success" | "error">("success");
  const [copied, setCopied] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState(String(DEFAULT_WITHDRAWAL_MINIMUM));
  const [withdrawalMinimum, setWithdrawalMinimum] = useState(DEFAULT_WITHDRAWAL_MINIMUM);
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(true);
  const [withdrawalMethod, setWithdrawalMethod] = useState<"gift_card" | "cash_pending">("gift_card");
  const [withdrawalDestination, setWithdrawalDestination] = useState("");

  const loadWallet = useCallback(async (currentUser: User) => {
    const anonymousWallet = window.localStorage.getItem("omegley_anonymous_wallet");
    if (anonymousWallet) {
      const { data: claimed } = await supabase.rpc("claim_anonymous_wallet", { p_wallet_id: anonymousWallet });
      if (Number(claimed ?? 0) > 0) window.localStorage.removeItem("omegley_anonymous_wallet");
    }

    const [profileResult, transactionsResult, withdrawalsResult, settingsResult] = await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, referral_code, coin_balance, total_earned, reserved_coins")
        .eq("id", currentUser.id)
        .maybeSingle(),
      supabase
        .from("coin_transactions")
        .select("id, amount, description, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("withdrawal_requests")
        .select("id, amount_coins, amount_usd, method, status, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase.rpc("get_public_wallet_settings"),
    ]);

    const profile = profileResult.data;
    const referralCode = profile?.referral_code || currentUser.id.replaceAll("-", "").slice(0, 10).toLowerCase();
    setWallet({
      displayName: profile?.display_name || nameFromUser(currentUser),
      referralCode,
      coinBalance: Number(profile?.coin_balance ?? 0),
      totalEarned: Number(profile?.total_earned ?? 0),
      reservedCoins: Number(profile?.reserved_coins ?? 0),
    });
    setTransactions((transactionsResult.data ?? []) as CoinTransaction[]);
    setWithdrawals((withdrawalsResult.data ?? []) as WithdrawalRequest[]);

    const publicSettings = Array.isArray(settingsResult.data) ? settingsResult.data[0] : settingsResult.data;
    if (publicSettings) {
      const minimum = Number(publicSettings.withdrawal_minimum_coins ?? DEFAULT_WITHDRAWAL_MINIMUM);
      setWithdrawalMinimum(minimum);
      setWithdrawalAmount((current) => Number(current) === DEFAULT_WITHDRAWAL_MINIMUM ? String(minimum) : current);
      setWithdrawalsEnabled(Boolean(publicSettings.withdrawals_enabled));
    }

    if (!profile?.referral_code) {
      void supabase.from("profiles").update({ referral_code: referralCode }).eq("id", currentUser.id);
    }

    const pendingReferral = window.localStorage.getItem("omegley_referral_code");
    if (pendingReferral) {
      const { data: claimed } = await supabase.rpc("claim_referral", { p_referral_code: pendingReferral });
      if (claimed) window.localStorage.removeItem("omegley_referral_code");
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    const applyUser = async (currentUser: User | null) => {
      if (!mounted) return;
      setUser(currentUser);
      if (currentUser) await loadWallet(currentUser);
      else {
        setWallet(EMPTY_WALLET);
        setTransactions([]);
        setWithdrawals([]);
      }
      if (mounted) setLoading(false);
    };

    void supabase.auth.getUser().then(({ data }) => void applyUser(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void applyUser(session?.user ?? null);
    });
    const refreshOnFocus = () => {
      void supabase.auth.getUser().then(({ data: current }) => {
        if (current.user) void loadWallet(current.user);
      });
    };
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, [loadWallet]);

  const availableCoins = Math.max(0, wallet.coinBalance - wallet.reservedCoins);
  const redemptionProgress = Math.min(100, (availableCoins / withdrawalMinimum) * 100);
  const referralUrl = useMemo(() => {
    if (!wallet.referralCode) return "";
    const origin = typeof window === "undefined" ? "https://www.omegley.in" : window.location.origin;
    return `${origin}/account?ref=${wallet.referralCode}`;
  }, [wallet.referralCode]);

  const copyReferralLink = async () => {
    if (!referralUrl) return;
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setNoticeKind("error");
      setNotice("Could not copy automatically. Select the link and copy it manually.");
    }
  };

  const requestWithdrawal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || busy) return;
    const amount = Number(withdrawalAmount);
    if (!Number.isFinite(amount) || amount < withdrawalMinimum) {
      setNoticeKind("error");
      setNotice(`Enter at least ${formatCoins(withdrawalMinimum)} coins.`);
      return;
    }

    setBusy(true);
    setNotice("");
    const { data: requestId, error } = await supabase.rpc("request_withdrawal", {
      p_amount_coins: amount,
      p_method: withdrawalMethod,
      p_destination: withdrawalDestination.trim(),
    });

    if (error || !requestId) {
      setNoticeKind("error");
      setNotice(error?.message || "This request could not be submitted. Check your available balance and try again.");
    } else {
      setNoticeKind("success");
      setNotice("Your redemption request was sent for admin review.");
      setWithdrawalDestination("");
      await loadWallet(user);
    }
    setBusy(false);
  };

  return (
    <main className="wallet-page">
      <header className="wallet-nav">
        <Link href="/" className="wallet-brand"><LogoMark className="h-8 w-8" title="Omegley" /><span>Omegley</span></Link>
        <nav aria-label="Wallet navigation">
          <Link href="/account">Account</Link>
          <Link href="/chat" className="wallet-nav-primary">Start chatting <span aria-hidden="true">→</span></Link>
        </nav>
      </header>

      {loading ? (
        <section className="wallet-loading" aria-live="polite">
          <LogoMark className="h-10 w-10" title="Omegley" />
          <div><strong>Opening your wallet</strong><span>Loading your latest balance…</span></div>
        </section>
      ) : !user ? (
        <section className="wallet-gate">
          <div className="wallet-gate-copy">
            <span className="wallet-kicker"><i /> OMEGLEY REWARDS</span>
            <h1>Your conversations can <span>add up.</span></h1>
            <p>Sign in to collect your chat rewards, share your referral link, and redeem your balance from one secure wallet.</p>
            <div className="wallet-gate-actions">
              <Link href="/account?mode=login" className="wallet-main-button">Sign in to wallet <span>→</span></Link>
              <Link href="/account?mode=signup" className="wallet-secondary-button">Create an account</Link>
            </div>
            <small>100 coins = $1 estimated reward value</small>
          </div>
          <div className="wallet-gate-preview" aria-label="Wallet reward preview">
            <div className="wallet-preview-top"><span>Available balance</span><WalletIcon name="coins" /></div>
            <strong>1,250 <small>coins</small></strong>
            <p>$12.50 estimated value</p>
            <div className="wallet-preview-rule" />
            <div className="wallet-preview-row"><span>Complete a connection</span><b>+10</b></div>
            <div className="wallet-preview-row"><span>Successful referral</span><b>+100</b></div>
          </div>
        </section>
      ) : (
        <div className="wallet-shell">
          <section className="wallet-heading">
            <div>
              <span className="wallet-kicker"><i /> WALLET &amp; REWARDS</span>
              <h1>Make every connection count.</h1>
              <p>Welcome back, {wallet.displayName.split(" ")[0]}. Earn, track, and redeem your Omegley coins.</p>
            </div>
            <div className="wallet-value-note"><strong>100 coins</strong><span>= $1 reward value</span></div>
          </section>

          <section className="wallet-balance-card">
            <div className="wallet-balance-main">
              <span className="wallet-balance-label"><WalletIcon name="coins" /> Available balance</span>
              <div><strong>{formatCoins(availableCoins)}</strong><span>coins</span></div>
              <p>{formatDollars(availableCoins)} estimated reward value</p>
            </div>
            <div className="wallet-stat"><span>Lifetime earned</span><strong>{formatCoins(wallet.totalEarned)}</strong><small>{formatDollars(wallet.totalEarned)}</small></div>
            <div className="wallet-stat"><span>Pending redemption</span><strong>{formatCoins(wallet.reservedCoins)}</strong><small>{formatDollars(wallet.reservedCoins)}</small></div>
            <div className="wallet-balance-action"><span>Next reward</span><strong>+10 coins</strong><Link href="/chat">Start a connection <span>→</span></Link></div>
          </section>

          <div className="wallet-tabs" role="tablist" aria-label="Wallet actions">
            <button type="button" role="tab" aria-selected={activeTab === "add"} className={activeTab === "add" ? "active" : ""} onClick={() => { setActiveTab("add"); setNotice(""); }}><span>＋</span><div><strong>Add coins</strong><small>Earn through Omegley</small></div></button>
            <button type="button" role="tab" aria-selected={activeTab === "redeem"} className={activeTab === "redeem" ? "active" : ""} onClick={() => { setActiveTab("redeem"); setNotice(""); }}><span>↗</span><div><strong>Redeem</strong><small>Request a payout</small></div></button>
          </div>

          {activeTab === "add" ? (
            <div className="wallet-content-grid" role="tabpanel">
              <section className="wallet-panel wallet-earn-panel">
                <div className="wallet-panel-heading"><div><span className="wallet-section-label">WAYS TO EARN</span><h2>Add coins to your wallet</h2><p>Your rewards are added automatically after each eligible event.</p></div></div>
                <div className="wallet-earning-list">
                  <article>
                    <span className="wallet-list-icon violet"><WalletIcon name="chat" /></span>
                    <div><h3>Complete a connection</h3><p>Connect with someone in random chat. There is no minimum duration.</p><Link href="/chat">Start chatting <span>→</span></Link></div>
                    <strong>+10 <small>coins</small></strong>
                  </article>
                  <article>
                    <span className="wallet-list-icon blue"><WalletIcon name="referral" /></span>
                    <div><h3>Invite a friend</h3><p>Earn after a new member creates an account using your personal link.</p></div>
                    <strong>+100 <small>coins</small></strong>
                  </article>
                  <article>
                    <span className="wallet-list-icon amber"><WalletIcon name="bonus" /></span>
                    <div><h3>Community bonuses</h3><p>Promotions and admin-awarded bonuses appear directly in your wallet history.</p></div>
                    <strong>Variable</strong>
                  </article>
                </div>
              </section>

              <aside className="wallet-side-stack">
                <section className="wallet-panel wallet-referral-panel">
                  <span className="wallet-section-label">YOUR REFERRAL LINK</span>
                  <h2>Invite friends. Earn together.</h2>
                  <p>Share your personal link. You receive 100 coins when an eligible friend joins.</p>
                  <label htmlFor="wallet-referral-link">Personal invite link</label>
                  <div className="wallet-copy-field"><input id="wallet-referral-link" readOnly value={referralUrl} /><button type="button" onClick={() => void copyReferralLink()}>{copied ? "Copied ✓" : "Copy link"}</button></div>
                  <span className={`wallet-copy-message ${copied ? "visible" : ""}`} aria-live="polite">{copied ? "Copied to clipboard" : "Your referral code is ready to share."}</span>
                </section>
                <TransactionHistory transactions={transactions} />
              </aside>
            </div>
          ) : (
            <div className="wallet-content-grid" role="tabpanel">
              <section className="wallet-panel wallet-redeem-panel">
                <div className="wallet-panel-heading"><div><span className="wallet-section-label">REDEEM COINS</span><h2>Request your reward</h2><p>Choose a delivery method and submit your request for admin review.</p></div><span className="wallet-list-icon green"><WalletIcon name="redeem" /></span></div>

                <div className="wallet-redemption-progress">
                  <div><span>Progress to minimum</span><strong>{formatCoins(availableCoins)} / {formatCoins(withdrawalMinimum)} coins</strong></div>
                  <div className="wallet-progress-track"><span style={{ width: `${redemptionProgress}%` }} /></div>
                  <p>{availableCoins >= withdrawalMinimum ? "You have enough coins to submit a request." : `${formatCoins(withdrawalMinimum - availableCoins)} more coins needed to redeem.`}</p>
                </div>

                <form className="wallet-redeem-form" onSubmit={requestWithdrawal}>
                  <div className="wallet-form-row">
                    <label>Coins to redeem<input required type="number" min={withdrawalMinimum} step="100" value={withdrawalAmount} onChange={(event) => setWithdrawalAmount(event.target.value)} /></label>
                    <label>Reward method<select value={withdrawalMethod} onChange={(event) => setWithdrawalMethod(event.target.value as "gift_card" | "cash_pending")}><option value="gift_card">Omegley gift card</option><option value="cash_pending">Cash payout (review)</option></select></label>
                  </div>
                  <label>{withdrawalMethod === "gift_card" ? "Delivery email" : "Payout destination"}<input required minLength={3} type={withdrawalMethod === "gift_card" ? "email" : "text"} placeholder={withdrawalMethod === "gift_card" ? "you@example.com" : "Enter your payout details"} value={withdrawalDestination} onChange={(event) => setWithdrawalDestination(event.target.value)} /></label>
                  <div className="wallet-form-summary"><span>Estimated reward</span><strong>{formatDollars(Number(withdrawalAmount) || 0)}</strong></div>
                  <button className="wallet-main-button" disabled={busy || !withdrawalsEnabled || availableCoins < withdrawalMinimum} type="submit">{busy ? "Submitting…" : withdrawalsEnabled ? "Submit redemption request" : "Redemptions are temporarily paused"}</button>
                  <small>Requests are reviewed before delivery. Coins remain reserved while a request is pending.</small>
                  {notice && <p className={`wallet-notice ${noticeKind}`} role="status">{notice}</p>}
                </form>
              </section>

              <aside className="wallet-side-stack">
                <section className="wallet-panel wallet-rules-panel">
                  <span className="wallet-section-label">REDEMPTION DETAILS</span>
                  <h2>Before you redeem</h2>
                  <ul><li><span>Minimum balance</span><strong>{formatCoins(withdrawalMinimum)} coins</strong></li><li><span>Current value</span><strong>100 coins = $1</strong></li><li><span>Review process</span><strong>Admin approval</strong></li></ul>
                </section>
                <WithdrawalHistory withdrawals={withdrawals} />
              </aside>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function TransactionHistory({ transactions }: { transactions: CoinTransaction[] }) {
  return (
    <section className="wallet-panel wallet-history-panel">
      <div className="wallet-history-title"><span className="wallet-list-icon neutral"><WalletIcon name="history" /></span><div><span className="wallet-section-label">RECENT ACTIVITY</span><h2>Coin history</h2></div></div>
      {transactions.length ? <div className="wallet-history-list">{transactions.map((transaction) => <div key={transaction.id}><span><strong>{transaction.description}</strong><small>{formatDate(transaction.created_at)}</small></span><b className={transaction.amount >= 0 ? "positive" : "negative"}>{transaction.amount >= 0 ? "+" : ""}{formatCoins(transaction.amount)}</b></div>)}</div> : <p className="wallet-empty">Your coin activity will appear here after your first reward.</p>}
    </section>
  );
}

function WithdrawalHistory({ withdrawals }: { withdrawals: WithdrawalRequest[] }) {
  return (
    <section className="wallet-panel wallet-history-panel">
      <div className="wallet-history-title"><span className="wallet-list-icon neutral"><WalletIcon name="history" /></span><div><span className="wallet-section-label">REQUEST HISTORY</span><h2>Recent redemptions</h2></div></div>
      {withdrawals.length ? <div className="wallet-history-list">{withdrawals.map((withdrawal) => <div key={withdrawal.id}><span><strong>{formatCoins(withdrawal.amount_coins)} coins · {withdrawal.method === "gift_card" ? "Gift card" : "Cash payout"}</strong><small>{formatDate(withdrawal.created_at)}</small></span><b className={`status ${withdrawal.status}`}>{withdrawal.status}</b></div>)}</div> : <p className="wallet-empty">You have not submitted a redemption request yet.</p>}
    </section>
  );
}
