export default function SetupNeeded() {
  return (
    <div className="min-h-screen flex items-center justify-center p-6" dir="rtl">
      <div className="card-surface rounded-2xl p-8 max-w-lg space-y-3 text-center">
        <div className="text-4xl">⚙️</div>
        <h1 className="text-xl font-extrabold text-white">لسه محتاجين نربط الموقع بـ Supabase</h1>
        <p className="text-slate-300 text-sm leading-7">
          اعمل ملف اسمه <code className="text-amber-400">.env</code> جوه فولدر <code className="text-amber-400">web</code>
          (انسخه من <code className="text-amber-400">.env.example</code>) وحط فيه
          <code className="text-amber-400"> VITE_SUPABASE_URL </code> و
          <code className="text-amber-400"> VITE_SUPABASE_ANON_KEY</code>، أو ضيفهم في إعدادات Cloudflare Pages.
          التفاصيل في ملف دليل التشغيل.
        </p>
      </div>
    </div>
  );
}
