import React, { useEffect, useMemo, useState } from "react";
import logo from "./assets/logo.jpeg";
import {
  addProduct,
  deleteInvoice,
  getDailySeries,
  getDayClose,
  getInvoices,
  getMeta,
  getProducts,
  getSummary,
  saveDayClose,
  saveInvoice,
  updateProductStock
} from "./services/firebaseDb";

const paymentLabels = { cash: "كاش", visa: "فيزا", online: "أونلاين" };
const money = (value) => `${Number(value || 0).toFixed(3)} ر.ق`;
const todayKey = () => new Date().toISOString().slice(0, 10);
const formatDateTime = (value) => new Intl.DateTimeFormat("en-GB", {
  year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
}).format(new Date(value));

function printHtml(title, html) {
  const win = window.open("", "_blank", "width=1000,height=800");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8" /><title>${title}</title>
  <style>
    body { font-family: Arial, sans-serif; background: #fff; color: #111; padding: 24px; direction: rtl; }
    .print-shell { max-width: 1000px; margin: 0 auto; }
    .invoice-branding { display:flex; align-items:center; gap:16px; margin-bottom:20px; }
    .invoice-branding img { width:70px; height:70px; object-fit:contain; border:1px solid #d4a63f; border-radius:16px; padding:6px; background:#fff; }
    .invoice-header { display:flex; justify-content:space-between; gap:16px; margin-bottom:18px; }
    table { width:100%; border-collapse:collapse; margin-top:14px; background:#fff; }
    th, td { border:1px solid #ccc; padding:10px; text-align:right; color:#111; background:#fff; }
    th { background:#f5f5f5; }
    .summary { margin-top:16px; display:grid; gap:8px; justify-content:end; }
    .cards { display:grid; grid-template-columns:repeat(2, minmax(280px, 1fr)); gap:16px; }
    .card { border:1px solid #ddd; border-radius:14px; padding:16px; background:#fff; color:#111; break-inside:avoid; }
    .row { display:flex; justify-content:space-between; gap:10px; padding:6px 0; border-bottom:1px solid #eee; }
    .row:last-child { border-bottom:none; }
    @media print { body { padding: 0; } .card { box-shadow:none; } }
  </style></head><body><div class="print-shell">${html}</div></body></html>`);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 300);
}

function ProductCard({ product, onAdd }) {
  return (
    <button className="product-card" onClick={() => onAdd(product)}>
      <div className="product-icon">🛍️</div>
      <div className="product-name">{product.name}</div>
      <div className="product-meta">
        <span>{product.category}</span>
        <span>المخزون: {product.stock}</span>
      </div>
      <div className="product-footer no-price-footer">
        <span className="muted-text">بدون سعر محفوظ</span>
        <span className="add-pill">إضافة</span>
      </div>
    </button>
  );
}

function CartItem({ item, onInc, onDec, onRemove, onPriceChange }) {
  return (
    <div className="cart-item">
      <div className="cart-item-top">
        <div>
          <div className="cart-title">{item.name}</div>
          <div className="cart-subtitle">{item.category}</div>
        </div>
        <button className="ghost-btn danger" onClick={() => onRemove(item.id)}>حذف</button>
      </div>

      <div className="cart-price-row">
        <label>سعر البيع</label>
        <input type="number" min="0" step="0.001" value={item.price} onChange={(e) => onPriceChange(item.id, e.target.value)} placeholder="أدخل السعر" />
      </div>

      <div className="cart-item-bottom">
        <div className="qty-box">
          <button onClick={() => onInc(item.id)}>+</button>
          <span>{item.qty}</span>
          <button onClick={() => onDec(item.id)}>-</button>
        </div>
        <strong>{money(item.lineTotal)}</strong>
      </div>
    </div>
  );
}

function InvoicePanel({ invoice, onPrint }) {
  if (!invoice) return <div className="report-card">لا توجد فاتورة محفوظة بعد.</div>;

  return (
    <div className="print-area report-print invoice-print-surface" id="invoice-print-area">
      <div className="invoice-branding">
        <img src={logo} alt="logo" />
        <div>
          <h2>الملكي</h2>
          <p>فاتورة بيع</p>
        </div>
      </div>
      <div className="invoice-header">
        <div>
          <p><strong>رقم الفاتورة:</strong> {invoice.id}</p>
          <p><strong>التاريخ:</strong> {formatDateTime(invoice.createdAt)}</p>
        </div>
        <div className="invoice-meta-block">
          <p><strong>البائع:</strong> {invoice.seller}</p>
          <p><strong>العميل:</strong> {invoice.customerName}</p>
          <p><strong>الدفع:</strong> {paymentLabels[invoice.paymentMethod] || invoice.paymentMethod}</p>
        </div>
      </div>

      <table className="invoice-table">
        <thead>
          <tr>
            <th>#</th>
            <th>المنتج</th>
            <th>التصنيف</th>
            <th>الكمية</th>
            <th>السعر</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {invoice.items.map((item, index) => (
            <tr key={`${item.productId}-${index}`}>
              <td>{index + 1}</td>
              <td>{item.productName}</td>
              <td>{item.category}</td>
              <td>{item.qty}</td>
              <td>{money(item.unitPrice)}</td>
              <td>{money(item.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="invoice-summary">
        <p>الإجمالي: <strong>{money(invoice.total)}</strong></p>
        <p>المدفوع: <strong>{money(invoice.paidAmount)}</strong></p>
        <p>المتبقي: <strong>{money(invoice.balance)}</strong></p>
      </div>

      <div className="actions single-action no-print">
        <button className="primary-btn" onClick={onPrint}>طباعة الفاتورة / حفظ PDF</button>
      </div>
    </div>
  );
}

function ProductsManager({ products, categories, onRefresh, setMessage }) {
  const [form, setForm] = useState({ name: "", category: categories[0] || "", stock: "0" });
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState({});

  useEffect(() => {
    if (!form.category && categories.length) setForm((prev) => ({ ...prev, category: categories[0] }));
  }, [categories]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((item) => !q || String(item.id).includes(q) || item.name.toLowerCase().includes(q) || String(item.category || "").toLowerCase().includes(q));
  }, [products, search]);

  const createProduct = async (e) => {
    e.preventDefault();
    const payload = { name: form.name.trim(), category: form.category.trim(), stock: Number(form.stock || 0) };
    if (!payload.name || !payload.category) return setMessage("أدخل اسم المنتج والتصنيف.");
    try {
      await addProduct(payload);
      setMessage("تمت إضافة المنتج إلى Firebase.");
      setForm({ name: "", category: payload.category, stock: "0" });
      onRefresh();
    } catch (error) {
      setMessage(error.message || "فشل إضافة المنتج.");
    }
  };

  const saveRow = async (product) => {
    const draft = editing[product.id] || { stock: product.stock, add: 0 };
    try {
      await updateProductStock(product.id, { stock: Number(draft.stock), addStock: Number(draft.add || 0) });
      setMessage("تم تحديث المخزون في Firebase.");
      setEditing((prev) => ({ ...prev, [product.id]: { stock: Number(draft.stock) + Number(draft.add || 0), add: 0 } }));
      onRefresh();
    } catch (error) {
      setMessage(error.message || "فشل تحديث المخزون.");
    }
  };

  return (
    <div className="reports-page">
      <div className="report-card">
        <h3>إضافة منتج جديد</h3>
        <form className="form-grid products-form" onSubmit={createProduct}>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="اسم المنتج" />
          <input value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} placeholder="التصنيف" />
          <input type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="كمية البداية" />
          <button className="primary-btn" type="submit">حفظ المنتج</button>
        </form>
      </div>

      <div className="report-card">
        <div className="products-table-top">
          <h3>المنتجات والمخزون</h3>
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الكود أو التصنيف" />
        </div>
        <div className="products-table-wrap">
          <table className="products-table">
            <thead>
              <tr>
                <th>الكود</th>
                <th>المنتج</th>
                <th>التصنيف</th>
                <th>المخزون الحالي</th>
                <th>ضبط المخزون</th>
                <th>إضافة كمية</th>
                <th>حفظ</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => {
                const draft = editing[product.id] || { stock: product.stock, add: 0 };
                return (
                  <tr key={product.id}>
                    <td>{product.id}</td>
                    <td>{product.name}</td>
                    <td>{product.category}</td>
                    <td>{product.stock}</td>
                    <td>
                      <input type="number" min="0" value={draft.stock}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [product.id]: { ...draft, stock: e.target.value } }))} />
                    </td>
                    <td>
                      <input type="number" min="0" value={draft.add}
                        onChange={(e) => setEditing((prev) => ({ ...prev, [product.id]: { ...draft, add: e.target.value } }))} />
                    </td>
                    <td><button className="secondary-btn small-btn" onClick={() => saveRow(product)}>حفظ</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({ sellers: [], categories: [] });
  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("الكل");
  const [selectedSeller, setSelectedSeller] = useState("");
  const [customerName, setCustomerName] = useState("زبون مباشر");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paidAmount, setPaidAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [cart, setCart] = useState([]);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [summary, setSummary] = useState(null);
  const [daySummary, setDaySummary] = useState(null);
  const [dailySeries, setDailySeries] = useState([]);
  const [invoiceHistory, setInvoiceHistory] = useState([]);
  const [latestInvoice, setLatestInvoice] = useState(null);
  const [selectedDay, setSelectedDay] = useState(todayKey());
  const [activeTab, setActiveTab] = useState("pos");
  const [closeForm, setCloseForm] = useState({ actualCash: "", actualVisa: "", actualOnline: "", notes: "" });
  const [closingReport, setClosingReport] = useState(null);

  const loadProducts = async () => {
    const data = await getProducts({ q: query, category: selectedCategory });
    setProducts(data);
  };

  const loadMeta = async () => {
    const data = await getMeta();
    setMeta(data);
    if (!selectedSeller && data.sellers?.length) setSelectedSeller(data.sellers[0]);
  };

  const loadReports = async (day = selectedDay) => {
    const [allSummary, currentDaySummary, series, invoices, closeData] = await Promise.all([
      getSummary(),
      getSummary(day),
      getDailySeries(),
      getInvoices(day),
      getDayClose(day)
    ]);
    setSummary(allSummary);
    setDaySummary(currentDaySummary);
    setDailySeries(series);
    setInvoiceHistory(invoices);
    setClosingReport(closeData);
  };

  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { loadProducts(); }, [query, selectedCategory]);
  useEffect(() => { loadReports(selectedDay); }, [selectedDay]);

  const refreshAll = async () => {
    await Promise.all([loadProducts(), loadMeta(), loadReports(selectedDay)]);
  };

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

  const changeQty = (id, delta) => {
    setCart((prev) => prev.map((item) => {
      if (item.id !== id) return item;
      const qty = Math.max(0, Math.min(item.stock, item.qty + delta));
      return { ...item, qty, lineTotal: qty * Number(item.price || 0) };
    }).filter((item) => item.qty > 0));
  };

  const changePrice = (id, value) => {
    setCart((prev) => prev.map((item) => item.id !== id ? item : ({ ...item, price: Number(value || 0), lineTotal: Number(value || 0) * item.qty })));
  };

  const removeItem = (id) => setCart((prev) => prev.filter((item) => item.id !== id));
  const total = useMemo(() => cart.reduce((sum, item) => sum + item.lineTotal, 0), [cart]);

  const completeSale = async () => {
    if (!cart.length) return setMessage("أضف منتجًا واحدًا على الأقل.");
    if (cart.some((item) => Number(item.price || 0) <= 0)) return setMessage("أدخل سعر البيع لكل المنتجات داخل السلة.");
    setSaving(true); setMessage("");
    try {
      const payload = {
        customerName,
        seller: selectedSeller,
        paymentMethod,
        paidAmount: paidAmount === "" ? total : Number(paidAmount),
        notes,
        items: cart.map((item) => ({ productId: item.id, productName: item.name, category: item.category, unitPrice: Number(item.price || 0), qty: item.qty }))
      };
      const data = await saveInvoice(payload);
      setLatestInvoice(data);
      setCart([]); setPaidAmount(""); setNotes("");
      setMessage("تم حفظ الفاتورة في Firebase وتحديث المخزون.");
      await refreshAll();
      setActiveTab("invoice");
    } catch (error) {
      setMessage(error.message);
    } finally { setSaving(false); }
  };

  const removeInvoice = async (id) => {
    if (!window.confirm("هل تريد حذف هذه الفاتورة وإرجاع المخزون؟")) return;
    try {
      await deleteInvoice(id);
      setMessage("تم حذف الفاتورة وإرجاع المخزون من Firebase.");
      await refreshAll();
    } catch (error) {
      setMessage(error.message || "فشل حذف الفاتورة");
    }
  };

  const closeDay = async () => {
    try {
      const data = await saveDayClose({ day: selectedDay, actualCash: Number(closeForm.actualCash || 0), actualVisa: Number(closeForm.actualVisa || 0), actualOnline: Number(closeForm.actualOnline || 0), notes: closeForm.notes });
      setClosingReport(data);
      setMessage("تم حفظ إقفال اليوم في Firebase.");
    } catch (error) {
      setMessage(error.message || "فشل حفظ إقفال اليوم");
    }
  };

  const printInvoice = () => {
    if (!latestInvoice) return;
    const rows = latestInvoice.items.map((item, index) => `<tr><td>${index + 1}</td><td>${item.productName}</td><td>${item.category}</td><td>${item.qty}</td><td>${money(item.unitPrice)}</td><td>${money(item.total)}</td></tr>`).join("");
    const html = `
      <div class="invoice-branding"><img src="${logo}" /><div><h2>الملكي</h2><p>فاتورة بيع</p></div></div>
      <div class="invoice-header"><div><p><strong>رقم الفاتورة:</strong> ${latestInvoice.id}</p><p><strong>التاريخ:</strong> ${formatDateTime(latestInvoice.createdAt)}</p></div><div><p><strong>البائع:</strong> ${latestInvoice.seller}</p><p><strong>العميل:</strong> ${latestInvoice.customerName}</p><p><strong>الدفع:</strong> ${paymentLabels[latestInvoice.paymentMethod] || latestInvoice.paymentMethod}</p></div></div>
      <table><thead><tr><th>#</th><th>المنتج</th><th>التصنيف</th><th>الكمية</th><th>السعر</th><th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="summary"><p>الإجمالي: <strong>${money(latestInvoice.total)}</strong></p><p>المدفوع: <strong>${money(latestInvoice.paidAmount)}</strong></p><p>المتبقي: <strong>${money(latestInvoice.balance)}</strong></p></div>`;
    printHtml(`فاتورة ${latestInvoice.id}`, html);
  };

  const printReport = () => {
    const sellerRows = Object.entries(daySummary?.bySeller || {}).map(([seller, value]) => `<div class="row"><span>${seller}</span><strong>${money(value)}</strong></div>`).join("") || `<div class="row"><span>لا توجد بيانات</span><span>-</span></div>`;
    const dayRows = dailySeries.map((row) => `<tr><td>${row.day}</td><td>${money(row.cash)}</td><td>${money(row.visa)}</td><td>${money(row.online)}</td><td>${money(row.total)}</td></tr>`).join("");
    const closingRows = (closingReport?.rows || []).map((row) => `<div class="row"><span>${paymentLabels[row.paymentMethod]}</span><span>المتوقع ${money(row.expected)} / الفعلي ${money(row.actual)} / الفرق ${money(row.difference)} / الناقص ${money(row.missing)}</span></div>`).join("") || `<div class="row"><span>لا يوجد إقفال محفوظ</span><span>-</span></div>`;
    const html = `
      <div class="invoice-branding"><img src="${logo}" /><div><h2>الملكي</h2><p>تقرير يومي</p></div></div>
      <p><strong>اليوم:</strong> ${selectedDay}</p>
      <div class="cards">
        <div class="card"><h3>ملخص اليوم</h3><div class="row"><span>إجمالي البيع</span><strong>${money(daySummary?.totalSales || 0)}</strong></div><div class="row"><span>عدد الفواتير</span><strong>${daySummary?.totalInvoices || 0}</strong></div><div class="row"><span>عدد القطع</span><strong>${daySummary?.totalItemsSold || 0}</strong></div><div class="row"><span>كاش</span><strong>${money(daySummary?.byPayment?.cash || 0)}</strong></div><div class="row"><span>فيزا</span><strong>${money(daySummary?.byPayment?.visa || 0)}</strong></div><div class="row"><span>أونلاين</span><strong>${money(daySummary?.byPayment?.online || 0)}</strong></div></div>
        <div class="card"><h3>حسب البائع</h3>${sellerRows}</div>
        <div class="card"><h3>إقفال اليوم</h3>${closingRows}</div>
        <div class="card"><h3>المنتجات قليلة المخزون</h3>${(summary?.lowStockProducts || []).slice(0, 15).map((item) => `<div class="row"><span>${item.name}</span><strong>${item.stock}</strong></div>`).join("") || `<div class="row"><span>لا يوجد</span><span>-</span></div>`}</div>
      </div>
      <h3 style="margin-top:20px;">المبيعات حسب الأيام</h3>
      <table><thead><tr><th>اليوم</th><th>كاش</th><th>فيزا</th><th>أونلاين</th><th>الإجمالي</th></tr></thead><tbody>${dayRows}</tbody></table>`;
    printHtml(`تقرير ${selectedDay}`, html);
  };

  return (
    <div className="app-shell" dir="rtl">
      <header className="topbar">
        <div className="brand-block">
          <img className="brand-logo" src={logo} alt="logo" />
          <div>
            <h1>الملكي</h1>
            <p>نظام مبيعات ومخزون وفواتير - Firebase v6</p>
          </div>
        </div>
        <div className="tabs no-print">
          <button className={activeTab === "pos" ? "active" : ""} onClick={() => setActiveTab("pos")}>المبيعات</button>
          <button className={activeTab === "invoice" ? "active" : ""} onClick={() => setActiveTab("invoice")}>الفاتورة</button>
          <button className={activeTab === "reports" ? "active" : ""} onClick={() => setActiveTab("reports")}>التقارير</button>
          <button className={activeTab === "products" ? "active" : ""} onClick={() => setActiveTab("products")}>المنتجات</button>
        </div>
      </header>

      {message && <div className="message">{message}</div>}

      {activeTab === "pos" && (
        <div className="layout">
          <section className="products-section">
            <div className="toolbar no-print">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="ابحث بالاسم أو الكود" />
              <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                <option value="الكل">الكل</option>
                {meta.categories?.map((category) => <option key={category} value={category}>{category}</option>)}
              </select>
            </div>
            <div className="products-grid">
              {products.map((product) => <ProductCard key={product.id} product={product} onAdd={addToCart} />)}
            </div>
          </section>

          <aside className="sidebar no-print">
            <div className="panel">
              <h3>بيانات البيع</h3>
              <div className="form-grid">
                <input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="اسم العميل" />
                <select value={selectedSeller} onChange={(e) => setSelectedSeller(e.target.value)}>
                  {meta.sellers?.map((seller) => <option key={seller} value={seller}>{seller}</option>)}
                </select>
                <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}>
                  {Object.entries(paymentLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
                <input type="number" min="0" step="0.001" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="المبلغ المدفوع" />
              </div>
              <textarea rows="3" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات" />
            </div>

            <div className="panel">
              <h3>السلة</h3>
              <div className="cart-list">
                {!cart.length && <div className="empty-box">أضف منتجات إلى السلة.</div>}
                {cart.map((item) => <CartItem key={item.id} item={item} onInc={(id) => changeQty(id, 1)} onDec={(id) => changeQty(id, -1)} onRemove={removeItem} onPriceChange={changePrice} />)}
              </div>
              <div className="totals-box">
                <div><span>عدد الأصناف</span><strong>{cart.length}</strong></div>
                <div><span>الإجمالي</span><strong>{money(total)}</strong></div>
              </div>
              <div className="actions">
                <button className="secondary-btn" onClick={() => setCart([])}>تفريغ السلة</button>
                <button className="primary-btn" onClick={completeSale} disabled={saving}>{saving ? "جارٍ الحفظ..." : "حفظ الفاتورة"}</button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {activeTab === "invoice" && <InvoicePanel invoice={latestInvoice} onPrint={printInvoice} />}

      {activeTab === "reports" && (
        <div className="reports-page">
          <div className="report-card no-print">
            <div className="report-actions-grid">
              <input type="date" value={selectedDay} onChange={(e) => setSelectedDay(e.target.value)} />
              <button className="primary-btn" onClick={printReport}>طباعة التقرير / حفظ PDF</button>
            </div>
          </div>

          <div className="reports-grid">
            <div className="report-card">
              <h3>ملخص اليوم</h3>
              <p>اليوم: {selectedDay}</p>
              <div className="low-stock-list">
                <div className="low-stock-row"><span>إجمالي البيع</span><strong>{money(daySummary?.totalSales || 0)}</strong></div>
                <div className="low-stock-row"><span>عدد الفواتير</span><strong>{daySummary?.totalInvoices || 0}</strong></div>
                <div className="low-stock-row"><span>عدد القطع</span><strong>{daySummary?.totalItemsSold || 0}</strong></div>
                <div className="low-stock-row"><span>كاش</span><strong>{money(daySummary?.byPayment?.cash || 0)}</strong></div>
                <div className="low-stock-row"><span>فيزا</span><strong>{money(daySummary?.byPayment?.visa || 0)}</strong></div>
                <div className="low-stock-row"><span>أونلاين</span><strong>{money(daySummary?.byPayment?.online || 0)}</strong></div>
              </div>
            </div>

            <div className="report-card">
              <h3>حسب البائع</h3>
              <div className="low-stock-list">
                {Object.entries(daySummary?.bySeller || {}).map(([seller, value]) => <div className="low-stock-row" key={seller}><span>{seller}</span><strong>{money(value)}</strong></div>)}
                {!Object.keys(daySummary?.bySeller || {}).length && <p>لا توجد بيانات.</p>}
              </div>
            </div>

            <div className="report-card span-2">
              <h3>الفواتير</h3>
              <div className="products-table-wrap">
                <table className="products-table">
                  <thead>
                    <tr><th>رقم الفاتورة</th><th>التاريخ</th><th>البائع</th><th>الدفع</th><th>الإجمالي</th><th>حذف</th></tr>
                  </thead>
                  <tbody>
                    {invoiceHistory.map((invoice) => (
                      <tr key={invoice.id}>
                        <td>{invoice.id}</td>
                        <td>{formatDateTime(invoice.createdAt)}</td>
                        <td>{invoice.seller}</td>
                        <td>{paymentLabels[invoice.paymentMethod] || invoice.paymentMethod}</td>
                        <td>{money(invoice.total)}</td>
                        <td><button className="ghost-btn danger" onClick={() => removeInvoice(invoice.id)}>حذف</button></td>
                      </tr>
                    ))}
                    {!invoiceHistory.length && <tr><td colSpan="6">لا توجد فواتير لهذا اليوم.</td></tr>}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="report-card">
              <h3>إقفال اليوم</h3>
              <div className="form-grid">
                <input type="number" min="0" step="0.001" value={closeForm.actualCash} onChange={(e) => setCloseForm({ ...closeForm, actualCash: e.target.value })} placeholder="الكاش الفعلي" />
                <input type="number" min="0" step="0.001" value={closeForm.actualVisa} onChange={(e) => setCloseForm({ ...closeForm, actualVisa: e.target.value })} placeholder="الفيزا الفعلي" />
                <input type="number" min="0" step="0.001" value={closeForm.actualOnline} onChange={(e) => setCloseForm({ ...closeForm, actualOnline: e.target.value })} placeholder="الأونلاين الفعلي" />
                <button className="primary-btn" onClick={closeDay}>حفظ الإقفال</button>
              </div>
              <textarea rows="3" value={closeForm.notes} onChange={(e) => setCloseForm({ ...closeForm, notes: e.target.value })} placeholder="ملاحظات الإقفال" />
              <div className="low-stock-list top-space">
                {(closingReport?.rows || []).map((row) => (
                  <div key={row.paymentMethod} className="low-stock-row">
                    <span>{paymentLabels[row.paymentMethod]}</span>
                    <strong className={row.difference < 0 ? "neg" : row.difference > 0 ? "pos" : ""}>{money(row.difference)}</strong>
                  </div>
                ))}
                {!closingReport && <p>لا يوجد إقفال محفوظ لهذا اليوم.</p>}
              </div>
            </div>

            <div className="report-card">
              <h3>البيع حسب الأيام</h3>
              <div className="products-table-wrap">
                <table className="products-table">
                  <thead><tr><th>اليوم</th><th>كاش</th><th>فيزا</th><th>أونلاين</th><th>الإجمالي</th></tr></thead>
                  <tbody>
                    {dailySeries.map((row) => <tr key={row.day}><td>{row.day}</td><td>{money(row.cash)}</td><td>{money(row.visa)}</td><td>{money(row.online)}</td><td>{money(row.total)}</td></tr>)}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="report-card span-2">
              <h3>المنتجات قليلة المخزون</h3>
              <div className="low-stock-list">
                {(summary?.lowStockProducts || []).map((item) => <div className="low-stock-row" key={item.id}><span>{item.name}</span><strong>{item.stock}</strong></div>)}
                {!summary?.lowStockProducts?.length && <p>لا توجد منتجات منخفضة المخزون.</p>}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "products" && <ProductsManager products={products} categories={meta.categories || []} onRefresh={refreshAll} setMessage={setMessage} />}
    </div>
  );
}
