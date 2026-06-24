import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildCharacterPrompt } from "@/lib/ai/promptBuilder";
import { maybeExtractAndStoreMemory, retrieveRelevantMemories } from "@/lib/ai/memoryService";
import { callChatModel, callJsonModel, describeImage } from "@/lib/ai/server";
import { DbCharacter, DbMessage, DbRelationshipState } from "@/lib/supabase/types";

type ChatRequestBody = {
  characterId?: string;
  content?: string;
  imageUrl?: string | null;
  imageDescription?: string | null;
  timeZone?: string;
  debug?: boolean;
};

type ReflectionResult = {
  mood?: string;
  affection_delta?: number;
  state_summary?: string | null;
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

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function formatTimeContext(timeZone: string, lastMessageAt?: string) {
  const now = new Date();
  const hourParts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    hour12: false
  }).formatToParts(now);
  const hour = Number(hourParts.find((part) => part.type === "hour")?.value ?? 0);
  const dayPeriod =
    hour >= 0 && hour < 5
      ? "late night"
      : hour >= 5 && hour < 9
        ? "morning"
        : hour >= 9 && hour < 12
          ? "forenoon"
          : hour >= 12 && hour < 18
            ? "afternoon"
            : "evening";

  const dateFormatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
  const weekdayFormatter = new Intl.DateTimeFormat("zh-CN", {
    timeZone,
    weekday: "long"
  });

  let sinceLastChat = "This is the first chat, or there are no previous messages.";

  if (lastMessageAt) {
    const diffMs = now.getTime() - new Date(lastMessageAt).getTime();
    const minutes = Math.max(0, Math.floor(diffMs / 60000));
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) {
      sinceLastChat = `About ${days} day(s) and ${hours % 24} hour(s) since the last chat.`;
    } else if (hours > 0) {
      sinceLastChat = `About ${hours} hour(s) and ${minutes % 60} minute(s) since the last chat.`;
    } else {
      sinceLastChat = `About ${minutes} minute(s) since the last chat.`;
    }
  }

  return [
    `Current local time: ${dateFormatter.format(now)}`,
    `Weekday: ${weekdayFormatter.format(now)}`,
    `User timezone: ${timeZone}`,
    `Day period: ${dayPeriod}`,
    `Is late night: ${dayPeriod === "late night" ? "yes" : "no"}`,
    `Is morning: ${dayPeriod === "morning" ? "yes" : "no"}`,
    sinceLastChat
  ].join("\n");
}

function extractStoragePath(publicUrl: string): string | null {
  try {
    const url = new URL(publicUrl);
    const match = url.pathname.match(/\/storage\/v1\/object\/public\/character-assets\/(.+)/);
    return match ? decodeURIComponent(match[1]) : null;
  } catch {
    return null;
  }
}

async function fetchTextFile(
  url: string | null | undefined,
  supabase?: ReturnType<typeof createServerSupabaseClient>
): Promise<string | null> {
  if (!url) return null;

  const attemptPublicFetch = async () => {
    const response = await fetch(url, { cache: "no-store" });
    if (!response.ok) throw new Error(`Public URL fetch failed with status ${response.status}`);
    return (await response.text()).trim();
  };

  const attemptStorageDownload = async () => {
    if (!supabase) throw new Error("No Supabase client available for storage fallback");
    const path = extractStoragePath(url);
    if (!path) throw new Error(`Cannot extract storage path from URL: ${url}`);
    const { data, error } = await supabase.storage.from("character-assets").download(path);
    if (error || !data) throw new Error(`Storage download failed: ${error?.message || "no data"}`);
    return await data.text();
  };

  try {
    return await attemptPublicFetch();
  } catch (publicError) {
    console.warn("[fetchTextFile] Public URL fetch failed, trying storage download:", publicError);

    try {
      const text = await attemptStorageDownload();
      console.log("[fetchTextFile] Storage download succeeded as fallback");
      return text.trim();
    } catch (storageError) {
      console.error(
        `[fetchTextFile] Both fetch methods failed for URL: ${url}`,
        { publicError, storageError }
      );
      return null;
    }
  }
}

