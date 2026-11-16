import { User } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
  writeBatch,
} from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType } from './firebase';
import {
  CATEGORY_META,
  Client,
  ClientInput,
  CreateOrderInput,
  CurrencyCode,
  Factory,
  FactoryInput,
  Order,
  OrderItem,
  OrderStatus,
  PaymentStatus,
  Product,
  ProductInput,
  UserProfile,
  createCleanId,
  truncate,
} from '../types/hub';

export async function ensureUserProfile(user: User): Promise<UserProfile> {
  const path = `users/${user.uid}`;
  const ref = doc(db, 'users', user.uid);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      return snap.data() as UserProfile;
    }
    const profilePayload = {
      uid: user.uid,
      email: truncate(user.email || 'seller@yilaihub.com', 200),
      displayName: truncate(user.displayName || 'Yi Lai Sales', 100),
      companyName: 'Yi Lai Dispensing Packaging',
      defaultCurrency: 'USD' as CurrencyCode,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };
    await setDoc(ref, profilePayload);
    return {
      uid: profilePayload.uid,
      email: profilePayload.email,
      displayName: profilePayload.displayName,
      companyName: profilePayload.companyName,
      defaultCurrency: profilePayload.defaultCurrency,
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function updateUserProfile(
  uid: string,
  updates: {
    displayName: string;
    companyName: string;
    defaultCurrency: CurrencyCode;
    usdToRmbRate?: number | null;
  }
): Promise<void> {
  const path = `users/${uid}`;
  const payload: Record<string, unknown> = {
    displayName: truncate(updates.displayName || 'Yi Lai Sales', 100),
    companyName: truncate(updates.companyName || 'Yi Lai Packaging', 120),
    defaultCurrency: updates.defaultCurrency,
    updatedAt: serverTimestamp(),
  };
  if (
    typeof updates.usdToRmbRate === 'number' &&
    Number.isFinite(updates.usdToRmbRate) &&
    updates.usdToRmbRate >= 0.1 &&
    updates.usdToRmbRate <= 100
  ) {
    payload.usdToRmbRate = Number(updates.usdToRmbRate.toFixed(4));
  }
  try {
    await updateDoc(doc(db, 'users', uid), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeProducts(
  uid: string,
  onData: (products: Product[]) => void,
  onError: (err: Error) => void
) {
  const q = query(collection(db, 'products'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => d.data() as Product)
        .sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'products');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveProduct(
  uid: string,
  input: ProductInput,
  existingId?: string
): Promise<string> {
  const id = existingId || createCleanId('prod');
  const path = `products/${id}`;
  const cleanSku = truncate(
    input.sku.replace(/[^a-zA-Z0-9_\-/. ]/g, '').trim() || `YL-${Date.now().toString().slice(-5)}`,
    64
  );
  const payloadBase = {
    sku: cleanSku,
    name: truncate(input.name || 'Unnamed Dispenser', 140),
    category: input.category,
    neckSize: truncate(input.neckSize || '28/410', 32),
    dosage: truncate(input.dosage || '', 32),
    colorFinish: truncate(input.colorFinish || 'White / Natural', 64),
    factoryPrice: Number(Math.max(0, Math.min(1000000, Number(input.factoryPrice) || 0)).toFixed(4)),
    sellingPrice: Number(Math.max(0, Math.min(1000000, Number(input.sellingPrice) || 0)).toFixed(4)),
    priceCurrency: 'RMB_USD' as const,
    moq: Math.max(1, Math.min(100000000, Math.round(Number(input.moq) || 1000))),
    cartonQty: Math.max(1, Math.min(1000000, Math.round(Number(input.cartonQty) || 500))),
    imageKey: input.imageKey || CATEGORY_META[input.category].imageKey,
    imageUrl: truncate(input.imageUrl || '', 300000),
    boxLengthCm: Math.max(0, Math.min(10000, Number(input.boxLengthCm) || 0)),
    boxWidthCm: Math.max(0, Math.min(10000, Number(input.boxWidthCm) || 0)),
    boxHeightCm: Math.max(0, Math.min(10000, Number(input.boxHeightCm) || 0)),
    grossWeightKg: Math.max(0, Math.min(10000, Number(input.grossWeightKg) || 0)),
    netWeightKg: Math.max(0, Math.min(10000, Number(input.netWeightKg) || 0)),
    factoryId: truncate(input.factoryId || '', 128),
    factoryName: truncate(input.factoryName || '', 140),
    notes: truncate(input.notes || '', 1000),
    updatedAt: serverTimestamp(),
  };

  try {
    if (existingId) {
      await updateDoc(doc(db, 'products', id), payloadBase);
    } else {
      await setDoc(doc(db, 'products', id), {
        id,
        ownerId: uid,
        ...payloadBase,
        createdAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(
      error,
      existingId ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function deleteProduct(productId: string): Promise<void> {
  const path = `products/${productId}`;
  try {
    await deleteDoc(doc(db, 'products', productId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeFactories(
  uid: string,
  onData: (factories: Factory[]) => void,
  onError: (err: Error) => void
) {
  const q = query(collection(db, 'factories'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => d.data() as Factory)
        .sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'factories');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveFactory(
  uid: string,
  input: FactoryInput,
  existingId?: string
): Promise<string> {
  const id = existingId || createCleanId('fac');
  const path = `factories/${id}`;
  const payloadBase = {
    factoryName: truncate(input.factoryName || 'Unnamed Factory', 140),
    contactPerson: truncate(input.contactPerson || 'Factory Sales', 100),
    contactPhone: truncate(input.contactPhone || '', 64),
    location: truncate(input.location || '', 100),
    specialty: truncate(input.specialty || '', 140),
    leadTimeDays: Math.max(1, Math.min(365, Math.round(Number(input.leadTimeDays) || 18))),
    paymentTerms: truncate(input.paymentTerms || '', 140),
    notes: truncate(input.notes || '', 1000),
    updatedAt: serverTimestamp(),
  };

  try {
    if (existingId) {
      await updateDoc(doc(db, 'factories', id), payloadBase);
    } else {
      await setDoc(doc(db, 'factories', id), {
        id,
        ownerId: uid,
        ...payloadBase,
        createdAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(
      error,
      existingId ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function deleteFactory(factoryId: string): Promise<void> {
  const path = `factories/${factoryId}`;
  try {
    await deleteDoc(doc(db, 'factories', factoryId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeClients(
  uid: string,
  onData: (clients: Client[]) => void,
  onError: (err: Error) => void
) {
  const q = query(collection(db, 'clients'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => d.data() as Client)
        .sort((a, b) => (b.updatedAt?.toMillis() ?? 0) - (a.updatedAt?.toMillis() ?? 0));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'clients');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function saveClient(
  uid: string,
  input: ClientInput,
  existingId?: string
): Promise<string> {
  const id = existingId || createCleanId('cli');
  const path = `clients/${id}`;
  const cleanWa = truncate(input.whatsappNumber.trim(), 32);
  const payloadBase = {
    companyName: truncate(input.companyName || 'Unnamed Client', 140),
    contactName: truncate(input.contactName || 'Primary Buyer', 100),
    whatsappNumber: cleanWa.length >= 4 ? cleanWa : '+86 0000 0000',
    country: truncate(input.country || '', 80),
    email: truncate(input.email || '', 200),
    notes: truncate(input.notes || '', 1000),
    updatedAt: serverTimestamp(),
  };

  try {
    if (existingId) {
      await updateDoc(doc(db, 'clients', id), payloadBase);
    } else {
      await setDoc(doc(db, 'clients', id), {
        id,
        ownerId: uid,
        ...payloadBase,
        createdAt: serverTimestamp(),
      });
    }
    return id;
  } catch (error) {
    handleFirestoreError(
      error,
      existingId ? OperationType.UPDATE : OperationType.CREATE,
      path
    );
  }
}

export async function deleteClient(clientId: string): Promise<void> {
  const path = `clients/${clientId}`;
  try {
    await deleteDoc(doc(db, 'clients', clientId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export function subscribeOrders(
  uid: string,
  onData: (orders: Order[]) => void,
  onError: (err: Error) => void
) {
  const q = query(collection(db, 'orders'), where('ownerId', '==', uid));
  return onSnapshot(
    q,
    (snapshot) => {
      const items = snapshot.docs
        .map((d) => d.data() as Order)
        .sort((a, b) => (b.createdAt?.toMillis() ?? 0) - (a.createdAt?.toMillis() ?? 0));
      onData(items);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'orders');
      } catch (wrapped) {
        onError(wrapped as Error);
      }
    }
  );
}

export async function fetchOrderItems(
  orderId: string,
  ownerId?: string
): Promise<OrderItem[]> {
  const path = `orders/${orderId}/items`;
  const uid = ownerId || auth.currentUser?.uid || '';
  try {
    const q = query(
      collection(db, 'orders', orderId, 'items'),
      where('ownerId', '==', uid)
    );
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data() as OrderItem);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function createOrderWithItems(
  uid: string,
  input: CreateOrderInput
): Promise<string> {
  if (!input.items.length) {
    throw new Error('Order must contain at least one product line item.');
  }
  const orderId = createCleanId('ord');
  const path = `orders/${orderId}`;
  const batch = writeBatch(db);

  let totalUnits = 0;
  let totalFactoryCost = 0;
  let totalAmount = 0;

  for (const item of input.items) {
    const qty = Math.max(1, Math.round(item.quantity));
    const fPrice = Number(Math.max(0, Number(item.unitFactoryPrice) || 0).toFixed(4));
    const sPrice = Number(Math.max(0, Number(item.unitSellingPrice) || 0).toFixed(4));
    const lineCost = Number((qty * fPrice).toFixed(4));
    const lineTotal = Number((qty * sPrice).toFixed(4));
    totalUnits += qty;
    totalFactoryCost += lineCost;
    totalAmount += lineTotal;

    const itemId = createCleanId('item');
    batch.set(doc(db, 'orders', orderId, 'items', itemId), {
      id: itemId,
      ownerId: uid,
      orderId,
      productId: item.productId,
      productSku: truncate(item.productSku, 64),
      productName: truncate(item.productName, 140),
      category: item.category,
      neckSize: truncate(item.neckSize || '', 32),
      quantity: qty,
      unitFactoryPrice: fPrice,
      unitSellingPrice: sPrice,
      lineCost,
      lineTotal,
      priceCurrency: 'RMB_USD',
      createdAt: serverTimestamp(),
    });
  }

  const firstItem = input.items[0];
  const extraCount = input.items.length - 1;
  const itemsSummary = truncate(
    extraCount > 0
      ? `${firstItem.productName} (${firstItem.quantity.toLocaleString()} pcs) + ${extraCount} more`
      : `${firstItem.productName} (${firstItem.quantity.toLocaleString()} pcs)`,
    240
  );

  const cleanOrderNum = truncate(
    input.orderNumber.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() ||
      `YL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
    40
  );

  const validRate =
    typeof input.exchangeRate === 'number' &&
    Number.isFinite(input.exchangeRate) &&
    input.exchangeRate >= 0.1 &&
    input.exchangeRate <= 100
      ? Number(input.exchangeRate.toFixed(4))
      : undefined;

  batch.set(doc(db, 'orders', orderId), {
    id: orderId,
    ownerId: uid,
    orderNumber: cleanOrderNum,
    clientId: input.clientId,
    clientName: truncate(input.clientName, 140),
    clientWhatsapp: truncate(input.clientWhatsapp, 32),
    status: input.status,
    paymentStatus: input.paymentStatus,
    primaryCategory: firstItem.category,
    itemsSummary,
    itemCount: input.items.length,
    totalUnits,
    totalFactoryCost: Number(totalFactoryCost.toFixed(2)),
    totalAmount: Number(totalAmount.toFixed(2)),
    priceCurrency: 'RMB_USD',
    ...(validRate !== undefined ? { exchangeRate: validRate } : {}),
    orderDate: truncate(input.orderDate, 32),
    shippingNotes: truncate(input.shippingNotes || '', 500),
    notes: truncate(input.notes || '', 1000),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  try {
    await batch.commit();
    return orderId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateOrderWithItems(
  uid: string,
  orderId: string,
  input: CreateOrderInput
): Promise<void> {
  if (!input.items.length) {
    throw new Error('Order must contain at least one product line item.');
  }
  const path = `orders/${orderId}`;
  try {
    const q = query(
      collection(db, 'orders', orderId, 'items'),
      where('ownerId', '==', uid)
    );
    const existingItemsSnap = await getDocs(q);
    const batch = writeBatch(db);

    existingItemsSnap.docs.forEach((d) => batch.delete(d.ref));

    let totalUnits = 0;
    let totalFactoryCost = 0;
    let totalAmount = 0;

    for (const item of input.items) {
      const qty = Math.max(1, Math.round(item.quantity));
      const fPrice = Number(Math.max(0, Number(item.unitFactoryPrice) || 0).toFixed(4));
      const sPrice = Number(Math.max(0, Number(item.unitSellingPrice) || 0).toFixed(4));
      const lineCost = Number((qty * fPrice).toFixed(4));
      const lineTotal = Number((qty * sPrice).toFixed(4));
      totalUnits += qty;
      totalFactoryCost += lineCost;
      totalAmount += lineTotal;

      const itemId = createCleanId('item');
      batch.set(doc(db, 'orders', orderId, 'items', itemId), {
        id: itemId,
        ownerId: uid,
        orderId,
        productId: item.productId,
        productSku: truncate(item.productSku, 64),
        productName: truncate(item.productName, 140),
        category: item.category,
        neckSize: truncate(item.neckSize || '', 32),
        quantity: qty,
        unitFactoryPrice: fPrice,
        unitSellingPrice: sPrice,
        lineCost,
        lineTotal,
        priceCurrency: 'RMB_USD',
        createdAt: serverTimestamp(),
      });
    }

    const firstItem = input.items[0];
    const extraCount = input.items.length - 1;
    const itemsSummary = truncate(
      extraCount > 0
        ? `${firstItem.productName} (${firstItem.quantity.toLocaleString()} pcs) + ${extraCount} more`
        : `${firstItem.productName} (${firstItem.quantity.toLocaleString()} pcs)`,
      240
    );

    const cleanOrderNum = truncate(
      input.orderNumber.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() ||
        `YL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      40
    );

    const validRate =
      typeof input.exchangeRate === 'number' &&
      Number.isFinite(input.exchangeRate) &&
      input.exchangeRate >= 0.1 &&
      input.exchangeRate <= 100
        ? Number(input.exchangeRate.toFixed(4))
        : undefined;

    batch.update(doc(db, 'orders', orderId), {
      orderNumber: cleanOrderNum,
      clientId: input.clientId,
      clientName: truncate(input.clientName, 140),
      clientWhatsapp: truncate(input.clientWhatsapp, 32),
      status: input.status,
      paymentStatus: input.paymentStatus,
      primaryCategory: firstItem.category,
      itemsSummary,
      itemCount: input.items.length,
      totalUnits,
      totalFactoryCost: Number(totalFactoryCost.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
      priceCurrency: 'RMB_USD',
      ...(validRate !== undefined ? { exchangeRate: validRate } : {}),
      orderDate: truncate(input.orderDate, 32),
      shippingNotes: truncate(input.shippingNotes || '', 500),
      notes: truncate(input.notes || '', 1000),
      updatedAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function updateOrderFields(
  orderId: string,
  updates: {
    status?: OrderStatus;
    paymentStatus?: PaymentStatus;
    exchangeRate?: number;
    shippingNotes?: string;
    notes?: string;
  }
): Promise<void> {
  const path = `orders/${orderId}`;
  const payload: Record<string, unknown> = {
    updatedAt: serverTimestamp(),
  };
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.paymentStatus !== undefined) payload.paymentStatus = updates.paymentStatus;
  if (
    typeof updates.exchangeRate === 'number' &&
    Number.isFinite(updates.exchangeRate) &&
    updates.exchangeRate >= 0.1 &&
    updates.exchangeRate <= 100
  ) {
    payload.exchangeRate = Number(updates.exchangeRate.toFixed(4));
  }
  if (updates.shippingNotes !== undefined) {
    payload.shippingNotes = truncate(updates.shippingNotes, 500);
  }
  if (updates.notes !== undefined) {
    payload.notes = truncate(updates.notes, 1000);
  }
  try {
    await updateDoc(doc(db, 'orders', orderId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteOrderWithItems(
  orderId: string,
  ownerId?: string
): Promise<void> {
  const path = `orders/${orderId}`;
  const uid = ownerId || auth.currentUser?.uid || '';
  try {
    const q = query(
      collection(db, 'orders', orderId, 'items'),
      where('ownerId', '==', uid)
    );
    const itemsSnap = await getDocs(q);
    const batch = writeBatch(db);
    itemsSnap.docs.forEach((d) => batch.delete(d.ref));
    batch.delete(doc(db, 'orders', orderId));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

const LEGACY_RECOVERY_RATE = 7.2;

export async function repairLegacyUsdRecordsToRmb(
  uid: string,
  currentRate?: number | null
): Promise<{ repairedProducts: number; repairedOrders: number }> {
  let repairedProducts = 0;
  let repairedOrders = 0;
  const validCurrentRate =
    typeof currentRate === 'number' &&
    Number.isFinite(currentRate) &&
    currentRate >= 0.1 &&
    currentRate <= 100
      ? Number(currentRate.toFixed(4))
      : null;

  try {
    const productsSnap = await getDocs(
      query(collection(db, 'products'), where('ownerId', '==', uid))
    );
    const legacyProducts = productsSnap.docs.filter((d) => {
      const data = d.data() as Product;
      if (data.priceCurrency === 'RMB_USD') return false;
      if (data.priceCurrency === 'CNY' && validCurrentRate === null) return false;
      return true;
    });

    for (let i = 0; i < legacyProducts.length; i += 400) {
      const chunk = legacyProducts.slice(i, i + 400);
      const batch = writeBatch(db);
      for (const prodDoc of chunk) {
        const data = prodDoc.data() as Product;
        const isCnyMode = data.priceCurrency === 'CNY';
        const repairedFactoryRmb = isCnyMode
          ? Number(Math.max(0, Number(data.factoryPrice) || 0).toFixed(4))
          : Number(
              (Math.max(0, Number(data.factoryPrice) || 0) * LEGACY_RECOVERY_RATE).toFixed(4)
            );
        const repairedSellingUsd =
          isCnyMode && validCurrentRate !== null
            ? Number((Math.max(0, Number(data.sellingPrice) || 0) / validCurrentRate).toFixed(4))
            : Number(Math.max(0, Number(data.sellingPrice) || 0).toFixed(4));

        batch.update(prodDoc.ref, {
          factoryPrice: repairedFactoryRmb,
          sellingPrice: repairedSellingUsd,
          priceCurrency: 'RMB_USD',
          updatedAt: serverTimestamp(),
        });
        repairedProducts += 1;
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'products/legacy_rmb_repair');
  }

  try {
    const ordersSnap = await getDocs(
      query(collection(db, 'orders'), where('ownerId', '==', uid))
    );
    const legacyOrders = ordersSnap.docs.filter(
      (d) => (d.data() as Order).priceCurrency !== 'RMB_USD'
    );

    for (const orderDoc of legacyOrders) {
      const orderData = orderDoc.data() as Order;
      const orderRate =
        typeof orderData.exchangeRate === 'number' &&
        Number.isFinite(orderData.exchangeRate) &&
        orderData.exchangeRate >= 0.1 &&
        orderData.exchangeRate <= 100
          ? Number(orderData.exchangeRate.toFixed(4))
          : orderData.priceCurrency === 'CNY'
            ? validCurrentRate
            : LEGACY_RECOVERY_RATE;

      if (orderRate === null) continue;

      const itemsSnap = await getDocs(
        query(collection(db, 'orders', orderDoc.id, 'items'), where('ownerId', '==', uid))
      );

      const batch = writeBatch(db);
      let sumFactoryRmb = 0;
      let sumSellingUsd = 0;

      for (const itemDoc of itemsSnap.docs) {
        const item = itemDoc.data() as OrderItem;
        const qty = Math.max(1, Math.round(Number(item.quantity) || 1));

        if (item.priceCurrency === 'RMB_USD') {
          sumFactoryRmb += qty * (Number(item.unitFactoryPrice) || 0);
          sumSellingUsd += qty * (Number(item.unitSellingPrice) || 0);
        } else {
          const isCnyItem = item.priceCurrency === 'CNY';
          const repairedFactoryRmb = isCnyItem
            ? Number(Math.max(0, Number(item.unitFactoryPrice) || 0).toFixed(4))
            : Number(
                (Math.max(0, Number(item.unitFactoryPrice) || 0) * LEGACY_RECOVERY_RATE).toFixed(4)
              );
          const repairedSellingUsd = isCnyItem
            ? Number((Math.max(0, Number(item.unitSellingPrice) || 0) / orderRate).toFixed(4))
            : Number(Math.max(0, Number(item.unitSellingPrice) || 0).toFixed(4));
          const repairedLineCostRmb = Number((qty * repairedFactoryRmb).toFixed(4));
          const repairedLineTotalUsd = Number((qty * repairedSellingUsd).toFixed(4));
          sumFactoryRmb += repairedLineCostRmb;
          sumSellingUsd += repairedLineTotalUsd;

          batch.update(itemDoc.ref, {
            unitFactoryPrice: repairedFactoryRmb,
            unitSellingPrice: repairedSellingUsd,
            lineCost: repairedLineCostRmb,
            lineTotal: repairedLineTotalUsd,
            priceCurrency: 'RMB_USD',
          });
        }
      }

      const isCnyOrder = orderData.priceCurrency === 'CNY';
      const totalFactoryCostRmb =
        itemsSnap.docs.length > 0
          ? Number(sumFactoryRmb.toFixed(2))
          : isCnyOrder
            ? Number(Math.max(0, Number(orderData.totalFactoryCost) || 0).toFixed(2))
            : Number(
                (Math.max(0, Number(orderData.totalFactoryCost) || 0) * LEGACY_RECOVERY_RATE).toFixed(
                  2
                )
              );
      const totalAmountUsd =
        itemsSnap.docs.length > 0
          ? Number(sumSellingUsd.toFixed(2))
          : isCnyOrder
            ? Number((Math.max(0, Number(orderData.totalAmount) || 0) / orderRate).toFixed(2))
            : Number(Math.max(0, Number(orderData.totalAmount) || 0).toFixed(2));

      batch.update(orderDoc.ref, {
        totalFactoryCost: totalFactoryCostRmb,
        totalAmount: totalAmountUsd,
        exchangeRate: orderRate,
        priceCurrency: 'RMB_USD',
        updatedAt: serverTimestamp(),
      });

      await batch.commit();
      repairedOrders += 1;
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, 'orders/legacy_rmb_repair');
  }

  return { repairedProducts, repairedOrders };
}

export async function seedStarterCatalogAndClients(
  uid: string,
  exchangeRate?: number | null
): Promise<void> {
  const batch1 = writeBatch(db);
  const nowId = Date.now().toString().slice(-6);

  const fac1Id = `fac_jy_${nowId}_1`;
  const fac2Id = `fac_rh_${nowId}_2`;

  const starterFactories: Array<{ id: string } & FactoryInput> = [
    {
      id: fac1Id,
      factoryName: 'Yuyao Jingyi Dispensing Co., Ltd.',
      contactPerson: 'Chen Wei',
      contactPhone: '+86 138 5742 8810',
      location: 'Yuyao, Ningbo, Zhejiang',
      specialty: 'Trigger Sprayers & Heavy-Duty Lotion Pumps',
      leadTimeDays: 18,
      paymentTerms: '30% deposit, 70% before shipment',
      notes: 'ISO9001 molding workshop. Custom Pantone cap matching MOQ 10,000 pcs.',
    },
    {
      id: fac2Id,
      factoryName: 'Ningbo Ruihua Atomizer Factory',
      contactPerson: 'Lin Mei',
      contactPhone: '+86 139 6781 4402',
      location: 'Cixi, Ningbo, Zhejiang',
      specialty: 'Fine Mist Sprayers & Foam Pumps',
      leadTimeDays: 15,
      paymentTerms: '30% TT deposit, 70% against BL copy',
      notes: 'Fast lead time on 20/410 anodized silver collars and 43/410 foamers.',
    },
  ];

  for (const f of starterFactories) {
    batch1.set(doc(db, 'factories', f.id), {
      id: f.id,
      ownerId: uid,
      factoryName: f.factoryName,
      contactPerson: f.contactPerson,
      contactPhone: f.contactPhone,
      location: f.location,
      specialty: f.specialty,
      leadTimeDays: f.leadTimeDays,
      paymentTerms: f.paymentTerms,
      notes: f.notes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const prod1Id = `prod_trg_${nowId}_1`;
  const prod2Id = `prod_lot_${nowId}_2`;
  const prod3Id = `prod_mst_${nowId}_3`;
  const prod4Id = `prod_fom_${nowId}_4`;

  // Starter products: factoryPrice in RMB, sellingPrice in USD
  const starterProducts: Array<{ id: string } & ProductInput> = [
    {
      id: prod1Id,
      sku: 'YL-TRG-28410',
      name: 'Heavy Duty 28/410 Trigger Sprayer (Stream/Spray/Off)',
      category: 'trigger_sprayer',
      neckSize: '28/410',
      dosage: '1.20 cc',
      colorFinish: 'White / Charcoal Ribbed',
      factoryPrice: 1.044,
      sellingPrice: 0.23,
      moq: 10000,
      cartonQty: 500,
      imageKey: 'trigger_sprayer',
      boxLengthCm: 56,
      boxWidthCm: 38,
      boxHeightCm: 42,
      grossWeightKg: 12.8,
      netWeightKg: 11.6,
      factoryId: fac1Id,
      factoryName: 'Yuyao Jingyi Dispensing Co., Ltd.',
      notes: '304 stainless spring, 210mm dip tube cut to bottle spec, chemical resistant PP.',
    },
    {
      id: prod2Id,
      sku: 'YL-LOT-24410',
      name: 'Brushed Alu-Collar 24/410 Cosmetic Lotion Pump',
      category: 'lotion_pump',
      neckSize: '24/410',
      dosage: '2.00 cc',
      colorFinish: 'Matte Silver / White Lock',
      factoryPrice: 1.152,
      sellingPrice: 0.27,
      moq: 5000,
      cartonQty: 450,
      imageKey: 'lotion_pump',
      boxLengthCm: 52,
      boxWidthCm: 36,
      boxHeightCm: 38,
      grossWeightKg: 10.4,
      netWeightKg: 9.3,
      factoryId: fac1Id,
      factoryName: 'Yuyao Jingyi Dispensing Co., Ltd.',
      notes: 'Left-right lockable actuator, suitable for body lotion & hair conditioner.',
    },
    {
      id: prod3Id,
      sku: 'YL-MST-20410',
      name: 'Knurled Silver 20/410 Fine Mist Atomizer',
      category: 'fine_mist_sprayer',
      neckSize: '20/410',
      dosage: '0.12 ml',
      colorFinish: 'Anodized Silver / Matte Black',
      factoryPrice: 0.6336,
      sellingPrice: 0.155,
      moq: 10000,
      cartonQty: 1000,
      imageKey: 'fine_mist_sprayer',
      boxLengthCm: 48,
      boxWidthCm: 34,
      boxHeightCm: 36,
      grossWeightKg: 9.8,
      netWeightKg: 8.9,
      factoryId: fac2Id,
      factoryName: 'Ningbo Ruihua Atomizer Factory',
      notes: 'Includes frosted PP dust overcap, ultra-fine 45-degree mist plume for toner.',
    },
    {
      id: prod4Id,
      sku: 'YL-FOM-43410',
      name: 'Wide-Neck 43/410 Facial Cleanser Foam Pump',
      category: 'foam_pump',
      neckSize: '43/410',
      dosage: '0.80 ml',
      colorFinish: 'Gloss White',
      factoryPrice: 1.512,
      sellingPrice: 0.34,
      moq: 5000,
      cartonQty: 300,
      imageKey: 'foam_pump',
      boxLengthCm: 58,
      boxWidthCm: 40,
      boxHeightCm: 40,
      grossWeightKg: 11.2,
      netWeightKg: 10.1,
      factoryId: fac2Id,
      factoryName: 'Ningbo Ruihua Atomizer Factory',
      notes: 'Dual mesh screen for dense micro-foam, includes full overcap.',
    },
  ];

  for (const p of starterProducts) {
    batch1.set(doc(db, 'products', p.id), {
      id: p.id,
      ownerId: uid,
      sku: p.sku,
      name: p.name,
      category: p.category,
      neckSize: p.neckSize,
      dosage: p.dosage,
      colorFinish: p.colorFinish,
      factoryPrice: p.factoryPrice,
      sellingPrice: p.sellingPrice,
      priceCurrency: 'RMB_USD',
      moq: p.moq,
      cartonQty: p.cartonQty,
      imageKey: p.imageKey,
      imageUrl: p.imageUrl || '',
      boxLengthCm: p.boxLengthCm || 0,
      boxWidthCm: p.boxWidthCm || 0,
      boxHeightCm: p.boxHeightCm || 0,
      grossWeightKg: p.grossWeightKg || 0,
      netWeightKg: p.netWeightKg || 0,
      factoryId: p.factoryId || '',
      factoryName: p.factoryName || '',
      notes: p.notes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  const cli1Id = `cli_aur_${nowId}_1`;
  const cli2Id = `cli_ver_${nowId}_2`;

  const starterClients: Array<{ id: string } & ClientInput> = [
    {
      id: cli1Id,
      companyName: 'Aurelia Botanics Ltd.',
      contactName: 'Sophia Lim',
      whatsappNumber: '+60 12 394 8821',
      country: 'Malaysia',
      email: 'procurement@aureliabotanics.my',
      notes: 'Prefers 24/410 brushed silver lotion pumps and 20/410 mist atomizers. FOB Ningbo.',
    },
    {
      id: cli2Id,
      companyName: 'VeroClean Homecare Co.',
      contactName: 'Mateo Alvarez',
      whatsappNumber: '+34 612 448 903',
      country: 'Spain',
      email: 'mateo@veroclean.es',
      notes: 'High-volume buyer for 28/410 trigger sprayers. 30% TT deposit, 70% before BL.',
    },
  ];

  for (const c of starterClients) {
    batch1.set(doc(db, 'clients', c.id), {
      id: c.id,
      ownerId: uid,
      companyName: c.companyName,
      contactName: c.contactName,
      whatsappNumber: c.whatsappNumber,
      country: c.country,
      email: c.email,
      notes: c.notes,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  try {
    await batch1.commit();

    // Commit sample orders after clients & products exist (satisfies referential integrity rules)
    await createOrderWithItems(uid, {
      orderNumber: `YL-2026-104`,
      clientId: cli2Id,
      clientName: 'VeroClean Homecare Co.',
      clientWhatsapp: '+34 612 448 903',
      status: 'in_production',
      paymentStatus: 'deposit_paid',
      orderDate: '2026-11-12',
      exchangeRate,
      shippingNotes: '20ft FCL FOB Ningbo · Dip tube length 215mm',
      notes: 'Sample approved Nov 08. 30% deposit received.',
      items: [
        {
          productId: prod1Id,
          productSku: 'YL-TRG-28410',
          productName: 'Heavy Duty 28/410 Trigger Sprayer (Stream/Spray/Off)',
          category: 'trigger_sprayer',
          neckSize: '28/410',
          quantity: 25000,
          unitFactoryPrice: 1.044,
          unitSellingPrice: 0.23,
        },
      ],
    });

    await createOrderWithItems(uid, {
      orderNumber: `YL-2026-105`,
      clientId: cli1Id,
      clientName: 'Aurelia Botanics Ltd.',
      clientWhatsapp: '+60 12 394 8821',
      status: 'confirmed',
      paymentStatus: 'paid',
      orderDate: '2026-11-14',
      exchangeRate,
      shippingNotes: 'Air + Sea split · 180mm & 145mm dip tubes',
      notes: 'Repeat skincare line packaging run.',
      items: [
        {
          productId: prod2Id,
          productSku: 'YL-LOT-24410',
          productName: 'Brushed Alu-Collar 24/410 Cosmetic Lotion Pump',
          category: 'lotion_pump',
          neckSize: '24/410',
          quantity: 10000,
          unitFactoryPrice: 1.152,
          unitSellingPrice: 0.27,
        },
        {
          productId: prod3Id,
          productSku: 'YL-MST-20410',
          productName: 'Knurled Silver 20/410 Fine Mist Atomizer',
          category: 'fine_mist_sprayer',
          neckSize: '20/410',
          quantity: 15000,
          unitFactoryPrice: 0.6336,
          unitSellingPrice: 0.155,
        },
      ],
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'starter_seed');
  }
}
