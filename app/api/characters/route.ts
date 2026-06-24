import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  assertVisibleAsciiHeaderValue,
  getBearerTokenFromHeader,
  normalizeHeaderToken
} from "@/lib/http/safeHeaders";

type CreateCharacterRequestBody = {
  name?: string;
  subtitle?: string;
  description?: string;
  avatarUrl?: string;
  bannerUrl?: string;
  skillFileUrl?: string;
  manifestFileUrl?: string | null;
  distillationFileUrl?: string | null;
  tags?: string[];
  greetingMessage?: string;
  personality?: string;
  scenario?: string;
  distilledProfile?: string;
  systemPrompt?: string;
};

function createServerSupabaseClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    ?.replace(/\/rest\/v1\/?$/, "")
    .replace(/\/$/, "");
  const supabaseAnonKey = normalizeHeaderToken(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

  assertVisibleAsciiHeaderValue("NEXT_PUBLIC_SUPABASE_ANON_KEY", supabaseAnonKey);

  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: { Authorization: `Bearer ${accessToken}` }
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  });
}

function getBearerToken(request: NextRequest) {
  return getBearerTokenFromHeader(request.headers.get("authorization"));
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return NextResponse.json({ success: false, error: "Missing bearer token" }, { status: 401 });
    }

    const body = (await request.json()) as CreateCharacterRequestBody;
    const name = body.name?.trim();

    if (!name) {
      return NextResponse.json({ success: false, error: "Character name is required" }, { status: 400 });
    }

    if (!body.avatarUrl || !body.skillFileUrl) {
      return NextResponse.json(
        { success: false, error: "Avatar and SKILL.md uploads are required" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
    }

    const { data, error } = await supabase
      .from("characters")
      .insert({
        user_id: authData.user.id,
        name,
        subtitle: body.subtitle ?? "",
        description: body.description ?? "",
        avatar_url: body.avatarUrl,
        banner_url: body.bannerUrl ?? "",
        csp_skill_file_url: body.skillFileUrl,
        manifest_file_url: body.manifestFileUrl ?? null,
        distillation_file_url: body.distillationFileUrl ?? null,
        tags: body.tags ?? [],
        greeting_message: body.greetingMessage ?? "",
        personality: body.personality ?? "",
        scenario: body.scenario ?? "",
        distilled_profile: body.distilledProfile ?? "",
        system_prompt:
          body.systemPrompt || body.distilledProfile || body.personality || name
      })
      .select("*")
      .single();

    if (error || !data?.id) {
      return NextResponse.json(
        { success: false, error: error?.message || "Failed to create character" },
        { status: 400 }
      );
    }

    console.log("[CREATE CHARACTER]", { id: data.id, name: data.name });

    return NextResponse.json({ success: true, character: data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