async function getOrCreateRelationshipState({
  supabase,
  userId,
  characterId,
  character
}: {
  supabase: ReturnType<typeof createServerSupabaseClient>;
  userId: string;
  characterId: string;
  character: DbCharacter;
}) {
  const { data } = await supabase
    .from("relationship_states")
    .select("*")
    .eq("character_id", characterId)
    .maybeSingle();

  if (data) return data as DbRelationshipState;

  const { data: created } = await supabase
    .from("relationship_states")
    .insert({
      user_id: userId,
      character_id: characterId,
      mood: character.mood || "neutral",
      affection: character.affection ?? 0,
      state_summary: null
    })
    .select("*")
    .single();

  return (created ?? null) as DbRelationshipState | null;
}

async function reflectAfterChat({
  supabase,
  userId,
  characterId,
  characterName,
  userContent,
  assistantContent,
  relationshipState
}: {
  supabase: ReturnType<typeof createServerSupabaseClient>;
  userId: string;
  characterId: string;
  characterName: string;
  userContent: string;
  assistantContent: string;
  relationshipState: DbRelationshipState | null;
}) {
  const reflection = await callJsonModel<ReflectionResult>(
    [
      {
        role: "system",
        content:
          "Analyze one chat turn for an anime character chat app. Return strict JSON only. Update persistent mood and affection lightly. Do not extract memories here."
      },
      {
        role: "user",
        content: JSON.stringify({
          character_name: characterName,
          current_state: relationshipState,
          user_message: userContent,
          assistant_message: assistantContent,
          schema: {
            mood: "neutral | happy | shy | concerned | playful | sad | annoyed | affectionate",
            affection_delta: "integer from -2 to 2",
            state_summary: "short persistent relationship summary"
          }
        })
      }
    ],
    {
      mood: relationshipState?.mood || "neutral",
      affection_delta: 0,
      state_summary: relationshipState?.state_summary || null
    }
  );

  const currentAffection = relationshipState?.affection ?? 0;
  const affection = clamp(currentAffection + Number(reflection.affection_delta ?? 0), 0, 100);
  const mood = reflection.mood || relationshipState?.mood || "neutral";

  await supabase.from("relationship_states").upsert(
    {
      user_id: userId,
      character_id: characterId,
      mood,
      affection,
      state_summary: reflection.state_summary || relationshipState?.state_summary || null,
      metadata: {
        last_reflection_at: new Date().toISOString()
      }
    },
    { onConflict: "user_id,character_id" }
  );

  await supabase.from("characters").update({ mood, affection }).eq("id", characterId);
}

