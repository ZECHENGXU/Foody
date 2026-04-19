import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";

import { dishApi } from "../services/api";

export function HistoryPage() {
  const { storeId = "" } = useParams();
  const numericStoreId = Number(storeId);
  const { data: dishes = [] } = useQuery({
    queryKey: ["dishes", numericStoreId],
    queryFn: () => dishApi.list(numericStoreId)
  });

  return (
    <section className="card stack">
      <h2>菜品历史</h2>
      <div className="list">
        {dishes.map((dish) => (
          <Link key={dish.id} className="card" to={`/stores/${numericStoreId}/dishes/${dish.id}`}>
            <strong>{dish.name}</strong>
            <div className="muted">{dish.description || "暂无描述"}</div>
            <div className="muted">{dish.updated_at}</div>
          </Link>
        ))}
        {dishes.length === 0 && <div className="muted">暂无历史记录。</div>}
      </div>
    </section>
  );
}
