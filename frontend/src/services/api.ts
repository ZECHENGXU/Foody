import axios from "axios";

import { useAuthStore } from "../store/authStore";
import type {
  AIConnectionTest,
  AIStatus,
  Dish,
  GenerateSuggestionResponse,
  LoginResponse,
  Store,
  StoreProfile,
  SuggestionListResponse,
  SuggestionRecord,
  UploadResponse,
  User
} from "../types/api";

const api = axios.create({
  baseURL: "http://localhost:8000/api/v1"
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const authApi = {
  async login(email: string, password: string) {
    const { data } = await api.post<LoginResponse>("/auth/login", { email, password });
    return data;
  },
  async me() {
    const { data } = await api.get<User>("/auth/me");
    return data;
  }
};

export const storeApi = {
  async list() {
    const { data } = await api.get<Store[]>("/stores");
    return data;
  },
  async create(payload: {
    name: string;
    restaurant_type: string;
    cuisine_type?: string;
    average_price?: number | null;
  }) {
    const { data } = await api.post<Store>("/stores", payload);
    return data;
  },
  async get(id: number) {
    const { data } = await api.get<Store>(`/stores/${id}`);
    return data;
  }
};

export const profileApi = {
  async get(storeId: number) {
    const { data } = await api.get<StoreProfile>(`/stores/${storeId}/profile`);
    return data;
  },
  async upsert(storeId: number, answers: Record<string, string>) {
    const { data } = await api.post<StoreProfile>(`/stores/${storeId}/profile`, { answers });
    return data;
  },
  async skip(storeId: number) {
    const { data } = await api.post<StoreProfile>(`/stores/${storeId}/profile/skip`);
    return data;
  }
};

export const dishApi = {
  async list(storeId: number) {
    const { data } = await api.get<Dish[]>(`/stores/${storeId}/dishes`);
    return data;
  },
  async get(storeId: number, dishId: number) {
    const { data } = await api.get<Dish>(`/stores/${storeId}/dishes/${dishId}`);
    return data;
  },
  async update(storeId: number, dishId: number, payload: Partial<Dish>) {
    const { data } = await api.patch<Dish>(`/stores/${storeId}/dishes/${dishId}`, payload);
    return data;
  }
};

export const suggestionApi = {
  async generate(payload: {
    store_id: number;
    dish_id?: number | null;
    dish: {
      name: string;
      description?: string | null;
      ingredients_method?: string | null;
      price?: number | null;
      image_url?: string | null;
    };
    use_store_profile: boolean;
    extra_goal?: string | null;
  }) {
    const { data } = await api.post<GenerateSuggestionResponse>("/suggestions/generate", payload);
    return data;
  },
  async list(storeId: number, dishId: number) {
    const { data } = await api.get<SuggestionListResponse>(`/stores/${storeId}/dishes/${dishId}/suggestions`);
    return data.items;
  },
  async get(id: number) {
    const { data } = await api.get<SuggestionRecord>(`/suggestions/${id}`);
    return data;
  }
};

export const uploadApi = {
  async upload(file: File) {
    const formData = new FormData();
    formData.append("file", file);
    const { data } = await api.post<UploadResponse>("/uploads/image", formData, {
      headers: { "Content-Type": "multipart/form-data" }
    });
    return data;
  }
};

export const aiApi = {
  async status() {
    const { data } = await api.get<AIStatus>("/ai/status");
    return data;
  },
  async test() {
    const { data } = await api.post<AIConnectionTest>("/ai/test");
    return data;
  }
};

export default api;
