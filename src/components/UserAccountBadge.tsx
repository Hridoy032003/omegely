"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase-browser";

type UserAccountBadgeProps = {
  compact?: boolean;
};

type AccountDetails = {
  name: string;
  avatar: string;
  coinBalance: number;
};

function detailsFromUser(user: User): AccountDetails {
  const metadata = user.user_metadata ?? {};
  const name = typeof metadata.full_name === "string"
    ? metadata.full_name
    : typeof metadata.name === "string"
      ? metadata.name
      : user.email?.split("@")[0] || "Your account";
  const avatar = typeof metadata.avatar_url === "string"
    ? metadata.avatar_url
    : typeof metadata.picture === "string"
      ? metadata.picture
      : "";

  return { name, avatar, coinBalance: 0 };
}

export default function UserAccountBadge({ compact = false }: UserAccountBadgeProps) {
  const [account, setAccount] = useState<AccountDetails | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadAccount = async (user: User | null) => {
      if (!user) {
        if (mounted) setAccount(null);
        return;
      }

      const googleDetails = detailsFromUser(user);
      if (mounted) setAccount({ ...googleDetails, coinBalance: 0 });

      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url, coin_balance")
        .eq("id", user.id)
        .maybeSingle();

      if (mounted) {
        setAccount({
          name: data?.display_name || googleDetails.name,
          avatar: googleDetails.avatar || data?.avatar_url || "",
          coinBalance: Number(data?.coin_balance ?? 0),
        });
      }
    };

    void supabase.auth.getUser().then(({ data }) => void loadAccount(data.user));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      void loadAccount(session?.user ?? null);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  if (!account) return <Link href="/account?mode=signup#earnings" className="hidden rounded-full border border-indigo-400/30 bg-indigo-500/10 px-3 py-2 text-xs font-semibold text-indigo-200 transition hover:border-indigo-300/60 hover:bg-indigo-500/20 sm:inline-flex">Sign in to earn $1</Link>;

  const initials = account.name.trim().slice(0, 1).toUpperCase() || "U";

  return <div className="inline-flex items-center gap-1.5"><Link href="/account#earnings" title="View your balance" className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-2.5 py-1.5 text-xs font-semibold text-emerald-200 transition hover:border-emerald-300/50 hover:bg-emerald-400/20"><span aria-hidden="true">$</span>{account.coinBalance} <span className="hidden sm:inline">coins</span></Link><Link
      href="/account"
      title="Open your profile"
      className={`group inline-flex min-w-0 items-center gap-2 rounded-full border border-white/10 bg-white/5 text-neutral-200 transition hover:border-indigo-400/50 hover:bg-white/10 ${compact ? "px-1.5 py-1.5 sm:px-3" : "px-2.5 py-1.5"}`}
    >
      {account.avatar ? (
        <img
          src={account.avatar}
          alt=""
          referrerPolicy="no-referrer"
          className="h-7 w-7 shrink-0 rounded-full object-cover"
        />
      ) : (
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-indigo-500/80 text-xs font-semibold text-white">
          {initials}
        </span>
      )}
      <span className={`${compact ? "hidden sm:inline" : "inline"} max-w-28 truncate text-xs font-medium`}>
        {account.name}
      </span>
    </Link></div>;
}
