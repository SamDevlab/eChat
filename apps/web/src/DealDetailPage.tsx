import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeft, CalendarDays, Check, ChevronDown, ClipboardCheck, FileText, Link2, Mail, MessageCircle, MoreHorizontal, Paperclip, Phone, Plus, Send, Settings2, Sparkles, UserRound, X } from "lucide-react";
import { api } from "./api";
import type { AppState, Contact, Opportunity, StageKey, User } from "./types";

type Toast = { tone: "success" | "error"; message: string };

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  bodyHtml: string;
};

type EmailRecord = {
  id: string;
  subject: string;
  to: string;
  status: "SENT" | "DRAFT";
  createdAt: string;
  templateName?: string;
};

type ChecklistItem = { id: string; label: string; status: "Pendente" | "Concluído" | "Ignorado" };

const stageLabels: Record<StageKey, string> = { NEW_LEAD: "Novo lead", CONTACTED: "Qualificação", PROPOSAL: "Proposta", NEGOTIATION: "Negociação", WON: "Fechamento", LOST: "Perdido" };
const tabs = [
  ["notes", "Anotações"],
  ["activity", "Atividade"],
  ["meetings", "Agendador de reuniões"],
  ["calls", "Chamada"],
  ["email", "E-mail"],
  ["files", "Arquivos"],
  ["documents", "Documentos"],
  ["invoice", "Fatura"],
] as const;

const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
const commercialSender = "comercial@wstecnologiaaplicada.com.br";
const initials = (name: string) => name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const escapeHtml = (value: string) => value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[character] ?? character);

const templates: EmailTemplate[] = [
  {
    id: "presentation",
    name: "Aivo — E-mail Apresentação Padrão",
    subject: "Seu cadastro no Aivo",
    bodyHtml: `<div style="font-family:Arial,sans-serif;color:#18352a;line-height:1.6"><div style="padding:24px 28px;background:#16552f;color:white;font-size:30px;font-weight:700;letter-spacing:-1px">aivo</div><div style="padding:28px 30px;background:#fff"><p>Olá, {{contact.name}}!</p><p>Meu nome é {{user.name}} e identifiquei seu cadastro em nossa plataforma. Resolvi entrar em contato para apresentar como podemos ajudar a {{contact.company}}.</p><p>O Aivo ajuda produtores rurais a gerenciar a operação, fazendo em um só lugar o controle comercial e financeiro.</p><p>Você teve alguma dúvida ou dificuldade para avançar? Posso te acompanhar por aqui.</p><div style="margin:24px 0;padding:16px;text-align:center;background:#edf8f0;border-radius:8px"><a href="{{links.descadastro}}" style="color:#16552f;font-weight:700;text-decoration:none">Quero conhecer melhor</a></div><p>Abraços,<br><strong>{{user.name}}</strong><br>{{user.email}}</p></div></div>`,
  },
  {
    id: "post-presentation",
    name: "Aivo — pós apresentação",
    subject: "Podemos avançar com o Aivo?",
    bodyHtml: `<div style="font-family:Arial,sans-serif;color:#18352a;line-height:1.6"><div style="padding:24px 28px;background:#16552f;color:white;font-size:30px;font-weight:700">aivo</div><div style="padding:28px 30px"><p>Olá, {{contact.name}}!</p><p>Depois da nossa apresentação, queria saber qual ponto fez mais sentido para a {{contact.company}}.</p><p>Se desejar, marcamos uma conversa rápida para definir o próximo passo de <strong>{{deal.title}}</strong>.</p><p>Fico à disposição.<br><strong>{{user.name}}</strong></p></div></div>`,
  },
  {
    id: "nutrition-2",
    name: "Aivo — nutrição 2 (oferta de conversa)",
    subject: "Uma conversa rápida sobre sua operação",
    bodyHtml: `<div style="font-family:Arial,sans-serif;color:#18352a;line-height:1.6"><div style="padding:24px 28px;background:#16552f;color:white;font-size:30px;font-weight:700">aivo</div><div style="padding:28px 30px"><p>Oi, {{contact.name}}!</p><p>Separei alguns exemplos de como empresas como a {{contact.company}} organizam atendimento, vendas e rotina da equipe.</p><p>Quer reservar 20 minutos para vermos se isso se aplica ao seu cenário?</p><p>Abraços,<br><strong>{{user.name}}</strong></p></div></div>`,
  },
  {
    id: "nutrition-1",
    name: "Aivo — nutrição 1 (caderno ao celular)",
    subject: "Sua operação na palma da mão",
    bodyHtml: `<div style="font-family:Arial,sans-serif;color:#18352a;line-height:1.6"><div style="padding:24px 28px;background:#16552f;color:white;font-size:30px;font-weight:700">aivo</div><div style="padding:28px 30px"><p>Olá, {{contact.name}}!</p><p>Imagine acompanhar os principais indicadores da {{contact.company}} direto do celular, com o histórico de cada cliente no mesmo lugar.</p><p>É esse o tipo de visibilidade que queremos mostrar a você.</p><p>Até mais,<br><strong>{{user.name}}</strong></p></div></div>`,
  },
  {
    id: "trial-end",
    name: "Aivo — Trial — fim em 3 dias",
    subject: "Seu trial do Aivo termina em 3 dias",
    bodyHtml: `<div style="font-family:Arial,sans-serif;color:#18352a;line-height:1.6"><div style="padding:24px 28px;background:#16552f;color:white;font-size:30px;font-weight:700">aivo</div><div style="padding:28px 30px"><p>Olá, {{contact.name}}!</p><p>Seu período de teste está chegando ao fim. Se quiser, posso te ajudar a revisar os resultados e definir a melhor continuidade para a {{contact.company}}.</p><p>Conte comigo,<br><strong>{{user.name}}</strong></p></div></div>`,
  },
  {
    id: "trial-tip",
    name: "Aivo — Trial — dica do próximo passo",
    subject: "Uma dica para aproveitar seu trial",
    bodyHtml: `<div style="font-family:Arial,sans-serif;color:#18352a;line-height:1.6"><div style="padding:24px 28px;background:#16552f;color:white;font-size:30px;font-weight:700">aivo</div><div style="padding:28px 30px"><p>Olá, {{contact.name}}!</p><p>Uma boa próxima ação é cadastrar a equipe e acompanhar as primeiras conversas pelo painel.</p><p>Se precisar de ajuda, é só responder este e-mail.</p><p>Abraços,<br><strong>{{user.name}}</strong></p></div></div>`,
  },
];

