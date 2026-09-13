import type { Metadata } from "next";
import { Inter, Sora } from "next/font/google";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";
import PostHogProvider from "@/components/PostHogProvider";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const sora = Sora({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://omegley.in"),
  title: {
    default: "Omegley — Meet someone new in one click",
    template: "%s · Omegley",
  },
  description:
    "Free, anonymous 1:1 video & text chat with strangers around the world. No signup, no downloads, nothing stored — peer-to-peer and private by design.",
  keywords: [
    "random video chat",
    "talk to strangers",
    "omegle alternative",
    "anonymous video chat",
    "free video chat",
  ],
  openGraph: {
    title: "Omegley — Meet someone new in one click",
    description:
      "Free, anonymous, peer-to-peer 1:1 video & text chat. No signup. Nothing stored.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${sora.variable}`}>
      <body>
        <PostHogProvider>{children}</PostHogProvider>
        <CookieConsent />
      </body>
    </html>
  );
}
