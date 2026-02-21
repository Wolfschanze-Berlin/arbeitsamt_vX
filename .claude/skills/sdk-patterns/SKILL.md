---
name: sdk-patterns
description: "This skill provides Claude Agent SDK patterns specific to arbeitsamt_vX. Use when running SDK agents, configuring agent options, or building custom agent workflows."
---

# SDK Patterns for arbeitsamt_vX

## Quick Start

### Run an SDK Agent

```bash
# Fire-and-forget (default) — agent works autonomously
uv run python scripts/cli.py "Your task here"

# Wait for response — blocks until agent completes
uv run python scripts/cli.py --wait "Your task here"

# With project-specific system prompt
uv run python scripts/cli.py \
  --append "Follow arbeitsamt_vX conventions: 'use client', @/ imports, shadcn/ui, Tailwind 4.2, static export" \
  "Your task here"
```

## Available SDK Agents

| Agent | File | Use For |
|-------|------|---------|
| `sdk-frontend-agent` | `.claude/agents/sdk-frontend-agent.md` | Next.js pages, React components, dashboard features |
| `sdk-tauri-agent` | `.claude/agents/sdk-tauri-agent.md` | Tauri commands, Rust backend, IPC bridge, plugins |

### Existing Project Agents (Non-SDK)

| Agent | File | Use For |
|-------|------|---------|
| `frontend-dev` | `.claude/agents/frontend-dev.md` | Interactive frontend development |
| `tauri-dev` | `.claude/agents/tauri-dev.md` | Interactive Tauri/Rust development |
| `test-writer` | `.claude/agents/test-writer.md` | Test setup and writing |

## Project-Specific Configuration

### Recommended Options

```python
from verrueckt_task_agent import build_options

# Frontend tasks
frontend_options = build_options(
    permission_mode="acceptEdits",
    model="claude-sonnet-4-6",
    system_prompt_append="""
    Project: arbeitsamt_vX (Tauri 2 + Next.js 16 desktop app)
    Framework: Next.js 16.1.6 with output: 'export' (static only)
    UI: React 19 + shadcn/ui + Tailwind CSS 4.2
    Conventions:
    - Every file needs "use client" directive
    - Use @/ import alias for all imports
    - Use cn() from lib/utils for conditional classes
    - Never edit components/ui/ directly
    - Responsive design with sm/md/lg/xl breakpoints
    """,
)

# Tauri/Rust tasks
tauri_options = build_options(
    permission_mode="acceptEdits",
    model="claude-sonnet-4-6",
    system_prompt_append="""
    Project: arbeitsamt_vX (Tauri 2 desktop app)
    Backend: Rust 2021 edition, Tauri 2.x
    Conventions:
    - Commands in src-tauri/src/lib.rs with #[tauri::command]
    - Register in tauri::generate_handler![]
    - Use Result<T, String> for error handling
    - Frontend uses lib/tauri.ts wrapper (never import @tauri-apps/api directly)
    - Serialize complex types with serde
    """,
)
```

### Tool Restrictions by Domain

| Domain | Recommended Tools | Rationale |
|--------|-------------------|-----------|
| Frontend (pages/components) | Edit, Write, Read, Glob, Grep, Bash | Full access for file creation and build verification |
| Tauri (Rust commands) | Edit, Write, Read, Bash | Needs cargo check/build/test |
| UI components | Bash only | Use `bunx shadcn add` — never edit ui/ directly |

## Key Project Types

### Frontend Types
```typescript
// Theme system
type Theme = "light" | "dark";

// Metric cards
type MetricCardProps = {
  icon: LucideIcon;
  label: string;
  value: string;
  trend: { value: string; direction: "up" | "down" };
};

// Navigation
type NavItem = {
  name: string;
  icon: LucideIcon;
  path?: string;
  subItems?: { name: string; path: string }[];
};
```

### Tauri IPC Bridge
```typescript
// lib/tauri.ts — safe wrappers
tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>
tauriListen<T>(event: string, handler: (payload: T) => void): Promise<() => void>
tauriEmit(event: string, payload?: unknown): Promise<void>
```

## Common Task Examples

### Frontend Tasks
```bash
# New dashboard page
uv run python scripts/cli.py "Create a new page at app/(dashboard)/analytics/page.tsx with a chart showing placement trends over 12 months using Recharts AreaChart"

# New component
uv run python scripts/cli.py "Create a NotificationBell component in components/layout/ that shows a badge count and dropdown list"

# Add shadcn component
uv run python scripts/cli.py "Add the shadcn/ui dialog component and create a ConfirmDialog wrapper in components/dashboard/"
```

### Tauri Tasks
```bash
# New command
uv run python scripts/cli.py "Add a Tauri command 'get_app_version' that returns the version from Cargo.toml"

# Add plugin
uv run python scripts/cli.py "Add the tauri-plugin-store for persistent key-value storage, configure permissions, and create wrapper functions in lib/tauri.ts"
```

## Error Handling

| Error | In This Project | Fix |
|-------|-----------------|-----|
| CLINotFoundError | Claude Code CLI not installed | `npm i -g @anthropic-ai/claude-code` |
| ProcessError | API key or process issue | Check ANTHROPIC_API_KEY env var |
| Build failure | Next.js static export error | Run `bun run build` to see error details |
| Cargo error | Rust compilation failure | Run `cd src-tauri && cargo check` |
| Missing component | shadcn/ui not installed | Run `bunx shadcn add <component-name>` |

## Validation Checklist

After SDK agent completes work:
- [ ] `bun run build` passes (Next.js static export)
- [ ] `cd src-tauri && cargo check` passes (if Rust changed)
- [ ] No TypeScript errors
- [ ] New pages accessible via sidebar navigation
- [ ] Light/dark theme works on new components
- [ ] Responsive layout works at common breakpoints
