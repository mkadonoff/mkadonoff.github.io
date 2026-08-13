interface Props {
  icon: (props: { className?: string }) => React.ReactElement
  active?: boolean
  title: string
  onClick: () => void
}

export function ToolbarButton({ icon: Icon, active, title, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      title={title}
      aria-label={title}
      aria-pressed={active}
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors ${
        active ? 'bg-amber-500/20 text-amber-400' : 'text-neutral-400 hover:bg-white/5 hover:text-neutral-200'
      }`}
    >
      <Icon className="h-4 w-4" />
    </button>
  )
}
