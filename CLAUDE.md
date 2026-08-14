# Haven

An in-browser AI chat app. Static site, no backend, deployed to GitHub Pages. Models run on-device
via WebLLM over WebGPU. Chat history lives in `localStorage` only.

**Primary target is an iPhone.** Most non-obvious constraints below come from iOS Safari.

## Commands

```bash
npm install
npm run dev
npm run build          # tsc -b && vite build
npx tsc -b             # typecheck
npx oxlint             # lint
```

## Architecture

- `src/App.tsx` — state, the send pipeline, header/toolbar.
- `src/lib/` — engine and sensing modules: `engine`, `respond`, `storage`, `capability`,
  `engineErrors`, `location`, `geofence`, `heartRate`.
- `src/components/` — UI. `src/data/models.ts` — the model roster.

Device context reaches the model as **system-prompt lines**, assembled by `buildSystemPrompt` in
`src/lib/respond.ts`: date/time, location, geofence distance, heart rate. Each is null when its
feature is off and gets filtered out. This injection is central — several constraints below exist
because of it.

## WebLLM constraints (verified against the installed package; re-check on upgrade)

- Models come from the exported `prebuiltAppConfig` (165 records). **Read `vram_required_MB` from it
  rather than duplicating figures** — `requiredVramMb()` in `src/lib/capability.ts` does this.
- Weights download from HuggingFace (`mlc-ai` org); compiled kernels come from a
  `raw.githubusercontent.com` path pinned to the installed package version, so **upgrading
  `@mlc-ai/web-llm` invalidates cached models**.
- **Tool/function calling is unusable here.** It is restricted to five Hermes models (7B–8B, all
  ≥3.9 GB) *and* throws `CustomSystemPromptError` if you supply your own system prompt — mutually
  exclusive with the context injection above. This is why `src/lib/geofence.ts` uses a
  `<<RESET_GEOFENCE>>` text marker that the app strips from replies instead of a real tool call.
- **Only `IntegrityError` is re-exported** from the package index, so the other ~60 typed errors
  can't be caught with `instanceof`. Match on `err.name` — see `src/lib/engineErrors.ts`.
- Kernel filenames legitimately mismatch model names (Qwen2.5-0.5B loads a `Qwen2-0.5B` wasm); MLC
  reuses one kernel library across architecturally identical models. Not a bug.

## iOS realities

- **No hover.** A control revealed only on `:hover`/`group-hover` is permanently invisible on the
  phone. This once made chat deletion appear missing entirely.
- **`100vh` overshoots the visible viewport** (it assumes the URL bar is hidden), which makes the
  page scroll and the header drift away. The shell uses `h-dvh`; `body` is `overflow: hidden`.
- **No torch control**, so camera-based heart rate (`src/lib/heartRate.ts`) has a weak signal and
  will legitimately fail to lock on. It returns null rather than guessing.
- **No developer tools in any iOS browser** — they are all WebKit shells; Safari's Web Inspector
  needs a tethered Mac. Debugging device-only failures is genuinely hard.
- Touch targets: keep interactive controls ≈36 px or larger.

## Conventions

- **Opt-in device features** persist in `localStorage`, default **off**, and are settable by a URL
  parameter that strips itself via `history.replaceState` so shared links don't carry it. See
  `applyLocationPreferenceFromUrl` in `src/lib/location.ts` (`?location=on|off`). Follow this shape
  for new ones.
- **Model ids are persisted twice** — on `Conversation.modelId` *and* each `Message.modelId`. Renaming
  an id requires a migration in `loadConversations` (`src/lib/storage.ts`); `LEGACY_MODEL_IDS` in
  `src/data/models.ts` is the existing map. Without it, model labels silently vanish from old replies.
- Model **capability warnings never disable a model** (`src/lib/capability.ts`). The signals are
  hedges, not measurements — no web API reports free memory. A load marker is written *before* an
  attempt and cleared on success, because an out-of-memory tab kill runs no catch block.

## Privacy framing — treat as a requirement

The UI claims conversations stay on-device, and that is the point of the app. Anything that leaves
the browser must be **opt-in, off by default, and disclosed in the UI at the moment it applies**.
Current exceptions: model weight downloads (unavoidable, first use), and reverse geocoding via
BigDataCloud when location sharing is on (`reverseGeocode`, `src/lib/location.ts`).

When adding a network path, update the disclosure text in `src/components/Composer.tsx` — do not let
the stated guarantee drift from what the code does.

## Verifying changes

Run `npx tsc -b && npx oxlint && npm run build`, then:

- **Pure logic** — exercise it directly with `node --experimental-strip-types`. Used for
  `estimateBpm`, `assessModel`, `describeEngineError`, and the id migration. This has caught real
  bugs (an autocorrelation octave error reporting half the true heart rate).
- **UI** — headless Chromium at 390 px with `hasTouch: true`, so hover never applies:
  `/opt/pw-browsers/chromium-1194/chrome-linux/chrome`. Install `playwright` temporarily, then revert
  `package.json` and `package-lock.json`. Note this browser reports **no WebGPU adapter** and only a
  ~0.87 GB storage quota, so model loading can't be exercised and capability warnings will fire —
  stub `navigator.storage.estimate` when testing those.
- Be wary of two harness traps: `page.addInitScript` re-runs on every navigation (it will re-seed
  `localStorage` and mask whether a change persisted), and selectors keyed on text or `aria-label`
  break when a control changes state.

## Next phase (not started)

Route inference to Venice (`https://api.venice.ai/api/v1`, OpenAI-compatible) with the local model
as the on-device "digital twin" holding raw sensor data, and the cloud model as the reasoning layer.

**Unresolved and blocking:** whether Venice sends CORS headers permitting browser calls from
`https://mkadonoff.github.io`. If it does not, a static site cannot call it at all and the phase
requires a proxy backend — a materially different project. Venice's own docs say the API key should
not be exposed in client-side code, which is not encouraging. Verify from a real browser before
writing any code. Any key must be user-supplied and stored locally; never commit one — this repo and
its bundles are public.
