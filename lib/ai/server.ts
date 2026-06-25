import { assertVisibleAsciiHeaderValue, normalizeHeaderToken } from "@/lib/http/safeHeaders";

export type AiProviderConfig = {
  apiKey: string;
  baseURL: string;
  model: string;
};

export type ChatCompletionMessage = {
  role: "system" | "user" | "assistant";
  content:
    | string
    | Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      >;
};

export function normalizeAiProviderConfig(config: Partial<AiProviderConfig> | null | undefined): AiProviderConfig {
  const apiKey = normalizeHeaderToken(config?.apiKey);
  const baseURL = config?.baseURL?.trim().replace(/\/$/, "") || "";
  const model = config?.model?.trim() || "";

  if (!apiKey || !baseURL || !model) {
    throw new Error("请先在设置页填写 AI API Key、Base URL 和模型名称。");
  }

  assertVisibleAsciiHeaderValue("AI API Key", apiKey);

  return {
    apiKey,
    baseURL,
    model
  };
}

export async function callChatModel(messages: ChatCompletionMessage[], config: AiProviderConfig) {
  const { apiKey, baseURL, model } = normalizeAiProviderConfig(config);

  console.log(`[AI] Calling chat model: ${model} at ${baseURL}`);

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.85,
      max_tokens: 800
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    const errorMsg = `AI request failed: ${response.status} ${detail}`;
    console.error(`[AI] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    console.error("[AI] Response did not include message content:", JSON.stringify(data).substring(0, 500));
    throw new Error("AI response did not include message content");
  }

  console.log(`[AI] Response received: ${content.length} chars`);
  return content.trim();
}

export async function* streamChatModel(messages: ChatCompletionMessage[], config: AiProviderConfig) {
  const { apiKey, baseURL, model } = normalizeAiProviderConfig(config);

  console.log(`[AI] Streaming chat model: ${model} at ${baseURL}`);

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: 0.85,
      max_tokens: 800,
      stream: true
    })
  });

  if (!response.ok || !response.body) {
    const detail = await response.text();
    const errorMsg = `AI request failed: ${response.status} ${detail}`;
    console.error(`[AI] ${errorMsg}`);
    throw new Error(errorMsg);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() || "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.startsWith("data:")) continue;

      const payload = trimmed.slice(5).trim();
      if (payload === "[DONE]") return;

      try {
        const data = JSON.parse(payload);
        const content = data?.choices?.[0]?.delta?.content ?? data?.choices?.[0]?.message?.content;
        if (typeof content === "string" && content) {
          yield content;
        }
      } catch {
        // Ignore malformed provider keep-alive chunks.
      }
    }
  }
}

export async function callJsonModel<T>(
  messages: ChatCompletionMessage[],
  fallback: T,
  config?: AiProviderConfig | null
) {
  try {
    if (!config) return fallback;
    const { apiKey, baseURL, model } = normalizeAiProviderConfig(config);

    const response = await fetch(`${baseURL}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.2,
        max_tokens: 700,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) return fallback;

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content || typeof content !== "string") return fallback;

    return JSON.parse(content) as T;
  } catch {
    return fallback;
  }
}

export async function createEmbedding(input: string, config: AiProviderConfig) {
  const { apiKey, baseURL } = normalizeAiProviderConfig(config);
  const model = process.env.EMBEDDING_MODEL || "text-embedding-3-small";

  const response = await fetch(`${baseURL}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      input
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Embedding request failed: ${response.status} ${detail}`);
  }

  const data = await response.json();
  const embedding = data?.data?.[0]?.embedding;

  if (!Array.isArray(embedding)) {
    throw new Error("Embedding response did not include an embedding array");
  }

  return embedding as number[];
}

export async function describeImage(imageUrl: string, config: AiProviderConfig) {
  const { apiKey, baseURL, model } = normalizeAiProviderConfig(config);

  const response = await fetch(`${baseURL}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: "Describe this image for an anime roleplay chat. Mention visible people, objects, mood, setting, and any details the character may naturally react to. Keep it concise."
            },
            {
              type: "image_url",
              image_url: { url: imageUrl }
            }
          ]
        }
      ],
      temperature: 0.2,
      max_tokens: 350
    })
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`Vision request failed: ${response.status} ${detail}`);
  }

  const data = await response.json();
  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("Vision response did not include description content");
  }

  return content.trim();
}
