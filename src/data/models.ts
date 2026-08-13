import type { ModelOption } from '../types'

// Ordered smallest first, so the options most likely to load on a phone sit at the top.
// Every entry is a q4f16_1 build with a 4096-token context window.
export const MODELS: ModelOption[] = [
  {
    id: 'smollm2-360m',
    name: 'SmolLM2 360M Instruct',
    tagline: 'Smallest option — loads almost anywhere, but limited',
    badge: 'Tiny',
    contextWindow: '4K context',
    webllmId: 'SmolLM2-360M-Instruct-q4f16_1-MLC',
    downloadSize: '~0.4 GB',
  },
  {
    id: 'gemma3-1b',
    name: 'Gemma 3 1B Instruct',
    tagline: "Google's small instruction-tuned model",
    badge: 'Fast',
    contextWindow: '4K context',
    webllmId: 'gemma3-1b-it-q4f16_1-MLC',
    downloadSize: '~0.7 GB',
  },
  {
    id: 'llama32-1b',
    name: 'Llama 3.2 1B Instruct',
    tagline: "Meta's compact chat model",
    badge: 'Fast',
    contextWindow: '4K context',
    webllmId: 'Llama-3.2-1B-Instruct-q4f16_1-MLC',
    downloadSize: '~0.9 GB',
  },
  {
    id: 'qwen25-05b',
    name: 'Qwen2.5 0.5B Instruct',
    tagline: 'Lightweight general chat, quick to load',
    badge: 'Fast',
    contextWindow: '4K context',
    webllmId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    downloadSize: '~0.9 GB',
  },
  {
    id: 'qwen25-coder-05b',
    name: 'Qwen2.5 Coder 0.5B Instruct',
    tagline: 'Code-focused, small enough for a phone',
    badge: 'Code',
    contextWindow: '4K context',
    webllmId: 'Qwen2.5-Coder-0.5B-Instruct-q4f16_1-MLC',
    downloadSize: '~0.9 GB',
  },
  {
    id: 'qwen3-06b',
    name: 'Qwen3 0.6B',
    tagline: 'Newest Qwen generation, tuned for step-by-step answers',
    badge: 'Reasoning',
    contextWindow: '4K context',
    webllmId: 'Qwen3-0.6B-q4f16_1-MLC',
    downloadSize: '~1.4 GB',
  },
  {
    id: 'llama32-3b',
    name: 'Llama 3.2 3B Instruct',
    tagline: 'Balanced general-purpose chat',
    badge: 'General',
    contextWindow: '4K context',
    webllmId: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    downloadSize: '~2.3 GB',
  },
  {
    id: 'qwen25-coder-3b',
    name: 'Qwen2.5 Coder 3B Instruct',
    tagline: 'Reads and writes code, stronger than the 0.5B',
    badge: 'Code',
    contextWindow: '4K context',
    webllmId: 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC',
    downloadSize: '~2.5 GB',
  },
  {
    id: 'ministral-3b',
    name: 'Ministral 3 3B Reasoning',
    tagline: 'Slower, deliberate answers for hard problems',
    badge: 'Reasoning',
    contextWindow: '4K context',
    webllmId: 'Ministral-3-3B-Reasoning-2512-q4f16_1-MLC',
    downloadSize: '~2.9 GB',
  },
]

// Same underlying model as the previous default — only the id changed.
export const DEFAULT_MODEL_ID = 'qwen25-05b'

/** Conversations saved under the old invented-name ids. Applied on load in lib/storage.ts. */
export const LEGACY_MODEL_IDS: Record<string, string> = {
  'wayfinder-large': 'llama32-3b',
  'lighthouse-reasoning': 'ministral-3b',
  'driftwood-fast': 'qwen25-05b',
  'tidepool-code': 'qwen25-coder-3b',
}
