import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import "./globals.css";
import CookieConsent from "@/components/CookieConsent";
import FeedbackWidget from "@/components/FeedbackWidget";
import PostHogProvider from "@/components/PostHogProvider";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";

const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  variable: "--font-roboto",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://www.omegley.in"),
  title: {
    default: "Free Random Video Chat with Strangers | Omegley",
    template: "%s | Omegley",
  },
  description:
    "Omegley is a free random video chat with strangers. Meet new people online for anonymous 1-to-1 video, voice, and text chat with no signup or download.",
  keywords: [
    "random video chat",
    "video chat with strangers",
    "talk to strangers online",
    "free video chat",
    "omegle alternative",
    "anonymous video chat",
    "random chat",
  ],
  applicationName: "Omegley",
  authors: [{ name: "Omegley" }],
  creator: "Omegley",
  publisher: "Omegley",
  category: "social",
  alternates: { canonical: "/" },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  openGraph: {
    title: "Free Random Video Chat with Strangers | Omegley",
    description:
      "Meet new people online with free, anonymous 1-to-1 video, voice, and text chat. No signup, no download, and no conversation history.",
    url: "/",
    siteName: "Omegley",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "Free Random Video Chat with Strangers | Omegley",
    description:
      "Free anonymous video chat with strangers. No signup or download—just press Start and meet someone new.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={roboto.variable}>
      <body>
        <PostHogProvider>{children}</PostHogProvider>
        <CookieConsent />
        <FeedbackWidget />
        <PwaInstallPrompt />
      </body>
    </html>
  );
}
