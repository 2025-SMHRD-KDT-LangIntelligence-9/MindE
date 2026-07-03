// 목록 페이지네이션 (총 개수가 pageSize 이하이면 렌더 안 함)
function Pagination({ page, total, pageSize = 10, onChange, unit = '개' }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  if (total <= pageSize) return null;
  return (
    <div className="flex items-center justify-between px-5 py-3 border-t border-outline-variant">
      <p className="text-xs text-on-surface-variant">
        전체 {total}{unit} · {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, total)}
      </p>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(Math.max(1, page - 1))}
          disabled={page === 1}
          className="w-8 h-8 rounded-lg border border-outline-variant flex items-center justify-center text-on-surface-variant hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-base">chevron_left</span>
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={`min-w-8 h-8 px-2 rounded-lg text-xs font-bold transition-colors ${
              n === page ? 'bg-primary text-white' : 'border border-outline-variant text-on-surface-variant hover:bg-slate-50'
            }`}
          >
            {n}
          </button>
        ))}
        <button
          onClick={() => onChange(Math.min(totalPages, page + 1))}
          disabled={page === totalPages}
          className="w-8 h-8 rounded-lg border border-outline-variant flex items-center justify-center text-on-surface-variant hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <span className="material-symbols-outlined text-base">chevron_right</span>
        </button>
      </div>
    </div>
  );
}

export default Pagination;
