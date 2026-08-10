# Haven

A privacy-styled, multi-model AI chat interface. Original branding, inspired
by the "private-by-default, pick-your-model" category of chat apps (e.g.
Venice.ai) but not affiliated with or copying any of them.

Haven runs real open-weight models **entirely in your browser** via
[WebLLM](https://github.com/mlc-ai/web-llm) and WebGPU — there is no backend
and no API key. The first message with a given model downloads its weights
(a few hundred MB to ~3 GB depending on the model) and caches them in the
browser; every message after that, and every reply, is generated on-device
with no network requests at all. Chat history persists to `localStorage`
only.

## Requirements

- A browser with WebGPU: recent desktop Chrome, Edge, or Firefox. Haven
  detects support (`navigator.gpu.requestAdapter()`) and shows a clear
  message instead of a broken UI if it's missing.
- A real GPU. This won't run usefully in a headless/CI browser or a VM
  without GPU passthrough.

## Features

- Sidebar with conversation history (create, switch, delete)
- Model picker with four models mapped to real WebLLM checkpoints, each
  suited to a different job (general, reasoning, fast, code)
- Live download/compile progress banner on first use of a model
- Streaming replies, with a stop button to interrupt generation
- Local-only persistence (no accounts, no server, no logs)
- Responsive, dark-themed chat UI built with Tailwind CSS v4

## Getting started

```bash
npm install
npm run dev
```

Open in a WebGPU-capable browser. Picking a model for the first time
downloads and caches it — subsequent chats with that model load from cache
and work fully offline.

## Models

| Haven name           | Underlying model                              | badge     |
| --------------------- | ---------------------------------------------- | --------- |
| Wayfinder Large        | `Llama-3.2-3B-Instruct-q4f16_1-MLC`            | General   |
| Lighthouse Reasoning   | `Ministral-3-3B-Reasoning-2512-q4f16_1-MLC`    | Reasoning |
| Driftwood Fast         | `Qwen2.5-0.5B-Instruct-q4f16_1-MLC`            | Fast      |
| Tidepool Code          | `Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC`        | Code      |

Swap in any model from WebLLM's `prebuiltAppConfig.model_list` by changing
`webllmId` in `src/data/models.ts`.

## Deploying

This is a static site (`npm run build` → `dist/`) — deploy it to any static
host (Vercel, Netlify, GitHub Pages, etc). It **cannot** run as a Claude
Artifact: Artifacts' content-security policy blocks the outbound fetches
WebLLM needs to download model weights, and the bundle (~6 MB, mostly the
WebLLM runtime) is too large to usefully inline.

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4
- `@mlc-ai/web-llm` (in-browser LLM inference over WebGPU)
