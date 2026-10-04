# Checklist de prontidão do piloto

## Ambiente e workspace

- [ ] `.env` local, fora do Git, com `DATABASE_ENV=TEST` e `DATABASE_URL`/`DATABASE_URL_TEST` em `echat_test`.
- [ ] Migrations aplicadas; `/api/health` e `/api/ready` respondem.
- [ ] Workspace criado e Owner/Admin confirmado.
- [ ] Atendentes convidados com papéis mínimos.
- [ ] `npm run check`, testes, build e testes PostgreSQL passaram.
- [ ] Nenhum cliente real ou dado de produção foi importado.

## Chatwoot e callback

- [ ] Conta e Inbox de teste dedicadas.
- [ ] Qualificador somente leitura passou para conta e Inbox esperadas.
- [ ] Leitura de contatos e conversas passou.
- [ ] URL pública HTTPS alcançável e marcada persistente somente quando estável.
- [ ] Webhook `message_created` aponta ao callback correto e ativação foi confirmada.
- [ ] Inbound sintético chegou à Inbox, persistiu uma vez e atualizou sem refresh manual.
- [ ] Echo/replay foi deduplicado.

## Operação

- [ ] Busca, filtros, atribuição, leitura, resolver/reabrir e vínculo CRM foram exercitados.
- [ ] Agente sabe responder e escalar falha de envio.
- [ ] Administrador consegue ver diagnóstico, sincronização, webhook e último evento.
- [ ] Backup e validação de integridade executados; restauração testada apenas em echat_test.
- [ ] Procedimento de atualização e contato técnico documentados.

## Segurança e canais

- [ ] Token API não volta ao navegador após salvar; webhook secret não é mostrado.
- [ ] Suporte/logs não contêm tokens, URLs de banco com senha, cookies, chaves ou conteúdo de mensagens.
- [ ] `ECHAT_OUTBOUND_MODE=disabled` e allowlist vazia.
- [ ] WhatsApp/Instagram reais não conectados sem aprovação e preparação específicas.
- [ ] `npm audit` classificado e findings residuais registrados.

## Limite do estado atual

O LAB usa eChat local e Chatwoot CE real em WSL1. O browser QA de desktop e móvel foi executado nesta campanha. A URL pública persistente não está configurada e o inbound real não foi repetido; portanto o piloto externo continua bloqueado até preparar um callback HTTPS estável e validar uma entrega inbound. Isso não altera a qualificação somente leitura do Chatwoot nem o smoke inbound comprovado anteriormente. Este estado não é produção.
