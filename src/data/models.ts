import type { ModelOption } from '../types'

export const MODELS: ModelOption[] = [
  {
    id: 'wayfinder-large',
    name: 'Wayfinder Large',
    tagline: 'Balanced flagship for everyday conversation',
    badge: 'General',
    contextWindow: '4K context',
    webllmId: 'Llama-3.2-3B-Instruct-q4f16_1-MLC',
    downloadSize: '~2.3 GB',
  },
  {
    id: 'lighthouse-reasoning',
    name: 'Lighthouse Reasoning',
    tagline: 'Slower, deliberate answers for hard problems',
    badge: 'Reasoning',
    contextWindow: '4K context',
    webllmId: 'Ministral-3-3B-Reasoning-2512-q4f16_1-MLC',
    downloadSize: '~2.9 GB',
  },
  {
    id: 'driftwood-fast',
    name: 'Driftwood Fast',
    tagline: 'Lightweight model tuned for quick replies',
    badge: 'Fast',
    contextWindow: '4K context',
    webllmId: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC',
    downloadSize: '~0.9 GB',
  },
  {
    id: 'tidepool-code',
    name: 'Tidepool Code',
    tagline: 'Specializes in reading and writing code',
    badge: 'Code',
    contextWindow: '4K context',
    webllmId: 'Qwen2.5-Coder-3B-Instruct-q4f16_1-MLC',
    downloadSize: '~2.5 GB',
  },
]

export const DEFAULT_MODEL_ID = MODELS[0].id
