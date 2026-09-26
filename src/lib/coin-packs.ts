export type CoinPack = {
  id: "starter" | "popular" | "value";
  name: string;
  coins: number;
  amountPaise: number;
  description: string;
  badge?: string;
};

// Razorpay orders use INR paise. The wallet itself remains coin-based; these
// are the initial purchase prices and can be moved to admin settings later.
export const COIN_PACKS: readonly CoinPack[] = [
  { id: "starter", name: "Starter", coins: 100, amountPaise: 9900, description: "A small boost to your wallet" },
  { id: "popular", name: "Popular", coins: 550, amountPaise: 49900, description: "Best for regular chatters", badge: "Most popular" },
  { id: "value", name: "Value", coins: 1200, amountPaise: 99900, description: "More coins, better value", badge: "Best value" },
];

export function getCoinPack(id: string) {
  return COIN_PACKS.find((pack) => pack.id === id) ?? null;
}

export function formatInr(paise: number) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);
}
