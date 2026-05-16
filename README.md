# الملكي POS v6 - Firebase

هذا الإصدار مربوط بـ Firebase Realtime Database.

## التشغيل بضغطة واحدة على ويندوز
- افتح الملف: `launch-pos.bat`
- أول مرة:
  - يعمل `npm install` للـ backend والـ frontend
  - يرحّل البيانات المحلية الحالية إلى Firebase
  - ثم يشغّل الواجهة والخلفية
- بعد ذلك:
  - يشغّل `npm run dev` مباشرة

## ملاحظة مهمة
لم أضع ملف `.exe` حقيقي داخل هذه الحزمة. الموجود هو `launch-pos.bat` لأنه يعمل مباشرة على ويندوز بدون تعديل إضافي.

## قواعد Firebase المطلوبة للاختبار
في Realtime Database > Rules ضع مؤقتًا:
```json
{
  "rules": {
    ".read": true,
    ".write": true
  }
}
```

## التشغيل اليدوي
### Backend
```bash
cd backend
npm install
npm run dev
```

### Frontend
```bash
cd frontend
npm install
npm run dev
```

ثم افتح:
`http://localhost:5173`
