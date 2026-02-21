---
name: Project Patterns
description: This skill provides guidance on arbeitsamt_vX project patterns, conventions, and architecture. Use when working on new features, refactoring, or reviewing code structure.
version: 1.0.0
---

# Project Patterns - arbeitsamt_vX

## Architecture

Tauri 2 desktop app with Next.js 16 frontend:
- **Frontend**: Next.js App Router (static export) served in Tauri webview
- **Desktop Shell**: Tauri 2 (Rust) for native capabilities
- **IPC**: `@tauri-apps/api/core` invoke() → Rust `#[tauri::command]`

## Directory Convention

```
app/                    # Next.js pages (App Router)
  (dashboard)/          # Route group for dashboard pages
  layout.tsx            # Root layout
  globals.css           # Global styles + Tailwind
components/
  ui/                   # shadcn/ui base components (DO NOT manually edit)
  dashboard/            # Dashboard feature components
  layout/               # Layout components (sidebar, header)
context/                # React context providers
hooks/                  # Custom React hooks
lib/                    # Shared utilities
  utils.ts              # cn() helper
  tauri.ts              # Tauri IPC wrappers
src-tauri/              # Rust backend (excluded from TS compilation)
  src/lib.rs            # Tauri commands
  src/main.rs           # Entry point
```

## Component Pattern

```tsx
// Use cn() for conditional classes
import { cn } from "@/lib/utils"

// Use CVA for component variants
import { cva, type VariantProps } from "class-variance-authority"

// shadcn pattern: forwardRef + composable API
const Component = React.forwardRef<HTMLDivElement, Props>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("base-classes", className)} {...props} />
  )
)
```

## Styling

- Tailwind CSS 4.2 with CSS variables for theming
- Base color: Zinc
- Dark mode via `next-themes` + CSS variables
- Animations via `tw-animate-css`

## Anti-Patterns

- Do NOT manually edit files in `components/ui/` — use `bunx shadcn add`
- Do NOT use Pages Router — this is App Router only
- Do NOT import from `src-tauri/` in frontend code
- Do NOT hardcode colors — use CSS variables and Tailwind classes
- Do NOT skip Zod validation on forms
