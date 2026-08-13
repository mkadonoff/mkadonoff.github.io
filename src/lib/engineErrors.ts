import { IntegrityError } from '@mlc-ai/web-llm'
import type { EngineError } from '../types'

/**
 * WebLLM declares ~60 typed error classes but only re-exports IntegrityError from its package
 * index, so `instanceof` isn't available for the rest. Each class does set an explicit `this.name`,
 * which is what we match on here.
 */
const BY_NAME: Record<string, { title: string; hint: string | null }> = {
  WebGPUNotAvailableError: {
    title: "This browser can't run models on-device.",
    hint: 'WebGPU is required. Try a recent Chrome, Edge, or Firefox on desktop, or Safari on iOS 18+.',
  },
  WebGPUNotFoundError: {
    title: 'No compatible GPU was found.',
    hint: "Your device or browser didn't expose a GPU that WebGPU can use.",
  },
  DeviceLostError: {
    title: 'The GPU dropped the model while it was running.',
    hint: 'This usually means the device ran out of memory. Switching to Driftwood Fast is the most likely fix.',
  },
  ShaderF16SupportError: {
    title: "This device's GPU is missing a feature the model needs.",
    hint: 'The shader-f16 WebGPU extension is unavailable here, so this model cannot run.',
  },
  FeatureSupportError: {
    title: "This device's GPU is missing a feature the model needs.",
    hint: 'A required WebGPU extension is unavailable in this browser.',
  },
  ModelNotFoundError: {
    title: "This model isn't available.",
    hint: 'It may have been renamed or removed upstream. Pick a different model.',
  },
  MissingModelWasmError: {
    title: "The model's runtime files are missing.",
    hint: 'The download may be incomplete. Clearing the site data and retrying usually fixes it.',
  },
  UnsupportedTokenizerFilesError: {
    title: "The model's tokenizer files could not be read.",
    hint: 'The cached download is probably damaged. Clear the site data and try again.',
  },
  ContextWindowSizeExceededError: {
    title: 'This conversation is too long for the model.',
    hint: 'These models hold about 4K tokens, and the date, location, and heart-rate lines use some of that. Start a new chat to continue.',
  },
  QuotaExceededError: {
    title: 'There is no room left to store the model.',
    hint: 'Free up space on the device, or choose a smaller model from the picker.',
  },
}

function messageOf(err: unknown): string | null {
  if (err instanceof Error) return err.message || null
  if (typeof err === 'string') return err || null
  return null
}

/**
 * Pure — no DOM access — so it can be exercised outside a browser.
 * `detail` always carries the original text so nothing is lost, just demoted.
 */
export function describeEngineError(err: unknown): EngineError {
  const detail = messageOf(err)

  // The one class WebLLM actually exports, so it can be checked properly.
  if (err instanceof IntegrityError) {
    return {
      title: "The downloaded model failed its integrity check.",
      hint: 'The file may be corrupted or incomplete. Clear the site data and download it again.',
      detail,
    }
  }

  if (err instanceof Error) {
    const mapped = BY_NAME[err.name]
    if (mapped) return { ...mapped, detail }
  }

  if (detail) {
    if (/out of memory|allocation failed|oom/i.test(detail)) {
      return {
        title: 'The device ran out of memory loading this model.',
        hint: 'Choose a smaller model — Driftwood Fast is the lightest at about 0.9 GB.',
        detail,
      }
    }
    if (/fetch|network|failed to load|networkerror/i.test(detail)) {
      return {
        title: "Couldn't download the model.",
        hint: 'Check your internet connection and try again. Once cached, it works offline.',
        detail,
      }
    }
  }

  return {
    title: "Couldn't load the model.",
    hint: null,
    detail: detail ?? 'No further detail was reported.',
  }
}

/** Single-line form for the assistant bubble, where there's no room for a layout. */
export function engineErrorText(error: EngineError): string {
  return error.hint ? `${error.title} ${error.hint}` : error.title
}
