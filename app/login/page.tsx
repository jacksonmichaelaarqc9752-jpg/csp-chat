"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";
import { ArrowRight, Loader2, MailCheck, Moon, Shield, Sparkles } from "lucide-react";
import { AppShell, BrandMark } from "@/components/app-shell";
import { GlassPanel, PrimaryButton, TextInput } from "@/components/ui";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

function isEmailNotConfirmedError(message: string) {
  return message.toLowerCase().includes("email not confirmed");
}

function formatAuthError(message: string) {
  const lower = message.toLowerCase();

  if (lower.includes("invalid login credentials")) return "邮箱或密码不正确。";
  if (lower.includes("email not confirmed")) return "这个账号的邮箱还没有确认。";
  if (lower.includes("user already registered")) return "这个邮箱已经注册过了，请直接登录。";
  if (lower.includes("signup is disabled")) return "当前 Supabase 项目关闭了注册功能。";
  if (lower.includes("password")) return "密码不符合要求，请至少输入 6 位。";
  if (lower.includes("fetch failed") || lower.includes("failed to fetch")) {
    return "无法连接 Supabase，请检查 NEXT_PUBLIC_SUPABASE_URL 是否正确。";
  }

  return message || "操作失败，请检查输入后重试。";
}

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [message, setMessage] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    let cancelled = false;

    async function checkSession() {
      if (!configured) {
        setIsCheckingSession(false);
        setMessage("Supabase 环境变量未配置，登录和注册暂时不可用。");
        return;
      }

      try {
        const supabase = createBrowserSupabaseClient();
        const { data, error } = await supabase.auth.getSession();

        if (cancelled) return;

        if (error) {
          setMessage(formatAuthError(error.message));
          setIsCheckingSession(false);
          return;
        }

        if (data.session) {
          router.replace("/characters");
          return;
        }
      } catch (error) {
        if (!cancelled) {
          setMessage(formatAuthError(error instanceof Error ? error.message : "检查登录状态失败"));
        }
      } finally {
        if (!cancelled) setIsCheckingSession(false);
      }
    }

    checkSession();

    return () => {
      cancelled = true;
    };
  }, [configured, router]);

  async function resendConfirmation() {
    const normalizedEmail = email.trim();
    if (!configured) {
      setMessage("Supabase 环境变量未配置，无法重新发送确认邮件。");
      return;
    }
    if (!normalizedEmail) {
      setMessage("请先输入邮箱。");
      return;
    }

    setIsResending(true);
    setMessage("");

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
        options: {
          emailRedirectTo:
            typeof window !== "undefined" ? `${window.location.origin}/login` : undefined
        }
      });

      if (error) {
        setMessage(formatAuthError(error.message));
        return;
      }

      setMessage("确认邮件已重新发送。开发阶段也可以在 Supabase Auth 设置里关闭邮箱确认。");
    } catch (error) {
      setMessage(formatAuthError(error instanceof Error ? error.message : "重新发送失败"));
    } finally {
      setIsResending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    setNeedsConfirmation(false);

    const normalizedEmail = email.trim();

    if (!configured) {
      setMessage("Supabase 环境变量未配置，不能登录或注册。请先配置 NEXT_PUBLIC_SUPABASE_URL 和 NEXT_PUBLIC_SUPABASE_ANON_KEY。");
      return;
    }

    if (!normalizedEmail || !password) {
      setMessage("请输入邮箱和密码。");
      return;
    }

    if (password.length < 6) {
      setMessage("密码至少需要 6 位。");
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const result =
        mode === "login"
          ? await supabase.auth.signInWithPassword({
              email: normalizedEmail,
              password
            })
          : await supabase.auth.signUp({
              email: normalizedEmail,
              password,
              options: {
                emailRedirectTo:
                  typeof window !== "undefined" ? `${window.location.origin}/login` : undefined,
                data: {
                  display_name: displayName.trim() || normalizedEmail.split("@")[0]
                }
              }
            });

      if (result.error) {
        if (isEmailNotConfirmedError(result.error.message)) {
          setNeedsConfirmation(true);
        }
        setMessage(formatAuthError(result.error.message));
        return;
      }

      if (mode === "register" && !result.data.session) {
        setNeedsConfirmation(true);
        setMode("login");
        setMessage("注册成功，但当前项目要求邮箱确认。请检查邮箱后再登录，或在 Supabase 里关闭邮箱确认。");
        return;
      }

      const { data: sessionData } = await supabase.auth.getSession();
      if (!sessionData.session) {
        setMessage("登录成功但没有获取到 session，请刷新页面后重试。");
        return;
      }

      router.replace("/characters");
      router.refresh();
    } catch (error) {
      setMessage(formatAuthError(error instanceof Error ? error.message : "登录请求失败"));
    } finally {
      setIsLoading(false);
    }
  }

  const submitDisabled = isLoading || isCheckingSession || !configured;

  return (
    <AppShell>
      <div className="flex min-h-screen flex-col py-4">
        <header className="safe-top flex items-center justify-between">
          <BrandMark />
          <Link
            href="/settings"
            className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs text-slate-200 backdrop-blur"
          >
            设置
          </Link>
        </header>

        <div className="grid flex-1 items-center gap-6 py-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <section className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-pink-200/20 bg-pink-200/10 px-3 py-2 text-xs text-pink-100">
              <Sparkles className="h-4 w-4" />
              Supabase 云端登录
            </div>
            <div className="space-y-4">
              <h1 className="max-w-2xl text-4xl font-bold leading-tight text-white sm:text-5xl lg:text-6xl">
                创建你的 AI 动漫角色聊天世界。
              </h1>
              <p className="max-w-xl text-base leading-7 text-slate-300">
                登录后，角色和聊天记录会保存到 Supabase，手机和电脑都能继续聊天。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["登录", "邮箱账号"],
                ["存档", "保存聊天"],
                ["隐私", "只看自己的数据"]
              ].map(([title, desc]) => (
                <div key={title} className="soft-glass rounded-3xl p-4">
                  <p className="text-sm font-semibold text-white">{title}</p>
                  <p className="mt-1 text-xs text-slate-400">{desc}</p>
                </div>
              ))}
            </div>
          </section>

          <GlassPanel className="mx-auto w-full max-w-md p-5 sm:p-6">
            <div className="mb-6 overflow-hidden rounded-[24px] border border-white/10">
              <div className="relative h-40 bg-[url('https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=1000&q=80')] bg-cover bg-center">
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/35 to-transparent" />
                <div className="absolute bottom-4 left-4 flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15 backdrop-blur">
                    <Moon className="h-6 w-6 text-pink-100" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">
                      {mode === "login" ? "欢迎回来" : "创建账号"}
                    </p>
                    <p className="text-xs text-slate-300">你的角色正在等你。</p>
                  </div>
                </div>
              </div>
            </div>

            <form className="space-y-4" onSubmit={handleSubmit}>
              {mode === "register" && (
                <label className="block space-y-2">
                  <span className="text-sm text-slate-300">昵称</span>
                  <TextInput
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    placeholder="你的名字"
                  />
                </label>
              )}

              <label className="block space-y-2">
                <span className="text-sm text-slate-300">邮箱</span>
                <TextInput
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@example.com"
                  required
                  type="email"
                  autoComplete="email"
                />
              </label>

              <label className="block space-y-2">
                <span className="text-sm text-slate-300">密码</span>
                <TextInput
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="至少 6 位"
                  required
                  minLength={6}
                  type="password"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                />
              </label>

              <PrimaryButton className="w-full" disabled={submitDisabled}>
                {(isLoading || isCheckingSession) && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "login" ? "登录" : "注册"}
                <ArrowRight className="h-4 w-4" />
              </PrimaryButton>
            </form>

            <div className="mt-5 grid grid-cols-2 gap-3">
              <button
                type="button"
                className="soft-glass rounded-2xl px-3 py-3 text-sm text-slate-200"
                onClick={() => {
                  setMode(mode === "login" ? "register" : "login");
                  setMessage("");
                  setNeedsConfirmation(false);
                }}
              >
                {mode === "login" ? "注册账号" : "返回登录"}
              </button>
              <button
                type="button"
                className="soft-glass rounded-2xl px-3 py-3 text-sm text-slate-200"
                onClick={() => setMessage("请在 Supabase Auth 邮件模板里配置找回密码流程，MVP 暂未接入。")}
              >
                忘记密码
              </button>
            </div>

            {message && (
              <div className="mt-4 rounded-2xl border border-pink-200/15 bg-pink-200/10 p-3 text-sm text-pink-100">
                <p>{message}</p>
                {needsConfirmation && (
                  <button
                    type="button"
                    onClick={resendConfirmation}
                    disabled={isResending}
                    className="mt-3 inline-flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-medium text-white disabled:opacity-60"
                  >
                    {isResending ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MailCheck className="h-3.5 w-3.5" />
                    )}
                    重新发送确认邮件
                  </button>
                )}
              </div>
            )}

            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-cyan-200/10 bg-cyan-200/8 p-3 text-xs leading-5 text-slate-300">
              <Shield className="mt-0.5 h-4 w-4 shrink-0 text-cyan-200" />
              <p>
                {configured
                  ? "已连接 Supabase。请确认 Vercel 和本地都配置了正确环境变量。"
                  : "还没有配置 Supabase，登录和注册按钮已禁用。"}
              </p>
            </div>
          </GlassPanel>
        </div>
      </div>
    </AppShell>
  );
}
