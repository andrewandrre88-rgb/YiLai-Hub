import { ChangeEvent, FormEvent, useMemo, useRef, useState } from 'react';
import {
  Edit3,
  LayoutGrid,
  List,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  CATEGORY_META,
  CurrencyCode,
  Factory,
  ImageKey,
  Product,
  ProductCategory,
  ProductInput,
  convertRmbToUsd,
  convertUsdToRmb,
  formatCount,
  formatExchangeRate,
  formatUnitPriceValue,
  getProductPricing,
} from '../types/hub';
import { DualPrice } from './DualPrice';
import { ProductImage } from './ProductImage';

interface ProductsViewProps {
  products: Product[];
  factories: Factory[];
  loading: boolean;
  currency: CurrencyCode;
  usdToRmbRate: number | null;
  onSaveProduct: (input: ProductInput, existingId?: string) => Promise<string>;
  onDeleteProduct: (productId: string) => Promise<void>;
  onQuickOrderProduct: (product: Product) => void;
}

const CATEGORY_TABS: Array<{ id: 'all' | ProductCategory; label: string }> = [
  { id: 'all', label: 'All Products' },
  { id: 'trigger_sprayer', label: 'Trigger Sprayers' },
  { id: 'lotion_pump', label: 'Lotion Pumps' },
  { id: 'fine_mist_sprayer', label: 'Fine Mist' },
  { id: 'foam_pump', label: 'Foam Pumps' },
  { id: 'cap_closure', label: 'Caps & Closures' },
];

