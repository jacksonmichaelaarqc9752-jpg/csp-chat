import Link from "next/link";
import { ArrowLeft, Bell, Database, KeyRound, Moon, Smartphone } from "lucide-react";
import { AppShell, BrandMark } from "@/components/app-shell";
import { GlassPanel, Tag } from "@/components/ui";

const rows = [
  {
    icon: Moon,
    title: "深色模式",
    desc: "默认开启，更适合夜间沉浸聊天。",
    value: "已开启"
  },
  {
    icon: Smartphone,
    title: "手机端体验",
    desc: "底部输入、安全区和小屏布局优先。",
    value: "优先"
  },
  {
    icon: Database,
    title: "数据源",
    desc: "角色和聊天记录保存到 Supabase。",
    value: "Supabase"
  },
  {
    icon: KeyRound,
    title: "AI 密钥",
    desc: "只放在服务端环境变量里，前端不会暴露。",
    value: "已配置"
  },
  {
    icon: Bell,
    title: "PWA 通知",
    desc: "后续添加到 iPhone 主屏幕后再增强。",
    value: "后续"
  }
];

export default function SettingsPage() {
  return (
    <AppShell>
      <div className="safe-top mx-auto max-w-3xl space-y-5 pb-8">
        <header className="flex items-center justify-between gap-3">
          <BrandMark />
          <Link
            href="/characters"
            className="inline-flex h-11 items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-slate-100 backdrop-blur"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </Link>
        </header>

        <GlassPanel className="overflow-hidden">
          <div className="h-48 bg-[url('https://images.unsplash.com/photo-1519681393784-d120267933ba?auto=format&fit=crop&w=1000&q=80')] bg-cover bg-center">
            <div className="flex h-full items-end bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent p-6">
              <div>
                <p className="text-sm text-cyan-100">设置</p>
                <h1 className="mt-2 text-3xl font-bold text-white">让聊天保持在你的节奏里。</h1>
              </div>
            </div>
          </div>
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap gap-2">
              <Tag>Vercel</Tag>
              <Tag>Supabase</Tag>
              <Tag>长期记忆</Tag>
              <Tag>手机优先</Tag>
            </div>
          </div>
        </GlassPanel>

        <section className="space-y-3">
          {rows.map((row) => (
            <GlassPanel key={row.title} className="p-4">
              <div className="flex items-center gap-4">
                <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10">
                  <row.icon className="h-5 w-5 text-pink-100" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-white">{row.title}</p>
                  <p className="mt-1 text-sm text-slate-400">{row.desc}</p>
                </div>
                <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs text-cyan-100">
                  {row.value}
                </span>
              </div>
            </GlassPanel>
          ))}
        </section>
      </div>
    </AppShell>
  );
}
