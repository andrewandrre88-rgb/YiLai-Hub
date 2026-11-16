import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const PRIMARY_RATE_URL = 'https://open.er-api.com/v6/latest/USD';
const BACKUP_RATE_URL = 'https://api.frankfurter.dev/v1/latest?base=USD&symbols=CNY';

const LIVE_CACHE_STORAGE_KEY = 'yilai_usd_cny_live_cache_v1';
const MARGIN_STORAGE_KEY = 'yilai_usd_cny_safety_margin_v1';

export type RateProvider = 'open.er-api' | 'frankfurter';
export type RateSource = 'loading' | 'live' | 'cached' | 'manual' | 'unavailable';

export interface CachedRateRecord {
  rate: number;
  updatedAt: string;
  provider: RateProvider;
}

export interface ExchangeRateState {
  rateInput: string;
  baseRate: number | null;
  marginInput: string;
  marginPct: number;
  usedRate: number | null;
  source: RateSource;
  updatedAt: string | null;
  provider: RateProvider | null;
  warning: string | null;
  isRefreshing: boolean;
  isManual: boolean;
  setManualRate: (nextValue: string) => void;
  setMarginInput: (nextValue: string) => void;
  refreshRate: () => Promise<void>;
}

export function formatRateTimestamp(isoOrDate: string | number | Date): string {
  const date = isoOrDate instanceof Date ? isoOrDate : new Date(isoOrDate);
  if (Number.isNaN(date.getTime())) return '';
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
}

function readCachedRate(): CachedRateRecord | null {
  try {
    const raw = window.localStorage.getItem(LIVE_CACHE_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CachedRateRecord>;
    if (
      typeof parsed.rate === 'number' &&
      Number.isFinite(parsed.rate) &&
      parsed.rate > 0 &&
      typeof parsed.updatedAt === 'string' &&
      parsed.updatedAt
    ) {
      return {
        rate: parsed.rate,
        updatedAt: parsed.updatedAt,
        provider: parsed.provider === 'frankfurter' ? 'frankfurter' : 'open.er-api',
      };
    }
    return null;
  } catch {
    return null;
  }
}

function writeCachedRate(record: CachedRateRecord): void {
  try {
    window.localStorage.setItem(LIVE_CACHE_STORAGE_KEY, JSON.stringify(record));
  } catch {
    // Ignore storage quota/privacy mode errors
  }
}

function readSavedMarginInput(): string {
  try {
    const raw = window.localStorage.getItem(MARGIN_STORAGE_KEY);
    if (raw === null || raw.trim() === '') return '0';
    const num = Number(raw);
    if (!Number.isFinite(num) || num < 0 || num >= 100) return '0';
    return raw;
  } catch {
    return '0';
  }
}

function writeSavedMarginInput(val: string): void {
  try {
    window.localStorage.setItem(MARGIN_STORAGE_KEY, val);
  } catch {
    // Ignore storage errors
  }
}

async function fetchJsonWithTimeout(url: string, timeoutMs = 8000): Promise<unknown> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, cache: 'no-store' });
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }
    return await res.json();
  } finally {
    window.clearTimeout(timer);
  }
}

function extractCnyRate(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const rates = (payload as { rates?: Record<string, unknown> }).rates;
  if (!rates || typeof rates !== 'object') return null;
  const cny = rates.CNY;
  if (typeof cny === 'number' && Number.isFinite(cny) && cny > 0) {
    return cny;
  }
  return null;
}

export async function fetchLiveUsdToCnyRate(): Promise<CachedRateRecord> {
  try {
    const primaryData = await fetchJsonWithTimeout(PRIMARY_RATE_URL);
    const primaryRate = extractCnyRate(primaryData);
    if (primaryRate !== null) {
      return {
        rate: primaryRate,
        updatedAt: new Date().toISOString(),
        provider: 'open.er-api',
      };
    }
  } catch {
    // Fall through to backup endpoint
  }

  const backupData = await fetchJsonWithTimeout(BACKUP_RATE_URL);
  const backupRate = extractCnyRate(backupData);
  if (backupRate !== null) {
    return {
      rate: backupRate,
      updatedAt: new Date().toISOString(),
      provider: 'frankfurter',
    };
  }

  throw new Error('Failed to fetch live USD/CNY exchange rate from primary and backup APIs.');
}

