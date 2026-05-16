import { db } from "../firebase";
import { get, ref, set, update } from "firebase/database";

export const ADMIN_ID = "admin";
export const DEFAULT_ADMIN_PASSWORD = "1234";

export const DEFAULT_STORES = {
  aziziya: { id: "aziziya", name: "محل العزيزية", password: "1111", active: true },
  binomran: { id: "binomran", name: "محل بن عمران", password: "2222", active: true },
  muaither: { id: "muaither", name: "محل معيذر", password: "3333", active: true },
  factory: { id: "factory", name: "المصنع", password: "4444", active: true }
};

function localDateKey(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export const todayKey = () => localDateKey();
export const money = (value) => Number(Number(value || 0).toFixed(3));

const cleanId = (value) =>
  String(value || "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[.#$/[\]]/g, "_")
    .toLowerCase();

function objectToArray(map) {
  return Object.entries(map || {}).map(([id, value]) => ({ id, ...value }));
}

function sortNewest(rows) {
  return rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

function isHiddenInvoice(invoice) {
  return invoice?.hiddenForStore === true;
}

function invoiceDay(invoice) {
  return localDateKey(invoice?.createdAt) || invoice?.day || "";
}

function invoiceMatchesDay(invoice, day) {
  if (!day) return true;
  return invoice?.day === day || localDateKey(invoice?.createdAt) === day;
}

function recordMatchesDay(record, day) {
  if (!day) return true;
  return record?.day === day || localDateKey(record?.createdAt) === day;
}

function recordMatchesRange(record, from, to) {
  const storedDay = record?.day || "";
  const createdDay = localDateKey(record?.createdAt);
  return [storedDay, createdDay].some((value) => value && String(value) >= String(from) && String(value) <= String(to));
}

function invoiceTotal(invoice) {
  if (invoice?.total !== undefined && invoice?.total !== null && invoice?.total !== "") return Number(invoice.total || 0);
  if (invoice?.totalAmount !== undefined && invoice?.totalAmount !== null && invoice?.totalAmount !== "") return Number(invoice.totalAmount || 0);
  if (invoice?.grandTotal !== undefined && invoice?.grandTotal !== null && invoice?.grandTotal !== "") return Number(invoice.grandTotal || 0);
  return (invoice?.items || []).reduce((sum, item) => {
    if (item?.total !== undefined && item?.total !== null && item?.total !== "") return sum + Number(item.total || 0);
    if (item?.lineTotal !== undefined && item?.lineTotal !== null && item?.lineTotal !== "") return sum + Number(item.lineTotal || 0);
    return sum + Number(item.unitPrice || item.price || 0) * Number(item.qty || item.quantity || 0);
  }, 0);
}

export async function ensureInitialData(seedProducts = {}) {
  const rootSnap = await get(ref(db));
  const root = rootSnap.exists() ? rootSnap.val() : {};
  const updates = {};

  if (!root.admin) {
    updates["admin"] = { password: DEFAULT_ADMIN_PASSWORD, createdAt: new Date().toISOString() };
  }

  if (!root.stores) {
    Object.values(DEFAULT_STORES).forEach((store) => {
      updates[`stores/${store.id}/meta`] = store;
      updates[`stores/${store.id}/products`] = seedProducts;
      updates[`stores/${store.id}/invoices`] = {};
      updates[`stores/${store.id}/pendingInvoices`] = {};
      updates[`stores/${store.id}/withdrawals`] = {};
      updates[`stores/${store.id}/expenses`] = {};
      updates[`stores/${store.id}/closings`] = {};
    });
  } else {
    for (const store of Object.values(DEFAULT_STORES)) {
      if (!root.stores?.[store.id]) {
        updates[`stores/${store.id}/meta`] = store;
        updates[`stores/${store.id}/products`] = seedProducts;
        updates[`stores/${store.id}/invoices`] = {};
        updates[`stores/${store.id}/pendingInvoices`] = {};
        updates[`stores/${store.id}/withdrawals`] = {};
        updates[`stores/${store.id}/expenses`] = {};
      }
    }
  }

  if (Object.keys(updates).length) await update(ref(db), updates);
}

export async function getStores() {
  const snap = await get(ref(db, "stores"));
  if (!snap.exists()) return [];
  return Object.entries(snap.val())
    .map(([id, store]) => ({ id, ...(store.meta || {}) }))
    .filter((store) => store.active !== false)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
}

export async function loginStore(storeId, password) {
  if (storeId === ADMIN_ID) {
    const snap = await get(ref(db, "admin/password"));
    const p = snap.exists() ? String(snap.val()) : DEFAULT_ADMIN_PASSWORD;
    return String(password) === p;
  }
  const snap = await get(ref(db, `stores/${storeId}/meta/password`));
  return snap.exists() && String(password) === String(snap.val());
}

export async function addStore({ name, password }) {
  const id = cleanId(name);
  if (!id) throw new Error("اسم المحل غير صحيح");
  const snap = await get(ref(db, `stores/${id}`));
  if (snap.exists()) throw new Error("هذا المحل موجود بالفعل");

  const factorySnap = await get(ref(db, "stores/factory/products"));
  const products = factorySnap.exists() ? factorySnap.val() : {};

  await set(ref(db, `stores/${id}`), {
    meta: { id, name, password, active: true, createdAt: new Date().toISOString() },
    products,
    invoices: {},
    pendingInvoices: {},
    withdrawals: {},
    expenses: {},
    closings: {}
  });
  return { id, name, password, active: true };
}

export async function getProducts(storeId, { q = "", category = "الكل" } = {}) {
  const snap = await get(ref(db, `stores/${storeId}/products`));
  const products = objectToArray(snap.exists() ? snap.val() : {})
    .map((p) => ({ ...p, stock: Number(p.stock || 0) }))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));

  const query = String(q || "").trim().toLowerCase();
  return products.filter((p) => {
    const cat = category === "الكل" || p.category === category;
    const search = !query || String(p.id).includes(query) || String(p.name || "").toLowerCase().includes(query);
    return cat && search;
  });
}

export async function getCategories(storeId) {
  const products = await getProducts(storeId);
  return [...new Set(products.map((p) => p.category || "عام"))].sort((a, b) => a.localeCompare(b, "ar"));
}

export async function getCrossStoreStock(productId) {
  const stores = await getStores();
  const rows = [];
  for (const store of stores) {
    const snap = await get(ref(db, `stores/${store.id}/products/${productId}`));
    rows.push({ storeId: store.id, storeName: store.name, stock: snap.exists() ? Number(snap.val().stock || 0) : 0 });
  }
  return rows;
}

export async function addProductToStoreFromFactory(targetStoreId, { code, name, category, stock }) {
  const id = String(code || "").trim() || cleanId(name);
  if (!id) throw new Error("أدخل كود المنتج");
  const qty = Number(stock || 0);
  if (qty < 0) throw new Error("الكمية غير صحيحة");

  const factoryRef = ref(db, `stores/factory/products/${id}`);
  const targetRef = ref(db, `stores/${targetStoreId}/products/${id}`);
  const [factorySnap, targetSnap] = await Promise.all([get(factoryRef), get(targetRef)]);

  const factoryProduct = factorySnap.exists() ? factorySnap.val() : {
    name: String(name || "").trim(),
    category: String(category || "عام").trim(),
    stock: 0,
    active: true
  };

  if (qty > Number(factoryProduct.stock || 0)) throw new Error("مخزون المصنع غير كافٍ");

  const targetProduct = targetSnap.exists() ? targetSnap.val() : {
    name: factoryProduct.name || String(name || "").trim(),
    category: factoryProduct.category || String(category || "عام").trim(),
    stock: 0,
    active: true
  };

  const updates = {};
  updates[`stores/factory/products/${id}`] = { ...factoryProduct, stock: Number(factoryProduct.stock || 0) - qty };
  updates[`stores/${targetStoreId}/products/${id}`] = { ...targetProduct, stock: Number(targetProduct.stock || 0) + qty };
  updates[`transfers/${Date.now()}`] = {
    fromStoreId: "factory",
    toStoreId: targetStoreId,
    productId: id,
    productName: targetProduct.name,
    qty,
    reason: "إضافة من المصنع",
    day: todayKey(),
    createdAt: new Date().toISOString()
  };
  await update(ref(db), updates);
}

export async function updateProductStock(storeId, productId, { stock, addStock }) {
  const productRef = ref(db, `stores/${storeId}/products/${productId}`);
  const snap = await get(productRef);
  if (!snap.exists()) throw new Error("المنتج غير موجود");
  const current = snap.val();
  let nextStock = Number(current.stock || 0);
  if (stock !== undefined && stock !== null && stock !== "") nextStock = Number(stock || 0);
  nextStock += Number(addStock || 0);
  nextStock = Math.max(0, nextStock);
  await update(productRef, { stock: nextStock });
  return { id: productId, ...current, stock: nextStock };
}

export async function findProductByBarcode(storeId, barcode) {
  const code = String(barcode || "").trim();
  if (!code) return null;
  const snap = await get(ref(db, `stores/${storeId}/products/${code}`));
  if (snap.exists()) return { id: code, ...snap.val() };
  return null;
}

export async function getClients(storeId) {
  const snap = await get(ref(db, `stores/${storeId}/clients`));
  return objectToArray(snap.exists() ? snap.val() : {});
}

export async function ensureClient(storeId, name) {
  const cleanName = String(name || "Customer").trim() || "Customer";
  const id = cleanId(cleanName);
  const snap = await get(ref(db, `stores/${storeId}/clients/${id}`));
  if (!snap.exists()) {
    await set(ref(db, `stores/${storeId}/clients/${id}`), { id, name: cleanName, createdAt: new Date().toISOString() });
  }
  return { id, name: cleanName };
}

function buildInvoiceData(storeId, payload, invoiceId = null) {
  const items = (payload.items || []).map((item) => ({
    productId: String(item.productId),
    productName: item.productName,
    category: item.category || "عام",
    unitPrice: money(item.unitPrice),
    qty: Number(item.qty || 0),
    total: money(Number(item.unitPrice || 0) * Number(item.qty || 0))
  }));
  const total = money(items.reduce((sum, item) => sum + item.total, 0));
  const paidAmount = payload.paidAmount === "" || payload.paidAmount === undefined || payload.paidAmount === null ? total : money(payload.paidAmount);
  return {
    id: invoiceId || `${Date.now()}`,
    storeId,
    customerName: payload.customerName || "Customer",
    seller: payload.seller || "",
    paymentMethod: payload.paymentMethod || "cash",
    paidAmount,
    balance: money(total - paidAmount),
    total,
    notes: payload.notes || "",
    items,
    day: todayKey(),
    createdAt: new Date().toISOString()
  };
}

export async function savePendingInvoice(storeId, payload) {
  const client = await ensureClient(storeId, payload.customerName || "Customer");
  const pending = buildInvoiceData(storeId, { ...payload, customerName: client.name });
  pending.customerId = client.id;
  pending.status = "pending";
  await set(ref(db, `stores/${storeId}/pendingInvoices/${pending.id}`), pending);
  return pending;
}

export async function getPendingInvoices(storeId) {
  const snap = await get(ref(db, `stores/${storeId}/pendingInvoices`));
  return objectToArray(snap.exists() ? snap.val() : {})
    .filter((row) => row.status !== "sold" && row.status !== "cancelled")
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function deletePendingInvoice(storeId, pendingId) {
  await update(ref(db, `stores/${storeId}/pendingInvoices/${pendingId}`), { status: "cancelled", cancelledAt: new Date().toISOString() });
}

export async function saveInvoice(storeId, payload) {
  await ensureClient(storeId, payload.customerName || "Customer");
  const productsSnap = await get(ref(db, `stores/${storeId}/products`));
  const products = productsSnap.exists() ? productsSnap.val() : {};
  const counterSnap = await get(ref(db, `stores/${storeId}/counters/lastInvoiceNumber`));
  const nextNumber = Number(counterSnap.exists() ? counterSnap.val() : 0) + 1;
  const invoiceId = String(nextNumber).padStart(6, "0");
  const invoice = buildInvoiceData(storeId, payload, invoiceId);

  const updates = {};
  for (const item of invoice.items) {
    const p = products[String(item.productId)];
    if (!p) throw new Error(`المنتج ${item.productName} غير موجود`);
    if (Number(p.stock || 0) < Number(item.qty || 0)) throw new Error(`المخزون غير كافٍ: ${item.productName}`);
    updates[`stores/${storeId}/products/${item.productId}/stock`] = Math.max(0, Number(p.stock || 0) - Number(item.qty || 0));
  }
  updates[`stores/${storeId}/invoices/${invoiceId}`] = invoice;
  updates[`stores/${storeId}/counters/lastInvoiceNumber`] = nextNumber;
  await update(ref(db), updates);
  return invoice;
}

export async function sellPendingInvoice(storeId, pendingId) {
  const snap = await get(ref(db, `stores/${storeId}/pendingInvoices/${pendingId}`));
  if (!snap.exists()) throw new Error("الفاتورة المعلقة غير موجودة");
  const invoice = await saveInvoice(storeId, snap.val());
  await update(ref(db, `stores/${storeId}/pendingInvoices/${pendingId}`), { status: "sold", soldInvoiceId: invoice.id, soldAt: new Date().toISOString() });
  return invoice;
}

export async function getInvoices(storeId, day, { includeHidden = false } = {}) {
  const snap = await get(ref(db, `stores/${storeId}/invoices`));
  const rows = objectToArray(snap.exists() ? snap.val() : {});
  return rows
    .filter((i) => includeHidden || !isHiddenInvoice(i))
    .filter((i) => invoiceMatchesDay(i, day))
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function softDeleteInvoice(storeId, invoiceId, deletedBy = "store") {
  await update(ref(db, `stores/${storeId}/invoices/${invoiceId}`), {
    hiddenForStore: true,
    hiddenAt: new Date().toISOString(),
    hiddenBy: deletedBy
  });
}

export async function getHiddenInvoices(storeId, day) {
  const all = await getInvoices(storeId, day, { includeHidden: true });
  return all.filter((i) => i.hiddenForStore);
}

export async function deleteInvoice(storeId, invoiceId) {
  return softDeleteInvoice(storeId, invoiceId);
}

export async function saveWithdrawal(storeId, { amount, reason, day }) {
  const cleanAmount = money(amount || 0);
  if (cleanAmount <= 0) throw new Error("أدخل مبلغ السحب");
  const id = `${Date.now()}`;
  const row = { id, amount: cleanAmount, reason: reason || "بدون سبب", day: day || todayKey(), createdAt: new Date().toISOString() };
  await set(ref(db, `stores/${storeId}/withdrawals/${id}`), row);
  return row;
}

export async function getWithdrawals(storeId, day) {
  const snap = await get(ref(db, `stores/${storeId}/withdrawals`));
  return objectToArray(snap.exists() ? snap.val() : {}).filter((r) => recordMatchesDay(r, day)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
}

export async function saveExpense(storeId, { amount, category, reason, day }) {
  const cleanAmount = money(amount || 0);
  if (cleanAmount <= 0) throw new Error("أدخل مبلغ المصروف");
  const id = `${Date.now()}`;
  const row = { id, amount: cleanAmount, category: category || "عام", reason: reason || "بدون سبب", day: day || todayKey(), createdAt: new Date().toISOString() };
  await set(ref(db, `stores/${storeId}/expenses/${id}`), row);
  return row;
}

export async function getExpenses(storeId, day) {
  const snap = await get(ref(db, `stores/${storeId}/expenses`));
  return objectToArray(snap.exists() ? snap.val() : {}).filter((r) => recordMatchesDay(r, day)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
}

export async function getStoreSummary(storeId, day, { includeHidden = false } = {}) {
  const [products, invoices] = await Promise.all([getProducts(storeId), getInvoices(storeId, day, { includeHidden })]);
  const totalSales = money(invoices.reduce((sum, i) => sum + invoiceTotal(i), 0));
  const totalInvoices = invoices.length;
  const totalItemsSold = invoices.reduce((sum, i) => sum + (i.items || []).reduce((acc, it) => acc + Number(it.qty || 0), 0), 0);
  const byPayment = invoices.reduce((acc, i) => {
    const key = i.paymentMethod || "cash";
    acc[key] = money((acc[key] || 0) + invoiceTotal(i));
    return acc;
  }, { cash: 0, visa: 0, online: 0 });
  const lowStockProducts = products.filter((p) => Number(p.stock || 0) <= 5).slice(0, 20);
  return { storeId, totalSales, totalInvoices, totalItemsSold, byPayment, lowStockProducts };
}

export async function getStoreMoneyStatus(storeId, day) {
  const [summary, withdrawals, expenses] = await Promise.all([getStoreSummary(storeId, day), getWithdrawals(storeId, day), getExpenses(storeId, day)]);
  const totalCash = money(summary.byPayment.cash || 0);
  const totalWithdrawals = money(withdrawals.reduce((s, r) => s + Number(r.amount || 0), 0));
  const totalExpenses = money(expenses.reduce((s, r) => s + Number(r.amount || 0), 0));
  const remainingCash = money(totalCash - totalWithdrawals - totalExpenses);
  return { totalCash, totalWithdrawals, totalExpenses, remainingCash, withdrawals, expenses };
}

export async function saveDayClose(storeId, payload) {
  await set(ref(db, `stores/${storeId}/closings/${payload.day || todayKey()}`), { ...payload, savedAt: new Date().toISOString() });
}

export async function getDayClose(storeId, day) {
  const snap = await get(ref(db, `stores/${storeId}/closings/${day}`));
  return snap.exists() ? snap.val() : null;
}

export async function transferStock({ fromStoreId, toStoreId, productId, qty, reason }) {
  const quantity = Number(qty || 0);
  if (!fromStoreId || !toStoreId || fromStoreId === toStoreId) throw new Error("اختر محلين مختلفين");
  if (!productId || quantity <= 0) throw new Error("أدخل المنتج والكمية");
  const fromSnap = await get(ref(db, `stores/${fromStoreId}/products/${productId}`));
  if (!fromSnap.exists()) throw new Error("المنتج غير موجود في المصدر");
  const from = fromSnap.val();
  if (Number(from.stock || 0) < quantity) throw new Error("مخزون المصدر غير كافٍ");
  const toSnap = await get(ref(db, `stores/${toStoreId}/products/${productId}`));
  const to = toSnap.exists() ? toSnap.val() : { ...from, stock: 0 };
  const id = `${Date.now()}`;
  const row = { id, fromStoreId, toStoreId, productId, productName: from.name, qty: quantity, reason: reason || "", day: todayKey(), createdAt: new Date().toISOString() };
  const updates = {};
  updates[`stores/${fromStoreId}/products/${productId}/stock`] = Number(from.stock || 0) - quantity;
  updates[`stores/${toStoreId}/products/${productId}`] = { ...to, stock: Number(to.stock || 0) + quantity };
  updates[`transfers/${id}`] = row;
  updates[`stores/${fromStoreId}/transfersOut/${id}`] = row;
  updates[`stores/${toStoreId}/transfersIn/${id}`] = row;
  await update(ref(db), updates);
  return row;
}

export async function getTransfers(storeId) {
  const [inSnap, outSnap] = await Promise.all([get(ref(db, `stores/${storeId}/transfersIn`)), get(ref(db, `stores/${storeId}/transfersOut`))]);
  const incoming = objectToArray(inSnap.exists() ? inSnap.val() : {}).map((x) => ({ ...x, direction: "داخل" }));
  const outgoing = objectToArray(outSnap.exists() ? outSnap.val() : {}).map((x) => ({ ...x, direction: "خارج" }));
  return [...incoming, ...outgoing].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
}

export async function getSuppliers(storeId) {
  const snap = await get(ref(db, `stores/${storeId}/suppliers`));
  return objectToArray(snap.exists() ? snap.val() : {});
}

export async function addSupplier(storeId, { name, phone, notes }) {
  const id = cleanId(name);
  if (!id) throw new Error("أدخل اسم المورد");
  await set(ref(db, `stores/${storeId}/suppliers/${id}`), { id, name, phone: phone || "", notes: notes || "", createdAt: new Date().toISOString() });
}

export async function addCashier() { return true; }
export async function getCashiers() { return []; }
export async function loginCashier() { return false; }

export function getOfflineQueue() {
  try { return JSON.parse(localStorage.getItem("offlineQueue") || "[]"); } catch { return []; }
}
export function setOfflineQueue(queue) { localStorage.setItem("offlineQueue", JSON.stringify(queue || [])); }
export function queueOfflineAction(action) {
  const queue = getOfflineQueue();
  queue.push({ id: `${Date.now()}`, ...action, queuedAt: new Date().toISOString() });
  setOfflineQueue(queue);
  return queue.length;
}
export async function syncOfflineQueue() {
  const queue = getOfflineQueue();
  const remaining = [];
  let synced = 0;
  for (const action of queue) {
    try {
      if (action.type === "invoice") await saveInvoice(action.storeId, action.payload);
      if (action.type === "pendingInvoice") await savePendingInvoice(action.storeId, action.payload);
      if (action.type === "expense") await saveExpense(action.storeId, action.payload);
      if (action.type === "withdrawal") await saveWithdrawal(action.storeId, action.payload);
      synced++;
    } catch (error) {
      remaining.push({ ...action, lastError: error.message });
    }
  }
  setOfflineQueue(remaining);
  return { synced, failed: remaining.length };
}

export async function searchProductAllStores(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [];
  const stores = await getStores();
  const resultMap = {};
  for (const store of stores) {
    const products = await getProducts(store.id);
    for (const p of products) {
      if (!String(p.id).includes(q) && !String(p.name || "").toLowerCase().includes(q)) continue;
      if (!resultMap[p.id]) resultMap[p.id] = { id: p.id, name: p.name, category: p.category, stores: [] };
      resultMap[p.id].stores.push({ storeId: store.id, storeName: store.name, stock: p.stock });
    }
  }
  return Object.values(resultMap);
}

export async function getAdminDashboard(day = todayKey()) {
  const stores = await getStores();
  const rows = await Promise.all(stores.map(async (store) => {
    const [invoices, withdrawals, expenses] = await Promise.all([
      getInvoices(store.id, day, { includeHidden: true }),
      getWithdrawals(store.id, day),
      getExpenses(store.id, day)
    ]);
    const visibleInvoices = invoices.filter((i) => !isHiddenInvoice(i));
    const hiddenInvoices = invoices.filter((i) => isHiddenInvoice(i));
    const hiddenInvoicesTotal = money(hiddenInvoices.reduce((sum, i) => sum + invoiceTotal(i), 0));
    const totalSales = money(visibleInvoices.reduce((sum, i) => sum + invoiceTotal(i), 0));
    const totalInvoices = visibleInvoices.length;
    const totalItemsSold = visibleInvoices.reduce((sum, i) => sum + (i.items || []).reduce((acc, it) => acc + Number(it.qty || 0), 0), 0);
    const byPayment = visibleInvoices.reduce((acc, i) => {
      const key = i.paymentMethod || "cash";
      acc[key] = money((acc[key] || 0) + invoiceTotal(i));
      return acc;
    }, { cash: 0, visa: 0, online: 0 });
    const totalCash = money(byPayment.cash || 0);
    const totalWithdrawals = money(withdrawals.reduce((s, r) => s + Number(r.amount || 0), 0));
    const totalExpenses = money(expenses.reduce((s, r) => s + Number(r.amount || 0), 0));
    const remainingCash = money(totalCash - totalWithdrawals - totalExpenses);
    return {
      ...store,
      storeId: store.id,
      totalSales,
      totalInvoices,
      totalItemsSold,
      byPayment,
      lowStockProducts: [],
      totalCash,
      totalWithdrawals,
      totalExpenses,
      remainingCash,
      withdrawals,
      expenses,
      invoices,
      hiddenInvoicesCount: hiddenInvoices.length,
      hiddenInvoicesTotal
    };
  }));
  return {
    day,
    stores: rows,
    totalSales: money(rows.reduce((s, r) => s + Number(r.totalSales || 0), 0)),
    totalCash: money(rows.reduce((s, r) => s + Number(r.totalCash || 0), 0)),
    totalWithdrawals: money(rows.reduce((s, r) => s + Number(r.totalWithdrawals || 0), 0)),
    totalHiddenInvoices: rows.reduce((s, r) => s + Number(r.hiddenInvoicesCount || 0), 0),
    totalHiddenInvoicesSales: money(rows.reduce((s, r) => s + Number(r.hiddenInvoicesTotal || 0), 0))
  };
}

export function getDateRangeByType(type, customFrom, customTo) {
  const now = new Date();
  let from = new Date(now), to = new Date(now);
  if (type === "week") {
    const d = now.getDay();
    from.setDate(now.getDate() - (d === 0 ? 6 : d - 1));
  } else if (type === "month") {
    from = new Date(now.getFullYear(), now.getMonth(), 1);
  } else if (type === "year") {
    from = new Date(now.getFullYear(), 0, 1);
  } else if (type === "custom") {
    from = new Date(customFrom);
    to = new Date(customTo);
  }
  return { from: from.toISOString().slice(0,10), to: to.toISOString().slice(0,10) };
}

export async function getAdminPeriodReport({ type = "week", from, to } = {}) {
  const range = getDateRangeByType(type, from, to);
  const stores = await getStores();
  const rows = await Promise.all(stores.map(async (store) => {
    const [invoicesSnap, expensesSnap] = await Promise.all([
      get(ref(db, `stores/${store.id}/invoices`)),
      get(ref(db, `stores/${store.id}/expenses`))
    ]);
    const invoices = objectToArray(invoicesSnap.exists() ? invoicesSnap.val() : {}).filter((i) => recordMatchesRange(i, range.from, range.to));
    const expenses = objectToArray(expensesSnap.exists() ? expensesSnap.val() : {}).filter((e) => recordMatchesRange(e, range.from, range.to));
    const visibleInvoices = invoices.filter((i) => !isHiddenInvoice(i));
    const totalSales = money(visibleInvoices.reduce((s, i) => s + invoiceTotal(i), 0));
    const totalCash = money(visibleInvoices.filter((i) => i.paymentMethod === "cash").reduce((s, i) => s + invoiceTotal(i), 0));
    const totalVisa = money(visibleInvoices.filter((i) => i.paymentMethod === "visa").reduce((s, i) => s + invoiceTotal(i), 0));
    const totalOnline = money(visibleInvoices.filter((i) => i.paymentMethod === "online").reduce((s, i) => s + invoiceTotal(i), 0));
    const totalExpenses = money(expenses.reduce((s, e) => s + Number(e.amount || 0), 0));
    return { storeId: store.id, storeName: store.name, totalSales, totalCash, totalVisa, totalOnline, totalExpenses, gain: money(totalSales - totalExpenses), invoicesCount: visibleInvoices.length };
  }));
  return {
    range,
    stores: rows,
    totalSales: money(rows.reduce((s,r)=>s+Number(r.totalSales||0),0)),
    totalCash: money(rows.reduce((s,r)=>s+Number(r.totalCash||0),0)),
    totalVisa: money(rows.reduce((s,r)=>s+Number(r.totalVisa||0),0)),
    totalOnline: money(rows.reduce((s,r)=>s+Number(r.totalOnline||0),0)),
    totalExpenses: money(rows.reduce((s,r)=>s+Number(r.totalExpenses||0),0)),
    gain: money(rows.reduce((s,r)=>s+Number(r.gain||0),0))
  };
}

export async function saveAdminExpense({ storeId = "general", amount, category, reason, day }) {
  const cleanAmount = money(amount || 0);
  if (cleanAmount <= 0) throw new Error("أدخل مبلغ المصروف");
  const id = `${Date.now()}`;
  await set(ref(db, `adminExpenses/${id}`), { id, storeId, amount: cleanAmount, category: category || "عام", reason: reason || "بدون سبب", day: day || todayKey(), createdAt: new Date().toISOString() });
}

export async function getAdminExpenses(day) {
  const snap = await get(ref(db, "adminExpenses"));
  return objectToArray(snap.exists() ? snap.val() : {}).filter((e) => recordMatchesDay(e, day)).sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
}
