import { Link, Outlet, useNavigate } from "react-router-dom";

import { useAuthStore } from "../../store/authStore";
import { AIStatusCard } from "../common/AIStatusCard";

export function AppLayout() {
  const navigate = useNavigate();
  const { user, currentStore, logout } = useAuthStore();

  return (
    <div className="app-shell">
      <div className="nav">
        <div className="stack" style={{ gap: 4 }}>
          <Link to="/" className="title" style={{ fontSize: 24 }}>
            Foody MVP
          </Link>
          <div className="muted">
            {user?.email ?? "Guest"}
            {currentStore ? ` · 当前店铺：${currentStore.name}` : ""}
          </div>
        </div>
        <div className="button-row">
          {user && (
            <>
              <Link className="button secondary" to="/stores">
                店铺列表
              </Link>
              <button
                className="button secondary"
                onClick={() => {
                  logout();
                  navigate("/login");
                }}
              >
                退出
              </button>
            </>
          )}
        </div>
      </div>
      {user && <AIStatusCard />}
      <Outlet />
    </div>
  );
}
