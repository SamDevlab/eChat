import { useEffect, useState } from "react";
import { api } from "./api";

type Status = "READY" | "ATTENTION" | "BLOCKED" | "PASS";
type PilotDiagnostics = {
  generatedAt: string;
  readiness: { status: "READY" | "ATTENTION" | "BLOCKED"; checks: Array<{ key: string; label: string; status: Exclude<Status, "READY">; detail: string }> };
  databaseEnvironment: string;
  outboundMode: "disabled" | "pilot" | "enabled";
  publicUrl: { configured: boolean; https: boolean; reachable: boolean; persistentDeclared: boolean; origin: string | null; expectedWebhookUrl: string | null };
  integration: { status: string; channelType: string | null; accountAccessible: boolean; inboxAccessible: boolean; webhookStatus: string; lastConnectionCheckAt: string | null; lastErrorAt: string | null; lastErrorCode: string | null; lastSyncStatus: string | null; lastSyncAt: string | null; lastWebhookReceivedAt: string | null; lastWebhookProcessedAt: string | null };
};

const statusLabel = (status: string) => ({ READY: "Pronto", PASS: "OK", ATTENTION: "Atenção", BLOCKED: "Bloqueado", NOT_CONFIGURED: "Não configurado", CONNECTED: "Conectado", WEBHOOK_PENDING: "Webhook pendente", ERROR: "Erro" }[status] ?? status);
const toneFor = (status: string) => status === "READY" || status === "PASS" || status === "CONNECTED" ? "green" : status === "ATTENTION" || status === "WEBHOOK_PENDING" ? "amber" : "red";
const dateLabel = (value: string | null) => value ? new Date(value).toLocaleString("pt-BR") : "Ainda não recebido";

export function PilotReadinessCard() {
  const [report, setReport] = useState<PilotDiagnostics | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    setLoading(true); setError("");
    try { setReport(await api<PilotDiagnostics>("/v1/diagnostics")); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível consultar o diagnóstico."); }
    finally { setLoading(false); }
  };
  useEffect(() => { void load(); }, []);
  const download = async () => {
    setDownloading(true); setError("");
    try {
      const bundle = await api<PilotDiagnostics & { supportBundle: boolean }>("/v1/support-bundle");
      const url = URL.createObjectURL(new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" }));
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `echat-support-${new Date().toISOString().slice(0, 10)}.json`; anchor.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível gerar o pacote de suporte."); }
    finally { setDownloading(false); }
  };
  return <section className="panel readiness-card" aria-labelledby="pilot-readiness-title">
    <div className="panel-heading"><div><h2 id="pilot-readiness-title">Status do piloto</h2><p>Leitura do banco, Chatwoot, webhook e política de envio. Este diagnóstico não altera serviços.</p></div><div className="readiness-actions">{report && <span className={`badge ${toneFor(report.readiness.status)}`}>{statusLabel(report.readiness.status)}</span>}<button className="button outline" disabled={loading} onClick={() => void load()}>{loading ? "Consultando…" : "Atualizar status"}</button></div></div>
    {error && <div className="form-error" role="alert">{error}</div>}
    {report && <>
      <div className="readiness-grid">{report.readiness.checks.map((check) => <div className="readiness-check" key={check.key}><span className={`badge ${toneFor(check.status)}`}>{statusLabel(check.status)}</span><strong>{check.label}</strong><small>{check.detail}</small></div>)}</div>
      <dl className="readiness-meta"><div><dt>Ambiente do banco</dt><dd>{report.databaseEnvironment}</dd></div><div><dt>Integração</dt><dd>{statusLabel(report.integration.status)} · {report.integration.channelType ?? "Canal não configurado"}</dd></div><div><dt>URL pública</dt><dd>{report.publicUrl.origin ?? "Não configurada"}<small>{report.publicUrl.persistentDeclared ? "Persistência declarada" : "Persistência não confirmada"}</small></dd></div><div><dt>Webhook esperado</dt><dd>{report.publicUrl.expectedWebhookUrl ?? "Indisponível sem URL pública"}</dd></div><div><dt>Webhook encontrado</dt><dd>{report.integration.webhookStatus === "MATCH" ? "Sim" : "Não"}</dd></div><div><dt>Último webhook recebido</dt><dd>{dateLabel(report.integration.lastWebhookReceivedAt)}</dd></div><div><dt>Último webhook processado</dt><dd>{dateLabel(report.integration.lastWebhookProcessedAt)}</dd></div><div><dt>Último erro</dt><dd>{report.integration.lastErrorCode ?? "Nenhum erro registrado"}</dd></div><div><dt>Política de envio</dt><dd>{report.outboundMode.toUpperCase()}</dd></div></dl>
      <div className="readiness-actions"><button className="button soft" disabled={downloading} onClick={() => void download()}>{downloading ? "Preparando…" : "Baixar pacote de suporte"}</button><small>Inclui somente diagnósticos sem credenciais ou conteúdo de conversas.</small></div>
    </>}
  </section>;
}
