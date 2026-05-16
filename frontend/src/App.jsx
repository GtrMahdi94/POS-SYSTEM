import React, { useEffect, useMemo, useState } from "react";
import logo from "./assets/logo.jpeg";
import { seedProducts, seedSellers } from "./seedData";
import {
  ADMIN_ID,
  addStore,
  addProductToStoreFromFactory,
  addSupplier,
  deletePendingInvoice,
  ensureInitialData,
  findProductByBarcode,
  getAdminDashboard,
  getAdminExpenses,
  getAdminPeriodReport,
  getCategories,
  getClients,
  getCrossStoreStock,
  getDayClose,
  getExpenses,
  getInvoices,
  getPendingInvoices,
  getProducts,
  getStoreMoneyStatus,
  getStoreSummary,
  getStores,
  getSuppliers,
  getTransfers,
  getWithdrawals,
  loginStore,
  money,
  queueOfflineAction,
  saveAdminExpense,
  saveDayClose,
  saveExpense,
  saveInvoice,
  savePendingInvoice,
  saveWithdrawal,
  searchProductAllStores,
  sellPendingInvoice,
  softDeleteInvoice,
  syncOfflineQueue,
  todayKey,
  transferStock,
  updateProductStock
} from "./services/firebaseDb";

const paymentLabels = { cash: "كاش", visa: "فيزا", online: "أونلاين" };
const formatDateTime = (value) => new Intl.DateTimeFormat("en-GB", {
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
}).format(new Date(value));
const isHiddenInvoice = (invoice) => invoice?.hiddenForStore === true;

