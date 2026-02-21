---
name: SDK Patterns
description: >
  Claude Agent SDK patterns specific to arbeitsamt_vX. Use this skill when running
  SDK agents, configuring agent options, building custom agent workflows, or automating
  development tasks. Also use when the user says "spawn an agent", "run this in the
  background", "automate this", "use an SDK agent", "fire and forget", or asks about
  agent configuration, tool restrictions, or validation after agent work.
version: 1.1.0
---

# SDK Patterns for arbeitsamt_vX

## Available Agents

### SDK Agents (autonomous, fire-and-forget or wait)

| Agent | File | Use For |
|-------|------|---------|
| `sdk-frontend-agent` | `.claude/agents/sdk-frontend-agent.md` | Next.js pages, React components, dashboard features |
| `sdk-tauri-agent` | `.claude/agents/sdk-tauri-agent.md` | Tauri commands, Rust backend, IPC bridge, plugins |

### Interactive Agents (subagent_type in Task tool)

| Agent | subagent_type | Use For |
|-------|---------------|---------|
| Frontend dev | `frontend-dev` | Interactive frontend development with user feedback |
| Tauri dev | `tauri-dev` | Interactive Tauri/Rust development |
| Test writer | `test-writer` | Test setup and writing |

## When to Use SDK Agents

Use SDK agents for well-defined, autonomous tasks. Use interactive agents when you need back-and-forth with the user or the task scope is unclear.

| Task Type | Agent | Mode |
|-----------|-------|------|
| New page or route | sdk-frontend-agent | fire-and-forget |
| New dashboard component | sdk-frontend-agent | fire-and-forget |
| Chart or data visualization | sdk-frontend-agent | wait |
| Form with validation | sdk-frontend-agent | wait |
| New Tauri command | sdk-tauri-agent | fire-and-forget |
| Tauri plugin integration | sdk-tauri-agent | wait |
| Full-stack feature (frontend + Rust) | Both agents sequentially | wait |

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
    Framework: Next.js 16 with output: 'export' (static only, no SSR)
    UI: React 19 + shadcn/ui + Tailwind CSS 4.2
    Conventions:
    - Every file needs "use client" directive
    - Use @/ import alias for all imports
    - Use cn() from lib/utils for conditional classes
    - Never edit components/ui/ directly
    - Responsive design with sm/md/lg/xl breakpoints
    - Use tauriInvoke/tauriListen from lib/tauri.ts for IPC
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
    - Add permissions in src-tauri/capabilities/default.json
    """,
)
```

### Tool Restrictions by Domain

| Domain | Recommended Tools | Rationale |
|--------|-------------------|-----------|
| Frontend (pages/components) | Edit, Write, Read, Glob, Grep, Bash | Full access for file creation and build verification |
| Tauri (Rust commands) | Edit, Write, Read, Bash | Needs cargo check/build/test |
| UI components | Bash only | Use `bunx shadcn add` — never edit ui/ directly |

### File Ownership

| Agent | Owns | Does Not Touch |
|-------|------|----------------|
| sdk-frontend-agent | app/, components/dashboard/, components/layout/, lib/, context/, hooks/ | components/ui/, src-tauri/ |
| sdk-tauri-agent | src-tauri/src/, src-tauri/Cargo.toml, lib/tauri.ts | app/, components/ |

## Key Project Types

### Frontend Types
```typescript
type Theme = "light" | "dark"

type MetricCardProps = {
  icon: LucideIcon
  label: string
  value: string
  trend: { value: string; direction: "up" | "down" }
}

type NavItem = {
  name: string
  icon: LucideIcon
  path?: string
  subItems?: { name: string; path: string }[]
}
```

### Tauri IPC Bridge
```typescript
// lib/tauri.ts — safe wrappers with lazy-loading and env detection
tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T>
tauriListen<T>(event: string, handler: (payload: T) => void): Promise<() => void>
tauriEmit(event: string, payload?: unknown): Promise<void>
```

## Common Task Examples

### Frontend Tasks
```bash
# New dashboard page — use sdk-frontend-agent
Task(subagent_type="sdk-frontend-agent", prompt="Create a new page at app/(dashboard)/analytics/page.tsx with a chart showing placement trends over 12 months using Recharts AreaChart")

# New component — use sdk-frontend-agent
Task(subagent_type="sdk-frontend-agent", prompt="Create a NotificationBell component in components/layout/ that shows a badge count and dropdown list")
```

### Tauri Tasks
```bash
# New command — use sdk-tauri-agent
Task(subagent_type="sdk-tauri-agent", prompt="Add a Tauri command 'get_app_version' that returns the version from Cargo.toml")
```

## Error Handling

| Error | In This Project | Fix |
|-------|-----------------|-----|
| Build failure | Next.js static export error | Run `bun run build` to see error details |
| Cargo error | Rust compilation failure | Run `cd src-tauri && cargo check` |
| Missing component | shadcn/ui not installed | Run `bunx shadcn add <component-name>` |
| Tauri env error | Not running in Tauri webview | Ensure component uses lib/tauri.ts wrappers |

## Validation Checklist

After SDK agent completes work:
- [ ] `bun run build` passes (Next.js static export)
- [ ] `cd src-tauri && cargo check` passes (if Rust changed)
- [ ] No TypeScript errors
- [ ] New pages accessible via sidebar navigation (`components/layout/nav-main.tsx`)
- [ ] Light/dark theme works on new components
- [ ] Responsive layout works at common breakpoints
- [ ] All props are typed — no `any`
- [ ] `"use client"` directive present on all new component files

See also: **component-patterns** for UI code examples, **project-patterns** for architecture conventions.
