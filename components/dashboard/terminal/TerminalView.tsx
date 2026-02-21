"use client";

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
  type RefObject,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TerminalTheme = "light" | "dark";

type TerminalViewProps = {
  sessionId: string;
  onData: (data: Uint8Array) => void;
  onResize: (cols: number, rows: number) => void;
  onReady?: () => void;
  theme?: TerminalTheme;
  fontFamily?: string;
  fontSize?: number;
};

export type TerminalViewHandle = {
  write: (data: Uint8Array) => void;
};

// ---------------------------------------------------------------------------
// Theme palettes
// ---------------------------------------------------------------------------

const DARK_THEME = {
  background: "#1a1a2e",
  foreground: "#e0e0e0",
  cursor: "#e0e0e0",
  cursorAccent: "#1a1a2e",
  selectionBackground: "#3a3a5c",
  selectionForeground: "#ffffff",
  black: "#1a1a2e",
  red: "#ff6b6b",
  green: "#51cf66",
  yellow: "#ffd43b",
  blue: "#5c7cfa",
  magenta: "#cc5de8",
  cyan: "#22b8cf",
  white: "#e0e0e0",
  brightBlack: "#585873",
  brightRed: "#ff8787",
  brightGreen: "#69db7c",
  brightYellow: "#ffe066",
  brightBlue: "#748ffc",
  brightMagenta: "#da77f2",
  brightCyan: "#3bc9db",
  brightWhite: "#ffffff",
};

