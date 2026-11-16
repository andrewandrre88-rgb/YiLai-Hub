import { UserProfile } from '../types/hub';

export type DocumentMode = 'proforma' | 'packing_list';
export type PreviewMode = 'document' | 'excel';
export type TransportMode = 'sea' | 'air' | 'truck' | 'multimodal';
export type ThemeId = 'navy' | 'emerald' | 'slate' | 'burgundy' | 'charcoal';
export type StampStyle = 'red_round' | 'blue_round' | 'custom';

export type TradeCurrencyCode =
  | 'USD'
  | 'EUR'
  | 'GBP'
  | 'AED'
  | 'CNY'
  | 'CAD'
  | 'AUD'
  | 'JPY';

export interface CurrencyMeta {
  code: TradeCurrencyCode;
  symbol: string;
  name: string;
  majorWord: string;
  minorWord: string;
  decimals: number;
}

export const TRADE_CURRENCIES: Record<TradeCurrencyCode, CurrencyMeta> = {
  USD: { code: 'USD', symbol: '$', name: 'US Dollar', majorWord: 'US DOLLARS', minorWord: 'CENTS', decimals: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'Euro', majorWord: 'EUROS', minorWord: 'CENTS', decimals: 2 },
  GBP: { code: 'GBP', symbol: '£', name: 'British Pound', majorWord: 'POUNDS STERLING', minorWord: 'PENCE', decimals: 2 },
  AED: { code: 'AED', symbol: 'AED ', name: 'UAE Dirham', majorWord: 'UAE DIRHAMS', minorWord: 'FILS', decimals: 2 },
  CNY: { code: 'CNY', symbol: '¥', name: 'Chinese Yuan (RMB)', majorWord: 'CHINESE YUAN', minorWord: 'FEN', decimals: 2 },
  CAD: { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar', majorWord: 'CANADIAN DOLLARS', minorWord: 'CENTS', decimals: 2 },
  AUD: { code: 'AUD', symbol: 'A$', name: 'Australian Dollar', majorWord: 'AUSTRALIAN DOLLARS', minorWord: 'CENTS', decimals: 2 },
  JPY: { code: 'JPY', symbol: '¥', name: 'Japanese Yen', majorWord: 'JAPANESE YEN', minorWord: 'SEN', decimals: 0 },
};

export interface DocumentTheme {
  id: ThemeId;
  name: string;
  primaryColor: string;
  primaryLight: string;
  accentColor: string;
  borderLight: string;
  badgeBg: string;
  badgeText: string;
}

export const DOCUMENT_THEMES: Record<ThemeId, DocumentTheme> = {
  navy: {
    id: 'navy',
    name: 'Executive Navy',
    primaryColor: '#1E3A8A',
    primaryLight: '#EFF6FF',
    accentColor: '#2563EB',
    borderLight: '#BFDBFE',
    badgeBg: '#DBEAFE',
    badgeText: '#1E40AF',
  },
  emerald: {
    id: 'emerald',
    name: 'Global Emerald',
    primaryColor: '#065F46',
    primaryLight: '#ECFDF5',
    accentColor: '#059669',
    borderLight: '#A7F3D0',
    badgeBg: '#D1FAE5',
    badgeText: '#065F46',
  },
  slate: {
    id: 'slate',
    name: 'Modern Slate',
    primaryColor: '#1E293B',
    primaryLight: '#F8FAFC',
    accentColor: '#475569',
    borderLight: '#E2E8F0',
    badgeBg: '#F1F5F9',
    badgeText: '#334155',
  },
  burgundy: {
    id: 'burgundy',
    name: 'Executive Burgundy',
    primaryColor: '#881337',
    primaryLight: '#FFF1F2',
    accentColor: '#BE123C',
    borderLight: '#FECDD3',
    badgeBg: '#FFE4E6',
    badgeText: '#9F1239',
  },
  charcoal: {
    id: 'charcoal',
    name: 'Charcoal & Amber',
    primaryColor: '#27272A',
    primaryLight: '#FAFAFA',
    accentColor: '#D97706',
    borderLight: '#E4E4E7',
    badgeBg: '#FEF3C7',
    badgeText: '#92400E',
  },
};

export interface TradeLineItem {
  id: string;
  productId?: string;
  sku: string;
  description: string;
  specifications: string;
  hsCode: string;
  cartons: number;
  unitsPerCarton: number;
  unitLabel: string;
  unitPrice: number;
  netWeightPerCartonKg: number;
  grossWeightPerCartonKg: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  imageUrl?: string;
}

export interface TradeDocumentState {
  id: string;
  themeId: ThemeId;
  documentType: DocumentMode;
  piNumber: string;
  packingListNumber: string;
  poReference: string;
  issueDate: string;
  validUntil: string;
  incoterm: string;
  incotermPlace: string;
  currency: TradeCurrencyCode;
  showDualRmbReference: boolean;
  showProductImages: boolean;

  // Seller
  sellerLogoUrl: string;
  sellerCompany: string;
  sellerWebsite: string;
  sellerTaxId: string;
  sellerContact: string;
  sellerAddress: string;
  sellerEmail: string;
  sellerPhone: string;

  // Buyer
  buyerClientId: string;
  buyerCompany: string;
  buyerContact: string;
  buyerAddress: string;
  buyerCountry: string;
  buyerEmail: string;
  buyerPhone: string;
  buyerTaxId: string;

  // Transport & Packing Details
  transportMode: TransportMode;
  portOfLoading: string;
  portOfDischarge: string;
  countryOfOrigin: string;
  shippingMarks: string;
  packageType: string;
  estimatedLeadTime: string;

  // Line Items
  items: TradeLineItem[];

  // Financials & Bank
  freightFee: number;
  insuranceFee: number;
  taxRatePct: number;
  discount: number;
  showMilestoneSplit: boolean;
  depositPct: number;
  depositLabel: string;
  balanceLabel: string;
  pricingFootnote: string;

  bankBeneficiary: string;
  bankName: string;
  bankSwift: string;
  bankAccountNumber: string;
  bankAddress: string;
  intermediaryBank: string;
  intermediarySwift: string;
  bankNote: string;

  // Terms & Signatures
  termsList: string[];
  authorizedSignatory: string;
  buyerSignatory: string;

  // Stamp Overlay
  stampEnabled: boolean;
  stampStyle: StampStyle;
  stampText: string;
  stampSubText: string;
  stampCustomUrl: string;
  stampXPercent: number;
  stampYPercent: number;
  stampScale: number;

  savedAt?: string;
}

export interface CalculatedDocumentTotals {
  totalCartons: number;
  totalUnits: number;
  subtotal: number;
  freight: number;
  insurance: number;
  taxAmount: number;
  discount: number;
  grandTotal: number;
  depositAmount: number;
  balanceAmount: number;
  totalNetWeightKg: number;
  totalGrossWeightKg: number;
  totalCbm: number;
  rmbEquivalent: number | null;
}

export const MILESTONE_SPLITS: Array<{ deposit: number; balance: number }> = [
  { deposit: 30, balance: 70 },
  { deposit: 50, balance: 50 },
  { deposit: 20, balance: 80 },
  { deposit: 40, balance: 60 },
];

export const INCOTERMS_2020: Array<{
  code: string;
  name: string;
  mode: string;
  sellerObligation: string;
}> = [
  {
    code: 'EXW',
    name: 'Ex Works',
    mode: 'Any mode',
    sellerObligation: 'Seller makes goods available at factory/warehouse; buyer handles export & freight.',
  },
  {
    code: 'FCA',
    name: 'Free Carrier',
    mode: 'Any mode',
    sellerObligation: 'Seller clears export & delivers to carrier nominated by buyer at named place.',
  },
  {
    code: 'FOB',
    name: 'Free On Board',
    mode: 'Sea / Inland Waterway',
    sellerObligation: 'Seller clears export & loads goods on board vessel at Port of Loading.',
  },
  {
    code: 'CFR',
    name: 'Cost and Freight',
    mode: 'Sea / Inland Waterway',
    sellerObligation: 'Seller pays sea freight to destination port; risk transfers on loading.',
  },
  {
    code: 'CIF',
    name: 'Cost, Insurance & Freight',
    mode: 'Sea / Inland Waterway',
    sellerObligation: 'Seller pays sea freight + minimum cargo insurance to Port of Discharge.',
  },
  {
    code: 'CPT',
    name: 'Carriage Paid To',
    mode: 'Any mode',
    sellerObligation: 'Seller pays carriage to named destination; risk passes at first carrier.',
  },
  {
    code: 'CIP',
    name: 'Carriage & Insurance Paid To',
    mode: 'Any mode',
    sellerObligation: 'Seller pays carriage + all-risk cargo insurance to named destination.',
  },
  {
    code: 'DAP',
    name: 'Delivered at Place',
    mode: 'Any mode',
    sellerObligation: 'Seller delivers ready for unloading at named place; buyer clears import duty.',
  },
  {
    code: 'DDP',
    name: 'Delivered Duty Paid',
    mode: 'Any mode',
    sellerObligation: 'Maximum seller responsibility including import customs clearance & duties.',
  },
];

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function generateDocNumber(prefix = 'PI'): string {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const suffix = String(Math.floor(100 + Math.random() * 900));
  return `${prefix}-${ym}-${suffix}`;
}

export function formatTradeCurrency(
  amount: number,
  currency: TradeCurrencyCode,
  decimals?: number
): string {
  const meta = TRADE_CURRENCIES[currency] || TRADE_CURRENCIES.USD;
  const d = typeof decimals === 'number' ? decimals : meta.decimals;
  const safe = Number.isFinite(amount) ? amount : 0;
  return `${meta.symbol}${safe.toLocaleString('en-US', {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  })}`;
}

export function formatTradeUnitPrice(amount: number, currency: TradeCurrencyCode): string {
  const meta = TRADE_CURRENCIES[currency] || TRADE_CURRENCIES.USD;
  const safe = Number.isFinite(amount) ? amount : 0;
  const decimals = currency === 'JPY' ? 2 : 4;
  return `${meta.symbol}${safe.toLocaleString('en-US', {
    minimumFractionDigits: Math.min(2, decimals),
    maximumFractionDigits: decimals,
  })}`;
}

export function calculateDocumentTotals(
  doc: TradeDocumentState,
  usdToRmbRate: number | null
): CalculatedDocumentTotals {
  let totalCartons = 0;
  let totalUnits = 0;
  let subtotal = 0;
  let totalNetWeightKg = 0;
  let totalGrossWeightKg = 0;
  let totalCbm = 0;

  for (const item of doc.items) {
    const cartons = Math.max(0, Number(item.cartons) || 0);
    const unitsPerCtn = Math.max(0, Number(item.unitsPerCarton) || 0);
    const qty = cartons * unitsPerCtn;
    const unitPrice = Math.max(0, Number(item.unitPrice) || 0);
    const lineCbmPerCtn =
      item.lengthCm > 0 && item.widthCm > 0 && item.heightCm > 0
        ? (item.lengthCm * item.widthCm * item.heightCm) / 1_000_000
        : 0;

    totalCartons += cartons;
    totalUnits += qty;
    subtotal += qty * unitPrice;
    totalNetWeightKg += cartons * Math.max(0, Number(item.netWeightPerCartonKg) || 0);
    totalGrossWeightKg += cartons * Math.max(0, Number(item.grossWeightPerCartonKg) || 0);
    totalCbm += cartons * lineCbmPerCtn;
  }

  const freight = Math.max(0, Number(doc.freightFee) || 0);
  const insurance = Math.max(0, Number(doc.insuranceFee) || 0);
  const taxRate = Math.max(0, Number(doc.taxRatePct) || 0);
  const discount = Math.max(0, Number(doc.discount) || 0);
  const taxableBase = Math.max(0, subtotal + freight + insurance - discount);
  const taxAmount = Number(((taxableBase * taxRate) / 100).toFixed(2));
  const grandTotal = Math.max(0, Number((taxableBase + taxAmount).toFixed(2)));

  const depPct = Math.max(0, Math.min(100, Number(doc.depositPct) || 0));
  const depositAmount = Number(((grandTotal * depPct) / 100).toFixed(2));
  const balanceAmount = Number((grandTotal - depositAmount).toFixed(2));

  const rmbEquivalent =
    doc.currency === 'USD' && usdToRmbRate && usdToRmbRate > 0
      ? Number((grandTotal * usdToRmbRate).toFixed(2))
      : doc.currency === 'CNY'
        ? grandTotal
        : null;

  return {
    totalCartons,
    totalUnits,
    subtotal,
    freight,
    insurance,
    taxAmount,
    discount,
    grandTotal,
    depositAmount,
    balanceAmount,
    totalNetWeightKg,
    totalGrossWeightKg,
    totalCbm,
    rmbEquivalent,
  };
}

function numberToWordsInt(n: number): string {
  const ones = [
    '',
    'ONE',
    'TWO',
    'THREE',
    'FOUR',
    'FIVE',
    'SIX',
    'SEVEN',
    'EIGHT',
    'NINE',
    'TEN',
    'ELEVEN',
    'TWELVE',
    'THIRTEEN',
    'FOURTEEN',
    'FIFTEEN',
    'SIXTEEN',
    'SEVENTEEN',
    'EIGHTEEN',
    'NINETEEN',
  ];
  const tens = [
    '',
    '',
    'TWENTY',
    'THIRTY',
    'FORTY',
    'FIFTY',
    'SIXTY',
    'SEVENTY',
    'EIGHTY',
    'NINETY',
  ];
  const scales = ['', 'THOUSAND', 'MILLION', 'BILLION'];
  if (n === 0) return 'ZERO';
  let num = Math.floor(n);
  const parts: string[] = [];
  let scaleIdx = 0;

  while (num > 0) {
    const chunk = num % 1000;
    if (chunk > 0) {
      const words: string[] = [];
      const hundreds = Math.floor(chunk / 100);
      const rem = chunk % 100;
      if (hundreds > 0) words.push(`${ones[hundreds]} HUNDRED`);
      if (rem >= 20) {
        const t = Math.floor(rem / 10);
        const o = rem % 10;
        words.push(o > 0 ? `${tens[t]}-${ones[o]}` : tens[t]);
      } else if (rem > 0) {
        words.push(ones[rem]);
      }
      if (scales[scaleIdx]) words.push(scales[scaleIdx]);
      parts.unshift(words.join(' '));
    }
    num = Math.floor(num / 1000);
    scaleIdx += 1;
  }
  return parts.join(' ');
}

export function amountToWords(amount: number, currency: TradeCurrencyCode): string {
  const meta = TRADE_CURRENCIES[currency] || TRADE_CURRENCIES.USD;
  const safe = Math.max(0, Number.isFinite(amount) ? amount : 0);
  const whole = Math.floor(safe);
  const cents = Math.round((safe - whole) * 100);
  const adjWhole = cents === 100 ? whole + 1 : whole;
  const adjCents = cents === 100 ? 0 : cents;

  if (meta.decimals === 0 || adjCents === 0) {
    return `Say: ${meta.majorWord} ${numberToWordsInt(adjWhole)} ONLY`;
  }
  return `Say: ${meta.majorWord} ${numberToWordsInt(adjWhole)} AND ${numberToWordsInt(adjCents)} ${meta.minorWord} ONLY`;
}

export function renderPresetStampDataUrl(
  style: StampStyle,
  companyText: string,
  subText: string
): string {
  if (typeof document === 'undefined') return '';
  const size = 420;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  const color = style === 'blue_round' ? '#1E3A8A' : '#B91C1C';
  const cx = size / 2;
  const cy = size / 2;
  const radius = 178;

  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;

  // Outer double ring
  ctx.lineWidth = 8;
  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(cx, cy, radius - 14, 0, Math.PI * 2);
  ctx.stroke();

  // Center 5-point star
  const drawStar = (x: number, y: number, rOuter: number, rInner: number) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const angle = (Math.PI / 5) * i - Math.PI / 2;
      const r = i % 2 === 0 ? rOuter : rInner;
      const px = x + Math.cos(angle) * r;
      const py = y + Math.sin(angle) * r;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  };
  drawStar(cx, cy - 4, 38, 15);

  // Curved top company text
  const label = (companyText || 'YI LAI DISPENSING PACKAGING CO., LTD.').toUpperCase().slice(0, 40);
  const textRadius = radius - 38;
  const totalArc = Math.min(Math.PI * 1.45, Math.max(Math.PI * 0.7, label.length * 0.115));
  const startAngle = -Math.PI / 2 - totalArc / 2;
  const step = label.length > 1 ? totalArc / (label.length - 1) : 0;

  ctx.font = 'bold 21px "Plus Jakarta Sans", Arial, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  for (let i = 0; i < label.length; i++) {
    const angle = startAngle + i * step;
    ctx.save();
    ctx.translate(cx + Math.cos(angle) * textRadius, cy + Math.sin(angle) * textRadius);
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillText(label[i], 0, 0);
    ctx.restore();
  }

  // Bottom horizontal subtext inside seal
  ctx.font = 'bold 18px "JetBrains Mono", monospace';
  ctx.fillText((subText || 'EXPORT APPROVED').toUpperCase().slice(0, 22), cx, cy + 72);

  ctx.font = '600 13px "JetBrains Mono", monospace';
  ctx.fillText('AUTHORIZED SEAL', cx, cy + 98);

  return canvas.toDataURL('image/png');
}

