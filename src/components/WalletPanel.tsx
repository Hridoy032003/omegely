"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-browser";
import { ArrowRight } from "@/components/icons";
import { LogoMark } from "@/components/logo";
import {
  AppHeader,
  Badge,
  Button,
  CONTROL,
  Field,
  Notice,
  PageGlow,
  PageHeading,
  Panel,
  PanelHead,
  Stat,
  buttonClass,
} from "@/components/ui";

type WalletProfile = {
  displayName: string;
  referralCode: string;
  coinBalance: number;
  totalEarned: number;
  reservedCoins: number;
};

type CoinTransaction = { id: string; amount: number; description: string; created_at: string };

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

const STATUS_TONE = {
  paid: "positive",
  approved: "positive",
  pending: "caution",
  rejected: "critical",
} as const;

function nameFromUser(user: User) {
  const metadata = user.user_metadata ?? {};
  if (typeof metadata.full_name === "string" && metadata.full_name.trim()) return metadata.full_name;
  if (typeof metadata.name === "string" && metadata.name.trim()) return metadata.name;
  return user.email?.split("@")[0] || "Omegley user";
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(value),
  );
}

function formatCoins(value: number) {
  return new Intl.NumberFormat().format(value);
}

function formatDollars(coins: number) {
  return (coins / COINS_PER_DOLLAR).toLocaleString(undefined, { style: "currency", currency: "USD" });
}

function WalletIcon({ name, className = "h-[18px] w-[18px]" }: { name: keyof typeof ICON_PATHS; className?: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {ICON_PATHS[name]}
    </svg>
  );
}

const ICON_PATHS = {
  coins: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v5c0 1.7 3.1 3 7 3s7-1.3 7-3V6" />
      <path d="M5 11v5c0 1.7 3.1 3 7 3s7-1.3 7-3v-5" />
    </>
  ),
  chat: (
    <>
      <path d="M20 14a4 4 0 0 1-4 4H8l-5 3V7a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4Z" />
      <path d="M8 9h8M8 13h5" />
    </>
  ),
  referral: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 19c.5-3.4 2.5-5 6-5s5.5 1.6 6 5M17 8h4M19 6v4" />
    </>
  ),
  bonus: (
    <>
      <path d="m12 3 1.7 5.3H19l-4.3 3.2 1.6 5.3-4.3-3.2-4.3 3.2 1.6-5.3L5 8.3h5.3Z" />
      <path d="M18 17v4M16 19h4" />
    </>
  ),
  redeem: (
    <>
      <rect x="3" y="6" width="18" height="13" rx="3" />
      <path d="M3 10h18M16 15h2" />
    </>
  ),
  history: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.7L4 8.6" />
      <path d="M4 4v4.6h4.6M12 8v4l3 2" />
    </>
  ),
} as const;

