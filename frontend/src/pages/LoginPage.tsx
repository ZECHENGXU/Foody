import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

import { authApi } from "../services/api";
import { useAuthStore } from "../store/authStore";

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((state) => state.setSession);
  const [email, setEmail] = useState("demo@example.com");
  const [password, setPassword] = useState("demo123456");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const data = await authApi.login(email, password);
      setSession(data.access_token, data.user);
      navigate("/stores");
    } catch {
      setError("登录失败，请检查演示账号或后端是否已启动。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-shell">
      <section className="hero">
        <h1 className="title">餐厅菜品包装助手</h1>
        <p className="subtitle">先用演示账号登录，然后创建店铺、补档案、生成菜品建议。</p>
      </section>
      <form className="card stack" onSubmit={handleSubmit} style={{ maxWidth: 480 }}>
        <div className="field">
          <label>邮箱</label>
          <input value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="field">
          <label>密码</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        {error && <div className="muted">{error}</div>}
        <button className="button" disabled={loading} type="submit">
          {loading ? "登录中..." : "登录"}
        </button>
        <div className="muted">默认演示账号：demo@example.com / demo123456</div>
      </form>
    </div>
  );
}