export const SELLER_DEFAULTS_KEY = 'yilai_trade_seller_defaults_v2';
export const SAVED_DOCS_KEY = 'yilai_trade_saved_docs_v2';
export const ACTIVE_DOC_KEY = 'yilai_trade_active_doc_v2';

export function createDefaultDocument(profile: UserProfile | null): TradeDocumentState {
  const piNum = generateDocNumber('PI');
  const plNum = piNum.replace(/^PI-/, 'PL-');
  const company = profile?.companyName || 'Yi Lai Dispensing Packaging Co., Ltd.';

  let sellerPatch: Partial<TradeDocumentState> = {};
  try {
    const raw = window.localStorage.getItem(SELLER_DEFAULTS_KEY);
    if (raw) {
      sellerPatch = JSON.parse(raw) as Partial<TradeDocumentState>;
    }
  } catch {
    // Ignore storage errors
  }

  return {
    id: `doc_${Date.now()}`,
    themeId: 'navy',
    documentType: 'proforma',
    piNumber: piNum,
    packingListNumber: plNum,
    poReference: 'PO-2026-881',
    issueDate: todayIso(),
    validUntil: addDaysIso(15),
    incoterm: 'FOB',
    incotermPlace: 'Ningbo Port, China',
    currency: 'USD',
    showDualRmbReference: false,
    showProductImages: true,

    sellerLogoUrl: sellerPatch.sellerLogoUrl || '',
    sellerCompany: sellerPatch.sellerCompany || company,
    sellerWebsite: sellerPatch.sellerWebsite || 'https://yilaihub.online',
    sellerTaxId: sellerPatch.sellerTaxId || 'USCI 91330281MA2J8X9012',
    sellerContact: sellerPatch.sellerContact || profile?.displayName || 'Yi Lai Export Sales',
    sellerAddress:
      sellerPatch.sellerAddress || 'No. 88 Binhai Industrial Zone, Yuyao, Ningbo, Zhejiang, China',
    sellerEmail: sellerPatch.sellerEmail || profile?.email || 'sales@yilaihub.online',
    sellerPhone: sellerPatch.sellerPhone || '+86 574 6200 8810',

    buyerClientId: '',
    buyerCompany: 'Aurelia Botanics Ltd.',
    buyerContact: 'Sophia Lim',
    buyerAddress: 'Suite 14-02, Menara Sentral Vista, 50470 Kuala Lumpur',
    buyerCountry: 'Malaysia',
    buyerEmail: 'procurement@aureliabotanics.my',
    buyerPhone: '+60 12 394 8821',
    buyerTaxId: 'MY-TIN-2024991820',

    transportMode: 'sea',
    portOfLoading: sellerPatch.portOfLoading || 'Ningbo Port, China',
    portOfDischarge: 'Port Klang, Malaysia',
    countryOfOrigin: 'China',
    shippingMarks: 'YILAI / KL\nC/NO. 1-UP\nMADE IN CHINA',
    packageType: '5-Ply Export Corrugated Cartons',
    estimatedLeadTime: '15–20 working days after 30% deposit',

    items: [
      {
        id: `item_${Date.now()}_1`,
        sku: 'YL-TRG-28410',
        description: 'Heavy Duty 28/410 Trigger Sprayer (Stream / Spray / Off)',
        specifications: 'Neck: 28/410 · Color: White / Charcoal · Dip Tube: 210mm',
        hsCode: '8424.89.90',
        cartons: 20,
        unitsPerCarton: 500,
        unitLabel: 'pcs',
        unitPrice: 0.23,
        netWeightPerCartonKg: 11.6,
        grossWeightPerCartonKg: 12.8,
        lengthCm: 56,
        widthCm: 38,
        heightCm: 42,
      },
      {
        id: `item_${Date.now()}_2`,
        sku: 'YL-LOT-24410',
        description: 'Brushed Alu-Collar 24/410 Cosmetic Lotion Pump (2.00cc)',
        specifications: 'Neck: 24/410 · Color: Matte Silver / White · Dip Tube: 175mm',
        hsCode: '8413.20.00',
        cartons: 10,
        unitsPerCarton: 450,
        unitLabel: 'pcs',
        unitPrice: 0.27,
        netWeightPerCartonKg: 9.3,
        grossWeightPerCartonKg: 10.4,
        lengthCm: 52,
        widthCm: 36,
        heightCm: 38,
      },
    ],

    freightFee: 0,
    insuranceFee: 0,
    taxRatePct: 0,
    discount: 0,
    showMilestoneSplit: true,
    depositPct: 30,
    depositLabel: '30% Advance Deposit (Upon PI Confirmation)',
    balanceLabel: '70% Balance Payment (Against Copy of B/L)',
    pricingFootnote: '* Prices quoted in USD based on FOB Ningbo terms. Bank charges borne by remitter.',

    bankBeneficiary: sellerPatch.bankBeneficiary || company,
    bankName: sellerPatch.bankName || 'Bank of China, Ningbo Branch',
    bankSwift: sellerPatch.bankSwift || 'BKCHCNBJ92A',
    bankAccountNumber: sellerPatch.bankAccountNumber || '3812 7094 5510 0088',
    bankAddress: sellerPatch.bankAddress || '139 Yaohang Street, Haishu District, Ningbo, China',
    intermediaryBank: sellerPatch.intermediaryBank || 'Bank of China, New York Branch',
    intermediarySwift: sellerPatch.intermediarySwift || 'BKCHUS33',
    bankNote: 'Please quote PI Number on T/T remittance remarks.',

    termsList: [
      'Packing: Standard export 5-ply corrugated cartons suitable for long-distance sea freight.',
      'Quantity Tolerance: +/- 3% production quantity variance accepted on custom molding runs.',
      'Quality & Inspection: Pre-shipment inspection and carton drop-test photos supplied prior to loading.',
      'Force Majeure: Seller is not liable for vessel schedule delays caused by carrier congestion or customs hold.',
    ],
    authorizedSignatory: sellerPatch.authorizedSignatory || `${company} — Authorized Signatory`,
    buyerSignatory: 'Buyer Authorized Signature & Stamp',

    stampEnabled: true,
    stampStyle: sellerPatch.stampStyle || 'red_round',
    stampText: sellerPatch.stampText || company,
    stampSubText: sellerPatch.stampSubText || 'EXPORT APPROVED',
    stampCustomUrl: sellerPatch.stampCustomUrl || '',
    stampXPercent: 74,
    stampYPercent: 83,
    stampScale: 1,
  };
}

