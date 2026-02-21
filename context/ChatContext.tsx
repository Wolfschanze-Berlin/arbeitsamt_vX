"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { Chat, useChat } from "@ai-sdk/react";
import {
  DirectChatTransport,
  ToolLoopAgent,
  type ChatTransport,
  type UIMessage,
  type ChatStatus,
} from "ai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";

import { useSettings } from "@/context/settings-context";
import type { ChatMeta } from "@/lib/chat/types";
import {
  loadAllChats,
  loadChat,
  saveChat,
  deleteChat as deleteStoredChat,
  createChatId,
} from "@/lib/chat/store";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ChatProvider = "anthropic" | "openai";

export type AnthropicModel =
  | "claude-opus-4-6"
  | "claude-sonnet-4-6"
  | "claude-opus-4-5-20251101"
  | "claude-haiku-4-5-20251001"
  | "claude-sonnet-4-5-20250929";

export type OpenAIModel =
  | "gpt-5.2"
  | "gpt-5.1"
  | "gpt-5"
  | "gpt-5-mini"
  | "gpt-5-nano"
  | "o3"
  | "o4-mini";

export type ChatModel = AnthropicModel | OpenAIModel;

interface ChatContextType {
  /** Current chat messages. */
  messages: UIMessage[];
  /** Hook status: ready | submitted | streaming | error. */
  status: ChatStatus;
  /** Last error from the transport / model. */
  error: Error | undefined;
  /** ID of the active chat session. */
  currentChatId: string | null;
  /** Lightweight metadata for all saved chats. */
  chatList: ChatMeta[];
  /** Active AI provider name. */
  provider: ChatProvider;
  /** Active model identifier. */
  model: ChatModel;
  /** Whether the store has finished loading. */
  isLoaded: boolean;

  /** Start a fresh chat with the given provider + model. */
  newChat: (provider: ChatProvider, model: ChatModel) => void;
  /** Switch to an existing chat by ID. */
  selectChat: (id: string) => Promise<void>;
  /** Delete a chat from history. */
  deleteChat: (id: string) => Promise<void>;
  /** Send a user message. */
  sendMessage: (text: string) => void;
  /** Stop the active generation. */
  stop: () => void;
  /** Regenerate the last assistant message. */
  regenerate: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ANTHROPIC_TOKEN_KEY = "ANTHROPIC_API_KEY";
const OPENAI_TOKEN_KEY = "OPENAI_API_KEY";

const INSTRUCTIONS =
  "You are a helpful AI assistant embedded in a desktop server management application.";

function getApiKey(
  tokens: { key: string; value: string }[],
  tokenKey: string,
): string {
  return tokens.find((t) => t.key === tokenKey)?.value ?? "";
}

/**
 * Lazy-load Tauri's HTTP fetch to bypass browser CORS restrictions.
 * The Anthropic API doesn't support browser CORS — Tauri's Rust-side
 * HTTP client sidesteps this by making requests outside the webview.
 * Falls back to native `window.fetch` in non-Tauri environments (dev).
 */
let tauriFetch: typeof globalThis.fetch | null = null;

async function getTauriFetch(): Promise<typeof globalThis.fetch> {
  if (tauriFetch) return tauriFetch;
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    const mod = await import("@tauri-apps/plugin-http");
    tauriFetch = mod.fetch as unknown as typeof globalThis.fetch;
    return tauriFetch;
  }
  return globalThis.fetch;
}

function buildTransport(
  provider: ChatProvider,
  model: ChatModel,
  apiKey: string,
  customFetch: typeof globalThis.fetch,
): DirectChatTransport {
  if (provider === "anthropic") {
    const anthropic = createAnthropic({
      apiKey,
      fetch: customFetch,
      headers: {
        "anthropic-dangerous-direct-browser-access": "true",
      },
    });
    const agent = new ToolLoopAgent({
      model: anthropic(model),
      instructions: INSTRUCTIONS,
    });
    return new DirectChatTransport({ agent });
  }

  const openai = createOpenAI({
    apiKey,
    fetch: customFetch,
  });
  const agent = new ToolLoopAgent({
    model: openai(model),
    instructions: INSTRUCTIONS,
  });
  return new DirectChatTransport({ agent });
}

