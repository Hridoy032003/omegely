import type { Metadata } from "next";
import VideoChat from "@/components/VideoChat";

export const metadata: Metadata = {
  title: "Start chatting",
  description:
    "Press Start to meet a random person for a free, anonymous 1:1 video & text chat.",
};

export default function ChatPage() {
  return <VideoChat />;
}
