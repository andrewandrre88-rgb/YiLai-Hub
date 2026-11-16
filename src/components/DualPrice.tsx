import {
  CurrencyCode,
  convertRmbToUsd,
  convertUsdToRmb,
  formatMoneyValue,
  formatUnitPriceValue,
} from '../types/hub';

interface DualPriceProps {
  rmbAmount?: number | null;
  usdAmount?: number | null;
  usdAmountOverride?: number | null;
  rate?: number | null;
  primaryCurrency?: CurrencyCode;
  unit?: boolean;
  layout?: 'stack' | 'inline';
  align?: 'left' | 'right';
  primaryClassName?: string;
  secondaryClassName?: string;
}

export function DualPrice({
  rmbAmount,
  usdAmount,
  usdAmountOverride,
  rate = null,
  primaryCurrency = 'USD',
  unit = false,
  layout = 'stack',
  align = 'left',
  primaryClassName = 'font-semibold text-slate-900',
  secondaryClassName = 'text-[11px] text-slate-500',
}: DualPriceProps) {
  const explicitUsd = usdAmountOverride !== undefined ? usdAmountOverride : usdAmount;

  const resolvedRmb =
    rmbAmount !== undefined
      ? rmbAmount
      : explicitUsd !== undefined
        ? convertUsdToRmb(explicitUsd, rate)
        : null;

  const resolvedUsd =
    explicitUsd !== undefined
      ? explicitUsd
      : rmbAmount !== undefined && rmbAmount !== null
        ? convertRmbToUsd(rmbAmount, rate)
        : null;

  const rmbFormatted = unit
    ? formatUnitPriceValue(resolvedRmb, 'CNY')
    : formatMoneyValue(resolvedRmb, 'CNY', 2);

  const usdFormatted = unit
    ? formatUnitPriceValue(resolvedUsd, 'USD')
    : formatMoneyValue(resolvedUsd, 'USD', 2);

  const rmbFirst = primaryCurrency === 'CNY';
  const topText = rmbFirst ? rmbFormatted : usdFormatted;
  const bottomText = rmbFirst ? usdFormatted : `${rmbFormatted} RMB`;

  if (layout === 'inline') {
    return (
      <span className="font-mono tabular-nums inline-flex items-baseline gap-1.5 flex-wrap">
        <span className={primaryClassName}>{topText}</span>
        <span className={secondaryClassName}>/ {bottomText}</span>
      </span>
    );
  }

  return (
    <div
      className={`font-mono tabular-nums leading-tight ${
        align === 'right' ? 'text-right' : 'text-left'
      }`}
    >
      <div className={primaryClassName}>{topText}</div>
      <div className={secondaryClassName}>{bottomText}</div>
    </div>
  );
}
