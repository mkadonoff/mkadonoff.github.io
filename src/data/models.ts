import type { ModelOption } from '../types'

export const MODELS: ModelOption[] = [
  {
    id: 'wayfinder-large',
    name: 'Wayfinder Large',
    tagline: 'Balanced flagship for everyday conversation',
    badge: 'General',
    contextWindow: '128K context',
  },
  {
    id: 'lighthouse-reasoning',
    name: 'Lighthouse Reasoning',
    tagline: 'Slower, deliberate answers for hard problems',
    badge: 'Reasoning',
    contextWindow: '64K context',
  },
  {
    id: 'driftwood-fast',
    name: 'Driftwood Fast',
    tagline: 'Lightweight model tuned for quick replies',
    badge: 'Fast',
    contextWindow: '32K context',
  },
  {
    id: 'tidepool-code',
    name: 'Tidepool Code',
    tagline: 'Specializes in reading and writing code',
    badge: 'Code',
    contextWindow: '96K context',
  },
]

export const DEFAULT_MODEL_ID = MODELS[0].id
