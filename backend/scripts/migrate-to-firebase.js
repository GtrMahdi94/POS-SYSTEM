import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getDatabase, ref, get, update, set } from "firebase/database";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, "..");
const dataDir = path.join(rootDir, "data");
const firebaseConfig = {
  apiKey: "AIzaSyCCExTJkzzD1O4pkBvE5bRab1YaTzVemqc",
  authDomain: "pos-royal-honey.firebaseapp.com",
  databaseURL: "https://pos-royal-honey-default-rtdb.firebaseio.com",
  projectId: "pos-royal-honey",
  storageBucket: "pos-royal-honey.firebasestorage.app",
  messagingSenderId: "833626344437",
  appId: "1:833626344437:web:96e7fa804759d0dc0aeebc"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);
const readJson = (name, fallback) => {
  const file = path.join(dataDir, name);
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(fs.readFileSync(file, "utf8"));
};

function arrayToObjectById(list) {
  return Object.fromEntries((list || []).map((item) => [String(item.id), {
    name: item.name,
    category: item.category || "",
    stock: Number(item.stock || 0),
    active: true
  }]));
}

async function main() {
  const products = readJson("products.json", []);
  const meta = readJson("meta.json", { sellers: [], categories: [] });
  const invoices = readJson("invoices.json", []);
  const closings = readJson("closings.json", {});

  const productsMap = arrayToObjectById(products);
  const invoiceMap = Object.fromEntries((invoices || []).map((invoice) => [String(invoice.id), invoice]));
  const closingsMap = Array.isArray(closings)
    ? Object.fromEntries(closings.map((row) => [String(row.day), row]))
    : closings;

  const lastInvoiceNumber = Math.max(0, ...Object.keys(invoiceMap).map((id) => Number(id) || 0));

  const sellers = meta.sellers || [];
  const categories = meta.categories || [];

  await update(ref(db), {
    sellers,
    categories,
    meta: {
      sellers,
      categories
    },
    products: productsMap,
    invoices: invoiceMap,
    closings: closingsMap,
    counters: { lastInvoiceNumber }
  });

  await set(ref(db, "migrationInfo"), {
    source: "v6 local data",
    migratedAt: new Date().toISOString(),
    products: Object.keys(productsMap).length,
    invoices: Object.keys(invoiceMap).length,
    closings: Object.keys(closingsMap || {}).length
  });

  console.log(`Firebase migration complete: ${Object.keys(productsMap).length} products, ${Object.keys(invoiceMap).length} invoices.`);
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