export default function WalletPanel() {
  const [user, setUser] = useState<User | null>(null);
  const [wallet, setWallet] = useState<WalletProfile>(EMPTY_WALLET);
  const [transactions, setTransactions] = useState<CoinTransaction[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [activeTab, setActiveTab] = useState<"earn" | "redeem">("earn");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
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
    const referralCode =
      profile?.referral_code || currentUser.id.replaceAll("-", "").slice(0, 10).toLowerCase();
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
      const minimum = Number(publicSettings.withdrawal_minimum_coins);
      // Guard the divisor: a missing or zero threshold would make the progress
      // bar NaN and let a zero-coin request through.
      const safeMinimum = Number.isFinite(minimum) && minimum > 0 ? minimum : DEFAULT_WITHDRAWAL_MINIMUM;
      setWithdrawalMinimum(safeMinimum);
      setWithdrawalAmount((current) =>
        Number(current) === DEFAULT_WITHDRAWAL_MINIMUM ? String(safeMinimum) : current,
      );
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
  const canRedeem = availableCoins >= withdrawalMinimum;
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
      setNotice({ tone: "error", text: "Could not copy automatically. Select the link and copy it manually." });
    }
  };

  const requestWithdrawal = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || busy) return;
    const amount = Number(withdrawalAmount);
    if (!Number.isFinite(amount) || amount < withdrawalMinimum) {
      setNotice({ tone: "error", text: `Enter at least ${formatCoins(withdrawalMinimum)} coins.` });
      return;
    }
    if (amount > availableCoins) {
      setNotice({
        tone: "error",
        text: `You have ${formatCoins(availableCoins)} coins available to redeem.`,
      });
      return;
    }

    setBusy(true);
    setNotice(null);
    const { data: requestId, error } = await supabase.rpc("request_withdrawal", {
      p_amount_coins: amount,
      p_method: withdrawalMethod,
      p_destination: withdrawalDestination.trim(),
    });

    if (error || !requestId) {
      setNotice({
        tone: "error",
        text: error?.message || "This request could not be submitted. Check your available balance and try again.",
      });
    } else {
      setNotice({ tone: "success", text: "Your redemption request was sent for admin review." });
      setWithdrawalDestination("");
      await loadWallet(user);
    }
    setBusy(false);
  };

  if (loading) {
    return (
      <main className="min-h-dvh">
        <PageGlow />
        <AppHeader />
        <div className="flex min-h-[60vh] items-center justify-center gap-4" aria-live="polite">
          <LogoMark className="h-10 w-10 animate-pulseGlow" title="Omegley" />
          <div>
            <p className="font-medium text-ink">Opening your wallet</p>
            <p className="mt-1 text-sm text-ink-3">Loading your latest balance…</p>
          </div>
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="min-h-dvh">
        <PageGlow />
        <AppHeader />
        <div className="container-page grid items-center gap-12 py-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20 lg:py-24">
          <div>
            <p className="eyebrow">Omegley rewards</p>
            <h1 className="mt-4 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-5xl">
              Your conversations can <span className="gradient-text">add up.</span>
            </h1>
            <p className="mt-6 max-w-lg text-base leading-relaxed text-ink-2">
              Sign in to collect your chat rewards, share your referral link, and redeem your balance
              from one place.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Link href="/account?mode=login" className={buttonClass({ size: "lg" })}>
                Sign in to wallet
                <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/account?mode=signup" className={buttonClass({ variant: "outline", size: "lg" })}>
                Create an account
              </Link>
            </div>
            <p className="mt-6 text-2xs text-ink-4">100 coins = $1 estimated reward value</p>
          </div>

          <Panel tone="brand" className="p-6 sm:p-7">
            <div className="flex items-center justify-between gap-4">
              {/* Labelled as an example so a signed-out visitor never reads it as a balance. */}
              <Badge tone="neutral">Example wallet</Badge>
              <WalletIcon name="coins" className="h-6 w-6 text-brand-ink" />
            </div>
            <p className="mt-6 font-display text-4xl font-semibold tracking-tight text-ink">
              1,250 <span className="text-base font-medium text-ink-3">coins</span>
            </p>
            <p className="mt-1 text-sm text-ink-3">$12.50 estimated value</p>
            <div className="mt-6 border-t border-line">
              <PreviewRow label="Complete a connection" value="+10" />
              <PreviewRow label="Successful referral" value="+100" />
            </div>
          </Panel>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh">
      <PageGlow />
      <AppHeader
        links={
          <Link href="/account" className="hidden text-sm text-ink-2 transition-colors hover:text-ink sm:inline">
            Account
          </Link>
        }
      />

      <div className="container-page py-12 md:py-16">
        <PageHeading
          label="Wallet & rewards"
          title="Make every connection count."
          lede={`Welcome back, ${wallet.displayName.split(" ")[0]}. Earn, track, and redeem your Omegley coins.`}
          aside={
            <div className="border-line sm:border-l sm:pl-5">
              <p className="font-display text-lg font-semibold text-ink">100 coins</p>
              <p className="text-sm text-ink-3">= $1 reward value</p>
            </div>
          }
        />

        <Panel tone="brand" className="mt-10 grid gap-8 p-6 sm:grid-cols-2 sm:p-7 lg:grid-cols-4">
          <div>
            <p className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.14em] text-brand-ink">
              <WalletIcon name="coins" /> Available balance
            </p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-4xl font-semibold tracking-tight text-ink">
                {formatCoins(availableCoins)}
              </span>
              <span className="text-sm text-ink-3">coins</span>
            </p>
            <p className="mt-1 text-sm text-ink-3">{formatDollars(availableCoins)} estimated value</p>
          </div>
          <Stat label="Lifetime earned" value={formatCoins(wallet.totalEarned)} sub={formatDollars(wallet.totalEarned)} />
          <Stat
            label="Pending redemption"
            value={formatCoins(wallet.reservedCoins)}
            sub={formatDollars(wallet.reservedCoins)}
          />
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-3">Next reward</p>
            <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">+10 coins</p>
            <Link
              href="/chat"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink transition-colors hover:text-ink"
            >
              Start a connection
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </Panel>

        <div
          role="tablist"
          aria-label="Wallet actions"
          className="mt-8 grid w-full max-w-lg grid-cols-2 gap-1 rounded-card border border-line bg-white/[0.02] p-1"
        >
          {(
            [
              { id: "earn", title: "Add coins", sub: "Earn through Omegley" },
              { id: "redeem", title: "Redeem", sub: "Request a payout" },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => {
                setActiveTab(tab.id);
                setNotice(null);
              }}
              className={`rounded-control px-4 py-2.5 text-left transition ${
                activeTab === tab.id ? "bg-panel-hi text-ink shadow-lg shadow-black/20" : "text-ink-3 hover:text-ink"
              }`}
            >
              <span className="block text-sm font-semibold">{tab.title}</span>
              <span className="mt-0.5 block text-2xs text-ink-4">{tab.sub}</span>
            </button>
          ))}
        </div>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(300px,1fr)]" role="tabpanel">
          {activeTab === "earn" ? (
            <>
              <Panel className="p-6 sm:p-7">
                <PanelHead
                  label="Ways to earn"
                  title="Add coins to your wallet"
                  description="Your rewards are added automatically after each eligible event."
                />
                <div className="mt-6 border-t border-line">
                  <EarnRow
                    icon="chat"
                    tone="text-brand-ink bg-brand-soft"
                    title="Complete a connection"
                    body="Connect with someone in random chat. There is no minimum duration."
                    reward="+10"
                    href="/chat"
                    hrefLabel="Start chatting"
                  />
                  <EarnRow
                    icon="referral"
                    tone="text-sky-300 bg-sky-400/10"
                    title="Invite a friend"
                    body="Earn after a new member creates an account using your personal link."
                    reward="+100"
                  />
                  <EarnRow
                    icon="bonus"
                    tone="text-caution bg-caution/10"
                    title="Community bonuses"
                    body="Promotions and admin-awarded bonuses appear directly in your wallet history."
                    reward="Variable"
                  />
                </div>
              </Panel>

              <div className="grid gap-6">
                <Panel tone="brand" className="p-6">
                  <PanelHead
                    label="Your referral link"
                    title="Invite friends. Earn together."
                    description="Share your personal link. You receive 100 coins when an eligible friend joins."
                  />
                  <div className="mt-5">
                    <Field label="Personal invite link" htmlFor="wallet-referral-link">
                      <div className="flex gap-2">
                        <input
                          id="wallet-referral-link"
                          readOnly
                          value={referralUrl}
                          className={`${CONTROL} text-2xs`}
                        />
                        <Button type="button" size="sm" onClick={() => void copyReferralLink()}>
                          {copied ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </Field>
                    <p className="mt-2 text-2xs text-ink-4" aria-live="polite">
                      {copied ? "Copied to clipboard." : " "}
                    </p>
                  </div>
                </Panel>
                <HistoryPanel
                  label="Recent activity"
                  title="Coin history"
                  empty="Your coin activity will appear here after your first reward."
                  rows={transactions.map((transaction) => ({
                    id: transaction.id,
                    title: transaction.description,
                    sub: formatDate(transaction.created_at),
                    right: (
                      <span
                        className={`text-sm font-semibold ${
                          transaction.amount >= 0 ? "text-positive" : "text-critical"
                        }`}
                      >
                        {transaction.amount >= 0 ? "+" : ""}
                        {formatCoins(transaction.amount)}
                      </span>
                    ),
                  }))}
                />
              </div>
            </>
          ) : (
            <>
              <Panel className="p-6 sm:p-7">
                <PanelHead
                  label="Redeem coins"
                  title="Request your reward"
                  description="Choose a delivery method and submit your request for admin review."
                  action={
                    <span className="flex h-10 w-10 items-center justify-center rounded-control bg-positive/10 text-positive">
                      <WalletIcon name="redeem" />
                    </span>
                  }
                />

                <div className="mt-6 rounded-card border border-line bg-white/[0.02] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm text-ink-3">Progress to minimum</span>
                    <span className="text-sm font-medium text-ink">
                      {formatCoins(availableCoins)} / {formatCoins(withdrawalMinimum)} coins
                    </span>
                  </div>
                  <div
                    className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
                    role="progressbar"
                    aria-valuenow={Math.round(redemptionProgress)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span
                      className="block h-full rounded-full bg-gradient-to-r from-brand-hi to-brand"
                      style={{ width: `${redemptionProgress}%` }}
                    />
                  </div>
                  <p className="mt-2.5 text-2xs text-ink-4">
                    {canRedeem
                      ? "You have enough coins to submit a request."
                      : `${formatCoins(withdrawalMinimum - availableCoins)} more coins needed to redeem.`}
                  </p>
                </div>

                <form className="mt-6 grid gap-5" onSubmit={requestWithdrawal}>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <Field label="Coins to redeem" htmlFor="redeem-amount">
                      <input
                        id="redeem-amount"
                        className={CONTROL}
                        required
                        type="number"
                        min={withdrawalMinimum}
                        max={Math.max(withdrawalMinimum, availableCoins)}
                        step="100"
                        value={withdrawalAmount}
                        onChange={(event) => setWithdrawalAmount(event.target.value)}
                      />
                    </Field>
                    <Field label="Reward method" htmlFor="redeem-method">
                      <select
                        id="redeem-method"
                        className={CONTROL}
                        value={withdrawalMethod}
                        onChange={(event) =>
                          setWithdrawalMethod(event.target.value as "gift_card" | "cash_pending")
                        }
                      >
                        <option value="gift_card">Omegley gift card</option>
                        <option value="cash_pending">Cash payout (review)</option>
                      </select>
                    </Field>
                  </div>

                  <Field
                    label={withdrawalMethod === "gift_card" ? "Delivery email" : "Payout destination"}
                    htmlFor="redeem-destination"
                  >
                    <input
                      id="redeem-destination"
                      className={CONTROL}
                      required
                      minLength={3}
                      type={withdrawalMethod === "gift_card" ? "email" : "text"}
                      autoComplete={withdrawalMethod === "gift_card" ? "email" : "off"}
                      placeholder={
                        withdrawalMethod === "gift_card" ? "you@example.com" : "Enter your payout details"
                      }
                      value={withdrawalDestination}
                      onChange={(event) => setWithdrawalDestination(event.target.value)}
                    />
                  </Field>

                  <div className="flex items-center justify-between rounded-control bg-white/[0.03] px-4 py-3">
                    <span className="text-sm text-ink-3">Estimated reward</span>
                    <span className="font-medium text-ink">{formatDollars(Number(withdrawalAmount) || 0)}</span>
                  </div>

                  <Button type="submit" variant="brand" block disabled={busy || !withdrawalsEnabled || !canRedeem}>
                    {busy
                      ? "Submitting…"
                      : withdrawalsEnabled
                        ? "Submit redemption request"
                        : "Redemptions are temporarily paused"}
                  </Button>
                  <p className="text-2xs leading-relaxed text-ink-4">
                    Requests are reviewed before delivery. Coins remain reserved while a request is pending.
                  </p>
                  {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
                </form>
              </Panel>

              <div className="grid gap-6">
                <Panel className="p-6">
                  <PanelHead label="Redemption details" title="Before you redeem" />
                  <dl className="mt-5">
                    <RuleRow label="Minimum balance" value={`${formatCoins(withdrawalMinimum)} coins`} />
                    <RuleRow label="Current value" value="100 coins = $1" />
                    <RuleRow label="Review process" value="Admin approval" />
                  </dl>
                </Panel>
                <HistoryPanel
                  label="Request history"
                  title="Recent redemptions"
                  empty="You have not submitted a redemption request yet."
                  rows={withdrawals.map((withdrawal) => ({
                    id: withdrawal.id,
                    title: `${formatCoins(withdrawal.amount_coins)} coins · ${
                      withdrawal.method === "gift_card" ? "Gift card" : "Cash payout"
                    }`,
                    sub: formatDate(withdrawal.created_at),
                    right: <Badge tone={STATUS_TONE[withdrawal.status]}>{withdrawal.status}</Badge>,
                  }))}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function EarnRow({
  icon,
  tone,
  title,
  body,
  reward,
  href,
  hrefLabel,
}: {
  icon: keyof typeof ICON_PATHS;
  tone: string;
  title: string;
  body: string;
  reward: string;
  href?: string;
  hrefLabel?: string;
}) {
  return (
    <article className="flex items-start gap-4 border-b border-line py-5 last:border-b-0">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${tone}`}>
        <WalletIcon name={icon} />
      </span>
      <div className="min-w-0 flex-1">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-ink-3">{body}</p>
        {href && hrefLabel && (
          <Link
            href={href}
            className="mt-2 inline-flex items-center gap-1.5 text-sm font-medium text-brand-ink transition-colors hover:text-ink"
          >
            {hrefLabel}
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
      <span className="shrink-0 text-sm font-semibold whitespace-nowrap text-positive">{reward}</span>
    </article>
  );
}

function HistoryPanel({
  label,
  title,
  empty,
  rows,
}: {
  label: string;
  title: string;
  empty: string;
  rows: Array<{ id: string; title: string; sub: string; right: React.ReactNode }>;
}) {
  return (
    <Panel className="p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-control bg-white/5 text-ink-2">
          <WalletIcon name="history" />
        </span>
        <PanelHead label={label} title={title} />
      </div>
      {rows.length ? (
        <div className="mt-5 border-t border-line">
          {rows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0">
              <span className="min-w-0">
                <span className="block truncate text-sm text-ink-2">{row.title}</span>
                <span className="mt-0.5 block text-2xs text-ink-4">{row.sub}</span>
              </span>
              <span className="shrink-0">{row.right}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-ink-4">{empty}</p>
      )}
    </Panel>
  );
}

function RuleRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-t border-line py-3">
      <dt className="text-sm text-ink-3">{label}</dt>
      <dd className="text-sm font-medium text-ink-2">{value}</dd>
    </div>
  );
}

function PreviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 border-b border-line py-3 last:border-b-0">
      <span className="text-sm text-ink-3">{label}</span>
      <span className="text-sm font-semibold text-positive">{value}</span>
    </div>
  );
}
