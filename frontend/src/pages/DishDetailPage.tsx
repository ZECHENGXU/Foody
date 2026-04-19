import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { dishApi, suggestionApi } from "../services/api";

export function DishDetailPage() {
  const { storeId = "", dishId = "" } = useParams();
  const numericStoreId = Number(storeId);
  const numericDishId = Number(dishId);
  const { data: dish } = useQuery({
    queryKey: ["dish", numericStoreId, numericDishId],
    queryFn: () => dishApi.get(numericStoreId, numericDishId)
  });
  const { data: suggestions = [] } = useQuery({
    queryKey: ["suggestions", numericStoreId, numericDishId],
    queryFn: () => suggestionApi.list(numericStoreId, numericDishId)
  });

  return (
    <div className="stack">
      <section className="card stack">
        <h2>{dish?.name || "菜品详情"}</h2>
        <div>{dish?.description || "暂无描述"}</div>
        <div className="muted">{dish?.ingredients_method || "暂无食材和做法"}</div>
        <div className="button-row">
          <Link className="button" to={`/stores/${numericStoreId}/generate?dishId=${numericDishId}`}>
            再次生成
          </Link>
          <Link className="button secondary" to={`/stores/${numericStoreId}/history`}>
            返回历史
          </Link>
        </div>
      </section>

      <section className="card stack">
        <h3>建议历史版本</h3>
        {suggestions.map((item) => (
          <Link key={item.id} className="card" to={`/stores/${numericStoreId}/results/${item.id}`}>
            <strong>版本 #{item.id}</strong>
            <div className="muted">{item.created_at}</div>
            <div>{item.copywriting.marketing_line}</div>
          </Link>
        ))}
      </section>
    </div>
  );
}
