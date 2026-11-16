import triggerSprayerImg from '../assets/images/product_trigger_sprayer_1794793718415.jpg';
import lotionPumpImg from '../assets/images/product_lotion_pump_1794793718723.jpg';
import fineMistImg from '../assets/images/product_fine_mist_1794793719092.jpg';
import foamPumpImg from '../assets/images/product_foam_pump_1794793719554.jpg';
import { Timestamp } from 'firebase/firestore';

export type ProductCategory =
  | 'trigger_sprayer'
  | 'lotion_pump'
  | 'fine_mist_sprayer'
  | 'foam_pump'
  | 'cap_closure';

export type ImageKey =
  | 'trigger_sprayer'
  | 'lotion_pump'
  | 'fine_mist_sprayer'
  | 'foam_pump';

export type OrderStatus =
  | 'quoted'
  | 'confirmed'
  | 'in_production'
  | 'shipped'
  | 'completed'
  | 'cancelled';

export type PaymentStatus = 'unpaid' | 'deposit_paid' | 'paid';

export type CurrencyCode = 'USD' | 'CNY' | 'EUR';

export function formatExchangeRate(rate: number | null | undefined, decimals = 4): string {
  if (typeof rate !== 'number' || !Number.isFinite(rate) || rate <= 0) {
    return '—';
  }
  return rate.toFixed(decimals);
}

export const CATEGORY_META: Record<
  ProductCategory,
  { label: string; shortLabel: string; imageKey: ImageKey }
> = {
  trigger_sprayer: {
    label: 'Trigger Sprayers',
    shortLabel: 'Trigger Sprayer',
    imageKey: 'trigger_sprayer',
  },
  lotion_pump: {
    label: 'Lotion Pumps',
    shortLabel: 'Lotion Pump',
    imageKey: 'lotion_pump',
  },
  fine_mist_sprayer: {
    label: 'Fine Mist Sprayers',
    shortLabel: 'Fine Mist',
    imageKey: 'fine_mist_sprayer',
  },
  foam_pump: {
    label: 'Foam & Treatment Pumps',
    shortLabel: 'Foam Pump',
    imageKey: 'foam_pump',
  },
  cap_closure: {
    label: 'Caps & Closures',
    shortLabel: 'Cap / Closure',
    imageKey: 'fine_mist_sprayer',
  },
};

export const CATEGORY_IMAGES: Record<ImageKey, string> = {
  trigger_sprayer: triggerSprayerImg,
  lotion_pump: lotionPumpImg,
  fine_mist_sprayer: fineMistImg,
  foam_pump: foamPumpImg,
};

export const ORDER_STATUS_META: Record<
  OrderStatus,
  { label: string; colorClass: string; dotClass: string }
> = {
  quoted: {
    label: 'Quoted',
    colorClass: 'text-slate-700 bg-slate-100 border-slate-200',
    dotClass: 'bg-slate-500',
  },
  confirmed: {
    label: 'Confirmed',
    colorClass: 'text-sky-800 bg-sky-50 border-sky-200',
    dotClass: 'bg-sky-600',
  },
  in_production: {
    label: 'In Production',
    colorClass: 'text-amber-800 bg-amber-50 border-amber-200',
    dotClass: 'bg-amber-600',
  },
  shipped: {
    label: 'Shipped',
    colorClass: 'text-teal-800 bg-teal-50 border-teal-200',
    dotClass: 'bg-teal-600',
  },
  completed: {
    label: 'Completed',
    colorClass: 'text-emerald-800 bg-emerald-50 border-emerald-200',
    dotClass: 'bg-emerald-600',
  },
  cancelled: {
    label: 'Cancelled',
    colorClass: 'text-rose-800 bg-rose-50 border-rose-200',
    dotClass: 'bg-rose-600',
  },
};

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; textClass: string }
> = {
  unpaid: { label: 'Unpaid', textClass: 'text-rose-700' },
  deposit_paid: { label: 'Deposit Paid', textClass: 'text-amber-700' },
  paid: { label: 'Paid in Full', textClass: 'text-emerald-700' },
};

export interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  companyName: string;
  defaultCurrency: CurrencyCode;
  usdToRmbRate?: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export type PriceCurrencyMode = 'CNY' | 'RMB_USD';

