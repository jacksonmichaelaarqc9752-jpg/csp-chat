"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";
import { ArrowLeft, FileText, ImagePlus, Loader2, Save, UploadCloud, Wand2 } from "lucide-react";
import { AppShell, BrandMark } from "@/components/app-shell";
import { GlassPanel, PrimaryButton, TextArea, TextInput, Tag } from "@/components/ui";
import { createBrowserSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

type ImportedCharacter = {
  name?: string;
  subtitle?: string;
  description?: string;
  tags?: string[];
  greeting_message?: string;
  personality?: string;
  scenario?: string;
  system_prompt?: string;
  distilled_profile?: string;
};

type UploadResult = {
  publicUrl: string;
  path: string;
};

type CreateCharacterPayload = {
  name: string;
  subtitle: string;
  description: string;
  avatarUrl: string;
  bannerUrl: string;
  skillFileUrl: string;
  manifestFileUrl: string | null;
  distillationFileUrl: string | null;
  tags: string[];
  greetingMessage: string;
  personality: string;
  scenario: string;
  distilledProfile: string;
  systemPrompt: string;
};

type CreateCharacterResult =
  | {
      success: true;
      id: string;
    }
  | {
      success: false;
      error?: string;
    };

const characterAssetsBucket = "character-assets";
const defaultBanner =
  "https://images.unsplash.com/photo-1528164344705-47542687000d?auto=format&fit=crop&w=900&q=80";
const defaultSystemPrompt =
  "你正在扮演一个原创动漫角色。请始终保持角色口吻，不要说自己是 AI，并自然延续最近对话。";

function fileNameLabel(file: File | null, fallback: string) {
  return file ? file.name : fallback;
}

function validateFileName(file: File | null, expectedName: string, required: boolean) {
  if (!file) return required ? `请上传 ${expectedName}。` : "";
  return file.name === expectedName ? "" : `文件名必须是 ${expectedName}，当前是 ${file.name}。`;
}

async function uploadFile({
  supabase,
  file,
  path
}: {
  supabase: ReturnType<typeof createBrowserSupabaseClient>;
  file: File;
  path: string;
}): Promise<UploadResult> {
  const { error } = await supabase.storage.from(characterAssetsBucket).upload(path, file, {
    contentType: file.type || "application/octet-stream",
    upsert: false
  });

  if (error) throw error;

  const { data } = supabase.storage.from(characterAssetsBucket).getPublicUrl(path);
  return { publicUrl: data.publicUrl, path };
}

async function createCharacter(
  accessToken: string,
  payload: CreateCharacterPayload
): Promise<CreateCharacterResult> {
  const response = await fetch("/api/characters", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  const result = (await response.json()) as CreateCharacterResult;

  if (!response.ok || !result?.success || !result?.id) {
    return {
      success: false,
      error: result?.error || "创建角色失败，请稍后重试。"
    } satisfies CreateCharacterResult;
  }

  return { success: true, id: result.id };
}

export default function NewCharacterPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [description, setDescription] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [tagsText, setTagsText] = useState("原创, 私有角色");
  const [personality, setPersonality] = useState("");
  const [scenario, setScenario] = useState("");
  const [greetingMessage, setGreetingMessage] = useState("");
  const [distilledProfile, setDistilledProfile] = useState("");
  const [systemPrompt, setSystemPrompt] = useState(defaultSystemPrompt);
  const [skillFile, setSkillFile] = useState<File | null>(null);
  const [manifestFile, setManifestFile] = useState<File | null>(null);
  const [distillationFile, setDistillationFile] = useState<File | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const configured = isSupabaseConfigured();

  const tags = useMemo(
    () =>
      tagsText
        .split(/[,，]/)
        .map((tag) => tag.trim())
        .filter(Boolean),
    [tagsText]
  );

  const avatarPreviewUrl = useMemo(() => {
    if (!avatarFile) return avatarUrl;
    return URL.createObjectURL(avatarFile);
  }, [avatarFile, avatarUrl]);

  function applyImportedCharacter(imported: ImportedCharacter) {
    console.log("[CSP PARSE RESULT]", imported);

    // 只填充空字段，不覆盖用户已输入的内容
    const filled: string[] = [];
    if (imported.name && !name) { setName(imported.name); filled.push("name"); }
    if (imported.subtitle && !subtitle) { setSubtitle(imported.subtitle); filled.push("subtitle"); }
    if (imported.description && !description) { setDescription(imported.description); filled.push("description"); }
    if (imported.tags?.length && !tagsText.trim()) { setTagsText(imported.tags.join(", ")); filled.push("tags"); }
    if (imported.greeting_message && !greetingMessage) { setGreetingMessage(imported.greeting_message); filled.push("greeting_message"); }
    if (imported.personality && !personality) { setPersonality(imported.personality); filled.push("personality"); }
    if (imported.scenario && !scenario) { setScenario(imported.scenario); filled.push("scenario"); }
    if (imported.system_prompt && !systemPrompt) { setSystemPrompt(imported.system_prompt); filled.push("system_prompt"); }
    if (imported.distilled_profile && !distilledProfile) { setDistilledProfile(imported.distilled_profile); filled.push("distilled_profile"); }

    console.log("[CSP FORM FILLED]", filled.length ? filled : "No fields updated (all already filled or imported values are empty)");
  }

  function validateUploads() {
    const errors = [
      validateFileName(skillFile, "SKILL.md", true),
      validateFileName(manifestFile, "manifest.json", false),
      validateFileName(distillationFile, "distillation.md", false)
    ].filter(Boolean);

    if (!avatarFile) errors.push("请上传角色头像图片。");
    if (avatarFile && !avatarFile.type.startsWith("image/")) {
      errors.push("头像必须是图片文件。");
    }

    return errors;
  }

  async function importCspSkill() {
    setMessage("");
    const errors = [
      validateFileName(skillFile, "SKILL.md", true),
      validateFileName(manifestFile, "manifest.json", false),
      validateFileName(distillationFile, "distillation.md", false)
    ].filter(Boolean);

    if (errors.length) {
      setMessage(errors.join(" "));
      return;
    }

    setIsImporting(true);

    try {
      const skillText = await skillFile!.text();
      const manifestText = manifestFile ? await manifestFile.text() : null;
      const distillationText = distillationFile ? await distillationFile.text() : null;

      if (!configured) {
        setSystemPrompt(skillText);
        setDistilledProfile(distillationText || skillText);
        setMessage("本地预览模式：已读取 SKILL.md 文件内容。配置 Supabase 后才能创建角色。");
        return;
      }

      const supabase = createBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const response = await fetch("/api/characters/import-csp", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ skillText, manifestText, distillationText })
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error || "解析 CSP 文件失败，请稍后重试。");
        return;
      }

      applyImportedCharacter(data.character);
      setMessage("CSP 文件已解析并填入表单。");
    } catch {
      setMessage("读取或解析文件失败，请检查文件内容后重试。");
    } finally {
      setIsImporting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");

    const uploadErrors = validateUploads();
    if (uploadErrors.length) {
      setMessage(uploadErrors.join(" "));
      return;
    }

    if (!configured) {
      setMessage("Supabase 未配置，无法创建角色。请配置 Supabase 后重试。");
      return;
    }

    setIsSaving(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData.session?.access_token;

      if (!accessToken) {
        router.replace("/login");
        return;
      }

      const { data: userData } = await supabase.auth.getUser();

      if (!userData.user) {
        router.replace("/login");
        return;
      }

      const uploadRoot = `${userData.user.id}/${crypto.randomUUID()}`;
      const [skillUpload, manifestUpload, distillationUpload, avatarUpload] = await Promise.all([
        uploadFile({
          supabase,
          file: skillFile!,
          path: `${uploadRoot}/SKILL.md`
        }),
        manifestFile
          ? uploadFile({
              supabase,
              file: manifestFile,
              path: `${uploadRoot}/manifest.json`
            })
          : Promise.resolve(null),
        distillationFile
          ? uploadFile({
              supabase,
              file: distillationFile,
              path: `${uploadRoot}/distillation.md`
            })
          : Promise.resolve(null),
        uploadFile({
          supabase,
          file: avatarFile!,
          path: `${uploadRoot}/avatar-${avatarFile!.name}`
        })
      ]);

      const res = await createCharacter(accessToken, {
        name,
        subtitle,
        description,
        avatarUrl: avatarUpload.publicUrl,
        bannerUrl: defaultBanner,
        skillFileUrl: skillUpload.publicUrl,
        manifestFileUrl: manifestUpload?.publicUrl ?? null,
        distillationFileUrl: distillationUpload?.publicUrl ?? null,
        tags,
        greetingMessage,
        personality,
        scenario,
        distilledProfile,
        systemPrompt
      });

      console.log("createCharacter result:", res);

      if (!res.success || !res.id) {
        setMessage(res.error || "创建角色失败，请检查必填项后重试。");
        return;
      }

      router.push(`/chat/${res.id}`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "创建角色失败，请稍后重试。";
      setMessage(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <AppShell>
      <div className="safe-top safe-bottom space-y-5 pb-24 lg:pb-8">
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

        <form onSubmit={handleSubmit} className="grid gap-5 lg:grid-cols-[1fr_360px]">
          <GlassPanel className="p-5 sm:p-6">
            <div className="mb-6">
              <p className="text-sm text-pink-100">创建角色</p>
              <h1 className="mt-2 text-3xl font-bold text-white">上传 CSP 文件并生成角色</h1>
              <p className="mt-2 text-sm leading-6 text-slate-300">
                必须上传 SKILL.md 和头像图片；manifest.json 与 distillation.md 可选。
              </p>
            </div>

            <div className="grid gap-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="rounded-3xl border border-dashed border-pink-200/30 bg-white/8 p-4">
                  <span className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-100">
                    <FileText className="h-4 w-4 text-pink-100" />
                    SKILL.md（必须）
                  </span>
                  <input
                    type="file"
                    accept=".md,text/markdown,text/plain"
                    className="sr-only"
                    onChange={(event) => setSkillFile(event.target.files?.[0] ?? null)}
                  />
                  <span className="flex min-h-11 items-center justify-center rounded-2xl bg-slate-950/40 px-3 text-center text-xs text-slate-300">
                    {fileNameLabel(skillFile, "点击选择 SKILL.md")}
                  </span>
                </label>

                <label className="rounded-3xl border border-dashed border-cyan-200/25 bg-white/8 p-4">
                  <span className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-100">
                    <ImagePlus className="h-4 w-4 text-cyan-100" />
                    头像图片（必须）
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    onChange={(event) => setAvatarFile(event.target.files?.[0] ?? null)}
                  />
                  <span className="flex min-h-11 items-center justify-center rounded-2xl bg-slate-950/40 px-3 text-center text-xs text-slate-300">
                    {fileNameLabel(avatarFile, "点击选择头像图片")}
                  </span>
                </label>

                <label className="rounded-3xl border border-dashed border-white/15 bg-white/8 p-4">
                  <span className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-100">
                    <FileText className="h-4 w-4 text-slate-200" />
                    manifest.json（可选）
                  </span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    className="sr-only"
                    onChange={(event) => setManifestFile(event.target.files?.[0] ?? null)}
                  />
                  <span className="flex min-h-11 items-center justify-center rounded-2xl bg-slate-950/40 px-3 text-center text-xs text-slate-300">
                    {fileNameLabel(manifestFile, "点击选择 manifest.json")}
                  </span>
                </label>

                <label className="rounded-3xl border border-dashed border-white/15 bg-white/8 p-4">
                  <span className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-100">
                    <FileText className="h-4 w-4 text-slate-200" />
                    distillation.md（可选）
                  </span>
                  <input
                    type="file"
                    accept=".md,text/markdown,text/plain"
                    className="sr-only"
                    onChange={(event) => setDistillationFile(event.target.files?.[0] ?? null)}
                  />
                  <span className="flex min-h-11 items-center justify-center rounded-2xl bg-slate-950/40 px-3 text-center text-xs text-slate-300">
                    {fileNameLabel(distillationFile, "点击选择 distillation.md")}
                  </span>
                </label>
              </div>

              <button
                type="button"
                onClick={importCspSkill}
                disabled={isImporting}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/10 px-4 py-2 text-sm font-medium text-slate-100 backdrop-blur transition hover:bg-white/14 disabled:opacity-60"
              >
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                {isImporting ? "正在解析..." : "解析 CSP 文件"}
              </button>

              <div className="grid gap-4 sm:grid-cols-[120px_1fr]">
                <div className="grid aspect-square place-items-center overflow-hidden rounded-[28px] border border-dashed border-white/20 bg-white/8 text-slate-300">
                  {avatarPreviewUrl ? (
                    <img src={avatarPreviewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="flex flex-col items-center gap-2 text-xs">
                      <ImagePlus className="h-6 w-6" />
                      头像预览
                    </span>
                  )}
                </div>
                <div className="grid gap-4">
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">角色名称</span>
                    <TextInput
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="例如：星野澪"
                      required
                    />
                  </label>
                  <label className="space-y-2">
                    <span className="text-sm text-slate-300">角色副标题</span>
                    <TextInput
                      value={subtitle}
                      onChange={(event) => setSubtitle(event.target.value)}
                      placeholder="雨夜图书馆的毒舌学姐"
                    />
                  </label>
                </div>
              </div>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">标签</span>
                <TextInput
                  value={tagsText}
                  onChange={(event) => setTagsText(event.target.value)}
                  placeholder="校园, 傲娇, 轻小说"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">角色简介</span>
                <TextArea
                  rows={3}
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="展示在角色卡片上的简短介绍。"
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">性格设定</span>
                <TextArea
                  rows={4}
                  value={personality}
                  onChange={(event) => setPersonality(event.target.value)}
                  placeholder="性格、说话方式、情绪规则..."
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">世界观 / 场景</span>
                <TextArea
                  rows={4}
                  value={scenario}
                  onChange={(event) => setScenario(event.target.value)}
                  placeholder="世界观、你们的关系、当前处境..."
                />
              </label>

              <label className="space-y-2">
                <span className="text-sm text-slate-300">开场白</span>
                <TextArea
                  rows={3}
                  value={greetingMessage}
                  onChange={(event) => setGreetingMessage(event.target.value)}
                  placeholder="角色进入聊天时说的第一句话。"
                />
              </label>

              {message && (
                <p className="rounded-2xl border border-pink-200/15 bg-pink-200/10 p-3 text-sm text-pink-100">
                  {message}
                </p>
              )}
            </div>
          </GlassPanel>

          <aside className="space-y-4">
            <GlassPanel className="overflow-hidden">
              <div
                className="h-44 bg-cover bg-center"
                style={{ backgroundImage: `url(${defaultBanner})` }}
              >
                <div className="flex h-full items-end bg-gradient-to-t from-slate-950 via-slate-950/45 to-transparent p-5">
                  <div>
                    <p className="text-sm text-pink-100">实时预览</p>
                    <h2 className="mt-1 text-2xl font-bold text-white">{name || "未命名角色"}</h2>
                    <p className="mt-1 text-sm text-slate-300">{subtitle || "原创动漫角色"}</p>
                  </div>
                </div>
              </div>
              <div className="p-5">
                <p className="text-sm leading-6 text-slate-300">
                  {description || "保存成功后才会进入聊天页；创建失败会停留在当前页面。"}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Tag key={tag}>{tag}</Tag>
                  ))}
                </div>
              </div>
            </GlassPanel>

            <GlassPanel className="p-5">
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-pink-300/15">
                  <UploadCloud className="h-5 w-5 text-pink-100" />
                </div>
                <div>
                  <p className="font-semibold text-white">文件会保存到 Supabase Storage</p>
                  <p className="text-xs leading-5 text-slate-400">
                    角色创建成功后，文件 public URL 会写入 characters 表。
                  </p>
                </div>
              </div>
            </GlassPanel>
          </aside>

          <div className="fixed inset-x-4 bottom-4 z-20 mx-auto max-w-6xl lg:static lg:inset-auto lg:col-span-2">
            <PrimaryButton className="w-full lg:w-auto" disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {isSaving ? "正在上传并保存..." : "保存并开始聊天"}
            </PrimaryButton>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
