# Haven

A privacy-styled, multi-model AI chat interface. Original branding, inspired
by the "private-by-default, pick-your-model" category of chat apps (e.g.
Venice.ai) but not affiliated with or copying any of them.

This is a **frontend-only demo**: there is no backend and no real LLM calls.
Assistant replies are generated locally by a small template engine
(`src/lib/respond.ts`) and streamed into the UI to simulate a live response.
Conversations persist to `localStorage` only — nothing leaves the browser.

## Features

- Sidebar with conversation history (create, switch, delete)
- Model picker with four fictional models, each with its own reply "flavor"
- Streaming-style assistant replies
- Local-only persistence (no accounts, no server)
- Responsive, dark-themed chat UI built with Tailwind CSS v4

## Getting started

```bash
npm install
npm run dev
```

## Wiring up a real model

To turn this into a real chat app, replace `generateReply` /
`streamReply` in `src/lib/respond.ts` with a call to an actual LLM API
(e.g. the Anthropic Messages API) and stream the response chunks into
the same `onChunk` callback used today.

## Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS v4
