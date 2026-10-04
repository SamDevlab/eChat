import type { DemoState, Message, OpportunityStage } from "@echat/shared";

const now = new Date("2026-09-20T12:00:00.000Z");
const minutesAgo = (minutes: number) => new Date(now.getTime() - minutes * 60_000).toISOString();

export const stages: DemoState["stages"] = [
  { id: "stage-new", organizationId: "org-acme", name: "Novo lead", key: "NEW_LEAD", order: 1, color: "teal" },
  { id: "stage-contacted", organizationId: "org-acme", name: "Contato realizado", key: "CONTACTED", order: 2, color: "blue" },
  { id: "stage-proposal", organizationId: "org-acme", name: "Proposta", key: "PROPOSAL", order: 3, color: "violet" },
  { id: "stage-negotiation", organizationId: "org-acme", name: "Negociação", key: "NEGOTIATION", order: 4, color: "amber" },
  { id: "stage-won", organizationId: "org-acme", name: "Ganho", key: "WON", order: 5, color: "green" },
  { id: "stage-lost", organizationId: "org-acme", name: "Perdido", key: "LOST", order: 6, color: "red" },
];

const message = (input: Omit<Message, "id"> & { id: string }): Message => input;

export const createSeedState = (): DemoState => ({
  organization: { id: "org-acme", name: "Acme Atendimento", plan: "Plano Enterprise" },
  users: [
    { id: "user-owner", organizationId: "org-acme", name: "Samuel Araújo", email: "owner@echat.local", role: "OWNER", avatar: "SA" },
    { id: "user-admin", organizationId: "org-acme", name: "João Santos", email: "admin@echat.local", role: "ADMIN", avatar: "JS" },
    { id: "user-agent", organizationId: "org-acme", name: "Carlos Mendes", email: "agente@echat.local", role: "AGENT", avatar: "CM" },
    { id: "user-fernanda", organizationId: "org-acme", name: "Fernanda Lima", email: "fernanda@echat.local", role: "AGENT", avatar: "FL" },
  ],
  contacts: [
    { id: "contact-maria", organizationId: "org-acme", name: "Maria Silva", company: "ACME Soluções", phone: "+55 71 99999-9999", email: "maria@acme.com.br", tags: ["Lead qualificado", "Instagram", "Plano Pro"], ownerId: "user-agent", lastConversationAt: minutesAgo(2), opportunities: 1, identities: [], notes: "Interessada em contratar para equipe de 8 pessoas. Reunião de alinhamento prévia agendada para amanhã às 14h." },
    { id: "contact-joao", organizationId: "org-acme", name: "João Santos", company: "TecnoSantos ME", phone: "+55 11 98888-1212", email: "joao@tecnosantos.com.br", tags: ["Cliente", "Suporte"], ownerId: "user-admin", lastConversationAt: minutesAgo(12), opportunities: 1, identities: [], notes: "Cliente recorrente. Prefere contato pela manhã." },
    { id: "contact-roberto", organizationId: "org-acme", name: "Roberto Lima", company: "Alpha Serviços", phone: "+55 11 97777-4444", email: "roberto@alpha.com", tags: ["Demonstração"], ownerId: "user-agent", lastConversationAt: minutesAgo(28), opportunities: 1, identities: [], notes: "Solicitou demonstração comercial." },
    { id: "contact-techsul", organizationId: "org-acme", name: "TechSul Logística", company: "TechSul Logística", phone: "+55 31 96666-7777", email: "contato@techsul.com", tags: ["API", "WebChat"], ownerId: "user-owner", lastConversationAt: minutesAgo(45), opportunities: 1, identities: [], notes: "Time técnico avaliando integração via webhook." },
    { id: "contact-lucas", organizationId: "org-acme", name: "Lucas Ferraz", company: "Nexus Digital", phone: "+55 21 95555-0101", email: "lucas@nexus.io", tags: ["Financeiro"], ownerId: "user-owner", lastConversationAt: minutesAgo(60), opportunities: 0, identities: [], notes: "Solicitou comprovante de pagamento." },
  ],
  channels: [
    { id: "channel-whatsapp", organizationId: "org-acme", name: "WhatsApp Oficial", type: "WHATSAPP", status: "CONNECTED", conversations: 24 },
    { id: "channel-webchat", organizationId: "org-acme", name: "WebChat", type: "WEBCHAT", status: "CONNECTED", conversations: 11 },
    { id: "channel-email", organizationId: "org-acme", name: "Email Financeiro", type: "EMAIL", status: "CONNECTED", conversations: 5 },
    { id: "channel-instagram", organizationId: "org-acme", name: "Instagram", type: "INSTAGRAM", status: "ATTENTION", conversations: 2 },
  ],
  conversations: [
    {
      id: "conv-maria", organizationId: "org-acme", contactId: "contact-maria", channelId: "channel-whatsapp", status: "OPEN", assignedToId: "user-agent", unread: 3, lastMessage: "Quero informações sobre o plano para minha empresa.", lastMessageAt: minutesAgo(2),
      messages: [
        message({ id: "msg-maria-1", conversationId: "conv-maria", sender: "CONTACT", authorName: "Maria Silva", body: "Olá! Encontrei vocês pelo Instagram e vi que integram WhatsApp com CRM completo para empresas.", createdAt: minutesAgo(20) }),
        message({ id: "msg-maria-2", conversationId: "conv-maria", sender: "AGENT", authorName: "Carlos Mendes (Você)", body: "Olá Maria! Tudo bem? Sim, centralizamos todos os canais de atendimento e transformamos conversas em negócios diretamente no CRM. Como posso te apoiar hoje?", createdAt: minutesAgo(18) }),
        message({ id: "msg-maria-3", conversationId: "conv-maria", sender: "CONTACT", authorName: "Maria Silva", body: "Quero informações sobre o plano para minha empresa. Somos em 8 atendentes e precisamos de distribuição automática de chamados por setor.", createdAt: minutesAgo(2) }),
        message({ id: "msg-maria-4", conversationId: "conv-maria", sender: "SYSTEM", authorName: "Nota interna • Carlos Mendes", body: "Lead altamente qualificada. Direcionada para o Plano Pro. Oportunidade gerada no CRM.", createdAt: minutesAgo(1), internal: true }),
      ],
    },
    {
      id: "conv-joao", organizationId: "org-acme", contactId: "contact-joao", channelId: "channel-instagram", status: "WAITING", assignedToId: "user-fernanda", unread: 0, lastMessage: "Obrigado pelo atendimento rápido!", lastMessageAt: minutesAgo(12),
      messages: [message({ id: "msg-joao-1", conversationId: "conv-joao", sender: "CONTACT", authorName: "João Santos", body: "Obrigado pelo atendimento rápido!", createdAt: minutesAgo(12) })],
    },
    {
      id: "conv-roberto", organizationId: "org-acme", contactId: "contact-roberto", channelId: "channel-whatsapp", status: "OPEN", assignedToId: "user-agent", unread: 0, lastMessage: "Podemos marcar uma demonstração amanhã?", lastMessageAt: minutesAgo(28),
      messages: [message({ id: "msg-roberto-1", conversationId: "conv-roberto", sender: "CONTACT", authorName: "Roberto Lima", body: "Podemos marcar uma demonstração amanhã?", createdAt: minutesAgo(28) })],
    },
    {
      id: "conv-techsul", organizationId: "org-acme", contactId: "contact-techsul", channelId: "channel-webchat", status: "OPEN", unread: 0, lastMessage: "Qual a documentação da API para webhook?", lastMessageAt: minutesAgo(45),
      messages: [message({ id: "msg-techsul-1", conversationId: "conv-techsul", sender: "CONTACT", authorName: "TechSul Logística", body: "Qual a documentação da API para webhook?", createdAt: minutesAgo(45) })],
    },
    {
      id: "conv-lucas", organizationId: "org-acme", contactId: "contact-lucas", channelId: "channel-email", status: "WAITING", assignedToId: "user-owner", unread: 0, lastMessage: "Comprovante de pagamento anexo referente ao mês...", lastMessageAt: minutesAgo(60),
      messages: [message({ id: "msg-lucas-1", conversationId: "conv-lucas", sender: "CONTACT", authorName: "Lucas Ferraz", body: "Comprovante de pagamento anexo referente ao mês de setembro.", createdAt: minutesAgo(60) })],
    },
  ],
  stages,
  opportunities: [
    { id: "opp-alpha", organizationId: "org-acme", title: "Plano Pro — Maria Silva", contactId: "contact-maria", company: "ACME Soluções", value: 3500, stage: "PROPOSAL", ownerId: "user-agent", source: "WhatsApp", lastActivity: "12 min atrás", note: "Proposta quente para equipe de 8 pessoas." },
    { id: "opp-joao", organizationId: "org-acme", title: "Plano Pro — João Santos", contactId: "contact-joao", company: "TecnoSantos ME", value: 1490, stage: "CONTACTED", ownerId: "user-admin", source: "Instagram", lastActivity: "1h atrás", note: "Retomar após validação técnica." },
    { id: "opp-nexus", organizationId: "org-acme", title: "Atendimento Enterprise", contactId: "contact-roberto", company: "Alpha Serviços", value: 1200, stage: "NEW_LEAD", ownerId: "user-agent", source: "WebChat", lastActivity: "35 min atrás", note: "Demonstração solicitada." },
    { id: "opp-techsul", organizationId: "org-acme", title: "API e automações", contactId: "contact-techsul", company: "TechSul Logística", value: 8900, stage: "NEGOTIATION", ownerId: "user-owner", source: "WebChat", lastActivity: "3h atrás", note: "Contrato em revisão técnica." },
    { id: "opp-won", organizationId: "org-acme", title: "Plano Pro — Studio Criativo", contactId: "contact-lucas", company: "Studio Criativo", value: 3200, stage: "WON", ownerId: "user-agent", source: "Email", lastActivity: "ontem", note: "Fechado por Fernanda." },
  ],
});

export const stageKeys: OpportunityStage[] = ["NEW_LEAD", "CONTACTED", "PROPOSAL", "NEGOTIATION", "WON", "LOST"];
