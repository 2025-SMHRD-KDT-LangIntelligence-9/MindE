export default function EmptyState({ icon, title, desc, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-14 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-surface-container flex items-center justify-center">
        <span className="material-symbols-outlined text-3xl text-on-surface-variant/40">{icon}</span>
      </div>
      <div className="space-y-1">
        <p className="text-sm font-bold text-on-surface">{title}</p>
        {desc && <p className="text-xs text-on-surface-variant leading-relaxed">{desc}</p>}
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-4 py-2.5 rounded-xl hover:brightness-95 transition-all shadow-sm mt-1"
        >
          {action.icon && <span className="material-symbols-outlined text-sm">{action.icon}</span>}
          {action.label}
        </button>
      )}
    </div>
  );
}
