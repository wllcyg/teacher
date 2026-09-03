import axios from "axios";

const rawBaseURL = import.meta.env.VITE_API_BASE_URL || "/api";
// 统一去除末尾多余的斜杠，保证与 /tables 等路径拼接准确
const baseURL = rawBaseURL.endsWith("/") ? rawBaseURL.slice(0, -1) : rawBaseURL;

export const api = axios.create({
  baseURL,
  timeout: 15000,
});
