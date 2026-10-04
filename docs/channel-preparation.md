# Preparação de canais Meta

Esta versão encaminha os canais pela integração Chatwoot; não implementa adaptador Meta direto. O canal real não está habilitado por esta checklist. Use contas, números e ativos de teste autorizados; não conecte conta de cliente nesta preparação.

## WhatsApp

- [ ] Criar/confirmar Inbox de WhatsApp Cloud de laboratório no Chatwoot.
- [ ] Validar a conta/portfólio de negócios e o número de teste com a pessoa responsável pelos ativos Meta.
- [ ] Confirmar a configuração atual do aplicativo, permissões, acesso padrão/avançado e revisão exigida para o caso de uso.
- [ ] Conferir a assinatura de webhooks e callback do Chatwoot.
- [ ] Confirmar a política atual de janela de atendimento, modelos/templates, consentimento e limites antes de qualquer envio.
- [ ] Testar inbound antes de permitir outbound; manter outbound e allowlist desabilitados até aprovação explícita.

Referências: [Configuração oficial WhatsApp Embedded Signup no Chatwoot](https://developers.chatwoot.com/self-hosted/configuration/features/integrations/whatsapp-embedded-signup) e [documentação WhatsApp Business Platform](https://developers.facebook.com/docs/whatsapp/). Requisitos de Meta variam por ativo, país e acesso do aplicativo; confirme-os no painel e documentação oficial durante a execução.

## Instagram

- [ ] Usar conta Instagram profissional de teste e uma conta Facebook com acesso aos ativos.
- [ ] Preparar aplicativo Meta Business e configurar produto, URL de callback e eventos de webhook exigidos pelo método escolhido.
- [ ] Adicionar testers/papéis e conceder apenas as permissões necessárias para o fluxo de mensagens.
- [ ] Confirmar no painel Meta se revisão/verificação e acesso avançado são exigidos antes de convidar usuários externos.
- [ ] Criar Inbox de teste no Chatwoot e validar inbound/outbound apenas com contas de teste autorizadas.

Referências: [Instagram Business Login do Chatwoot](https://developers.chatwoot.com/self-hosted/configuration/features/integrations/instagram-via-instagram-business-login/) e [guia de App Review do Chatwoot](https://developers.chatwoot.com/self-hosted/integrations/instagram-app-review). Confirme a lista de permissões vigente no portal Meta antes de configurar.
