# Claude Context

## Architecture Context

Read `.claude/skills/project-architecture/SKILL.md` for the full IPC command inventory, Rust module map, type contracts, and file ownership boundaries before working on cross-layer features or adding new Tauri commands.

Related skills: **project-patterns** (directory conventions), **component-patterns** (UI code examples), **sdk-patterns** (agent automation).

## Behavioral Rules (Always Enforced)

- When creating many github issues using gh cli batch them with & its much faster than creating them one by one. For example: `gh issue create -t "Issue Title" -b "Issue Body" &` (repeat for each issue)
- ALWAYS prefer editing an existing file to creating a new one
- NEVER proactively create documentation files (\*.md) or README files unless explicitly requested
- NEVER save working files, text/mds, or tests to the root folder
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- ALWAYS batch ALL file reads/writes/edits in ONE message
- ALWAYS batch ALL terminal operations in ONE Bash message (note: if one parallel call fails, siblings may cascade-fail — re-run unfailed queries in next batch)
- When analyzing code or exploring the codebase, use LSP and project-specific tools first, not raw grep/bash. Check for existing project utilities before reaching for generic CLI tools.
- ALWAYS use the LSP tool (goToDefinition, findReferences, hover, workspaceSymbol) when researching source code, finding symbols, tracing object definitions, or navigating call hierarchies. Prefer LSP over Grep/Glob for symbol-level queries.
- When modifying file paths or moving files, always fix ALL cross-references and imports across the entire codebase. Never create copies of files as a workaround — fix the actual path references instead.
- ALWAYS search Solomon's Library MCP for relevant context and overview before starting any task. Use `mcp__solomons-library__search` to find existing knowledge that may inform your approach.
- NEVER write a file or class exceeding 500 lines — split into focused modules if needed
- ALWAYS follow KISS (Keep It Simple) and DRY (Don't Repeat Yourself) principles
- ALWAYS give each class/module a single, well-defined purpose (Single Responsibility)
