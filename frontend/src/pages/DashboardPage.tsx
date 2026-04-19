import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { dishApi, profileApi, storeApi } from "../services/api";
import { useAuthStore } from "../store/authStore";

export function DashboardPage() {
  const { storeId = "" } = useParams();
  const numericStoreId = Number(storeId);
  const setCurrentStore = useAuthStore((state) => state.setCurrentStore);
  const { data: store } = useQuery({
    queryKey: ["store", numericStoreId],
    queryFn: () => storeApi.get(numericStoreId)
  });
  const { data: dishes = [] } = useQuery({
    queryKey: ["dishes", numericStoreId],
    queryFn: () => dishApi.list(numericStoreId)
  });
  const { data: profile } = useQuery({
    queryKey: ["profile", numericStoreId],
    queryFn: () => profileApi.get(numericStoreId),
    retry: false
  });

  useEffect(() => {
    if (store) {
      setCurrentStore(store);
    }
  }, [setCurrentStore, store]);

  return (
    <div className="stack">
      <section className="card stack">
        <h2>{store?.name || "店铺主页"}</h2>
        <div className="muted">
          {store?.restaurant_type || "未填餐厅类型"} · {store?.cuisine_type || "未填菜系"} ·{" "}
          {store?.average_price ? `人均 ${store.average_price}` : "未填人均"}
        </div>
        <div className="button-row">
          <Link className="button" to={`/stores/${numericStoreId}/generate`}>
            新增菜品并生成建议
          </Link>
          <Link className="button secondary" to={`/stores/${numericStoreId}/profile`}>
            编辑档案
          </Link>
        </div>
      </section>

      <div className="grid two">
        <section className="card stack">
          <h3>店铺风格档案</h3>
          {profile ? (
            <>
              <div className="button-row">
                {profile.style_keywords.map((keyword) => (
                  <span key={keyword} className="pill">
                    {keyword}
                  </span>
                ))}
              </div>
              <div>{profile.overall_style_summary}</div>
            </>
          ) : (
            <div className="muted">还没有风格档案，可以先跳过，也可以现在补充。</div>
          )}
        </section>

        <section className="card stack">
          <h3>菜品历史</h3>
          {dishes.slice(0, 5).map((dish) => (
            <Link key={dish.id} to={`/stores/${numericStoreId}/dishes/${dish.id}`} className="card">
              <strong>{dish.name}</strong>
              <div className="muted">{dish.description || "暂无描述"}</div>
            </Link>
          ))}
          {dishes.length === 0 && <div className="muted">还没有菜品建议，先生成第一条会最有感觉。</div>}
          {dishes.length > 0 && (
            <Link className="button secondary" to={`/stores/${numericStoreId}/history`}>
              查看全部菜品
            </Link>
          )}
        </section>
      </div>
    </div>
  );
}
