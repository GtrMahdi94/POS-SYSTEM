import { db } from "../firebase";
import { get, ref, remove, set, update } from "firebase/database";

const paymentLabels = { cash: "كاش", visa: "فيزا", online: "أونلاين" };
const todayKey = () => new Date().toISOString().slice(0, 10);
const money = (value) => Number(Number(value || 0).toFixed(3));

function normalizeProductsMap(snapshotValue) {
  const data = snapshotValue || {};
  return Object.entries(data).map(([id, value]) => ({ id: Number(id), ...value }))
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "ar"));
}

// export async function getMeta() {
//   const snap = await get(ref(db, "meta"));
//   const data = snap.exists() ? snap.val() : { sellers: [], categories: [] };
//   return {
//     sellers: data.sellers || [],
//     categories: data.categories || []
//   };
// }

export async function getMeta() {
  // const db = getDatabase();

  const [sellersSnap, productsSnap] = await Promise.all([
    get(ref(db, "sellers")),
    get(ref(db, "products"))
  ]);

  let sellers = [];
  if (sellersSnap.exists()) {
    const rawSellers = sellersSnap.val();

    if (Array.isArray(rawSellers)) {
      sellers = rawSellers
        .filter((item) => typeof item === "string" && item.trim() !== "")
        .map((item) => item.trim());
    } else if (rawSellers && typeof rawSellers === "object") {
      sellers = Object.values(rawSellers)
        .map((item) =>
          typeof item === "string"
            ? item
            : item?.name || item?.Valeur || ""
        )
        .filter((item) => typeof item === "string" && item.trim() !== "")
        .map((item) => item.trim());
    }
  }

  let categories = [];
  if (productsSnap.exists()) {
    const rawProducts = productsSnap.val();
    categories = [
      ...new Set(
        Object.values(rawProducts)
          .map((p) => String(p?.category || "").trim())
          .filter(Boolean)
      )
    ];
  }

  return { sellers, categories };
}

export async function getProducts({ q = "", category = "الكل" } = {}) {
  const snap = await get(ref(db, "products"));
  const all = normalizeProductsMap(snap.exists() ? snap.val() : {});
  const query = String(q || "").trim().toLowerCase();
  return all.filter((product) => {
    const matchCategory = category === "الكل" || product.category === category;
    const matchQuery = !query || String(product.id).includes(query) || String(product.name || "").toLowerCase().includes(query) || String(product.category || "").toLowerCase().includes(query);
    return matchCategory && matchQuery;
  });
}

export async function addProduct({ name, category, stock }) {
  const products = await getProducts({ q: "", category: "الكل" });
  const nextId = products.reduce((max, item) => Math.max(max, Number(item.id) || 0), 10000) + 1;
  const clean = {
    name: String(name || "").trim(),
    category: String(category || "").trim(),
    stock: Math.max(0, Number(stock || 0)),
    active: true
  };
  await set(ref(db, `products/${nextId}`), clean);

  const meta = await getMeta();
  const categories = Array.from(new Set([...(meta.categories || []), clean.category])).filter(Boolean).sort((a, b) => a.localeCompare(b, "ar"));
  await update(ref(db, "meta"), { categories });
  return { id: nextId, ...clean };
}

export async function updateProductStock(id, { stock, addStock }) {
  const productRef = ref(db, `products/${id}`);
  const snap = await get(productRef);
  if (!snap.exists()) throw new Error("المنتج غير موجود");
  const current = snap.val();
  let nextStock = Number(current.stock || 0);
  if (stock !== undefined && stock !== null && stock !== "") nextStock = Number(stock || 0);
  nextStock += Number(addStock || 0);
  nextStock = Math.max(0, nextStock);
  await update(productRef, { stock: nextStock });
  return { id: Number(id), ...current, stock: nextStock };
}

async function getInvoicesMap() {
  const snap = await get(ref(db, "invoices"));
  return snap.exists() ? snap.val() : {};
}

async function getClosingsMap() {
  const snap = await get(ref(db, "closings"));
  return snap.exists() ? snap.val() : {};
}

