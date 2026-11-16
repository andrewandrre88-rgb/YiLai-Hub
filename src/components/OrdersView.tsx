import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Edit3,
  ExternalLink,
  Eye,
  Lock,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import {
  Client,
  CreateOrderInput,
  CurrencyCode,
  ORDER_STATUS_META,
  Order,
  OrderDraftItem,
  OrderItem,
  OrderStatus,
  PAYMENT_STATUS_META,
  PaymentStatus,
  Product,
  convertRmbToUsd,
  convertUsdToRmb,
  formatCount,
  formatDualMoneyFromUsd,
  formatDualUnitPrice,
  formatDualUnitPriceFromUsd,
  formatExchangeRate,
  formatMoneyValue,
  formatUnitPriceValue,
  getOrderFinancials,
  getOrderItemFinancials,
  getOrderRate,
  getProductPricing,
  getWhatsappUrl,
} from '../types/hub';
import { fetchOrderItems, updateOrderItemSpecs } from '../lib/firestoreService';
import { DualPrice } from './DualPrice';

interface OrdersViewProps {
  orders: Order[];
  clients: Client[];
  products: Product[];
  loading: boolean;
  currency: CurrencyCode;
  usdToRmbRate: number | null;
  preselectedClient?: Client | null;
  preselectedProduct?: Product | null;
  newOrderModalOpen: boolean;
  onOpenNewOrder: () => void;
  onCloseNewOrder: () => void;
  onCreateOrder: (input: CreateOrderInput) => Promise<string>;
  onEditOrder: (orderId: string, input: CreateOrderInput) => Promise<void>;
  onUpdateOrder: (
    orderId: string,
    updates: {
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      exchangeRate?: number;
      shippingNotes?: string;
      notes?: string;
    }
  ) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
  selectedOrder: Order | null;
  onSelectOrder: (order: Order | null) => void;
}

const STATUS_TABS: Array<{ id: 'all' | OrderStatus; label: string }> = [
  { id: 'all', label: 'All Orders' },
  { id: 'quoted', label: 'Quoted' },
  { id: 'confirmed', label: 'Confirmed' },
  { id: 'in_production', label: 'In Production' },
  { id: 'shipped', label: 'Shipped' },
  { id: 'completed', label: 'Completed' },
  { id: 'cancelled', label: 'Cancelled' },
];

