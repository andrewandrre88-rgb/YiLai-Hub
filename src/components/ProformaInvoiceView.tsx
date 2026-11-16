import { ChangeEvent, PointerEvent as ReactPointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Building2,
  Check,
  Download,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  Globe,
  HelpCircle,
  ImagePlus,
  Landmark,
  Move,
  Package,
  Plane,
  Plus,
  RotateCcw,
  Save,
  Ship,
  Stamp,
  Trash2,
  Truck,
  User,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { fetchOrderItems } from '../lib/firestoreService';
import { exportTradeDocumentExcel } from '../lib/proformaExcel';
import { downloadTradeDocumentPdf } from '../lib/proformaPdf';
import {
  ACTIVE_DOC_KEY,
  DOCUMENT_THEMES,
  INCOTERMS_2020,
  MILESTONE_SPLITS,
  PreviewMode,
  SAMPLE_TEMPLATES,
  SAVED_DOCS_KEY,
  SELLER_DEFAULTS_KEY,
  StampStyle,
  TRADE_CURRENCIES,
  ThemeId,
  TradeCurrencyCode,
  TradeDocumentState,
  TradeLineItem,
  TransportMode,
  amountToWords,
  calculateDocumentTotals,
  createDefaultDocument,
  formatTradeCurrency,
  formatTradeUnitPrice,
  generateDocNumber,
  getLineItemQuantity,
  renderPresetStampDataUrl,
} from '../lib/proformaTypes';
import {
  CATEGORY_IMAGES,
  Client,
  Order,
  Product,
  UserProfile,
  convertUsdToRmb,
  formatExchangeRate,
  formatMoneyValue,
  getOrderItemFinancials,
} from '../types/hub';
import IncotermsModal from './proforma/IncotermsModal';
import ProformaExcelSimulator from './proforma/ProformaExcelSimulator';

interface ProformaInvoiceViewProps {
  profile: UserProfile | null;
  orders: Order[];
  clients: Client[];
  products: Product[];
  usdToRmbRate: number | null;
}

type EditorTab = 'parties' | 'items' | 'details' | 'financials' | 'terms' | 'packing';
type MobilePane = 'editor' | 'preview';

function compressUploadedImage(file: File, maxDim = 480, preserveAlpha = false): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      if (!result) {
        reject(new Error('Failed to read image file'));
        return;
      }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(result);
          return;
        }
        if (!preserveAlpha) {
          ctx.fillStyle = '#FFFFFF';
          ctx.fillRect(0, 0, w, h);
        }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(
          preserveAlpha ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.86)
        );
      };
      img.onerror = () => reject(new Error('Invalid image format'));
      img.src = result;
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

function readInitialDocument(profile: UserProfile | null): TradeDocumentState {
  const base = createDefaultDocument(profile);
  try {
    const raw = window.localStorage.getItem(ACTIVE_DOC_KEY);
    if (!raw) return base;
    const parsed = JSON.parse(raw) as Partial<TradeDocumentState>;
    return {
      ...base,
      ...parsed,
      items: Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed.items : base.items,
      termsList:
        Array.isArray(parsed.termsList) && parsed.termsList.length > 0
          ? parsed.termsList
          : base.termsList,
    };
  } catch {
    return base;
  }
}

function readSavedDocuments(): TradeDocumentState[] {
  try {
    const raw = window.localStorage.getItem(SAVED_DOCS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as TradeDocumentState[]) : [];
  } catch {
    return [];
  }
}

