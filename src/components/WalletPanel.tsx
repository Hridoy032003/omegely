"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/lib/supabase-browser";
import { COIN_PACKS, formatInr, type CoinPack } from "@/lib/coin-packs";
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
  method: "gift_card" | "cash_pending";
  status: "pending" | "approved" | "rejected" | "paid";
  created_at: string;
};

type WithdrawalComplaint = {
  id: string;
  withdrawal_id: string;
  subject: string;
  message: string;
  status: "open" | "in_review" | "resolved" | "rejected";
  admin_reply: string | null;
  created_at: string;
};

type RazorpayCheckoutResponse = {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
};

type RazorpayCheckout = { open: () => void };

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => RazorpayCheckout;
  }
}

const DEFAULT_WITHDRAWAL_MINIMUM = 5000;
const DEFAULT_CONNECTION_REWARD = 10;
const DEFAULT_REFERRAL_REWARD = 100;
const DEFAULT_REFERRAL_DAYS = 7;
const DEFAULT_MINIMUM_SEND = 1;
const DEFAULT_DAILY_SEND_LIMIT = 100000;
const DEFAULT_DAILY_SEND_COUNT = 20;
const MAX_SEND_PER_REQUEST = 1000000;
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

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return new Promise<T>((resolve, reject) => {
    const timeout = window.setTimeout(
      () => reject(new Error("Wallet service is taking too long. Check your connection and try again.")),
      timeoutMs,
    );
    promise.then(
      (value) => {
        window.clearTimeout(timeout);
        resolve(value);
      },
      (error) => {
        window.clearTimeout(timeout);
        reject(error);
      },
    );
  });
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
  const [complaints, setComplaints] = useState<WithdrawalComplaint[]>([]);
  const [activeTab, setActiveTab] = useState<"earn" | "buy" | "send" | "redeem">("earn");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [withdrawalAmount, setWithdrawalAmount] = useState(String(DEFAULT_WITHDRAWAL_MINIMUM));
  const [withdrawalMinimum, setWithdrawalMinimum] = useState(DEFAULT_WITHDRAWAL_MINIMUM);
  const [withdrawalsEnabled, setWithdrawalsEnabled] = useState(true);
  const [connectionReward, setConnectionReward] = useState(DEFAULT_CONNECTION_REWARD);
  const [referralReward, setReferralReward] = useState(DEFAULT_REFERRAL_REWARD);
  const [referralQualificationDays, setReferralQualificationDays] = useState(DEFAULT_REFERRAL_DAYS);
  const [purchaseBusy, setPurchaseBusy] = useState<string | null>(null);
  const [withdrawalMethod, setWithdrawalMethod] = useState<"gift_card" | "cash_pending">("gift_card");
  const [withdrawalDestination, setWithdrawalDestination] = useState("");
  const [complaintWithdrawalId, setComplaintWithdrawalId] = useState<string | null>(null);
  const [complaintSubject, setComplaintSubject] = useState("");
  const [complaintMessage, setComplaintMessage] = useState("");
  const [complaintBusy, setComplaintBusy] = useState(false);
  const [reconcileBusy, setReconcileBusy] = useState(false);
  const [sendRecipient, setSendRecipient] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendNote, setSendNote] = useState("");
  const [sendReviewing, setSendReviewing] = useState(false);
  const [sendBusy, setSendBusy] = useState(false);
  const [sendsEnabled, setSendsEnabled] = useState(true);
  const [minimumSend, setMinimumSend] = useState(DEFAULT_MINIMUM_SEND);
  const [dailySendLimit, setDailySendLimit] = useState(DEFAULT_DAILY_SEND_LIMIT);
  const [dailySendCount, setDailySendCount] = useState(DEFAULT_DAILY_SEND_COUNT);
  const sendIdempotencyRef = useRef<string | null>(null);
  const withdrawalIdempotencyRef = useRef<string | null>(null);

  const loadWallet = useCallback(async (currentUser: User) => {
    // This is deliberately a narrow heartbeat used only for referral
    // qualification; it is not a browser/device fingerprint.
    void supabase.rpc("touch_my_last_seen");
    const anonymousWallet = window.localStorage.getItem("omegley_anonymous_wallet");
    if (anonymousWallet) {
      const { data: claimed } = await supabase.rpc("claim_anonymous_wallet", { p_wallet_id: anonymousWallet });
      if (Number(claimed ?? 0) > 0) window.localStorage.removeItem("omegley_anonymous_wallet");
    }

    await supabase.rpc("qualify_referrals");

    const [profileResult, transactionsResult, withdrawalsResult, complaintsResult, settingsResult] = await Promise.all([
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
        .select("id, amount_coins, method, status, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("withdrawal_complaints")
        .select("id, withdrawal_id, subject, message, status, admin_reply, created_at")
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
    setComplaints((complaintsResult.data ?? []) as WithdrawalComplaint[]);

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
      setConnectionReward(Number(publicSettings.connection_reward_coins) || DEFAULT_CONNECTION_REWARD);
      setReferralReward(Number(publicSettings.referral_reward_coins) || DEFAULT_REFERRAL_REWARD);
      setReferralQualificationDays(Number(publicSettings.referral_qualification_days) || DEFAULT_REFERRAL_DAYS);
      setSendsEnabled(Boolean(publicSettings.coin_sends_enabled));
      setMinimumSend(Number(publicSettings.minimum_send_coins) || DEFAULT_MINIMUM_SEND);
      setDailySendLimit(Number(publicSettings.daily_send_limit_coins) || DEFAULT_DAILY_SEND_LIMIT);
      setDailySendCount(Number(publicSettings.daily_send_count_limit) || DEFAULT_DAILY_SEND_COUNT);
    }

    if (!profile?.referral_code) {
      void supabase.rpc("ensure_my_referral_code");
    }

    const pendingReferral = window.localStorage.getItem("omegley_referral_code");
    if (pendingReferral) {
      const { data: claimed } = await supabase.rpc("claim_referral", { p_referral_code: pendingReferral });
      if (claimed) window.localStorage.removeItem("omegley_referral_code");
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    if (!isSupabaseConfigured) {
      setNotice({ tone: "error", text: "Wallet access is not configured on this deployment. Add the public Supabase URL and publishable key, then redeploy." });
      setLoading(false);
      return () => {
        mounted = false;
      };
    }

    const applyUser = async (currentUser: User | null) => {
      if (!mounted) return;
      setUser(currentUser);
      try {
        if (currentUser) {
          await withTimeout(loadWallet(currentUser), 12000);
        } else {
          setWallet(EMPTY_WALLET);
          setTransactions([]);
          setWithdrawals([]);
          setComplaints([]);
        }
      } catch (error) {
        if (mounted) {
          setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not load your wallet. Please refresh and try again." });
        }
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void withTimeout(supabase.auth.getUser(), 12000)
      .then(({ data }) => applyUser(data.user))
      .catch((error: unknown) => {
        if (mounted) {
          setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not connect to the account service." });
          setLoading(false);
        }
      });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void applyUser(session?.user ?? null);
    });
    const refreshOnFocus = () => {
      void withTimeout(supabase.auth.getUser(), 12000)
        .then(({ data: current }) => {
          if (current.user) void withTimeout(loadWallet(current.user), 12000).catch(() => {});
        })
        .catch(() => {});
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

  const loadRazorpay = () => new Promise<void>((resolve, reject) => {
    if (window.Razorpay) return resolve();
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Razorpay checkout could not load.")), { once: true });
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Razorpay checkout could not load."));
    document.body.appendChild(script);
  });

  const reconcilePayments = async (silent = false) => {
    if (!user || reconcileBusy) return;
    setReconcileBusy(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const response = await fetch("/api/payments/razorpay/reconcile", {
        method: "POST",
        headers: { Authorization: `Bearer ${sessionData.session?.access_token || ""}` },
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string; credited?: number };
      if (!response.ok) throw new Error(result.error || "Payment status could not be checked.");
      await loadWallet(user);
      if (!silent) {
        setNotice({
          tone: result.credited ? "success" : "error",
          text: result.credited
            ? "Your payment was confirmed and the coins are now in your wallet."
            : "No pending captured payment was found yet. If you were charged, please try again in a moment.",
        });
      }
    } catch (error) {
      if (!silent) setNotice({ tone: "error", text: error instanceof Error ? error.message : "Payment status could not be checked." });
    } finally {
      setReconcileBusy(false);
    }
  };

  const purchaseCoins = async (pack: CoinPack) => {
    if (!user || purchaseBusy) return;
    setPurchaseBusy(pack.id);
    setNotice(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const orderResponse = await fetch("/api/payments/razorpay/order", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${sessionData.session?.access_token || ""}`,
        },
        body: JSON.stringify({ pack_id: pack.id }),
      });
      const order = (await orderResponse.json().catch(() => ({}))) as { error?: string; order_id?: string; amount?: number; currency?: string; key_id?: string; coins?: number };
      if (!orderResponse.ok || !order.order_id || !order.key_id) throw new Error(order.error || "Could not start the payment.");
      await loadRazorpay();
      if (!window.Razorpay) throw new Error("Razorpay checkout is unavailable.");

      const checkout = new window.Razorpay({
        key: order.key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Omegley",
        description: `${formatCoins(order.coins || pack.coins)} coins`,
        order_id: order.order_id,
        prefill: { email: user.email || "" },
        theme: { color: "#6366f1" },
        handler: async (response: RazorpayCheckoutResponse) => {
          try {
            const { data: session } = await supabase.auth.getSession();
            const verifyResponse = await fetch("/api/payments/razorpay/verify", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${session.session?.access_token || ""}`,
              },
              body: JSON.stringify(response),
            });
            const result = (await verifyResponse.json().catch(() => ({}))) as { error?: string };
            if (!verifyResponse.ok) throw new Error(result.error || "Payment verification failed.");
            setNotice({ tone: "success", text: `${formatCoins(pack.coins)} coins were added to your wallet.` });
            await loadWallet(user);
            setActiveTab("earn");
          } catch {
            await reconcilePayments();
          } finally {
            setPurchaseBusy(null);
          }
        },
        modal: { ondismiss: () => setPurchaseBusy(null) },
      });
      checkout.open();
    } catch (error) {
      setPurchaseBusy(null);
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "Could not start the payment." });
    }
  };

  const reviewSend = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(sendAmount);
    if (!sendRecipient.trim()) {
      setNotice({ tone: "error", text: "Enter the recipient email or referral code." });
      return;
    }
    if (!sendsEnabled) {
      setNotice({ tone: "error", text: "Coin sending is temporarily paused." });
      return;
    }
    if (!Number.isInteger(amount) || amount < minimumSend) {
      setNotice({ tone: "error", text: `Enter at least ${formatCoins(minimumSend)} whole coins.` });
      return;
    }
    if (amount > MAX_SEND_PER_REQUEST) {
      setNotice({ tone: "error", text: `A single send cannot exceed ${formatCoins(MAX_SEND_PER_REQUEST)} coins.` });
      return;
    }
    if (amount > availableCoins) {
      setNotice({ tone: "error", text: `You have ${formatCoins(availableCoins)} coins available to send.` });
      return;
    }
    setNotice(null);
    setSendReviewing(true);
  };

  const confirmSend = async () => {
    if (!user || sendBusy || !sendReviewing) return;
    setSendBusy(true);
    setNotice(null);
    if (!sendIdempotencyRef.current) sendIdempotencyRef.current = crypto.randomUUID();
    try {
      const { data, error } = await supabase.rpc("send_coins", {
        p_recipient: sendRecipient.trim(),
        p_amount: Number(sendAmount),
        p_note: sendNote.trim(),
        p_idempotency_key: sendIdempotencyRef.current,
      });
      const result = data as {
        ok?: boolean;
        error?: string;
        recipient_name?: string;
        already_processed?: boolean;
      } | null;

      if (error || !result?.ok) {
        setNotice({ tone: "error", text: result?.error || error?.message || "The coins could not be sent." });
      } else {
        const recipientName = result.recipient_name || "the recipient";
        setNotice({
          tone: "success",
          text: result.already_processed
            ? "This send was already completed. Your balance is up to date."
            : `${formatCoins(Number(sendAmount))} coins were sent to ${recipientName}.`,
        });
        setSendRecipient("");
        setSendAmount("");
        setSendNote("");
        setSendReviewing(false);
        sendIdempotencyRef.current = null;
        await loadWallet(user);
        window.dispatchEvent(new Event("omegley:wallet-updated"));
      }
    } catch {
      setNotice({ tone: "error", text: "The send status could not be confirmed. Retry the same send safely." });
    } finally {
      setSendBusy(false);
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
    if (!withdrawalIdempotencyRef.current) withdrawalIdempotencyRef.current = crypto.randomUUID();
    try {
      const { data: requestId, error } = await supabase.rpc("request_withdrawal_v2", {
        p_amount_coins: amount,
        p_method: withdrawalMethod,
        p_destination: withdrawalDestination.trim(),
        p_idempotency_key: withdrawalIdempotencyRef.current,
      });

      if (error || !requestId) {
        setNotice({
          tone: "error",
          text: error?.message || "This request could not be submitted. Check your available balance and try again.",
        });
      } else {
        setNotice({ tone: "success", text: "Your redemption request was sent for admin review." });
        setWithdrawalDestination("");
        withdrawalIdempotencyRef.current = null;
        await loadWallet(user);
      }
    } catch {
      setNotice({ tone: "error", text: "The request status could not be confirmed. Retry safely with the same details." });
    } finally {
      setBusy(false);
    }
  };

  const fileComplaint = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!user || !complaintWithdrawalId || complaintBusy) return;
    setComplaintBusy(true);
    setNotice(null);
    const { data: complaintId, error } = await supabase.rpc("file_withdrawal_complaint", {
      p_withdrawal_id: complaintWithdrawalId,
      p_subject: complaintSubject.trim(),
      p_message: complaintMessage.trim(),
    });
    if (error || !complaintId) {
      setNotice({
        tone: "error",
        text: error?.message || "You can file one complaint per request, with a maximum of three complaints in 12 hours.",
      });
    } else {
      setNotice({ tone: "success", text: "Your complaint was submitted. We will review it shortly." });
      setComplaintWithdrawalId(null);
      setComplaintSubject("");
      setComplaintMessage("");
      await loadWallet(user);
    }
    setComplaintBusy(false);
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
            <p className="mt-6 text-2xs text-ink-4">100 coins = 1 dollar. Coins are the wallet unit.</p>
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
            <p className="mt-1 text-sm text-ink-3">100 coins = 1 dollar</p>
            <div className="mt-6 border-t border-line">
              <PreviewRow label="Complete a connection" value={`+${connectionReward}`} />
              <PreviewRow label="Qualified referral" value={`+${referralReward}`} />
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
            <div title="100 coins = 1 dollar" className="border-line sm:border-l sm:pl-5">
              <p className="font-display text-lg font-semibold text-ink">100 coins</p>
              <p className="text-sm text-ink-3">1 dollar reward value</p>
            </div>
          }
        />

        <Panel tone="brand" className="mt-10 grid gap-8 p-6 sm:grid-cols-2 sm:p-7 lg:grid-cols-4">
          <div>
            <p className="flex items-center gap-2 text-2xs font-semibold uppercase tracking-[0.14em] text-brand-ink">
              <span title="100 coins = 1 dollar"><WalletIcon name="coins" /> Available to withdraw</span>
            </p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="font-display text-4xl font-semibold tracking-tight text-ink">
                {formatCoins(availableCoins)}
              </span>
              <span className="text-sm text-ink-3">coins</span>
            </p>
            <p className="mt-1 text-sm text-ink-3">100 coins = 1 dollar</p>
          </div>
          <Stat label="Total wallet" value={formatCoins(wallet.coinBalance)} sub="All coins earned or reserved" />
          <Stat label="Pending withdrawal" value={formatCoins(wallet.reservedCoins)} sub="Reserved for review" />
          <div>
            <p className="text-2xs font-semibold uppercase tracking-[0.14em] text-ink-3">Next reward</p>
            <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-ink">+{connectionReward} coins</p>
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
          className="mt-8 grid w-full grid-cols-2 gap-1 rounded-card border border-line bg-white/[0.02] p-1 sm:max-w-3xl sm:grid-cols-4"
        >
          {(
            [
              { id: "earn", title: "Earn coins", sub: "Earn through Omegley" },
              { id: "buy", title: "Buy coins", sub: "Razorpay checkout" },
              { id: "send", title: "Send coins", sub: "Send to a member" },
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
          {activeTab === "buy" ? (
            <BuyCoinsPanel
              busy={purchaseBusy}
              reconcileBusy={reconcileBusy}
              onPurchase={(pack) => void purchaseCoins(pack)}
              onReconcile={() => void reconcilePayments()}
            />
          ) : activeTab === "send" ? (
            <SendCoinsPanel
              availableCoins={availableCoins}
              sendsEnabled={sendsEnabled}
              minimumSend={minimumSend}
              dailySendLimit={dailySendLimit}
              dailySendCount={dailySendCount}
              recipient={sendRecipient}
              amount={sendAmount}
              note={sendNote}
              reviewing={sendReviewing}
              busy={sendBusy}
              notice={notice}
              onRecipientChange={(value) => {
                sendIdempotencyRef.current = null;
                setSendRecipient(value);
                setSendReviewing(false);
                setNotice(null);
              }}
              onAmountChange={(value) => {
                sendIdempotencyRef.current = null;
                setSendAmount(value);
                setSendReviewing(false);
                setNotice(null);
              }}
              onNoteChange={(value) => {
                sendIdempotencyRef.current = null;
                setSendNote(value);
                setSendReviewing(false);
                setNotice(null);
              }}
              onReview={reviewSend}
              onBack={() => setSendReviewing(false)}
              onConfirm={() => void confirmSend()}
            />
          ) : activeTab === "earn" ? (
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
                    reward={`+${connectionReward}`}
                    href="/chat"
                    hrefLabel="Start chatting"
                  />
                  <EarnRow
                    icon="referral"
                    tone="text-sky-300 bg-sky-400/10"
                    title="Invite a friend"
                    body={`Earn after a new member joins with your link and returns after ${referralQualificationDays} days.`}
                    reward={`+${referralReward}`}
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
                    description={`Share your personal link. You receive ${referralReward} coins when an eligible friend returns after ${referralQualificationDays} days.`}
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
                        onChange={(event) => {
                          withdrawalIdempotencyRef.current = null;
                          setWithdrawalAmount(event.target.value);
                        }}
                      />
                    </Field>
                    <Field label="Reward method" htmlFor="redeem-method">
                      <select
                        id="redeem-method"
                        className={CONTROL}
                        value={withdrawalMethod}
                        onChange={(event) => {
                          withdrawalIdempotencyRef.current = null;
                          setWithdrawalMethod(event.target.value as "gift_card" | "cash_pending")
                        }}
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
                      onChange={(event) => {
                        withdrawalIdempotencyRef.current = null;
                        setWithdrawalDestination(event.target.value);
                      }}
                    />
                  </Field>

                  <div className="flex items-center justify-between rounded-control bg-white/[0.03] px-4 py-3">
                    <span className="text-sm text-ink-3">Estimated reward</span>
                    <span className="font-medium text-ink">{formatCoins(Number(withdrawalAmount) || 0)} coins</span>
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
                    <RuleRow label="Coin value" value="100 coins = 1 dollar" />
                    <RuleRow label="Review process" value="Admin approval" />
                  </dl>
                </Panel>
                <WithdrawalHistoryPanel
                  withdrawals={withdrawals}
                  complaints={complaints}
                  complaintWithdrawalId={complaintWithdrawalId}
                  complaintSubject={complaintSubject}
                  complaintMessage={complaintMessage}
                  complaintBusy={complaintBusy}
                  onOpenComplaint={(withdrawalId) => {
                    setComplaintWithdrawalId(withdrawalId);
                    setComplaintSubject("");
                    setComplaintMessage("");
                    setNotice(null);
                  }}
                  onSubjectChange={setComplaintSubject}
                  onMessageChange={setComplaintMessage}
                  onSubmit={fileComplaint}
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

function SendCoinsPanel({
  availableCoins,
  sendsEnabled,
  minimumSend,
  dailySendLimit,
  dailySendCount,
  recipient,
  amount,
  note,
  reviewing,
  busy,
  notice,
  onRecipientChange,
  onAmountChange,
  onNoteChange,
  onReview,
  onBack,
  onConfirm,
}: {
  availableCoins: number;
  sendsEnabled: boolean;
  minimumSend: number;
  dailySendLimit: number;
  dailySendCount: number;
  recipient: string;
  amount: string;
  note: string;
  reviewing: boolean;
  busy: boolean;
  notice: { tone: "success" | "error"; text: string } | null;
  onRecipientChange: (value: string) => void;
  onAmountChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onReview: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  onConfirm: () => void;
}) {
  const numericAmount = Number(amount) || 0;

  return (
    <div className="grid gap-6 lg:col-span-2 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
      <Panel className="p-6 sm:p-7">
        <PanelHead
          label="Send coins"
          title={reviewing ? "Review before sending" : "Send coins to a member"}
          description={
            reviewing
              ? "Check the recipient and amount carefully. Completed sends cannot be reversed from the wallet."
              : "Use the member's account email or referral code. Coins arrive immediately after server verification."
          }
        />

        {reviewing ? (
          <div className="mt-6">
            <dl className="rounded-card border border-line bg-white/[0.02] px-4">
              <RuleRow label="Recipient" value={recipient.trim()} />
              <RuleRow label="Amount" value={`${formatCoins(numericAmount)} coins`} />
              <RuleRow label="Remaining balance" value={`${formatCoins(Math.max(0, availableCoins - numericAmount))} coins`} />
              <RuleRow label="Note" value={note.trim() || "No note"} />
            </dl>
            <div className="mt-5 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" disabled={busy} onClick={onBack}>Back</Button>
              <Button type="button" variant="brand" disabled={busy} onClick={onConfirm}>
                {busy ? "Sending securely…" : `Confirm ${formatCoins(numericAmount)} coin send`}
              </Button>
            </div>
          </div>
        ) : (
          <form className="mt-6 grid gap-5" onSubmit={onReview}>
            <Field label="Recipient" hint="Account email or referral code" htmlFor="send-recipient">
              <input
                id="send-recipient"
                className={CONTROL}
                required
                autoComplete="off"
                placeholder="friend@example.com or referral code"
                value={recipient}
                onChange={(event) => onRecipientChange(event.target.value)}
              />
            </Field>
            <Field label="Coins to send" hint={`${formatCoins(availableCoins)} available`} htmlFor="send-amount">
              <input
                id="send-amount"
                className={CONTROL}
                required
                type="number"
                min={minimumSend}
                max={Math.max(minimumSend, Math.min(availableCoins, MAX_SEND_PER_REQUEST))}
                step="1"
                inputMode="numeric"
                placeholder="100"
                value={amount}
                onChange={(event) => onAmountChange(event.target.value)}
              />
            </Field>
            <Field label="Note" hint="Optional · 160 characters" htmlFor="send-note">
              <input
                id="send-note"
                className={CONTROL}
                maxLength={160}
                placeholder="Thanks!"
                value={note}
                onChange={(event) => onNoteChange(event.target.value)}
              />
            </Field>
            <Button type="submit" variant="brand" block disabled={busy || !sendsEnabled || availableCoins < minimumSend}>
              {sendsEnabled ? "Review send" : "Coin sending is paused"}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>
        )}

        {notice && <div className="mt-5"><Notice tone={notice.tone}>{notice.text}</Notice></div>}
      </Panel>

      <Panel tone="brand" className="p-6">
        <PanelHead label="Available balance" title={`${formatCoins(availableCoins)} coins`} />
        <div className="mt-5 border-t border-line">
          <PreviewRow label="Delivery" value="Immediate" />
          <PreviewRow label="Processing fee" value="0 coins" />
          <PreviewRow label="Minimum send" value={`${formatCoins(minimumSend)} coins`} />
          <PreviewRow label="Daily limit" value={`${formatCoins(dailySendLimit)} coins`} />
          <PreviewRow label="Maximum sends" value={`${formatCoins(dailySendCount)} / 24h`} />
        </div>
        <p className="mt-5 text-2xs leading-relaxed text-ink-4">
          Pending redemption coins cannot be sent. Each completed send is recorded for both members in the coin ledger.
        </p>
      </Panel>
    </div>
  );
}

function BuyCoinsPanel({
  busy,
  reconcileBusy,
  onPurchase,
  onReconcile,
}: {
  busy: string | null;
  reconcileBusy: boolean;
  onPurchase: (pack: CoinPack) => void;
  onReconcile: () => void;
}) {
  return (
    <Panel className="p-6 sm:p-7 lg:col-span-2">
      <PanelHead
        label="Buy coins"
        title="Add coins to your wallet"
        description="Choose a pack and pay securely with Razorpay. Coins are credited only after server verification."
      />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {COIN_PACKS.map((pack) => (
          <article key={pack.id} className={`relative rounded-card border p-5 ${pack.badge ? "border-brand/60 bg-brand-soft/10" : "border-line bg-white/[0.02]"}`}>
            {pack.badge && <span className="absolute right-3 top-3"><Badge tone="brand">{pack.badge}</Badge></span>}
            <p className="text-sm font-semibold text-ink">{pack.name}</p>
            <p className="mt-5 font-display text-3xl font-semibold tracking-tight text-ink">{formatCoins(pack.coins)}</p>
            <p className="text-sm text-brand-ink">coins</p>
            <p className="mt-3 min-h-10 text-sm leading-relaxed text-ink-3">{pack.description}</p>
            <p className="mt-5 text-lg font-semibold text-ink">{formatInr(pack.amountPaise)}</p>
            <button type="button" disabled={busy !== null} onClick={() => onPurchase(pack)} className={`${buttonClass({ variant: "brand", size: "sm", block: true })} mt-4`}>
              {busy === pack.id ? "Opening checkout…" : "Buy securely"}
            </button>
          </article>
        ))}
      </div>
      <div className="mt-6 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-relaxed text-ink-4">Razorpay payments are processed in INR. Omegley coins remain the wallet unit, and 100 coins = 1 dollar for reward-value display.</p>
        <button type="button" onClick={onReconcile} disabled={busy !== null || reconcileBusy} className={buttonClass({ variant: "ghost", size: "sm" })}>
          {reconcileBusy ? "Checking…" : "Check payment status"}
        </button>
      </div>
    </Panel>
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

function WithdrawalHistoryPanel({
  withdrawals,
  complaints,
  complaintWithdrawalId,
  complaintSubject,
  complaintMessage,
  complaintBusy,
  onOpenComplaint,
  onSubjectChange,
  onMessageChange,
  onSubmit,
}: {
  withdrawals: WithdrawalRequest[];
  complaints: WithdrawalComplaint[];
  complaintWithdrawalId: string | null;
  complaintSubject: string;
  complaintMessage: string;
  complaintBusy: boolean;
  onOpenComplaint: (withdrawalId: string | null) => void;
  onSubjectChange: (value: string) => void;
  onMessageChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const complaintByWithdrawal = new Map(complaints.map((complaint) => [complaint.withdrawal_id, complaint]));

  return (
    <Panel className="p-6">
      <PanelHead
        label="Request history"
        title="Recent redemptions"
        description="Keep the request ID if you need support. You can file up to 3 complaints in 12 hours."
      />
      {withdrawals.length ? (
        <div className="mt-5 border-t border-line">
          {withdrawals.map((withdrawal) => {
            const complaint = complaintByWithdrawal.get(withdrawal.id);
            const isFiling = complaintWithdrawalId === withdrawal.id;
            return (
              <div key={withdrawal.id} className="border-b border-line py-4 last:border-b-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm text-ink-2">
                      {formatCoins(withdrawal.amount_coins)} coins · {withdrawal.method === "gift_card" ? "Gift card" : "Cash payout"}
                    </p>
                    <p className="mt-1 truncate font-mono text-2xs text-ink-4" title={withdrawal.id}>
                      Request ID: {withdrawal.id}
                    </p>
                    <p className="mt-1 text-2xs text-ink-4">{formatDate(withdrawal.created_at)}</p>
                  </div>
                  <Badge tone={STATUS_TONE[withdrawal.status]}>{withdrawal.status}</Badge>
                </div>
                {complaint ? (
                  <p className="mt-3 text-2xs text-ink-3">
                    Complaint: <span className="text-ink-2">{complaint.status.replace("_", " ")}</span>
                    {complaint.admin_reply ? ` · ${complaint.admin_reply}` : ""}
                  </p>
                ) : isFiling ? (
                  <form onSubmit={onSubmit} className="mt-4 grid gap-3 rounded-control border border-line bg-white/[0.02] p-3">
                    <Field label="Complaint subject" htmlFor={`complaint-subject-${withdrawal.id}`}>
                      <input
                        id={`complaint-subject-${withdrawal.id}`}
                        className={CONTROL}
                        required
                        minLength={3}
                        maxLength={120}
                        value={complaintSubject}
                        onChange={(event) => onSubjectChange(event.target.value)}
                        placeholder="What went wrong?"
                      />
                    </Field>
                    <Field label="Details" htmlFor={`complaint-message-${withdrawal.id}`} hint="10–2,000 characters">
                      <textarea
                        id={`complaint-message-${withdrawal.id}`}
                        className={`${CONTROL} min-h-24 resize-y`}
                        required
                        minLength={10}
                        maxLength={2000}
                        value={complaintMessage}
                        onChange={(event) => onMessageChange(event.target.value)}
                        placeholder="Tell us what happened with this withdrawal."
                      />
                    </Field>
                    <div className="flex flex-wrap gap-2">
                      <Button type="submit" size="sm" variant="brand" disabled={complaintBusy}>
                        {complaintBusy ? "Submitting…" : "Submit complaint"}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={() => onOpenComplaint(null)}>Cancel</Button>
                    </div>
                  </form>
                ) : (
                  <button
                    type="button"
                    className="mt-3 text-2xs font-medium text-brand-ink transition-colors hover:text-ink"
                    onClick={() => onOpenComplaint(withdrawal.id)}
                  >
                    File a complaint
                  </button>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <p className="mt-5 border-t border-line pt-4 text-sm leading-relaxed text-ink-4">You have not submitted a redemption request yet.</p>
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
