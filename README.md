# arbeitsamt_vx

Tauri 2 desktop application with Next.js 16, React 19, and TypeScript.

## Stack

- **Native shell**: Tauri 2 (Rust)
- **Frontend**: Next.js 16.1.x (static export)
- **UI**: React 19
- **Language**: TypeScript 5.8
- **Package manager**: bun

## Development

```bash
# Install dependencies
bun install

# Run in development (starts Next.js + Tauri)
bun run tauri dev

# Build for production
bun run tauri build
```

## Project Structure

```
app/              # Next.js app router (pages, layouts)
lib/              # Shared utilities (Tauri API wrapper)
public/           # Static assets
src-tauri/        # Rust backend (Tauri commands, config)
```

## Recommended IDE Setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
