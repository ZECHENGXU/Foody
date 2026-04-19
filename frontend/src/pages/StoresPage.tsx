import { FormEvent, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";

import { storeApi } from "../services/api";
import { useAuthStore } from "../store/authStore";

export function StoresPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const setCurrentStore = useAuthStore((state) => state.setCurrentStore);
  const { data: stores = [] } = useQuery({ queryKey: ["stores"], queryFn: storeApi.list });
  const [form, setForm] = useState({
    name: "",
    restaurant_type: "",
    cuisine_type: "",
    average_price: ""
  });

  const createMutation = useMutation({
    mutationFn: storeApi.create,
    onSuccess: async (store) => {
      await queryClient.invalidateQueries({ queryKey: ["stores"] });
      setCurrentStore(store);
      navigate(`/stores/${store.id}/profile`);
    }
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    createMutation.mutate({
      name: form.name,
      restaurant_type: form.restaurant_type,
      cuisine_type: form.cuisine_type || undefined,
      average_price: form.average_price ? Number(form.average_price) : null
    });
  };

  return (
    <div className="grid two">
      <section className="card stack">
        <h2>已有店铺</h2>
        <div className="list">
          {stores.map((store) => (
            <div key={store.id} className="card">
              <div className="stack">
                <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                  <strong>{store.name}</strong>
                  <span className="pill">{store.restaurant_type}</span>
                </div>
                <div className="muted">
                  {store.cuisine_type || "未填写菜系"} · {store.average_price ? `人均 ${store.average_price}` : "未填人均"}
                </div>
                <div className="button-row">
                  <button
                    className="button"
                    onClick={() => {
                      setCurrentStore(store);
                      navigate(`/stores/${store.id}`);
                    }}
                  >
                    进入店铺
                  </button>
                  <Link className="button secondary" to={`/stores/${store.id}/profile`} onClick={() => setCurrentStore(store)}>
                    档案
                  </Link>
                </div>
              </div>
            </div>
          ))}
          {stores.length === 0 && <div className="muted">还没有店铺，先创建一个就能开始体验完整流程。</div>}
        </div>
      </section>

      <form className="card stack" onSubmit={submit}>
        <h2>创建店铺</h2>
        <div className="field">
          <label>店铺名称</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="field">
          <label>餐厅类型</label>
          <input value={form.restaurant_type} onChange={(e) => setForm({ ...form, restaurant_type: e.target.value })} required />
        </div>
        <div className="field">
          <label>主营菜系</label>
          <input value={form.cuisine_type} onChange={(e) => setForm({ ...form, cuisine_type: e.target.value })} />
        </div>
        <div className="field">
          <label>人均价位</label>
          <input value={form.average_price} onChange={(e) => setForm({ ...form, average_price: e.target.value })} />
        </div>
        <button className="button" type="submit" disabled={createMutation.isPending}>
          {createMutation.isPending ? "创建中..." : "创建并进入"}
        </button>
      </form>
    </div>
  );
}
