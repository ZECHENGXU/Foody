import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router-dom";

import { suggestionApi } from "../services/api";

export function ResultPage() {
  const navigate = useNavigate();
  const { storeId = "", suggestionId = "" } = useParams();
  const { data } = useQuery({
    queryKey: ["suggestion", suggestionId],
    queryFn: () => suggestionApi.get(Number(suggestionId))
  });

  if (!data) {
    return <div className="card">加载结果中...</div>;
  }

  const copyText = () => {
    const text = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="stack">
      <section className="card stack">
        <h2>建议结果</h2>
        <div className="button-row">
          <button className="button" onClick={copyText}>
            复制结果
          </button>
          <button className="button secondary" onClick={() => navigate(-1)}>
            返回修改
          </button>
          <Link className="button secondary" to={`/stores/${storeId}/history`}>
            查看历史
          </Link>
        </div>
      </section>

      <div className="grid two">
        <section className="card result-block">
          <h3>摆盘建议</h3>
          {Object.entries(data.plating_suggestions).map(([key, value]) => (
            <div key={key}><strong>{key}：</strong>{value}</div>
          ))}
        </section>
        <section className="card result-block">
          <h3>视觉与拍照建议</h3>
          {Object.entries(data.visual_suggestions).map(([key, value]) => (
            <div key={key}><strong>{key}：</strong>{value}</div>
          ))}
        </section>
      </div>

      <div className="grid two">
        <section className="card result-block">
          <h3>文案建议</h3>
          <div><strong>故事：</strong>{data.copywriting.story}</div>
          <div><strong>菜单描述：</strong>{data.copywriting.menu_description}</div>
          <div><strong>营销短句：</strong>{data.copywriting.marketing_line}</div>
        </section>
        <section className="card result-block">
          <h3>服务员话术</h3>
          <div className="stack">
            {data.service_lines.map((line) => (
              <div key={line} className="card">{line}</div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
