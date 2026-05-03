import React from 'react';
import { AlertCircle } from 'lucide-react';

const ConfigError = ({ missingKeys, error }) => (
  <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6" dir="rtl">
    <div className="max-w-xl w-full bg-white rounded-3xl shadow-xl border border-rose-100 p-10 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 bg-rose-100 rounded-2xl flex items-center justify-center text-rose-600">
          <AlertCircle size={28} />
        </div>
        <h1 className="text-2xl font-black text-slate-900">إعدادات Firebase غير مكتملة</h1>
      </div>

      {missingKeys.length > 0 && (
        <div>
          <p className="text-sm text-slate-600 font-medium mb-3">
            المتغيرات التالية مفقودة في Netlify (Site configuration → Environment variables):
          </p>
          <ul className="bg-slate-50 rounded-2xl p-4 space-y-1 font-mono text-xs text-rose-600">
            {missingKeys.map((k) => (
              <li key={k}>• {k}</li>
            ))}
          </ul>
        </div>
      )}

      {error && (
        <div>
          <p className="text-sm text-slate-600 font-medium mb-2">رسالة الخطأ:</p>
          <pre className="bg-slate-900 text-rose-300 rounded-2xl p-4 text-xs overflow-x-auto">
            {String(error.message || error)}
          </pre>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 text-sm text-slate-700 leading-relaxed">
        <p className="font-bold mb-2">الخطوات:</p>
        <ol className="list-decimal pr-5 space-y-1 text-xs">
          <li>افتح Firebase Console → Project Settings → SDK setup and configuration.</li>
          <li>انسخ القيم وأضفها في Netlify كمتغيرات بيئة (انظر <code className="bg-white px-1 rounded">.env.example</code>).</li>
          <li>في Netlify: Deploys → Trigger deploy → Clear cache and deploy site.</li>
          <li>فعّل Anonymous Authentication في Firebase Console.</li>
        </ol>
      </div>
    </div>
  </div>
);

export default ConfigError;
