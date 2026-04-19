import type { ReactElement } from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";

import { AppLayout } from "../../components/layout/AppLayout";
import { DashboardPage } from "../../pages/DashboardPage";
import { DishDetailPage } from "../../pages/DishDetailPage";
import { GeneratePage } from "../../pages/GeneratePage";
import { HistoryPage } from "../../pages/HistoryPage";
import { LoginPage } from "../../pages/LoginPage";
import { ProfilePage } from "../../pages/ProfilePage";
import { ResultPage } from "../../pages/ResultPage";
import { StoresPage } from "../../pages/StoresPage";
import { useAuthStore } from "../../store/authStore";

function RequireAuth({ children }: { children: ReactElement }) {
  const token = useAuthStore((state) => state.token);
  return token ? children : <Navigate to="/login" replace />;
}

export const router = createBrowserRouter([
  {
    path: "/login",
    element: <LoginPage />
  },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppLayout />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/stores" replace /> },
      { path: "stores", element: <StoresPage /> },
      { path: "stores/:storeId", element: <DashboardPage /> },
      { path: "stores/:storeId/profile", element: <ProfilePage /> },
      { path: "stores/:storeId/generate", element: <GeneratePage /> },
      { path: "stores/:storeId/results/:suggestionId", element: <ResultPage /> },
      { path: "stores/:storeId/history", element: <HistoryPage /> },
      { path: "stores/:storeId/dishes/:dishId", element: <DishDetailPage /> }
    ]
  }
]);
