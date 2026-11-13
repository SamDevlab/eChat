import type { AppState } from "./types";

const now = Date.now();
const iso = (minutesAgo: number) => new Date(now - minutesAgo * 60_000).toISOString();

export function createDemoState(): AppState {
  const organizationId = "demo-organization";
  const owner: AppState["users"][number] = { id: "demo-owner", organizationId, name: "Weslley Oliveira", email: "owner@echat.local", role: "OWNER", avatar: "WO" };
  const manager: AppState["users"][number] = { id: "demo-manager", organizationId, name: "Mariana Costa", email: "mariana@echat.local", role: "MANAGER", avatar: "MC" };
  const seller: AppState["users"][number] = { id: "demo-seller", organizationId, name: "Rafael Lima", email: "rafael@echat.local", role: "SELLER", avatar: "RL" };
  const agent: AppState["users"][number] = { id: "demo-agent", organizationId, name: "Ana Souza", email: "agente@echat.local", role: "AGENT", avatar: "AS" };
  const users = [owner, manager, seller, agent];
  const contacts: AppState["contacts"] = [
    { id: "demo-contact-1", organizationId, name: "Maria Silva", company: "ACME Soluções", phone: "+55 11 99999-1111", email: "maria@acme.com", tags: ["Lead qualificado", "Plano Pro"], ownerId: seller.id, lastConversationAt: iso(18), opportunities: 1, notes: "Busca expansão para a equipe comercial." },
    { id: "demo-contact-2", organizationId, name: "João Pereira", company: "Pereira & Filhos", phone: "+55 11 98888-2222", email: "joao@pereiraefilhos.com", tags: ["Indicação", "Urgente"], ownerId: manager.id, lastConversationAt: iso(95), opportunities: 2, notes: "Solicitou proposta para 20 usuários." },
    { id: "demo-contact-3", organizationId, name: "Camila Rocha", company: "Norte Digital", phone: "+55 21 97777-3333", email: "camila@nortedigital.com", tags: ["Instagram"], ownerId: seller.id, lastConversationAt: iso(230), opportunities: 1, notes: "Interesse em automação de atendimento." },
    { id: "demo-contact-4", organizationId, name: "Lucas Mendes", company: "Mendes Consultoria", phone: "+55 31 96666-4444", email: "lucas@mendes.co", tags: ["Cliente"], ownerId: agent.id, lastConversationAt: iso(1440), opportunities: 0, notes: "Cliente ativo desde o último trimestre." },
  ];
  const channels: AppState["channels"] = [
    { id: "demo-channel-whatsapp", organizationId, name: "WhatsApp Comercial", type: "WHATSAPP", status: "CONNECTED", conversations: 18 },
    { id: "demo-channel-webchat", organizationId, name: "Webchat do site", type: "WEBCHAT", status: "CONNECTED", conversations: 7 },
    { id: "demo-channel-email", organizationId, name: "E-mail comercial", type: "EMAIL", status: "ATTENTION", conversations: 3 },
  ];
  const stages: AppState["stages"] = [
    { id: "demo-stage-new", organizationId, name: "Novo lead", key: "NEW_LEAD", order: 1, color: "teal" },
    { id: "demo-stage-contacted", organizationId, name: "Primeiro contato", key: "CONTACTED", order: 2, color: "blue" },
    { id: "demo-stage-proposal", organizationId, name: "Proposta", key: "PROPOSAL", order: 3, color: "amber" },
    { id: "demo-stage-negotiation", organizationId, name: "Negociação", key: "NEGOTIATION", order: 4, color: "violet" },
    { id: "demo-stage-won", organizationId, name: "Ganho", key: "WON", order: 5, color: "green" },
    { id: "demo-stage-lost", organizationId, name: "Perdido", key: "LOST", order: 6, color: "red" },
  ];
  const opportunities: AppState["opportunities"] = [
    { id: "demo-opportunity-1", organizationId, title: "Expansão Plano Pro", contactId: contacts[0].id, company: contacts[0].company, value: 14800, stage: "NEGOTIATION", ownerId: seller.id, source: "WhatsApp", lastActivity: "Hoje, 09:20", note: "Proposta revisada enviada para aprovação." },
    { id: "demo-opportunity-2", organizationId, title: "Implantação Comercial", contactId: contacts[1].id, company: contacts[1].company, value: 9200, stage: "PROPOSAL", ownerId: manager.id, source: "Indicação", lastActivity: "Ontem, 16:40", note: "Aguardando retorno sobre o número de usuários." },
    { id: "demo-opportunity-3", organizationId, title: "Atendimento Omnichannel", contactId: contacts[2].id, company: contacts[2].company, value: 5700, stage: "CONTACTED", ownerId: seller.id, source: "Instagram", lastActivity: "28/09/2026", note: "Diagnóstico marcado para esta semana." },
    { id: "demo-opportunity-4", organizationId, title: "Renovação anual", contactId: contacts[3].id, company: contacts[3].company, value: 12400, stage: "WON", ownerId: seller.id, source: "Cliente", lastActivity: "25/09/2026", note: "Contrato renovado." },
  ];
  const conversations: AppState["conversations"] = [
    { id: "demo-conversation-1", organizationId, contactId: contacts[0].id, channelId: channels[0].id, status: "OPEN", assignedToId: agent.id, unread: 2, lastMessage: "Consigo aprovar isso ainda hoje?", lastMessageAt: iso(18), messages: [{ id: "demo-message-1", conversationId: "demo-conversation-1", sender: "CONTACT", authorName: contacts[0].name, body: "Consigo aprovar isso ainda hoje?", createdAt: iso(18) }] },
    { id: "demo-conversation-2", organizationId, contactId: contacts[1].id, channelId: channels[1].id, status: "WAITING", assignedToId: manager.id, unread: 0, lastMessage: "Vou validar com o financeiro.", lastMessageAt: iso(95), messages: [{ id: "demo-message-2", conversationId: "demo-conversation-2", sender: "CONTACT", authorName: contacts[1].name, body: "Vou validar com o financeiro.", createdAt: iso(95) }] },
    { id: "demo-conversation-3", organizationId, contactId: contacts[2].id, channelId: channels[2].id, status: "OPEN", unread: 1, lastMessage: "Podem enviar a apresentação?", lastMessageAt: iso(230), messages: [{ id: "demo-message-3", conversationId: "demo-conversation-3", sender: "CONTACT", authorName: contacts[2].name, body: "Podem enviar a apresentação?", createdAt: iso(230) }] },
  ];
  return {
    organization: { id: organizationId, name: "Acme Atendimento", plan: "Plano Pro", timezone: "America/Sao_Paulo", onboardingStep: "DONE", onboardingCompleted: true },
    user: owner,
    users,
    members: users.map((user) => ({ id: `membership-${user.id}`, organizationId, userId: user.id, name: user.name, email: user.email, avatar: user.avatar, role: user.role, status: "ACTIVE" as const, createdAt: iso(60 * 24 * 30) })),
    departments: [{ id: "demo-department-sales", organizationId, name: "Comercial", slug: "comercial", color: "teal", description: "Leads, propostas e fechamento", active: true, memberIds: [manager.id, seller.id] }, { id: "demo-department-support", organizationId, name: "Suporte", slug: "suporte", color: "blue", description: "Atendimento e pós-venda", active: true, memberIds: [agent.id] }],
    routingRules: [{ id: "demo-rule-sales", organizationId, departmentId: "demo-department-sales", name: "Palavras comerciais", keywords: ["preço", "proposta", "contrato"], position: 1, active: true }],
    invites: [],
    integrations: [{ id: "demo-integration-meta", organizationId, provider: "meta_whatsapp", displayName: "WhatsApp Cloud API", externalAccountId: "1234567890", status: "CONNECTED", baseUrl: "https://graph.facebook.com" }],
    contacts,
    channels,
    conversations,
    stages,
    opportunities,
  };
}
