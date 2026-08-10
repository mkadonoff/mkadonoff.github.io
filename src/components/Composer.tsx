import { useRef, useState, type KeyboardEvent } from 'react'
import { SendIcon } from './icons'

interface Props {
  disabled: boolean
  onSend: (text: string) => void
}

export function Composer({ disabled, onSend }: Props) {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || disabled) return
    onSend(trimmed)
    setValue('')
    requestAnimationFrame(() => {
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    })
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  function autosize() {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }

  return (
    <div className="border-t border-white/10 bg-neutral-950/80 p-4">
      <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border border-white/10 bg-white/5 px-3 py-2 focus-within:border-amber-500/50">
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            autosize()
          }}
          onKeyDown={onKeyDown}
          rows={1}
          placeholder="Message Haven…"
          className="max-h-[200px] flex-1 resize-none bg-transparent py-1.5 text-[15px] text-neutral-100 placeholder-neutral-500 outline-none"
        />
        <button
          onClick={submit}
          disabled={disabled || !value.trim()}
          className="mb-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-500 text-neutral-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-30"
        >
          <SendIcon className="h-4 w-4" />
        </button>
      </div>
      <p className="mx-auto mt-2 max-w-3xl text-center text-[11px] text-neutral-600">
        Demo mode — every reply is generated locally in your browser. Nothing you type leaves this device.
      </p>
    </div>
  )
}
