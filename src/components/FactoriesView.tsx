import { FormEvent, useMemo, useState } from 'react';
import {
  Check,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  Factory as FactoryIcon,
  MapPin,
  MessageSquare,
  Package,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import {
  CATEGORY_META,
  CurrencyCode,
  Factory,
  FactoryInput,
  Product,
  formatCount,
  getProductPricing,
  getWhatsappUrl,
} from '../types/hub';
import { DualPrice } from './DualPrice';

interface FactoriesViewProps {
  factories: Factory[];
  products: Product[];
  loading: boolean;
  currency: CurrencyCode;
  usdToRmbRate: number | null;
  onSaveFactory: (input: FactoryInput, existingId?: string) => Promise<string>;
  onDeleteFactory: (factoryId: string) => Promise<void>;
  onNavigateToProducts: () => void;
}

export function FactoriesView({
  factories,
  products,
  loading,
  currency,
  usdToRmbRate,
  onSaveFactory,
  onDeleteFactory,
  onNavigateToProducts,
}: FactoriesViewProps) {
  const [search, setSearch] = useState('');
  const [editingFactory, setEditingFactory] = useState<Factory | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedFactory, setSelectedFactory] = useState<Factory | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const productsByFactory = useMemo(() => {
    const map = new Map<string, Product[]>();
    for (const prod of products) {
      if (!prod.factoryId) continue;
      const list = map.get(prod.factoryId) || [];
      list.push(prod);
      map.set(prod.factoryId, list);
    }
    return map;
  }, [products]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return factories;
    return factories.filter(
      (f) =>
        f.factoryName.toLowerCase().includes(q) ||
        f.contactPerson.toLowerCase().includes(q) ||
        f.contactPhone.toLowerCase().includes(q) ||
        f.location.toLowerCase().includes(q) ||
        f.specialty.toLowerCase().includes(q)
    );
  }, [factories, search]);

  const handleCopyContact = async (factory: Factory) => {
    if (!factory.contactPhone) return;
    try {
      await navigator.clipboard.writeText(factory.contactPhone);
      setCopiedId(factory.id);
      setTimeout(() => setCopiedId((prev) => (prev === factory.id ? null : prev)), 1800);
    } catch {
      // Clipboard fallback ignored
    }
  };

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteFactory(id);
      setConfirmDeleteId(null);
      if (selectedFactory?.id === id) {
        setSelectedFactory(null);
      }
    } finally {
      setDeletingId(null);
    }
  };

  const activeSelectedFactory = selectedFactory
    ? factories.find((f) => f.id === selectedFactory.id) || null
    : null;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search factory, location, specialty, contact..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingFactory(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Factory</span>
        </button>
      </div>

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {[1, 2, 3].map((row) => (
            <div key={row} className="h-14 px-4 flex items-center gap-4 animate-pulse">
              <div className="h-3 w-48 bg-slate-100 rounded" />
              <div className="h-3 w-32 bg-slate-100 rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-14 px-6 text-center">
          <p className="text-sm font-semibold text-slate-900">
            {factories.length === 0
              ? 'No manufacturing factories saved yet'
              : 'No factories match your search'}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {factories.length === 0
              ? 'Save your trigger sprayer, lotion pump, and atomizer partner factories with lead times, payment terms, and linked product SKUs.'
              : 'Try adjusting your search keywords.'}
          </p>
          {factories.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setEditingFactory(null);
                setModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Factory</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 tracking-wide">
                  <th className="py-3 px-4">Factory & Specialty</th>
                  <th className="py-3 px-3">Contact & Phone / WeChat</th>
                  <th className="py-3 px-3">Location</th>
                  <th className="py-3 px-3 text-right">Lead Time</th>
                  <th className="py-3 px-3 text-right">Linked SKUs</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((factory) => {
                  const linked = productsByFactory.get(factory.id) || [];
                  const isNumericPhone =
                    Boolean(factory.contactPhone) &&
                    !/[a-zA-Z]/.test(factory.contactPhone) &&
                    factory.contactPhone.replace(/[^\d]/g, '').length >= 8;
                  const waUrl = isNumericPhone
                    ? getWhatsappUrl(
                        factory.contactPhone,
                        `Hello ${factory.contactPerson}, checking production status from Yi Lai Hub.`
                      )
                    : '';

                  return (
                    <tr
                      key={factory.id}
                      onClick={() => setSelectedFactory(factory)}
                      className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{factory.factoryName}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate max-w-[260px]">
                          {factory.specialty || 'Dispensing Components'}
                          {factory.paymentTerms ? ` · ${factory.paymentTerms}` : ''}
                        </p>
                      </td>

                      <td
                        className="py-3 px-3 whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <p className="font-medium text-slate-800">{factory.contactPerson}</p>
                        {factory.contactPhone ? (
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono tabular-nums text-[11px] text-slate-600">
                              {factory.contactPhone}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleCopyContact(factory)}
                              title="Copy phone / WeChat"
                              className="p-0.5 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                            >
                              {copiedId === factory.id ? (
                                <Check className="w-3 h-3 text-emerald-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </button>
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded whitespace-nowrap"
                              >
                                <MessageSquare className="w-2.5 h-2.5" />
                                <span>Chat</span>
                                <ExternalLink className="w-2 h-2" />
                              </a>
                            )}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400">No phone / WeChat</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {factory.location || '—'}
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {factory.leadTimeDays} days
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums whitespace-nowrap">
                        <span
                          className={`font-semibold ${
                            linked.length > 0 ? 'text-teal-800' : 'text-slate-400'
                          }`}
                        >
                          {linked.length}
                        </span>
                      </td>

                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {confirmDeleteId === factory.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmDelete(factory.id)}
                              disabled={deletingId === factory.id}
                              className="px-2 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded cursor-pointer"
                            >
                              {deletingId === factory.id ? 'Removing...' : 'Confirm'}
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
                              onClick={() => setSelectedFactory(factory)}
                              className="px-2 py-1 text-[11px] font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md cursor-pointer"
                            >
                              Details
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingFactory(factory);
                                setModalOpen(true);
                              }}
                              title="Edit factory"
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(factory.id)}
                              title="Delete factory"
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
      )}

      {modalOpen && (
        <FactoryFormModal
          initial={editingFactory}
          onClose={() => setModalOpen(false)}
          onSave={onSaveFactory}
        />
      )}

      {activeSelectedFactory && (
        <FactoryDetailDrawer
          factory={activeSelectedFactory}
          linkedProducts={productsByFactory.get(activeSelectedFactory.id) || []}
          currency={currency}
          usdToRmbRate={usdToRmbRate}
          onClose={() => setSelectedFactory(null)}
          onEdit={() => {
            setEditingFactory(activeSelectedFactory);
            setModalOpen(true);
          }}
          onNavigateToProducts={onNavigateToProducts}
        />
      )}
    </div>
  );
}

interface FactoryFormModalProps {
  initial: Factory | null;
  onClose: () => void;
  onSave: (input: FactoryInput, existingId?: string) => Promise<string>;
}

function FactoryFormModal({ initial, onClose, onSave }: FactoryFormModalProps) {
  const [factoryName, setFactoryName] = useState(initial?.factoryName || '');
  const [contactPerson, setContactPerson] = useState(initial?.contactPerson || '');
  const [contactPhone, setContactPhone] = useState(initial?.contactPhone || '');
  const [location, setLocation] = useState(initial?.location || '');
  const [specialty, setSpecialty] = useState(initial?.specialty || '');
  const [leadTimeDays, setLeadTimeDays] = useState(
    initial ? String(initial.leadTimeDays) : '18'
  );
  const [paymentTerms, setPaymentTerms] = useState(
    initial?.paymentTerms || '30% deposit, 70% before shipment'
  );
  const [notes, setNotes] = useState(initial?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!factoryName.trim() || !contactPerson.trim()) {
      setError('Factory name and contact person are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          factoryName: factoryName.trim(),
          contactPerson: contactPerson.trim(),
          contactPhone: contactPhone.trim(),
          location: location.trim(),
          specialty: specialty.trim(),
          leadTimeDays: Math.max(1, Math.min(365, Math.round(Number(leadTimeDays) || 18))),
          paymentTerms: paymentTerms.trim(),
          notes: notes.trim(),
        },
        initial?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save factory.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-lg shadow-lg my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            {initial ? 'Edit Partner Factory' : 'Add Partner Factory'}
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

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Factory Name
            </label>
            <input
              type="text"
              value={factoryName}
              onChange={(e) => setFactoryName(e.target.value)}
              placeholder="e.g. Yuyao Jingyi Dispensing Co., Ltd."
              maxLength={140}
              required
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Contact Person
              </label>
              <input
                type="text"
                value={contactPerson}
                onChange={(e) => setContactPerson(e.target.value)}
                placeholder="e.g. Chen Wei"
                maxLength={100}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Phone / WeChat / WhatsApp
              </label>
              <input
                type="text"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
                placeholder="e.g. +86 138 5742 8810"
                maxLength={64}
                className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                City / Industrial Zone
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Yuyao, Ningbo, Zhejiang"
                maxLength={100}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Production Lead Time (days)
              </label>
              <input
                type="number"
                min="1"
                max="365"
                step="1"
                value={leadTimeDays}
                onChange={(e) => setLeadTimeDays(e.target.value)}
                required
                className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Product Specialty
              </label>
              <input
                type="text"
                value={specialty}
                onChange={(e) => setSpecialty(e.target.value)}
                placeholder="e.g. Trigger Sprayers & Lotion Pumps"
                maxLength={140}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Payment Terms
              </label>
              <input
                type="text"
                value={paymentTerms}
                onChange={(e) => setPaymentTerms(e.target.value)}
                placeholder="e.g. 30% deposit, 70% before ship"
                maxLength={140}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Molding & Workshop Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              placeholder="Custom color MOQ, dip tube tolerances, export license, quality notes..."
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
              {saving ? 'Saving...' : initial ? 'Update Factory' : 'Save Factory'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface FactoryDetailDrawerProps {
  factory: Factory;
  linkedProducts: Product[];
  currency: CurrencyCode;
  usdToRmbRate: number | null;
  onClose: () => void;
  onEdit: () => void;
  onNavigateToProducts: () => void;
}

function FactoryDetailDrawer({
  factory,
  linkedProducts,
  currency,
  usdToRmbRate,
  onClose,
  onEdit,
  onNavigateToProducts,
}: FactoryDetailDrawerProps) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end">
      <div className="bg-white w-full max-w-lg h-full shadow-xl border-l border-slate-200 flex flex-col">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <FactoryIcon className="w-3.5 h-3.5 text-teal-700" />
              <span>Partner Factory</span>
            </div>
            <h2 className="text-base font-semibold text-slate-900 truncate mt-0.5">
              {factory.factoryName}
            </h2>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
              aria-label="Close drawer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5 text-xs">
          <div className="grid grid-cols-2 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div>
              <p className="text-[11px] text-slate-500">Contact Person</p>
              <p className="font-semibold text-slate-900 mt-0.5">{factory.contactPerson}</p>
              {factory.contactPhone && (
                <p className="font-mono tabular-nums text-[11px] text-slate-600 mt-0.5">
                  {factory.contactPhone}
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Location</p>
              <p className="font-medium text-slate-800 mt-0.5 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{factory.location || 'Not specified'}</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Lead Time</p>
              <p className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5 flex items-center gap-1">
                <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                <span>{factory.leadTimeDays} days</span>
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">Payment Terms</p>
              <p className="font-medium text-slate-800 mt-0.5">
                {factory.paymentTerms || 'Not specified'}
              </p>
            </div>
          </div>

          {factory.specialty && (
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                Manufacturing Specialty
              </p>
              <p className="text-slate-800 mt-1">{factory.specialty}</p>
            </div>
          )}

          {factory.notes && (
            <div>
              <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wide">
                Factory Notes
              </p>
              <p className="text-slate-700 mt-1 whitespace-pre-wrap">{factory.notes}</p>
            </div>
          )}

          <div className="space-y-2.5 pt-2 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Package className="w-3.5 h-3.5 text-teal-700" />
                <h3 className="text-xs font-semibold text-slate-900">
                  Linked Products ({linkedProducts.length})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onNavigateToProducts();
                }}
                className="text-[11px] font-medium text-teal-700 hover:text-teal-800 cursor-pointer"
              >
                Manage in Products
              </button>
            </div>

            {linkedProducts.length === 0 ? (
              <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg text-slate-500">
                No products assigned to this factory yet. Edit any product in the Products tab to
                link it here.
              </div>
            ) : (
              <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                {linkedProducts.map((prod) => {
                  const pricing = getProductPricing(prod, usdToRmbRate);
                  return (
                    <div key={prod.id} className="p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">{prod.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                          {prod.sku} · {CATEGORY_META[prod.category].shortLabel} · {prod.neckSize} · MOQ{' '}
                          {formatCount(prod.moq)}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[10px] text-slate-400">Factory Cost</p>
                        <DualPrice
                          rmbAmount={pricing.factoryRmb}
                          usdAmount={pricing.factoryUsd}
                          primaryCurrency={currency}
                          unit
                          align="right"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
