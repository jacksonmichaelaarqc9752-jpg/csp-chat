export type UserProfile = {
  id: string;
  email: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
};

export type DbCharacter = {
  id: string;
  user_id: string;
  name: string;
  subtitle: string | null;
  description: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  csp_skill_file_url: string | null;
  manifest_file_url: string | null;
  distillation_file_url: string | null;
  tags: string[];
  greeting_message: string | null;
  personality: string | null;
  scenario: string | null;
  system_prompt: string;
  distilled_profile: string | null;
  affection: number;
  mood: string;
  created_at: string;
  updated_at: string;
};

export type DbMessage = {
  id: string;
  user_id: string;
  character_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  image_url: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type DbCharacterMemory = {
  id: string;
  user_id: string;
  character_id: string;
  content: string;
  memory_type: string;
  importance: number;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type DbRelationshipState = {
  id: string;
  user_id: string;
  character_id: string;
  mood: string;
  affection: number;
  state_summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};
