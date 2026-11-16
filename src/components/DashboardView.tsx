import { useMemo, useState } from 'react';
import {
  ArrowRight,
  ExternalLink,
  MessageSquare,
  Plus,
  Sparkles,
} from 'lucide-react';
import {
  CATEGORY_META,
  Client,
  CurrencyCode,
  ORDER_STATUS_META,
  Order,
  Product,
  ProductCategory,
  formatCount,
  formatExchangeRate,
  formatMoneyValue,
  getOrderFinancials,
  getWhatsappUrl,
} from '../types/hub';
import { DualPrice } from './DualPrice';

interface DashboardViewProps {
  products: Product[];
  clients: Client[];
  orders: Order[];
  loading: boolean;
  currency: CurrencyCode;
  usdToRmbRate: number | null;
  onNavigate: (tab: 'dashboard' | 'products' | 'factories' | 'clients' | 'orders') => void;
  onOpenNewOrder: () => void;
  onSelectOrder: (order: Order) => void;
  onLoadStarterData: () => Promise<void>;
}

export function DashboardView({
  products,
  clients,
  orders,
  loading,
  currency,
  usdToRmbRate,
  onNavigate,
  onOpenNewOrder,
  onSelectOrder,
  onLoadStarterData,
}: DashboardViewProps) {
  const [seeding, setSeeding] = useState(false);

  const metrics = useMemo(() => {
    const activeOrders = orders.filter((o) => o.status !== 'cancelled');

    let totalRevenueRmb: number | null = 0;
    let totalRevenueUsd: number | null = 0;
    let totalCostRmb = 0;
    let totalCostUsd: number | null = 0;
    let totalProfitRmb: number | null = 0;
    let totalProfitUsd: number | null = 0;

    for (const o of activeOrders) {
      const fin = getOrderFinancials(o, usdToRmbRate);
      totalCostRmb += fin.costRmb;

      if (fin.revenueRmb === null || totalRevenueRmb === null) totalRevenueRmb = null;
      else totalRevenueRmb += fin.revenueRmb;

      if (fin.revenueUsd === null || totalRevenueUsd === null) totalRevenueUsd = null;
      else totalRevenueUsd += fin.revenueUsd;

      if (fin.costUsd === null || totalCostUsd === null) totalCostUsd = null;
      else totalCostUsd += fin.costUsd;

      if (fin.profitRmb === null || totalProfitRmb === null) totalProfitRmb = null;
      else totalProfitRmb += fin.profitRmb;

      if (fin.profitUsd === null || totalProfitUsd === null) totalProfitUsd = null;
      else totalProfitUsd += fin.profitUsd;
    }

    const avgMargin =
      totalRevenueUsd !== null && totalRevenueUsd > 0 && totalProfitUsd !== null
        ? (totalProfitUsd / totalRevenueUsd) * 100
        : 0;
    const pipelineOrders = activeOrders.filter((o) => o.status !== 'completed');
    const totalUnits = activeOrders.reduce((sum, o) => sum + o.totalUnits, 0);

    return {
      totalRevenueRmb,
      totalRevenueUsd,
      totalCostRmb,
      totalCostUsd,
      totalProfitRmb,
      totalProfitUsd,
      avgMargin,
      activeOrderCount: activeOrders.length,
      pipelineCount: pipelineOrders.length,
      totalUnits,
    };
  }, [orders, usdToRmbRate]);

  const categoryBreakdown = useMemo(() => {
    const map = new Map<
      ProductCategory,
      {
        revenueRmb: number | null;
        profitRmb: number | null;
        revenueUsd: number | null;
        profitUsd: number | null;
        units: number;
        orders: number;
      }
    >();
    const cats: ProductCategory[] = [
      'trigger_sprayer',
      'lotion_pump',
      'fine_mist_sprayer',
      'foam_pump',
      'cap_closure',
    ];
    for (const c of cats) {
      map.set(c, {
        revenueRmb: 0,
        profitRmb: 0,
        revenueUsd: 0,
        profitUsd: 0,
        units: 0,
        orders: 0,
      });
    }
    for (const o of orders) {
      if (o.status === 'cancelled') continue;
      const entry = map.get(o.primaryCategory);
      if (entry) {
        const fin = getOrderFinancials(o, usdToRmbRate);
        entry.revenueRmb =
          entry.revenueRmb === null || fin.revenueRmb === null
            ? null
            : entry.revenueRmb + fin.revenueRmb;
        entry.profitRmb =
          entry.profitRmb === null || fin.profitRmb === null
            ? null
            : entry.profitRmb + fin.profitRmb;
        entry.revenueUsd =
          entry.revenueUsd === null || fin.revenueUsd === null
            ? null
            : entry.revenueUsd + fin.revenueUsd;
        entry.profitUsd =
          entry.profitUsd === null || fin.profitUsd === null
            ? null
            : entry.profitUsd + fin.profitUsd;
        entry.units += o.totalUnits;
        entry.orders += 1;
      }
    }
    const list = cats.map((cat) => ({
      category: cat,
      label: CATEGORY_META[cat].label,
      ...map.get(cat)!,
    }));
    const maxRevUsd = Math.max(1, ...list.map((x) => x.revenueUsd ?? 0));
    return { list, maxRevUsd };
  }, [orders, usdToRmbRate]);

  const topClients = useMemo(() => {
    const spendMap = new Map<
      string,
      { spendRmb: number | null; spendUsd: number | null; count: number }
    >();
    for (const o of orders) {
      if (o.status === 'cancelled') continue;
      const cur = spendMap.get(o.clientId) || { spendRmb: 0, spendUsd: 0, count: 0 };
      const fin = getOrderFinancials(o, usdToRmbRate);
      cur.spendRmb =
        cur.spendRmb === null || fin.revenueRmb === null
          ? null
          : cur.spendRmb + fin.revenueRmb;
      cur.spendUsd =
        cur.spendUsd === null || fin.revenueUsd === null
          ? null
          : cur.spendUsd + fin.revenueUsd;
      cur.count += 1;
      spendMap.set(o.clientId, cur);
    }
    return clients
      .map((c) => ({
        client: c,
        ...(spendMap.get(c.id) || { spendRmb: 0, spendUsd: 0, count: 0 }),
      }))
      .sort((a, b) => (b.spendUsd ?? 0) - (a.spendUsd ?? 0))
      .slice(0, 5);
  }, [clients, orders, usdToRmbRate]);

  const handleSeed = async () => {
    setSeeding(true);
    try {
      await onLoadStarterData();
    } finally {
      setSeeding(false);
    }
  };

  const isEmptyWorkspace =
    !loading && products.length === 0 && clients.length === 0 && orders.length === 0;

  return (
    <div className="space-y-6">
      {isEmptyWorkspace && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-base font-semibold text-slate-900">
              Welcome to Yi Lai Hub
            </h2>
            <p className="text-xs text-slate-600 max-w-2xl">
              Your workspace is ready. Start by adding your dispensing products (trigger sprayers,
              lotion pumps, fine mist sprayers) and buyer WhatsApp numbers, or load a starter
              sample catalog to explore immediately.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={handleSeed}
              disabled={seeding}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-teal-800 bg-teal-50 hover:bg-teal-100 border border-teal-200 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>{seeding ? 'Loading Sample Data...' : 'Load Starter Catalog & Orders'}</span>
            </button>
            <button
              type="button"
              onClick={() => onNavigate('products')}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Product</span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5 sm:gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Order Revenue (USD & RMB)</p>
          <div className="mt-1.5">
            {loading ? (
              <span className="text-xl font-bold font-mono text-slate-400">—</span>
            ) : (
              <DualPrice
                rmbAmount={metrics.totalRevenueRmb}
                usdAmount={metrics.totalRevenueUsd}
                primaryCurrency={currency}
                primaryClassName="text-xl font-bold text-slate-900"
                secondaryClassName="text-xs font-semibold text-slate-500 mt-0.5"
              />
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-mono tabular-nums">
            {formatCount(metrics.activeOrderCount)} active orders · {formatCount(metrics.totalUnits)} pcs
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Estimated Gross Profit</p>
          <div className="mt-1.5">
            {loading ? (
              <span className="text-xl font-bold font-mono text-slate-400">—</span>
            ) : (
              <DualPrice
                rmbAmount={metrics.totalProfitRmb}
                usdAmount={metrics.totalProfitUsd}
                primaryCurrency={currency}
                primaryClassName="text-xl font-bold text-emerald-700"
                secondaryClassName="text-xs font-semibold text-emerald-700/80 mt-0.5"
              />
            )}
          </div>
          <p className="text-[11px] text-slate-500 mt-2 font-mono tabular-nums">
            {metrics.avgMargin.toFixed(1)}% avg margin · Cost{' '}
            {formatMoneyValue(metrics.totalCostRmb, 'CNY')} /{' '}
            {formatMoneyValue(metrics.totalCostUsd, 'USD')}
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Open Pipeline</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {loading ? '—' : formatCount(metrics.pipelineCount)}
          </p>
          <p className="text-[11px] text-slate-500 mt-2">
            Quoted, confirmed, production & transit
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-medium text-slate-500">Catalog & Clients</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1.5">
            {loading ? '—' : `${products.length} / ${clients.length}`}
          </p>
          <p className="text-[11px] text-slate-500 mt-2 font-mono tabular-nums">
            Rate: 1 USD = ¥{formatExchangeRate(usdToRmbRate)} RMB
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 sm:gap-6 items-start">
        <section className="xl:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-5 py-3.5 sm:py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Recent Orders</h2>
              <p className="text-xs text-slate-500">
                Click any order to update fulfillment status or share USD/RMB quotes on WhatsApp
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onOpenNewOrder}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg cursor-pointer whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New Order</span>
              </button>
              <button
                type="button"
                onClick={() => onNavigate('orders')}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer whitespace-nowrap"
              >
                <span>View All</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {orders.length === 0 ? (
            <div className="py-12 px-6 text-center text-xs text-slate-500">
              No orders recorded yet. Create your first order once you have a product and client
              saved.
            </div>
          ) : (
            <>
              <div className="sm:hidden divide-y divide-slate-100">
                {orders.slice(0, 7).map((order) => {
                  const statusMeta = ORDER_STATUS_META[order.status];
                  const fin = getOrderFinancials(order, usdToRmbRate);
                  return (
                    <div
                      key={order.id}
                      onClick={() => {
                        onSelectOrder(order);
                        onNavigate('orders');
                      }}
                      className="p-4 space-y-2 hover:bg-slate-50/80 transition-colors cursor-pointer text-xs"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono tabular-nums font-semibold text-slate-900">
                          {order.orderNumber}
                        </span>
                        <span
                          className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border rounded-md ${statusMeta.colorClass}`}
                        >
                          {statusMeta.label}
                        </span>
                      </div>
                      <div>
                        <p className="font-medium text-slate-900 truncate">{order.clientName}</p>
                        <p className="text-[11px] text-slate-500 truncate">{order.itemsSummary}</p>
                      </div>
                      <div className="grid grid-cols-2 gap-2 pt-1.5 border-t border-slate-100">
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
                              (fin.profitUsd ?? 0) >= 0
                                ? 'font-semibold text-emerald-700'
                                : 'font-semibold text-rose-700'
                            }
                            secondaryClassName="text-[11px] text-emerald-700/75"
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="hidden sm:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50/70 text-[11px] font-semibold text-slate-500">
                      <th className="py-2.5 px-4">Order #</th>
                      <th className="py-2.5 px-3">Client</th>
                      <th className="py-2.5 px-3">Items</th>
                      <th className="py-2.5 px-3 text-right">Total (USD / RMB)</th>
                      <th className="py-2.5 px-3 text-right">Profit (USD / RMB)</th>
                      <th className="py-2.5 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {orders.slice(0, 7).map((order) => {
                      const statusMeta = ORDER_STATUS_META[order.status];
                      const fin = getOrderFinancials(order, usdToRmbRate);
                      return (
                        <tr
                          key={order.id}
                          onClick={() => {
                            onSelectOrder(order);
                            onNavigate('orders');
                          }}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                        >
                          <td className="py-2.5 px-4 font-mono tabular-nums font-semibold text-slate-900 whitespace-nowrap">
                            {order.orderNumber}
                          </td>
                          <td className="py-2.5 px-3 text-slate-900 font-medium truncate max-w-[140px]">
                            {order.clientName}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600 truncate max-w-[190px]">
                            {order.itemsSummary}
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <DualPrice
                              rmbAmount={fin.revenueRmb}
                              usdAmount={fin.revenueUsd}
                              primaryCurrency={currency}
                              align="right"
                            />
                          </td>
                          <td className="py-2.5 px-3 text-right whitespace-nowrap">
                            <DualPrice
                              rmbAmount={fin.profitRmb}
                              usdAmount={fin.profitUsd}
                              primaryCurrency={currency}
                              align="right"
                              primaryClassName={
                                (fin.profitUsd ?? 0) >= 0
                                  ? 'font-semibold text-emerald-700'
                                  : 'font-semibold text-rose-700'
                              }
                              secondaryClassName="text-[11px] text-emerald-700/75"
                            />
                          </td>
                          <td className="py-2.5 px-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium border rounded-md ${statusMeta.colorClass}`}
                            >
                              {statusMeta.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>

        <div className="xl:col-span-4 space-y-5 sm:space-y-6">
          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Sales by Product Line</h2>
              <button
                type="button"
                onClick={() => onNavigate('products')}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 cursor-pointer"
              >
                Catalog
              </button>
            </div>

            <div className="space-y-3.5">
              {categoryBreakdown.list.map((row) => {
                const pct =
                  (metrics.totalRevenueUsd ?? 0) > 0 && row.revenueUsd !== null
                    ? Math.round((row.revenueUsd / categoryBreakdown.maxRevUsd) * 100)
                    : 0;
                return (
                  <div key={row.category} className="space-y-1">
                    <div className="flex items-start justify-between gap-2 text-xs">
                      <span className="font-medium text-slate-700">{row.label}</span>
                      <DualPrice
                        rmbAmount={row.revenueRmb}
                        usdAmount={row.revenueUsd}
                        primaryCurrency={currency}
                        align="right"
                      />
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-teal-700 rounded-full transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <p className="text-[11px] font-mono tabular-nums text-slate-500">
                      {formatCount(row.units)} pcs · Profit{' '}
                      {formatMoneyValue(row.profitUsd, 'USD')} /{' '}
                      {formatMoneyValue(row.profitRmb, 'CNY')}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="bg-white border border-slate-200 rounded-xl p-5 space-y-3.5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-900">Client WhatsApp Quick Access</h2>
              <button
                type="button"
                onClick={() => onNavigate('clients')}
                className="text-xs font-medium text-teal-700 hover:text-teal-800 cursor-pointer"
              >
                Directory
              </button>
            </div>

            {topClients.length === 0 ? (
              <p className="text-xs text-slate-500 py-3">
                No clients saved yet. Add buyer WhatsApp contacts in the Clients tab.
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {topClients.map(({ client, spendRmb, spendUsd, count }) => {
                  const waUrl = getWhatsappUrl(
                    client.whatsappNumber,
                    `Hello ${client.contactName}, checking in from Yi Lai Hub.`
                  );
                  return (
                    <div
                      key={client.id}
                      className="py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {client.companyName}
                        </p>
                        <p className="text-[11px] font-mono tabular-nums text-slate-500 truncate">
                          {client.whatsappNumber} · {count} orders (
                          {formatMoneyValue(spendUsd, 'USD')} /{' '}
                          {formatMoneyValue(spendRmb, 'CNY')})
                        </p>
                      </div>
                      {waUrl && (
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md shrink-0"
                        >
                          <MessageSquare className="w-3 h-3" />
                          <span>WhatsApp</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
