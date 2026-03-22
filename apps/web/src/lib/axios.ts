import axios from 'axios';
import { useAuthStore } from '@/stores/authStore';

const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  withCredentials: true,
});

// リクエストインターセプター: アクセストークンを自動付与
apiClient.interceptors.request.use(
  (config) => {
    const { accessToken } = useAuthStore.getState();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// レスポンスインターセプター: 401エラー時にトークンリフレッシュ
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // 認証フロー中のエンドポイントはリフレッシュ対象外
    const isAuthFlowRequest = originalRequest.url?.includes('/auth/exchange');

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthFlowRequest) {
      originalRequest._retry = true;

      const { refreshToken, updateAccessToken, logout } = useAuthStore.getState();

      if (refreshToken) {
        try {
          const response = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL}/auth/refresh`,
            { refreshToken },
          );

          const { accessToken: newAccessToken } = response.data;
          updateAccessToken(newAccessToken);

          // リトライ
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return apiClient(originalRequest);
        } catch (refreshError) {
          // リフレッシュ失敗時はログアウト
          logout();
          if (typeof window !== 'undefined') {
            window.location.href = '/login';
          }
          return Promise.reject(refreshError);
        }
      } else {
        logout();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
      }
    }

    return Promise.reject(error);
  },
);

// F2A API クライアント（SSO Cookie 認証）
export const f2aClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_F2A_API_URL || 'http://localhost:8001',
  withCredentials: true,
});

export default apiClient;