export function OrdersView({
  orders,
  clients,
  products,
  loading,
  currency,
  usdToRmbRate,
  preselectedClient,
  preselectedProduct,
  newOrderModalOpen,
  onOpenNewOrder,
  onCloseNewOrder,
  onCreateOrder,
  onEditOrder,
  onUpdateOrder,
  onDeleteOrder,
  selectedOrder,
  onSelectOrder,
}: OrdersViewProps) {
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [search, setSearch] = useState('');
  const [orderFormSeed, setOrderFormSeed] = useState<{
    mode: 'edit' | 'duplicate';
    order: Order;
    items: OrderDraftItem[];
  } | null>(null);
  const [loadingActionId, setLoadingActionId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [marginOrder, setMarginOrder] = useState<Order | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.orderNumber.toLowerCase().includes(q) ||
        o.clientName.toLowerCase().includes(q) ||
        o.itemsSummary.toLowerCase().includes(q)
      );
    });
  }, [orders, statusFilter, search]);

  const loadDraftItems = async (order: Order): Promise<OrderDraftItem[]> => {
    const orderRate = getOrderRate(order, usdToRmbRate);
    const fetched = await fetchOrderItems(order.id, order.ownerId);
    if (fetched.length > 0) {
      return fetched.map((item) => {
        const fin = getOrderItemFinancials(item, orderRate);
        return {
          productId: item.productId,
          productSku: item.productSku,
          productName: item.productName,
          category: item.category,
          neckSize: item.neckSize,
          colorFinish: item.colorFinish || '',
          dipTube: item.dipTube || '',
          quantity: item.quantity,
          unitFactoryPrice: Number(fin.unitFactoryRmb.toFixed(4)),
          unitSellingPrice: Number((fin.unitSellingUsd ?? 0).toFixed(4)),
        };
      });
    }
    const fallbackProd = products[0];
    if (!fallbackProd) return [];
    const pricing = getProductPricing(fallbackProd, orderRate);
    return [
      {
        productId: fallbackProd.id,
        productSku: fallbackProd.sku,
        productName: fallbackProd.name,
        category: fallbackProd.category,
        neckSize: fallbackProd.neckSize,
        colorFinish: fallbackProd.colorFinish || '',
        dipTube: '',
        quantity: fallbackProd.moq || 5000,
        unitFactoryPrice: Number(pricing.factoryRmb.toFixed(4)),
        unitSellingPrice: Number((pricing.sellingUsd ?? 0).toFixed(4)),
      },
    ];
  };

  const handleOpenEditOrder = async (order: Order) => {
    setLoadingActionId(order.id);
    setActionError(null);
    try {
      const draftItems = await loadDraftItems(order);
      setOrderFormSeed({ mode: 'edit', order, items: draftItems });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to load order items for editing.');
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleOpenDuplicateOrder = async (order: Order) => {
    setLoadingActionId(order.id);
    setActionError(null);
    try {
      const draftItems = await loadDraftItems(order);
      setOrderFormSeed({ mode: 'duplicate', order, items: draftItems });
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Unable to load order items to duplicate.'
      );
    } finally {
      setLoadingActionId(null);
    }
  };

  const handleConfirmDeleteOrder = async (orderId: string) => {
    setDeletingId(orderId);
    setActionError(null);
    try {
      await onDeleteOrder(orderId);
      setConfirmDeleteId(null);
      if (selectedOrder?.id === orderId) {
        onSelectOrder(null);
      }
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Unable to delete order.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-lg overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                statusFilter === tab.id
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search Order #, client, product..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
            />
          </div>

          <button
            type="button"
            onClick={onOpenNewOrder}
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {actionError && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg px-4 py-2.5 text-xs text-rose-800 flex items-center justify-between gap-2">
          <span>{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            className="text-rose-600 hover:text-rose-800 cursor-pointer"
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
          {[1, 2, 3, 4].map((row) => (
            <div key={row} className="h-14 px-4 flex items-center gap-4 animate-pulse">
              <div className="h-3 w-28 bg-slate-100 rounded" />
              <div className="h-3 w-52 bg-slate-100 rounded" />
              <div className="h-3 w-20 bg-slate-100 rounded ml-auto" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-xl py-14 px-6 text-center">
          <p className="text-sm font-semibold text-slate-900">
            {orders.length === 0
              ? 'No orders recorded yet'
              : 'No orders match your selected filters'}
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-md mx-auto">
            {orders.length === 0
              ? 'Create a quote or confirmed order linking a saved client and your dispensing products to track factory cost, revenue, and fulfillment in USD & RMB.'
              : 'Clear your search query or select All Orders.'}
          </p>
          {orders.length === 0 && (
            <button
              type="button"
              onClick={onOpenNewOrder}
              className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create First Order</span>
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="md:hidden divide-y divide-slate-100">
            {filtered.map((order) => {
              const statusMeta = ORDER_STATUS_META[order.status];
              const payMeta = PAYMENT_STATUS_META[order.paymentStatus];
              const fin = getOrderFinancials(order, usdToRmbRate);
              const profitPositive = (fin.profitUsd ?? 0) >= 0;

              return (
                <div
                  key={order.id}
                  onClick={() => onSelectOrder(order)}
                  className="p-4 space-y-2.5 text-xs hover:bg-slate-50/90 transition-colors cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-mono tabular-nums font-semibold text-slate-900">
                        {order.orderNumber}
                      </p>
                      <p className="text-[11px] font-mono tabular-nums text-slate-500">
                        {order.orderDate} · {formatCount(order.totalUnits)} pcs
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className={`text-[11px] font-medium ${payMeta.textClass}`}>
                        {payMeta.label}
                      </span>
                      <span
                        className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border rounded-md ${statusMeta.colorClass}`}
                      >
                        {statusMeta.label}
                      </span>
                    </div>
                  </div>

                  <div>
                    <p className="font-medium text-slate-900 truncate">{order.clientName}</p>
                    <p className="text-[11px] text-slate-500 truncate">{order.itemsSummary}</p>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-100 items-start">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Factory</span>
                      <DualPrice
                        rmbAmount={fin.costRmb}
                        usdAmount={fin.costUsd}
                        primaryCurrency={currency}
                        primaryClassName="font-medium text-slate-700"
                      />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 block">Total</span>
                      <DualPrice
                        rmbAmount={fin.revenueRmb}
                        usdAmount={fin.revenueUsd}
                        primaryCurrency={currency}
                      />
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Profit</span>
                      <DualPrice
                        rmbAmount={fin.profitRmb}
                        usdAmount={fin.profitUsd}
                        primaryCurrency={currency}
                        align="right"
                        primaryClassName={
                          profitPositive
                            ? 'font-semibold text-emerald-700'
                            : 'font-semibold text-rose-700'
                        }
                        secondaryClassName="text-[11px] text-emerald-700/75"
                      />
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between gap-2 pt-2 border-t border-slate-100"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div>
                      {order.status === 'completed' || order.status === 'cancelled' ? (
                        <span className="text-[11px] font-mono tabular-nums text-slate-400">
                          Margin {fin.marginPct.toFixed(1)}%
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setMarginOrder(order)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-mono tabular-nums font-medium text-teal-800 bg-teal-50/90 hover:bg-teal-100 border border-teal-200/80 rounded cursor-pointer"
                        >
                          <span>{fin.marginPct.toFixed(1)}%</span>
                          <SlidersHorizontal className="w-2.5 h-2.5" />
                        </button>
                      )}
                    </div>

                    {confirmDeleteId === order.id ? (
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleConfirmDeleteOrder(order.id)}
                          disabled={deletingId === order.id}
                          className="px-2 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded cursor-pointer"
                        >
                          {deletingId === order.id ? 'Deleting...' : 'Confirm'}
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
                          onClick={() => onSelectOrder(order)}
                          title="Open order details & WhatsApp quote"
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEditOrder(order)}
                          disabled={loadingActionId === order.id}
                          title="Edit order"
                          className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-md cursor-pointer disabled:opacity-50"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenDuplicateOrder(order)}
                          disabled={loadingActionId === order.id}
                          title="Duplicate order"
                          className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer disabled:opacity-50"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteId(order.id)}
                          title="Delete order"
                          className="p-1.5 text-slate-400 hover:text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500 tracking-wide">
                  <th className="py-3 px-4">Order # & Date</th>
                  <th className="py-3 px-3">Client</th>
                  <th className="py-3 px-3">Products</th>
                  <th className="py-3 px-3 text-right">Units</th>
                  <th className="py-3 px-3 text-right">Factory (RMB / USD)</th>
                  <th className="py-3 px-3 text-right">Total (USD / RMB)</th>
                  <th className="py-3 px-3 text-right">Profit (USD / RMB)</th>
                  <th className="py-3 px-3">Payment</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {filtered.map((order) => {
                  const statusMeta = ORDER_STATUS_META[order.status];
                  const payMeta = PAYMENT_STATUS_META[order.paymentStatus];
                  const fin = getOrderFinancials(order, usdToRmbRate);
                  const profitPositive = (fin.profitUsd ?? 0) >= 0;

                  return (
                    <tr
                      key={order.id}
                      onClick={() => onSelectOrder(order)}
                      className="hover:bg-slate-50/90 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4 whitespace-nowrap">
                        <p className="font-mono tabular-nums font-semibold text-slate-900">
                          {order.orderNumber}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-slate-500">
                          {order.orderDate}
                        </p>
                      </td>

                      <td className="py-3 px-3">
                        <p className="font-medium text-slate-900 truncate max-w-[150px]">
                          {order.clientName}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-slate-500">
                          {order.clientWhatsapp || '—'}
                        </p>
                      </td>

                      <td className="py-3 px-3">
                        <p className="text-slate-700 truncate max-w-[210px]">
                          {order.itemsSummary}
                        </p>
                        {order.itemCount > 1 && (
                          <p className="text-[11px] font-mono tabular-nums text-slate-500">
                            {order.itemCount} products in order
                          </p>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-700 whitespace-nowrap">
                        {formatCount(order.totalUnits)}
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <DualPrice
                          rmbAmount={fin.costRmb}
                          usdAmount={fin.costUsd}
                          primaryCurrency={currency}
                          align="right"
                          primaryClassName="font-medium text-slate-700"
                        />
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <DualPrice
                          rmbAmount={fin.revenueRmb}
                          usdAmount={fin.revenueUsd}
                          primaryCurrency={currency}
                          align="right"
                        />
                      </td>

                      <td className="py-3 px-3 text-right whitespace-nowrap">
                        <DualPrice
                          rmbAmount={fin.profitRmb}
                          usdAmount={fin.profitUsd}
                          primaryCurrency={currency}
                          align="right"
                          primaryClassName={
                            profitPositive
                              ? 'font-semibold text-emerald-700'
                              : 'font-semibold text-rose-700'
                          }
                          secondaryClassName="text-[11px] text-emerald-700/75"
                        />
                        {order.status === 'completed' || order.status === 'cancelled' ? (
                          <span
                            title="Profit margin is locked on completed or cancelled orders"
                            className="inline-block mt-0.5 text-[10px] font-mono tabular-nums text-slate-400"
                          >
                            {fin.marginPct.toFixed(1)}%
                          </span>
                        ) : (
                          <span className="inline-flex justify-end mt-0.5">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMarginOrder(order);
                              }}
                              title="Adjust profit margin for this order"
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono tabular-nums font-medium text-teal-800 bg-teal-50/90 hover:bg-teal-100 border border-teal-200/80 rounded cursor-pointer transition-colors"
                            >
                              <span>{fin.marginPct.toFixed(1)}%</span>
                              <SlidersHorizontal className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span className={`font-medium ${payMeta.textClass}`}>{payMeta.label}</span>
                      </td>

                      <td className="py-3 px-3 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border rounded-md ${statusMeta.colorClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </td>

                      <td
                        className="py-3 px-4 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {confirmDeleteId === order.id ? (
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleConfirmDeleteOrder(order.id)}
                              disabled={deletingId === order.id}
                              className="px-2 py-1 text-[11px] font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded cursor-pointer"
                            >
                              {deletingId === order.id ? 'Deleting...' : 'Confirm'}
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
                              onClick={() => onSelectOrder(order)}
                              title="Open order details & WhatsApp quote"
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditOrder(order)}
                              disabled={loadingActionId === order.id}
                              title="Edit order"
                              className="p-1.5 text-slate-500 hover:text-teal-700 hover:bg-teal-50 rounded-md cursor-pointer disabled:opacity-50"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenDuplicateOrder(order)}
                              disabled={loadingActionId === order.id}
                              title="Duplicate order"
                              className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md cursor-pointer disabled:opacity-50"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(order.id)}
                              title="Delete order"
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

      {(newOrderModalOpen || orderFormSeed) && (
        <OrderFormModal
          mode={orderFormSeed ? orderFormSeed.mode : 'create'}
          seedOrder={orderFormSeed?.order || null}
          seedItems={orderFormSeed?.items || null}
          clients={clients}
          products={products}
          currency={currency}
          usdToRmbRate={usdToRmbRate}
          preselectedClient={preselectedClient}
          preselectedProduct={preselectedProduct}
          onClose={() => {
            if (orderFormSeed) setOrderFormSeed(null);
            if (newOrderModalOpen) onCloseNewOrder();
          }}
          onCreateOrder={onCreateOrder}
          onEditOrder={onEditOrder}
          onUpdateOrder={onUpdateOrder}
        />
      )}

      {selectedOrder && (
        <OrderDetailDrawer
          order={selectedOrder}
          currency={currency}
          usdToRmbRate={usdToRmbRate}
          onClose={() => onSelectOrder(null)}
          onEdit={() => handleOpenEditOrder(selectedOrder)}
          onDuplicate={() => handleOpenDuplicateOrder(selectedOrder)}
          onUpdateOrder={onUpdateOrder}
          onDeleteOrder={onDeleteOrder}
        />
      )}
      {marginOrder && (
        <AdjustMarginModal
          order={marginOrder}
          products={products}
          currency={currency}
          usdToRmbRate={usdToRmbRate}
          onClose={() => setMarginOrder(null)}
          onSaveMargin={onEditOrder}
        />
      )}
    </div>
  );
}

interface OrderFormModalProps {
  mode: 'create' | 'edit' | 'duplicate';
  seedOrder?: Order | null;
  seedItems?: OrderDraftItem[] | null;
  clients: Client[];
  products: Product[];
  currency: CurrencyCode;
  usdToRmbRate: number | null;
  preselectedClient?: Client | null;
  preselectedProduct?: Product | null;
  onClose: () => void;
  onCreateOrder: (input: CreateOrderInput) => Promise<string>;
  onEditOrder: (orderId: string, input: CreateOrderInput) => Promise<void>;
  onUpdateOrder: (
    orderId: string,
    updates: {
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      exchangeRate?: number;
      shippingNotes?: string;
      notes?: string;
    }
  ) => Promise<void>;
}

function OrderFormModal({
  mode,
  seedOrder,
  seedItems,
  clients,
  products,
  currency,
  usdToRmbRate,
  preselectedClient,
  preselectedProduct,
  onClose,
  onCreateOrder,
  onEditOrder,
  onUpdateOrder,
}: OrderFormModalProps) {
  const defaultOrderNum =
    mode === 'duplicate' && seedOrder
      ? `${seedOrder.orderNumber.slice(0, 34)}-COPY`
      : `YL-${new Date().getFullYear()}-${Math.floor(100 + Math.random() * 900)}`;
  const todayStr = new Date().toISOString().slice(0, 10);

  const isEdit = mode === 'edit' && Boolean(seedOrder);
  const isTerminalEdit =
    isEdit &&
    Boolean(seedOrder && (seedOrder.status === 'completed' || seedOrder.status === 'cancelled'));

  const [orderRate, setOrderRate] = useState<number | null>(() =>
    isEdit && seedOrder ? getOrderRate(seedOrder, usdToRmbRate) : usdToRmbRate
  );

  useEffect(() => {
    if (!isEdit && orderRate === null && usdToRmbRate !== null) {
      setOrderRate(usdToRmbRate);
    }
  }, [isEdit, orderRate, usdToRmbRate]);

  const [clientId, setClientId] = useState(
    (seedOrder?.clientId) || preselectedClient?.id || clients[0]?.id || ''
  );
  const [orderNumber, setOrderNumber] = useState(
    isEdit && seedOrder ? seedOrder.orderNumber : defaultOrderNum
  );
  const [orderDate, setOrderDate] = useState(
    isEdit && seedOrder ? seedOrder.orderDate : todayStr
  );
  const [status, setStatus] = useState<OrderStatus>(
    isEdit && seedOrder ? seedOrder.status : 'quoted'
  );
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(
    isEdit && seedOrder ? seedOrder.paymentStatus : 'unpaid'
  );
  const [shippingNotes, setShippingNotes] = useState(seedOrder?.shippingNotes || '');
  const [notes, setNotes] = useState(seedOrder?.notes || '');

  const initialProduct = preselectedProduct || products[0];
  const [items, setItems] = useState<OrderDraftItem[]>(() => {
    if (seedItems && seedItems.length > 0) {
      return seedItems;
    }
    if (!initialProduct) return [];
    const initialRate =
      isEdit && seedOrder ? getOrderRate(seedOrder, usdToRmbRate) : usdToRmbRate;
    const pricing = getProductPricing(initialProduct, initialRate);
    return [
      {
        productId: initialProduct.id,
        productSku: initialProduct.sku,
        productName: initialProduct.name,
        category: initialProduct.category,
        neckSize: initialProduct.neckSize,
        colorFinish: initialProduct.colorFinish || '',
        dipTube: '',
        quantity: initialProduct.moq || 5000,
        unitFactoryPrice: Number(pricing.factoryRmb.toFixed(4)),
        unitSellingPrice: Number((pricing.sellingUsd ?? 0).toFixed(4)),
      },
    ];
  });
  const [priceInputs, setPriceInputs] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totals = useMemo(() => {
    let units = 0;
    let cost = 0;
    let revenue = 0;
    for (const item of items) {
      const q = Math.max(0, Math.round(item.quantity));
      const fRmb = Number((Math.max(0, Number(item.unitFactoryPrice) || 0)).toFixed(4));
      const sUsd = Number((Math.max(0, Number(item.unitSellingPrice) || 0)).toFixed(4));
      units += q;
      cost += q * fRmb;
      revenue += q * sUsd;
    }
    const costRmb = Number(cost.toFixed(2));
    const revenueUsd = Number(revenue.toFixed(2));
    const costUsd = convertRmbToUsd(costRmb, orderRate);
    const revenueRmb = convertUsdToRmb(revenueUsd, orderRate);
    const profitUsd = costUsd !== null ? revenueUsd - costUsd : null;
    const profitRmb = revenueRmb !== null ? revenueRmb - costRmb : null;
    const marginPct =
      revenueUsd > 0 && profitUsd !== null ? (profitUsd / revenueUsd) * 100 : 0;
    return {
      units,
      costRmb,
      costUsd,
      revenueUsd,
      revenueRmb,
      profitUsd,
      profitRmb,
      marginPct,
    };
  }, [items, orderRate]);

  const createDraftFromProduct = (prod: Product): OrderDraftItem => {
    const pricing = getProductPricing(prod, orderRate);
    return {
      productId: prod.id,
      productSku: prod.sku,
      productName: prod.name,
      category: prod.category,
      neckSize: prod.neckSize,
      colorFinish: prod.colorFinish || '',
      dipTube: '',
      quantity: prod.moq || 5000,
      unitFactoryPrice: Number(pricing.factoryRmb.toFixed(4)),
      unitSellingPrice: Number((pricing.sellingUsd ?? 0).toFixed(4)),
    };
  };

  const handleAddLine = (specificProductId?: string) => {
    if (isTerminalEdit) return;
    const prod = specificProductId
      ? products.find((p) => p.id === specificProductId)
      : products.find((p) => !items.some((item) => item.productId === p.id)) || products[0];
    if (!prod) return;
    setItems((prev) => [...prev, createDraftFromProduct(prod)]);
  };

  const handleProductChange = (index: number, nextProductId: string) => {
    if (isTerminalEdit) return;
    const prod = products.find((p) => p.id === nextProductId);
    if (!prod) return;
    setPriceInputs((prev) => {
      const next = { ...prev };
      delete next[`${index}-unitFactoryPrice`];
      delete next[`${index}-unitSellingPrice`];
      return next;
    });
    setItems((prev) =>
      prev.map((row, idx) =>
        idx === index
          ? {
              ...createDraftFromProduct(prod),
              quantity: prod.moq || row.quantity,
            }
          : row
      )
    );
  };

  const handleUpdateQuantity = (index: number, rawVal: number) => {
    if (isTerminalEdit) return;
    const normalizedVal = Math.max(1, Math.round(rawVal) || 1);
    setItems((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, quantity: normalizedVal } : row))
    );
  };

  const handleUpdateUnitPrice = (
    index: number,
    field: 'unitSellingPrice' | 'unitFactoryPrice',
    rawString: string
  ) => {
    if (isTerminalEdit) return;
    const key = `${index}-${field}`;
    setPriceInputs((prev) => ({ ...prev, [key]: rawString }));
    const parsed = Number(rawString);
    const normalizedVal =
      rawString.trim() === '' || !Number.isFinite(parsed)
        ? 0
        : Number(Math.max(0, parsed).toFixed(4));

    setItems((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: normalizedVal } : row))
    );
  };

  const handleUpdateItemSpec = (
    index: number,
    field: 'neckSize' | 'colorFinish' | 'dipTube',
    val: string
  ) => {
    if (isTerminalEdit) return;
    setItems((prev) =>
      prev.map((row, idx) => (idx === index ? { ...row, [field]: val } : row))
    );
  };

  const handleRemoveLine = (index: number) => {
    if (isTerminalEdit) return;
    setPriceInputs({});
    setItems((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (isTerminalEdit && seedOrder) {
      setSaving(true);
      setError(null);
      try {
        await onUpdateOrder(seedOrder.id, {
          paymentStatus,
          ...(orderRate !== null ? { exchangeRate: orderRate } : {}),
          shippingNotes: shippingNotes.trim(),
          notes: notes.trim(),
        });
        onClose();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unable to update order.');
        setSaving(false);
      }
      return;
    }

    const selectedClient = clients.find((c) => c.id === clientId);
    const resolvedClient =
      selectedClient ||
      (isEdit && seedOrder && seedOrder.clientId === clientId
        ? {
            id: seedOrder.clientId,
            companyName: seedOrder.clientName,
            whatsappNumber: seedOrder.clientWhatsapp,
          }
        : null);

    if (!resolvedClient) {
      setError('Please select a saved client first.');
      return;
    }
    if (items.length === 0) {
      setError('Add at least one dispensing product line item.');
      return;
    }
    const missingProduct = items.some((i) => !products.some((p) => p.id === i.productId));
    if (missingProduct) {
      setError('One of the line items references a deleted product. Please select an active catalog product.');
      return;
    }
    setSaving(true);
    setError(null);
    const payload: CreateOrderInput = {
      orderNumber: orderNumber.trim() || defaultOrderNum,
      clientId: resolvedClient.id,
      clientName: resolvedClient.companyName,
      clientWhatsapp: resolvedClient.whatsappNumber,
      status,
      paymentStatus,
      orderDate,
      exchangeRate: orderRate,
      shippingNotes: shippingNotes.trim(),
      notes: notes.trim(),
      items,
    };

    try {
      if (isEdit && seedOrder) {
        await onEditOrder(seedOrder.id, payload);
      } else {
        await onCreateOrder(payload);
      }
      onClose();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isEdit
            ? 'Unable to update order.'
            : 'Unable to create order.'
      );
      setSaving(false);
    }
  };

  const modalTitle =
    mode === 'edit' && seedOrder
      ? `Edit Order · ${seedOrder.orderNumber}`
      : mode === 'duplicate' && seedOrder
        ? `Duplicate Order (${seedOrder.orderNumber})`
        : 'Create New Order';

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-3xl shadow-lg max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden my-auto">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 shrink-0">
          <h2 className="text-base font-semibold text-slate-900 truncate pr-2">{modalTitle}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {clients.length === 0 || products.length === 0 ? (
          <div className="p-6 text-center space-y-3 overflow-y-auto">
            <p className="text-sm font-semibold text-slate-900">
              {clients.length === 0
                ? 'Save a client before creating an order'
                : 'Add at least one product before creating an order'}
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Orders link a buyer from your Clients directory with dispensing products from your
              catalog to track factory costs and margins accurately.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg cursor-pointer"
            >
              Close
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto">
            {isTerminalEdit && (
              <div className="px-3.5 py-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-center gap-2">
                <Lock className="w-3.5 h-3.5 shrink-0" />
                <span>
                  This order is {seedOrder?.status}. Status and line items are locked; payment status,
                  shipping specs, and notes can still be edited.
                </span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="sm:col-span-2">
                <label className="block text-xs font-medium text-slate-700 mb-1">Client</label>
                <select
                  value={clientId}
                  disabled={isTerminalEdit}
                  onChange={(e) => setClientId(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                >
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.companyName} ({c.contactName} · {c.whatsappNumber})
                    </option>
                  ))}
                  {isEdit && seedOrder && !clients.some((c) => c.id === clientId) && (
                    <option value={seedOrder.clientId}>{seedOrder.clientName}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Order Number
                </label>
                <input
                  type="text"
                  value={orderNumber}
                  disabled={isTerminalEdit}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  maxLength={40}
                  required
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Order Date</label>
                <input
                  type="date"
                  value={orderDate}
                  disabled={isTerminalEdit}
                  onChange={(e) => setOrderDate(e.target.value)}
                  required
                  className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  {isEdit ? 'Order Status' : 'Initial Status'}
                </label>
                <select
                  value={status}
                  disabled={isTerminalEdit}
                  onChange={(e) => setStatus(e.target.value as OrderStatus)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                >
                  <option value="quoted">Quoted</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="in_production">In Production</option>
                  <option value="shipped">Shipped</option>
                  {isEdit && <option value="completed">Completed (Final)</option>}
                  {isEdit && <option value="cancelled">Cancelled (Final)</option>}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Payment Status
                </label>
                <select
                  value={paymentStatus}
                  onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                >
                  <option value="unpaid">Unpaid</option>
                  <option value="deposit_paid">Deposit Paid</option>
                  <option value="paid">Paid in Full</option>
                </select>
              </div>
            </div>

            <div className="space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-semibold text-slate-800">
                  Order Products ({items.length} {items.length === 1 ? 'item' : 'items'}) · Order rate: 1 USD = ¥{formatExchangeRate(orderRate)} RMB
                </span>
                <div className="flex items-center gap-3">
                  {isEdit && (
                    <button
                      type="button"
                      disabled={
                        usdToRmbRate === null ||
                        (orderRate !== null && Math.abs(orderRate - usdToRmbRate) < 0.00005)
                      }
                      onClick={() => {
                        if (usdToRmbRate !== null) setOrderRate(usdToRmbRate);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md disabled:opacity-50 cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>Update to today&apos;s rate</span>
                    </button>
                  )}
                  {!isTerminalEdit && (
                    <button
                      type="button"
                      onClick={() => handleAddLine()}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Product</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <div className="max-h-[42vh] sm:max-h-[320px] overflow-y-auto divide-y divide-slate-200">
                  {items.map((item, idx) => {
                    const factoryInputVal =
                      priceInputs[`${idx}-unitFactoryPrice`] ??
                      String(Number((Number(item.unitFactoryPrice) || 0).toFixed(4)));
                    const sellingInputVal =
                      priceInputs[`${idx}-unitSellingPrice`] ??
                      String(Number((Number(item.unitSellingPrice) || 0).toFixed(4)));
                    const lineTotalUsd =
                      item.quantity * Number((Number(item.unitSellingPrice) || 0).toFixed(4));

                    return (
                      <div
                        key={`${item.productId}-${idx}`}
                        className="p-3 bg-slate-50/50 space-y-2"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px]">
                          <span className="font-mono tabular-nums font-semibold text-slate-600">
                            Product #{idx + 1} · {item.neckSize}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono tabular-nums font-semibold text-slate-800">
                              Subtotal: {formatDualMoneyFromUsd(lineTotalUsd, orderRate)}
                            </span>
                            {!isTerminalEdit && items.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveLine(idx)}
                                className="p-1 text-slate-400 hover:text-rose-700 rounded cursor-pointer"
                                title="Remove product from order"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-12 gap-2.5 items-start">
                          <div className="col-span-2 sm:col-span-6">
                            <label className="block text-[11px] text-slate-500 mb-1">Product</label>
                            <select
                              value={item.productId}
                              disabled={isTerminalEdit}
                              onChange={(e) => handleProductChange(idx, e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md disabled:bg-slate-100 disabled:text-slate-500"
                            >
                              {products.map((p) => (
                                <option key={p.id} value={p.id}>
                                  {p.sku} · {p.name}
                                </option>
                              ))}
                              {!products.some((p) => p.id === item.productId) && (
                                <option value={item.productId}>
                                  {item.productSku} · {item.productName} (Deleted)
                                </option>
                              )}
                            </select>
                          </div>

                          <div className="col-span-2 sm:col-span-2">
                            <label className="block text-[11px] text-slate-500 mb-1">Qty (pcs)</label>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              disabled={isTerminalEdit}
                              value={item.quantity}
                              onChange={(e) =>
                                handleUpdateQuantity(idx, Number(e.target.value) || 1)
                              }
                              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </div>

                          <div className="col-span-1 sm:col-span-2">
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Factory / unit (RMB ¥)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              disabled={isTerminalEdit}
                              value={factoryInputVal}
                              onChange={(e) =>
                                handleUpdateUnitPrice(idx, 'unitFactoryPrice', e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md disabled:bg-slate-100 disabled:text-slate-500"
                            />
                            <p className="text-[10px] font-mono tabular-nums text-slate-500 mt-0.5">
                              ≈ {formatUnitPriceValue(convertRmbToUsd(item.unitFactoryPrice, orderRate), 'USD')} / pc
                            </p>
                          </div>

                          <div className="col-span-1 sm:col-span-2">
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Sell / unit (USD $)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.0001"
                              disabled={isTerminalEdit}
                              value={sellingInputVal}
                              onChange={(e) =>
                                handleUpdateUnitPrice(idx, 'unitSellingPrice', e.target.value)
                              }
                              className="w-full px-2.5 py-1.5 text-xs font-mono tabular-nums bg-white border border-slate-300 rounded-md disabled:bg-slate-100 disabled:text-slate-500"
                            />
                            <p className="text-[10px] font-mono tabular-nums text-slate-500 mt-0.5">
                              ≈ {formatUnitPriceValue(convertUsdToRmb(item.unitSellingPrice, orderRate), 'CNY')} / pc
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Neck Size
                            </label>
                            <input
                              type="text"
                              disabled={isTerminalEdit}
                              value={item.neckSize}
                              onChange={(e) =>
                                handleUpdateItemSpec(idx, 'neckSize', e.target.value)
                              }
                              maxLength={32}
                              placeholder="e.g. 28/410"
                              className="w-full px-2.5 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded-md disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Colors (Client Spec)
                            </label>
                            <input
                              type="text"
                              disabled={isTerminalEdit}
                              value={item.colorFinish || ''}
                              onChange={(e) =>
                                handleUpdateItemSpec(idx, 'colorFinish', e.target.value)
                              }
                              maxLength={64}
                              placeholder="e.g. Matte Black / Pantone 285C"
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-slate-500 mb-1">
                              Dip Tube (Client Spec)
                            </label>
                            <input
                              type="text"
                              disabled={isTerminalEdit}
                              value={item.dipTube || ''}
                              onChange={(e) =>
                                handleUpdateItemSpec(idx, 'dipTube', e.target.value)
                              }
                              maxLength={64}
                              placeholder="e.g. 215mm · FBOG cut"
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-md disabled:bg-slate-100 disabled:text-slate-500"
                            />
                          </div>
                        </div>

                        {(() => {
                          const factoryUnitUsd = convertRmbToUsd(item.unitFactoryPrice, orderRate);
                          const sellUnitRmb = convertUsdToRmb(item.unitSellingPrice, orderRate);
                          const unitProfitUsd =
                            factoryUnitUsd !== null ? item.unitSellingPrice - factoryUnitUsd : null;
                          const unitMarginPct =
                            item.unitSellingPrice > 0 && unitProfitUsd !== null
                              ? (unitProfitUsd / item.unitSellingPrice) * 100
                              : 0;
                          return (
                            <div className="pt-1.5 border-t border-slate-200/70 flex flex-wrap items-center justify-between gap-2 text-[11px] font-mono tabular-nums text-slate-600">
                              <span>
                                Factory/unit:{' '}
                                <strong className="text-slate-800">
                                  {formatUnitPriceValue(item.unitFactoryPrice, 'CNY')}
                                </strong>{' '}
                                ({formatUnitPriceValue(factoryUnitUsd, 'USD')})
                              </span>
                              <span>
                                Sell/unit:{' '}
                                <strong className="text-slate-900">
                                  {formatUnitPriceValue(item.unitSellingPrice, 'USD')}
                                </strong>{' '}
                                ({formatUnitPriceValue(sellUnitRmb, 'CNY')})
                              </span>
                              <span
                                className={
                                  (unitProfitUsd ?? 0) >= 0
                                    ? 'text-emerald-700 font-medium'
                                    : 'text-rose-700 font-medium'
                                }
                              >
                                Profit/unit: {formatUnitPriceValue(unitProfitUsd, 'USD')} (
                                {unitMarginPct.toFixed(1)}%)
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>

                {!isTerminalEdit && (
                  <div className="px-3 py-2.5 bg-white border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => handleAddLine()}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-md cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Another Product</span>
                    </button>

                    {products.length > 1 && (
                      <select
                        value=""
                        onChange={(e) => {
                          if (e.target.value) {
                            handleAddLine(e.target.value);
                          }
                        }}
                        aria-label="Quick add specific product"
                        className="w-full sm:w-auto max-w-full px-2.5 py-1.5 text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                      >
                        <option value="">+ Quick pick a product to append...</option>
                        {products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.sku} · {p.name} ({p.neckSize})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs">
              <div>
                <p className="text-[11px] text-slate-500">Total Units</p>
                <p className="font-mono tabular-nums font-semibold text-slate-900 mt-0.5">
                  {formatCount(totals.units)} pcs
                </p>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Factory Cost</p>
                <div className="mt-0.5">
                  <DualPrice
                    rmbAmount={totals.costRmb}
                    usdAmount={totals.costUsd}
                    primaryCurrency={currency}
                    primaryClassName="font-medium text-slate-700"
                  />
                </div>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Order Total</p>
                <div className="mt-0.5">
                  <DualPrice
                    rmbAmount={totals.revenueRmb}
                    usdAmount={totals.revenueUsd}
                    primaryCurrency={currency}
                  />
                </div>
              </div>
              <div>
                <p className="text-[11px] text-slate-500">Gross Profit ({totals.marginPct.toFixed(1)}%)</p>
                <div className="mt-0.5">
                  <DualPrice
                    rmbAmount={totals.profitRmb}
                    usdAmount={totals.profitUsd}
                    primaryCurrency={currency}
                    primaryClassName={
                      (totals.profitUsd ?? 0) >= 0
                        ? 'font-semibold text-emerald-700'
                        : 'font-semibold text-rose-700'
                    }
                    secondaryClassName="text-[11px] text-emerald-700/75"
                  />
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Shipping / Dip Tube Specs
                </label>
                <input
                  type="text"
                  value={shippingNotes}
                  onChange={(e) => setShippingNotes(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. FOB Ningbo · 215mm dip tube · Sea freight"
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Order Notes
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                  placeholder="Color sample approval, carton marks..."
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
              </div>
            </div>

            {error && (
              <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
                {error}
              </p>
            )}

            <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="w-full sm:w-auto px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-60 cursor-pointer"
              >
                {saving
                  ? isEdit
                    ? 'Updating Order...'
                    : 'Saving Order...'
                  : isEdit
                    ? 'Update Order'
                    : mode === 'duplicate'
                      ? 'Save Duplicated Order'
                      : 'Save Order'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

interface OrderDetailDrawerProps {
  order: Order;
  currency: CurrencyCode;
  usdToRmbRate: number | null;
  onClose: () => void;
  onEdit: () => void;
  onDuplicate: () => void;
  onUpdateOrder: (
    orderId: string,
    updates: {
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      exchangeRate?: number;
      shippingNotes?: string;
      notes?: string;
    }
  ) => Promise<void>;
  onDeleteOrder: (orderId: string) => Promise<void>;
}

function OrderDetailDrawer({
  order,
  currency,
  usdToRmbRate,
  onClose,
  onEdit,
  onDuplicate,
  onUpdateOrder,
  onDeleteOrder,
}: OrderDetailDrawerProps) {
  const [items, setItems] = useState<OrderItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [status, setStatus] = useState<OrderStatus>(order.status);
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatus>(order.paymentStatus);
  const [shippingNotes, setShippingNotes] = useState(order.shippingNotes);
  const [notes, setNotes] = useState(order.notes);
  const [quoteMode, setQuoteMode] = useState<'both' | 'USD' | 'CNY'>('both');
  const [saving, setSaving] = useState(false);
  const [updatingRate, setUpdatingRate] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState<string | null>(null);
  const [editingSpecItemId, setEditingSpecItemId] = useState<string | null>(null);
  const [specNeckSize, setSpecNeckSize] = useState('');
  const [specColorFinish, setSpecColorFinish] = useState('');
  const [specDipTube, setSpecDipTube] = useState('');
  const [savingSpecs, setSavingSpecs] = useState(false);
  const [specError, setSpecError] = useState<string | null>(null);

  const isTerminal = order.status === 'completed' || order.status === 'cancelled';
  const fin = getOrderFinancials(order, usdToRmbRate);
  const orderRate = fin.rate;
  const rateMatchesToday =
    usdToRmbRate !== null && orderRate !== null && Math.abs(orderRate - usdToRmbRate) < 0.00005;

  useEffect(() => {
    setStatus(order.status);
    setPaymentStatus(order.paymentStatus);
    setShippingNotes(order.shippingNotes);
    setNotes(order.notes);
    setConfirmDelete(false);
    setSaveFeedback(null);
    setEditingSpecItemId(null);
    setSpecError(null);
  }, [order]);

  useEffect(() => {
    let active = true;
    setLoadingItems(true);
    setItemsError(null);
    fetchOrderItems(order.id, order.ownerId)
      .then((res) => {
        if (active) setItems(res);
      })
      .catch((err) => {
        if (active) {
          setItemsError(err instanceof Error ? err.message : 'Unable to load order line items.');
        }
      })
      .finally(() => {
        if (active) setLoadingItems(false);
      });
    return () => {
      active = false;
    };
  }, [order.id, order.ownerId]);

  const whatsappMessage = useMemo(() => {
    const formatQuoteUnit = (usdVal: number | null) => {
      if (quoteMode === 'USD') return formatUnitPriceValue(usdVal, 'USD');
      if (quoteMode === 'CNY') {
        return `${formatUnitPriceValue(convertUsdToRmb(usdVal, orderRate), 'CNY')} RMB`;
      }
      return formatDualUnitPriceFromUsd(usdVal, orderRate);
    };

    const formatQuoteTotal = (usdVal: number | null) => {
      if (quoteMode === 'USD') return formatMoneyValue(usdVal, 'USD', 2);
      if (quoteMode === 'CNY') {
        return `${formatMoneyValue(convertUsdToRmb(usdVal, orderRate), 'CNY', 2)} RMB`;
      }
      return formatDualMoneyFromUsd(usdVal, orderRate);
    };

    const lines = items.length
      ? items
          .map((i) => {
            const itemFin = getOrderItemFinancials(i, orderRate);
            const specParts = [
              i.neckSize ? `Neck: ${i.neckSize}` : '',
              i.colorFinish ? `Color: ${i.colorFinish}` : '',
              i.dipTube ? `Dip tube: ${i.dipTube}` : '',
            ].filter(Boolean);
            const specText = specParts.length > 0 ? ` (${specParts.join(' · ')})` : '';
            return `- ${i.productName}${specText}: ${formatCount(
              i.quantity
            )} pcs @ ${formatQuoteUnit(itemFin.unitSellingUsd)} = ${formatQuoteTotal(
              itemFin.lineTotalUsd
            )}`;
          })
          .join('\n')
      : `- ${order.itemsSummary}`;

    return `Hello ${order.clientName},\n\nOrder Summary (${order.orderNumber}):\nStatus: ${
      ORDER_STATUS_META[status].label
    }\n${lines}\n\nTotal: ${formatQuoteTotal(fin.revenueUsd)}\n${
      shippingNotes ? `Shipping: ${shippingNotes}\n` : ''
    }Thank you for working with Yi Lai Hub!`;
  }, [items, order, status, shippingNotes, quoteMode, orderRate, fin.revenueUsd]);

  const waUrl = getWhatsappUrl(order.clientWhatsapp, whatsappMessage);

  const handleSaveChanges = async () => {
    setSaving(true);
    setSaveFeedback(null);
    try {
      await onUpdateOrder(order.id, {
        ...(isTerminal ? {} : { status }),
        paymentStatus,
        shippingNotes,
        notes,
      });
      setSaveFeedback('Order updated');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateToTodaysRate = async () => {
    if (usdToRmbRate === null) return;
    setUpdatingRate(true);
    setSaveFeedback(null);
    try {
      await onUpdateOrder(order.id, {
        exchangeRate: usdToRmbRate,
      });
      setSaveFeedback(`Order rate updated to 1 USD = ¥${formatExchangeRate(usdToRmbRate)}`);
    } finally {
      setUpdatingRate(false);
    }
  };

  const handleCopyMessage = async () => {
    try {
      await navigator.clipboard.writeText(whatsappMessage);
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 1800);
    } catch {
      // Ignore clipboard failure
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDeleteOrder(order.id);
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  const startEditSpecs = (item: OrderItem) => {
    setEditingSpecItemId(item.id);
    setSpecNeckSize(item.neckSize || '');
    setSpecColorFinish(item.colorFinish || '');
    setSpecDipTube(item.dipTube || '');
    setSpecError(null);
  };

  const handleSaveSpecs = async (item: OrderItem) => {
    setSavingSpecs(true);
    setSpecError(null);
    const nextNeck = specNeckSize.trim();
    const nextColor = specColorFinish.trim();
    const nextDipTube = specDipTube.trim();
    try {
      await updateOrderItemSpecs(order.id, item.id, {
        neckSize: nextNeck,
        colorFinish: nextColor,
        dipTube: nextDipTube,
      });
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id
            ? {
                ...row,
                neckSize: nextNeck,
                colorFinish: nextColor,
                dipTube: nextDipTube,
              }
            : row
        )
      );
      setEditingSpecItemId(null);
      setSaveFeedback('Client product specs saved');
    } catch (err) {
      setSpecError(err instanceof Error ? err.message : 'Unable to save product specs.');
    } finally {
      setSavingSpecs(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex justify-end">
      <div className="bg-white w-full max-w-xl h-full overflow-y-auto border-l border-slate-200 shadow-xl flex flex-col justify-between">
        <div>
          <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 sticky top-0 bg-white z-10">
            <div className="min-w-0">
              <p className="text-xs font-mono tabular-nums text-slate-500">
                {order.orderNumber} · {order.orderDate}
              </p>
              <h2 className="text-base font-semibold text-slate-900 mt-0.5 truncate">
                {order.clientName}
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
                onClick={onDuplicate}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicate</span>
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

          <div className="p-4 sm:p-6 space-y-5 sm:space-y-6">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-xs space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <p className="text-[11px] text-slate-500 mb-0.5">Factory Cost</p>
                  <DualPrice
                    rmbAmount={fin.costRmb}
                    usdAmount={fin.costUsd}
                    primaryCurrency={currency}
                    primaryClassName="font-medium text-slate-700"
                  />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 mb-0.5">Order Total</p>
                  <DualPrice
                    rmbAmount={fin.revenueRmb}
                    usdAmount={fin.revenueUsd}
                    primaryCurrency={currency}
                  />
                </div>
                <div>
                  <p className="text-[11px] text-slate-500 mb-0.5">
                    Gross Profit ({fin.marginPct.toFixed(1)}%)
                  </p>
                  <DualPrice
                    rmbAmount={fin.profitRmb}
                    usdAmount={fin.profitUsd}
                    primaryCurrency={currency}
                    primaryClassName={
                      (fin.profitUsd ?? 0) >= 0
                        ? 'font-semibold text-emerald-700'
                        : 'font-semibold text-rose-700'
                    }
                    secondaryClassName="text-[11px] text-emerald-700/75"
                  />
                </div>
              </div>

              <div className="pt-2.5 border-t border-slate-200/80 flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] font-mono tabular-nums text-slate-600">
                  Order rate: 1 USD = ¥{formatExchangeRate(orderRate)} RMB
                </span>
                <button
                  type="button"
                  onClick={handleUpdateToTodaysRate}
                  disabled={updatingRate || usdToRmbRate === null || rateMatchesToday}
                  className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-teal-800 bg-white hover:bg-teal-50 border border-teal-200 rounded-md disabled:opacity-50 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${updatingRate ? 'animate-spin' : ''}`} />
                  <span>
                    {updatingRate ? 'Updating...' : "Update to today's rate"}
                  </span>
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-slate-800">
                Fulfillment & Payment Status
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">
                    Order Status
                    {isTerminal && (
                      <span className="inline-flex items-center gap-1 ml-1.5 text-slate-500">
                        <Lock className="w-3 h-3" /> Locked
                      </span>
                    )}
                  </label>
                  <select
                    value={status}
                    disabled={isTerminal}
                    onChange={(e) => setStatus(e.target.value as OrderStatus)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white disabled:bg-slate-100 disabled:text-slate-500"
                  >
                    <option value="quoted">Quoted</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="in_production">In Production</option>
                    <option value="shipped">Shipped</option>
                    <option value="completed">Completed (Final)</option>
                    <option value="cancelled">Cancelled (Final)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] text-slate-500 mb-1">Payment Status</label>
                  <select
                    value={paymentStatus}
                    onChange={(e) => setPaymentStatus(e.target.value as PaymentStatus)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg bg-white"
                  >
                    <option value="unpaid">Unpaid</option>
                    <option value="deposit_paid">Deposit Paid</option>
                    <option value="paid">Paid in Full</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">
                  Shipping / Logistics Notes
                </label>
                <input
                  type="text"
                  value={shippingNotes}
                  onChange={(e) => setShippingNotes(e.target.value)}
                  maxLength={500}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-500 mb-1">Internal Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  maxLength={1000}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs text-emerald-700 font-medium">
                  {saveFeedback || ''}
                </span>
                <button
                  type="button"
                  onClick={handleSaveChanges}
                  disabled={saving}
                  className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-60 cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Order Updates'}
                </button>
              </div>
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-800">
                  Order Products &amp; Client Specs ({items.length || order.itemCount} items ·{' '}
                  {formatCount(order.totalUnits)} pcs total)
                </h3>
              </div>
              {specError && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
                  {specError}
                </p>
              )}
              {loadingItems ? (
                <div className="h-16 bg-slate-50 border border-slate-200 rounded-lg animate-pulse" />
              ) : itemsError ? (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2.5">
                  {itemsError}
                </p>
              ) : (
                <div className="border border-slate-200 rounded-lg divide-y divide-slate-100">
                  {items.map((item) => {
                    const itemFin = getOrderItemFinancials(item, orderRate);
                    const isEditingSpecs = editingSpecItemId === item.id;
                    return (
                      <div key={item.id} className="p-3 text-xs space-y-2.5">
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-4">
                          <div className="min-w-0">
                            <p className="font-semibold text-slate-900 truncate">
                              {item.productName}
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                              {item.productSku} · {formatCount(item.quantity)} pcs
                            </p>
                            <p className="text-[11px] text-slate-500 font-mono tabular-nums mt-0.5">
                              Sell {formatDualUnitPriceFromUsd(itemFin.unitSellingUsd, orderRate)} · Cost{' '}
                              {formatDualUnitPrice(itemFin.unitFactoryRmb, orderRate)}
                            </p>
                          </div>
                          <div className="shrink-0 sm:text-right flex sm:block items-center justify-between gap-2">
                            <DualPrice
                              rmbAmount={itemFin.lineTotalRmb}
                              usdAmount={itemFin.lineTotalUsd}
                              primaryCurrency={currency}
                              align="right"
                            />
                            {!isTerminal && !isEditingSpecs && (
                              <button
                                type="button"
                                onClick={() => startEditSpecs(item)}
                                className="sm:mt-1.5 inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded cursor-pointer"
                              >
                                <Edit3 className="w-2.5 h-2.5" />
                                <span>
                                  {item.colorFinish || item.dipTube ? 'Edit Specs' : 'Add Specs'}
                                </span>
                              </button>
                            )}
                          </div>
                        </div>

                        {isEditingSpecs ? (
                          <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-md space-y-2.5">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                              <div>
                                <label className="block text-[10px] font-medium text-slate-600 mb-1">
                                  Neck Size
                                </label>
                                <input
                                  type="text"
                                  value={specNeckSize}
                                  onChange={(e) => setSpecNeckSize(e.target.value)}
                                  maxLength={32}
                                  placeholder="28/410"
                                  className="w-full px-2 py-1.5 text-xs font-mono bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-slate-600 mb-1">
                                  Colors
                                </label>
                                <input
                                  type="text"
                                  value={specColorFinish}
                                  onChange={(e) => setSpecColorFinish(e.target.value)}
                                  maxLength={64}
                                  placeholder="e.g. Matte Black / Pantone"
                                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-medium text-slate-600 mb-1">
                                  Dip Tube
                                </label>
                                <input
                                  type="text"
                                  value={specDipTube}
                                  onChange={(e) => setSpecDipTube(e.target.value)}
                                  maxLength={64}
                                  placeholder="e.g. 215mm FBOG"
                                  className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                                />
                              </div>
                            </div>
                            <div className="flex items-center justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setEditingSpecItemId(null)}
                                className="px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-200/70 rounded cursor-pointer"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => handleSaveSpecs(item)}
                                disabled={savingSpecs}
                                className="px-3 py-1 text-[11px] font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded disabled:opacity-60 cursor-pointer"
                              >
                                {savingSpecs ? 'Saving...' : 'Save Specs'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t border-slate-100 text-[11px]">
                            <div>
                              <span className="text-slate-400 block text-[10px]">Neck Size</span>
                              <span className="font-mono font-medium text-slate-800">
                                {item.neckSize || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Colors</span>
                              <span className="font-medium text-slate-800">
                                {item.colorFinish || '—'}
                              </span>
                            </div>
                            <div>
                              <span className="text-slate-400 block text-[10px]">Dip Tube</span>
                              <span className="font-medium text-slate-800">
                                {item.dipTube || '—'}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-2.5 pt-2 border-t border-slate-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="text-xs font-semibold text-slate-800">
                  WhatsApp Quote & Order Update
                </h3>
                <div className="flex items-center gap-1 p-0.5 bg-slate-100 rounded-md">
                  <button
                    type="button"
                    onClick={() => setQuoteMode('both')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded cursor-pointer ${
                      quoteMode === 'both'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    USD + RMB
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuoteMode('USD')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded cursor-pointer ${
                      quoteMode === 'USD'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    USD Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setQuoteMode('CNY')}
                    className={`px-2 py-0.5 text-[11px] font-medium rounded cursor-pointer ${
                      quoteMode === 'CNY'
                        ? 'bg-white text-slate-900 shadow-xs'
                        : 'text-slate-600'
                    }`}
                  >
                    RMB Only
                  </button>
                </div>
              </div>

              <pre className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
                {whatsappMessage}
              </pre>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={handleCopyMessage}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md cursor-pointer"
                >
                  {copiedMsg ? (
                    <>
                      <Check className="w-3 h-3 text-emerald-600" />
                      <span>Copied</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-3 h-3" />
                      <span>Copy Text</span>
                    </>
                  )}
                </button>
                {waUrl && (
                  <a
                    href={waUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md"
                  >
                    <MessageSquare className="w-3 h-3" />
                    <span>Send via WhatsApp</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="px-4 sm:px-6 py-3.5 sm:py-4 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2">
          {confirmDelete ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-rose-700 font-medium">Delete this order?</span>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-md cursor-pointer"
              >
                {deleting ? 'Deleting...' : 'Confirm Delete'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-200 rounded-md cursor-pointer"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 hover:text-rose-800 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Delete Order</span>
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-200 rounded-lg cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

interface AdjustMarginModalProps {
  order: Order;
  products: Product[];
  currency: CurrencyCode;
  usdToRmbRate: number | null;
  onClose: () => void;
  onSaveMargin: (orderId: string, input: CreateOrderInput) => Promise<void>;
}

const MARGIN_PRESETS = [15, 20, 25, 30, 35, 40];

function AdjustMarginModal({
  order,
  products,
  currency,
  usdToRmbRate,
  onClose,
  onSaveMargin,
}: AdjustMarginModalProps) {
  const currentFin = getOrderFinancials(order, usdToRmbRate);
  const orderRate = currentFin.rate;

  const [items, setItems] = useState<OrderDraftItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(true);
  const [targetMarginInput, setTargetMarginInput] = useState(() =>
    currentFin.marginPct.toFixed(1)
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoadingItems(true);
    setError(null);
    fetchOrderItems(order.id, order.ownerId)
      .then((fetched) => {
        if (!active) return;
        setItems(
          fetched.map((item) => {
            const itemFin = getOrderItemFinancials(item, orderRate);
            return {
              productId: item.productId,
              productSku: item.productSku,
              productName: item.productName,
              category: item.category,
              neckSize: item.neckSize,
              colorFinish: item.colorFinish || '',
              dipTube: item.dipTube || '',
              quantity: item.quantity,
              unitFactoryPrice: Number(itemFin.unitFactoryRmb.toFixed(4)),
              unitSellingPrice: Number((itemFin.unitSellingUsd ?? 0).toFixed(4)),
            };
          })
        );
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to load order items.');
        }
      })
      .finally(() => {
        if (active) setLoadingItems(false);
      });

    return () => {
      active = false;
    };
  }, [order.id, order.ownerId, orderRate]);

  const parsedMargin = Number(targetMarginInput);
  const isMarginValid =
    targetMarginInput.trim() !== '' &&
    Number.isFinite(parsedMargin) &&
    parsedMargin >= 0 &&
    parsedMargin <= 95;

  const preview = useMemo(() => {
    const updatedItems: Array<
      OrderDraftItem & {
        unitFactoryUsd: number | null;
        previousSellingUsd: number;
        newSellingUsd: number;
        newLineTotalUsd: number;
      }
    > = [];

    let costRmbSum = 0;
    let revenueUsdSum = 0;

    for (const item of items) {
      const qty = Math.max(1, Math.round(item.quantity));
      const unitFactoryRmb = Number((Math.max(0, Number(item.unitFactoryPrice) || 0)).toFixed(4));
      const unitFactoryUsd = convertRmbToUsd(unitFactoryRmb, orderRate);
      const previousSellingUsd = Number(
        (Math.max(0, Number(item.unitSellingPrice) || 0)).toFixed(4)
      );

      const newSellingUsd =
        isMarginValid && unitFactoryUsd !== null
          ? Number((unitFactoryUsd / (1 - parsedMargin / 100)).toFixed(4))
          : previousSellingUsd;

      costRmbSum += qty * unitFactoryRmb;
      revenueUsdSum += qty * newSellingUsd;

      updatedItems.push({
        ...item,
        unitFactoryPrice: unitFactoryRmb,
        unitSellingPrice: newSellingUsd,
        unitFactoryUsd,
        previousSellingUsd,
        newSellingUsd,
        newLineTotalUsd: qty * newSellingUsd,
      });
    }

    const costRmb = Number(costRmbSum.toFixed(2));
    const costUsd = convertRmbToUsd(costRmb, orderRate);
    const revenueUsd = Number(revenueUsdSum.toFixed(2));
    const revenueRmb = convertUsdToRmb(revenueUsd, orderRate);
    const profitUsd = costUsd !== null ? revenueUsd - costUsd : null;
    const profitRmb = revenueRmb !== null ? revenueRmb - costRmb : null;
    const actualMarginPct =
      revenueUsd > 0 && profitUsd !== null ? (profitUsd / revenueUsd) * 100 : 0;

    return {
      updatedItems,
      costRmb,
      costUsd,
      revenueUsd,
      revenueRmb,
      profitUsd,
      profitRmb,
      actualMarginPct,
    };
  }, [items, orderRate, isMarginValid, parsedMargin]);

  const stepMargin = (delta: number) => {
    const base = Number.isFinite(parsedMargin) ? parsedMargin : currentFin.marginPct;
    const next = Math.min(95, Math.max(0, Number((base + delta).toFixed(1))));
    setTargetMarginInput(String(next));
  };

  const handleApply = async (e: FormEvent) => {
    e.preventDefault();
    if (orderRate === null) {
      setError('Exchange rate is required to recalculate USD selling prices from RMB factory costs.');
      return;
    }
    if (!isMarginValid) {
      setError('Enter a target profit margin between 0% and 95%.');
      return;
    }
    if (items.length === 0) {
      setError('This order has no line items to adjust.');
      return;
    }
    const missingProduct = items.some((i) => !products.some((p) => p.id === i.productId));
    if (missingProduct) {
      setError(
        'One of the line items references a deleted catalog product. Edit the order to update its product first.'
      );
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await onSaveMargin(order.id, {
        orderNumber: order.orderNumber,
        clientId: order.clientId,
        clientName: order.clientName,
        clientWhatsapp: order.clientWhatsapp,
        status: order.status,
        paymentStatus: order.paymentStatus,
        orderDate: order.orderDate,
        exchangeRate: orderRate,
        shippingNotes: order.shippingNotes,
        notes: order.notes,
        items: preview.updatedItems.map((row) => ({
          productId: row.productId,
          productSku: row.productSku,
          productName: row.productName,
          category: row.category,
          neckSize: row.neckSize,
          colorFinish: row.colorFinish || '',
          dipTube: row.dipTube || '',
          quantity: row.quantity,
          unitFactoryPrice: row.unitFactoryPrice,
          unitSellingPrice: row.newSellingUsd,
        })),
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save adjusted profit margin.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-lg max-h-[calc(100dvh-1.25rem)] sm:max-h-[calc(100dvh-2rem)] flex flex-col overflow-hidden my-auto">
        <div className="flex items-center justify-between px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 shrink-0">
          <div>
            <p className="text-[11px] font-mono tabular-nums text-slate-500">
              {order.orderNumber} · {order.clientName}
            </p>
            <h2 className="text-base font-semibold text-slate-900">Adjust Profit Margin</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleApply} className="p-4 sm:p-5 space-y-4 flex-1 overflow-y-auto">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
              <div>
                <label
                  htmlFor="adjust-target-margin"
                  className="block text-xs font-semibold text-slate-800 mb-1"
                >
                  Target Profit Margin (%)
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => stepMargin(-1)}
                    className="px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md cursor-pointer"
                  >
                    -1%
                  </button>
                  <div className="relative w-28">
                    <input
                      id="adjust-target-margin"
                      type="number"
                      min="0"
                      max="95"
                      step="0.1"
                      value={targetMarginInput}
                      onChange={(e) => setTargetMarginInput(e.target.value)}
                      className="w-full pl-3 pr-7 py-1.5 text-sm font-mono tabular-nums font-semibold text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                    />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-mono text-slate-500">
                      %
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => stepMargin(1)}
                    className="px-2.5 py-1.5 text-xs font-mono font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md cursor-pointer"
                  >
                    +1%
                  </button>
                </div>
              </div>

              <div className="text-[11px] font-mono tabular-nums text-slate-600">
                <p>Current margin: {currentFin.marginPct.toFixed(1)}%</p>
                <p>Order rate: 1 USD = ¥{formatExchangeRate(orderRate)} RMB</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              <span className="text-[11px] text-slate-500 mr-1">Quick set:</span>
              {MARGIN_PRESETS.map((preset) => {
                const active = isMarginValid && Math.abs(parsedMargin - preset) < 0.05;
                return (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTargetMarginInput(String(preset))}
                    className={`px-2.5 py-1 text-[11px] font-mono tabular-nums font-medium rounded-md border cursor-pointer transition-colors ${
                      active
                        ? 'bg-teal-700 text-white border-teal-700'
                        : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {preset}%
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-white border border-slate-200 rounded-lg text-xs">
            <div>
              <p className="text-[11px] text-slate-500">Factory Cost (Fixed)</p>
              <div className="mt-0.5">
                <DualPrice
                  rmbAmount={preview.costRmb}
                  usdAmount={preview.costUsd}
                  primaryCurrency={currency}
                  primaryClassName="font-medium text-slate-700"
                />
              </div>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">New Order Total</p>
              <div className="mt-0.5">
                <DualPrice
                  rmbAmount={preview.revenueRmb}
                  usdAmount={preview.revenueUsd}
                  primaryCurrency={currency}
                />
              </div>
            </div>
            <div>
              <p className="text-[11px] text-slate-500">
                New Profit ({preview.actualMarginPct.toFixed(1)}%)
              </p>
              <div className="mt-0.5">
                <DualPrice
                  rmbAmount={preview.profitRmb}
                  usdAmount={preview.profitUsd}
                  primaryCurrency={currency}
                  primaryClassName={
                    (preview.profitUsd ?? 0) >= 0
                      ? 'font-semibold text-emerald-700'
                      : 'font-semibold text-rose-700'
                  }
                  secondaryClassName="text-[11px] text-emerald-700/75"
                />
              </div>
            </div>
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 text-[11px] font-semibold text-slate-600 flex items-center justify-between">
              <span>Unit Pricing Breakdown (Factory Price vs. Selling Price per Unit)</span>
              <span>{items.length} {items.length === 1 ? 'item' : 'items'}</span>
            </div>

            {loadingItems ? (
              <div className="p-4 text-xs text-slate-500">Loading order products...</div>
            ) : (
              <div className="max-h-60 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/60 text-[10px] font-semibold text-slate-500">
                      <th className="py-2 px-3">Product</th>
                      <th className="py-2 px-3 text-right">Factory / unit</th>
                      <th className="py-2 px-3 text-right">New Sell / unit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {preview.updatedItems.map((row, idx) => {
                      const newSellRmb = convertUsdToRmb(row.newSellingUsd, orderRate);
                      return (
                        <tr key={`${row.productId}-${idx}`}>
                          <td className="py-2.5 px-3 align-top">
                            <p className="font-medium text-slate-900">{row.productName}</p>
                            <p className="text-[11px] font-mono tabular-nums text-slate-500">
                              {row.productSku} · {formatCount(row.quantity)} pcs
                            </p>
                          </td>
                          <td className="py-2.5 px-3 text-right align-top font-mono tabular-nums whitespace-nowrap">
                            <p className="font-medium text-slate-800">
                              {formatUnitPriceValue(row.unitFactoryPrice, 'CNY')}/pc
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {formatUnitPriceValue(row.unitFactoryUsd, 'USD')}/pc
                            </p>
                          </td>
                          <td className="py-2.5 px-3 text-right align-top font-mono tabular-nums whitespace-nowrap">
                            <p className="font-semibold text-teal-800">
                              {formatUnitPriceValue(row.newSellingUsd, 'USD')}/pc
                            </p>
                            <p className="text-[11px] text-slate-500">
                              {formatUnitPriceValue(newSellRmb, 'CNY')}/pc
                              {Math.abs(row.previousSellingUsd - row.newSellingUsd) >= 0.0001 && (
                                <span className="ml-1.5 text-slate-400 line-through">
                                  {formatUnitPriceValue(row.previousSellingUsd, 'USD')}
                                </span>
                              )}
                            </p>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {error && (
            <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || loadingItems || !isMarginValid || orderRate === null}
              className="px-5 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg disabled:opacity-60 cursor-pointer"
            >
              {saving ? 'Updating Prices...' : 'Apply Margin'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
