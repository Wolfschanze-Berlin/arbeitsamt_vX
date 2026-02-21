# SDK Agent Usage Rules

Rules for using Claude Agent SDK in arbeitsamt_vX.

## Agent Selection

| Task Type | Agent | Mode |
|-----------|-------|------|
| New page or route | sdk-frontend-agent | fire-and-forget |
| New dashboard component | sdk-frontend-agent | fire-and-forget |
| Chart or data visualization | sdk-frontend-agent | wait |
| Form with validation | sdk-frontend-agent | wait |
| New Tauri command | sdk-tauri-agent | fire-and-forget |
| Tauri plugin integration | sdk-tauri-agent | wait |
| Full-stack feature (frontend + Rust) | Both agents sequentially | wait |

## Conventions

- Always append project context to system prompt when running SDK agents
- SDK agents must read CLAUDE.md before starting work
- Use `bun run build` for frontend validation after agent work
- Use `cargo check` in src-tauri/ for Rust validation
- Follow existing patterns: check similar files before creating new ones

## File Ownership

| Agent | Owns | Does Not Touch |
|-------|------|----------------|
| sdk-frontend-agent | app/, components/dashboard/, components/layout/, lib/, context/, hooks/ | components/ui/, src-tauri/ |
| sdk-tauri-agent | src-tauri/src/, src-tauri/Cargo.toml, lib/tauri.ts | app/, components/ |

## Quality Gates

- TypeScript strict mode — no `any` types
- All components must have `"use client"` directive
- Responsive design with Tailwind breakpoints
- Light/dark theme support
- Build must pass: `bun run build`
- Rust must compile: `cd src-tauri && cargo check`