export function ProformaInvoiceView({
  profile,
  orders,
  clients,
  products,
  usdToRmbRate,
}: ProformaInvoiceViewProps) {
  const [doc, setDoc] = useState<TradeDocumentState>(() => readInitialDocument(profile));
  const [savedDocs, setSavedDocs] = useState<TradeDocumentState[]>(() => readSavedDocuments());
  const [activeTab, setActiveTab] = useState<EditorTab>('parties');
  const [previewMode, setPreviewMode] = useState<PreviewMode>('document');
  const [mobilePane, setMobilePane] = useState<MobilePane>('editor');
  const [zoom, setZoom] = useState<number>(100);
  const [fitToWidth, setFitToWidth] = useState<boolean>(true);
  const [viewportInnerWidth, setViewportInnerWidth] = useState<number>(0);
  const [sheetHeight, setSheetHeight] = useState<number>(1123);

  const [selectedOrderId, setSelectedOrderId] = useState<string>('');
  const [selectedCatalogProductId, setSelectedCatalogProductId] = useState<string>('');
  const [importingOrder, setImportingOrder] = useState(false);
  const [exportingPdf, setExportingPdf] = useState(false);
  const [exportingExcel, setExportingExcel] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [incotermsModalOpen, setIncotermsModalOpen] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ url: string; title: string } | null>(null);

  // Draggable stamp & responsive canvas measurement refs
  const viewportInnerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const draggingStampRef = useRef(false);
  const [isDraggingStamp, setIsDraggingStamp] = useState(false);

  const A4_WIDTH_PX = 794;
  const autoFitScale =
    viewportInnerWidth > 0 ? Math.min(1, Math.max(0.32, viewportInnerWidth / A4_WIDTH_PX)) : 1;
  const effectiveScale = fitToWidth ? autoFitScale : zoom / 100;
  const displayZoomPct = Math.round(effectiveScale * 100);

  useEffect(() => {
    const measureEl = viewportInnerRef.current;
    const sheetEl = canvasRef.current;

    const updateSizes = () => {
      if (viewportInnerRef.current && viewportInnerRef.current.clientWidth > 0) {
        setViewportInnerWidth(viewportInnerRef.current.clientWidth);
      }
      if (canvasRef.current && canvasRef.current.offsetHeight > 0) {
        setSheetHeight(canvasRef.current.offsetHeight);
      }
    };

    updateSizes();
    if (typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver(() => {
      updateSizes();
    });
    if (measureEl) observer.observe(measureEl);
    if (sheetEl) observer.observe(sheetEl);
    return () => observer.disconnect();
  }, [mobilePane, previewMode, doc.items.length, doc.documentType, doc.showMilestoneSplit]);

  const theme = DOCUMENT_THEMES[doc.themeId] || DOCUMENT_THEMES.navy;
  const totals = useMemo(() => calculateDocumentTotals(doc, usdToRmbRate), [doc, usdToRmbRate]);
  const isPacking = doc.documentType === 'packing_list';
  const activeDocNumber = isPacking ? doc.packingListNumber : doc.piNumber;

  const stampPreviewDataUrl = useMemo(() => {
    if (!doc.stampEnabled) return '';
    if (doc.stampStyle === 'custom' && doc.stampCustomUrl) {
      return doc.stampCustomUrl;
    }
    return renderPresetStampDataUrl(doc.stampStyle, doc.stampText, doc.stampSubText);
  }, [doc.stampEnabled, doc.stampStyle, doc.stampCustomUrl, doc.stampText, doc.stampSubText]);

  const showToast = (message: string) => {
    setNotice(message);
    window.setTimeout(() => {
      setNotice((prev) => (prev === message ? null : prev));
    }, 3200);
  };

  // Persist active draft & seller/bank defaults cleanly in localStorage (no Firestore writes)
  useEffect(() => {
    try {
      window.localStorage.setItem(ACTIVE_DOC_KEY, JSON.stringify(doc));
      const sellerDefaults = {
        sellerLogoUrl: doc.sellerLogoUrl,
        sellerCompany: doc.sellerCompany,
        sellerWebsite: doc.sellerWebsite,
        sellerTaxId: doc.sellerTaxId,
        sellerContact: doc.sellerContact,
        sellerAddress: doc.sellerAddress,
        sellerEmail: doc.sellerEmail,
        sellerPhone: doc.sellerPhone,
        portOfLoading: doc.portOfLoading,
        bankBeneficiary: doc.bankBeneficiary,
        bankName: doc.bankName,
        bankSwift: doc.bankSwift,
        bankAccountNumber: doc.bankAccountNumber,
        bankAddress: doc.bankAddress,
        intermediaryBank: doc.intermediaryBank,
        intermediarySwift: doc.intermediarySwift,
        authorizedSignatory: doc.authorizedSignatory,
        stampStyle: doc.stampStyle,
        stampText: doc.stampText,
        stampSubText: doc.stampSubText,
        stampCustomUrl: doc.stampCustomUrl,
      };
      window.localStorage.setItem(SELLER_DEFAULTS_KEY, JSON.stringify(sellerDefaults));
    } catch {
      // Ignore storage quota errors
    }
  }, [doc]);

  const updateDoc = <K extends keyof TradeDocumentState>(key: K, value: TradeDocumentState[K]) => {
    setDoc((prev) => ({ ...prev, [key]: value }));
  };

  const updateItem = (itemId: string, patch: Partial<TradeLineItem>) => {
    setDoc((prev) => ({
      ...prev,
      items: prev.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
    }));
  };

  const addCustomItem = () => {
    const newItem: TradeLineItem = {
      id: `item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      description: 'New Trade Line Item',
      specifications: 'Standard specification',
      hsCode: '8424.89.90',
      quantity: 5000,
      cartons: 10,
      unitsPerCarton: 500,
      unitLabel: 'pcs',
      unitPrice: 0.25,
      netWeightPerCartonKg: 10.5,
      grossWeightPerCartonKg: 11.5,
      lengthCm: 54,
      widthCm: 38,
      heightCm: 40,
    };
    setDoc((prev) => ({ ...prev, items: [...prev.items, newItem] }));
  };

  const addCatalogProduct = (productId: string) => {
    const prod = products.find((p) => p.id === productId);
    if (!prod) return;
    const usdRate = usdToRmbRate && usdToRmbRate > 0 ? usdToRmbRate : 7.2;
    const rawSell = Number(prod.sellingPrice) || 0;
    const estimatedUsd =
      prod.priceCurrency === 'CNY' ? Number((rawSell / usdRate).toFixed(4)) : rawSell;
    const specs = [
      prod.neckSize ? `Neck: ${prod.neckSize}` : '',
      prod.dosage ? `Dosage: ${prod.dosage}` : '',
      prod.colorFinish ? `Finish: ${prod.colorFinish}` : '',
    ]
      .filter(Boolean)
      .join(' · ');

    const ctnCount = Math.max(1, Math.round((prod.moq || 1000) / Math.max(1, prod.cartonQty || 500)));
    const unitsPerCtn = Math.max(1, prod.cartonQty || 500);
    const newItem: TradeLineItem = {
      id: `cat_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      productId: prod.id,
      description: prod.name,
      specifications: specs || 'Standard dispensing specification',
      hsCode: prod.category === 'lotion_pump' || prod.category === 'foam_pump' ? '8413.20.00' : '8424.89.90',
      quantity: ctnCount * unitsPerCtn,
      cartons: ctnCount,
      unitsPerCarton: unitsPerCtn,
      unitLabel: 'pcs',
      unitPrice: estimatedUsd,
      netWeightPerCartonKg: Number(prod.netWeightKg) || 10.2,
      grossWeightPerCartonKg: Number(prod.grossWeightKg) || 11.4,
      lengthCm: Number(prod.boxLengthCm) || 54,
      widthCm: Number(prod.boxWidthCm) || 38,
      heightCm: Number(prod.boxHeightCm) || 40,
      imageUrl: prod.imageUrl || CATEGORY_IMAGES[prod.imageKey],
    };
    setDoc((prev) => ({ ...prev, items: [...prev.items, newItem] }));
    setSelectedCatalogProductId('');
    showToast(`Added ${prod.name} from catalog`);
  };

  const removeItem = (itemId: string) => {
    setDoc((prev) => ({
      ...prev,
      items: prev.items.length > 1 ? prev.items.filter((i) => i.id !== itemId) : prev.items,
    }));
  };

  const handleSelectClient = (clientId: string) => {
    const client = clients.find((c) => c.id === clientId);
    if (!client) {
      updateDoc('buyerClientId', '');
      return;
    }
    setDoc((prev) => ({
      ...prev,
      buyerClientId: client.id,
      buyerCompany: client.companyName || prev.buyerCompany,
      buyerContact: client.contactName || prev.buyerContact,
      buyerCountry: client.country || prev.buyerCountry,
      buyerEmail: client.email || prev.buyerEmail,
      buyerPhone: client.whatsappNumber || prev.buyerPhone,
    }));
    showToast(`Loaded buyer: ${client.companyName}`);
  };

  const handleImportOrder = async (orderId: string) => {
    setSelectedOrderId(orderId);
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;

    setImportingOrder(true);
    try {
      const orderItems = await fetchOrderItems(order.id, order.ownerId);
      const client = clients.find((c) => c.id === order.clientId);
      const effectiveRate = order.exchangeRate || usdToRmbRate;

      const mappedItems: TradeLineItem[] =
        orderItems.length > 0
          ? orderItems.map((oi) => {
              const fin = getOrderItemFinancials(oi, effectiveRate);
              const catalogProd = products.find(
                (p) => p.id === oi.productId || p.sku === oi.productSku
              );
              const ctnQty = Math.max(1, catalogProd?.cartonQty || 500);
              const cartons = Math.max(1, Math.ceil((oi.quantity || ctnQty) / ctnQty));
              const unitUsd = fin.unitSellingUsd ?? oi.unitSellingPrice;
              const specs = [
                oi.neckSize ? `Neck: ${oi.neckSize}` : '',
                oi.colorFinish ? `Color: ${oi.colorFinish}` : '',
                oi.dipTube ? `Dip Tube: ${oi.dipTube}` : '',
              ]
                .filter(Boolean)
                .join(' · ');

              return {
                id: `oi_${oi.id}_${Date.now()}`,
                productId: oi.productId,
                description: oi.productName,
                specifications: specs,
                hsCode:
                  oi.category === 'lotion_pump' || oi.category === 'foam_pump'
                    ? '8413.20.00'
                    : '8424.89.90',
                quantity: Number(oi.quantity) || cartons * ctnQty,
                cartons,
                unitsPerCarton: ctnQty,
                unitLabel: 'pcs',
                unitPrice: Number((unitUsd || 0).toFixed(4)),
                netWeightPerCartonKg: Number(catalogProd?.netWeightKg) || 10.5,
                grossWeightPerCartonKg: Number(catalogProd?.grossWeightKg) || 11.6,
                lengthCm: Number(catalogProd?.boxLengthCm) || 54,
                widthCm: Number(catalogProd?.boxWidthCm) || 38,
                heightCm: Number(catalogProd?.boxHeightCm) || 40,
                imageUrl:
                  catalogProd?.imageUrl ||
                  (catalogProd ? CATEGORY_IMAGES[catalogProd.imageKey] : undefined),
              };
            })
          : [
              {
                id: `ord_sum_${Date.now()}`,
                description: order.itemsSummary || 'Dispensing Packaging Order',
                specifications: order.shippingNotes || 'As per confirmed sample',
                hsCode: '8424.89.90',
                quantity: order.totalUnits || 500,
                cartons: Math.max(1, Math.ceil((order.totalUnits || 500) / 500)),
                unitsPerCarton: 500,
                unitLabel: 'pcs',
                unitPrice:
                  order.totalUnits > 0
                    ? Number((order.totalAmount / order.totalUnits).toFixed(4))
                    : 0,
                netWeightPerCartonKg: 10.5,
                grossWeightPerCartonKg: 11.6,
                lengthCm: 54,
                widthCm: 38,
                heightCm: 40,
              },
            ];

      setDoc((prev) => ({
        ...prev,
        poReference: order.orderNumber,
        buyerClientId: client?.id || order.clientId || prev.buyerClientId,
        buyerCompany: client?.companyName || order.clientName || prev.buyerCompany,
        buyerContact: client?.contactName || prev.buyerContact,
        buyerCountry: client?.country || prev.buyerCountry,
        buyerEmail: client?.email || prev.buyerEmail,
        buyerPhone: client?.whatsappNumber || order.clientWhatsapp || prev.buyerPhone,
        items: mappedItems,
      }));
      showToast(`Imported order ${order.orderNumber}`);
    } catch (err) {
      console.error('Order import failed:', err);
      showToast('Could not fetch order items; check network connection.');
    } finally {
      setImportingOrder(false);
    }
  };

  const handleApplyTemplate = (templateId: string) => {
    const tpl = SAMPLE_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const patch = tpl.apply(doc);
    setDoc((prev) => ({ ...prev, ...patch }));
    showToast(`Loaded template: ${tpl.label}`);
  };

  const handleSaveSnapshot = () => {
    const snapshot: TradeDocumentState = {
      ...doc,
      savedAt: new Date().toISOString(),
    };
    const next = [snapshot, ...savedDocs.filter((d) => d.id !== snapshot.id)].slice(0, 15);
    setSavedDocs(next);
    try {
      window.localStorage.setItem(SAVED_DOCS_KEY, JSON.stringify(next));
      showToast(`Saved ${activeDocNumber} to drafts`);
    } catch {
      showToast('Could not save draft (storage full)');
    }
  };

  const handleLoadSnapshot = (saved: TradeDocumentState) => {
    setDoc(saved);
    showToast(`Loaded ${saved.documentType === 'packing_list' ? saved.packingListNumber : saved.piNumber}`);
  };

  const handleDeleteSnapshot = (id: string) => {
    const next = savedDocs.filter((d) => d.id !== id);
    setSavedDocs(next);
    try {
      window.localStorage.setItem(SAVED_DOCS_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage error
    }
  };

  const handleNewDocument = () => {
    const fresh = createDefaultDocument(profile);
    setDoc(fresh);
    setSelectedOrderId('');
    showToast(`Created fresh document ${fresh.piNumber}`);
  };

  const handleLogoUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressUploadedImage(file, 360, true);
      updateDoc('sellerLogoUrl', dataUrl);
      showToast('Seller logo updated');
    } catch {
      showToast('Failed to process logo image');
    }
    e.target.value = '';
  };

  const handleCustomStampUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressUploadedImage(file, 420, true);
      setDoc((prev) => ({
        ...prev,
        stampEnabled: true,
        stampStyle: 'custom',
        stampCustomUrl: dataUrl,
      }));
      showToast('Custom stamp uploaded');
    } catch {
      showToast('Failed to process stamp image');
    }
    e.target.value = '';
  };

  const handleProductImageUpload = async (itemId: string, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressUploadedImage(file, 320, false);
      updateItem(itemId, { imageUrl: dataUrl });
      showToast('Product photo attached');
    } catch {
      showToast('Failed to process product photo');
    }
    e.target.value = '';
  };

  const handleCycleMilestoneSplit = () => {
    const currentIdx = MILESTONE_SPLITS.findIndex((m) => m.deposit === doc.depositPct);
    const next = MILESTONE_SPLITS[(currentIdx + 1) % MILESTONE_SPLITS.length];
    setDoc((prev) => ({
      ...prev,
      depositPct: next.deposit,
      depositLabel: `${next.deposit}% Advance Deposit (Upon PI Confirmation)`,
      balanceLabel: `${next.balance}% Balance Payment (Against Copy of B/L)`,
    }));
  };

  const handleDownloadPdf = async () => {
    setExportingPdf(true);
    try {
      await downloadTradeDocumentPdf(doc, totals);
      showToast(`Downloaded ${activeDocNumber}.pdf`);
    } catch (err) {
      console.error('PDF export failed:', err);
      showToast('PDF generation failed. Please try again.');
    } finally {
      setExportingPdf(false);
    }
  };

  const handleExportExcel = async () => {
    setExportingExcel(true);
    try {
      await exportTradeDocumentExcel(doc, totals);
      showToast(`Exported ${activeDocNumber}.xlsx`);
    } catch (err) {
      console.error('Excel export failed:', err);
      showToast('Excel export failed. Please try again.');
    } finally {
      setExportingExcel(false);
    }
  };

  // Interactive Pointer Dragging for Company Stamp Overlay
  const updateStampCoordsFromPointer = (clientX: number, clientY: number) => {
    const el = canvasRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const xPct = Math.max(8, Math.min(92, ((clientX - rect.left) / rect.width) * 100));
    const yPct = Math.max(8, Math.min(92, ((clientY - rect.top) / rect.height) * 100));
    setDoc((prev) => ({
      ...prev,
      stampXPercent: Number(xPct.toFixed(1)),
      stampYPercent: Number(yPct.toFixed(1)),
    }));
  };

  const handleStampPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    draggingStampRef.current = true;
    setIsDraggingStamp(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    updateStampCoordsFromPointer(e.clientX, e.clientY);
  };

  const handleStampPointerMove = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingStampRef.current) return;
    updateStampCoordsFromPointer(e.clientX, e.clientY);
  };

  const handleStampPointerUp = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (!draggingStampRef.current) return;
    draggingStampRef.current = false;
    setIsDraggingStamp(false);
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  };

  const renderTransportIcon = (mode: TransportMode) => {
    if (mode === 'air') return <Plane className="w-3.5 h-3.5 shrink-0" />;
    if (mode === 'truck') return <Truck className="w-3.5 h-3.5 shrink-0" />;
    if (mode === 'multimodal') return <Globe className="w-3.5 h-3.5 shrink-0" />;
    return <Ship className="w-3.5 h-3.5 shrink-0" />;
  };

  const includeImagesColumn =
    doc.showProductImages && doc.items.some((i) => Boolean(i.imageUrl?.trim()));

  const tabs: Array<{ id: EditorTab; label: string }> = [
    { id: 'parties', label: 'Parties' },
    { id: 'items', label: `Items (${doc.items.length})` },
    { id: 'details', label: 'Details' },
    { id: 'financials', label: 'Financials' },
    { id: 'terms', label: 'Terms' },
    { id: 'packing', label: 'Packing' },
  ];

  const inputClass =
    'w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-md text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400 transition-colors';
  const labelClass = 'block text-[11px] font-semibold text-slate-600 mb-1';

  return (
    <div className="space-y-4 font-['Plus_Jakarta_Sans',sans-serif]">
      {/* Studio Top Bar: Import, Templates & Draft Management */}
      <div className="no-print bg-white border border-slate-200 rounded-xl p-3 sm:p-4 shadow-xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-800" />
              <h2 className="text-base font-bold text-slate-900 tracking-tight">
                B2B Trade Document Studio
              </h2>
              <span
                style={{ backgroundColor: theme.badgeBg, color: theme.badgeText }}
                className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider"
              >
                {theme.name}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Synchronized Proforma Invoice & Commercial Packing List with live Excel formulas,
              draggable company seal, and vector A4 PDF export.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Import Order Dropdown */}
            <select
              value={selectedOrderId}
              onChange={(e) => handleImportOrder(e.target.value)}
              disabled={importingOrder}
              aria-label="Import from Order"
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-slate-400 max-w-[200px]"
            >
              <option value="">
                {importingOrder ? 'Importing Order...' : 'Import from Order...'}
              </option>
              {orders.map((ord) => (
                <option key={ord.id} value={ord.id}>
                  {ord.orderNumber} — {ord.clientName}
                </option>
              ))}
            </select>

            {/* Sample Template Loader */}
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) handleApplyTemplate(e.target.value);
              }}
              aria-label="Load Sample Template"
              className="px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none focus:border-slate-400"
            >
              <option value="">Load Sample Template...</option>
              {SAMPLE_TEMPLATES.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.label} — {tpl.subtitle}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={handleSaveSnapshot}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <Save className="w-3.5 h-3.5" />
              Save Draft
            </button>

            <button
              type="button"
              onClick={handleNewDocument}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              New
            </button>
          </div>
        </div>

        {/* Saved Drafts Strip */}
        {savedDocs.length > 0 && (
          <div className="flex items-center gap-2 pt-2 border-t border-slate-100 overflow-x-auto pb-0.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 shrink-0">
              <FolderOpen className="w-3.5 h-3.5" />
              Drafts:
            </span>
            {savedDocs.map((sd) => {
              const label =
                sd.documentType === 'packing_list' ? sd.packingListNumber : sd.piNumber;
              const isCurrent = sd.id === doc.id;
              return (
                <div
                  key={sd.id}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] shrink-0 ${
                    isCurrent
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => handleLoadSnapshot(sd)}
                    className="font-['JetBrains_Mono',monospace] font-medium"
                  >
                    {label} ({sd.buyerCompany || 'Draft'})
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSnapshot(sd.id)}
                    title="Delete draft"
                    className="p-0.5 opacity-60 hover:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Status Toast */}
      {notice && (
        <div className="no-print fixed bottom-5 right-5 z-40 flex items-center gap-2 px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-medium shadow-lg">
          <Check className="w-3.5 h-3.5 text-emerald-400" />
          <span>{notice}</span>
        </div>
      )}

      {/* Mobile View Switcher */}
      <div className="no-print xl:hidden flex rounded-lg bg-slate-200/80 p-1">
        <button
          type="button"
          onClick={() => setMobilePane('editor')}
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
            mobilePane === 'editor' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          Structured Editor
        </button>
        <button
          type="button"
          onClick={() => setMobilePane('preview')}
          className={`flex-1 py-2 text-xs font-semibold rounded-md transition-all ${
            mobilePane === 'preview' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
          }`}
        >
          Live Preview ({isPacking ? 'Packing List' : 'Proforma'})
        </button>
      </div>

      {/* Main Split-Screen Workspace */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 items-start">
        {/* LEFT PANE: Structured Tabbed Editor */}
        <div
          className={`no-print xl:col-span-5 min-w-0 bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden ${
            mobilePane === 'editor' ? 'block' : 'hidden xl:block'
          }`}
        >
          {/* 6 Editor Tabs */}
          <div className="flex overflow-x-auto border-b border-slate-200 bg-slate-50 px-2 pt-2 gap-1">
            {tabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-2 text-xs font-semibold rounded-t-lg border-b-2 whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-white text-slate-900 border-slate-900'
                      : 'text-slate-500 border-transparent hover:text-slate-800 hover:bg-slate-100/80'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="p-4 max-h-[calc(100vh-240px)] overflow-y-auto space-y-4">
            {/* TAB 1: PARTIES */}
            {activeTab === 'parties' && (
              <div className="space-y-5">
                {/* Seller Block */}
                <div className="space-y-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                  <div className="flex items-center justify-between">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <Building2 className="w-3.5 h-3.5" />
                      Seller / Exporter
                    </span>
                    <div className="flex items-center gap-2">
                      <label className="cursor-pointer inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                        <ImagePlus className="w-3 h-3" />
                        {doc.sellerLogoUrl ? 'Change Logo' : 'Upload Logo'}
                        <input
                          type="file"
                          accept="image/*"
                          onChange={handleLogoUpload}
                          className="hidden"
                        />
                      </label>
                      {doc.sellerLogoUrl && (
                        <button
                          type="button"
                          onClick={() => updateDoc('sellerLogoUrl', '')}
                          className="text-[11px] text-rose-600 hover:underline font-medium"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Legal Company Name</label>
                      <input
                        type="text"
                        value={doc.sellerCompany}
                        onChange={(e) => updateDoc('sellerCompany', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Website</label>
                      <input
                        type="text"
                        value={doc.sellerWebsite}
                        onChange={(e) => updateDoc('sellerWebsite', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Tax / VAT / USCI ID</label>
                      <input
                        type="text"
                        value={doc.sellerTaxId}
                        onChange={(e) => updateDoc('sellerTaxId', e.target.value)}
                        className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Contact Person</label>
                      <input
                        type="text"
                        value={doc.sellerContact}
                        onChange={(e) => updateDoc('sellerContact', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Phone / WhatsApp</label>
                      <input
                        type="text"
                        value={doc.sellerPhone}
                        onChange={(e) => updateDoc('sellerPhone', e.target.value)}
                        className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Email</label>
                      <input
                        type="email"
                        value={doc.sellerEmail}
                        onChange={(e) => updateDoc('sellerEmail', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Factory / Registered Address</label>
                      <textarea
                        rows={2}
                        value={doc.sellerAddress}
                        onChange={(e) => updateDoc('sellerAddress', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>

                {/* Buyer Block */}
                <div className="space-y-3 p-3.5 rounded-lg border border-slate-200 bg-slate-50/50">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                      <User className="w-3.5 h-3.5" />
                      Buyer / Importer (Consignee)
                    </span>
                    <select
                      value={doc.buyerClientId}
                      onChange={(e) => handleSelectClient(e.target.value)}
                      aria-label="Select Saved Client"
                      className="px-2 py-1 text-[11px] bg-white border border-slate-200 rounded text-slate-700 max-w-[180px]"
                    >
                      <option value="">Pick Saved Client...</option>
                      {clients.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.companyName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Buyer Company Name</label>
                      <input
                        type="text"
                        value={doc.buyerCompany}
                        onChange={(e) => updateDoc('buyerCompany', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Contact Person (Attn)</label>
                      <input
                        type="text"
                        value={doc.buyerContact}
                        onChange={(e) => updateDoc('buyerContact', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Country / Destination</label>
                      <input
                        type="text"
                        value={doc.buyerCountry}
                        onChange={(e) => updateDoc('buyerCountry', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Buyer Email</label>
                      <input
                        type="email"
                        value={doc.buyerEmail}
                        onChange={(e) => updateDoc('buyerEmail', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Buyer Phone</label>
                      <input
                        type="text"
                        value={doc.buyerPhone}
                        onChange={(e) => updateDoc('buyerPhone', e.target.value)}
                        className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Buyer Tax / VAT / EORI</label>
                      <input
                        type="text"
                        value={doc.buyerTaxId}
                        onChange={(e) => updateDoc('buyerTaxId', e.target.value)}
                        className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Consignee Address</label>
                      <textarea
                        rows={2}
                        value={doc.buyerAddress}
                        onChange={(e) => updateDoc('buyerAddress', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 2: LINE ITEMS */}
            {activeTab === 'items' && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-2.5 pb-2.5 border-b border-slate-100">
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-1 min-w-0 sm:min-w-[230px]">
                    <select
                      value={selectedCatalogProductId}
                      onChange={(e) => {
                        setSelectedCatalogProductId(e.target.value);
                        if (e.target.value) addCatalogProduct(e.target.value);
                      }}
                      className="w-full sm:flex-1 min-w-0 truncate px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:border-slate-400"
                    >
                      <option value="">+ Add from Product Catalog...</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.sku} — {p.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={addCustomItem}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 shrink-0 w-full sm:w-auto transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Custom Row
                    </button>
                  </div>

                  <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer shrink-0 self-start sm:self-center py-0.5 select-none">
                    <input
                      type="checkbox"
                      checked={doc.showProductImages}
                      onChange={(e) => updateDoc('showProductImages', e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 shrink-0"
                    />
                    <span>Show Product Photos</span>
                  </label>
                </div>

                <div className="space-y-3">
                  {doc.items.map((item, idx) => {
                    const lineQty = getLineItemQuantity(item);
                    const lineTotal = lineQty * item.unitPrice;
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2.5"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 font-['JetBrains_Mono',monospace]">
                            Line #{idx + 1} · Total {lineQty.toLocaleString('en-US')}{' '}
                            {item.unitLabel || 'pcs'} ={' '}
                            {formatTradeCurrency(lineTotal, doc.currency)}
                          </span>
                          {doc.items.length > 1 && (
                            <button
                              type="button"
                              onClick={() => removeItem(item.id)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded"
                              title="Remove line"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>

                        {/* Image Row */}
                        <div className="flex items-center gap-3">
                          {item.imageUrl ? (
                            <img
                              src={item.imageUrl}
                              alt={item.description}
                              className="w-12 h-12 rounded-md object-cover border border-slate-200 bg-white shrink-0"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-md border border-dashed border-slate-300 bg-white flex items-center justify-center text-slate-300 shrink-0">
                              <Package className="w-5 h-5" />
                            </div>
                          )}
                          <div className="flex flex-wrap items-center gap-2">
                            <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1 rounded border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-50">
                              <ImagePlus className="w-3 h-3" />
                              {item.imageUrl ? 'Replace Photo' : 'Add Product Photo'}
                              <input
                                type="file"
                                accept="image/*"
                                onChange={(e) => handleProductImageUpload(item.id, e)}
                                className="hidden"
                              />
                            </label>
                            {item.imageUrl && (
                              <button
                                type="button"
                                onClick={() => updateItem(item.id, { imageUrl: '' })}
                                className="text-[11px] text-rose-600 hover:underline font-medium"
                              >
                                Remove Photo
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          <div className="sm:col-span-2">
                            <label className={labelClass}>Product Description</label>
                            <input
                              type="text"
                              value={item.description}
                              onChange={(e) => updateItem(item.id, { description: e.target.value })}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Quantity</label>
                            <input
                              type="number"
                              min={0}
                              value={lineQty}
                              onChange={(e) => {
                                const nextQty = Math.max(0, Number(e.target.value) || 0);
                                const patch: Partial<TradeLineItem> = { quantity: nextQty };
                                if (item.unitsPerCarton > 0 && nextQty % item.unitsPerCarton === 0) {
                                  patch.cartons = nextQty / item.unitsPerCarton;
                                }
                                updateItem(item.id, patch);
                              }}
                              className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                            />
                          </div>
                          <div className="sm:col-span-2">
                            <label className={labelClass}>Specifications (Neck, Finish, Material)</label>
                            <input
                              type="text"
                              value={item.specifications}
                              onChange={(e) =>
                                updateItem(item.id, { specifications: e.target.value })
                              }
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>HS Code</label>
                            <input
                              type="text"
                              value={item.hsCode}
                              onChange={(e) => updateItem(item.id, { hsCode: e.target.value })}
                              placeholder="e.g. 8424.89.90"
                              className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                          <div>
                            <label className={labelClass}>Cartons</label>
                            <input
                              type="number"
                              min={0}
                              value={item.cartons}
                              onChange={(e) => {
                                const nextCartons = Math.max(0, Number(e.target.value) || 0);
                                updateItem(item.id, {
                                  cartons: nextCartons,
                                  quantity: nextCartons * item.unitsPerCarton,
                                });
                              }}
                              className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Units / Ctn</label>
                            <input
                              type="number"
                              min={0}
                              value={item.unitsPerCarton}
                              onChange={(e) => {
                                const nextUnits = Math.max(0, Number(e.target.value) || 0);
                                updateItem(item.id, {
                                  unitsPerCarton: nextUnits,
                                  quantity: item.cartons * nextUnits,
                                });
                              }}
                              className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Unit Label</label>
                            <input
                              type="text"
                              value={item.unitLabel}
                              onChange={(e) => updateItem(item.id, { unitLabel: e.target.value })}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Unit Price ({doc.currency})</label>
                            <input
                              type="number"
                              min={0}
                              step="0.0001"
                              value={item.unitPrice}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  unitPrice: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* TAB 3: DETAILS & THEME */}
            {activeTab === 'details' && (
              <div className="space-y-4">
                {/* 5 Selectable Color Themes */}
                <div className="space-y-2">
                  <label className={labelClass}>Document Color Theme (Applies to Preview, PDF & Excel)</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(Object.values(DOCUMENT_THEMES) as Array<(typeof DOCUMENT_THEMES)[ThemeId]>).map(
                      (t) => {
                        const active = t.id === doc.themeId;
                        return (
                          <button
                            key={t.id}
                            type="button"
                            onClick={() => updateDoc('themeId', t.id)}
                            className={`flex items-center gap-2.5 p-2.5 rounded-lg border text-left transition-all ${
                              active
                                ? 'border-slate-900 bg-slate-50 ring-1 ring-slate-900'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <span
                              style={{ backgroundColor: t.primaryColor }}
                              className="w-5 h-5 rounded-md shrink-0 border border-black/10"
                            />
                            <div className="min-w-0">
                              <div className="text-xs font-bold text-slate-900 truncate">{t.name}</div>
                              <div className="text-[10px] font-['JetBrains_Mono',monospace] text-slate-500">
                                {t.primaryColor}
                              </div>
                            </div>
                          </button>
                        );
                      }
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                  <div>
                    <label className={labelClass}>Proforma Invoice No.</label>
                    <div className="flex gap-1.5">
                      <input
                        type="text"
                        value={doc.piNumber}
                        onChange={(e) => updateDoc('piNumber', e.target.value)}
                        className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                      />
                      <button
                        type="button"
                        onClick={() => updateDoc('piNumber', generateDocNumber('PI'))}
                        title="Generate new number"
                        className="px-2 border border-slate-200 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-600"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelClass}>Packing List No.</label>
                    <input
                      type="text"
                      value={doc.packingListNumber}
                      onChange={(e) => updateDoc('packingListNumber', e.target.value)}
                      className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>PO Reference</label>
                    <input
                      type="text"
                      value={doc.poReference}
                      onChange={(e) => updateDoc('poReference', e.target.value)}
                      className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Invoice Currency</label>
                    <select
                      value={doc.currency}
                      onChange={(e) => updateDoc('currency', e.target.value as TradeCurrencyCode)}
                      className={inputClass}
                    >
                      {Object.values(TRADE_CURRENCIES).map((c) => (
                        <option key={c.code} value={c.code}>
                          {c.code} ({c.symbol.trim()}) — {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Date of Issue</label>
                    <input
                      type="date"
                      value={doc.issueDate}
                      onChange={(e) => updateDoc('issueDate', e.target.value)}
                      className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Valid Until</label>
                    <input
                      type="date"
                      value={doc.validUntil}
                      onChange={(e) => updateDoc('validUntil', e.target.value)}
                      className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                    />
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-600">Incoterms 2020</label>
                      <button
                        type="button"
                        onClick={() => setIncotermsModalOpen(true)}
                        className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-sky-700 hover:underline"
                      >
                        <HelpCircle className="w-3 h-3" />
                        Guide
                      </button>
                    </div>
                    <select
                      value={doc.incoterm}
                      onChange={(e) => updateDoc('incoterm', e.target.value)}
                      className={inputClass}
                    >
                      {INCOTERMS_2020.map((t) => (
                        <option key={t.code} value={t.code}>
                          {t.code} — {t.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Incoterm Named Place</label>
                    <input
                      type="text"
                      value={doc.incotermPlace}
                      onChange={(e) => updateDoc('incotermPlace', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Transport Specs */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                  <div>
                    <label className={labelClass}>Mode of Transport</label>
                    <select
                      value={doc.transportMode}
                      onChange={(e) => updateDoc('transportMode', e.target.value as TransportMode)}
                      className={inputClass}
                    >
                      <option value="sea">Sea Freight (Ocean)</option>
                      <option value="air">Air Freight</option>
                      <option value="truck">Land / Express Courier</option>
                      <option value="multimodal">Multimodal</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelClass}>Country of Origin</label>
                    <input
                      type="text"
                      value={doc.countryOfOrigin}
                      onChange={(e) => updateDoc('countryOfOrigin', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Port of Loading</label>
                    <input
                      type="text"
                      value={doc.portOfLoading}
                      onChange={(e) => updateDoc('portOfLoading', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Port of Discharge</label>
                    <input
                      type="text"
                      value={doc.portOfDischarge}
                      onChange={(e) => updateDoc('portOfDischarge', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                {doc.currency === 'USD' && (
                  <label className="inline-flex items-center gap-2 text-xs text-slate-700 pt-1 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={doc.showDualRmbReference}
                      onChange={(e) => updateDoc('showDualRmbReference', e.target.checked)}
                      className="rounded border-slate-300"
                    />
                    Show internal RMB reference note (@ {formatExchangeRate(usdToRmbRate)})
                  </label>
                )}
              </div>
            )}

            {/* TAB 4: FINANCIALS & BANKING */}
            {activeTab === 'financials' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className={labelClass}>Freight / Shipping ({doc.currency})</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={doc.freightFee}
                      onChange={(e) =>
                        updateDoc('freightFee', Math.max(0, Number(e.target.value) || 0))
                      }
                      className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Cargo Insurance ({doc.currency})</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={doc.insuranceFee}
                      onChange={(e) =>
                        updateDoc('insuranceFee', Math.max(0, Number(e.target.value) || 0))
                      }
                      className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Tax Rate (%)</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step="0.1"
                      value={doc.taxRatePct}
                      onChange={(e) =>
                        updateDoc('taxRatePct', Math.max(0, Number(e.target.value) || 0))
                      }
                      className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Discount ({doc.currency})</label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={doc.discount}
                      onChange={(e) =>
                        updateDoc('discount', Math.max(0, Number(e.target.value) || 0))
                      }
                      className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                    />
                  </div>
                </div>

                {/* Payment Milestone Split Controls */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/60 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={doc.showMilestoneSplit}
                        onChange={(e) => updateDoc('showMilestoneSplit', e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      Show Payment Milestone Split
                    </label>
                    <div className="flex items-center gap-1">
                      {MILESTONE_SPLITS.map((m) => (
                        <button
                          key={m.deposit}
                          type="button"
                          onClick={() =>
                            setDoc((prev) => ({
                              ...prev,
                              depositPct: m.deposit,
                              depositLabel: `${m.deposit}% Advance Deposit (Upon PI Confirmation)`,
                              balanceLabel: `${m.balance}% Balance Payment (Against Copy of B/L)`,
                            }))
                          }
                          className={`px-1.5 py-0.5 rounded text-[10px] font-['JetBrains_Mono',monospace] font-semibold border ${
                            doc.depositPct === m.deposit
                              ? 'bg-slate-900 text-white border-slate-900'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {m.deposit}/{m.balance}
                        </button>
                      ))}
                    </div>
                  </div>

                  {doc.showMilestoneSplit && (
                    <div className="grid grid-cols-1 gap-2">
                      <div>
                        <label className={labelClass}>Custom Deposit % ({doc.depositPct}% / {100 - doc.depositPct}%)</label>
                        <input
                          type="number"
                          min={0}
                          max={100}
                          value={doc.depositPct}
                          onChange={(e) => {
                            const pct = Math.max(0, Math.min(100, Number(e.target.value) || 0));
                            setDoc((prev) => ({
                              ...prev,
                              depositPct: pct,
                              depositLabel: `${pct}% Advance Deposit (Upon PI Confirmation)`,
                              balanceLabel: `${100 - pct}% Balance Payment (Against Copy of B/L)`,
                            }));
                          }}
                          className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Deposit Milestone Label</label>
                        <input
                          type="text"
                          value={doc.depositLabel}
                          onChange={(e) => updateDoc('depositLabel', e.target.value)}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className={labelClass}>Balance Milestone Label</label>
                        <input
                          type="text"
                          value={doc.balanceLabel}
                          onChange={(e) => updateDoc('balanceLabel', e.target.value)}
                          className={inputClass}
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className={labelClass}>Pricing / Incoterms Footnote</label>
                    <input
                      type="text"
                      value={doc.pricingFootnote}
                      onChange={(e) => updateDoc('pricingFootnote', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Bank Wire Details */}
                <div className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-700">
                    <Landmark className="w-3.5 h-3.5" />
                    Bank Wire Remittance Details
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Beneficiary Name</label>
                      <input
                        type="text"
                        value={doc.bankBeneficiary}
                        onChange={(e) => updateDoc('bankBeneficiary', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Bank Name</label>
                      <input
                        type="text"
                        value={doc.bankName}
                        onChange={(e) => updateDoc('bankName', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>SWIFT / BIC Code</label>
                      <input
                        type="text"
                        value={doc.bankSwift}
                        onChange={(e) => updateDoc('bankSwift', e.target.value)}
                        className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Account Number / IBAN</label>
                      <input
                        type="text"
                        value={doc.bankAccountNumber}
                        onChange={(e) => updateDoc('bankAccountNumber', e.target.value)}
                        className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Intermediary Bank (Optional)</label>
                      <input
                        type="text"
                        value={doc.intermediaryBank}
                        onChange={(e) => updateDoc('intermediaryBank', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Intermediary SWIFT</label>
                      <input
                        type="text"
                        value={doc.intermediarySwift}
                        onChange={(e) => updateDoc('intermediarySwift', e.target.value)}
                        className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className={labelClass}>Remittance Note</label>
                      <input
                        type="text"
                        value={doc.bankNote}
                        onChange={(e) => updateDoc('bankNote', e.target.value)}
                        className={inputClass}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* TAB 5: TERMS, SIGNATURES & STAMP STUDIO */}
            {activeTab === 'terms' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700">
                      Numbered Terms & Conditions
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        updateDoc('termsList', [...doc.termsList, 'Additional trade clause...'])
                      }
                      className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold bg-slate-900 text-white rounded hover:bg-slate-800"
                    >
                      <Plus className="w-3 h-3" />
                      Add Clause
                    </button>
                  </div>
                  <div className="space-y-2">
                    {doc.termsList.map((term, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <span className="mt-1.5 text-[11px] font-['JetBrains_Mono',monospace] font-semibold text-slate-400 w-5 shrink-0">
                          {idx + 1}.
                        </span>
                        <textarea
                          rows={2}
                          value={term}
                          onChange={(e) => {
                            const next = [...doc.termsList];
                            next[idx] = e.target.value;
                            updateDoc('termsList', next);
                          }}
                          className={inputClass}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            updateDoc(
                              'termsList',
                              doc.termsList.filter((_, i) => i !== idx)
                            )
                          }
                          className="p-1.5 text-slate-400 hover:text-rose-600"
                          title="Delete term"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                  <div>
                    <label className={labelClass}>Buyer Signatory Label</label>
                    <input
                      type="text"
                      value={doc.buyerSignatory}
                      onChange={(e) => updateDoc('buyerSignatory', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Seller Signatory Label</label>
                    <input
                      type="text"
                      value={doc.authorizedSignatory}
                      onChange={(e) => updateDoc('authorizedSignatory', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                </div>

                {/* Interactive Draggable Company Stamp Controls */}
                <div className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={doc.stampEnabled}
                        onChange={(e) => updateDoc('stampEnabled', e.target.checked)}
                        className="rounded border-slate-300"
                      />
                      <Stamp className="w-3.5 h-3.5 text-rose-700" />
                      Company Stamp / Seal Overlay
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setDoc((prev) => ({
                          ...prev,
                          stampXPercent: 74,
                          stampYPercent: 83,
                          stampScale: 1,
                        }))
                      }
                      className="text-[11px] font-semibold text-slate-600 hover:text-slate-900 underline"
                    >
                      Reset Position
                    </button>
                  </div>

                  {doc.stampEnabled && (
                    <div className="space-y-2.5">
                      <div className="flex flex-wrap gap-2">
                        {(
                          [
                            { id: 'red_round', label: 'Crimson Round Seal' },
                            { id: 'blue_round', label: 'Navy Round Seal' },
                          ] as Array<{ id: StampStyle; label: string }>
                        ).map((preset) => (
                          <button
                            key={preset.id}
                            type="button"
                            onClick={() => updateDoc('stampStyle', preset.id)}
                            className={`px-2.5 py-1.5 rounded-md border text-[11px] font-semibold ${
                              doc.stampStyle === preset.id
                                ? 'bg-slate-900 text-white border-slate-900'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                            }`}
                          >
                            {preset.label}
                          </button>
                        ))}
                        <label className="cursor-pointer inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 bg-white text-[11px] font-semibold text-slate-700 hover:bg-slate-100">
                          <ImagePlus className="w-3.5 h-3.5" />
                          Upload Custom PNG
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleCustomStampUpload}
                            className="hidden"
                          />
                        </label>
                      </div>

                      {doc.stampStyle !== 'custom' && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className={labelClass}>Seal Rim Company Text</label>
                            <input
                              type="text"
                              value={doc.stampText}
                              onChange={(e) => updateDoc('stampText', e.target.value)}
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Inner Stamp Label</label>
                            <input
                              type="text"
                              value={doc.stampSubText}
                              onChange={(e) => updateDoc('stampSubText', e.target.value)}
                              className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                            />
                          </div>
                        </div>
                      )}

                      <div>
                        <label className={labelClass}>
                          Stamp Size ({Math.round((doc.stampScale || 1) * 100)}%) — Drag stamp
                          directly on A4 preview
                        </label>
                        <input
                          type="range"
                          min={60}
                          max={145}
                          value={Math.round((doc.stampScale || 1) * 100)}
                          onChange={(e) => updateDoc('stampScale', Number(e.target.value) / 100)}
                          className="w-full accent-slate-900"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 6: PACKING & WEIGHTS */}
            {activeTab === 'packing' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div>
                    <label className={labelClass}>Package Type</label>
                    <input
                      type="text"
                      value={doc.packageType}
                      onChange={(e) => updateDoc('packageType', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>Estimated Lead Time</label>
                    <input
                      type="text"
                      value={doc.estimatedLeadTime}
                      onChange={(e) => updateDoc('estimatedLeadTime', e.target.value)}
                      className={inputClass}
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className={labelClass}>Shipping Marks</label>
                    <textarea
                      rows={2}
                      value={doc.shippingMarks}
                      onChange={(e) => updateDoc('shippingMarks', e.target.value)}
                      className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                    />
                  </div>
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-100">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Per-Carton Weights & Dimensions
                  </div>
                  {doc.items.map((item, idx) => {
                    const cbmPerCtn =
                      item.lengthCm > 0 && item.widthCm > 0 && item.heightCm > 0
                        ? (item.lengthCm * item.widthCm * item.heightCm) / 1_000_000
                        : 0;
                    return (
                      <div
                        key={item.id}
                        className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
                          <span className="truncate">
                            #{idx + 1} {item.description}
                          </span>
                          <span className="font-['JetBrains_Mono',monospace] text-[11px] text-slate-500 shrink-0 ml-2">
                            {(item.cartons * cbmPerCtn).toFixed(2)} CBM
                          </span>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                          <div>
                            <label className={labelClass}>Net kg/ctn</label>
                            <input
                              type="number"
                              min={0}
                              step="0.1"
                              value={item.netWeightPerCartonKg}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  netWeightPerCartonKg: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Gross kg/ctn</label>
                            <input
                              type="number"
                              min={0}
                              step="0.1"
                              value={item.grossWeightPerCartonKg}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  grossWeightPerCartonKg: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>L (cm)</label>
                            <input
                              type="number"
                              min={0}
                              value={item.lengthCm}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  lengthCm: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>W (cm)</label>
                            <input
                              type="number"
                              min={0}
                              value={item.widthCm}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  widthCm: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>H (cm)</label>
                            <input
                              type="number"
                              min={0}
                              value={item.heightCm}
                              onChange={(e) =>
                                updateItem(item.id, {
                                  heightCm: Math.max(0, Number(e.target.value) || 0),
                                })
                              }
                              className={`${inputClass} font-['JetBrains_Mono',monospace]`}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT PANE: Live Preview Viewport */}
        <div
          className={`xl:col-span-7 min-w-0 flex flex-col gap-3 ${
            mobilePane === 'preview' ? 'flex' : 'hidden xl:flex'
          }`}
        >
          {/* Preview Top Toolbar */}
          <div className="no-print bg-white border border-slate-200 rounded-xl px-3 py-2.5 shadow-xs flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex flex-wrap items-center gap-2">
              {/* Document Type Switcher */}
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => updateDoc('documentType', 'proforma')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    doc.documentType === 'proforma'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Proforma Invoice
                </button>
                <button
                  type="button"
                  onClick={() => updateDoc('documentType', 'packing_list')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    doc.documentType === 'packing_list'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Packing List
                </button>
              </div>

              {/* Document vs Excel View Switcher */}
              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                <button
                  type="button"
                  onClick={() => setPreviewMode('document')}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    previewMode === 'document'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Document
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewMode('excel')}
                  className={`inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-md transition-all ${
                    previewMode === 'excel'
                      ? 'bg-white text-slate-900 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" />
                  Excel View
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Responsive Fit / Zoom Controls */}
              {previewMode === 'document' && (
                <div className="inline-flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-lg px-1.5 py-1">
                  <button
                    type="button"
                    onClick={() => {
                      const base = Math.round(effectiveScale * 100);
                      setFitToWidth(false);
                      setZoom(Math.max(50, Math.floor((base - 1) / 10) * 10));
                    }}
                    className="p-0.5 text-slate-600 hover:text-slate-900"
                    title="Zoom Out"
                  >
                    <ZoomOut className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFitToWidth(true);
                      setZoom(100);
                    }}
                    className={`px-1.5 py-0.5 rounded text-[11px] font-['JetBrains_Mono',monospace] font-semibold transition-colors ${
                      fitToWidth
                        ? 'bg-slate-200/80 text-slate-900'
                        : 'text-slate-700 hover:bg-slate-200/60'
                    }`}
                    title="Auto-fit sheet to viewport width"
                  >
                    {fitToWidth ? `Fit · ${displayZoomPct}%` : `${displayZoomPct}%`}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const base = Math.round(effectiveScale * 100);
                      setFitToWidth(false);
                      setZoom(Math.min(140, Math.ceil((base + 1) / 10) * 10));
                    }}
                    className="p-0.5 text-slate-600 hover:text-slate-900"
                    title="Zoom In"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setIncotermsModalOpen(true)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                <HelpCircle className="w-3.5 h-3.5" />
                Incoterms
              </button>

              <button
                type="button"
                onClick={handleExportExcel}
                disabled={exportingExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg hover:bg-emerald-100 disabled:opacity-60 transition-colors"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {exportingExcel ? 'Exporting...' : 'Export .xlsx'}
              </button>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={exportingPdf}
                style={{ backgroundColor: theme.primaryColor }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white rounded-lg hover:opacity-95 disabled:opacity-60 transition-opacity shadow-xs"
              >
                <Download className="w-3.5 h-3.5" />
                {exportingPdf ? 'Generating PDF...' : 'Download PDF'}
              </button>
            </div>
          </div>

          {/* Desk Canvas Viewport */}
          <div className="bg-slate-100 border border-slate-200 rounded-xl p-2.5 sm:p-4 lg:p-6 overflow-x-auto min-h-[360px] sm:min-h-[540px] xl:min-h-[680px] w-full min-w-0">
            <div ref={viewportInnerRef} className="w-full min-w-0">
              {previewMode === 'excel' ? (
                <ProformaExcelSimulator doc={doc} totals={totals} />
              ) : (
                <div
                  className="mx-auto transition-[width,height] duration-150"
                  style={{
                    width: `${Math.round(A4_WIDTH_PX * effectiveScale)}px`,
                    height: `${Math.round(sheetHeight * effectiveScale)}px`,
                  }}
                >
                  <div
                    id="printable-invoice"
                    ref={canvasRef}
                    style={{
                      width: `${A4_WIDTH_PX}px`,
                      transform: `scale(${effectiveScale})`,
                      transformOrigin: 'top left',
                    }}
                    className="relative min-h-[297mm] bg-white rounded-lg shadow-xl border border-slate-300 overflow-hidden flex flex-col justify-between text-slate-900"
                  >
                  <div>
                    {/* 1. Top Accent Strip */}
                    <div
                      style={{ backgroundColor: theme.primaryColor }}
                      className="h-2.5 w-full"
                    />

                    <div className="p-8 space-y-5">
                      {/* 2. Document Header */}
                      <div className="flex items-start justify-between gap-6 pb-4 border-b border-slate-200">
                        <button
                          type="button"
                          onClick={() => {
                            setActiveTab('parties');
                            setMobilePane('editor');
                          }}
                          title="Click to edit Seller details & logo"
                          className="flex items-start gap-3.5 text-left group rounded-lg -m-1.5 p-1.5 hover:bg-slate-50 transition-colors min-w-0"
                        >
                          {doc.sellerLogoUrl ? (
                            <img
                              src={doc.sellerLogoUrl}
                              alt={doc.sellerCompany}
                              className="w-11 h-11 rounded-lg object-contain border border-slate-200 bg-white shrink-0"
                            />
                          ) : (
                            <div
                              style={{ backgroundColor: theme.primaryColor }}
                              className="w-11 h-11 rounded-lg flex items-center justify-center text-white text-sm font-bold tracking-wide shrink-0 shadow-xs"
                            >
                              {isPacking ? 'PL' : 'PI'}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div
                              style={{ color: theme.primaryColor }}
                              className="text-lg font-bold uppercase tracking-tight leading-tight group-hover:underline"
                            >
                              {doc.sellerCompany}
                            </div>
                            <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-x-2">
                              {doc.sellerTaxId && (
                                <span className="font-['JetBrains_Mono',monospace]">
                                  Tax / VAT: {doc.sellerTaxId}
                                </span>
                              )}
                              {doc.sellerTaxId && doc.sellerWebsite && <span>·</span>}
                              {doc.sellerWebsite && <span>{doc.sellerWebsite}</span>}
                            </div>
                          </div>
                        </button>

                        <div className="text-right shrink-0">
                          <span
                            style={{
                              backgroundColor: theme.badgeBg,
                              color: theme.badgeText,
                            }}
                            className="inline-block px-3 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider"
                          >
                            {isPacking ? 'COMMERCIAL PACKING LIST' : 'PROFORMA INVOICE'}
                          </span>
                          <div className="mt-2 text-base font-bold font-['JetBrains_Mono',monospace] text-slate-900">
                            {activeDocNumber}
                          </div>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {doc.poReference
                              ? `PO Ref: ${doc.poReference}`
                              : isPacking
                                ? 'Packing Specification'
                                : 'Commercial Offer'}
                          </div>
                        </div>
                      </div>

                      {/* 3. 4-Column Metadata Highlights Bar */}
                      <div
                        style={{
                          backgroundColor: theme.primaryLight,
                          borderColor: theme.borderLight,
                        }}
                        className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-lg border px-4 py-3"
                      >
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Date of Issue
                          </div>
                          <div className="text-xs font-bold font-['JetBrains_Mono',monospace] text-slate-900 mt-0.5">
                            {doc.issueDate}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Valid Until
                          </div>
                          <div className="text-xs font-bold font-['JetBrains_Mono',monospace] text-slate-900 mt-0.5">
                            {doc.validUntil}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Incoterms 2020
                          </div>
                          <div className="text-xs font-bold text-slate-900 mt-0.5 truncate">
                            <span className="font-['JetBrains_Mono',monospace]">{doc.incoterm}</span>
                            {doc.incotermPlace ? ` (${doc.incotermPlace})` : ''}
                          </div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                            Invoice Currency
                          </div>
                          <div className="text-xs font-bold text-slate-900 mt-0.5">
                            {TRADE_CURRENCIES[doc.currency]?.name} ({doc.currency})
                          </div>
                        </div>
                      </div>

                      {/* 4. Two-Column Parties Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 space-y-1 min-w-0">
                          <div
                            style={{ color: theme.primaryColor }}
                            className="text-[10px] font-bold uppercase tracking-wider"
                          >
                            Seller / Exporter
                          </div>
                          <div className="text-xs font-bold uppercase text-slate-900 break-words">
                            {doc.sellerCompany}
                          </div>
                          {doc.sellerContact && (
                            <div className="text-xs text-slate-600">
                              Attn: {doc.sellerContact}
                            </div>
                          )}
                          <div className="text-xs text-slate-600 leading-relaxed break-words">
                            {doc.sellerAddress}
                          </div>
                          <div className="text-[11px] text-slate-500 pt-1 flex flex-wrap gap-x-2">
                            {doc.sellerEmail && <span>Email: {doc.sellerEmail}</span>}
                            {doc.sellerEmail && doc.sellerPhone && <span>·</span>}
                            {doc.sellerPhone && (
                              <span className="font-['JetBrains_Mono',monospace]">
                                Tel: {doc.sellerPhone}
                              </span>
                            )}
                          </div>
                          {doc.sellerTaxId && (
                            <div className="text-[11px] font-['JetBrains_Mono',monospace] text-slate-500">
                              Tax/VAT: {doc.sellerTaxId}
                            </div>
                          )}
                        </div>

                        <div className="rounded-lg border border-slate-200 bg-slate-50/60 p-3.5 space-y-1 min-w-0">
                          <div
                            style={{ color: theme.primaryColor }}
                            className="text-[10px] font-bold uppercase tracking-wider"
                          >
                            Buyer / Importer (Consignee)
                          </div>
                          <div className="text-xs font-bold uppercase text-slate-900 break-words">
                            {doc.buyerCompany || 'Consignee Company Name'}
                          </div>
                          {doc.buyerContact && (
                            <div className="text-xs text-slate-600">
                              Attn: {doc.buyerContact}
                            </div>
                          )}
                          <div className="text-xs text-slate-600 leading-relaxed break-words">
                            {[doc.buyerAddress, doc.buyerCountry].filter(Boolean).join(', ')}
                          </div>
                          <div className="text-[11px] text-slate-500 pt-1 flex flex-wrap gap-x-2">
                            {doc.buyerEmail && <span>Email: {doc.buyerEmail}</span>}
                            {doc.buyerEmail && doc.buyerPhone && <span>·</span>}
                            {doc.buyerPhone && (
                              <span className="font-['JetBrains_Mono',monospace]">
                                Tel: {doc.buyerPhone}
                              </span>
                            )}
                          </div>
                          {doc.buyerTaxId && (
                            <div className="text-[11px] font-['JetBrains_Mono',monospace] text-slate-500">
                              Tax/VAT: {doc.buyerTaxId}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 5. Shipping & Transport Specification Bar */}
                      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-700">
                        <div className="inline-flex items-center gap-1.5 font-semibold text-slate-900">
                          {renderTransportIcon(doc.transportMode)}
                          <span>
                            Mode:{' '}
                            {doc.transportMode === 'sea'
                              ? 'Ocean Freight'
                              : doc.transportMode === 'air'
                                ? 'Air Freight'
                                : doc.transportMode === 'truck'
                                  ? 'Land / Courier'
                                  : 'Multimodal'}
                          </span>
                        </div>
                        {doc.portOfLoading && (
                          <div>
                            <span className="text-slate-400">|</span>{' '}
                            <span className="font-semibold text-slate-700">Loading:</span>{' '}
                            {doc.portOfLoading}
                          </div>
                        )}
                        {doc.portOfDischarge && (
                          <div>
                            <span className="text-slate-400">|</span>{' '}
                            <span className="font-semibold text-slate-700">Discharge:</span>{' '}
                            {doc.portOfDischarge}
                          </div>
                        )}
                        <div>
                          <span className="text-slate-400">|</span>{' '}
                          <span className="font-semibold text-slate-700">Origin:</span>{' '}
                          {doc.countryOfOrigin || 'China'}
                        </div>
                      </div>

                      {/* 6. Line Items Table */}
                      <div className="rounded-lg border border-slate-200 overflow-hidden">
                        <table className="w-full border-collapse text-xs">
                          <thead>
                            <tr
                              style={{ backgroundColor: theme.primaryColor }}
                              className="text-white uppercase text-[10px] tracking-wider"
                            >
                              <th className="py-2.5 px-2.5 text-center w-8">#</th>
                              <th className="py-2.5 px-2.5 text-left">
                                Description & Technical Specifications
                              </th>
                              <th className="py-2.5 px-2 text-left">HS Code</th>
                              <th className="py-2.5 px-2 text-right">Cartons</th>
                              <th className="py-2.5 px-2 text-right">Units/Ctn</th>
                              <th className="py-2.5 px-2 text-right">Qty</th>
                              {isPacking ? (
                                <>
                                  <th className="py-2.5 px-2 text-right">Net Wt</th>
                                  <th className="py-2.5 px-2 text-right">Gross Wt</th>
                                  <th className="py-2.5 px-2.5 text-right">CBM</th>
                                </>
                              ) : (
                                <>
                                  <th className="py-2.5 px-2 text-right">Unit Price</th>
                                  <th className="py-2.5 px-2.5 text-right">Total</th>
                                </>
                              )}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {doc.items.map((item, idx) => {
                              const qty = getLineItemQuantity(item);
                              const lineTotal = qty * item.unitPrice;
                              const cbmPerCtn =
                                item.lengthCm > 0 && item.widthCm > 0 && item.heightCm > 0
                                  ? (item.lengthCm * item.widthCm * item.heightCm) / 1_000_000
                                  : 0;
                              const lineNet = item.cartons * item.netWeightPerCartonKg;
                              const lineGross = item.cartons * item.grossWeightPerCartonKg;
                              const lineCbm = item.cartons * cbmPerCtn;

                              return (
                                <tr
                                  key={item.id}
                                  className={idx % 2 === 1 ? 'bg-slate-50/60' : 'bg-white'}
                                >
                                  <td className="py-3 px-2.5 text-center font-['JetBrains_Mono',monospace] text-slate-500 align-middle">
                                    {idx + 1}
                                  </td>
                                  <td className="py-3 px-2.5 align-middle">
                                    <div className="flex items-center gap-2.5">
                                      {includeImagesColumn && item.imageUrl && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setLightboxImage({
                                              url: item.imageUrl || '',
                                              title: item.description,
                                            })
                                          }
                                          title="Click to inspect product photo"
                                          className="w-10 h-10 rounded border border-slate-200 bg-white overflow-hidden shrink-0 hover:ring-2 hover:ring-slate-400 transition-all"
                                        >
                                          <img
                                            src={item.imageUrl}
                                            alt={item.description}
                                            className="w-full h-full object-cover"
                                          />
                                        </button>
                                      )}
                                      <div className="min-w-0">
                                        <div className="font-semibold text-slate-900 leading-snug">
                                          {item.description}
                                        </div>
                                        {item.specifications && (
                                          <div className="text-[11px] text-slate-500 mt-0.5">
                                            {item.specifications}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-2 font-['JetBrains_Mono',monospace] text-[11px] text-slate-600 align-middle whitespace-nowrap">
                                    {item.hsCode || '—'}
                                  </td>
                                  <td className="py-3 px-2 text-right font-['JetBrains_Mono',monospace] tabular-nums font-semibold text-slate-900 align-middle">
                                    {item.cartons.toLocaleString('en-US')}
                                  </td>
                                  <td className="py-3 px-2 text-right font-['JetBrains_Mono',monospace] tabular-nums text-slate-700 align-middle">
                                    {item.unitsPerCarton.toLocaleString('en-US')}
                                  </td>
                                  <td className="py-3 px-2 text-right font-['JetBrains_Mono',monospace] tabular-nums text-slate-900 font-bold align-middle whitespace-nowrap">
                                    {qty.toLocaleString('en-US')}{' '}
                                    <span className="text-[10px] font-semibold">
                                      {item.unitLabel || 'units'}
                                    </span>
                                  </td>
                                  {isPacking ? (
                                    <>
                                      <td className="py-3 px-2 text-right font-['JetBrains_Mono',monospace] tabular-nums text-slate-700 align-middle whitespace-nowrap">
                                        {lineNet.toFixed(1)} kg
                                      </td>
                                      <td className="py-3 px-2 text-right font-['JetBrains_Mono',monospace] tabular-nums text-slate-700 align-middle whitespace-nowrap">
                                        {lineGross.toFixed(1)} kg
                                      </td>
                                      <td className="py-3 px-2.5 text-right font-['JetBrains_Mono',monospace] tabular-nums font-bold text-slate-900 align-middle whitespace-nowrap">
                                        {lineCbm.toFixed(2)} m³
                                      </td>
                                    </>
                                  ) : (
                                    <>
                                      <td className="py-3 px-2 text-right font-['JetBrains_Mono',monospace] tabular-nums text-slate-700 align-middle whitespace-nowrap">
                                        {formatTradeUnitPrice(item.unitPrice, doc.currency)}
                                      </td>
                                      <td className="py-3 px-2.5 text-right font-['JetBrains_Mono',monospace] tabular-nums font-bold text-slate-900 align-middle whitespace-nowrap">
                                        {formatTradeCurrency(lineTotal, doc.currency)}
                                      </td>
                                    </>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                          {totals.totalCartons > 0 && (
                            <tfoot>
                              <tr className="border-t border-slate-200 bg-slate-100/80 font-bold text-xs text-slate-700">
                                <td className="py-2.5 px-2.5 text-right" colSpan={3}>
                                  Total Cartons:
                                </td>
                                <td className="py-2.5 px-2 text-right font-['JetBrains_Mono',monospace] tabular-nums text-slate-900 whitespace-nowrap">
                                  {totals.totalCartons.toLocaleString('en-US')} CTN
                                </td>
                                <td className="py-2.5 px-2" />
                                <td className="py-2.5 px-2 text-right font-['JetBrains_Mono',monospace] tabular-nums text-slate-900 whitespace-nowrap">
                                  {isPacking ? `${totals.totalUnits.toLocaleString('en-US')} units` : ''}
                                </td>
                                {isPacking ? (
                                  <>
                                    <td className="py-2.5 px-2 text-right font-['JetBrains_Mono',monospace] tabular-nums whitespace-nowrap">
                                      {totals.totalNetWeightKg.toFixed(1)} kg
                                    </td>
                                    <td className="py-2.5 px-2 text-right font-['JetBrains_Mono',monospace] tabular-nums whitespace-nowrap">
                                      {totals.totalGrossWeightKg.toFixed(1)} kg
                                    </td>
                                    <td className="py-2.5 px-2.5 text-right font-['JetBrains_Mono',monospace] tabular-nums whitespace-nowrap">
                                      {totals.totalCbm.toFixed(2)} m³
                                    </td>
                                  </>
                                ) : (
                                  <>
                                    <td className="py-2.5 px-2" />
                                    <td className="py-2.5 px-2.5" />
                                  </>
                                )}
                              </tr>
                            </tfoot>
                          )}
                        </table>
                      </div>

                      {/* 7. Financial & Banking 12-Col Responsive Grid (or Packing Specs) */}
                      {!isPacking ? (
                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
                          {/* Left 7 Columns: Amount in Words & Bank Wire Details */}
                          <div className="md:col-span-7 space-y-3">
                            <div
                              style={{
                                backgroundColor: theme.primaryLight,
                                borderColor: theme.borderLight,
                              }}
                              className="rounded-lg border p-3.5"
                            >
                              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Amount in Words:
                              </div>
                              <div className="text-xs font-bold italic text-slate-900 mt-1 leading-snug">
                                {amountToWords(totals.grandTotal, doc.currency)}
                              </div>
                            </div>

                            <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3.5 space-y-1.5">
                              <div
                                style={{ color: theme.primaryColor }}
                                className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5"
                              >
                                <Landmark className="w-3 h-3" />
                                Bank Wire Remittance Instructions
                              </div>
                              <div className="grid grid-cols-1 gap-1 text-[11px] text-slate-700">
                                <div>
                                  <span className="text-slate-500">Beneficiary:</span>{' '}
                                  <span className="font-semibold text-slate-900">
                                    {doc.bankBeneficiary}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-500">Bank Name:</span>{' '}
                                  <span className="font-medium">{doc.bankName}</span>
                                </div>
                                <div className="font-['JetBrains_Mono',monospace]">
                                  <span className="text-slate-500 font-sans">SWIFT:</span>{' '}
                                  <span className="font-semibold text-slate-900">
                                    {doc.bankSwift}
                                  </span>{' '}
                                  · <span className="text-slate-500 font-sans">Account:</span>{' '}
                                  <span className="font-semibold text-slate-900">
                                    {doc.bankAccountNumber}
                                  </span>
                                </div>
                                {doc.intermediaryBank && (
                                  <div className="text-[11px] text-slate-600">
                                    <span className="text-slate-500">Intermediary Bank:</span>{' '}
                                    {doc.intermediaryBank}
                                    {doc.intermediarySwift ? ` (${doc.intermediarySwift})` : ''}
                                  </div>
                                )}
                                {doc.bankNote && (
                                  <div className="text-[10px] italic text-slate-500 pt-0.5">
                                    {doc.bankNote}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Right 5 Columns: Unified Financial Card matching reference PDF */}
                          <div className="md:col-span-5 space-y-2">
                            <div className="rounded-lg border border-slate-200 bg-white p-3.5 space-y-2.5">
                              <div className="space-y-1.5 pb-1">
                                <div className="flex justify-between text-xs text-slate-600">
                                  <span>Subtotal</span>
                                  <span className="font-['JetBrains_Mono',monospace] tabular-nums text-slate-900">
                                    {formatTradeCurrency(totals.subtotal, doc.currency)}
                                  </span>
                                </div>
                                {totals.freight > 0 && (
                                  <div className="flex justify-between text-xs text-slate-600">
                                    <span>Freight / Shipping</span>
                                    <span className="font-['JetBrains_Mono',monospace] tabular-nums text-slate-900">
                                      {formatTradeCurrency(totals.freight, doc.currency)}
                                    </span>
                                  </div>
                                )}
                                {totals.insurance > 0 && (
                                  <div className="flex justify-between text-xs text-slate-600">
                                    <span>Cargo Insurance</span>
                                    <span className="font-['JetBrains_Mono',monospace] tabular-nums text-slate-900">
                                      {formatTradeCurrency(totals.insurance, doc.currency)}
                                    </span>
                                  </div>
                                )}
                                {totals.taxAmount > 0 && (
                                  <div className="flex justify-between text-xs text-slate-600">
                                    <span>Tax ({doc.taxRatePct}%)</span>
                                    <span className="font-['JetBrains_Mono',monospace] tabular-nums text-slate-900">
                                      {formatTradeCurrency(totals.taxAmount, doc.currency)}
                                    </span>
                                  </div>
                                )}
                                {totals.discount > 0 && (
                                  <div className="flex justify-between text-xs text-rose-700">
                                    <span>Discount</span>
                                    <span className="font-['JetBrains_Mono',monospace] tabular-nums">
                                      -{formatTradeCurrency(totals.discount, doc.currency)}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* Solid primaryColor TOTAL DUE Banner */}
                              <div
                                style={{ backgroundColor: theme.primaryColor }}
                                className="flex items-center justify-between px-3 py-2.5 rounded-md text-white"
                              >
                                <span className="text-xs font-bold uppercase tracking-wide">
                                  Total Due ({doc.currency})
                                </span>
                                <span className="text-sm font-bold font-['JetBrains_Mono',monospace] tabular-nums">
                                  {formatTradeCurrency(totals.grandTotal, doc.currency)}
                                </span>
                              </div>

                              {doc.showDualRmbReference &&
                                doc.currency === 'USD' &&
                                usdToRmbRate && (
                                  <div className="text-[10px] text-right font-['JetBrains_Mono',monospace] text-slate-500">
                                    Ref RMB:{' '}
                                    {formatMoneyValue(
                                      convertUsdToRmb(totals.grandTotal, usdToRmbRate),
                                      'CNY'
                                    )}{' '}
                                    (@{formatExchangeRate(usdToRmbRate)})
                                  </div>
                                )}

                              {/* Payment Milestone Split (30% / 70% Feature) */}
                              {doc.showMilestoneSplit && (
                                <div className="pt-1 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                      Payment Schedule
                                    </span>
                                    <button
                                      type="button"
                                      onClick={handleCycleMilestoneSplit}
                                      title="Click to cycle split (30/70 → 50/50 → 20/80 → 40/60)"
                                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-800 text-[10px] font-bold font-['JetBrains_Mono',monospace] transition-colors cursor-pointer"
                                    >
                                      {doc.depositPct}% / {100 - doc.depositPct}%
                                    </button>
                                  </div>

                                  <div className="grid grid-cols-1 gap-1.5">
                                    <div className="rounded-md bg-blue-50/80 border border-blue-200 px-2.5 py-2 flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                                        <input
                                          type="text"
                                          value={doc.depositLabel}
                                          onChange={(e) => updateDoc('depositLabel', e.target.value)}
                                          className="flex-1 bg-transparent text-[10px] font-semibold text-blue-950 focus:outline-none focus:bg-white/80 rounded px-1 -ml-0.5 min-w-0"
                                        />
                                      </div>
                                      <span className="text-xs font-bold font-['JetBrains_Mono',monospace] tabular-nums text-blue-950 shrink-0">
                                        {formatTradeCurrency(totals.depositAmount, doc.currency)}
                                      </span>
                                    </div>

                                    <div className="rounded-md bg-emerald-50/80 border border-emerald-200 px-2.5 py-2 flex items-center justify-between gap-2">
                                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                                        <input
                                          type="text"
                                          value={doc.balanceLabel}
                                          onChange={(e) => updateDoc('balanceLabel', e.target.value)}
                                          className="flex-1 bg-transparent text-[10px] font-semibold text-emerald-950 focus:outline-none focus:bg-white/80 rounded px-1 -ml-0.5 min-w-0"
                                        />
                                      </div>
                                      <span className="text-xs font-bold font-['JetBrains_Mono',monospace] tabular-nums text-emerald-950 shrink-0">
                                        {formatTradeCurrency(totals.balanceAmount, doc.currency)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Inline-editable Pricing Footnote */}
                            <input
                              type="text"
                              value={doc.pricingFootnote}
                              onChange={(e) => updateDoc('pricingFootnote', e.target.value)}
                              placeholder="Add pricing footnote..."
                              className="w-full bg-transparent text-[10px] italic text-slate-500 px-1 py-0.5 rounded focus:outline-none focus:bg-slate-50 focus:ring-1 focus:ring-slate-200"
                            />
                          </div>
                        </div>
                      ) : (
                        /* Packing List Summary Block */
                        <div
                          style={{
                            backgroundColor: theme.primaryLight,
                            borderColor: theme.borderLight,
                          }}
                          className="rounded-lg border p-4 grid grid-cols-1 md:grid-cols-2 gap-4"
                        >
                          <div className="space-y-1">
                            <div
                              style={{ color: theme.primaryColor }}
                              className="text-[10px] font-bold uppercase tracking-wider"
                            >
                              Packing Specifications
                            </div>
                            <div className="text-xs text-slate-800">
                              <span className="text-slate-500">Package Type:</span>{' '}
                              <span className="font-semibold">{doc.packageType}</span>
                            </div>
                            <div className="text-xs text-slate-800">
                              <span className="text-slate-500">Lead Time:</span>{' '}
                              <span className="font-semibold">{doc.estimatedLeadTime}</span>
                            </div>
                            <div className="grid grid-cols-3 gap-2 pt-1.5 font-['JetBrains_Mono',monospace] text-xs">
                              <div className="bg-white/80 rounded px-2 py-1 border border-slate-200/70">
                                <div className="text-[9px] font-sans text-slate-500 uppercase">
                                  Total Net Wt
                                </div>
                                <div className="font-bold text-slate-900">
                                  {totals.totalNetWeightKg.toFixed(1)} kg
                                </div>
                              </div>
                              <div className="bg-white/80 rounded px-2 py-1 border border-slate-200/70">
                                <div className="text-[9px] font-sans text-slate-500 uppercase">
                                  Total Gross Wt
                                </div>
                                <div className="font-bold text-slate-900">
                                  {totals.totalGrossWeightKg.toFixed(1)} kg
                                </div>
                              </div>
                              <div className="bg-white/80 rounded px-2 py-1 border border-slate-200/70">
                                <div className="text-[9px] font-sans text-slate-500 uppercase">
                                  Total Volume
                                </div>
                                <div className="font-bold text-slate-900">
                                  {totals.totalCbm.toFixed(2)} m³
                                </div>
                              </div>
                            </div>
                          </div>

                          <div className="space-y-1">
                            <div
                              style={{ color: theme.primaryColor }}
                              className="text-[10px] font-bold uppercase tracking-wider"
                            >
                              Shipping Marks & Carton Labels
                            </div>
                            <pre className="text-xs font-['JetBrains_Mono',monospace] text-slate-800 bg-white/80 rounded border border-slate-200/80 p-2.5 whitespace-pre-wrap leading-relaxed">
                              {doc.shippingMarks}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* 8. Commercial Terms & Declarations + Authorized Signature Block */}
                      <div className="pt-2 space-y-5">
                        <div className="space-y-1.5">
                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-800">
                            Commercial Terms & Declarations
                          </div>
                          <ol className="list-decimal list-inside space-y-1 text-[11px] text-slate-600 leading-relaxed">
                            {doc.termsList.map((term, i) => (
                              <li key={i}>{term}</li>
                            ))}
                          </ol>
                        </div>

                        <div className="grid grid-cols-2 gap-10 pt-4">
                          <div>
                            <div className="text-[11px] text-slate-500 mb-10">
                              Accepted & Confirmed By (Buyer):
                            </div>
                            <div className="border-t border-slate-300 pt-1.5 text-xs font-semibold text-slate-900">
                              {doc.buyerSignatory || doc.buyerCompany}
                            </div>
                          </div>
                          <div>
                            <div className="text-[11px] text-slate-500 mb-10">
                              For and on behalf of (Seller):
                            </div>
                            <div className="border-t border-slate-300 pt-1.5 text-xs font-semibold text-slate-900">
                              {doc.authorizedSignatory || doc.sellerCompany}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Subtle Document Footer + Bottom Accent Strip */}
                  <div>
                    <div className="px-8 py-2.5 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                      <span>{doc.sellerCompany}</span>
                      <span className="font-['JetBrains_Mono',monospace]">
                        {activeDocNumber} · Page 1 of 1
                      </span>
                    </div>
                    <div style={{ backgroundColor: theme.primaryColor }} className="h-1.5 w-full" />
                  </div>

                  {/* 9. Interactive Draggable Company Stamp / Seal Overlay */}
                  {doc.stampEnabled && stampPreviewDataUrl && (
                    <div
                      onPointerDown={handleStampPointerDown}
                      onPointerMove={handleStampPointerMove}
                      onPointerUp={handleStampPointerUp}
                      style={{
                        left: `${doc.stampXPercent}%`,
                        top: `${doc.stampYPercent}%`,
                        width: `${122 * Math.max(0.6, Math.min(1.5, doc.stampScale || 1))}px`,
                        height: `${122 * Math.max(0.6, Math.min(1.5, doc.stampScale || 1))}px`,
                      }}
                      title="Drag to reposition company stamp on PDF & preview"
                      className={`absolute -translate-x-1/2 -translate-y-1/2 z-20 touch-none select-none group rounded-full ${
                        isDraggingStamp ? 'cursor-grabbing scale-[1.03]' : 'cursor-grab'
                      }`}
                    >
                      <img
                        src={stampPreviewDataUrl}
                        alt="Company Stamp Seal"
                        draggable={false}
                        className="w-full h-full object-contain pointer-events-none opacity-90 mix-blend-multiply"
                      />
                      <div className="no-print opacity-0 group-hover:opacity-100 transition-opacity absolute inset-0 rounded-full border-2 border-dashed border-slate-400/70 flex items-end justify-center pb-1 pointer-events-none">
                        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-900/80 text-white text-[9px] font-semibold">
                          <Move className="w-2.5 h-2.5" />
                          Drag
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Product Thumbnail Lightbox Modal */}
      {lightboxImage && (
        <div
          className="no-print fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="bg-white rounded-xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
              <div className="text-xs font-bold text-slate-900 truncate pr-4">
                {lightboxImage.title}
              </div>
              <button
                type="button"
                onClick={() => setLightboxImage(null)}
                className="p-1 text-slate-400 hover:text-slate-700 rounded"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 flex items-center justify-center">
              <img
                src={lightboxImage.url}
                alt={lightboxImage.title}
                className="max-h-[65vh] rounded-lg object-contain bg-white border border-slate-200"
              />
            </div>
          </div>
        </div>
      )}

      {/* Incoterms 2020 Quick Reference Modal */}
      <IncotermsModal
        open={incotermsModalOpen}
        activeCode={doc.incoterm}
        onClose={() => setIncotermsModalOpen(false)}
        onSelect={(code) => {
          updateDoc('incoterm', code);
          showToast(`Applied Incoterm: ${code}`);
        }}
      />
    </div>
  );
}

export default ProformaInvoiceView;
