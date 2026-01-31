import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  sessionId: string | null;
  isAuthenticated: boolean;

  login: (data: {
    user: User;
    accessToken: string;
    refreshToken: string;
    sessionId: string;
  }) => void;
  logout: () => void;
  updateUser: (user: User) => void;
  updateAccessToken: (accessToken: string) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      sessionId: null,
      isAuthenticated: false,

      login: ({ user, accessToken, refreshToken, sessionId }) =>
        set({
          user,
          accessToken,
          refreshToken,
          sessionId,
          isAuthenticated: true,
        }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          sessionId: null,
          isAuthenticated: false,
        }),

      updateUser: (user) => set({ user }),

      updateAccessToken: (accessToken) => set({ accessToken }),
    }),
    {
      name: 'factrail-auth',
    },
  ),
);
