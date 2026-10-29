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
- `src/lib/` — engine and sensing modules: `engine`, `generate`, `venice`, `respond`, `storage`,
  `capability`, `engineErrors`, `location`, `geofence`, `heartRate`; sessions: `peer`, `session`,
  `useSharedSession`.
- `src/components/` — UI. `src/data/models.ts` — the model roster.

Replies come from one of two providers, chosen per conversation by its `modelId`: an on-device
WebLLM model (the default) or a Venice.ai cloud model (ids prefixed `venice:`, `src/lib/venice.ts`).
Everything else — history, the system-prompt lines, the geofence marker — is shared.
`prepareGenerator` (`src/lib/generate.ts`) turns a model id into a streaming function for either.

A conversation with `shared` set is a **mediated session** instead: two people on their own phones
plus one AI mediator (see the Sessions section).

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
Current exceptions: model weight downloads (unavoidable, first use), reverse geocoding via
BigDataCloud when location sharing is on (`reverseGeocode`, `src/lib/location.ts`), chats that use
a Venice model, which send the messages and full system prompt to Venice, and session pairing, which
asks public STUN servers (Google, Cloudflare) for each phone's address. Venice is inert until the
user saves their own API key — no request reaches Venice before that, not even the model list.

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

## Venice (cloud models)

- **CORS is open**: `access-control-allow-origin: *` on both `/models` and the chat-completions
  preflight, so the static site calls `https://api.venice.ai/api/v1` directly. No proxy.
- **The key is user-supplied** and stored in `localStorage` (`haven.veniceApiKey.v1`). There is
  deliberately no URL parameter for it, unlike other opt-ins — a key in a URL leaks into history.
  Never commit a key; this repo and its bundles are public.
- Requests send `venice_parameters.include_venice_system_prompt: false`; otherwise Venice prepends
  its own prompt and the prompt viewer's "exactly what's sent" becomes false.
- The cloud system prompt must not claim on-device privacy (`CLOUD_SYSTEM_PROMPT` in `respond.ts`).
- The model list is fetched live and cached, so labels on old replies survive a model being retired
  upstream (falling back to Venice's raw id).
- Not yet done: the "digital twin" split, where the local model holds raw sensor data and only a
  summary goes to the cloud. Today a Venice chat gets the same sensor lines a local chat does.

## Sessions (two people, one mediator)

- **Direct WebRTC data channel, no server.** The phones swap connection descriptions by hand: the
  host shows an invitation QR (a `#join=` link, so the iPhone Camera app can open it), the guest's
  phone shows a reply QR, the host scans it in-app (`jsqr`; Safari has no `BarcodeDetector`). Codes
  are deflate-compressed SDP (`src/lib/peer.ts`); a busy phone's invitation is about a version-21 QR.
  Non-trickle ICE with a 4 s gathering cap, STUN only, **no TURN** — reliable on shared Wi-Fi, may
  fail on mobile data. That trade-off was chosen: sessions are meant to be in person.
- **The host's phone is the source of truth and runs the mediator**, with the host's model and key.
  It replays the whole transcript whenever the guest connects, and accepts only `role: 'user'`
  messages from the guest, stamped with the guest's name — a guest can't forge mediator replies.
- **Consent before joining.** The guest sees the mediator's exact instructions, the model, and
  whether it's Venice, and must accept. Rejoining the same `sessionId` skips this only when the
  instructions and model are unchanged.
- **Pause:** either person can pause; only the one who paused can resume. Nothing can be sent while
  paused, and the mediator's in-flight reply is aborted. **Leave** ends the session for both.
- **The mediator may stay silent** by replying exactly `<<PASS>>` (`PASS_MARKER`, `session.ts`);
  replies are held back while they could still be a pass, then dropped on both phones.
- **No sensor data in sessions** — no location, geofence or heart-rate lines, and those toolbar
  controls are hidden there. Sharing one person's data needs that person's own consent, not built yet.
- Safari only reveals real local addresses to pages holding camera permission; `primeLocalAddresses`
  requests it before creating a description. A hedge, unverified on a device.
- A home-screen web app and Safari have **separate storage** on iOS. Opening an invitation with the
  Camera app lands in Safari, so someone who uses Haven from the home screen should join in-app.
- **Testing:** two Playwright browser contexts on one Chromium connect over localhost; use the
  "Paste a code instead" path and stub `navigator.share`/`clipboard.writeText` to capture codes.
  Launch with `--use-fake-ui-for-media-stream` so the camera request doesn't hang. Seed storage only
  after the page settles — the app's first save overwrites anything written before it runs.
- Not yet built: private coach chats that can read the session, "pass to the mediator", per-person
  sensor sharing, protecting private chats on a shared phone, and the witness/apprentice role.
