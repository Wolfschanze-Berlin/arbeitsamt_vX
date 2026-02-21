"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useCallback, useEffect, useRef } from "react";
import { tauriListen } from "@/lib/tauri";

const NAV_ROUTES: Record<string, string> = {
  "nav-dashboard": "/",
  "nav-ssh": "/ssh",
  "nav-github": "/github",
  "nav-kanban": "/kanban",
  "nav-settings": "/settings",
};

export function useMenuListener() {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const themeRef = useRef(theme);
  themeRef.current = theme;

  const handleNavigate = useCallback(
    (id: string) => {
      const route = NAV_ROUTES[id];
      if (route) router.push(route);
    },
    [router],
  );

  const handleAction = useCallback(
    (action: string) => {
      switch (action) {
        case "toggle-theme":
          setTheme(themeRef.current === "dark" ? "light" : "dark");
          break;
        case "zoom-in":
          document.body.style.zoom = `${parseFloat(document.body.style.zoom || "1") + 0.1}`;
          break;
        case "zoom-out":
          document.body.style.zoom = `${Math.max(0.5, parseFloat(document.body.style.zoom || "1") - 0.1)}`;
          break;
        case "zoom-reset":
          document.body.style.zoom = "1";
          break;
        case "fullscreen":
          if (document.fullscreenElement) {
            document.exitFullscreen();
          } else {
            document.documentElement.requestFullscreen();
          }
          break;
        case "new-ssh":
          router.push("/ssh");
          window.dispatchEvent(new CustomEvent("menu:new-ssh"));
          break;
      }
    },
    [setTheme, router],
  );

  useEffect(() => {
    const unlisteners: (() => void)[] = [];

    tauriListen<string>("menu-navigate", handleNavigate).then((u) =>
      unlisteners.push(u),
    );
    tauriListen<string>("menu-action", handleAction).then((u) =>
      unlisteners.push(u),
    );

    return () => {
      unlisteners.forEach((u) => u());
    };
  }, [handleNavigate, handleAction]);
}