export function ProductsView({
  products,
  factories,
  loading,
  currency,
  usdToRmbRate,
  onSaveProduct,
  onDeleteProduct,
  onQuickOrderProduct,
}: ProductsViewProps) {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | ProductCategory>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.sku.toLowerCase().includes(q) ||
        p.neckSize.toLowerCase().includes(q) ||
        p.colorFinish.toLowerCase().includes(q) ||
        (p.factoryName || '').toLowerCase().includes(q)
      );
    });
  }, [products, categoryFilter, search]);

  const openCreateModal = () => {
    setEditingProduct(null);
    setModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setEditingProduct(product);
    setModalOpen(true);
  };

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteProduct(id);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {CATEGORY_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setCategoryFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                categoryFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search SKU, neck size, finish..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="flex items-center p-1 bg-slate-100 rounded-lg shrink-0">
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-label="Table view"
              className={`p-1.5 rounded-md cursor-pointer ${
                viewMode === 'table' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
              className={`p-1.5 rounded-md cursor-pointer ${
                viewMode === 'grid' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>

          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Product</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-14 px-4 flex items-center gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-md bg-slate-100" />
              <div className="h-3 w-44 bg-slate-100 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-14 px-6 text-center">
          <p className="text-sm font-semibold text-slate-900">
            {products.length === 0
              ? 'No dispensing products saved yet'
              : 'No products match your search or category filter'}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {products.length === 0
              ? 'Save your trigger sprayers, lotion pumps, and fine mist sprayers along with their factory cost and wholesale price in USD & RMB.'
              : 'Try clearing the search input or switching back to All Products.'}
          </p>
          {products.length === 0 && (
            <button
              type="button"
              onClick={openCreateModal}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Product</span>
            </button>
          )}
        </div>
      ) : viewMode === 'table' ? (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 tracking-wide">
                  <th className="py-3 px-4">Product</th>
                  <th className="py-3 px-3">SKU</th>
                  <th className="py-3 px-3">Spec & Neck</th>
                  <th className="py-3 px-3 text-right">MOQ / Ctn</th>
                  <th className="py-3 px-3 text-right">Factory (RMB / USD)</th>
                  <th className="py-3 px-3 text-right">Selling (USD / RMB)</th>
                  <th className="py-3 px-3 text-right">Margin</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((product) => {
                  const pricing = getProductPricing(product, usdToRmbRate);
                  const marginPct = pricing.marginPct;
                  const marginPositive = (pricing.profitUsd ?? 0) >= 0;
                  return (
                    <tr key={product.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-2.5 px-4">
                        <div className="flex items-center gap-3">
                          <ProductImage
                            imageKey={product.imageKey}
                            imageUrl={product.imageUrl}
                            alt={product.name}
                            className="w-10 h-10 rounded-md border border-slate-200 shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate max-w-[230px]">
                              {product.name}
                            </p>
                            <p className="text-[11px] text-slate-500 truncate max-w-[230px]">
                              {CATEGORY_META[product.category].shortLabel}
                              {product.colorFinish ? ` · ${product.colorFinish}` : ''}
                              {product.factoryName ? ` · ${product.factoryName}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 px-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {product.sku}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 whitespace-nowrap">
                        <span className="font-mono tabular-nums font-medium text-slate-800">
                          {product.neckSize}
                        </span>
                        {product.dosage && (
                          <span className="text-slate-500"> · {product.dosage}</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        <p>
                          {formatCount(product.moq)} / {formatCount(product.cartonQty)}
                        </p>
                        {((product.boxLengthCm ?? 0) > 0 ||
                          (product.boxWidthCm ?? 0) > 0 ||
                          (product.boxHeightCm ?? 0) > 0 ||
                          (product.grossWeightKg ?? 0) > 0 ||
                          (product.netWeightKg ?? 0) > 0) && (
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            {(product.boxLengthCm ?? 0) > 0 &&
                            (product.boxWidthCm ?? 0) > 0 &&
                            (product.boxHeightCm ?? 0) > 0
                              ? `${product.boxLengthCm}×${product.boxWidthCm}×${product.boxHeightCm}cm`
                              : ''}
                            {(product.grossWeightKg ?? 0) > 0 || (product.netWeightKg ?? 0) > 0
                              ? `${
                                  (product.boxLengthCm ?? 0) > 0 ? ' · ' : ''
                                }GW ${product.grossWeightKg ?? 0} / NW ${product.netWeightKg ?? 0}kg`
                              : ''}
                          </p>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <DualPrice
                          rmbAmount={pricing.factoryRmb}
                          usdAmount={pricing.factoryUsd}
                          primaryCurrency={currency}
                          unit
                          align="right"
                          primaryClassName="font-medium text-slate-800"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <DualPrice
                          rmbAmount={pricing.sellingRmb}
                          usdAmount={pricing.sellingUsd}
                          primaryCurrency={currency}
                          unit
                          align="right"
                        />
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            marginPositive ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {marginPct.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        {confirmDeleteId === product.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmDelete(product.id)}
                              disabled={deletingId === product.id}
                              className="px-2 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded cursor-pointer"
                            >
                              {deletingId === product.id ? 'Removing...' : 'Confirm'}
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(null)}
                              className="px-2 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-100 rounded cursor-pointer"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => onQuickOrderProduct(product)}
                              title="Create order with this product"
                              className="p-1.5 text-teal-700 hover:bg-teal-50 rounded-md cursor-pointer"
                            >
                              <ShoppingBag className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(product)}
                              title="Edit product"
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(product.id)}
                              title="Delete product"
                              className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((product) => {
            const pricing = getProductPricing(product, usdToRmbRate);
            const marginPct = pricing.marginPct;
            return (
              <div
                key={product.id}
                className="bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="aspect-[4/3] w-full overflow-hidden border-b border-slate-100">
                    <ProductImage
                      imageKey={product.imageKey}
                      imageUrl={product.imageUrl}
                      alt={product.name}
                      className="w-full h-full"
                    />
                  </div>
                  <div className="p-4 space-y-2.5">
                    <div>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">
                        {product.sku} · {product.neckSize}
                        {product.dosage ? ` · ${product.dosage}` : ''}
                      </p>
                      <h3 className="text-sm font-semibold text-slate-900 mt-0.5 line-clamp-2">
                        {product.name}
                      </h3>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {CATEGORY_META[product.category].shortLabel}
                        {product.colorFinish ? ` · ${product.colorFinish}` : ''}
                        {product.factoryName ? ` · ${product.factoryName}` : ''}
                      </p>
                      {((product.boxLengthCm ?? 0) > 0 ||
                        (product.grossWeightKg ?? 0) > 0 ||
                        (product.netWeightKg ?? 0) > 0) && (
                        <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-1 truncate">
                          {(product.boxLengthCm ?? 0) > 0 &&
                          (product.boxWidthCm ?? 0) > 0 &&
                          (product.boxHeightCm ?? 0) > 0
                            ? `Box ${product.boxLengthCm}×${product.boxWidthCm}×${product.boxHeightCm}cm`
                            : ''}
                          {(product.grossWeightKg ?? 0) > 0 || (product.netWeightKg ?? 0) > 0
                            ? `${
                                (product.boxLengthCm ?? 0) > 0 ? ' · ' : ''
                              }GW ${product.grossWeightKg ?? 0}kg / NW ${product.netWeightKg ?? 0}kg`
                            : ''}
                        </p>
                      )}
                    </div>

                    <div className="pt-2 border-t border-slate-100 grid grid-cols-3 gap-2 text-xs items-start">
                      <div>
                        <p className="text-[11px] text-slate-500 mb-0.5">Factory</p>
                        <DualPrice
                          rmbAmount={pricing.factoryRmb}
                          usdAmount={pricing.factoryUsd}
                          primaryCurrency={currency}
                          unit
                          primaryClassName="font-medium text-slate-700"
                        />
                      </div>
                      <div>
                        <p className="text-[11px] text-slate-500 mb-0.5">Selling</p>
                        <DualPrice
                          rmbAmount={pricing.sellingRmb}
                          usdAmount={pricing.sellingUsd}
                          primaryCurrency={currency}
                          unit
                        />
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] text-slate-500 mb-0.5">Margin</p>
                        <p
                          className={`font-mono tabular-nums font-semibold ${
                            marginPct >= 0 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          {marginPct.toFixed(1)}%
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="px-4 py-3 bg-slate-50/70 border-t border-slate-100 flex items-center justify-between text-xs">
                  <span className="font-mono tabular-nums text-slate-600">
                    MOQ {formatCount(product.moq)} · Ctn {formatCount(product.cartonQty)}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => openEditModal(product)}
                      className="px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200/70 rounded-md cursor-pointer"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => onQuickOrderProduct(product)}
                      className="px-2.5 py-1 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md cursor-pointer"
                    >
                      Order
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <ProductFormModal
          initial={editingProduct}
          factories={factories}
          currency={currency}
          usdToRmbRate={usdToRmbRate}
          onClose={() => setModalOpen(false)}
          onSave={onSaveProduct}
        />
      )}
    </div>
  );
}

interface ProductFormModalProps {
  initial: Product | null;
  factories: Factory[];
  currency: CurrencyCode;
  usdToRmbRate: number | null;
  onClose: () => void;
  onSave: (input: ProductInput, existingId?: string) => Promise<string>;
}

function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Unsupported or corrupted image file.'));
      img.onload = () => {
        const maxDim = 640;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const width = Math.max(1, Math.round(img.width * scale));
        const height = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas image compression unavailable.'));
          return;
        }
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        if (dataUrl.length > 250000) {
          dataUrl = canvas.toDataURL('image/jpeg', 0.6);
        }
        if (dataUrl.length > 290000) {
          reject(new Error('Image is too large after compression. Please choose a smaller photo.'));
          return;
        }
        resolve(dataUrl);
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

function ProductFormModal({
  initial,
  factories,
  usdToRmbRate,
  onClose,
  onSave,
}: ProductFormModalProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [sku, setSku] = useState(initial?.sku || '');
  const [name, setName] = useState(initial?.name || '');
  const [category, setCategory] = useState<ProductCategory>(
    initial?.category || 'trigger_sprayer'
  );
  const [neckSize, setNeckSize] = useState(initial?.neckSize || '28/410');
  const [dosage, setDosage] = useState(initial?.dosage || '1.20 cc');
  const [colorFinish, setColorFinish] = useState(initial?.colorFinish || 'White / Natural');

  const initialPricing = initial ? getProductPricing(initial, usdToRmbRate) : null;
  const [factoryPrice, setFactoryPrice] = useState(
    initialPricing ? String(Number(initialPricing.factoryRmb.toFixed(4))) : '1.00'
  );
  const [sellingPrice, setSellingPrice] = useState(
    initialPricing && initialPricing.sellingUsd !== null
      ? String(Number(initialPricing.sellingUsd.toFixed(4)))
      : '0.25'
  );
  const [moq, setMoq] = useState(initial ? String(initial.moq) : '10000');
  const [cartonQty, setCartonQty] = useState(initial ? String(initial.cartonQty) : '500');
  const [boxLengthCm, setBoxLengthCm] = useState(
    initial?.boxLengthCm ? String(initial.boxLengthCm) : ''
  );
  const [boxWidthCm, setBoxWidthCm] = useState(
    initial?.boxWidthCm ? String(initial.boxWidthCm) : ''
  );
  const [boxHeightCm, setBoxHeightCm] = useState(
    initial?.boxHeightCm ? String(initial.boxHeightCm) : ''
  );
  const [grossWeightKg, setGrossWeightKg] = useState(
    initial?.grossWeightKg ? String(initial.grossWeightKg) : ''
  );
  const [netWeightKg, setNetWeightKg] = useState(
    initial?.netWeightKg ? String(initial.netWeightKg) : ''
  );
  const [imageKey, setImageKey] = useState<ImageKey>(
    initial?.imageKey || 'trigger_sprayer'
  );
  const [imageUrl, setImageUrl] = useState(initial?.imageUrl || '');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [factoryId, setFactoryId] = useState(initial?.factoryId || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const factoryRmb = Math.max(0, Number(factoryPrice) || 0);
  const sellingUsd = Math.max(0, Number(sellingPrice) || 0);
  const factoryUsd = convertRmbToUsd(factoryRmb, usdToRmbRate);
  const sellingRmb = convertUsdToRmb(sellingUsd, usdToRmbRate);

  const liveProfitPerUnitUsd = factoryUsd !== null ? sellingUsd - factoryUsd : null;
  const liveProfitPerUnitRmb = sellingRmb !== null ? sellingRmb - factoryRmb : null;
  const liveMarginPct =
    sellingUsd > 0 && liveProfitPerUnitUsd !== null
      ? (liveProfitPerUnitUsd / sellingUsd) * 100
      : 0;

  const lNum = Math.max(0, Number(boxLengthCm) || 0);
  const wNum = Math.max(0, Number(boxWidthCm) || 0);
  const hNum = Math.max(0, Number(boxHeightCm) || 0);
  const cbmPerCarton = lNum > 0 && wNum > 0 && hNum > 0 ? (lNum * wNum * hNum) / 1000000 : 0;

  const handleCategoryChange = (nextCat: ProductCategory) => {
    setCategory(nextCat);
    if (!initial) {
      setImageKey(CATEGORY_META[nextCat].imageKey);
      if (nextCat === 'trigger_sprayer') {
        setNeckSize('28/410');
        setDosage('1.20 cc');
      } else if (nextCat === 'lotion_pump') {
        setNeckSize('24/410');
        setDosage('2.00 cc');
      } else if (nextCat === 'fine_mist_sprayer') {
        setNeckSize('20/410');
        setDosage('0.12 ml');
      } else if (nextCat === 'foam_pump') {
        setNeckSize('43/410');
        setDosage('0.80 ml');
      }
    }
  };

  const handleImageFileSelect = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingImage(true);
    setError(null);
    try {
      const compressed = await compressImageFile(file);
      setImageUrl(compressed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to process image.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!sku.trim() || !name.trim() || !neckSize.trim()) {
      setError('SKU, Product Name, and Neck Size are required.');
      return;
    }
    if (imageUrl.trim().length > 300000) {
      setError('Product image data exceeds maximum allowed size.');
      return;
    }
    setSaving(true);
    setError(null);
    const selectedFactory = factories.find((f) => f.id === factoryId);
    const resolvedFactoryName = selectedFactory
      ? selectedFactory.factoryName
      : factoryId && initial?.factoryId === factoryId
        ? initial.factoryName || ''
        : '';

    try {
      await onSave(
        {
          sku: sku.trim(),
          name: name.trim(),
          category,
          neckSize: neckSize.trim(),
          dosage: dosage.trim(),
          colorFinish: colorFinish.trim(),
          factoryPrice: Number(factoryRmb.toFixed(4)),
          sellingPrice: Number(sellingUsd.toFixed(4)),
          moq: Math.max(1, Math.round(Number(moq) || 1000)),
          cartonQty: Math.max(1, Math.round(Number(cartonQty) || 500)),
          imageKey,
          imageUrl: imageUrl.trim(),
          boxLengthCm: Math.max(0, Number(boxLengthCm) || 0),
          boxWidthCm: Math.max(0, Number(boxWidthCm) || 0),
          boxHeightCm: Math.max(0, Number(boxHeightCm) || 0),
          grossWeightKg: Math.max(0, Number(grossWeightKg) || 0),
          netWeightKg: Math.max(0, Number(netWeightKg) || 0),
          factoryId: factoryId.trim(),
          factoryName: resolvedFactoryName,
          notes: notes.trim(),
        },
        initial?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save product.');
      setSaving(false);
    }
  };

  const isUploadedDataUrl = imageUrl.startsWith('data:');

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-lg my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            {initial ? 'Edit Dispensing Product' : 'Add Dispensing Product'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <ProductImage
              imageKey={imageKey}
              imageUrl={imageUrl}
              alt={name || 'Product photo preview'}
              className="w-20 h-20 rounded-lg border border-slate-200 shrink-0"
            />
            <div className="flex-1 w-full space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">Product Image</span>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingImage}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingImage ? 'Processing...' : 'Upload Image'}</span>
                  </button>
                  {imageUrl && (
                    <button
                      type="button"
                      onClick={() => setImageUrl('')}
                      className="px-2.5 py-1.5 text-xs font-medium text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  {isUploadedDataUrl ? (
                    <div className="px-3 py-1.5 text-xs bg-white border border-emerald-200 text-emerald-800 rounded-md font-medium">
                      Custom photo uploaded & ready
                    </div>
                  ) : (
                    <input
                      type="url"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      placeholder="Or paste image URL (https://...)"
                      className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                  )}
                </div>
                <div>
                  <select
                    value={imageKey}
                    onChange={(e) => setImageKey(e.target.value as ImageKey)}
                    aria-label="Fallback photo style"
                    className="w-full px-3 py-1.5 text-xs border border-slate-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                  >
                    <option value="trigger_sprayer">Default: Trigger Sprayer</option>
                    <option value="lotion_pump">Default: Lotion Pump</option>
                    <option value="fine_mist_sprayer">Default: Fine Mist</option>
                    <option value="foam_pump">Default: Foam Pump</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => handleCategoryChange(e.target.value as ProductCategory)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              >
                <option value="trigger_sprayer">Trigger Sprayers</option>
                <option value="lotion_pump">Lotion Pumps</option>
                <option value="fine_mist_sprayer">Fine Mist Sprayers</option>
                <option value="foam_pump">Foam & Treatment Pumps</option>
                <option value="cap_closure">Caps & Closures</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                SKU / Mold Code
              </label>
              <input
                type="text"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. YL-TRG-28410"
                maxLength={64}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Product Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Heavy Duty 28/410 Trigger Sprayer (Stream/Spray/Off)"
              maxLength={140}
              required
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Neck Size</label>
              <input
                type="text"
                value={neckSize}
                onChange={(e) => setNeckSize(e.target.value)}
                placeholder="28/410"
                maxLength={32}
                required
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Dosage / Output
              </label>
              <input
                type="text"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                placeholder="1.20 cc / 0.12 ml"
                maxLength={32}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Color / Finish
              </label>
              <input
                type="text"
                value={colorFinish}
                onChange={(e) => setColorFinish(e.target.value)}
                placeholder="White / Matte Silver"
                maxLength={64}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">
                Unit Pricing (Factory in RMB · Sell in USD · Rate: 1 USD = ¥{formatExchangeRate(usdToRmbRate)} RMB)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Factory (RMB ¥ / pc)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={factoryPrice}
                  onChange={(e) => setFactoryPrice(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
                <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-1">
                  ≈ {formatUnitPriceValue(factoryUsd, 'USD')} USD
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Sell (USD $ / pc)
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0"
                  value={sellingPrice}
                  onChange={(e) => setSellingPrice(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
                <p className="text-[11px] font-mono tabular-nums text-slate-500 mt-1">
                  ≈ {formatUnitPriceValue(sellingRmb, 'CNY')} RMB
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between text-xs pt-2 border-t border-slate-200/80">
              <span className="text-slate-600">Estimated Unit Gross Profit</span>
              <span
                className={`font-mono tabular-nums font-semibold ${
                  (liveProfitPerUnitUsd ?? 0) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                }`}
              >
                {formatUnitPriceValue(liveProfitPerUnitUsd, 'USD')} /{' '}
                {formatUnitPriceValue(liveProfitPerUnitRmb, 'CNY')} RMB / pc ·{' '}
                {liveMarginPct.toFixed(1)}%
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">MOQ (pcs)</label>
              <input
                type="number"
                min="1"
                step="1"
                value={moq}
                onChange={(e) => setMoq(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Carton Packing (pcs / box)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={cartonQty}
                onChange={(e) => setCartonQty(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-slate-800">
                Box Dimensions & Weight (Export Carton)
              </span>
              {cbmPerCarton > 0 && (
                <span className="text-[11px] font-mono tabular-nums font-semibold text-teal-800">
                  {cbmPerCarton.toFixed(4)} CBM / ctn
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Length (cm)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="0.1"
                  value={boxLengthCm}
                  onChange={(e) => setBoxLengthCm(e.target.value)}
                  placeholder="56"
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Width (cm)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="0.1"
                  value={boxWidthCm}
                  onChange={(e) => setBoxWidthCm(e.target.value)}
                  placeholder="38"
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Height (cm)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="0.1"
                  value={boxHeightCm}
                  onChange={(e) => setBoxHeightCm(e.target.value)}
                  placeholder="42"
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  G.W. (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="0.01"
                  value={grossWeightKg}
                  onChange={(e) => setGrossWeightKg(e.target.value)}
                  placeholder="12.8"
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  N.W. (kg)
                </label>
                <input
                  type="number"
                  min="0"
                  max="10000"
                  step="0.01"
                  value={netWeightKg}
                  onChange={(e) => setNetWeightKg(e.target.value)}
                  placeholder="11.6"
                  className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Supplier Factory (optional)
            </label>
            <select
              value={factoryId}
              onChange={(e) => setFactoryId(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            >
              <option value="">No factory assigned</option>
              {factories.map((fac) => (
                <option key={fac.id} value={fac.id}>
                  {fac.factoryName}
                  {fac.location ? ` (${fac.location})` : ''}
                </option>
              ))}
              {factoryId && !factories.some((f) => f.id === factoryId) && initial?.factoryName && (
                <option value={factoryId}>{initial.factoryName}</option>
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Factory & Dip Tube Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              placeholder="Spring material, dip tube length range, supplier factory reference..."
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
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
              {saving ? 'Saving...' : initial ? 'Update Product' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
