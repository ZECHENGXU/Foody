import { FormEvent, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { suggestionApi, uploadApi } from "../services/api";

export function GeneratePage() {
  const { storeId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const editingDishId = searchParams.get("dishId");
  const [form, setForm] = useState({
    name: "",
    description: "",
    ingredients_method: "",
    price: "",
    extra_goal: "",
    use_store_profile: true
  });
  const [imageFile, setImageFile] = useState<File | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      let image_url: string | null = null;
      if (imageFile) {
        const upload = await uploadApi.upload(imageFile);
        image_url = `http://localhost:8000${upload.url}`;
      }
      return suggestionApi.generate({
        store_id: Number(storeId),
        dish_id: editingDishId ? Number(editingDishId) : null,
        dish: {
          name: form.name,
          description: form.description || null,
          ingredients_method: form.ingredients_method || null,
          price: form.price ? Number(form.price) : null,
          image_url
        },
        use_store_profile: form.use_store_profile,
        extra_goal: form.extra_goal || null
      });
    },
    onSuccess: (data) => {
      navigate(`/stores/${storeId}/results/${data.suggestion_record.id}`);
    }
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    mutation.mutate();
  };

  return (
    <form className="card stack" onSubmit={submit}>
      <h2>{editingDishId ? "更新菜品并再次生成" : "新增菜品并生成建议"}</h2>
      <div className="grid two">
        <div className="field">
          <label>菜品名称</label>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </div>
        <div className="field">
          <label>价格</label>
          <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
        </div>
      </div>
      <div className="field">
        <label>菜品描述</label>
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      </div>
      <div className="field">
        <label>食材 / 做法 / 亮点</label>
        <textarea value={form.ingredients_method} onChange={(e) => setForm({ ...form, ingredients_method: e.target.value })} />
      </div>
      <div className="field">
        <label>补充目标</label>
        <textarea value={form.extra_goal} onChange={(e) => setForm({ ...form, extra_goal: e.target.value })} />
      </div>
      <div className="field">
        <label>图片上传（可选）</label>
        <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setImageFile(e.target.files?.[0] || null)} />
      </div>
      <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <input
          type="checkbox"
          checked={form.use_store_profile}
          onChange={(e) => setForm({ ...form, use_store_profile: e.target.checked })}
        />
        使用店铺档案辅助生成
      </label>
      <button className="button" type="submit" disabled={mutation.isPending}>
        {mutation.isPending ? "生成中..." : "生成建议"}
      </button>
    </form>
  );
}