export function useExchangeRate(): ExchangeRateState {
  const initialCache = useMemo(
    () => (typeof window !== 'undefined' ? readCachedRate() : null),
    []
  );
  const initialMargin = useMemo(
    () => (typeof window !== 'undefined' ? readSavedMarginInput() : '0'),
    []
  );

  const [rateInput, setRateInput] = useState<string>(() =>
    initialCache ? initialCache.rate.toFixed(4) : ''
  );
  const [marginInput, setMarginInputState] = useState<string>(initialMargin);
  const [source, setSource] = useState<RateSource>(initialCache ? 'loading' : 'loading');
  const [updatedAt, setUpdatedAt] = useState<string | null>(
    initialCache ? initialCache.updatedAt : null
  );
  const [provider, setProvider] = useState<RateProvider | null>(
    initialCache ? initialCache.provider : null
  );
  const [warning, setWarning] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(true);
  const [isManual, setIsManual] = useState<boolean>(false);

  const isManualRef = useRef<boolean>(false);
  const mountedRef = useRef<boolean>(true);

  const applyFetch = useCallback(async (forceOverwriteManual: boolean) => {
    if (forceOverwriteManual) {
      isManualRef.current = false;
      setIsManual(false);
    }
    setIsRefreshing(true);
    setWarning(null);
    if (!isManualRef.current) {
      setSource('loading');
    }

    try {
      const liveRecord = await fetchLiveUsdToCnyRate();
      writeCachedRate(liveRecord);

      if (!mountedRef.current) return;

      // Never overwrite user's hand-typed value unless they explicitly clicked Refresh rate
      if (forceOverwriteManual || !isManualRef.current) {
        setRateInput(liveRecord.rate.toFixed(4));
        setSource('live');
        setUpdatedAt(liveRecord.updatedAt);
        setProvider(liveRecord.provider);
        setWarning(null);
      }
    } catch {
      if (!mountedRef.current) return;
      const cached = readCachedRate();
      if (!isManualRef.current) {
        if (cached) {
          setRateInput(cached.rate.toFixed(4));
          setSource('cached');
          setUpdatedAt(cached.updatedAt);
          setProvider(cached.provider);
          setWarning(`Could not update rate, using saved rate from ${formatRateTimestamp(cached.updatedAt)}`);
        } else {
          setRateInput('');
          setSource('unavailable');
          setUpdatedAt(null);
          setProvider(null);
          setWarning('Could not update rate and no saved rate was found. Enter a rate manually.');
        }
      } else if (cached) {
        setWarning(`Could not update rate, keeping manual rate (saved rate from ${formatRateTimestamp(cached.updatedAt)}).`);
      }
    } finally {
      if (mountedRef.current) {
        setIsRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void applyFetch(false);
    return () => {
      mountedRef.current = false;
    };
  }, [applyFetch]);

  const setManualRate = useCallback((nextValue: string) => {
    isManualRef.current = true;
    setIsManual(true);
    setRateInput(nextValue);
    setSource('manual');
    setUpdatedAt(new Date().toISOString());
    setWarning(null);
  }, []);

  const setMarginInput = useCallback((nextValue: string) => {
    setMarginInputState(nextValue);
    if (nextValue.trim() === '') {
      writeSavedMarginInput('0');
      return;
    }
    const num = Number(nextValue);
    if (Number.isFinite(num) && num >= 0 && num < 100) {
      writeSavedMarginInput(nextValue);
    }
  }, []);

  const refreshRate = useCallback(async () => {
    await applyFetch(true);
  }, [applyFetch]);

  const baseRate = useMemo(() => {
    const parsed = Number(rateInput);
    if (!Number.isFinite(parsed) || parsed <= 0) return null;
    return parsed;
  }, [rateInput]);

  const marginPct = useMemo(() => {
    const parsed = Number(marginInput);
    if (!Number.isFinite(parsed) || parsed < 0) return 0;
    if (parsed >= 100) return 99.99;
    return parsed;
  }, [marginInput]);

  const usedRate = useMemo(() => {
    if (baseRate === null) return null;
    const computed = baseRate * (1 - marginPct / 100);
    return Number.isFinite(computed) && computed > 0 ? computed : null;
  }, [baseRate, marginPct]);

  return {
    rateInput,
    baseRate,
    marginInput,
    marginPct,
    usedRate,
    source,
    updatedAt,
    provider,
    warning,
    isRefreshing,
    isManual,
    setManualRate,
    setMarginInput,
    refreshRate,
  };
}