const LIGHT_THEME = {
  background: "#ffffff",
  foreground: "#1a1a2e",
  cursor: "#1a1a2e",
  cursorAccent: "#ffffff",
  selectionBackground: "#c8d6e5",
  selectionForeground: "#1a1a2e",
  black: "#1a1a2e",
  red: "#e03131",
  green: "#2f9e44",
  yellow: "#e67700",
  blue: "#1c7ed6",
  magenta: "#9c36b5",
  cyan: "#0c8599",
  white: "#e0e0e0",
  brightBlack: "#868e96",
  brightRed: "#ff6b6b",
  brightGreen: "#51cf66",
  brightYellow: "#fcc419",
  brightBlue: "#4dabf7",
  brightMagenta: "#cc5de8",
  brightCyan: "#22b8cf",
  brightWhite: "#ffffff",
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export const TerminalView = forwardRef<TerminalViewHandle, TerminalViewProps>(
  function TerminalView(
    {
      sessionId,
      onData,
      onResize,
      onReady,
      theme = "dark",
      fontFamily = "Cascadia Code, Consolas, monospace",
      fontSize = 14,
    },
    ref,
  ) {
    const containerRef = useRef<HTMLDivElement>(null);
    // We store the Terminal instance in a ref so imperative handle can access
    // it without causing re-renders.
    const termRef = useRef<InstanceType<
      Awaited<typeof import("@xterm/xterm")>["Terminal"]
    > | null>(null);
    const fitAddonRef = useRef<InstanceType<
      Awaited<typeof import("@xterm/addon-fit")>["FitAddon"]
    > | null>(null);

    // Track the latest sessionId so we can skip stale initialisations.
    const sessionIdRef = useRef(sessionId);
    sessionIdRef.current = sessionId;

    // -----------------------------------------------------------------------
    // Imperative handle — expose write() to parent
    // -----------------------------------------------------------------------

    useImperativeHandle(
      ref,
      () => ({
        write(data: Uint8Array) {
          termRef.current?.write(data);
        },
      }),
      [],
    );

    // -----------------------------------------------------------------------
    // Stable callback refs (avoid re-creating the terminal on prop change)
    // -----------------------------------------------------------------------

    const onDataRef = useRef(onData);
    onDataRef.current = onData;

    const onResizeRef = useRef(onResize);
    onResizeRef.current = onResize;

    const onReadyRef = useRef(onReady);
    onReadyRef.current = onReady;

    // -----------------------------------------------------------------------
    // Fit helper (debounced)
    // -----------------------------------------------------------------------

    const fitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const requestFit = useCallback(() => {
      if (fitTimeoutRef.current) clearTimeout(fitTimeoutRef.current);
      fitTimeoutRef.current = setTimeout(() => {
        const fit = fitAddonRef.current;
        if (!fit) return;
        try {
          fit.fit();
        } catch {
          // fit() can throw if the container is hidden / zero-sized
        }
      }, 50);
    }, []);

    // -----------------------------------------------------------------------
    // Main effect — bootstrap xterm and addons via dynamic imports
    // -----------------------------------------------------------------------

    useEffect(() => {
      const container = containerRef.current;
      if (!container) return;

      let disposed = false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const disposables: Array<{ dispose: () => void }> = [];

      (async () => {
        // ---- Dynamic imports (all xterm modules need the DOM) ----
        const [
          { Terminal },
          { FitAddon },
          { WebglAddon },
          { CanvasAddon },
          { Unicode11Addon },
          { WebLinksAddon },
        ] = await Promise.all([
          import("@xterm/xterm"),
          import("@xterm/addon-fit"),
          import("@xterm/addon-webgl"),
          import("@xterm/addon-canvas"),
          import("@xterm/addon-unicode11"),
          import("@xterm/addon-web-links"),
        ]);

        // Import CSS side-effect — needs to happen client-side only.
        // TypeScript has no declaration for CSS modules, so we suppress the error.
        // @ts-expect-error -- CSS module import handled by bundler at runtime
        await import("@xterm/xterm/css/xterm.css");

        if (disposed) return;

        // ---- Create terminal ----
        const themeColors = theme === "dark" ? DARK_THEME : LIGHT_THEME;

        const term = new Terminal({
          fontFamily,
          fontSize,
          theme: themeColors,
          cursorBlink: true,
          cursorStyle: "bar",
          allowProposedApi: true,
          scrollback: 10_000,
        });

        termRef.current = term;

        // ---- Open terminal in DOM ----
        term.open(container);

        // ---- FitAddon ----
        const fitAddon = new FitAddon();
        fitAddonRef.current = fitAddon;
        term.loadAddon(fitAddon);
        disposables.push(fitAddon);

        // Initial fit
        try {
          fitAddon.fit();
        } catch {
          // container might not be visible yet
        }

        // ---- WebGL addon (with canvas fallback) ----
        try {
          const webglAddon = new WebglAddon();
          webglAddon.onContextLoss(() => {
            webglAddon.dispose();
            // Fallback to canvas renderer
            try {
              const canvasAddon = new CanvasAddon();
              term.loadAddon(canvasAddon);
              disposables.push(canvasAddon);
            } catch {
              // software renderer is the ultimate fallback — no action needed
            }
          });
          term.loadAddon(webglAddon);
          disposables.push(webglAddon);
        } catch {
          // WebGL not available — try canvas
          try {
            const canvasAddon = new CanvasAddon();
            term.loadAddon(canvasAddon);
            disposables.push(canvasAddon);
          } catch {
            // software renderer fallback — no action needed
          }
        }

        // ---- Unicode11 ----
        const unicode11Addon = new Unicode11Addon();
        term.loadAddon(unicode11Addon);
        term.unicode.activeVersion = "11";
        disposables.push(unicode11Addon);

        // ---- Web links ----
        const webLinksAddon = new WebLinksAddon();
        term.loadAddon(webLinksAddon);
        disposables.push(webLinksAddon);

        // ---- Wire callbacks ----
        const binaryDisposable = term.onBinary((data) => {
          const bytes = new Uint8Array(data.length);
          for (let i = 0; i < data.length; i++) {
            bytes[i] = data.charCodeAt(i);
          }
          onDataRef.current(bytes);
        });
        disposables.push(binaryDisposable);

        const dataDisposable = term.onData((data) => {
          const encoder = new TextEncoder();
          onDataRef.current(encoder.encode(data));
        });
        disposables.push(dataDisposable);

        const resizeDisposable = term.onResize(({ cols, rows }) => {
          onResizeRef.current(cols, rows);
        });
        disposables.push(resizeDisposable);

        // ---- ResizeObserver for auto-fit ----
        const observer = new ResizeObserver(() => {
          requestFit();
        });
        observer.observe(container);

        // Store observer so we can disconnect on cleanup
        const observerDisposable = {
          dispose: () => observer.disconnect(),
        };
        disposables.push(observerDisposable);

        // ---- Notify parent ----
        onResizeRef.current(term.cols, term.rows);
        onReadyRef.current?.();
      })();

      // ---- Cleanup ----
      return () => {
        disposed = true;
        if (fitTimeoutRef.current) clearTimeout(fitTimeoutRef.current);
        for (const d of disposables) {
          try {
            d.dispose();
          } catch {
            // ignore disposal errors
          }
        }
        if (termRef.current) {
          try {
            termRef.current.dispose();
          } catch {
            // ignore
          }
          termRef.current = null;
        }
        fitAddonRef.current = null;
      };
      // Re-mount the terminal when sessionId, theme, or font settings change
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId, theme, fontFamily, fontSize, requestFit]);

    // -----------------------------------------------------------------------
    // Render
    // -----------------------------------------------------------------------

    return (
      <div
        ref={containerRef}
        data-session-id={sessionId}
        className="h-full w-full overflow-hidden"
        style={{ minHeight: 100 }}
      />
    );
  },
);
