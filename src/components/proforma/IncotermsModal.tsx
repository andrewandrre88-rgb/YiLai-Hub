import { X } from 'lucide-react';
import { INCOTERMS_2020 } from '../../lib/proformaTypes';

interface IncotermsModalProps {
  open: boolean;
  activeCode: string;
  onClose: () => void;
  onSelect: (code: string) => void;
}

export default function IncotermsModal({
  open,
  activeCode,
  onClose,
  onSelect,
}: IncotermsModalProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 font-['Plus_Jakarta_Sans',sans-serif]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl bg-white rounded-xl border border-slate-200 shadow-2xl overflow-hidden max-h-[88vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 bg-slate-50">
          <div>
            <h3 className="text-base font-bold text-slate-900">Incoterms 2020 Quick Reference</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Click any rule to apply it directly to this Proforma Invoice & Packing List.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-2">
          {INCOTERMS_2020.map((term) => {
            const isSelected = term.code === activeCode;
            return (
              <button
                key={term.code}
                type="button"
                onClick={() => {
                  onSelect(term.code);
                  onClose();
                }}
                className={`w-full text-left p-3.5 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 ${
                  isSelected
                    ? 'bg-sky-50 border-sky-300 ring-1 ring-sky-300'
                    : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2.5 sm:w-44 shrink-0">
                  <span
                    className={`px-2 py-0.5 rounded font-['JetBrains_Mono',monospace] text-xs font-semibold ${
                      isSelected ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-800'
                    }`}
                  >
                    {term.code}
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{term.name}</span>
                </div>
                <div className="sm:w-36 shrink-0">
                  <span className="inline-block px-2 py-0.5 rounded bg-slate-100 text-slate-600 text-[11px] font-medium">
                    {term.mode}
                  </span>
                </div>
                <p className="text-xs text-slate-600 leading-relaxed flex-1">{term.sellerObligation}</p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
