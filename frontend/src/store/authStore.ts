import { create } from "zustand";

import type { Store, User } from "../types/api";

type AuthState = {
  token: string | null;
  user: User | null;
  currentStore: Store | null;
  setSession: (token: string, user: User) => void;
  setCurrentStore: (store: Store | null) => void;
  logout: () => void;
};

const savedToken = localStorage.getItem("foody_token");
const savedUser = localStorage.getItem("foody_user");
const savedStore = localStorage.getItem("foody_current_store");

export const useAuthStore = create<AuthState>((set) => ({
  token: savedToken,
  user: savedUser ? JSON.parse(savedUser) : null,
  currentStore: savedStore ? JSON.parse(savedStore) : null,
  setSession: (token, user) => {
    localStorage.setItem("foody_token", token);
    localStorage.setItem("foody_user", JSON.stringify(user));
    set({ token, user });
  },
  setCurrentStore: (store) => {
    if (store) {
      localStorage.setItem("foody_current_store", JSON.stringify(store));
    } else {
      localStorage.removeItem("foody_current_store");
    }
    set({ currentStore: store });
  },
  logout: () => {
    localStorage.removeItem("foody_token");
    localStorage.removeItem("foody_user");
    localStorage.removeItem("foody_current_store");
    set({ token: null, user: null, currentStore: null });
  }
}));