export async function getInvoices(day) {
  const map = await getInvoicesMap();
  return Object.values(map)
    .filter((invoice) => !day || invoice.day === day)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

export async function saveInvoice(payload) {
  const productsSnap = await get(ref(db, "products"));
  const productsMap = productsSnap.exists() ? productsSnap.val() : {};
  const counterSnap = await get(ref(db, "counters/lastInvoiceNumber"));
  const nextNumber = Number(counterSnap.exists() ? counterSnap.val() : 0) + 1;
  const invoiceId = String(nextNumber).padStart(6, "0");
  const day = todayKey();

  const items = (payload.items || []).map((item) => {
    const product = productsMap[String(item.productId)];
    if (!product) throw new Error(`المنتج ${item.productName} غير موجود`);
    if (Number(product.stock || 0) < Number(item.qty || 0)) throw new Error(`المخزون غير كافٍ للمنتج: ${item.productName}`);
    return {
      productId: Number(item.productId),
      productName: item.productName,
      category: item.category,
      unitPrice: money(item.unitPrice),
      qty: Number(item.qty || 0),
      total: money(Number(item.unitPrice || 0) * Number(item.qty || 0))
    };
  });

  const total = money(items.reduce((sum, item) => sum + item.total, 0));
  const paidAmount = payload.paidAmount === "" || payload.paidAmount === undefined || payload.paidAmount === null ? total : money(payload.paidAmount);
  const invoice = {
    id: invoiceId,
    customerName: payload.customerName || "زبون مباشر",
    seller: payload.seller || "",
    paymentMethod: payload.paymentMethod || "cash",
    paidAmount,
    balance: money(total - paidAmount),
    total,
    notes: payload.notes || "",
    items,
    createdAt: new Date().toISOString(),
    day
  };

  const updates = {};
  updates[`invoices/${invoiceId}`] = invoice;
  updates[`counters/lastInvoiceNumber`] = nextNumber;
  for (const item of items) {
    const current = productsMap[String(item.productId)];
    updates[`products/${item.productId}/stock`] = Math.max(0, Number(current.stock || 0) - Number(item.qty || 0));
  }
  await update(ref(db), updates);
  return invoice;
}

export async function deleteInvoice(invoiceId) {
  const invoiceSnap = await get(ref(db, `invoices/${invoiceId}`));
  if (!invoiceSnap.exists()) throw new Error("الفاتورة غير موجودة");
  const invoice = invoiceSnap.val();
  const updates = {};
  for (const item of invoice.items || []) {
    const productSnap = await get(ref(db, `products/${item.productId}`));
    if (productSnap.exists()) {
      const current = productSnap.val();
      updates[`products/${item.productId}/stock`] = Number(current.stock || 0) + Number(item.qty || 0);
    }
  }
  await update(ref(db), updates);
  await remove(ref(db, `invoices/${invoiceId}`));
  return true;
}

export async function getSummary(day) {
  const [productsSnap, invoicesMap] = await Promise.all([get(ref(db, "products")), getInvoicesMap()]);
  const products = normalizeProductsMap(productsSnap.exists() ? productsSnap.val() : {});
  const invoices = Object.values(invoicesMap).filter((invoice) => !day || invoice.day === day);
  const totalSales = money(invoices.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0));
  const totalInvoices = invoices.length;
  const totalItemsSold = invoices.reduce((sum, invoice) => sum + (invoice.items || []).reduce((acc, item) => acc + Number(item.qty || 0), 0), 0);
  const byPayment = invoices.reduce((acc, invoice) => {
    const key = invoice.paymentMethod || "cash";
    acc[key] = money((acc[key] || 0) + Number(invoice.total || 0));
    return acc;
  }, { cash: 0, visa: 0, online: 0 });
  const bySeller = invoices.reduce((acc, invoice) => {
    const key = invoice.seller || "غير محدد";
    acc[key] = money((acc[key] || 0) + Number(invoice.total || 0));
    return acc;
  }, {});
  const lowStockProducts = products.filter((product) => Number(product.stock || 0) <= 5).sort((a, b) => Number(a.stock || 0) - Number(b.stock || 0)).slice(0, 20);
  return { totalSales, totalInvoices, totalItemsSold, byPayment, bySeller, lowStockProducts, paymentLabels };
}

export async function getDailySeries() {
  const invoicesMap = await getInvoicesMap();
  const bucket = {};
  Object.values(invoicesMap).forEach((invoice) => {
    const day = invoice.day || todayKey();
    bucket[day] = bucket[day] || { day, cash: 0, visa: 0, online: 0, total: 0 };
    const total = Number(invoice.total || 0);
    bucket[day].total = money(bucket[day].total + total);
    const pm = invoice.paymentMethod || "cash";
    bucket[day][pm] = money((bucket[day][pm] || 0) + total);
  });
  return Object.values(bucket).sort((a, b) => b.day.localeCompare(a.day));
}

export async function saveDayClose({ day, actualCash, actualVisa, actualOnline, notes }) {
  const summary = await getSummary(day);
  const expected = {
    cash: money(summary.byPayment.cash || 0),
    visa: money(summary.byPayment.visa || 0),
    online: money(summary.byPayment.online || 0)
  };
  const actual = {
    cash: money(actualCash || 0),
    visa: money(actualVisa || 0),
    online: money(actualOnline || 0)
  };
  const rows = ["cash", "visa", "online"].map((paymentMethod) => ({
    paymentMethod,
    expected: expected[paymentMethod],
    actual: actual[paymentMethod],
    difference: money(actual[paymentMethod] - expected[paymentMethod]),
    missing: money(Math.max(0, expected[paymentMethod] - actual[paymentMethod]))
  }));
  const closing = {
    day,
    expected,
    actual,
    rows,
    notes: notes || "",
    savedAt: new Date().toISOString()
  };
  await set(ref(db, `closings/${day}`), closing);
  return closing;
}

export async function getDayClose(day) {
  const closings = await getClosingsMap();
  return closings[day] || null;
}