function replaceTokens(template: string, contact: Contact, opportunity: Opportunity, owner: User) {
  const values: Record<string, string> = {
    "contact.name": escapeHtml(contact.name),
    "contact.company": escapeHtml(contact.company || "sua empresa"),
    "deal.title": escapeHtml(opportunity.title),
    "deal.value": escapeHtml(money(opportunity.value)),
    "user.name": escapeHtml(owner.name),
    "user.email": escapeHtml(owner.email),
    "links.descadastro": "#descadastro",
  };
  return template.replace(/{{\s*([^}]+)\s*}}/g, (_match, key: string) => values[key.trim()] ?? "");
}

function DealButton({ children, variant = "outline", onClick, type = "button", disabled = false, className = "" }: { children: ReactNode; variant?: "primary" | "outline" | "ghost" | "danger"; onClick?: () => void; type?: "button" | "submit"; disabled?: boolean; className?: string }) {
  return <button className={`deal-button ${variant} ${className}`} type={type} onClick={onClick} disabled={disabled}>{children}</button>;
}

function DetailPlaceholder({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return <div className="deal-placeholder"><div className="deal-placeholder-icon">{icon}</div><h3>{title}</h3><p>{body}</p><DealButton variant="outline" onClick={() => undefined}>Adicionar registro</DealButton></div>;
}

function EmailComposer({ contact, opportunity, owner, onSaved, notify }: { contact: Contact; opportunity: Opportunity; owner: User; onSaved: (record: EmailRecord) => void; notify: (toast: Toast) => void }) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0].id);
  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId) ?? templates[0];
  const [from, setFrom] = useState(commercialSender);
  const [to, setTo] = useState(contact.email);
  const [cc, setCc] = useState("");
  const [bcc, setBcc] = useState("");
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState(replaceTokens(selectedTemplate.subject, contact, opportunity, owner));
  const [bodyHtml, setBodyHtml] = useState(replaceTokens(selectedTemplate.bodyHtml, contact, opportunity, owner));
  const [status, setStatus] = useState("Rascunho salvo");
  const [sending, setSending] = useState(false);

  const applyTemplate = (id: string) => {
    const template = templates.find((candidate) => candidate.id === id) ?? templates[0];
    setSelectedTemplateId(template.id);
    setSubject(replaceTokens(template.subject, contact, opportunity, owner));
    setBodyHtml(replaceTokens(template.bodyHtml, contact, opportunity, owner));
    setStatus("Modelo aplicado · rascunho salvo");
  };

  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!to.trim() || !to.includes("@")) { notify({ tone: "error", message: "Informe um destinatário válido." }); return; }
    setSending(true);
    if (opportunity.organizationId === "demo-organization") {
      window.setTimeout(() => {
      const record: EmailRecord = { id: `email-${Date.now()}`, subject, to, status: "SENT", createdAt: new Date().toISOString(), templateName: selectedTemplate.name };
      onSaved(record);
      setStatus("Enviado no modo demonstração");
      setSending(false);
      notify({ tone: "success", message: "E-mail registrado na linha do tempo. O SMTP real ainda não foi acionado." });
      }, 350);
      return;
    }
    try {
      const result = await api<{ email: EmailRecord }>(`/v1/opportunities/${opportunity.id}/emails`, { method: "POST", body: JSON.stringify({ from, to, cc, bcc, subject, bodyHtml }) });
      onSaved(result.email);
      setStatus("Enviado via Lark");
      notify({ tone: "success", message: "E-mail enviado pelo SMTP do Lark." });
    } catch (error) {
      notify({ tone: "error", message: error instanceof Error ? error.message : "Falha ao enviar e-mail pelo Lark." });
    } finally {
      setSending(false);
    }
  };

  return <form className="deal-composer" onSubmit={send}>
    <div className="deal-composer-fields">
      <div className="deal-mail-line"><label>De</label><select value={from} onChange={(event) => setFrom(event.target.value)}><option value={commercialSender}>{commercialSender}</option></select><button className="deal-inline-icon" type="button" title="Configurar remetentes"><Settings2 size={15} /></button></div>
      <div className="deal-mail-line"><label>Para</label><input value={to} onChange={(event) => setTo(event.target.value)} placeholder="nome@empresa.com" /><div className="deal-mail-links"><button type="button" onClick={() => setShowCc((value) => !value)}>Cc</button><button type="button" onClick={() => setShowBcc((value) => !value)}>Cco</button></div></div>
      {showCc && <div className="deal-mail-line"><label>Cc</label><input value={cc} onChange={(event) => setCc(event.target.value)} placeholder="copia@empresa.com" /></div>}
      {showBcc && <div className="deal-mail-line"><label>Cco</label><input value={bcc} onChange={(event) => setBcc(event.target.value)} placeholder="copiaoculta@empresa.com" /></div>}
      <div className="deal-mail-line"><label>Assunto</label><input value={subject} onChange={(event) => setSubject(event.target.value)} /></div>
    </div>
    <div className="deal-email-editor-layout">
      <div className="deal-editor-column">
        <div className="deal-editor-toolbar"><button type="button" onClick={() => document.execCommand("bold")}><strong>B</strong></button><button type="button" onClick={() => document.execCommand("italic")}><em>I</em></button><button type="button" onClick={() => document.execCommand("underline")}><u>U</u></button><span /><button type="button" title="Inserir link"><Link2 size={14} /></button><button type="button" title="Anexar arquivo"><Paperclip size={14} /></button></div>
        <div className="deal-editor-label">Corpo do e-mail</div>
        <div className="deal-rich-editor" contentEditable suppressContentEditableWarning dangerouslySetInnerHTML={{ __html: bodyHtml }} onInput={(event) => setBodyHtml(event.currentTarget.innerHTML)} />
        <div className="deal-editor-footer"><span>{status}</span><div><DealButton variant="ghost" onClick={() => setStatus("Rascunho salvo")}>Salvar rascunho</DealButton><DealButton variant="primary" type="submit" disabled={sending}><Send size={14} />{sending ? "Enviando…" : "Enviar"}<ChevronDown size={13} /></DealButton></div></div>
      </div>
      <aside className="deal-template-picker"><div className="deal-template-heading"><div><span>Modelo visual</span><small>Escolha um script e preencha automaticamente</small></div><ChevronDown size={15} /></div><div className="deal-template-list">{templates.map((template) => <button type="button" className={template.id === selectedTemplateId ? "active" : ""} key={template.id} onClick={() => applyTemplate(template.id)}><FileText size={14} /><span>{template.name}</span>{template.id === selectedTemplateId && <Check size={14} />}</button>)}</div></aside>
    </div>
    <div className="deal-composer-bottom"><span><Sparkles size={14} /> Variáveis do contato, negócio e responsável preenchidas automaticamente.</span><span className="deal-unsubscribe">{"{{links.descadastro}} não configurado"}</span></div>
  </form>;
}

