"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import {
  type ApiToken,
  type AppSettings,
  type SshProfile,
  type TerminalSettings,
  DEFAULT_SETTINGS,
  loadSettings,
  saveSetting,
} from "@/lib/settings";
import { useTheme } from "@/context/theme-context";

interface SettingsContextType {
  settings: AppSettings;
  isLoaded: boolean;
  updateTheme: (theme: AppSettings["theme"]) => void;
  updateTerminal: (terminal: TerminalSettings) => void;
  updateCheckUpdatesOnLaunch: (value: boolean) => void;
  addProfile: (profile: SshProfile) => void;
  updateProfile: (profile: SshProfile) => void;
  removeProfile: (id: string) => void;
  getProfile: (id: string) => SshProfile | undefined;
  addToken: (token: ApiToken) => void;
  updateToken: (token: ApiToken) => void;
  removeToken: (id: string) => void;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const { toggleTheme } = useTheme();

  useEffect(() => {
    loadSettings().then((loaded) => {
      setSettings(loaded);
      setIsLoaded(true);
    });
  }, []);

  const updateTheme = useCallback(
    (theme: AppSettings["theme"]) => {
      setSettings((prev) => ({ ...prev, theme }));
      saveSetting("theme", theme);
      // Sync to existing ThemeContext — map "system" to OS preference
      const resolved =
        theme === "system"
          ? window.matchMedia("(prefers-color-scheme: dark)").matches
            ? "dark"
            : "light"
          : theme;
      const current = document.documentElement.classList.contains("dark")
        ? "dark"
        : "light";
      if (resolved !== current) toggleTheme();
    },
    [toggleTheme],
  );

  const updateTerminal = useCallback((terminal: TerminalSettings) => {
    setSettings((prev) => ({ ...prev, terminal }));
    saveSetting("terminal", terminal);
  }, []);

  const updateCheckUpdatesOnLaunch = useCallback((value: boolean) => {
    setSettings((prev) => ({ ...prev, checkUpdatesOnLaunch: value }));
    saveSetting("checkUpdatesOnLaunch", value);
  }, []);

  const addProfile = useCallback((profile: SshProfile) => {
    setSettings((prev) => {
      const next = [...prev.sshProfiles, profile];
      saveSetting("sshProfiles", next);
      return { ...prev, sshProfiles: next };
    });
  }, []);

  const updateProfile = useCallback((profile: SshProfile) => {
    setSettings((prev) => {
      const next = prev.sshProfiles.map((p) =>
        p.id === profile.id ? profile : p,
      );
      saveSetting("sshProfiles", next);
      return { ...prev, sshProfiles: next };
    });
  }, []);

  const removeProfile = useCallback((id: string) => {
    setSettings((prev) => {
      const next = prev.sshProfiles.filter((p) => p.id !== id);
      saveSetting("sshProfiles", next);
      return { ...prev, sshProfiles: next };
    });
  }, []);

  const getProfile = useCallback(
    (id: string) => settings.sshProfiles.find((p) => p.id === id),
    [settings.sshProfiles],
  );

  const addToken = useCallback((token: ApiToken) => {
    setSettings((prev) => {
      const next = [...prev.apiTokens, token];
      saveSetting("apiTokens", next);
      return { ...prev, apiTokens: next };
    });
  }, []);

  const updateToken = useCallback((token: ApiToken) => {
    setSettings((prev) => {
      const next = prev.apiTokens.map((t) =>
        t.id === token.id ? token : t,
      );
      saveSetting("apiTokens", next);
      return { ...prev, apiTokens: next };
    });
  }, []);

  const removeToken = useCallback((id: string) => {
    setSettings((prev) => {
      const next = prev.apiTokens.filter((t) => t.id !== id);
      saveSetting("apiTokens", next);
      return { ...prev, apiTokens: next };
    });
  }, []);

  const contextValue = useMemo<SettingsContextType>(
    () => ({
      settings,
      isLoaded,
      updateTheme,
      updateTerminal,
      updateCheckUpdatesOnLaunch,
      addProfile,
      updateProfile,
      removeProfile,
      getProfile,
      addToken,
      updateToken,
      removeToken,
    }),
    [
      settings,
      isLoaded,
      updateTheme,
      updateTerminal,
      updateCheckUpdatesOnLaunch,
      addProfile,
      updateProfile,
      removeProfile,
      getProfile,
      addToken,
      updateToken,
      removeToken,
    ],
  );

  return (
    <SettingsContext.Provider value={contextValue}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error("useSettings must be used within a SettingsProvider");
  }
  return context;
}
