import { useMutation, useQuery } from "@tanstack/react-query";

import { aiApi } from "../../services/api";

export function AIStatusCard() {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["ai-status"],
    queryFn: aiApi.status
  });

  const testMutation = useMutation({
    mutationFn: aiApi.test,
    onSuccess: () => {
      refetch();
    }
  });

  return (
    <section className="card ai-status-card">
      <div className="ai-status-header">
        <div className="stack" style={{ gap: 4 }}>
          <strong>AI 状态</strong>
          <div className="muted">{isLoading ? "读取中..." : data?.message || "未读取到状态"}</div>
        </div>
        <div className="button-row">
          <button className="button secondary" onClick={() => refetch()}>
            刷新状态
          </button>
          <button className="button" onClick={() => testMutation.mutate()} disabled={testMutation.isPending}>
            {testMutation.isPending ? "测试中..." : "测试连通性"}
          </button>
        </div>
      </div>

      {data && (
        <div className="grid two" style={{ marginTop: 12 }}>
          <div className="stack" style={{ gap: 6 }}>
            <div><strong>当前 Provider：</strong>{data.provider_label}</div>
            <div><strong>Resolved：</strong>{data.resolved_provider}</div>
            <div><strong>Configured：</strong>{data.configured_provider}</div>
            <div><strong>Model：</strong>{data.model || "未设置"}</div>
          </div>
          <div className="stack" style={{ gap: 6 }}>
            <div><strong>已配置真实模型：</strong>{data.configured ? "是" : "否"}</div>
            <div><strong>支持图片输入：</strong>{data.supports_image_input ? "是" : "否"}</div>
            <div><strong>允许回退 mock：</strong>{data.fallback_to_mock ? "是" : "否"}</div>
            <div><strong>当前是否 mock：</strong>{data.using_mock ? "是" : "否"}</div>
          </div>
        </div>
      )}

      {testMutation.data && (
        <div className={`ai-test-result ${testMutation.data.success ? "success" : "error"}`}>
          <div><strong>测试结果：</strong>{testMutation.data.message}</div>
          <div className="muted">
            Provider: {testMutation.data.provider_label}
            {" · "}
            Model: {testMutation.data.model || "未设置"}
            {" · "}
            延迟: {testMutation.data.latency_ms} ms
          </div>
        </div>
      )}
    </section>
  );
}
