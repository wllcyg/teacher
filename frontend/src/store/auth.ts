import { create } from "zustand";
import { persist } from "zustand/middleware";

interface AuthState {
  token: string | null;
  setToken: (token: string | null) => void;
  clearToken: () => void;
}

// 单老师场景：只存一个共享 Token，配合后端 30 天有效期 + 自动顺延，
// 正常使用不掉线，长期不用才会真正过期需要重新登录。
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      setToken: (token) => set({ token }),
      clearToken: () => set({ token: null }),
    }),
    { name: "tw-auth-store" }
  )
);
