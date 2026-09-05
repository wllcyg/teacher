import { useState } from "react";
import { Button, Card, Input, message } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { login } from "../api";
import { useAuthStore } from "../store/auth";
import AppLogo from "../components/AppLogo";

export default function Login() {
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const setToken = useAuthStore((s) => s.setToken);

  const handleLogin = async () => {
    if (!password || loading) return;
    setLoading(true);
    try {
      const { access_token } = await login(password);
      setToken(access_token);
    } catch (e: any) {
      const status = e?.response?.status;
      if (status === 429) {
        message.error(e?.response?.data?.detail || "尝试次数过多，请 15 分钟后再试");
      } else {
        message.error(e?.response?.data?.detail || "密码错误");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
        background:
          "radial-gradient(at 0% 0%, rgba(99, 102, 241, 0.10) 0px, transparent 45%), radial-gradient(at 100% 100%, rgba(56, 189, 248, 0.10) 0px, transparent 45%), #f8fafc",
      }}
    >
      <Card
        bordered={false}
        style={{ width: 320, borderRadius: 16, boxShadow: "0 4px 24px rgba(15, 23, 42, 0.08)" }}
        styles={{ body: { padding: "36px 28px" } }}
      >
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
          <AppLogo />
        </div>
        <Input.Password
          size="large"
          placeholder="请输入密码"
          prefix={<LockOutlined style={{ color: "#94a3b8" }} />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onPressEnter={handleLogin}
          autoFocus
          style={{ marginBottom: 16 }}
        />
        <Button type="primary" size="large" block loading={loading} onClick={handleLogin}>
          登 录
        </Button>
      </Card>
    </div>
  );
}
