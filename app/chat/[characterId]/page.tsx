"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ImagePlus, Loader2, MoreHorizontal, Send, Sparkles, X } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { GlassPanel, Tag } from "@/components/ui";
import { cn } from "@/lib/utils";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";
import { DbCharacter, DbMessage } from "@/lib/supabase/types";
import { formatTime } from "@/lib/format";
import { createBearerAuthHeader } from "@/lib/http/safeHeaders";

export default function ChatPage({ params }: { params: { characterId: string } }) {
  const router = useRouter();
  const [character, setCharacter] = useState<DbCharacter | null>(null);
  const [messages, setMessages] = useState<DbMessage[]>([]);
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    async function loadChat() {
      console.log("[CHAT LOAD]", params.characterId);

      if (!configured) {
        setNotice("未配置 Supabase 环境变量（NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY），无法加载聊天。");
        setIsLoading(false);
        return;
      }

      const supabase = createBrowserSupabaseClient();
      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.replace("/login");
        return;
      }

      const { data: characterData, error: characterError } = await supabase
        .from("characters")
        .select("*")
        .eq("id", params.characterId)
        .single();

      if (characterError || !characterData) {
        console.error("[CHAT ERROR] loadCharacter failed:", { characterId: params.characterId, error: characterError });
        setNotice(`读取角色失败：${characterError?.message || "角色不存在"}。`);
        setIsLoading(false);
        return;
      }

      console.log("[CHAT LOAD] character loaded:", { id: characterData.id, name: characterData.name });

      // 硬守卫：加载的角色 ID 必须等于 URL param
      if (characterData.id !== params.characterId) {
        console.error("[CHAT ERROR] ID MISMATCH!", { urlId: params.characterId, loadedId: characterData.id });
        setNotice(`角色ID不匹配。URL期望: ${params.characterId}，实际加载: ${characterData.id}。请返回角色列表重新进入。`);
        setIsLoading(false);
        return;
      }

      const { data: messageData, error: messageError } = await supabase
        .from("messages")
        .select("*")
        .eq("character_id", params.characterId)
        .order("created_at", { ascending: true });

      if (messageError) {
        console.error("[CHAT ERROR] loadMessages failed:", { characterId: params.characterId, error: messageError });
        setNotice("读取聊天记录失败，请稍后重试。");
      }

      setCharacter(characterData ?? null);
      setMessages(Array.isArray(messageData) ? messageData : []);
      setIsLoading(false);
    }

    loadChat();
  }, [configured, params.characterId, router]);

  function clearSelectedImage() {
    if (selectedImagePreview) URL.revokeObjectURL(selectedImagePreview);
    setSelectedImage(null);
    setSelectedImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setNotice("请选择图片文件。");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setNotice("图片大小不能超过 8 MB。");
      return;
    }

    if (selectedImagePreview) URL.revokeObjectURL(selectedImagePreview);
    setSelectedImage(file);
    setSelectedImagePreview(URL.createObjectURL(file));
  }

  async function uploadImage(supabase: ReturnType<typeof createBrowserSupabaseClient>) {
    if (!selectedImage) return null;

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) throw new Error("用户未登录。");

    const extension = selectedImage.name.split(".").pop() || "jpg";
    const path = `${userData.user.id}/${params.characterId}/${crypto.randomUUID()}.${extension}`;
    const { error } = await supabase.storage
      .from("chat-images")
      .upload(path, selectedImage, {
        cacheControl: "3600",
        upsert: false
      });

    if (error) throw new Error("图片上传失败。");

    const { data } = supabase.storage.from("chat-images").getPublicUrl(path);
    return data.publicUrl;
  }

  async function sendMessage(event: FormEvent) {
    event.preventDefault();
    const content = input.trim();
    if ((!content && !selectedImage) || isSending || !character) return;

    setInput("");
    setIsSending(true);
    setNotice("");

    if (!configured) {
      setNotice("未配置 Supabase，无法发送消息。请设置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY 环境变量。");
      setInput(content);
      setIsSending(false);
      return;
    }

    try {
      const supabase = createBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const imageUrl = await uploadImage(supabase);

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          Authorization: createBearerAuthHeader(accessToken),
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          characterId: character.id,
          content,
          imageUrl,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone
        })
      });

      const data = await response.json();

      if (!response.ok) {
        console.error("[CHAT ERROR] /api/chat failed:", { status: response.status, error: data.error, characterId: character.id });
        setNotice(data.error || "AI 回复失败，请稍后重试。");
        setInput(content);
        setIsSending(false);
        return;
      }

      setMessages((current) => [...current, data.user_message, data.assistant_message]);
      clearSelectedImage();
      setIsSending(false);
      textareaRef.current?.focus();
    } catch (error) {
      console.error("[CHAT] sendMessage failed:", error);
      setNotice(error instanceof Error ? error.message : "发送失败，请稍后重试。");
      setInput(content);
      setIsSending(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell>
        <div className="grid min-h-screen place-items-center">
          <div className="inline-flex items-center gap-3 text-sm text-slate-300">
            <Loader2 className="h-8 w-8 animate-spin text-pink-100" />
            正在加载聊天…
          </div>
        </div>
      </AppShell>
    );
  }

  if (!character) {
    return (
      <AppShell>
        <div className="grid min-h-screen place-items-center">
          <GlassPanel className="max-w-md p-6 text-center">
            <p className="text-base font-semibold text-white">角色不存在</p>
            <p className="mt-2 text-sm text-slate-300">
              {notice || "请从角色列表选择一个角色。"}
            </p>
            <Link
              href="/characters"
              className="mt-5 inline-flex h-11 items-center justify-center rounded-2xl border border-white/10 bg-white/10 px-4 text-sm text-slate-100"
            >
              返回角色列表
            </Link>
          </GlassPanel>
        </div>
      </AppShell>
    );
  }

  const visibleMessages =
    Array.isArray(messages) && messages.length > 0
      ? messages
      : [
          {
            id: "greeting",
            user_id: character.user_id,
            character_id: character.id,
            role: "assistant" as const,
            content: character.greeting_message || "你好，今晚想聊些什么？",
            image_url: null,
            metadata: {},
            created_at: new Date().toISOString()
          }
        ];

  return (
    <AppShell>
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col">
        <header className="safe-top sticky top-0 z-20 -mx-4 border-b border-white/10 bg-slate-950/40 px-4 pb-3 backdrop-blur-2xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
          <div className="flex items-center gap-3">
            <Link
              href="/characters"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10"
              aria-label="返回角色列表"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <img
              src={
                character.avatar_url ||
                `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${character.name}`
              }
              alt={character.name}
              className="h-12 w-12 shrink-0 rounded-2xl border border-white/20 bg-slate-900"
            />
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-base font-semibold text-white">{character.name}</h1>
              <p className="truncate text-xs text-slate-400">
                {character.subtitle || "AI 聊天"}
              </p>
            </div>
            <Link
              href="/settings"
              className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10"
              aria-label="更多"
            >
              <MoreHorizontal className="h-5 w-5" />
            </Link>
          </div>
        </header>

        <section className="grid flex-1 gap-4 py-4 lg:grid-cols-[280px_1fr]">
          <aside className="hidden lg:block">
            <GlassPanel className="sticky top-24 overflow-hidden">
              <div
                className="h-40 bg-cover bg-center"
                style={{
                  backgroundImage: `url(${
                    character.banner_url ||
                    "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1200&q=80"
                  })`
                }}
              >
                <div className="h-full bg-gradient-to-t from-slate-950 to-transparent" />
              </div>
              <div className="p-5">
                <img
                  src={
                    character.avatar_url ||
                    `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${character.name}`
                  }
                  alt=""
                  className="-mt-14 h-24 w-24 rounded-[28px] border border-white/20 bg-slate-900 shadow-glow"
                />
                <h2 className="mt-4 text-xl font-bold text-white">{character.name}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-300">
                  {character.description || character.personality || "准备开始聊天。"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {(character.tags?.length ? character.tags : ["私有角色"]).map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl bg-white/8 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-400">当前情绪</p>
                    <p className="text-xs text-cyan-100">{character.mood ?? "平静"}</p>
                  </div>
                  <p className="mt-4 text-xs text-slate-400">好感度</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-pink-300 to-cyan-200"
                      style={{ width: `${character.affection ?? 0}%` }}
                    />
                  </div>
                  <p className="mt-2 text-right text-xs text-pink-100">{character.affection ?? 0}%</p>
                </div>
              </div>
            </GlassPanel>
          </aside>

          <div className="flex min-h-[70vh] flex-col">
            {notice && (
              <p className="mb-4 rounded-2xl border border-pink-200/15 bg-pink-200/10 p-3 text-sm text-pink-100">
                {notice}
              </p>
            )}

            <div className="flex-1 space-y-4 pb-40">
              <div className="mx-auto flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-2 text-xs text-slate-300 backdrop-blur">
                <Sparkles className="h-4 w-4 text-pink-100" />
                长期记忆、图片识别、情绪和好感度会在聊天中自动生效
              </div>

              {visibleMessages.map((message) => (
                <div
                  key={message.id}
                  className={cn(
                    "flex gap-3",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <img
                      src={
                        character.avatar_url ||
                        `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${character.name}`
                      }
                      alt=""
                      className="mt-1 h-9 w-9 rounded-2xl border border-white/15 bg-slate-900"
                    />
                  )}
                  <div
                    className={cn(
                      "max-w-[82%] rounded-[24px] px-4 py-3 text-sm leading-6 shadow-soft-panel sm:max-w-[70%]",
                      message.role === "user"
                        ? "bg-gradient-to-br from-pink-300 to-cyan-200 text-slate-950"
                        : "border border-white/10 bg-white/10 text-slate-100 backdrop-blur"
                    )}
                  >
                    {message.image_url && (
                      <img
                        src={message.image_url}
                        alt=""
                        className="mb-3 max-h-64 rounded-2xl object-cover"
                      />
                    )}
                    <p>{message.content}</p>
                    <p
                      className={cn(
                        "mt-2 text-right text-[11px]",
                        message.role === "user" ? "text-slate-800/70" : "text-slate-500"
                      )}
                    >
                      {formatTime(message.created_at)}
                    </p>
                  </div>
                </div>
              ))}

              {isSending && (
                <div className="flex items-center gap-3">
                  <img
                    src={
                      character.avatar_url ||
                      `https://api.dicebear.com/9.x/adventurer-neutral/svg?seed=${character.name}`
                    }
                    alt=""
                    className="h-9 w-9 rounded-2xl border border-white/15 bg-slate-900"
                  />
                  <div className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-slate-300 backdrop-blur">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在输入…
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>

        <form
          onSubmit={sendMessage}
          className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-slate-950/70 px-4 py-3 backdrop-blur-2xl"
        >
          <div className="mx-auto max-w-5xl">
            {selectedImagePreview && (
              <div className="mb-3 flex w-fit items-center gap-2 rounded-2xl border border-white/10 bg-white/10 p-2">
                <img src={selectedImagePreview} alt="" className="h-16 w-16 rounded-xl object-cover" />
                <button
                  type="button"
                  onClick={clearSelectedImage}
                  className="grid h-8 w-8 place-items-center rounded-xl bg-slate-950/50 text-slate-200"
                  aria-label="移除图片"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <input
                ref={fileInputRef}
                className="hidden"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/10 text-slate-200"
                aria-label="上传图片"
              >
                <ImagePlus className="h-5 w-5" />
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && !event.shiftKey) {
                    event.preventDefault();
                    sendMessage(event);
                  }
                }}
                rows={1}
                placeholder={`和 ${character.name} 说点什么...`}
                className="max-h-32 min-h-12 flex-1 resize-none rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-500 focus:border-pink-300/60 focus:ring-4 focus:ring-pink-300/10"
              />
              <button
                type="submit"
                disabled={(!input.trim() && !selectedImage) || isSending}
                className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-pink-300 to-cyan-200 text-slate-950 shadow-glow transition active:scale-95 disabled:opacity-50"
                aria-label="发送"
              >
                <Send className="h-5 w-5" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