export async function POST(request: NextRequest) {
  try {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const body = (await request.json()) as ChatRequestBody;
    const characterId = body.characterId?.trim();
    const content = body.content?.trim();
    const imageUrl = body.imageUrl?.trim() || null;
    const timeZone = body.timeZone || "Asia/Singapore";

    if (!characterId || (!content && !imageUrl)) {
      return NextResponse.json(
        { error: "characterId and content or imageUrl are required" },
        { status: 400 }
      );
    }

    const supabase = createServerSupabaseClient(accessToken);
    const { data: authData, error: authError } = await supabase.auth.getUser(accessToken);

    if (authError || !authData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const userId = authData.user.id;
    const { data: character, error: characterError } = await supabase
      .from("characters")
      .select("*")
      .eq("id", characterId)
      .single();

    if (characterError || !character) {
      return NextResponse.json(
        { error: characterError?.message || "Character not found" },
        { status: 404 }
      );
    }

    const { data: recentMessages, error: recentMessagesError } = await supabase
      .from("messages")
      .select("*")
      .eq("character_id", characterId)
      .order("created_at", { ascending: false })
      .limit(20);

    if (recentMessagesError) {
      return NextResponse.json({ error: recentMessagesError.message }, { status: 500 });
    }

    const dbCharacter = character as DbCharacter;
    const chronologicalMessages = [...((recentMessages ?? []) as DbMessage[])].reverse();
    const lastMessageAt = chronologicalMessages.at(-1)?.created_at;
    const imageDescription =
      body.imageDescription?.trim() || (imageUrl ? await describeImage(imageUrl) : null);
    const userContent = [content || "", imageDescription ? `[Image description]\n${imageDescription}` : ""]
      .filter(Boolean)
      .join("\n\n");

    const relationshipState = await getOrCreateRelationshipState({
      supabase,
      userId,
      characterId,
      character: dbCharacter
    });
    const relevantMemories = await retrieveRelevantMemories({
      supabase,
      userId,
      characterId,
      query: userContent || content || "",
      limit: 3
    });
    const [cspSkillText, manifestText] = await Promise.all([
      fetchTextFile(dbCharacter.csp_skill_file_url, supabase),
      fetchTextFile(dbCharacter.manifest_file_url, supabase)
    ]);
    const timeContext = formatTimeContext(timeZone, lastMessageAt);

    // CSP is mandatory — if a SKILL.md URL exists but fetch failed, log and use system_prompt as emergency fallback
    const skillMarkdown = (() => {
      if (cspSkillText) return cspSkillText;
      if (dbCharacter.csp_skill_file_url) {
        console.error(
          `[CSP] SKILL.md fetch failed for character ${dbCharacter.id}, URL: ${dbCharacter.csp_skill_file_url}. Falling back to system_prompt.`
        );
      }
      return dbCharacter.system_prompt || "你正在扮演一个原创动漫角色。";
    })();

    const finalPrompt = buildCharacterPrompt({
      character: dbCharacter,
      skillMarkdown,
      manifestJson: manifestText,
      timeInfo: timeContext,
      emotionState: relationshipState?.mood || dbCharacter.mood || "neutral",
      relationshipState,
      longTermMemories: relevantMemories,
      recentMessages: chronologicalMessages.slice(-10),
      userInput: userContent,
      imageDescription
    });

    const { data: userMessage, error: userMessageError } = await supabase
      .from("messages")
      .insert({
        user_id: userId,
        character_id: characterId,
        role: "user",
        content: content || "[Image]",
        image_url: imageUrl,
        metadata: {
          source: "web",
          time_zone: timeZone,
          image_description: imageDescription
        }
      })
      .select("*")
      .single();

    if (userMessageError) {
      return NextResponse.json({ error: userMessageError.message }, { status: 500 });
    }

    const createdMemory = await maybeExtractAndStoreMemory({
      supabase,
      userId,
      characterId,
      userMessage: userMessage as DbMessage
    }).catch(() => null);
    const assistantContent = await callChatModel([{ role: "system", content: finalPrompt }]);

    const { data: assistantMessage, error: assistantMessageError } = await supabase
      .from("messages")
      .insert({
        user_id: userId,
        character_id: characterId,
        role: "assistant",
        content: assistantContent,
        image_url: null,
        metadata: {
          source: "ai",
          model: process.env.AI_MODEL,
          prompt_debug_enabled: Boolean(body.debug || process.env.PROMPT_DEBUG === "true"),
          time_context: timeContext,
          memories_used: relevantMemories,
          memory_created: createdMemory,
          relationship_state: relationshipState,
          image_description: imageDescription
        }
      })
      .select("*")
      .single();

    if (assistantMessageError) {
      return NextResponse.json({ error: assistantMessageError.message }, { status: 500 });
    }

    await supabase
      .from("characters")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", characterId);

    await reflectAfterChat({
      supabase,
      userId,
      characterId,
      characterName: dbCharacter.name,
      userContent,
      assistantContent,
      relationshipState
    });

    return NextResponse.json({
      user_message: userMessage,
      assistant_message: assistantMessage,
      memory_created: createdMemory,
      memories_used: relevantMemories,
      debug_prompt: body.debug || process.env.PROMPT_DEBUG === "true" ? finalPrompt : undefined
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown server error";
    console.error("[API /chat] Error:", message, error instanceof Error ? error.stack : "");
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
