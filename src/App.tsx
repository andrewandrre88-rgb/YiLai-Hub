import { useEffect, useRef, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import {
  AlertCircle,
  ArrowLeftRight,
  ClipboardList,
  Factory as FactoryIcon,
  LayoutDashboard,
  LogOut,
  Package,
  Plus,
  RefreshCw,
  Settings,
  Users,
} from 'lucide-react';
import { auth } from './lib/firebase';
import { formatRateTimestamp, useExchangeRate } from './lib/exchangeRate';
import {
  createOrderWithItems,
  deleteClient,
  deleteFactory,
  deleteOrderWithItems,
  deleteProduct,
  ensureUserProfile,
  repairLegacyUsdRecordsToRmb,
  saveClient,
  saveFactory,
  saveProduct,
  seedStarterCatalogAndClients,
  subscribeClients,
  subscribeFactories,
  subscribeOrders,
  subscribeProducts,
  updateOrderFields,
  updateOrderWithItems,
  updateUserProfile,
} from './lib/firestoreService';
import {
  Client,
  ClientInput,
  CreateOrderInput,
  CurrencyCode,
  Factory,
  FactoryInput,
  Order,
  OrderStatus,
  PaymentStatus,
  Product,
  ProductInput,
  UserProfile,
  formatExchangeRate,
} from './types/hub';
import { AuthGate } from './components/AuthGate';
import { DashboardView } from './components/DashboardView';
import { ProductsView } from './components/ProductsView';
import { FactoriesView } from './components/FactoriesView';
import { ClientsView } from './components/ClientsView';
import { OrdersView } from './components/OrdersView';
import { WorkspaceSettingsModal } from './components/WorkspaceSettingsModal';

type NavTab = 'dashboard' | 'products' | 'factories' | 'clients' | 'orders';

const NAV_ITEMS: Array<{ id: NavTab; label: string; icon: typeof LayoutDashboard }> = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ClipboardList },
  { id: 'products', label: 'Products', icon: Package },
  { id: 'factories', label: 'Factories', icon: FactoryIcon },
  { id: 'clients', label: 'Clients', icon: Users },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>('dashboard');
  const [products, setProducts] = useState<Product[]>([]);
  const [factories, setFactories] = useState<Factory[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [newOrderModalOpen, setNewOrderModalOpen] = useState(false);
  const [preselectedClient, setPreselectedClient] = useState<Client | null>(null);
  const [preselectedProduct, setPreselectedProduct] = useState<Product | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const lastMigratedKeyRef = useRef<string | null>(null);
  const fx = useExchangeRate();

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      setAuthReady(true);
      if (!nextUser) {
        lastMigratedKeyRef.current = null;
        setProfile(null);
        setProducts([]);
        setFactories([]);
        setClients([]);
        setOrders([]);
        setDataLoading(false);
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (!authReady || !user) return;
    let active = true;
    setDataLoading(true);
    setSyncError(null);

    ensureUserProfile(user)
      .then((prof) => {
        if (active) setProfile(prof);
      })
      .catch((err) => {
        if (active) {
          setSyncError(err instanceof Error ? err.message : 'Unable to load workspace profile.');
        }
      });

    let loadedFlags = { p: false, f: false, c: false, o: false };
    const markLoaded = (key: 'p' | 'f' | 'c' | 'o') => {
      loadedFlags = { ...loadedFlags, [key]: true };
      if (active && loadedFlags.p && loadedFlags.f && loadedFlags.c && loadedFlags.o) {
        setDataLoading(false);
      }
    };

    const handleSubError = (err: Error) => {
      if (active) {
        setSyncError(err.message);
        setDataLoading(false);
      }
    };

    const unsubProducts = subscribeProducts(
      user.uid,
      (list) => {
        if (active) {
          setProducts(list);
          markLoaded('p');
        }
      },
      handleSubError
    );

    const unsubFactories = subscribeFactories(
      user.uid,
      (list) => {
        if (active) {
          setFactories(list);
          markLoaded('f');
        }
      },
      handleSubError
    );

    const unsubClients = subscribeClients(
      user.uid,
      (list) => {
        if (active) {
          setClients(list);
          markLoaded('c');
        }
      },
      handleSubError
    );

    const unsubOrders = subscribeOrders(
      user.uid,
      (list) => {
        if (active) {
          setOrders(list);
          setSelectedOrder((prev) =>
            prev ? list.find((item) => item.id === prev.id) || null : null
          );
          markLoaded('o');
        }
      },
      handleSubError
    );

    return () => {
      active = false;
      unsubProducts();
      unsubFactories();
      unsubClients();
      unsubOrders();
    };
  }, [authReady, user]);

  useEffect(() => {
    if (!authReady || !user) return;
    const rate = fx.usedRate;
    const migrationKey = `${user.uid}:${rate === null ? 'pending' : 'fx'}`;
    if (
      lastMigratedKeyRef.current === `${user.uid}:fx` ||
      lastMigratedKeyRef.current === migrationKey
    ) {
      return;
    }
    lastMigratedKeyRef.current = migrationKey;
    let active = true;
    repairLegacyUsdRecordsToRmb(user.uid, rate).catch((err) => {
      if (active) {
        setSyncError(
          err instanceof Error
            ? err.message
            : 'Unable to migrate order and product pricing modes.'
        );
      }
    });
    return () => {
      active = false;
    };
  }, [authReady, user, fx.usedRate]);

  if (!authReady) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-xs font-medium text-slate-500">Loading Yi Lai Hub...</div>
      </div>
    );
  }

  if (!user) {
    return <AuthGate />;
  }

  const currency: CurrencyCode = profile?.defaultCurrency === 'CNY' ? 'CNY' : 'USD';
  const usdToRmbRate = fx.usedRate;
  const companyName = profile?.companyName || 'Yi Lai Dispensing Packaging';

  const handleSaveProduct = (input: ProductInput, existingId?: string) =>
    saveProduct(user.uid, input, existingId);

  const handleDeleteProduct = (productId: string) => deleteProduct(productId);

  const handleSaveFactory = (input: FactoryInput, existingId?: string) =>
    saveFactory(user.uid, input, existingId);

  const handleDeleteFactory = (factoryId: string) => deleteFactory(factoryId);

  const handleSaveClient = (input: ClientInput, existingId?: string) =>
    saveClient(user.uid, input, existingId);

  const handleDeleteClient = (clientId: string) => deleteClient(clientId);

  const handleCreateOrder = (input: CreateOrderInput) =>
    createOrderWithItems(user.uid, input);

  const handleEditOrder = (orderId: string, input: CreateOrderInput) =>
    updateOrderWithItems(user.uid, orderId, input);

  const handleUpdateOrder = (
    orderId: string,
    updates: {
      status?: OrderStatus;
      paymentStatus?: PaymentStatus;
      exchangeRate?: number;
      shippingNotes?: string;
      notes?: string;
    }
  ) => updateOrderFields(orderId, updates);

  const handleDeleteOrder = (orderId: string) => deleteOrderWithItems(orderId);

  const handleSaveSettings = async (updates: {
    displayName: string;
    companyName: string;
    defaultCurrency: CurrencyCode;
    usdToRmbRate?: number | null;
  }) => {
    await updateUserProfile(user.uid, updates);
    setProfile((prev) =>
      prev
        ? {
            ...prev,
            displayName: updates.displayName,
            companyName: updates.companyName,
            defaultCurrency: updates.defaultCurrency,
            ...(typeof updates.usdToRmbRate === 'number'
              ? { usdToRmbRate: updates.usdToRmbRate }
              : {}),
          }
        : {
            uid: user.uid,
            email: user.email || '',
            displayName: updates.displayName,
            companyName: updates.companyName,
            defaultCurrency: updates.defaultCurrency,
            ...(typeof updates.usdToRmbRate === 'number'
              ? { usdToRmbRate: updates.usdToRmbRate }
              : {}),
          }
    );
  };

  const handleTogglePrimaryCurrency = async () => {
    const nextCurrency: CurrencyCode = currency === 'CNY' ? 'USD' : 'CNY';
    await handleSaveSettings({
      displayName: profile?.displayName || user.displayName || 'Yi Lai Sales',
      companyName,
      defaultCurrency: nextCurrency,
      usdToRmbRate,
    });
  };

  const openNewOrder = (client?: Client | null, product?: Product | null) => {
    setPreselectedClient(client || null);
    setPreselectedProduct(product || null);
    setActiveTab('orders');
    setNewOrderModalOpen(true);
  };

  const tabTitles: Record<NavTab, string> = {
    dashboard: 'Integrated Dashboard',
    products: 'Dispensing Products Catalog',
    factories: 'Manufacturing Factories',
    clients: 'Clients & WhatsApp Directory',
    orders: 'Order History & Pipeline',
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex md:w-60 lg:w-64 md:flex-col md:fixed md:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="px-5 py-5 border-b border-slate-200">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap block">
            Yi Lai Hub
          </span>
          <p className="text-[11px] text-slate-500 truncate mt-0.5">{companyName}</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-teal-50 text-teal-900 font-semibold'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      active ? 'text-teal-700' : 'text-slate-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </span>
                {item.id === 'products' && products.length > 0 && (
                  <span className="font-mono tabular-nums text-[11px] text-slate-400">
                    {products.length}
                  </span>
                )}
                {item.id === 'factories' && factories.length > 0 && (
                  <span className="font-mono tabular-nums text-[11px] text-slate-400">
                    {factories.length}
                  </span>
                )}
                {item.id === 'clients' && clients.length > 0 && (
                  <span className="font-mono tabular-nums text-[11px] text-slate-400">
                    {clients.length}
                  </span>
                )}
                {item.id === 'orders' && orders.length > 0 && (
                  <span className="font-mono tabular-nums text-[11px] text-slate-400">
                    {orders.length}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="px-3 pb-2">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-slate-500">Dual Currency</span>
              <button
                type="button"
                onClick={() => void fx.refreshRate()}
                disabled={fx.isRefreshing}
                className="inline-flex items-center gap-1 text-[11px] font-medium text-teal-700 hover:text-teal-800 disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${fx.isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh rate</span>
              </button>
            </div>

            <div className="space-y-1">
              <label
                htmlFor="sidebar-exchange-rate"
                className="block text-[11px] font-medium text-slate-700"
              >
                Exchange rate (1 USD = ? RMB)
              </label>
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] font-mono text-slate-500 shrink-0">¥</span>
                <input
                  id="sidebar-exchange-rate"
                  type="number"
                  step="0.0001"
                  min="0.1"
                  max="100"
                  value={fx.rateInput}
                  onChange={(e) => fx.setManualRate(e.target.value)}
                  placeholder="0.0000"
                  className="w-full px-2 py-1 text-xs font-mono tabular-nums font-semibold text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
                <span className="text-[11px] font-mono text-slate-500 shrink-0">RMB</span>
              </div>
              <p className="text-[10px] leading-snug text-slate-500">
                {fx.isRefreshing && fx.source === 'loading'
                  ? 'Fetching live rate...'
                  : fx.source === 'live' && fx.updatedAt
                    ? `Live rate, updated ${formatRateTimestamp(fx.updatedAt)}`
                    : fx.source === 'manual' && fx.updatedAt
                      ? `Manual rate, edited ${formatRateTimestamp(fx.updatedAt)}`
                      : fx.source === 'cached' && fx.updatedAt
                        ? `Saved rate from ${formatRateTimestamp(fx.updatedAt)}`
                        : 'No rate loaded'}
              </p>
            </div>

            {fx.warning && (
              <div className="px-2 py-1.5 bg-amber-50 border border-amber-200 rounded-md text-[10px] leading-snug text-amber-800">
                {fx.warning}
              </div>
            )}

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <label
                htmlFor="sidebar-safety-margin"
                className="text-[11px] font-medium text-slate-700 shrink-0"
              >
                Safety margin %
              </label>
              <div className="flex items-center gap-1">
                <input
                  id="sidebar-safety-margin"
                  type="number"
                  step="0.1"
                  min="0"
                  max="99"
                  value={fx.marginInput}
                  onChange={(e) => fx.setMarginInput(e.target.value)}
                  className="w-16 px-2 py-1 text-right text-xs font-mono tabular-nums text-slate-900 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-teal-700/20 focus:border-teal-700"
                />
                <span className="text-[11px] font-mono text-slate-500">%</span>
              </div>
            </div>

            <div className="pt-1.5 border-t border-slate-200/80 space-y-0.5 text-[11px] font-mono tabular-nums">
              <div className="flex items-center justify-between text-slate-500">
                <span>{fx.isManual ? 'Manual rate' : 'Live rate'}</span>
                <span>1 USD = ¥{formatExchangeRate(fx.baseRate)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-teal-800">
                <span>Rate used</span>
                <span>1 USD = ¥{formatExchangeRate(fx.usedRate)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleTogglePrimaryCurrency}
              className="w-full flex items-center justify-between px-2.5 py-1.5 bg-white border border-slate-200 hover:border-slate-300 rounded-md text-[11px] font-medium text-slate-700 cursor-pointer"
            >
              <span>{currency === 'CNY' ? 'RMB (¥) first' : 'USD ($) first'}</span>
              <ArrowLeftRight className="w-3 h-3 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="p-3 border-t border-slate-200 space-y-1">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Workspace Settings</span>
          </button>
          <button
            type="button"
            onClick={() => signOut(auth)}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium text-slate-600 hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
          >
            <LogOut className="w-4 h-4 text-slate-400" />
            <span>Sign Out</span>
          </button>
          <div className="px-3 pt-2 text-[11px] text-slate-400 truncate">
            {profile?.displayName || user.email}
          </div>
        </div>
      </aside>

      {/* Main Content Viewport */}
      <div className="flex-1 md:pl-60 lg:pl-64 flex flex-col min-h-screen pb-16 md:pb-0">
        <header className="bg-white border-b border-slate-200 px-5 sm:px-8 py-4 flex items-center justify-between gap-6 sticky top-0 z-20">
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-slate-500 truncate">
              Yi Lai Hub <span aria-hidden="true">/</span> {tabTitles[activeTab]}{' '}
              <span aria-hidden="true">·</span>{' '}
              <span className="font-mono tabular-nums">USD & RMB (1:{formatExchangeRate(usdToRmbRate)})</span>
            </p>
            <h1 className="font-display text-lg font-bold text-slate-900 truncate">
              {tabTitles[activeTab]}
            </h1>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 cursor-pointer"
              aria-label="Workspace settings"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => openNewOrder(null, null)}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>New Order</span>
            </button>
          </div>
        </header>

        <main className="flex-1 px-5 sm:px-8 py-6 max-w-7xl w-full mx-auto space-y-5">
          {syncError && (
            <div className="bg-rose-50 border border-rose-200 rounded-xl px-4 py-3 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="min-w-0">
                <p className="font-semibold">Database Sync Error</p>
                <p className="mt-0.5 break-words">{syncError}</p>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <DashboardView
              products={products}
              clients={clients}
              orders={orders}
              loading={dataLoading}
              currency={currency}
              usdToRmbRate={usdToRmbRate}
              onNavigate={setActiveTab}
              onOpenNewOrder={() => openNewOrder(null, null)}
              onSelectOrder={setSelectedOrder}
              onLoadStarterData={() => seedStarterCatalogAndClients(user.uid, usdToRmbRate)}
            />
          )}

          {activeTab === 'products' && (
            <ProductsView
              products={products}
              factories={factories}
              loading={dataLoading}
              currency={currency}
              usdToRmbRate={usdToRmbRate}
              onSaveProduct={handleSaveProduct}
              onDeleteProduct={handleDeleteProduct}
              onQuickOrderProduct={(prod) => openNewOrder(null, prod)}
            />
          )}

          {activeTab === 'factories' && (
            <FactoriesView
              factories={factories}
              products={products}
              loading={dataLoading}
              currency={currency}
              usdToRmbRate={usdToRmbRate}
              onSaveFactory={handleSaveFactory}
              onDeleteFactory={handleDeleteFactory}
              onNavigateToProducts={() => setActiveTab('products')}
            />
          )}

          {activeTab === 'clients' && (
            <ClientsView
              clients={clients}
              orders={orders}
              loading={dataLoading}
              currency={currency}
              usdToRmbRate={usdToRmbRate}
              onSaveClient={handleSaveClient}
              onDeleteClient={handleDeleteClient}
              onNewOrderForClient={(client) => openNewOrder(client, null)}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersView
              orders={orders}
              clients={clients}
              products={products}
              loading={dataLoading}
              currency={currency}
              usdToRmbRate={usdToRmbRate}
              preselectedClient={preselectedClient}
              preselectedProduct={preselectedProduct}
              newOrderModalOpen={newOrderModalOpen}
              onOpenNewOrder={() => openNewOrder(null, null)}
              onCloseNewOrder={() => {
                setNewOrderModalOpen(false);
                setPreselectedClient(null);
                setPreselectedProduct(null);
              }}
              onCreateOrder={handleCreateOrder}
              onEditOrder={handleEditOrder}
              onUpdateOrder={handleUpdateOrder}
              onDeleteOrder={handleDeleteOrder}
              selectedOrder={selectedOrder}
              onSelectOrder={setSelectedOrder}
            />
          )}
        </main>
      </div>

      {/* Mobile Bottom Navigation (compact <= 60px) */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 z-30 grid grid-cols-5">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveTab(item.id)}
              className={`py-2.5 flex flex-col items-center justify-center gap-1 text-[11px] font-medium cursor-pointer ${
                active ? 'text-teal-700 font-semibold' : 'text-slate-500'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {settingsOpen && profile && (
        <WorkspaceSettingsModal
          profile={profile}
          fx={fx}
          onClose={() => setSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}
    </div>
  );
}
