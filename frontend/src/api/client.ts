import axios from "axios";
import { useAuthStore } from "../store/auth";

const rawBaseURL = import.meta.env.VITE_API_BASE_URL || "/api";
// 统一去除末尾多余的斜杠，保证与 /tables 等路径拼接准确
const baseURL = rawBaseURL.endsWith("/") ? rawBaseURL.slice(0, -1) : rawBaseURL;

export const api = axios.create({
  baseURL,
  timeout: 15000,
});

// 请求拦截器：自动带上登录后的 Bearer Token
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 响应拦截器：
// 1. 后端在 token 即将过期时会通过 X-New-Token 响应头下发新 token，静默替换本地存储，实现自动顺延、正常使用不掉线。
// 2. 收到 401 说明 token 无效/过期，清空本地 token 跟回登录页。
api.interceptors.response.use(
  (response) => {
    const newToken = response.headers?.["x-new-token"];
    if (newToken) useAuthStore.getState().setToken(newToken);
    return response;
  },
  (error) => {
    if (error?.response?.status === 401) {
      useAuthStore.getState().clearToken();
    }
    return Promise.reject(error);
  }
);
