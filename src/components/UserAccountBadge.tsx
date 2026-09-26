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

  useEffect(() => {
    let mounted = true;

    const loadAccount = async (user: User | null) => {
      if (!user) {
        if (mounted) setAccount(null);
        return;
      }

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
    const { data } = supabase.auth.onAuthStateChange((_event, session) =>
      void loadAccount(session?.user ?? null),
    );
    const refreshOnFocus = () => {
      void supabase.auth.getUser().then(({ data: current }) => void loadAccount(current.user));
    };
    window.addEventListener("focus", refreshOnFocus);

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
      window.removeEventListener("focus", refreshOnFocus);
    };
  }, []);

  if (!account) {
    return (
      <Link
        href="/account"
        className="hidden rounded-full border border-brand/30 bg-brand-soft px-3 py-2 text-2xs font-semibold text-brand-ink transition hover:border-brand/60 hover:text-ink sm:inline-flex"
      >
        Create a free account
      </Link>
    );
  }

  const initials = account.name.trim().slice(0, 1).toUpperCase() || "U";

  return (
    <div className="inline-flex items-center gap-1.5">
      <Link
        href="/wallet"
        title="View your wallet"
        className="inline-flex items-center gap-1.5 rounded-full border border-positive/25 bg-positive/10 px-2.5 py-1.5 text-2xs font-semibold text-positive transition hover:border-positive/50 hover:bg-positive/20"
      >
        <span aria-hidden="true">$</span>
        {account.availableCoins.toLocaleString()}
        <span className="hidden sm:inline">coins</span>
      </Link>

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
