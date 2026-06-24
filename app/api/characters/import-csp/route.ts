import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { callJsonModel } from "@/lib/ai/server";

type ImportRequestBody = {
  skillText?: string;
  manifestText?: string | null;
  distillationText?: string | null;
};

type ImportedCharacter = {
  name: string;
  subtitle: string;
  description: string;
  tags: string[];
  greeting_message: string;
  personality: string;
  scenario: string;
  system_prompt: string;
  distilled_profile: string;
};

function createServerSupabaseClient(accessToken: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Missing Supabase environment variables");
  }

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
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) return null;
  return authorization.slice("Bearer ".length);
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const body = (await request.json()) as ImportRequestBody;
    const skillText = body.skillText?.trim();
    const manifestText = body.manifestText?.trim() || null;
    const distillationText = body.distillationText?.trim() || null;

    if (!skillText) {
      return NextResponse.json({ error: "skillText is required" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const imported = await callJsonModel<ImportedCharacter>(
      [
        {
          role: "system",
          content:
            "Convert uploaded anime character CSP files into structured fields for a roleplay chat app. Return strict JSON only. Preserve important character voice, constraints, background, and greeting. SKILL.md is authoritative. Use manifest.json and distillation.md when present."
        },
        {
          role: "user",
          content: JSON.stringify({
            skill_md: skillText,
            manifest_json: manifestText,
            distillation_md: distillationText,
            schema: {
              name: "character name",
              subtitle: "short anime-style positioning line",
              description: "short card description",
              tags: ["2-5 short tags"],
              greeting_message: "first message in character voice",
              personality: "personality traits and speaking style",
              scenario: "world, relationship, and situation",
              system_prompt: "complete roleplay system prompt",
              distilled_profile: "condensed original profile"
            }
          })
        }
      ],
      {
        name: "",
        subtitle: "",
        description: "",
        tags: ["original"],
        greeting_message: "",
        personality: "",
        scenario: "",
        system_prompt: skillText,
        distilled_profile: distillationText || skillText
      }
    );

    console.log("[CSP PARSE RESULT]", JSON.stringify(imported, null, 2));

    return NextResponse.json({ character: imported });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
