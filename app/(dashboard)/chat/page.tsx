"use client";

import { ChatProvider } from "@/context/ChatContext";
import { ChatLayout } from "@/components/dashboard/chat/ChatLayout";

export default function ChatPage() {
  return (
    <ChatProvider>
      <ChatLayout />
    </ChatProvider>
  );
}
