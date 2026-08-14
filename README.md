# Haven

A privacy-styled, multi-model AI chat interface. Original branding, inspired
by the "private-by-default, pick-your-model" category of chat apps (e.g.
Venice.ai) but not affiliated with or copying any of them.

Haven runs real open-weight models **in your browser** via
[WebLLM](https://github.com/mlc-ai/web-llm) and WebGPU — there is no backend
and no API key. The first message with a given model downloads its weights
and caches them; every message and reply after that is generated on-device.
Chat history persists to `localStorage` only.

## What leaves your browser

Inference is local, but the app is not hermetic. Exactly two things reach the
network, and nothing else does:

1. **Model weights**, on first use of each model — from HuggingFace, plus
   compiled GPU kernels from GitHub. Cached afterwards, so a model you've
   already used works offline.
2. **Your coordinates**, *only* if you turn location sharing on — sent to
   BigDataCloud's reverse-geocoding endpoint to resolve a place name
   (`reverseGeocode`, `src/lib/location.ts`). Off by default.

Your messages and the model's replies are never transmitted anywhere.

## Requirements

- A browser with WebGPU: recent desktop Chrome, Edge, or Firefox, or Safari
  on iOS 18+. Haven detects support and shows a clear message instead of a
  broken UI if it's missing.
- A real GPU. This won't run usefully in a headless/CI browser or a VM
  without GPU passthrough.
- Enough memory. On a phone, prefer the smaller models — the picker warns
  when one looks too large for the device.

## Features

- Sidebar with conversation history: create, switch, delete (tap the trash
  icon, then tap again to confirm), and clear all
- Nine models from ~0.4 GB to ~2.9 GB, ordered smallest first, each showing
  its size and a fit warning when the device looks too constrained
- Streaming replies with a stop button
- Plain-language errors when a model fails, with the raw message kept
- **Device context** injected into the system prompt, each opt-in:
  - current date, time and timezone (always on)
  - approximate location, with coordinates and a resolved place name
  - **geofencing** — distance from where the conversation started; ask the
    model to reset the start point and it can
  - **heart rate**, measured by covering the rear camera with a fingertip
    (optical estimate, not a medical reading)
- A system-prompt viewer (ⓘ in the header) showing exactly what gets sent
- Local-only persistence — no accounts, no server, no logs

### Turning location on for your own devices

Location sharing is off by default so first-time visitors aren't prompted.
Visit `?location=on` once per device to enable it; the parameter is stripped
from the URL immediately, so a shared link doesn't carry it. `?location=off`
reverses it.

## Getting started

```bash
npm install
npm run dev
```

Open in a WebGPU-capable browser. Picking a model for the first time
downloads and caches it — subsequent chats with that model load from cache
and work fully offline.

## Models

| Model | WebLLM id | Badge | Size |
| --- | --- | --- | --- |
| SmolLM2 360M Instruct | `SmolLM2-360M-Instruct-q4f16_1-MLC` | Tiny | ~0.4 GB |
| Gemma 3 1B Instruct | `gemma3-1b-it-q4f16_1-MLC` | Fast | ~0.7 GB |
| Llama 3.2 1B Instruct | `Llama-3.2-1B-Instruct-q4f16_1-MLC` | Fast | ~0.9 GB |
| Qwen2.5 0.5B Instruct | `Qwen2.5-0.5B-Instruct-q4f16_1-MLC` | Fast | ~0.9 GB |
| Qwen2.5 Coder 0.5B Instruct | `Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC` | Code | ~0.9 GB |
| Qwen3 0.6B | `Qwen3-0.6B-q4f16_1-MLC` | Reasoning | ~1.4 GB |
| Llama 3.2 3B Instruct | `Llama-3.2-3B-Instruct-q4f16_1-MLC` | General | ~2.3 GB |
| Qwen2.5 Coder 3B Instruct | `Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC` | Code | ~2.5 GB |
| Ministral 3 3B Reasoning | `Ministral-3-3B-Reasoning-2512-q4f16_1-MLC` | Reasoning | ~2.9 GB |

All are `q4f16_1` builds with a 4096-token context. Sizes are the VRAM
figures WebLLM reports. Swap in any of the 165 models in WebLLM's
`prebuiltAppConfig.model_list` by changing `webllmId` in
`src/data/models.ts` — but note ids are persisted in saved conversations, so
renaming one needs a `LEGACY_MODEL_IDS` entry.

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

See `CLAUDE.md` for architecture notes and the platform constraints behind
several non-obvious decisions.
