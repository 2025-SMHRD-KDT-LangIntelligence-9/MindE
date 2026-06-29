function FilePreviewModal({ file, onClose }) {
  if (!file) return null;
  const isImage = file.type === 'image' || (file.mimeType && file.mimeType.startsWith('image/'));
  const isPdf   = file.type === 'pdf';
  const isVideo = file.type === 'video';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-outline-variant">
          <div className="flex items-center gap-2 min-w-0">
            <span className="material-symbols-outlined text-red-600 text-lg shrink-0">
              {isImage ? 'image' : isPdf ? 'picture_as_pdf' : isVideo ? 'videocam' : 'description'}
            </span>
            <p className="text-sm font-bold text-on-surface truncate">{file.name}</p>
          </div>
          <button onClick={onClose} className="shrink-0 w-8 h-8 rounded-lg hover:bg-surface-container flex items-center justify-center transition-colors ml-3">
            <span className="material-symbols-outlined text-on-surface-variant">close</span>
          </button>
        </div>
        <div className="p-6 flex items-center justify-center min-h-64 bg-surface-container-low/40">
          {isImage && file.url ? (
            <img src={file.url} alt={file.name} className="max-w-full max-h-96 rounded-xl object-contain shadow-sm" />
          ) : isImage ? (
            <div className="flex flex-col items-center gap-4 text-on-surface-variant">
              <div className="w-24 h-24 rounded-2xl bg-sky-100 flex items-center justify-center">
                <span className="material-symbols-outlined text-sky-400 text-5xl">image</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-on-surface">{file.name}</p>
                <p className="text-xs text-on-surface-variant mt-1">이미지 미리보기 (실제 파일 첨부 시 표시됩니다)</p>
              </div>
            </div>
          ) : isPdf ? (
            <div className="flex flex-col items-center gap-4 text-on-surface-variant">
              <div className="w-24 h-24 rounded-2xl bg-red-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-red-400 text-5xl">picture_as_pdf</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-on-surface">{file.name}</p>
                <p className="text-xs text-on-surface-variant mt-1">PDF 뷰어 (실제 파일 첨부 시 표시됩니다)</p>
              </div>
            </div>
          ) : isVideo ? (
            <div className="flex flex-col items-center gap-4 text-on-surface-variant">
              <div className="w-24 h-24 rounded-2xl bg-purple-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-purple-400 text-5xl">videocam</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-on-surface">{file.name}</p>
                <p className="text-xs text-on-surface-variant mt-1">동영상 플레이어 (실제 파일 첨부 시 표시됩니다)</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4 text-on-surface-variant">
              <div className="w-24 h-24 rounded-2xl bg-blue-50 flex items-center justify-center">
                <span className="material-symbols-outlined text-blue-400 text-5xl">description</span>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-on-surface">{file.name}</p>
                <p className="text-xs text-on-surface-variant mt-1">문서 미리보기 (실제 파일 첨부 시 표시됩니다)</p>
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-3 border-t border-outline-variant flex justify-end">
          <button onClick={onClose} className="px-5 py-2 text-sm font-bold text-on-surface-variant hover:text-on-surface transition-colors">
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default FilePreviewModal;
