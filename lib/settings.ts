"use client";

/**
 * Settings store helpers built on tauri-plugin-store.
 * Provides typed read/write with safe default merging.
 */

// --- Types ---

export type Theme = "light" | "dark" | "system";

export type CursorStyle = "block" | "bar" | "underline";

export type ColorPreset = "default" | "dracula" | "solarized-dark";

export interface SshProfile {
  id: string;
  name: string;
  host: string;
  port: number;
  username: string;
  authMethod: ProfileAuthMethod;
  colorTag: string | null;
}

export type ProfileAuthMethod =
  | { method: "password" }
  | { method: "keyfile"; keyPath: string }
  | { method: "agent" };

export interface TerminalSettings {
  fontSize: number;
  cursorStyle: CursorStyle;
  cursorBlink: boolean;
  scrollback: number;
  colorPreset: ColorPreset;
}

export interface ApiToken {
  id: string;
  key: string;
  value: string;
  description?: string;
  isCustom: boolean;
}

export const PREDEFINED_TOKENS: Omit<ApiToken, "id" | "value">[] = [
  {
    key: "GITHUB_TOKEN",
    description: "GitHub personal access token for API integration",
    isCustom: false,
  },
  {
    key: "OPENAI_API_KEY",
    description: "OpenAI API key for AI-powered features",
    isCustom: false,
  },
  {
    key: "ANTHROPIC_API_KEY",
    description: "Anthropic API key for Claude models",
    isCustom: false,
  },
];

export interface AppSettings {
  theme: Theme;
  terminal: TerminalSettings;
  sshProfiles: SshProfile[];
  checkUpdatesOnLaunch: boolean;
  apiTokens: ApiToken[];
}

// --- Defaults ---

export const DEFAULT_TERMINAL_SETTINGS: TerminalSettings = {
  fontSize: 14,
  cursorStyle: "block",
  cursorBlink: true,
  scrollback: 1000,
  colorPreset: "default",
};

export const DEFAULT_SETTINGS: AppSettings = {
  theme: "light",
  terminal: { ...DEFAULT_TERMINAL_SETTINGS },
  sshProfiles: [],
  checkUpdatesOnLaunch: true,
  apiTokens: [],
};

// --- Terminal Color Presets ---

export interface TerminalColorTheme {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export const COLOR_PRESETS: Record<ColorPreset, TerminalColorTheme> = {
  default: {
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    cursor: "#d4d4d4",
    cursorAccent: "#1e1e1e",
    selectionBackground: "#264f78",
    black: "#000000",
    red: "#cd3131",
    green: "#0dbc79",
    yellow: "#e5e510",
    blue: "#2472c8",
    magenta: "#bc3fbc",
    cyan: "#11a8cd",
    white: "#e5e5e5",
    brightBlack: "#666666",
    brightRed: "#f14c4c",
    brightGreen: "#23d18b",
    brightYellow: "#f5f543",
    brightBlue: "#3b8eea",
    brightMagenta: "#d670d6",
    brightCyan: "#29b8db",
    brightWhite: "#e5e5e5",
  },
  dracula: {
    background: "#282a36",
    foreground: "#f8f8f2",
    cursor: "#f8f8f2",
    cursorAccent: "#282a36",
    selectionBackground: "#44475a",
    black: "#21222c",
    red: "#ff5555",
    green: "#50fa7b",
    yellow: "#f1fa8c",
    blue: "#bd93f9",
    magenta: "#ff79c6",
    cyan: "#8be9fd",
    white: "#f8f8f2",
    brightBlack: "#6272a4",
    brightRed: "#ff6e6e",
    brightGreen: "#69ff94",
    brightYellow: "#ffffa5",
    brightBlue: "#d6acff",
    brightMagenta: "#ff92df",
    brightCyan: "#a4ffff",
    brightWhite: "#ffffff",
  },
  "solarized-dark": {
    background: "#002b36",
    foreground: "#839496",
    cursor: "#839496",
    cursorAccent: "#002b36",
    selectionBackground: "#073642",
    black: "#073642",
    red: "#dc322f",
    green: "#859900",
    yellow: "#b58900",
    blue: "#268bd2",
    magenta: "#d33682",
    cyan: "#2aa198",
    white: "#eee8d5",
    brightBlack: "#586e75",
    brightRed: "#cb4b16",
    brightGreen: "#586e75",
    brightYellow: "#657b83",
    brightBlue: "#839496",
    brightMagenta: "#6c71c4",
    brightCyan: "#93a1a1",
    brightWhite: "#fdf6e3",
  },
};

// --- Profile Color Tags ---

export const PROFILE_COLOR_TAGS = [
  { name: "Red", value: "red", className: "bg-red-500" },
  { name: "Green", value: "green", className: "bg-green-500" },
  { name: "Blue", value: "blue", className: "bg-blue-500" },
  { name: "Yellow", value: "yellow", className: "bg-yellow-500" },
  { name: "Purple", value: "purple", className: "bg-purple-500" },
  { name: "Orange", value: "orange", className: "bg-orange-500" },
] as const;

// --- Store Helpers ---

type StoreInstance = {
  get<T>(key: string): Promise<T | undefined>;
  set(key: string, value: unknown): Promise<void>;
  save(): Promise<void>;
};

let storeInstance: StoreInstance | null = null;

const STORE_NAME = "settings.json";

async function getStore(): Promise<StoreInstance | null> {
  if (storeInstance) return storeInstance;
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return null;
  }
  const { LazyStore } = await import("@tauri-apps/plugin-store");
  storeInstance = new LazyStore(STORE_NAME);
  return storeInstance;
}

/** Load all settings from the store, merged with defaults for safety. */
export async function loadSettings(): Promise<AppSettings> {
  const store = await getStore();
  if (!store) return { ...DEFAULT_SETTINGS };

  const stored = await store.get<Partial<AppSettings>>("settings");
  if (!stored) return { ...DEFAULT_SETTINGS };

  return {
    ...DEFAULT_SETTINGS,
    ...stored,
    terminal: {
      ...DEFAULT_TERMINAL_SETTINGS,
      ...(stored.terminal ?? {}),
    },
    sshProfiles: stored.sshProfiles ?? [],
    apiTokens: stored.apiTokens ?? [],
  };
}

/** Save a single top-level setting key. */
export async function saveSetting<K extends keyof AppSettings>(
  key: K,
  value: AppSettings[K],
): Promise<void> {
  const store = await getStore();
  if (!store) return;

  const current = await store.get<AppSettings>("settings") ?? { ...DEFAULT_SETTINGS };
  const updated = { ...current, [key]: value };
  await store.set("settings", updated);
  await store.save();
}

/** Save the full settings object at once. */
export async function saveAllSettings(settings: AppSettings): Promise<void> {
  const store = await getStore();
  if (!store) return;
  await store.set("settings", settings);
  await store.save();
}
