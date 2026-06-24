"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Loader2, LogOut, MessageCircle, Plus, Search, Settings, Sparkles } from "lucide-react";
import { AppShell, BrandMark } from "@/components/app-shell";
import { GlassPanel, GhostLink, Tag } from "@/components/ui";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { DbCharacter } from "@/lib/supabase/types";

export default function CharactersPage() {
  const router = useRouter();
  const [characters, setCharacters] = useState<DbCharacter[]>([]);
  const [query, setQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const configured = isSupabaseConfigured();

  useEffect(() => {
    async function loadCharacters() {
      if (!configured) {
        setNotice("未配置 Supabase 环境变量（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY），无法加载角色列表。");
        setCharacters([]);
        setIsLoading(false);
        return;
      }

      const supabase = createBrowserSupabaseClient();
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("characters")
        .select("*")
        .order("updated_at", { ascending: false });

      if (error) {
        setNotice("读取角色失败，请稍后重试。");
      } else {
        setCharacters(data ?? []);
      }

      setIsLoading(false);
    }

    loadCharacters();
  }, [configured, router]);

  const filteredCharacters = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    const list = Array.isArray(characters) ? characters : [];
    if (!keyword) return list;

    return list.filter((character) => {
      const text = [
        character.name,
        character.subtitle,
        character.description,
        character.personality,
        character.scenario,
        (character.tags ?? []).join(" ")
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(keyword);
    });
  }, [characters, query]);

  async function signOut() {
    if (configured) {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
    }

    router.replace("/login");
  }

  return (
    <AppShell>
      <div className="safe-top space-y-5 pb-8">
        <header className="flex items-center justify-between gap-3">
          <BrandMark />
          <div className="flex items-center gap-2">
            <GhostLink href="/settings" className="h-11 w-11 rounded-2xl px-0" aria-label="设置">
              <Settings className="h-4 w-4" />
            </GhostLink>
            <button
              className="grid h-11 w-11 place-items-center rounded-2xl border border-white/10 bg-white/10 text-slate-100 backdrop-blur"
              onClick={signOut}
              aria-label="退出登录"
            >
              <LogOut className="h-4 w-4" />
            </button>
            <GhostLink href="/characters/new">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">创建角色</span>
            </GhostLink>
          </div>
        </header>

        <section className="grid gap-4 lg:grid-cols-[1fr_340px]">
          <GlassPanel className="overflow-hidden p-5 sm:p-6">
            <div className="relative min-h-[210px] overflow-hidden rounded-[24px] bg-[url('https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80')] bg-cover bg-center">
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/70 to-slate-950/10" />
              <div className="relative flex min-h-[210px] flex-col justify-end p-5">
                <div className="mb-3 inline-flex w-fit items-center gap-2 rounded-full bg-white/10 px-3 py-2 text-xs text-pink-100 backdrop-blur">
                  <Sparkles className="h-4 w-4" />
                  我的角色
                </div>
                <h1 className="max-w-xl text-3xl font-bold leading-tight text-white sm:text-4xl">
                  选择一个角色，继续那段没说完的话。
                </h1>
                <p className="mt-3 max-w-lg text-sm leading-6 text-slate-300">
                  {configured
                    ? "这里会读取 Supabase 中保存的角色。"
                    : "当前未配置 Supabase，正在使用模拟角色预览。"}
                </p>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel className="p-5">
            <p className="text-sm font-semibold text-white">当前状态</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between rounded-2xl bg-white/8 p-3">
                <span className="text-sm text-slate-300">角色数量</span>
                <span className="font-semibold text-white">{(characters ?? []).length}</span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/8 p-3">
                <span className="text-sm text-slate-300">数据源</span>
                <span className="font-semibold text-pink-100">
                  {configured ? "Supabase" : "模拟数据"}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl bg-white/8 p-3">
                <span className="text-sm text-slate-300">模式</span>
                <span className="font-semibold text-cyan-100">沉浸聊天</span>
              </div>
            </div>
          </GlassPanel>
        </section>

        <div className="soft-glass flex items-center gap-3 rounded-3xl px-4 py-3">
          <Search className="h-4 w-4 text-slate-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索角色、标签或世界观"
            className="w-full bg-transparent text-sm text-white outline-none placeholder:text-slate-500"
          />
        </div>

        {notice && (
          <p className="rounded-2xl border border-pink-200/15 bg-pink-200/10 p-3 text-sm text-pink-100">
            {notice}
          </p>
        )}

        {isLoading ? (
          <div className="grid min-h-52 place-items-center">
            <div className="inline-flex items-center gap-3 text-sm text-slate-300">
              <Loader2 className="h-6 w-6 animate-spin text-pink-100" />
              正在加载角色…
            </div>
          </div>
        ) : filteredCharacters.length === 0 ? (
          <GlassPanel className="p-8 text-center">
            <p className="text-lg font-semibold text-white">还没有角色</p>
            <p className="mt-2 text-sm text-slate-400">先创建一个角色，再开始聊天。</p>
            <GhostLink href="/characters/new" className="mt-5">
              <Plus className="h-4 w-4" />
              创建角色
            </GhostLink>
          </GlassPanel>
        ) : (
          <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredCharacters.map((character) => (
              <Link
                href={`/chat/${character.id}`}
                key={character.id}
                className="group overflow-hidden rounded-[28px] border border-white/10 bg-white/8 shadow-soft-panel backdrop-blur transition hover:-translate-y-1 hover:bg-white/12"
              >
                <div
                  className="h-32 bg-cover bg-center"
                  style={{
                    backgroundImage: `url(${
                      character.banner_url ||
                      "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=80"
                    })`
                  }}
                >
                  <div className="h-full bg-gradient-to-t from-slate-950 to-transparent" />
                </div>
                <div className="-mt-9 p-4">
                  <img
                    src={
                      character.avatar_url ||
                      `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${character.name}`
                    }
                    alt={character.name}
                    className="h-20 w-20 rounded-[24px] border border-white/20 bg-slate-900 object-cover shadow-glow"
                  />
                  <div className="mt-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h2 className="text-lg font-semibold text-white">{character.name}</h2>
                        <p className="mt-1 text-xs text-pink-100">
                          {character.subtitle || "原创动漫角色"}
                        </p>
                      </div>
                      <MessageCircle className="mt-1 h-5 w-5 text-cyan-200 transition group-hover:scale-110" />
                    </div>
                    <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-300">
                      {character.description || character.greeting_message || "准备开始聊天。"}
                    </p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      {(character.tags?.length ? character.tags : ["私有角色"]).map((tag) => (
                        <Tag key={tag}>{tag}</Tag>
                      ))}
                    </div>
                    <div className="mt-4 flex items-center justify-between border-t border-white/10 pt-4">
                      <p className="text-xs text-slate-400">{character.mood || "平静"}</p>
                      <p className="text-xs text-slate-500">
                        {new Date(character.updated_at).toLocaleDateString("zh-CN")}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </section>
        )}
      </div>
    </AppShell>
  );
}