export interface Product {
  id: string;
  ownerId: string;
  sku: string;
  name: string;
  category: ProductCategory;
  neckSize: string;
  dosage: string;
  colorFinish: string;
  factoryPrice: number;
  sellingPrice: number;
  priceCurrency?: PriceCurrencyMode;
  moq: number;
  cartonQty: number;
  imageKey: ImageKey;
  imageUrl?: string;
  boxLengthCm?: number;
  boxWidthCm?: number;
  boxHeightCm?: number;
  grossWeightKg?: number;
  netWeightKg?: number;
  factoryId?: string;
  factoryName?: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ProductInput {
  sku: string;
  name: string;
  category: ProductCategory;
  neckSize: string;
  dosage: string;
  colorFinish: string;
  factoryPrice: number;
  sellingPrice: number;
  moq: number;
  cartonQty: number;
  imageKey: ImageKey;
  imageUrl?: string;
  boxLengthCm?: number;
  boxWidthCm?: number;
  boxHeightCm?: number;
  grossWeightKg?: number;
  netWeightKg?: number;
  factoryId?: string;
  factoryName?: string;
  notes: string;
}

export interface Factory {
  id: string;
  ownerId: string;
  factoryName: string;
  contactPerson: string;
  contactPhone: string;
  location: string;
  specialty: string;
  leadTimeDays: number;
  paymentTerms: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface FactoryInput {
  factoryName: string;
  contactPerson: string;
  contactPhone: string;
  location: string;
  specialty: string;
  leadTimeDays: number;
  paymentTerms: string;
  notes: string;
}

export interface Client {
  id: string;
  ownerId: string;
  companyName: string;
  contactName: string;
  whatsappNumber: string;
  country: string;
  email: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface ClientInput {
  companyName: string;
  contactName: string;
  whatsappNumber: string;
  country: string;
  email: string;
  notes: string;
}

export interface Order {
  id: string;
  ownerId: string;
  orderNumber: string;
  clientId: string;
  clientName: string;
  clientWhatsapp: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  primaryCategory: ProductCategory;
  itemsSummary: string;
  itemCount: number;
  totalUnits: number;
  totalFactoryCost: number;
  totalAmount: number;
  exchangeRate?: number;
  priceCurrency?: PriceCurrencyMode;
  orderDate: string;
  shippingNotes: string;
  notes: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface OrderItem {
  id: string;
  ownerId: string;
  orderId: string;
  productId: string;
  productSku: string;
  productName: string;
  category: ProductCategory;
  neckSize: string;
  colorFinish?: string;
  dipTube?: string;
  quantity: number;
  unitFactoryPrice: number;
  unitSellingPrice: number;
  lineCost: number;
  lineTotal: number;
  priceCurrency?: PriceCurrencyMode;
  createdAt?: Timestamp;
}

export interface OrderDraftItem {
  productId: string;
  productSku: string;
  productName: string;
  category: ProductCategory;
  neckSize: string;
  colorFinish?: string;
  dipTube?: string;
  quantity: number;
  unitFactoryPrice: number;
  unitSellingPrice: number;
}

export interface CreateOrderInput {
  orderNumber: string;
  clientId: string;
  clientName: string;
  clientWhatsapp: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  orderDate: string;
  exchangeRate?: number | null;
  shippingNotes: string;
  notes: string;
  items: OrderDraftItem[];
}

export function getOrderRate(
  order: Pick<Order, 'exchangeRate'>,
  fallbackRate: number | null
): number | null {
  if (
    typeof order.exchangeRate === 'number' &&
    Number.isFinite(order.exchangeRate) &&
    order.exchangeRate > 0
  ) {
    return order.exchangeRate;
  }
  return fallbackRate;
}

export function convertRmbToUsd(
  valueRmb: number,
  usdToRmbRate: number | null
): number | null {
  if (usdToRmbRate === null || !Number.isFinite(usdToRmbRate) || usdToRmbRate <= 0) {
    return null;
  }
  const safeVal = Number.isFinite(valueRmb) ? valueRmb : 0;
  return safeVal / usdToRmbRate;
}

export function convertUsdToRmb(
  valueUsd: number | null | undefined,
  usdToRmbRate: number | null
): number | null {
  if (
    valueUsd === null ||
    valueUsd === undefined ||
    !Number.isFinite(valueUsd) ||
    usdToRmbRate === null ||
    !Number.isFinite(usdToRmbRate) ||
    usdToRmbRate <= 0
  ) {
    return null;
  }
  return valueUsd * usdToRmbRate;
}

export function formatMoneyValue(
  value: number | null | undefined,
  currency: CurrencyCode = 'USD',
  decimals = 2
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return currency === 'CNY' ? '¥—' : currency === 'EUR' ? '€—' : '$—';
  }
  if (currency === 'USD') {
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
  if (currency === 'EUR') {
    return `€${value.toLocaleString('en-US', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })}`;
  }
  return `¥${value.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`;
}

export function formatUnitPriceValue(
  value: number | null | undefined,
  currency: CurrencyCode = 'USD'
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return currency === 'CNY' ? '¥—' : currency === 'EUR' ? '€—' : '$—';
  }
  if (currency === 'USD') {
    return `$${value.toLocaleString('en-US', {
      minimumFractionDigits: 4,
      maximumFractionDigits: 4,
    })}`;
  }
  if (currency === 'EUR') {
    return `€${value.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    })}`;
  }
  return `¥${value.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  })}`;
}

export function formatMoney(
  valueRmb: number,
  currency: CurrencyCode = 'CNY',
  decimals = 2,
  usdToRmbRate: number | null = null
): string {
  const safeVal = Number.isFinite(valueRmb) ? valueRmb : 0;
  if (currency === 'USD') {
    return formatMoneyValue(convertRmbToUsd(safeVal, usdToRmbRate), 'USD', decimals);
  }
  return formatMoneyValue(safeVal, currency, decimals);
}

export function formatUnitPrice(
  valueRmb: number,
  currency: CurrencyCode = 'CNY',
  usdToRmbRate: number | null = null
): string {
  const safeVal = Number.isFinite(valueRmb) ? valueRmb : 0;
  if (currency === 'USD') {
    return formatUnitPriceValue(convertRmbToUsd(safeVal, usdToRmbRate), 'USD');
  }
  return formatUnitPriceValue(safeVal, currency);
}

export function formatDualMoney(
  valueRmb: number,
  usdToRmbRate: number | null = null,
  decimals = 2
): string {
  return `${formatMoney(valueRmb, 'CNY', decimals, usdToRmbRate)} / ${formatMoney(
    valueRmb,
    'USD',
    decimals,
    usdToRmbRate
  )}`;
}

export function formatDualUnitPrice(
  valueRmb: number,
  usdToRmbRate: number | null = null
): string {
  return `${formatUnitPrice(valueRmb, 'CNY', usdToRmbRate)} / ${formatUnitPrice(
    valueRmb,
    'USD',
    usdToRmbRate
  )}`;
}

export function formatDualMoneyFromUsd(
  valueUsd: number | null | undefined,
  usdToRmbRate: number | null = null,
  decimals = 2
): string {
  const rmb = convertUsdToRmb(valueUsd, usdToRmbRate);
  return `${formatMoneyValue(valueUsd, 'USD', decimals)} / ${formatMoneyValue(
    rmb,
    'CNY',
    decimals
  )} RMB`;
}

export function formatDualUnitPriceFromUsd(
  valueUsd: number | null | undefined,
  usdToRmbRate: number | null = null
): string {
  const rmb = convertUsdToRmb(valueUsd, usdToRmbRate);
  return `${formatUnitPriceValue(valueUsd, 'USD')} / ${formatUnitPriceValue(rmb, 'CNY')} RMB`;
}

export function getProductPricing(
  product: Pick<Product, 'factoryPrice' | 'sellingPrice' | 'priceCurrency'>,
  usdToRmbRate: number | null
) {
  const factoryRmb =
    product.priceCurrency === 'CNY' || product.priceCurrency === 'RMB_USD'
      ? Number(product.factoryPrice) || 0
      : Number(((Number(product.factoryPrice) || 0) * 7.2).toFixed(4));
  const factoryUsd = convertRmbToUsd(factoryRmb, usdToRmbRate);

  const sellingUsd =
    product.priceCurrency === 'CNY'
      ? convertRmbToUsd(Number(product.sellingPrice) || 0, usdToRmbRate)
      : Number(product.sellingPrice) || 0;
  const sellingRmb =
    product.priceCurrency === 'CNY'
      ? Number(product.sellingPrice) || 0
      : convertUsdToRmb(sellingUsd, usdToRmbRate);

  const profitUsd =
    sellingUsd !== null && factoryUsd !== null ? sellingUsd - factoryUsd : null;
  const profitRmb = sellingRmb !== null ? sellingRmb - factoryRmb : null;
  const marginPct =
    sellingUsd !== null && sellingUsd > 0 && profitUsd !== null
      ? (profitUsd / sellingUsd) * 100
      : 0;

  return {
    factoryRmb,
    factoryUsd,
    sellingUsd,
    sellingRmb,
    profitUsd,
    profitRmb,
    marginPct,
  };
}

export function getOrderFinancials(
  order: Pick<Order, 'totalFactoryCost' | 'totalAmount' | 'priceCurrency' | 'exchangeRate'>,
  fallbackRate: number | null
) {
  const rate = getOrderRate(order, fallbackRate);
  const costRmb =
    order.priceCurrency === 'CNY' || order.priceCurrency === 'RMB_USD'
      ? Number(order.totalFactoryCost) || 0
      : Number(((Number(order.totalFactoryCost) || 0) * 7.2).toFixed(2));
  const costUsd = convertRmbToUsd(costRmb, rate);

  const revenueUsd =
    order.priceCurrency === 'CNY'
      ? convertRmbToUsd(Number(order.totalAmount) || 0, rate)
      : Number(order.totalAmount) || 0;
  const revenueRmb =
    order.priceCurrency === 'CNY'
      ? Number(order.totalAmount) || 0
      : convertUsdToRmb(revenueUsd, rate);

  const profitUsd =
    revenueUsd !== null && costUsd !== null ? revenueUsd - costUsd : null;
  const profitRmb = revenueRmb !== null ? revenueRmb - costRmb : null;
  const marginPct =
    revenueUsd !== null && revenueUsd > 0 && profitUsd !== null
      ? (profitUsd / revenueUsd) * 100
      : 0;

  return {
    rate,
    costRmb,
    costUsd,
    revenueUsd,
    revenueRmb,
    profitUsd,
    profitRmb,
    marginPct,
  };
}

export function getOrderItemFinancials(
  item: Pick<
    OrderItem,
    'unitFactoryPrice' | 'unitSellingPrice' | 'lineCost' | 'lineTotal' | 'priceCurrency'
  >,
  rate: number | null
) {
  const unitFactoryRmb =
    item.priceCurrency === 'CNY' || item.priceCurrency === 'RMB_USD'
      ? Number(item.unitFactoryPrice) || 0
      : Number(((Number(item.unitFactoryPrice) || 0) * 7.2).toFixed(4));
  const unitFactoryUsd = convertRmbToUsd(unitFactoryRmb, rate);

  const unitSellingUsd =
    item.priceCurrency === 'CNY'
      ? convertRmbToUsd(Number(item.unitSellingPrice) || 0, rate)
      : Number(item.unitSellingPrice) || 0;
  const unitSellingRmb =
    item.priceCurrency === 'CNY'
      ? Number(item.unitSellingPrice) || 0
      : convertUsdToRmb(unitSellingUsd, rate);

  const lineTotalUsd =
    item.priceCurrency === 'CNY'
      ? convertRmbToUsd(Number(item.lineTotal) || 0, rate)
      : Number(item.lineTotal) || 0;
  const lineTotalRmb =
    item.priceCurrency === 'CNY'
      ? Number(item.lineTotal) || 0
      : convertUsdToRmb(lineTotalUsd, rate);

  return {
    unitFactoryRmb,
    unitFactoryUsd,
    unitSellingUsd,
    unitSellingRmb,
    lineTotalUsd,
    lineTotalRmb,
  };
}

export function formatCount(value: number): string {
  return (Number.isFinite(value) ? value : 0).toLocaleString('en-US');
}

export function calcMarginPct(factoryPrice: number, sellingPrice: number): number {
  if (!Number.isFinite(sellingPrice) || sellingPrice <= 0) return 0;
  return ((sellingPrice - factoryPrice) / sellingPrice) * 100;
}

export function getWhatsappUrl(phone: string, prefillText?: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  if (!digits) return '';
  const base = `https://wa.me/${digits}`;
  if (prefillText && prefillText.trim()) {
    return `${base}?text=${encodeURIComponent(prefillText.trim())}`;
  }
  return base;
}

export function createCleanId(prefix: string): string {
  const random =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID().replace(/-/g, '').slice(0, 12)
      : Math.random().toString(36).slice(2, 14);
  return `${prefix}_${Date.now()}_${random}`;
}

export function truncate(str: string, max: number): string {
  const trimmed = str.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max);
}