function buildChatMeta(
  id: string,
  provider: ChatProvider,
  model: ChatModel,
  title?: string,
): ChatMeta {
  const now = new Date().toISOString();
  return {
    id,
    title: title ?? "New chat",
    provider,
    model,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Derive a short title from the first user message (max 60 chars).
 */
function deriveTitle(messages: UIMessage[]): string {
  const first = messages.find((m) => m.role === "user");
  if (!first) return "New chat";
  const text =
    first.parts?.find((p) => p.type === "text")?.text ?? "New chat";
  return text.length > 60 ? `${text.slice(0, 57)}...` : text;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

const DEFAULT_PROVIDER: ChatProvider = "anthropic";
const DEFAULT_MODEL: ChatModel = "claude-sonnet-4-6";

export function ChatProvider_({
  children,
}: {
  children: ReactNode;
}) {
  const { settings, isLoaded: settingsLoaded } = useSettings();

  // ---- Tauri HTTP fetch (resolved once, bypasses CORS) ----
  const fetchRef = useRef<typeof globalThis.fetch | null>(null);

  // ---- Local state ----
  const [provider, setProvider] = useState<ChatProvider>(DEFAULT_PROVIDER);
  const [model, setModel] = useState<ChatModel>(DEFAULT_MODEL);
  const [chatList, setChatList] = useState<ChatMeta[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Track current meta for persistence in onFinish
  const metaRef = useRef<ChatMeta | null>(null);

  // ---- Resolve API key ----
  const apiKey = useMemo(() => {
    const key =
      provider === "anthropic" ? ANTHROPIC_TOKEN_KEY : OPENAI_TOKEN_KEY;
    return getApiKey(settings.apiTokens, key);
  }, [provider, settings.apiTokens]);

  // ---- Build Chat instance (recreated when provider/model/chatId change) ----
  const [chat, setChat] = useState<Chat<UIMessage> | null>(null);

  const createNewChat = useCallback(
    (
      p: ChatProvider,
      m: ChatModel,
      key: string,
      existingMessages?: UIMessage[],
      existingId?: string,
    ) => {
      if (!key || !fetchRef.current) return null;

      const id = existingId ?? createChatId();
      const transport = buildTransport(p, m, key, fetchRef.current);
      const meta = buildChatMeta(id, p, m);
      metaRef.current = meta;

      const instance = new Chat({
        id,
        transport: transport as unknown as ChatTransport<UIMessage>,
        messages: existingMessages,
        onFinish: async ({ messages: msgs }) => {
          if (!metaRef.current) return;
          const title = deriveTitle(msgs);
          const updated = { ...metaRef.current, title };
          metaRef.current = updated;
          await saveChat({ meta: updated, messages: msgs });
          // Refresh chat list
          const all = await loadAllChats();
          setChatList(all);
        },
        onError: (error) => {
          console.error("[ChatContext] Transport error:", error);
        },
      });

      return { instance, id, meta };
    },
    [],
  );

  // ---- Load chat history + resolve Tauri fetch on mount ----
  useEffect(() => {
    if (!settingsLoaded) return;
    Promise.all([loadAllChats(), getTauriFetch()]).then(([all, resolvedFetch]) => {
      setChatList(all);
      fetchRef.current = resolvedFetch;
      setIsLoaded(true);
    });
  }, [settingsLoaded]);

  // ---- Initialize default chat when settings + store are ready ----
  useEffect(() => {
    if (!isLoaded || chat) return;
    if (!apiKey) return;

    const result = createNewChat(provider, model, apiKey);
    if (result) {
      setChat(result.instance);
      setCurrentChatId(result.id);
    }
  }, [isLoaded, apiKey, provider, model, chat, createNewChat]);

  // ---- useChat hook (active only when chat instance exists) ----
  const hookResult = useChat(chat ? { chat } : undefined);

  // ---- Actions ----
  const newChat = useCallback(
    (p: ChatProvider, m: ChatModel) => {
      setProvider(p);
      setModel(m);

      const key =
        p === "anthropic"
          ? getApiKey(settings.apiTokens, ANTHROPIC_TOKEN_KEY)
          : getApiKey(settings.apiTokens, OPENAI_TOKEN_KEY);

      const result = createNewChat(p, m, key);
      if (result) {
        setChat(result.instance);
        setCurrentChatId(result.id);
      }
    },
    [settings.apiTokens, createNewChat],
  );

  const selectChat = useCallback(
    async (id: string) => {
      const session = await loadChat(id);
      if (!session) return;

      const p = session.meta.provider as ChatProvider;
      const m = session.meta.model as ChatModel;
      setProvider(p);
      setModel(m);

      const key =
        p === "anthropic"
          ? getApiKey(settings.apiTokens, ANTHROPIC_TOKEN_KEY)
          : getApiKey(settings.apiTokens, OPENAI_TOKEN_KEY);

      const result = createNewChat(p, m, key, session.messages, id);
      if (result) {
        metaRef.current = session.meta;
        setChat(result.instance);
        setCurrentChatId(id);
      }
    },
    [settings.apiTokens, createNewChat],
  );

  const deleteChatAction = useCallback(
    async (id: string) => {
      await deleteStoredChat(id);
      const all = await loadAllChats();
      setChatList(all);

      // If we deleted the active chat, start a fresh one
      if (id === currentChatId) {
        const result = createNewChat(provider, model, apiKey);
        if (result) {
          setChat(result.instance);
          setCurrentChatId(result.id);
        } else {
          setChat(null);
          setCurrentChatId(null);
        }
      }
    },
    [currentChatId, provider, model, apiKey, createNewChat],
  );

  const sendMessage = useCallback(
    (text: string) => {
      if (!hookResult) return;
      hookResult.sendMessage({ text });
    },
    [hookResult],
  );

  const stop = useCallback(() => {
    hookResult?.stop();
  }, [hookResult]);

  const regenerate = useCallback(() => {
    hookResult?.regenerate();
  }, [hookResult]);

  // ---- Memoized context value ----
  const contextValue = useMemo<ChatContextType>(
    () => ({
      messages: hookResult?.messages ?? [],
      status: hookResult?.status ?? "ready",
      error: hookResult?.error,
      currentChatId,
      chatList,
      provider,
      model,
      isLoaded,
      newChat,
      selectChat,
      deleteChat: deleteChatAction,
      sendMessage,
      stop,
      regenerate,
    }),
    [
      hookResult?.messages,
      hookResult?.status,
      hookResult?.error,
      currentChatId,
      chatList,
      provider,
      model,
      isLoaded,
      newChat,
      selectChat,
      deleteChatAction,
      sendMessage,
      stop,
      regenerate,
    ],
  );

  return (
    <ChatContext.Provider value={contextValue}>{children}</ChatContext.Provider>
  );
}

// Re-export as ChatProvider for consumers
export { ChatProvider_ as ChatProvider };

export function useChatContext() {
  const context = useContext(ChatContext);
  if (!context) {
    throw new Error("useChatContext must be used within a ChatProvider");
  }
  return context;
}