export interface SampleTemplatePreset {
  id: string;
  label: string;
  subtitle: string;
  apply: (current: TradeDocumentState) => Partial<TradeDocumentState>;
}

export const SAMPLE_TEMPLATES: SampleTemplatePreset[] = [
  {
    id: 'dispensing',
    label: 'Dispensing Packaging',
    subtitle: 'Trigger sprayers & lotion pumps (FOB Ningbo)',
    apply: () => ({
      themeId: 'navy',
      incoterm: 'FOB',
      incotermPlace: 'Ningbo Port, China',
      portOfLoading: 'Ningbo Port, China',
      portOfDischarge: 'Port Klang, Malaysia',
      transportMode: 'sea',
      currency: 'USD',
      buyerCompany: 'Aurelia Botanics Ltd.',
      buyerContact: 'Sophia Lim',
      buyerAddress: 'Suite 14-02, Menara Sentral Vista, 50470 Kuala Lumpur',
      buyerCountry: 'Malaysia',
      buyerEmail: 'procurement@aureliabotanics.my',
      buyerPhone: '+60 12 394 8821',
      items: [
        {
          id: `tpl_d1_${Date.now()}`,
          sku: 'YL-TRG-28410',
          description: 'Heavy Duty 28/410 Trigger Sprayer',
          specifications: 'Neck: 28/410 · Color: White / Charcoal · Dip Tube: 210mm',
          hsCode: '8424.89.90',
          cartons: 20,
          unitsPerCarton: 500,
          unitLabel: 'pcs',
          unitPrice: 0.23,
          netWeightPerCartonKg: 11.6,
          grossWeightPerCartonKg: 12.8,
          lengthCm: 56,
          widthCm: 38,
          heightCm: 42,
        },
        {
          id: `tpl_d2_${Date.now()}`,
          sku: 'YL-FOM-43410',
          description: 'Wide-Neck 43/410 Facial Cleanser Foam Pump',
          specifications: 'Neck: 43/410 · Color: Gloss White · Dip Tube: 135mm',
          hsCode: '8413.20.00',
          cartons: 15,
          unitsPerCarton: 300,
          unitLabel: 'pcs',
          unitPrice: 0.34,
          netWeightPerCartonKg: 10.1,
          grossWeightPerCartonKg: 11.2,
          lengthCm: 58,
          widthCm: 40,
          heightCm: 40,
        },
      ],
    }),
  },
  {
    id: 'machinery',
    label: 'Industrial Machinery',
    subtitle: 'Automated bottling & capping equipment (CIF)',
    apply: () => ({
      themeId: 'slate',
      incoterm: 'CIF',
      incotermPlace: 'Port of Rotterdam, Netherlands',
      portOfLoading: 'Shanghai Port, China',
      portOfDischarge: 'Rotterdam, Netherlands',
      transportMode: 'sea',
      currency: 'EUR',
      freightFee: 1850,
      insuranceFee: 240,
      buyerCompany: 'NordicChem Packaging B.V.',
      buyerContact: 'Henrik Van Dijk',
      buyerAddress: 'Industrieweg 44, 3044 AS Rotterdam',
      buyerCountry: 'Netherlands',
      buyerEmail: 'imports@nordicchem.nl',
      buyerPhone: '+31 10 882 4190',
      packageType: 'ISPM-15 Fumigated Wooden Crates',
      items: [
        {
          id: `tpl_m1_${Date.now()}`,
          sku: 'YL-MAC-CAP8',
          description: '8-Head Rotary Servo Trigger Capper (380V / 50Hz)',
          specifications: 'Stainless 304 frame · PLC touch screen · 60 BPM',
          hsCode: '8422.30.90',
          cartons: 2,
          unitsPerCarton: 1,
          unitLabel: 'sets',
          unitPrice: 14800,
          netWeightPerCartonKg: 680,
          grossWeightPerCartonKg: 760,
          lengthCm: 210,
          widthCm: 145,
          heightCm: 185,
        },
        {
          id: `tpl_m2_${Date.now()}`,
          sku: 'YL-SPK-28410',
          description: 'Spare Chuck & Silicon Gripper Kit (24/410 & 28/410)',
          specifications: 'Hardened tool steel + food-grade silicone inserts',
          hsCode: '8422.90.90',
          cartons: 4,
          unitsPerCarton: 5,
          unitLabel: 'sets',
          unitPrice: 320,
          netWeightPerCartonKg: 14,
          grossWeightPerCartonKg: 16.5,
          lengthCm: 48,
          widthCm: 36,
          heightCm: 28,
        },
      ],
    }),
  },
  {
    id: 'electronics',
    label: 'Smart Electronics',
    subtitle: 'Touchless dispenser sensors & PCB modules (Air)',
    apply: () => ({
      themeId: 'emerald',
      incoterm: 'CIP',
      incotermPlace: 'Dubai International Airport (DXB)',
      portOfLoading: 'Shenzhen Baoan Airport (SZX)',
      portOfDischarge: 'Dubai Intl Airport (DXB)',
      transportMode: 'air',
      currency: 'USD',
      freightFee: 640,
      insuranceFee: 110,
      buyerCompany: 'Gulf Hygiene Solutions LLC',
      buyerContact: 'Tariq Al Mansoori',
      buyerAddress: 'Warehouse 12, Al Quoz Industrial Area 3, Dubai',
      buyerCountry: 'United Arab Emirates',
      buyerEmail: 'purchasing@gulfhygiene.ae',
      buyerPhone: '+971 4 388 9200',
      items: [
        {
          id: `tpl_e1_${Date.now()}`,
          sku: 'YL-SEN-IR04',
          description: 'Infrared Touchless Foam Dispenser Sensor Module',
          specifications: 'USB-C rechargeable · IPX5 waterproof · ABS housing',
          hsCode: '8543.70.99',
          cartons: 12,
          unitsPerCarton: 100,
          unitLabel: 'pcs',
          unitPrice: 4.85,
          netWeightPerCartonKg: 8.4,
          grossWeightPerCartonKg: 9.6,
          lengthCm: 46,
          widthCm: 34,
          heightCm: 32,
        },
      ],
    }),
  },
  {
    id: 'textiles',
    label: 'Home Textiles',
    subtitle: 'Microfiber cleaning cloths & retail packs (FOB)',
    apply: () => ({
      themeId: 'burgundy',
      incoterm: 'FOB',
      incotermPlace: 'Ningbo Port, China',
      portOfLoading: 'Ningbo Port, China',
      portOfDischarge: 'Port of Valencia, Spain',
      transportMode: 'sea',
      currency: 'USD',
      buyerCompany: 'VeroClean Homecare Co.',
      buyerContact: 'Mateo Alvarez',
      buyerAddress: 'Poligono Industrial Fuente del Jarro, 46988 Paterna, Valencia',
      buyerCountry: 'Spain',
      buyerEmail: 'mateo@veroclean.es',
      buyerPhone: '+34 612 448 903',
      items: [
        {
          id: `tpl_t1_${Date.now()}`,
          sku: 'YL-TEX-MF300',
          description: '300GSM Microfiber Trigger-Bottle Cleaning Cloth (40x40cm)',
          specifications: 'Color: Charcoal / Teal · Overlock stitched · Polybagged',
          hsCode: '6307.10.00',
          cartons: 30,
          unitsPerCarton: 200,
          unitLabel: 'pcs',
          unitPrice: 0.42,
          netWeightPerCartonKg: 10.2,
          grossWeightPerCartonKg: 11.4,
          lengthCm: 54,
          widthCm: 40,
          heightCm: 38,
        },
      ],
    }),
  },
];