function printHtml(title, html) {
  const win = window.open("", "_blank", "width=1000,height=800");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" /><title>${title}</title>
  <style>
    body{font-family:Arial,sans-serif;background:#fff;color:#111;padding:24px;direction:rtl}
    table{width:100%;border-collapse:collapse;margin-top:14px;background:#fff}
    th,td{border:1px solid #ccc;padding:10px;text-align:right;background:#fff;color:#111}
    th{background:#f5f5f5}.brand{display:flex;align-items:center;gap:16px;margin-bottom:20px}
    .brand img{width:70px;height:70px;object-fit:contain;border:1px solid #d4a63f;border-radius:16px;padding:6px}
    .cards{display:grid;grid-template-columns:repeat(2,minmax(280px,1fr));gap:16px}.card{border:1px solid #ddd;border-radius:14px;padding:16px;background:#fff}
    .row{display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid #eee}
  </style></head><body>${html}</body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function printThermalReceipt(invoice, storeName) {
  const win = window.open("", "_blank", "width=380,height=700");
  if (!win) return;
  const rows = (invoice.items || []).map((item) => {
    const qty = Number(item.qty || 0);
    const price = money(item.unitPrice || 0);
    const total = money(item.total || Number(item.unitPrice || 0) * qty);
    return `<div class="item">
      <div class="item-name">${item.productName || ""}</div>
      <div class="item-line"><span>${qty} x ${price}</span><strong>${total}</strong></div>
    </div>`;
  }).join("");
  const total = money(invoice.total || 0);
  const paid = money(invoice.paidAmount ?? total);
  const balance = money(invoice.balance || 0);
  win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" /><title>Ticket ${invoice.id}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; }
    body { margin: 0; background: #fff; color: #000; font-family: Arial, Tahoma, sans-serif; font-size: 12px; direction: rtl; }
    .ticket { width: 80mm; padding: 4mm 3mm; }
    .center { text-align: center; }
    h1 { margin: 0 0 3px; font-size: 18px; font-weight: 800; }
    .muted { font-size: 11px; }
    .line { border-top: 1px dashed #000; margin: 8px 0; }
    .row, .item-line { display: flex; justify-content: space-between; gap: 8px; align-items: flex-start; }
    .item { margin: 6px 0; break-inside: avoid; }
    .item-name { font-weight: 700; margin-bottom: 2px; }
    .total { font-size: 15px; font-weight: 800; }
    .thanks { margin-top: 10px; font-size: 12px; }
    @media print {
      html, body { width: 80mm; }
      .ticket { width: 80mm; }
    }
  </style></head><body><div class="ticket">
    <div class="center">
      <h1>الملكي</h1>
      <div>${storeName || ""}</div>
      <div class="muted">فاتورة بيع</div>
    </div>
    <div class="line"></div>
    <div class="row"><span>رقم الفاتورة</span><strong>${invoice.id}</strong></div>
    <div class="row"><span>التاريخ</span><strong>${formatDateTime(invoice.createdAt)}</strong></div>
    <div class="row"><span>العميل</span><strong>${invoice.customerName || "Customer"}</strong></div>
    <div class="row"><span>الدفع</span><strong>${paymentLabels[invoice.paymentMethod] || invoice.paymentMethod || ""}</strong></div>
    <div class="line"></div>
    ${rows}
    <div class="line"></div>
    <div class="row total"><span>الإجمالي</span><strong>${total} ر.ق</strong></div>
    <div class="row"><span>المدفوع</span><strong>${paid} ر.ق</strong></div>
    <div class="row"><span>الباقي</span><strong>${balance} ر.ق</strong></div>
    ${invoice.notes ? `<div class="line"></div><div>${invoice.notes}</div>` : ""}
    <div class="line"></div>
    <div class="center thanks">شكرا لزيارتكم</div>
  </div></body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function LoginPage({ stores, onLogin, loading, message }) {
  const [selected, setSelected] = useState("");
  const [password, setPassword] = useState("");
  useEffect(() => { if (!selected && stores.length) setSelected(stores[0].id); }, [stores, selected]);
  return (
    <div className="login-page" dir="rtl">
      <div className="login-card">
        <img src={logo} alt="logo" />
        <h1>الملكي</h1>
        <p>اختر المحل أو الدخول كمدير النظام</p>
        <select value={selected} onChange={(e) => setSelected(e.target.value)}>
          {stores.map((store) => <option key={store.id} value={store.id}>{store.name}</option>)}
          <option value={ADMIN_ID}>Administrateur</option>
        </select>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="كلمة المرور" onKeyDown={(e) => e.key === "Enter" && onLogin(selected, password)} />
        <button onClick={() => onLogin(selected, password)} disabled={loading}>{loading ? "جارٍ الدخول..." : "دخول"}</button>
        {message && <div className="login-message">{message}</div>}
        <div className="login-help">العزيزية 1111 / بن عمران 2222 / معيذر 3333 / المصنع 4444 / الأدمن 1234</div>
      </div>
    </div>
  );
}

function ProductCard({ product, onAdd, onCheckStock }) {
  return (
    <div className="product-card">
      <button className="product-main" onClick={() => onAdd(product)}>
        <div className="product-icon">🛍️</div>
        <div className="product-name">{product.name}</div>
        <div className="product-meta"><span>{product.category}</span><span>المخزون: {product.stock}</span></div>
        <div className="product-footer no-price-footer"><span className="muted-text">بدون سعر محفوظ</span><span className="add-pill">إضافة</span></div>
      </button>
      <button className="secondary-btn small-btn full-width" onClick={() => onCheckStock(product)}>مخزون المحلات</button>
    </div>
  );
}

function CartItem({ item, onInc, onDec, onRemove, onPriceChange }) {
  return (
    <div className="cart-item">
      <div className="cart-item-top"><div><div className="cart-title">{item.name}</div><div className="cart-subtitle">{item.category}</div></div><button className="ghost-btn danger" onClick={() => onRemove(item.id)}>حذف</button></div>
      <div className="cart-price-row"><label>سعر البيع</label><input type="number" min="0" step="0.001" value={item.price} onChange={(e) => onPriceChange(item.id, e.target.value)} placeholder="أدخل السعر" /></div>
      <div className="cart-item-bottom"><div className="qty-box"><button onClick={() => onInc(item.id)}>+</button><span>{item.qty}</span><button onClick={() => onDec(item.id)}>-</button></div><strong>{money(item.lineTotal)} ر.ق</strong></div>
    </div>
  );
}

function StockModal({ product, rows, onClose }) {
  if (!product) return null;
  return (
    <div className="modal-backdrop">
      <div className="modal-card">
        <h3>مخزون المنتج في كل المحلات</h3>
        <p><strong>{product.name}</strong> - كود: {product.id}</p>
        <table className="products-table"><thead><tr><th>المحل</th><th>المخزون</th></tr></thead><tbody>{rows.map((row) => <tr key={row.storeId}><td>{row.storeName}</td><td>{row.stock}</td></tr>)}</tbody></table>
        <button className="primary-btn" onClick={onClose}>إغلاق</button>
      </div>
    </div>
  );
}

function StorePOS({ session, onLogout }) {
  const canUseFactoryTools = session.storeId === "factory";
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [customerName, setCustomerName] = useState("Customer");
  const [clients, setClients] = useState([]);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState([]);
  const [activeTab, setActiveTab] = useState("pos");
  const [message, setMessage] = useState("");
  const [latestInvoice, setLatestInvoice] = useState(null);
  const [pendingInvoices, setPendingInvoices] = useState([]);
  const [day, setDay] = useState(todayKey());
  const [summary, setSummary] = useState(null);
  const [invoices, setInvoices] = useState([]);
  const [cashStatus, setCashStatus] = useState(null);
  const [withdrawals, setWithdrawals] = useState([]);
  const [withdrawForm, setWithdrawForm] = useState({ amount: "", reason: "" });
  const [expenses, setExpenses] = useState([]);
  const [expenseForm, setExpenseForm] = useState({ amount: "", category: "", reason: "" });
  const [suppliers, setSuppliers] = useState([]);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", notes: "" });
  const [stores, setStores] = useState([]);
  const [transfers, setTransfers] = useState([]);
  const [transferForm, setTransferForm] = useState({ toStoreId: "", productId: "", qty: "", reason: "" });
  const [barcode, setBarcode] = useState("");
  const [stockModal, setStockModal] = useState({ product: null, rows: [] });
  const [offlineInfo, setOfflineInfo] = useState({ online: navigator.onLine, pending: 0 });
  const [factoryAddForm, setFactoryAddForm] = useState({ targetStoreId: "", code: "", name: "", category: "عام", stock: "" });

  const loadProducts = async () => setProducts(await getProducts(session.storeId, { q: query, category: selectedCategory }));
  const loadMeta = async () => {
    setCategories(await getCategories(session.storeId));
    setClients(await getClients(session.storeId));
    setSuppliers(await getSuppliers(session.storeId));
    setStores(await getStores());
    setTransfers(await getTransfers(session.storeId));
  };
  const loadReports = async () => {
    setSummary(await getStoreSummary(session.storeId, day));
    setInvoices(await getInvoices(session.storeId, day));
    setPendingInvoices(await getPendingInvoices(session.storeId));
    setCashStatus(await getStoreMoneyStatus(session.storeId, day));
    setWithdrawals(await getWithdrawals(session.storeId, day));
    setExpenses(await getExpenses(session.storeId, day));
  };
  const refreshAll = async () => Promise.all([loadProducts(), loadMeta(), loadReports()]);

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { loadProducts(); }, [query, selectedCategory]);
  useEffect(() => { loadReports(); }, [day]);

  useEffect(() => {
    const updateOnline = async () => {
      if (navigator.onLine) {
        const result = await syncOfflineQueue();
        if (result.synced) {
          setMessage(`تمت مزامنة ${result.synced} عملية أوفلاين.`);
          await refreshAll();
        }
      }
      setOfflineInfo({ online: navigator.onLine, pending: JSON.parse(localStorage.getItem("offlineQueue") || "[]").length });
    };
    window.addEventListener("online", updateOnline);
    window.addEventListener("offline", updateOnline);
    updateOnline();
    return () => { window.removeEventListener("online", updateOnline); window.removeEventListener("offline", updateOnline); };
  }, []);

  const addToCart = (product) => {
    setCart((prev) => {
      const found = prev.find((item) => item.id === product.id);
      if (found) {
        if (found.qty >= product.stock) return prev;
        const qty = found.qty + 1;
        return prev.map((item) => item.id === product.id ? { ...item, qty, lineTotal: qty * Number(item.price || 0) } : item);
      }
      return [...prev, { ...product, price: 0, qty: 1, lineTotal: 0 }];
    });
  };
  const changeQty = (id, delta) => setCart((prev) => prev.map((item) => {
    if (item.id !== id) return item;
    const qty = Math.max(0, Math.min(item.stock, item.qty + delta));
    return { ...item, qty, lineTotal: qty * Number(item.price || 0) };
  }).filter((item) => item.qty > 0));
  const changePrice = (id, value) => setCart((prev) => prev.map((item) => item.id !== id ? item : ({ ...item, price: Number(value || 0), lineTotal: Number(value || 0) * item.qty })));
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.lineTotal, 0), [cart]);

  const payload = () => ({
    customerName: customerName || "Customer",
    seller: session.storeName,
    paymentMethod,
    paidAmount: paidAmount === "" ? total : Number(paidAmount),
    notes,
    items: cart.map((item) => ({ productId: item.id, productName: item.name, category: item.category, unitPrice: Number(item.price), qty: item.qty }))
  });
  const validateCart = () => {
    if (!cart.length) return setMessage("أضف منتجًا واحدًا على الأقل."), false;
    if (cart.some((item) => Number(item.price || 0) <= 0)) return setMessage("أدخل سعر البيع لكل المنتجات."), false;
    return true;
  };
  const completeSale = async () => {
    if (!validateCart()) return;
    try {
      if (!navigator.onLine) {
        queueOfflineAction({ type: "pendingInvoice", storeId: session.storeId, payload: payload() });
        setMessage("لا يوجد إنترنت: تم حفظ الفاتورة كمعلقة أوفلاين.");
      } else {
        await savePendingInvoice(session.storeId, payload());
        setMessage("تم حفظ الفاتورة في فواتير معلقة.");
      }
      setCart([]); setPaidAmount(""); setNotes(""); setCustomerName("Customer");
      await refreshAll(); setActiveTab("pending");
    } catch (e) { setMessage(e.message); }
  };
  const directSell = async () => {
    if (!validateCart()) return;
    try {
      let invoice;
      if (!navigator.onLine) {
        queueOfflineAction({ type: "invoice", storeId: session.storeId, payload: payload() });
        setMessage("تم حفظ البيع أوفلاين.");
      } else {
        invoice = await saveInvoice(session.storeId, payload());
        setLatestInvoice(invoice);
        setMessage("تم البيع وتحديث المخزون.");
      }
      setCart([]); setPaidAmount(""); setNotes(""); setCustomerName("Customer");
      await refreshAll(); if (invoice) setActiveTab("invoice");
    } catch (e) { setMessage(e.message); }
  };
  const sellPending = async (id) => {
    try {
      const invoice = await sellPendingInvoice(session.storeId, id);
      setLatestInvoice(invoice); setMessage("تم بيع الفاتورة المعلقة.");
      await refreshAll(); setActiveTab("invoice");
    } catch (e) { setMessage(e.message); }
  };
  const cancelPending = async (id) => {
    if (!window.confirm("آخر قرار ؟")) return;
    await deletePendingInvoice(session.storeId, id);
    await refreshAll();
  };

  const checkStock = async (product) => setStockModal({ product, rows: await getCrossStoreStock(product.id) });
  const scanBarcode = async () => {
    const product = await findProductByBarcode(session.storeId, barcode);
    if (!product) return setMessage("لم يتم العثور على منتج بهذا الباركود.");
    addToCart(product); setBarcode("");
  };

  const reprintInvoice = (invoice) => {
    const rows = invoice.items.map((item, index) => `<tr><td>${index + 1}</td><td>${item.productName}</td><td>${item.qty}</td><td>${money(item.unitPrice)}</td><td>${money(item.total)}</td></tr>`).join("");
    printHtml(`فاتورة ${invoice.id}`, `<div class="brand"><img src="${logo}"/><div><h2>الملكي</h2><p>${session.storeName}</p></div></div><p>رقم الفاتورة: ${invoice.id}</p><p>العميل: ${invoice.customerName}</p><table><thead><tr><th>#</th><th>المنتج</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table><h3>الإجمالي: ${money(invoice.total)} ر.ق</h3>`);
  };
  const printInvoice = () => latestInvoice && reprintInvoice(latestInvoice);
  const printThermal = () => latestInvoice && printThermalReceipt(latestInvoice, session.storeName);
  const removeInvoice = async (id) => {
    if (!window.confirm("آخر قرار ؟")) return;
    await softDeleteInvoice(session.storeId, id, session.storeName);
    await refreshAll();
  };

  const addWithdrawal = async () => {
    await saveWithdrawal(session.storeId, { ...withdrawForm, day });
    setWithdrawForm({ amount: "", reason: "" }); await refreshAll();
  };
  const addExpense = async () => {
    await saveExpense(session.storeId, { ...expenseForm, day });
    setExpenseForm({ amount: "", category: "", reason: "" }); await refreshAll();
  };
  const createSupplier = async () => {
    await addSupplier(session.storeId, supplierForm);
    setSupplierForm({ name: "", phone: "", notes: "" }); await loadMeta();
  };
  const makeTransfer = async () => {
    await transferStock({ fromStoreId: session.storeId, ...transferForm });
    setTransferForm({ toStoreId: "", productId: "", qty: "", reason: "" }); await refreshAll();
  };
  const addFactoryStockToStore = async () => {
    await addProductToStoreFromFactory(factoryAddForm.targetStoreId, factoryAddForm);
    setFactoryAddForm({ targetStoreId: "", code: "", name: "", category: "عام", stock: "" });
    await refreshAll();
  };

  return (
    <div className="app-shell" dir="rtl">
      <header className="topbar">
        <div className="brand-block"><img className="brand-logo" src={logo} alt="logo" /><div><h1>الملكي</h1><p>{session.storeName}</p></div></div>
        <div className="offline-status no-print"><span className={offlineInfo.online ? "pos" : "neg"}>{offlineInfo.online ? "Online" : "Offline"}</span><small>ينتظر: {offlineInfo.pending}</small></div>
        <div className="tabs no-print">
          <button className={activeTab === "pos" ? "active" : ""} onClick={() => setActiveTab("pos")}>المبيعات</button>
          <button className={activeTab === "pending" ? "active" : ""} onClick={() => setActiveTab("pending")}>فواتير معلقة</button>
          <button className={activeTab === "invoice" ? "active" : ""} onClick={() => setActiveTab("invoice")}>الفاتورة</button>
          <button className={activeTab === "reports" ? "active" : ""} onClick={() => setActiveTab("reports")}>التقارير</button>
          <button className={activeTab === "products" ? "active" : ""} onClick={() => setActiveTab("products")}>المنتجات</button>
          <button onClick={onLogout}>خروج</button>
        </div>
      </header>
      {message && <div className="message">{message}</div>}

      {activeTab === "pos" && (
        <div className="layout">
          <section className="products-section">
            <div className="toolbar no-print">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم أو الكود" />
              <input value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={(e) => e.key === "Enter" && scanBarcode()} placeholder="امسح الباركود هنا" />
              <button className="secondary-btn" onClick={scanBarcode}>إضافة بالباركود</button>
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}><option value="الكل">الكل</option>{categories.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            </div>
            <div className="products-grid">{products.map((p) => <ProductCard key={p.id} product={p} onAdd={addToCart} onCheckStock={checkStock} />)}</div>
          </section>
          <aside className="sidebar no-print">
            <div className="panel">
              <h3>بيانات البيع</h3>
              <div className="form-grid">
                <div className="smart-client-wrap">
                  <input value={customerName} onChange={(e) => { setCustomerName(e.target.value); setShowClientSuggestions(true); }} onFocus={() => setShowClientSuggestions(true)} placeholder="اسم العميل" />
                  {showClientSuggestions && <div className="smart-client-list">
                    {clients.filter((c) => String(c.name || "").toLowerCase().includes(String(customerName || "").toLowerCase())).slice(0,8).map((c) => <button key={c.id} type="button" onClick={() => { setCustomerName(c.name); setShowClientSuggestions(false); }}>{c.name}</button>)}
                    <button type="button" onClick={() => { setCustomerName("Customer"); setShowClientSuggestions(false); }}>Customer</button>
                  </div>}
                </div>
                <input value={session.storeName} readOnly />
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>{Object.entries(paymentLabels).map(([v,l]) => <option key={v} value={v}>{l}</option>)}</select>
                <input type="number" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="المبلغ المدفوع" />
              </div>
              <textarea rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات" />
            </div>
            <div className="panel">
              <h3>السلة</h3>
              <div className="cart-list">{!cart.length && <div className="empty-box">أضف منتجات إلى السلة.</div>}{cart.map((item) => <CartItem key={item.id} item={item} onInc={(id) => changeQty(id, 1)} onDec={(id) => changeQty(id, -1)} onRemove={(id) => setCart((prev) => prev.filter((x) => x.id !== id))} onPriceChange={changePrice} />)}</div>
              <div className="totals-box"><div><span>عدد الأصناف</span><strong>{cart.length}</strong></div><div><span>الإجمالي</span><strong>{money(total)} ر.ق</strong></div></div>
              <div className="actions"><button className="secondary-btn" onClick={() => setCart([])}>تفريغ السلة</button><button className="secondary-btn" onClick={completeSale}>حفظ الفاتورة</button><button className="primary-btn" onClick={directSell}>بيع</button></div>
            </div>
          </aside>
        </div>
      )}

      {activeTab === "pending" && <div className="reports-page"><div className="report-card span-2"><h3>فواتير معلقة</h3><table className="products-table"><thead><tr><th>رقم</th><th>التاريخ</th><th>العميل</th><th>الدفع</th><th>الإجمالي</th><th>إجراءات</th></tr></thead><tbody>{pendingInvoices.map((i) => <tr key={i.id}><td>{i.id}</td><td>{formatDateTime(i.createdAt)}</td><td>{i.customerName}</td><td>{paymentLabels[i.paymentMethod]}</td><td>{money(i.total)} ر.ق</td><td><button className="primary-btn small-btn" onClick={() => sellPending(i.id)}>بيع</button><button className="ghost-btn danger" onClick={() => cancelPending(i.id)}>إلغاء</button></td></tr>)}{!pendingInvoices.length && <tr><td colSpan="6">لا توجد فواتير معلقة.</td></tr>}</tbody></table></div></div>}

      {activeTab === "invoice" && <div className="report-card">{!latestInvoice ? <p>لا توجد فاتورة محفوظة بعد.</p> : <><h2>فاتورة بيع</h2><p>رقم الفاتورة: {latestInvoice.id}</p><p>الإجمالي: {money(latestInvoice.total)} ر.ق</p><button className="primary-btn" onClick={printInvoice}>طباعة الفاتورة / حفظ PDF</button><button className="secondary-btn" onClick={printThermal}>طباعة حرارية</button></>}</div>}

      {activeTab === "reports" && (
        <div className="reports-page">
          <div className="report-card"><div className="report-actions-grid"><input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></div></div>
          <div className="reports-grid">
            <div className="report-card"><h3>ملخص اليوم</h3><div className="low-stock-list"><div className="low-stock-row"><span>إجمالي البيع</span><strong>{money(summary?.totalSales)} ر.ق</strong></div><div className="low-stock-row"><span>عدد الفواتير</span><strong>{summary?.totalInvoices || 0}</strong></div><div className="low-stock-row"><span>كاش</span><strong>{money(summary?.byPayment?.cash)} ر.ق</strong></div></div></div>
            <div className="report-card"><h3>كاش المحل</h3><div className="low-stock-list"><div className="low-stock-row"><span>إجمالي الكاش</span><strong>{money(cashStatus?.totalCash)} ر.ق</strong></div><div className="low-stock-row"><span>السحبيات</span><strong className="neg">{money(cashStatus?.totalWithdrawals)} ر.ق</strong></div><div className="low-stock-row"><span>المصاريف</span><strong className="neg">{money(cashStatus?.totalExpenses)} ر.ق</strong></div><div className="low-stock-row"><span>الباقي</span><strong className="pos">{money(cashStatus?.remainingCash)} ر.ق</strong></div></div></div>
            <div className="report-card"><h3>سحبيات</h3><div className="form-grid"><input type="number" value={withdrawForm.amount} onChange={(e)=>setWithdrawForm({...withdrawForm, amount:e.target.value})} placeholder="مبلغ السحب"/><input value={withdrawForm.reason} onChange={(e)=>setWithdrawForm({...withdrawForm, reason:e.target.value})} placeholder="سبب السحب"/><button className="primary-btn" onClick={addWithdrawal}>حفظ السحب</button></div>{withdrawals.map((w)=><div className="withdrawal-row" key={w.id}><div><strong>{money(w.amount)} ر.ق</strong><span>{w.reason}</span></div><small>{formatDateTime(w.createdAt)}</small></div>)}</div>
            <div className="report-card"><h3>مصاريف</h3><div className="form-grid"><input type="number" value={expenseForm.amount} onChange={(e)=>setExpenseForm({...expenseForm, amount:e.target.value})} placeholder="المبلغ"/><input value={expenseForm.category} onChange={(e)=>setExpenseForm({...expenseForm, category:e.target.value})} placeholder="التصنيف"/><input value={expenseForm.reason} onChange={(e)=>setExpenseForm({...expenseForm, reason:e.target.value})} placeholder="السبب"/><button className="primary-btn" onClick={addExpense}>حفظ المصروف</button></div>{expenses.map((ex)=><div className="withdrawal-row" key={ex.id}><div><strong>{money(ex.amount)} ر.ق</strong><span>{ex.category} - {ex.reason}</span></div></div>)}</div>
            {canUseFactoryTools && <div className="report-card"><h3>الموردين</h3><div className="form-grid"><input value={supplierForm.name} onChange={(e)=>setSupplierForm({...supplierForm,name:e.target.value})} placeholder="اسم المورد"/><input value={supplierForm.phone} onChange={(e)=>setSupplierForm({...supplierForm,phone:e.target.value})} placeholder="الهاتف"/><input value={supplierForm.notes} onChange={(e)=>setSupplierForm({...supplierForm,notes:e.target.value})} placeholder="ملاحظات"/><button className="primary-btn" onClick={createSupplier}>حفظ المورد</button></div>{suppliers.map((s)=><div className="withdrawal-row" key={s.id}><div><strong>{s.name}</strong><span>{s.phone}</span></div></div>)}</div>}
            {canUseFactoryTools && <div className="report-card span-2"><h3>تحويل مخزون بين المحلات</h3><div className="form-grid"><select value={transferForm.toStoreId} onChange={(e)=>setTransferForm({...transferForm,toStoreId:e.target.value})}><option value="">اختر محل الاستقبال</option>{stores.filter((s)=>s.id!==session.storeId).map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select><input value={transferForm.productId} onChange={(e)=>setTransferForm({...transferForm,productId:e.target.value})} placeholder="كود المنتج"/><input type="number" value={transferForm.qty} onChange={(e)=>setTransferForm({...transferForm,qty:e.target.value})} placeholder="الكمية"/><input value={transferForm.reason} onChange={(e)=>setTransferForm({...transferForm,reason:e.target.value})} placeholder="السبب"/><button className="primary-btn" onClick={makeTransfer}>تحويل</button></div></div>}
            <div className="report-card span-2"><h3>الفواتير</h3><table className="products-table"><thead><tr><th>رقم الفاتورة</th><th>التاريخ</th><th>العميل</th><th>الدفع</th><th>الإجمالي</th><th>حذف أو إعادة طباعة</th></tr></thead><tbody>{invoices.map((i)=><tr key={i.id}><td>{i.id}</td><td>{formatDateTime(i.createdAt)}</td><td>{i.customerName}</td><td>{paymentLabels[i.paymentMethod]}</td><td>{money(i.total)} ر.ق</td><td><button className="ghost-btn danger" onClick={()=>removeInvoice(i.id)}>حذف</button><button className="secondary-btn small-btn" onClick={()=>reprintInvoice(i)}>إعادة طباعة</button></td></tr>)}{!invoices.length && <tr><td colSpan="6">لا توجد فواتير.</td></tr>}</tbody></table></div>
          </div>
        </div>
      )}

      {activeTab === "products" && <ProductsManager storeId={session.storeId} canUseFactoryTools={canUseFactoryTools} stores={stores} products={products} categories={categories} onRefresh={refreshAll} setMessage={setMessage} factoryAddForm={factoryAddForm} setFactoryAddForm={setFactoryAddForm} addFactoryStockToStore={addFactoryStockToStore} />}

      <StockModal product={stockModal.product} rows={stockModal.rows} onClose={() => setStockModal({ product: null, rows: [] })} />
    </div>
  );
}

function ProductsManager({ storeId, canUseFactoryTools, stores, products, categories, onRefresh, setMessage, factoryAddForm, setFactoryAddForm, addFactoryStockToStore }) {
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState({});
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((item) => !q || String(item.id).includes(q) || String(item.name || "").toLowerCase().includes(q));
  }, [products, search]);
  const saveRow = async (product) => {
    const draft = editing[product.id] || { stock: product.stock, add: 0 };
    await updateProductStock(storeId, product.id, { stock: Number(draft.stock), addStock: Number(draft.add || 0) });
    setMessage("تم تحديث المخزون.");
    onRefresh();
  };
  return (
    <div className="reports-page">
      {canUseFactoryTools && <div className="report-card">
        <h3>إضافة مخزون من المصنع إلى محل</h3>
        <div className="form-grid">
          <select value={factoryAddForm.targetStoreId} onChange={(e)=>setFactoryAddForm({...factoryAddForm,targetStoreId:e.target.value})}><option value="">اختر المحل</option>{stores.filter((s)=>s.id!=="factory").map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input value={factoryAddForm.code} onChange={(e)=>setFactoryAddForm({...factoryAddForm,code:e.target.value})} placeholder="كود المنتج"/>
          <input value={factoryAddForm.name} onChange={(e)=>setFactoryAddForm({...factoryAddForm,name:e.target.value})} placeholder="اسم المنتج إذا جديد"/>
          <input value={factoryAddForm.category} onChange={(e)=>setFactoryAddForm({...factoryAddForm,category:e.target.value})} placeholder="التصنيف"/>
          <input type="number" value={factoryAddForm.stock} onChange={(e)=>setFactoryAddForm({...factoryAddForm,stock:e.target.value})} placeholder="الكمية"/>
          <button className="primary-btn" onClick={addFactoryStockToStore}>إضافة للمحل وخصم من المصنع</button>
        </div>
      </div>}
      <div className="report-card">
        <div className="products-table-top"><h3>المنتجات والمخزون</h3><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="ابحث بالاسم أو الكود"/></div>
        <table className="products-table"><thead><tr><th>الكود</th><th>المنتج</th><th>التصنيف</th><th>المخزون الحالي</th><th>ضبط المخزون</th><th>إضافة كمية</th><th>حفظ</th></tr></thead><tbody>{filtered.map((p)=>{const d=editing[p.id]||{stock:p.stock,add:0};return <tr key={p.id}><td>{p.id}</td><td>{p.name}</td><td>{p.category}</td><td>{p.stock}</td><td><input type="number" value={d.stock} onChange={(e)=>setEditing((prev)=>({...prev,[p.id]:{...d,stock:e.target.value}}))}/></td><td><input type="number" value={d.add} onChange={(e)=>setEditing((prev)=>({...prev,[p.id]:{...d,add:e.target.value}}))}/></td><td><button className="secondary-btn small-btn" onClick={()=>saveRow(p)}>حفظ</button></td></tr>})}</tbody></table>
      </div>
    </div>
  );
}

function AdminDashboard({ onLogout }) {
  const [day, setDay] = useState(todayKey());
  const [dashboard, setDashboard] = useState(null);
  const [message, setMessage] = useState("");
  const [newStore, setNewStore] = useState({ name: "", password: "" });
  const [search, setSearch] = useState("");
  const [searchRows, setSearchRows] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [adminTab, setAdminTab] = useState("dashboard");
  const [reportType, setReportType] = useState("week");
  const [period, setPeriod] = useState({ from: todayKey(), to: todayKey() });
  const [periodReport, setPeriodReport] = useState(null);
  const [adminExpenseForm, setAdminExpenseForm] = useState({ storeId: "general", amount: "", category: "", reason: "" });
  const [adminExpenses, setAdminExpenses] = useState([]);

  const loadDashboard = async () => {
    try {
      setMessage("");
      const data = await getAdminDashboard(day);
      setDashboard(data);
      if (!selectedStoreId && data.stores?.length) setSelectedStoreId(data.stores[0].id);
      setAdminExpenses(await getAdminExpenses(day));
    } catch (error) {
      setMessage(error.message || "Failed to load admin data.");
    }
  };
  useEffect(() => { loadDashboard(); }, [day]);

  const createStore = async (e) => { e.preventDefault(); await addStore(newStore); setNewStore({ name: "", password: "" }); loadDashboard(); };
  const searchProduct = async () => setSearchRows(await searchProductAllStores(search));
  const loadPeriodReport = async () => setPeriodReport(await getAdminPeriodReport({ type: reportType, from: period.from, to: period.to }));
  const addAdminExpense = async () => { await saveAdminExpense({ ...adminExpenseForm, day }); setAdminExpenseForm({ storeId: "general", amount: "", category: "", reason: "" }); loadDashboard(); };

  const selectedStore = (dashboard?.stores || []).find((s) => s.id === selectedStoreId);
  const printAdminReport = () => {
    const rows=(dashboard?.stores||[]).map((s)=>`<tr><td>${s.name}</td><td>${money(s.totalSales)} ر.ق</td><td>${money(s.totalCash)} ر.ق</td><td>${money(s.totalWithdrawals)} ر.ق</td></tr>`).join("");
    printHtml("تقرير المدير", `<div class="brand"><img src="${logo}"/><div><h2>الملكي</h2><p>تقرير المدير</p></div></div><table><thead><tr><th>المحل</th><th>البيع</th><th>الكاش</th><th>السحبيات</th></tr></thead><tbody>${rows}</tbody></table>`);
  };

  return (
    <div className="app-shell" dir="rtl">
      <header className="topbar"><div className="brand-block"><img className="brand-logo" src={logo} alt="logo"/><div><h1>Administrateur</h1><p>لوحة تحكم كل المحلات</p></div></div><div className="tabs"><button onClick={printAdminReport}>طباعة تقرير PDF</button><button className={adminTab==="dashboard"?"active":""} onClick={()=>setAdminTab("dashboard")}>Dashboard</button><button className={adminTab==="reports"?"active":""} onClick={()=>setAdminTab("reports")}>تقارير</button><button className={adminTab==="expenses"?"active":""} onClick={()=>setAdminTab("expenses")}>مصاريف</button><button onClick={onLogout}>خروج</button></div></header>
      {message && <div className="message">{message}</div>}
      {adminTab==="dashboard" && <div className="reports-page"><div className="report-card"><div className="report-actions-grid"><input type="date" value={day} onChange={(e)=>setDay(e.target.value)}/><button className="primary-btn" onClick={loadDashboard}>تحديث</button></div></div><div className="reports-grid">
        <div className="report-card"><h3>إجمالي كل المحلات</h3><div className="low-stock-list"><div className="low-stock-row"><span>إجمالي البيع</span><strong>{money(dashboard?.totalSales)} ر.ق</strong></div><div className="low-stock-row"><span>فواتير محيت</span><strong className="neg">{dashboard?.totalHiddenInvoices || 0} مخفية / {money(dashboard?.totalHiddenInvoicesSales)} ر.ق</strong></div><div className="low-stock-row"><span>إجمالي الكاش</span><strong>{money(dashboard?.totalCash)} ر.ق</strong></div><div className="low-stock-row"><span>إجمالي السحبيات</span><strong className="neg">{money(dashboard?.totalWithdrawals)} ر.ق</strong></div></div></div>
        <div className="report-card span-2"><h3>المحلات</h3><div className="store-buttons">{(dashboard?.stores||[]).map((s)=><button key={s.id} className={selectedStoreId===s.id?"active":""} onClick={()=>setSelectedStoreId(s.id)}>{s.name}</button>)}</div></div>
        {selectedStore && <div className="report-card span-2"><h3>فواتير {selectedStore.name} لهذا اليوم</h3><table className="products-table"><thead><tr><th>الفاتورة</th><th>التاريخ</th><th>العميل</th><th>الدفع</th><th>المنتجات والأسعار</th><th>الإجمالي</th><th>الحالة</th></tr></thead><tbody>{(selectedStore.invoices||[]).map((i)=><tr key={i.id}><td>{i.id}</td><td>{formatDateTime(i.createdAt)}</td><td>{i.customerName}</td><td>{paymentLabels[i.paymentMethod]}</td><td>{(i.items||[]).map((it,idx)=><div key={idx}>{it.productName} × {it.qty} = {money(it.total)} ر.ق</div>)}</td><td>{money(i.total)} ر.ق</td><td>{isHiddenInvoice(i)?"مخفية":"ظاهرة"}</td></tr>)}{!selectedStore.invoices?.length && <tr><td colSpan="7">لا توجد فواتير.</td></tr>}</tbody></table></div>}
        <div className="report-card"><h3>إضافة محل جديد</h3><form className="form-grid" onSubmit={createStore}><input value={newStore.name} onChange={(e)=>setNewStore({...newStore,name:e.target.value})} placeholder="اسم المحل"/><input value={newStore.password} onChange={(e)=>setNewStore({...newStore,password:e.target.value})} placeholder="كلمة المرور"/><button className="primary-btn">إضافة المحل</button></form></div>
        <div className="report-card span-2"><h3>بحث منتج في كل المحلات</h3><div className="report-actions-grid"><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="اسم المنتج أو الكود"/><button className="primary-btn" onClick={searchProduct}>بحث</button></div>{searchRows.map((p)=><div className="product-search-result" key={p.id}><h4>{p.name} - {p.id}</h4><div className="stock-grid">{p.stores.map((s)=><div className="stock-chip" key={s.storeId}><span>{s.storeName}</span><strong>{s.stock}</strong></div>)}</div></div>)}</div>
      </div></div>}
      {adminTab==="reports" && <div className="reports-page"><div className="report-card"><h3>تقارير</h3><div className="form-grid"><select value={reportType} onChange={(e)=>setReportType(e.target.value)}><option value="week">أسبوعي</option><option value="month">شهري</option><option value="year">سنوي</option><option value="custom">فترة محددة</option></select><input type="date" value={period.from} onChange={(e)=>setPeriod({...period,from:e.target.value})} disabled={reportType!=="custom"}/><input type="date" value={period.to} onChange={(e)=>setPeriod({...period,to:e.target.value})} disabled={reportType!=="custom"}/><button className="primary-btn" onClick={loadPeriodReport}>إظهار التقرير</button></div></div>{periodReport && <div className="report-card span-2"><h3>من {periodReport.range.from} إلى {periodReport.range.to}</h3><div className="low-stock-list"><div className="low-stock-row"><span>إجمالي البيع</span><strong>{money(periodReport.totalSales)} ر.ق</strong></div><div className="low-stock-row"><span>إجمالي الكاش</span><strong>{money(periodReport.totalCash)} ر.ق</strong></div><div className="low-stock-row"><span>المصاريف</span><strong className="neg">{money(periodReport.totalExpenses)} ر.ق</strong></div><div className="low-stock-row"><span>الربح التقريبي</span><strong className="pos">{money(periodReport.gain)} ر.ق</strong></div></div><table className="products-table"><thead><tr><th>المحل</th><th>البيع</th><th>الكاش</th><th>فيزا</th><th>أونلاين</th><th>المصاريف</th><th>الربح</th><th>الفواتير</th></tr></thead><tbody>{periodReport.stores.map((r)=><tr key={r.storeId}><td>{r.storeName}</td><td>{money(r.totalSales)} ر.ق</td><td>{money(r.totalCash)} ر.ق</td><td>{money(r.totalVisa)} ر.ق</td><td>{money(r.totalOnline)} ر.ق</td><td className="neg">{money(r.totalExpenses)} ر.ق</td><td className="pos">{money(r.gain)} ر.ق</td><td>{r.invoicesCount}</td></tr>)}</tbody></table></div>}</div>}
      {adminTab==="expenses" && <div className="reports-page"><div className="report-card"><h3>مصاريف عامة</h3><div className="form-grid"><select value={adminExpenseForm.storeId} onChange={(e)=>setAdminExpenseForm({...adminExpenseForm,storeId:e.target.value})}><option value="general">عام</option>{(dashboard?.stores||[]).map((s)=><option key={s.id} value={s.id}>{s.name}</option>)}</select><input type="number" value={adminExpenseForm.amount} onChange={(e)=>setAdminExpenseForm({...adminExpenseForm,amount:e.target.value})} placeholder="المبلغ"/><input value={adminExpenseForm.category} onChange={(e)=>setAdminExpenseForm({...adminExpenseForm,category:e.target.value})} placeholder="rent / products"/><input value={adminExpenseForm.reason} onChange={(e)=>setAdminExpenseForm({...adminExpenseForm,reason:e.target.value})} placeholder="السبب"/><button className="primary-btn" onClick={addAdminExpense}>حفظ المصروف</button></div></div><div className="report-card span-2"><h3>مصاريف اليوم</h3><table className="products-table"><thead><tr><th>التاريخ</th><th>المحل</th><th>التصنيف</th><th>السبب</th><th>المبلغ</th></tr></thead><tbody>{adminExpenses.map((e)=>{const s=(dashboard?.stores||[]).find((x)=>x.id===e.storeId);return <tr key={e.id}><td>{formatDateTime(e.createdAt)}</td><td>{s?.name||"عام"}</td><td>{e.category}</td><td>{e.reason}</td><td className="neg">{money(e.amount)} ر.ق</td></tr>})}{!adminExpenses.length&&<tr><td colSpan="5">لا توجد مصاريف.</td></tr>}</tbody></table></div></div>}
    </div>
  );
}

export default function App() {
  const [booting, setBooting] = useState(true);
  const [stores, setStores] = useState([]);
  const [session, setSession] = useState(null);
  const [loginLoading, setLoginLoading] = useState(false);
  const [message, setMessage] = useState("");

  const boot = async () => {
    setBooting(true);
    try {
      await ensureInitialData(seedProducts);
      const list = await getStores();
      setStores(list);
      const saved = localStorage.getItem("almalakiSession");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.type === "admin") setSession({ type: "admin" });
        if (parsed?.type === "store") {
          const store = list.find((s) => s.id === parsed.storeId);
          if (store) setSession({ type: "store", storeId: store.id, storeName: store.name });
        }
      }
    } catch (error) {
      setMessage(error.message || "فشل الاتصال بقاعدة البيانات.");
    } finally {
      setBooting(false);
    }
  };
  useEffect(() => { boot(); }, []);

  const handleLogin = async (storeId, password) => {
    setLoginLoading(true); setMessage("");
    try {
      const ok = await loginStore(storeId, password);
      if (!ok) return setMessage("كلمة المرور غير صحيحة.");
      if (storeId === ADMIN_ID) {
        localStorage.setItem("almalakiSession", JSON.stringify({ type: "admin" }));
        setSession({ type: "admin" });
      } else {
        const store = stores.find((s) => s.id === storeId);
        localStorage.setItem("almalakiSession", JSON.stringify({ type: "store", storeId }));
        setSession({ type: "store", storeId, storeName: store?.name || storeId });
      }
    } catch (error) {
      setMessage(error.message || "فشل الدخول.");
    } finally {
      setLoginLoading(false);
    }
  };
  const logout = () => { localStorage.removeItem("almalakiSession"); setSession(null); };

  if (booting) return <div className="loading-screen">جارٍ تشغيل النظام...</div>;
  if (!session) return <LoginPage stores={stores} onLogin={handleLogin} loading={loginLoading} message={message} />;
  if (session.type === "admin") return <AdminDashboard onLogout={logout} />;
  return <StorePOS session={session} onLogout={logout} />;
}
