import { FormEvent, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { CurrencyCode, UserProfile, formatExchangeRate } from '../types/hub';
import { ExchangeRateState, formatRateTimestamp } from '../lib/exchangeRate';

interface WorkspaceSettingsModalProps {
  profile: UserProfile;
  fx: ExchangeRateState;
  onClose: () => void;
  onSave: (updates: {
    displayName: string;
    companyName: string;
    defaultCurrency: CurrencyCode;
    usdToRmbRate?: number | null;
  }) => Promise<void>;
}

export function WorkspaceSettingsModal({
  profile,
  fx,
  onClose,
  onSave,
}: WorkspaceSettingsModalProps) {
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [companyName, setCompanyName] = useState(profile.companyName);
  const [defaultCurrency, setDefaultCurrency] = useState<CurrencyCode>(
    profile.defaultCurrency === 'CNY' ? 'CNY' : 'USD'
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!displayName.trim() || !companyName.trim()) {
      setError('Display name and company name are required.');
      return;
    }
    if (fx.baseRate === null || fx.baseRate < 0.1 || fx.baseRate > 100) {
      setError('Exchange rate must be between 0.1 and 100 RMB per 1 USD.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave({
        displayName: displayName.trim(),
        companyName: companyName.trim(),
        defaultCurrency,
        usdToRmbRate: fx.usedRate,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update settings.');
      setSaving(false);
    }
  };

  const statusText =
    fx.isRefreshing && fx.source === 'loading'
      ? 'Fetching live rate...'
      : fx.source === 'live' && fx.updatedAt
        ? `Live rate, updated ${formatRateTimestamp(fx.updatedAt)}`
        : fx.source === 'manual' && fx.updatedAt
          ? `Manual rate, edited ${formatRateTimestamp(fx.updatedAt)}`
          : fx.source === 'cached' && fx.updatedAt
            ? `Saved rate from ${formatRateTimestamp(fx.updatedAt)}`
            : 'Rate unavailable';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-lg max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden my-auto">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-semibold text-slate-900">Workspace & Currency Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Company / Factory Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              maxLength={120}
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Your Display Name
            </label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              maxLength={100}
              required
              className="w-full px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Primary Currency Display Order
              </label>
              <select
                value={defaultCurrency}
                onChange={(e) => setDefaultCurrency(e.target.value as CurrencyCode)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                <option value="USD">USD ($) primary · RMB (¥) secondary</option>
                <option value="CNY">RMB (¥) primary · USD ($) secondary</option>
              </select>
              <p className="text-[11px] text-slate-500 mt-1">
                Both USD and RMB are displayed across products, orders, and dashboard totals.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label className="block text-xs font-medium text-slate-700">
                  Exchange rate (1 USD = ? RMB)
                </label>
                <button
                  type="button"
                  onClick={() => void fx.refreshRate()}
                  disabled={fx.isRefreshing}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:text-teal-800 disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${fx.isRefreshing ? 'animate-spin' : ''}`} />
                  <span>Refresh rate</span>
                </button>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-mono text-slate-600 shrink-0">1 USD =</span>
                <input
                  type="number"
                  step="0.0001"
                  min="0.1"
                  max="100"
                  value={fx.rateInput}
                  onChange={(e) => fx.setManualRate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
                <span className="text-xs font-mono text-slate-600 shrink-0">RMB (¥)</span>
              </div>

              <p className="text-[11px] text-slate-500">{statusText}</p>

              {fx.warning && (
                <p className="text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                  {fx.warning}
                </p>
              )}
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Safety margin %
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  max="99"
                  value={fx.marginInput}
                  onChange={(e) => fx.setMarginInput(e.target.value)}
                  className="w-28 px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
                <span className="text-xs font-mono text-slate-600">%</span>
              </div>
              <div className="mt-2 pt-2 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-1.5 text-[11px] font-mono tabular-nums">
                <span className="text-slate-600">
                  {fx.isManual ? 'Manual rate' : 'Live rate'}: ¥{formatExchangeRate(fx.baseRate)}
                </span>
                <span className="font-semibold text-teal-800">
                  Rate used: ¥{formatExchangeRate(fx.usedRate)}
                </span>
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Saving...' : 'Save Preferences'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
