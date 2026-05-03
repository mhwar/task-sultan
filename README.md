# Task Sultan — FocusFlow Architect

تطبيق React (Vite + Tailwind) لإدارة المشاريع والمهام مع Firebase Firestore، جاهز للنشر على Netlify.

## التشغيل محلياً

```bash
npm install
cp .env.example .env
# ضع قيم Firebase الخاصة بك في .env
npm run dev
```

## التخزين

التطبيق يدعم 3 خلفيات تخزين باكتشاف تلقائي:

1. **Firebase Firestore** — إذا أضيفت متغيرات `VITE_FIREBASE_*` في Netlify (مزامنة فورية + مصادقة).
2. **Netlify Blobs** — تلقائياً عند النشر على Netlify بدون إعداد إضافي (مجاني، استمرار سحابي، هوية مخزنة في المتصفح).
3. **localStorage** — في التطوير المحلي أو إن لم يتوفر أي مما سبق.

شارة الوضع تظهر في رأس التطبيق.

## النشر على Netlify

1. ارفع المستودع إلى GitHub.
2. في Netlify اختر **Add new site → Import from GitHub** واختر هذا المستودع.
3. الإعدادات التلقائية من `netlify.toml`:
   - Build command: `npm run build`
   - Publish directory: `dist`
4. أضف متغيرات البيئة (Site settings → Environment variables):
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_PROJECT_ID`
   - `VITE_FIREBASE_STORAGE_BUCKET`
   - `VITE_FIREBASE_MESSAGING_SENDER_ID`
   - `VITE_FIREBASE_APP_ID`
   - `VITE_APP_ID` (اختياري — افتراضي `focus-flow-app`)
   - `VITE_GEMINI_API_KEY` (اختياري — لميزة محلل Gemini)

## Firebase

- فعّل **Authentication → Anonymous** في Firebase Console.
- فعّل **Firestore Database**.
- مثال قواعد الأمان لمسار البيانات المستخدم في التطبيق:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /artifacts/{appId}/users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