export function DealDetailPage({ opportunity, state, onBack, notify }: { opportunity: Opportunity; state: AppState; onBack: () => void; notify: (toast: Toast) => void }) {
  const contact = state.contacts.find((item) => item.id === opportunity.contactId) ?? state.contacts[0];
  const owner = state.users.find((item) => item.id === opportunity.ownerId) ?? state.user;
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number][0]>("email");
  const [composerOpen, setComposerOpen] = useState(true);
  const [emails, setEmails] = useState<EmailRecord[]>([]);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([
    { id: "greeting", label: "Apresentação e contexto", status: "Concluído" },
    { id: "need", label: "Necessidade identificada", status: "Pendente" },
    { id: "product", label: "Produto identificado", status: "Pendente" },
    { id: "next", label: "Próximo passo combinado", status: "Pendente" },
  ]);
  const stageIndex = ["NEW_LEAD", "CONTACTED", "PROPOSAL", "NEGOTIATION", "WON"].indexOf(opportunity.stage);
  const createdLabel = useMemo(() => opportunity.lastActivity || "agora", [opportunity.lastActivity]);

  if (!contact) return <div className="page"><DetailPlaceholder icon={<UserRound size={22} />} title="Contato não encontrado" body="Esta oportunidade não possui um contato associado." /></div>;

  const saveEmail = (record: EmailRecord) => setEmails((current) => [...current, record]);
  const updateCheck = (id: string, field: "checked" | "status", value: boolean | string) => setChecklist((current) => current.map((item) => item.id === id ? { ...item, status: field === "checked" ? (value ? "Concluído" : "Pendente") : value as ChecklistItem["status"] } : item));

  return <div className="page deal-detail-page">
    <div className="deal-detail-header"><button className="deal-back" onClick={onBack}><ArrowLeft size={16} /> Voltar ao funil</button><div className="deal-header-main"><div><div className="eyebrow">NEGÓCIO · {opportunity.source.toUpperCase()}</div><h1>{opportunity.title} <span>#{opportunity.id.slice(-4)}</span></h1><p><UserRound size={14} /> {contact.name} · {contact.company} · {owner.name}</p></div><div className="deal-header-actions"><DealButton variant="outline"><MessageCircle size={15} /> WhatsApp</DealButton><DealButton variant="primary"><Check size={15} /> Ganhar</DealButton><DealButton variant="danger">Perder</DealButton><DealButton variant="ghost" className="deal-icon-button"><MoreHorizontal size={18} /></DealButton></div></div></div>
    <div className="deal-stage-bar">{["NEW_LEAD", "CONTACTED", "PROPOSAL", "NEGOTIATION", "WON"].map((stage, index) => <div className={`deal-stage ${index <= stageIndex ? "done" : ""} ${stage === opportunity.stage ? "current" : ""}`} key={stage}><span>{index + 1}</span>{stageLabels[stage as StageKey]}{index < 4 && <i />}</div>)}</div>
    <div className="deal-layout">
      <aside className="deal-left-panel"><div className="deal-filter"><input placeholder="Filtrar campos" /><span>⌕</span></div><section className="deal-side-section"><div className="deal-side-heading"><strong>Resumo</strong><button title="Editar resumo"><Settings2 size={14} /></button></div><dl><dt>Valor</dt><dd>{money(opportunity.value)}</dd><dt>Probabilidade</dt><dd>{opportunity.stage === "WON" ? "100%" : "50%"}</dd><dt>Responsável</dt><dd>{owner.name}</dd><dt>Funil</dt><dd>Comercial</dd><dt>Etapa</dt><dd>{stageLabels[opportunity.stage]}</dd><dt>Na etapa desde</dt><dd>{createdLabel}</dd><dt>Próxima atividade</dt><dd>—</dd></dl></section><section className="deal-side-section"><div className="deal-side-heading"><strong>Participantes <small>1</small></strong><button title="Adicionar participante"><Plus size={14} /></button></div><div className="deal-participant"><div className="deal-avatar">{initials(contact.name)}</div><div><strong>{contact.name}</strong><small>{contact.email || "Sem e-mail"}</small></div></div></section><section className="deal-side-section"><div className="deal-side-heading"><strong>Itens <small>0</small></strong><button title="Adicionar item"><Plus size={14} /></button></div><p className="deal-muted">Nenhum produto vinculado</p></section></aside>
      <main className="deal-main-panel"><div className="deal-tabs" role="tablist">{tabs.map(([key, label]) => <button key={key} className={activeTab === key ? "active" : ""} onClick={() => setActiveTab(key)} role="tab">{key === "email" && <Mail size={14} />}{key === "calls" && <Phone size={14} />}{key === "meetings" && <CalendarDays size={14} />}{label}</button>)}</div>{activeTab === "email" ? <section className="deal-email-section"><div className="deal-email-heading"><div><h2>E-mail</h2><p>Envie pelo remetente comercial e mantenha toda a conversa vinculada ao negócio.</p></div><DealButton variant="primary" onClick={() => setComposerOpen(true)}><Plus size={15} /> Novo e-mail</DealButton></div>{emails.length > 0 && <div className="deal-email-history">{emails.map((email) => <div className="deal-email-card" key={email.id}><div className="deal-email-icon"><Mail size={15} /></div><div><strong>{email.subject}</strong><small>Para {email.to} · {email.status === "SENT" ? "enviado agora" : "rascunho"} {email.templateName ? `· ${email.templateName}` : ""}</small></div><Check size={15} /></div>)}</div>}{composerOpen ? <EmailComposer contact={contact} opportunity={opportunity} owner={owner} onSaved={saveEmail} notify={notify} /> : <DetailPlaceholder icon={<Mail size={22} />} title="Nenhum rascunho aberto" body="Clique em Novo e-mail para abrir o editor e aplicar um modelo." />}</section> : <DetailPlaceholder icon={activeTab === "activity" ? <ClipboardCheck size={22} /> : activeTab === "meetings" ? <CalendarDays size={22} /> : activeTab === "calls" ? <Phone size={22} /> : activeTab === "files" ? <Paperclip size={22} /> : activeTab === "documents" ? <FileText size={22} /> : activeTab === "invoice" ? <FileText size={22} /> : <FileText size={22} />} title={tabs.find(([key]) => key === activeTab)?.[1] ?? "Registro"} body="Esta área já está preparada no detalhe do negócio e pode receber os registros do fluxo." />}</main>
      <aside className="deal-right-panel"><section className="deal-checklist"><div className="deal-right-heading"><div><span>Script e checklist</span><small>SDR IA — Triagem</small></div><button title="Trocar script"><Settings2 size={15} /></button></div><div className="deal-script-actions"><button>Trocar</button><button><ClipboardCheck size={13} /> Modo reunião</button></div><div className="deal-checklist-items">{checklist.map((item) => <div className="deal-check-item" key={item.id}><input type="checkbox" checked={item.status === "Concluído"} onChange={(event) => updateCheck(item.id, "checked", event.target.checked)} /><div><strong>{item.label}</strong><small>{item.status}</small></div><select value={item.status} onChange={(event) => updateCheck(item.id, "status", event.target.value)}><option>Pendente</option><option>Concluído</option><option>Ignorado</option></select></div>)}</div><div className="deal-ai-note"><Sparkles size={14} /> Sugestões da IA desligadas para este script.</div></section><section className="deal-timeline"><div className="deal-right-heading"><div><span>Linha do tempo</span><small>Histórico do negócio</small></div><button title="Filtrar linha do tempo"><ChevronDown size={15} /></button></div><div className="deal-timeline-item"><div className="deal-timeline-icon"><BriefcaseIcon /></div><div><strong>Negócio aberto</strong><small>Origem {opportunity.source} · {createdLabel}</small></div></div>{emails.map((email) => <div className="deal-timeline-item" key={`timeline-${email.id}`}><div className="deal-timeline-icon email"><Mail size={14} /></div><div><strong>E-mail {email.status === "SENT" ? "enviado" : "salvo"}</strong><small>{email.subject} · Para {email.to}</small></div></div>)}</section></aside>
    </div>
  </div>;
}

function BriefcaseIcon() { return <ClipboardCheck size={14} />; }
