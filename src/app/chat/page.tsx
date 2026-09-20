import type { Metadata } from "next";
import VideoChat from "@/components/VideoChat";

export const metadata: Metadata = {
  title: "Random Video Chat with Strangers",
  description:
    "Start a free random video chat with strangers. Anonymous 1-to-1 video, voice, and text chat in your browser with no signup or download.",
  alternates: { canonical: "/chat" },
};

export default function ChatPage() {
  return <VideoChat />;
}
