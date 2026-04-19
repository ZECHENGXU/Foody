import { FormEvent, useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";

import { profileApi, storeApi } from "../services/api";
import { useAuthStore } from "../store/authStore";

const questions = [
  ["restaurant_style", "餐厅更接近什么风格？"],
  ["signature_focus", "主要想突出什么菜品或卖点？"],
  ["target_customers", "主要顾客是谁？"],
  ["desired_feeling", "希望顾客感受到什么？"],
  ["tone_preference", "文案和服务表达更偏什么感觉？"]
] as const;

export function ProfilePage() {
  const navigate = useNavigate();
  const { storeId = "" } = useParams();
  const setCurrentStore = useAuthStore((state) => state.setCurrentStore);
  const numericStoreId = Number(storeId);
  const { data: store } = useQuery({
    queryKey: ["store", numericStoreId],
    queryFn: () => storeApi.get(numericStoreId)
  });
  const { data: profile } = useQuery({
    queryKey: ["profile", numericStoreId],
    queryFn: () => profileApi.get(numericStoreId),
    retry: false
  });
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const saveMutation = useMutation({
    mutationFn: () => profileApi.upsert(numericStoreId, answers),
    onSuccess: () => navigate(`/stores/${numericStoreId}`)
  });
  const skipMutation = useMutation({
    mutationFn: () => profileApi.skip(numericStoreId),
    onSuccess: () => navigate(`/stores/${numericStoreId}`)
  });

  useEffect(() => {
    if (store) {
      setCurrentStore(store);
    }
  }, [setCurrentStore, store]);

  useEffect(() => {
    if (profile?.answers_json) {
      setAnswers(profile.answers_json);
    }
  }, [profile]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    saveMutation.mutate();
  };

  return (
    <div className="grid two">
      <form className="card stack" onSubmit={submit}>
        <h2>店铺风格档案</h2>
        <p className="muted">这一步可以跳过，但填写后，菜品建议会更贴近你的店铺表达方式。</p>
        {questions.map(([key, label]) => (
          <div className="field" key={key}>
            <label>{label}</label>
            <textarea value={answers[key] || ""} onChange={(e) => setAnswers({ ...answers, [key]: e.target.value })} />
          </div>
        ))}
        <div className="button-row">
          <button className="button" type="submit" disabled={saveMutation.isPending}>
            保存档案
          </button>
          <button className="button secondary" type="button" onClick={() => skipMutation.mutate()} disabled={skipMutation.isPending}>
            跳过
          </button>
        </div>
      </form>

      <section className="card stack">
        <h2>当前摘要</h2>
        {profile ? (
          <>
            <div className="button-row">
              {profile.style_keywords.map((item) => (
                <span key={item} className="pill">
                  {item}
                </span>
              ))}
            </div>
            <div><strong>摆盘方向：</strong>{profile.plating_direction || "暂无"}</div>
            <div><strong>文案语气：</strong>{profile.tone_of_voice || "暂无"}</div>
            <div><strong>整体总结：</strong>{profile.overall_style_summary || "暂无"}</div>
          </>
        ) : (
          <div className="muted">还没有档案摘要，保存后会自动生成。</div>
        )}
      </section>
    </div>
  );
}
