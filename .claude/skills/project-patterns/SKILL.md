---
name: Project Patterns
description: >
  Architecture, conventions, and directory structure for arbeitsamt_vX.
  Use this skill when working on new features, refactoring, reviewing code structure,
  or when the user asks "where should I put this file?", "what's the folder structure?",
  "how does the project work?", "what are the conventions?", "how do I add a new page?",
  "how does Tauri IPC work?", or any question about project architecture and file organization.
version: 1.1.0
---

# Project Patterns - arbeitsamt_vX

## Architecture

Tauri 2 desktop app with Next.js 16 frontend:
- **Frontend**: Next.js App Router with `output: "export"` (static HTML — no server-side rendering)
- **Desktop Shell**: Tauri 2 (Rust) for native capabilities (SSH, file system, system info)
- **IPC**: Frontend calls Rust via `tauriInvoke()` → Rust `#[tauri::command]`
- **Data Fetching**: SWR hooks with Tauri IPC bridge + offline-friendly caching

## Directory Convention

```
app/                    # Next.js pages (App Router)
  (dashboard)/          # Route group — all dashboard pages live here
    layout.tsx          # Loads DashboardShell with ssr: false
    page.tsx            # Home/overview page
    settings/page.tsx   # Settings page
    ssh/page.tsx        # SSH terminal page
    github/             # GitHub feature pages (repos, orgs, detail)
  layout.tsx            # Root layout
  globals.css           # Global styles (Tailwind 4 CSS-first config)
components/
  ui/                   # shadcn/ui base components (DO NOT manually edit)
  dashboard/            # Dashboard feature components (organized by feature)
  layout/               # Layout components (sidebar, header, nav)
context/                # React context providers
  theme-context.tsx     # Light/dark theme
  settings-context.tsx  # App settings (SSH profiles, API tokens, terminal)
  KanbanContext.tsx     # Kanban board state
  selected-repo-context.tsx  # Currently selected GitHub repo
hooks/                  # Custom React hooks
  useGithub.ts          # SWR hooks for GitHub API (repos, orgs, issues, PRs)
  useSSHSession.ts      # SSH session management
  useKanbanPersistence.ts  # Kanban board persistence
  use-mobile.ts         # Mobile breakpoint detection
lib/                    # Shared utilities
  utils.ts              # cn() helper for Tailwind class merging
  tauri.ts              # Safe Tauri IPC wrappers (tauriInvoke, tauriListen, tauriEmit)
  github.ts             # GitHub API functions (called by hooks)
  github-cache.ts       # Tauri-based cache for GitHub data
  settings.ts           # Settings load/save via Tauri store
src-tauri/              # Rust backend (excluded from TS compilation)
  src/lib.rs            # Tauri command registration
  src/ssh/              # SSH module (connection, key auth, known hosts)
  src/main.rs           # Entry point
  capabilities/         # Tauri permission capabilities
```

## Tauri IPC Bridge

Frontend code never imports `@tauri-apps/api` directly. Instead, use the safe wrappers in `lib/tauri.ts` which handle lazy-loading and environment detection:

```tsx
import { tauriInvoke } from "@/lib/tauri"

// Call a Rust command
const result = await tauriInvoke<string>("my_command", { arg1: "value" })

// Listen to events from Rust
import { tauriListen } from "@/lib/tauri"
const unlisten = await tauriListen<string>("my-event", (payload) => {
  console.log(payload)
})

// Emit events to Rust
import { tauriEmit } from "@/lib/tauri"
await tauriEmit("my-event", { data: "value" })
```

The wrappers check `window.__TAURI_INTERNALS__` at runtime, so components work gracefully in non-Tauri contexts (e.g., `bun run dev` in browser).

## Styling (Tailwind CSS 4)

- **CSS-first config**: `@import "tailwindcss"` in `globals.css` — no `tailwind.config.js`
- **Dark mode**: `@custom-variant dark (&:is(.dark *))` + CSS variables in `:root` / `.dark`
- **Color system**: oklch-based CSS variables (`--background`, `--foreground`, `--primary`, etc.)
- **shadcn theming**: `@import "shadcn/tailwind.css"` for component styles
- **Animations**: `tw-animate-css` for transition/animation utilities
- **Base color**: Zinc palette
- **Conditional classes**: `cn()` from `@/lib/utils` (wraps clsx + tailwind-merge)

## Component Conventions

```tsx
// Always "use client" — this is a static export app
"use client"

// Use @/ import alias for all project imports
import { cn } from "@/lib/utils"

// Use CVA for variant-based components
import { cva, type VariantProps } from "class-variance-authority"

// shadcn pattern: forwardRef + composable API
const Component = React.forwardRef<HTMLDivElement, Props>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("base-classes", className)} {...props} />
  )
)
```

## Data Fetching Pattern

Hooks in `hooks/` use SWR with the Tauri bridge for all data:
```tsx
import useSWR from "swr"
import { tauriInvoke } from "@/lib/tauri"

// Conditional fetching — pass null key to skip
export function useMyData(id: string | null) {
  return useSWR<MyType>(
    id ? `my-data:${id}` : null,
    id ? () => tauriInvoke<MyType>("get_data", { id }) : null,
    { revalidateOnFocus: false, keepPreviousData: true },
  )
}
```

## State Management

- **React Context** for shared UI state (theme, settings, selected items)
- **SWR** for server/API state (GitHub data, SSH sessions)
- **Local useState** for component-scoped state
- No Redux or Zustand — contexts + SWR cover all needs

## Anti-Patterns

- Do NOT manually edit files in `components/ui/` — use `bunx shadcn add`
- Do NOT use Pages Router — this is App Router only
- Do NOT import `@tauri-apps/api` directly — use `@/lib/tauri` wrappers
- Do NOT hardcode colors — use CSS variables and Tailwind classes
- Do NOT skip Zod validation on forms
- Do NOT use `any` types — TypeScript strict mode is enforced
- Do NOT use server components or API routes — `output: "export"` means static only
- Do NOT use `ssr: true` for components that access Tauri APIs

See also: **component-patterns** for UI code examples, **sdk-patterns** for automating development via agents.
