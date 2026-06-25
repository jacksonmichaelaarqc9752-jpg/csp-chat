"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { ArrowLeft, Database, KeyRound, Moon, Save, Smartphone, Trash2 } from "lucide-react";
import { AppShell, BrandMark } from "@/components/app-shell";
import { GlassPanel, Tag } from "@/components/ui";

type AiConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
};

const defaultConfig: AiConfig = {
  apiKey: "",
  baseURL: "",
  model: ""
};

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
  }
];

export default function SettingsPage() {
  const [config, setConfig] = useState<AiConfig>(defaultConfig);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    try {
      const raw = localStorage.getItem("ai_config");
      if (!raw) return;

      const saved = JSON.parse(raw) as Partial<AiConfig>;
      setConfig({
        apiKey: saved.apiKey || "",
        baseURL: saved.baseURL || "",
        model: saved.model || ""
      });
    } catch {
      setNotice("本地 AI 配置读取失败，请重新填写。");
    }
  }, []);

  function updateConfig(key: keyof AiConfig, value: string) {
    setConfig((current) => ({ ...current, [key]: value }));
  }

  function saveConfig(event: FormEvent) {
    event.preventDefault();
    const nextConfig = {
      apiKey: config.apiKey.trim(),
      baseURL: config.baseURL.trim().replace(/\/$/, ""),
      model: config.model.trim()
    };

    if (!nextConfig.apiKey || !nextConfig.baseURL || !nextConfig.model) {
      setNotice("请填写 API Key、Base URL 和模型名称。");
      return;
    }

    localStorage.setItem("ai_config", JSON.stringify(nextConfig));
    setConfig(nextConfig);
    setNotice("AI 配置已保存到当前浏览器。");
  }

  function clearConfig() {
    localStorage.removeItem("ai_config");
    setConfig(defaultConfig);
    setNotice("AI 配置已清除。");
  }

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
                <h1 className="mt-2 text-3xl font-bold text-white">把聊天节奏交给你的模型。</h1>
              </div>
            </div>
          </div>
          <div className="p-5 sm:p-6">
            <div className="flex flex-wrap gap-2">
              <Tag>BYOK 试用模式</Tag>
              <Tag>本地保存</Tag>
              <Tag>不写数据库</Tag>
              <Tag>Supabase</Tag>
            </div>
          </div>
        </GlassPanel>

        <GlassPanel className="p-5 sm:p-6">
          <div className="flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white/10">
              <KeyRound className="h-5 w-5 text-pink-100" />
            </div>
            <div>
              <h2 className="font-semibold text-white">AI 配置</h2>
              <p className="mt-1 text-sm text-slate-400">API Key 只保存在当前浏览器的 localStorage，不写入数据库。</p>
            </div>
          </div>

          <form onSubmit={saveConfig} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-sm text-slate-300">API Key</span>
              <input
                type="password"
                value={config.apiKey}
                onChange={(event) => updateConfig("apiKey", event.target.value)}
                placeholder="请输入你的 API Key"
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-pink-300/60 focus:ring-4 focus:ring-pink-300/10"
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-300">Base URL</span>
              <input
                value={config.baseURL}
                onChange={(event) => updateConfig("baseURL", event.target.value)}
                placeholder="例如：https://api.xiaomimimo.com/v1"
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-pink-300/60 focus:ring-4 focus:ring-pink-300/10"
              />
            </label>

            <label className="block">
              <span className="text-sm text-slate-300">模型名称</span>
              <input
                value={config.model}
                onChange={(event) => updateConfig("model", event.target.value)}
                placeholder="例如：mimo-v2.5-pro"
                className="mt-2 h-12 w-full rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-white outline-none placeholder:text-slate-500 focus:border-pink-300/60 focus:ring-4 focus:ring-pink-300/10"
              />
            </label>

            {notice && (
              <p className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-cyan-100">
                {notice}
              </p>
            )}

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-pink-300 to-cyan-200 px-5 text-sm font-semibold text-slate-950 shadow-glow transition active:scale-95"
              >
                <Save className="h-4 w-4" />
                保存
              </button>
              <button
                type="button"
                onClick={clearConfig}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-5 text-sm text-slate-100"
              >
                <Trash2 className="h-4 w-4" />
                清除
              </button>
            </div>
          </form>
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
