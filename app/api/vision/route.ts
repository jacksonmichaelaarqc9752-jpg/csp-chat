import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { describeImage } from "@/lib/ai/server";
import {
  assertVisibleAsciiHeaderValue,
  getBearerTokenFromHeader,
  normalizeHeaderToken
} from "@/lib/http/safeHeaders";

type VisionRequestBody = {
  imageUrl?: string;
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
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const body = (await request.json()) as VisionRequestBody;
    const imageUrl = body.imageUrl?.trim();

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required" }, { status: 400 });
    }

    const supabase = createServerSupabaseClient(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const description = await describeImage(imageUrl);
    return NextResponse.json({ description });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
