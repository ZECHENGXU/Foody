export type User = {
  id: number;
  name: string | null;
  email: string;
};

export type LoginResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type Store = {
  id: number;
  name: string;
  restaurant_type: string;
  cuisine_type: string | null;
  average_price: number | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type StoreProfile = {
  id: number;
  store_id: number;
  onboarding_status: string;
  answers_json: Record<string, string>;
  style_keywords: string[];
  plating_direction: string | null;
  tone_of_voice: string | null;
  overall_style_summary: string | null;
  created_at: string;
  updated_at: string;
};

export type Dish = {
  id: number;
  store_id: number;
  name: string;
  description: string | null;
  ingredients_method: string | null;
  price: number | null;
  has_image: boolean;
  image_url: string | null;
  created_at: string;
  updated_at: string;
};

export type CopywritingBlock = {
  story: string;
  menu_description: string;
  marketing_line: string;
};

export type SuggestionRecord = {
  id: number;
  based_on_store_profile: boolean;
  input_snapshot_json: Record<string, unknown>;
  plating_suggestions: Record<string, string>;
  visual_suggestions: Record<string, string>;
  copywriting: CopywritingBlock;
  service_lines: string[];
  model_info: Record<string, unknown> | null;
  created_at: string;
};

export type GenerateSuggestionResponse = {
  dish: Dish;
  suggestion_record: SuggestionRecord;
};

export type SuggestionListResponse = {
  items: SuggestionRecord[];
};

export type UploadResponse = {
  url: string;
  filename: string;
};

export type AIStatus = {
  configured_provider: string;
  resolved_provider: string;
  provider_label: string;
  model: string | null;
  configured: boolean;
  supports_image_input: boolean;
  fallback_to_mock: boolean;
  using_mock: boolean;
  message: string;
};

export type AIConnectionTest = {
  success: boolean;
  configured_provider: string;
  resolved_provider: string;
  provider_label: string;
  model: string | null;
  fallback_used: boolean;
  latency_ms: number;
  message: string;
  details: Record<string, unknown> | null;
};
