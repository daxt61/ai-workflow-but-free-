# SlowBurn

A deliberate, multi-phase AI coding agent desktop app (Electron + React + TypeScript), powered by [OpenRouter](https://openrouter.ai/).

Unlike fast coding assistants, SlowBurn runs **8 sequential phases** per task: Research → Planning → Implementation → Bug Detection → Code Review → Re-Coding → Optimization → Final Validation.

## Setup

1. Install dependencies:

```bash
npm install --legacy-peer-deps
```

2. Run in development:

```bash
npm run dev
```

3. Configure in **Settings**:
   - OpenRouter API key
   - Project folder
   - Model
   - Web search is **free** (SearXNG + DuckDuckGo fallback) — no search API key needed

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Electron with hot reload |
| `npm run build` | Production build |
| `npm test` | Run unit & property tests |

## Architecture

- **Main process**: agent orchestration, file I/O, shell commands, OpenRouter API (API key never leaves main)
- **Preload**: typed `window.slowburn` IPC bridge
- **Renderer**: React UI with Zustand state

Specs and task breakdown: `.kiro/specs/slowburn-agent/`
