"use client";

import { useState, useMemo } from "react";
import {
  ResizablePanel,
  ResizablePanelGroup,
  ResizableHandle,
} from "@/components/ui/resizable";
import { Menu } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useChatContext } from "@/context/ChatContext";
import { useSettings } from "@/context/settings-context";
import { ChatHistorySidebar } from "@/components/dashboard/chat/ChatHistorySidebar";
import { ChatWindow } from "@/components/dashboard/chat/ChatWindow";
import { ChatMessageList } from "@/components/dashboard/chat/ChatMessageList";
import { ChatInput } from "@/components/dashboard/chat/ChatInput";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ANTHROPIC_TOKEN_KEY = "ANTHROPIC_API_KEY";
const OPENAI_TOKEN_KEY = "OPENAI_API_KEY";

// ---------------------------------------------------------------------------
// ChatLayout
// ---------------------------------------------------------------------------

export function ChatLayout() {
  const isMobile = useIsMobile();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const {
    messages,
    status,
    error,
    provider,
    model,
    newChat,
    sendMessage,
    stop,
    regenerate,
  } = useChatContext();

  const { settings } = useSettings();

  const hasApiKey = useMemo(() => {
    const tokenKey =
      provider === "anthropic" ? ANTHROPIC_TOKEN_KEY : OPENAI_TOKEN_KEY;
    return settings.apiTokens.some(
      (t) => t.key === tokenKey && t.value.length > 0,
    );
  }, [provider, settings.apiTokens]);

  const isStreaming = status === "streaming" || status === "submitted";
  const hasMessages = messages.length > 0;
  const showRegenerate = hasMessages && !isStreaming && status !== "error";

  // ---- Mobile layout ----
  if (isMobile) {
    return (
      <div className="relative flex h-full flex-col">
        {/* Mobile sidebar toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute left-2 top-2 z-20"
          onClick={() => setSidebarOpen((prev) => !prev)}
          aria-label="Toggle chat sidebar"
        >
          <Menu className="size-4" />
        </Button>

        {/* Overlay sidebar */}
        {sidebarOpen && (
          <>
            <div
              className="fixed inset-0 z-30 bg-black/40"
              onClick={() => setSidebarOpen(false)}
            />
            <div className="fixed inset-y-0 left-0 z-40 w-72 border-r bg-background">
              <ChatHistorySidebar />
            </div>
          </>
        )}

        {/* Main content */}
        <ChatWindow
          messages={messages}
          status={status}
          error={error}
          provider={provider}
          model={model}
          onSend={sendMessage}
          onStop={stop}
          onRegenerate={regenerate}
          onModelChange={(p, m) => newChat(p as "anthropic" | "openai", m as never)}
          hasApiKey={hasApiKey}
          apiTokens={settings.apiTokens}
        >
          <ChatMessageList messages={messages} status={status} />
        </ChatWindow>

        <ChatInput
          onSend={sendMessage}
          onStop={stop}
          onRegenerate={regenerate}
          status={status}
          disabled={!hasApiKey}
          disabledReason={
            !hasApiKey ? "Add an API key in Settings to start chatting." : undefined
          }
          showRegenerate={showRegenerate}
        />
      </div>
    );
  }

  // ---- Desktop layout ----
  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      <ResizablePanel defaultSize={25} minSize={15} collapsible>
        <ChatHistorySidebar />
      </ResizablePanel>

      <ResizableHandle />

      <ResizablePanel minSize={50}>
        <div className="flex h-full flex-col">
          <ChatWindow
            messages={messages}
            status={status}
            error={error}
            provider={provider}
            model={model}
            onSend={sendMessage}
            onStop={stop}
            onRegenerate={regenerate}
            hasApiKey={hasApiKey}
          >
            <ChatMessageList messages={messages} status={status} />
          </ChatWindow>

          <ChatInput
            onSend={sendMessage}
            onStop={stop}
            onRegenerate={regenerate}
            status={status}
            disabled={!hasApiKey}
            disabledReason={
              !hasApiKey
                ? "Add an API key in Settings to start chatting."
                : undefined
            }
            showRegenerate={showRegenerate}
          />
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
