"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-browser";

type AccountDetails = {
  name: string;
  avatar: string;
  /** Balance minus coins reserved by a pending payout — the same figure the wallet shows. */
  availableCoins: number;
};

function detailsFromUser(user: User) {
  const metadata = user.user_metadata ?? {};
  const name =
    typeof metadata.full_name === "string"
      ? metadata.full_name
      : typeof metadata.name === "string"
        ? metadata.name
        : user.email?.split("@")[0] || "Your account";
  const avatar =
    typeof metadata.avatar_url === "string"
      ? metadata.avatar_url
      : typeof metadata.picture === "string"
        ? metadata.picture
        : "";
  return { name, avatar };
}

export default function UserAccountBadge({ compact = false }: { compact?: boolean }) {
  const [account, setAccount] = useState<AccountDetails | null>(null);
  const [anonymousBalance, setAnonymousBalance] = useState<number | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadAnonymousBalance = async () => {
      const walletId = window.localStorage.getItem("omegley_anonymous_wallet");
      if (!walletId) {
        if (mounted) setAnonymousBalance(0);
        return;
      }

      const { data, error } = await supabase.rpc("get_anonymous_wallet_balance", { p_wallet_id: walletId });
      if (!mounted) return;
      setAnonymousBalance(error ? 0 : Number(data ?? 0));
    };

    const loadAccount = async (user: User | null) => {
      if (!user) {
        if (mounted) {
          setAccount(null);
          await loadAnonymousBalance();
        }
        return;
      }

      if (mounted) setAnonymousBalance(null);
      const google = detailsFromUser(user);
      if (mounted) setAccount({ ...google, availableCoins: 0 });

      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, coin_balance, reserved_coins")
        .eq("id", user.id)
        .maybeSingle();

      if (!mounted) return;
      setAccount({
        name: data?.display_name || google.name,
        avatar: google.avatar || data?.avatar_url || "",
        availableCoins: Math.max(0, Number(data?.coin_balance ?? 0) - Number(data?.reserved_coins ?? 0)),
      });
    };

    void supabase.auth.getUser().then(({ data }) => void loadAccount(data.user));
    const refreshWallet = () => {
      void supabase.auth.getUser().then(({ data }) => void loadAccount(data.user));
    };
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      void loadAccount(session?.user ?? null),
    );
    const refreshOnFocus = () => {
      void supabase.auth.getUser().then(({ data: current }) => void loadAccount(current.user));
    };
    window.addEventListener("focus", refreshOnFocus);
    window.addEventListener("omegley:wallet-updated", refreshWallet);

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      window.removeEventListener("focus", refreshOnFocus);
      window.removeEventListener("omegley:wallet-updated", refreshWallet);
    };
  }, []);

  if (!account) {
    return (
      <div className="inline-flex items-center gap-1.5">
        <span className="group relative inline-flex">
          <Link
            href="/account?mode=login"
            aria-label={`${(anonymousBalance ?? 0).toLocaleString()} anonymous coins. Sign in to claim them.`}
            className="inline-flex items-center gap-1.5 rounded-full border border-positive/25 bg-positive/10 px-2.5 py-1.5 text-2xs font-semibold text-positive transition hover:border-positive/50 hover:bg-positive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-positive/60"
          >
            {(anonymousBalance ?? 0).toLocaleString()}
            <span className="hidden sm:inline">coins</span>
          </Link>
          <span
            role="tooltip"
            className="pointer-events-none invisible absolute right-0 top-full z-50 mt-2 w-max max-w-64 translate-y-1 rounded-lg border border-white/10 bg-[#111118] px-3 py-2 text-xs font-medium leading-5 text-white opacity-0 shadow-2xl shadow-black/40 transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
          >
            {(anonymousBalance ?? 0) > 0
              ? "Your anonymous rewards are saved. Sign in to claim them."
              : "Complete a connection to earn 10 coins. Sign in to claim rewards."}
          </span>
        </span>
        <Link
          href="/account?mode=signup"
          className="hidden rounded-full border border-brand/30 bg-brand-soft px-3 py-2 text-2xs font-semibold text-brand-ink transition hover:border-brand/60 hover:text-ink sm:inline-flex"
        >
          Sign in to claim
        </Link>
      </div>
    );
  }

  const initials = account.name.trim().slice(0, 1).toUpperCase() || "U";

  return (
    <div className="inline-flex items-center gap-1.5">
      <span className="group relative inline-flex">
        <Link
          href="/wallet"
          aria-label={`${account.availableCoins.toLocaleString()} coins. 100 coins = 1 dollar. Open your wallet.`}
          className="inline-flex items-center gap-1.5 rounded-full border border-positive/25 bg-positive/10 px-2.5 py-1.5 text-2xs font-semibold text-positive transition hover:border-positive/50 hover:bg-positive/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-positive/60"
        >
          {account.availableCoins.toLocaleString()}
          <span className="hidden sm:inline">coins</span>
        </Link>
        <span
          role="tooltip"
          className="pointer-events-none invisible absolute right-0 top-full z-50 mt-2 w-max max-w-64 translate-y-1 rounded-lg border border-white/10 bg-[#111118] px-3 py-2 text-xs font-medium leading-5 text-white opacity-0 shadow-2xl shadow-black/40 transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
        >
          100 coins = 1 dollar. Open your wallet.
        </span>
      </span>

      <Link
        href="/account"
        title="Open your profile"
        className={`inline-flex min-w-0 items-center gap-2 rounded-full border border-line bg-white/5 text-ink-2 transition hover:border-brand/50 hover:bg-white/10 ${
          compact ? "px-1.5 py-1.5 sm:px-3" : "px-2.5 py-1.5"
        }`}
      >
        {account.avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={account.avatar}
            alt=""
            width={28}
            height={28}
            referrerPolicy="no-referrer"
            className="h-7 w-7 shrink-0 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-hi text-2xs font-semibold text-white">
            {initials}
          </span>
        )}
        <span className={`${compact ? "hidden sm:inline" : "inline"} max-w-28 truncate text-2xs font-medium`}>
          {account.name}
        </span>
      </Link>
    </div>
  );
}
