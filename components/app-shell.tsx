import { Sparkles } from "lucide-react";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-aurora-night text-slate-50">
      <div className="anime-grid pointer-events-none absolute inset-0 opacity-70" />
      <div className="pointer-events-none absolute -left-24 top-20 h-72 w-72 rounded-full bg-pink-400/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-28 top-8 h-80 w-80 rounded-full bg-cyan-300/15 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-violet-400/15 blur-3xl" />
      <div className="relative z-10 mx-auto min-h-screen w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
        {children}
      </div>
    </main>
  );
}

export function BrandMark() {
  return (
    <div className="flex items-center gap-2">
      <div className="grid h-10 w-10 place-items-center rounded-2xl border border-white/15 bg-white/10 shadow-glow backdrop-blur-xl">
        <Sparkles className="h-5 w-5 text-pink-200" />
      </div>
      <div>
        <p className="text-base font-semibold tracking-wide text-white">YumeChat</p>
        <p className="text-xs text-slate-300">AI 动漫角色聊天</p>
      </div>
    </div>
  );
}
