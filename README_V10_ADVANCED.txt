# الملكي POS v10 Advanced

## تمت الإضافة
- Barcode scanner input:
  امسح الباركود داخل خانة الباركود واضغط Enter.
  في هذا الإصدار كود المنتج يعمل كـ barcode.

- Thermal printer:
  زر طباعة حرارية داخل الفاتورة.
  يعمل من نافذة الطباعة، اختر طابعتك الحرارية.

- Cashier accounts:
  داخل التقارير يمكن إضافة كاشير للمحل.
  البيانات تحفظ في Firebase: stores/{storeId}/cashiers

- Supplier management:
  إضافة الموردين وحفظهم في Firebase: stores/{storeId}/suppliers

- Expenses:
  تسجيل المصاريف مع المبلغ والتصنيف والسبب.
  المصاريف تخص كل محل وكل يوم.

- Transfer stock between stores:
  تحويل كمية منتج من محل إلى محل آخر.
  يحفظ في transfers وفي سجل كل محل.

- Offline mode:
  إذا انقطع الإنترنت أثناء:
  - فاتورة
  - مصروف
  - سحب
  - تحويل مخزون
  - إضافة مورد
  يتم حفظ العملية في localStorage.
  عند رجوع الإنترنت، النظام يحاول مزامنتها مع Firebase تلقائياً.

## ملاحظة مهمة حول offline
الأوفلاين هنا Queue عملي.
إذا حصل بيع لنفس المنتج من جهازين بدون إنترنت، قد تحتاج مراجعة المخزون بعد المزامنة.
للنظام التجاري القوي جداً نحتاج conflict resolution متقدم.

تشغيل:
start-pos.bat
