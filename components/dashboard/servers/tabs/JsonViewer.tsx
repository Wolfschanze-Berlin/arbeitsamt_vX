"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/context/theme-context";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface JsonViewerProps {
  json: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

function JsonViewer({ json, className }: JsonViewerProps) {
  const { theme } = useTheme();
  const [html, setHtml] = useState<string | null>(null);

  const formatted = (() => {
    try {
      return JSON.stringify(JSON.parse(json), null, 2);
    } catch {
      return json;
    }
  })();

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const { codeToHtml } = await import("shiki");
      const result = await codeToHtml(formatted, {
        lang: "json",
        theme: theme === "dark" ? "github-dark" : "github-light",
      });
      if (!cancelled) setHtml(result);
    })();

    return () => {
      cancelled = true;
    };
  }, [formatted, theme]);

  if (!html) {
    return (
      <pre className={`bg-muted overflow-auto rounded-md p-4 font-mono text-xs leading-relaxed ${className ?? ""}`}>
        {formatted}
      </pre>
    );
  }

  return (
    <div
      className={`overflow-auto rounded-md text-xs leading-relaxed [&_pre]:!bg-transparent [&_pre]:p-4 ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export { JsonViewer };
export type { JsonViewerProps };
