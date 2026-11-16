import { FormEvent, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  MessageSquare,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import {
  Client,
  ClientInput,
  CurrencyCode,
  Order,
  getOrderFinancials,
  getWhatsappUrl,
} from '../types/hub';
import { DualPrice } from './DualPrice';

interface ClientsViewProps {
  clients: Client[];
  orders: Order[];
  loading: boolean;
  currency: CurrencyCode;
  usdToRmbRate: number | null;
  onSaveClient: (input: ClientInput, existingId?: string) => Promise<string>;
  onDeleteClient: (clientId: string) => Promise<void>;
  onNewOrderForClient: (client: Client) => void;
}

export function ClientsView({
  clients,
  orders,
  loading,
  currency,
  usdToRmbRate,
  onSaveClient,
  onDeleteClient,
  onNewOrderForClient,
}: ClientsViewProps) {
  const [search, setSearch] = useState('');
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const clientStats = useMemo(() => {
    const stats = new Map<
      string,
      { count: number; revenueRmb: number | null; revenueUsd: number | null; lastDate: string }
    >();
    for (const order of orders) {
      if (order.status === 'cancelled') continue;
      const existing = stats.get(order.clientId) || {
        count: 0,
        revenueRmb: 0,
        revenueUsd: 0,
        lastDate: '',
      };
      const fin = getOrderFinancials(order, usdToRmbRate);
      existing.count += 1;
      if (existing.revenueRmb === null || fin.revenueRmb === null) {
        existing.revenueRmb = null;
      } else {
        existing.revenueRmb += fin.revenueRmb;
      }
      if (existing.revenueUsd === null || fin.revenueUsd === null) {
        existing.revenueUsd = null;
      } else {
        existing.revenueUsd += fin.revenueUsd;
      }
      if (!existing.lastDate || order.orderDate > existing.lastDate) {
        existing.lastDate = order.orderDate;
      }
      stats.set(order.clientId, existing);
    }
    return stats;
  }, [orders, usdToRmbRate]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter(
      (c) =>
        c.companyName.toLowerCase().includes(q) ||
        c.contactName.toLowerCase().includes(q) ||
        c.whatsappNumber.toLowerCase().includes(q) ||
        c.country.toLowerCase().includes(q)
    );
  }, [clients, search]);

  const handleCopyWhatsapp = async (client: Client) => {
    try {
      await navigator.clipboard.writeText(client.whatsappNumber);
      setCopiedId(client.id);
      setTimeout(() => setCopiedId((prev) => (prev === client.id ? null : prev)), 1800);
    } catch {
      // Fallback ignored if clipboard blocked
    }
  };

  const handleConfirmDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await onDeleteClient(id);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search company, buyer, WhatsApp, country..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
          />
        </div>

        <button
          type="button"
          onClick={() => {
            setEditingClient(null);
            setModalOpen(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add Client</span>
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
            {clients.length === 0
              ? 'No clients saved in your directory yet'
              : 'No clients match your search'}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {clients.length === 0
              ? 'Save buyer company names, contact persons, and WhatsApp numbers for instant quoting and order tracking.'
              : 'Try adjusting your search keywords.'}
          </p>
          {clients.length === 0 && (
            <button
              type="button"
              onClick={() => {
                setEditingClient(null);
                setModalOpen(true);
              }}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add First Client</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 tracking-wide">
                  <th className="py-3 px-4">Company & Contact</th>
                  <th className="py-3 px-3">WhatsApp Number</th>
                  <th className="py-3 px-3">Country / Region</th>
                  <th className="py-3 px-3 text-right">Orders</th>
                  <th className="py-3 px-3 text-right">Total Spend (USD / RMB)</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((client) => {
                  const stat = clientStats.get(client.id) || {
                    count: 0,
                    revenueRmb: 0,
                    revenueUsd: 0,
                    lastDate: '',
                  };
                  const waUrl = getWhatsappUrl(
                    client.whatsappNumber,
                    `Hi ${client.contactName}, checking in from Yi Lai Hub regarding your dispensing packaging order.`
                  );

                  return (
                    <tr key={client.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{client.companyName}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          {client.contactName}
                          {client.email ? ` · ${client.email}` : ''}
                        </p>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <span className="font-mono tabular-nums font-medium text-slate-900">
                            {client.whatsappNumber}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleCopyWhatsapp(client)}
                            title="Copy WhatsApp number"
                            className="p-1 text-slate-400 hover:text-slate-700 rounded cursor-pointer"
                          >
                            {copiedId === client.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                          {waUrl && (
                            <a
                              href={waUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md whitespace-nowrap shrink-0"
                            >
                              <MessageSquare className="w-3 h-3" />
                              <span>Chat</span>
                              <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-slate-600 whitespace-nowrap">
                        {client.country || '—'}
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {stat.count}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <DualPrice
                          rmbAmount={stat.revenueRmb}
                          usdAmount={stat.revenueUsd}
                          primaryCurrency={currency}
                          align="right"
                        />
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {confirmDeleteId === client.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmDelete(client.id)}
                              disabled={deletingId === client.id}
                              className="px-2 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded cursor-pointer"
                            >
                              {deletingId === client.id ? 'Removing...' : 'Confirm'}
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
                              onClick={() => onNewOrderForClient(client)}
                              title="New order for this client"
                              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 rounded-md cursor-pointer"
                            >
                              <ShoppingBag className="w-3 h-3" />
                              <span>New Order</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingClient(client);
                                setModalOpen(true);
                              }}
                              title="Edit client"
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(client.id)}
                              title="Delete client"
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
        <ClientFormModal
          initial={editingClient}
          onClose={() => setModalOpen(false)}
          onSave={onSaveClient}
        />
      )}
    </div>
  );
}

interface ClientFormModalProps {
  initial: Client | null;
  onClose: () => void;
  onSave: (input: ClientInput, existingId?: string) => Promise<string>;
}

function ClientFormModal({ initial, onClose, onSave }: ClientFormModalProps) {
  const [companyName, setCompanyName] = useState(initial?.companyName || '');
  const [contactName, setContactName] = useState(initial?.contactName || '');
  const [whatsappNumber, setWhatsappNumber] = useState(initial?.whatsappNumber || '');
  const [country, setCountry] = useState(initial?.country || '');
  const [email, setEmail] = useState(initial?.email || '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || !contactName.trim() || whatsappNumber.trim().length < 4) {
      setError('Company name, contact name, and valid WhatsApp number are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          companyName: companyName.trim(),
          contactName: contactName.trim(),
          whatsappNumber: whatsappNumber.trim(),
          country: country.trim(),
          email: email.trim(),
          notes: notes.trim(),
        },
        initial?.id
      );
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save client.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-lg">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <h2 className="text-base font-semibold text-slate-900">
            {initial ? 'Edit Client Contact' : 'Add New Client'}
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
              Company / Brand Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Aurelia Botanics Ltd."
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
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                placeholder="e.g. Sophia Lim"
                maxLength={100}
                required
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Country / Market
              </label>
              <input
                type="text"
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                placeholder="e.g. Malaysia"
                maxLength={80}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              WhatsApp Number (with country code)
            </label>
            <input
              type="text"
              value={whatsappNumber}
              onChange={(e) => setWhatsappNumber(e.target.value)}
              placeholder="e.g. +60 12 394 8821"
              maxLength={32}
              required
              className="w-full px-3 py-2 text-xs font-mono tabular-nums border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Used for one-click WhatsApp chat and order quote messages.
            </p>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Email (optional)
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="buyer@company.com"
              maxLength={200}
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">
              Buyer Preferences & Payment Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={1000}
              placeholder="Preferred neck sizes, shipping port, payment terms..."
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
              {saving ? 'Saving...' : initial ? 'Update Client' : 'Save Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
