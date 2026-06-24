import { Character, ChatMessage, characters, initialMessages } from "@/lib/mock-data";
import { DbCharacter, DbMessage } from "@/lib/supabase/types";

export function mockCharacterToDb(character: Character): DbCharacter {
  return {
    id: character.id,
    user_id: "mock-user",
    name: character.name,
    subtitle: character.subtitle,
    description: character.description,
    avatar_url: character.avatarUrl,
    banner_url: character.bannerUrl,
    csp_skill_file_url: null,
    manifest_file_url: null,
    distillation_file_url: null,
    tags: character.tags,
    greeting_message: character.greeting,
    personality: character.personality,
    scenario: character.scenario,
    system_prompt: character.distilledProfile,
    distilled_profile: character.distilledProfile,
    affection: character.affection,
    mood: character.mood,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  };
}

export function getMockDbCharacters() {
  return characters.map(mockCharacterToDb);
}

export function getMockDbCharacter(id: string) {
  return mockCharacterToDb(characters.find((character) => character.id === id) ?? characters[0]);
}

export function mockMessageToDb(message: ChatMessage, characterId: string): DbMessage {
  return {
    id: message.id,
    user_id: "mock-user",
    character_id: characterId,
    role: message.role,
    content: message.content,
    image_url: null,
    metadata: {},
    created_at: new Date().toISOString()
  };
}

export function getMockDbMessages(characterId: string) {
  return (initialMessages[characterId] ?? []).map((message) =>
    mockMessageToDb(message, characterId)
  );
}
