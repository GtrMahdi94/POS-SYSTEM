# الملكي POS v8 - Multi Store Firebase

## الجديد في v8
- صفحة دخول أولى فيها:
  - محل العزيزية
  - محل بن عمران
  - محل معيذر
  - Administrateur
- كل محل لديه كلمة مرور مستقلة.
- كل محل لديه منتجات وفواتير ومخزون منفصل.
- كل محل يستطيع رؤية مخزون المنتج في باقي المحلات.
- الأدمن يستطيع رؤية إحصائيات كل المحلات.
- الأدمن يستطيع إضافة محل جديد مع كلمة مرور.
- الأدمن يستطيع البحث عن أي منتج ورؤية مخزونه في كل المحلات.

## كلمات المرور الافتراضية
- محل العزيزية: 1111
- محل بن عمران: 2222
- محل معيذر: 3333
- Administrateur: 1234

## تشغيل
Double click:
start-pos.bat

أو يدويًا:

Backend:
cd backend
npm install
npm run dev

Frontend:
cd frontend
npm install
npm run dev

Open:
http://localhost:5173

## Firebase Rules للاختبار فقط
{
  "rules": {
    ".read": true,
    ".write": true
  }
}

## Database structure
stores
  aziziya
    meta
    products
    invoices
    closings
  binomran
    meta
    products
    invoices
    closings
  muaither
    meta
    products
    invoices
    closings

admin
  password: "1234"

## ملاحظة مهمة
عند أول تشغيل، النظام ينشئ المحلات الثلاثة ويضع نفس المنتجات الحالية في كل محل.
بعد ذلك كل محل يصبح لديه مخزونه المنفصل.
