# Guia do administrador

## Pessoas e papéis

Em **Equipe**, convide operadores com o menor papel necessário e remova acessos que deixaram de ser usados. O sistema separa dados por organização. Owners/Admins gerenciam conexões e configurações; Agents atendem conversas conforme suas permissões.

## Conectar Chatwoot

1. Em Chatwoot, crie uma Inbox de laboratório dedicada e obtenha uma credencial de API com o acesso necessário.
2. Em **Canais** do eChat, informe URL base, Account ID, Inbox ID e token. O token é gravado cifrado; depois de salvo, a API não o devolve ao navegador. Ao editar, deixar o campo vazio mantém a credencial salva; preencha apenas para rotacioná-la.
3. Use **Testar somente leitura**. Confirme account/inbox, leitura de contatos e conversas e a correspondência do webhook esperado.
4. Use **Sincronizar** quando quiser importar dados existentes. A operação pode trazer contatos, conversas e mensagens; confira o ambiente e o escopo antes de executá-la.
5. Só depois de um teste bem-sucedido e de um callback HTTPS acessível, escolha **Ativar webhook** e confirme a alteração. A ativação registra `message_created`; o segredo recebido é mantido cifrado no servidor.

Não inclua token em chamado, chat, captura de tela, commit, terminal compartilhado ou pacote de suporte. Não reutilize token de administrador global quando uma credencial mais restrita atender.

## Diagnóstico

O cartão **Prontidão do piloto** é visível para Owner/Admin em **Canais**. Ele verifica estado do eChat, banco/migrations, acesso de callback público, integração, conta/Inbox/webhook, sincronização, atividade recente de webhooks, estabilidade declarada da URL e modo outbound. Erros são apresentados como códigos/mensagens saneadas.

Use **Baixar pacote de suporte** ou:

```powershell
.\scripts\lab\support-bundle.ps1
```

O arquivo local fica em `.runtime/`, ignorado pelo Git. Ele não inclui `.env`, credenciais, cookies, IDs de integração ou mensagens. Diagnósticos autenticados da integração ficam disponíveis para Owners/Admins na aplicação.

## Iniciar, parar e acompanhar o LAB

```powershell
.\scripts\lab\start-lab.ps1
.\scripts\lab\status-lab.ps1
.\scripts\lab\stop-lab.ps1
```

Os marcadores de propriedade ficam em `.runtime/lab/`. Stop encerra somente processos e instâncias Chatwoot que o script iniciou e cuja identidade ainda confere. Serviços que já estavam ativos, incluindo o PostgreSQL compartilhado do Windows, ficam ativos.

## Backup e restauração do eChat

O backup suporta apenas `echat_test` e é gravado em `backups/`, ignorado pelo Git:

```powershell
.\scripts\lab\backup-echat.ps1
```

Para restaurar, use um arquivo `.dump` explicitamente escolhido dentro de `backups/`:

```powershell
.\scripts\lab\restore-echat.ps1 -BackupPath .\backups\echat_test_YYYYMMDD_HHMMSS.dump
```

O script pede a confirmação literal `RESTORE echat_test`, cria um backup do banco atual, restaura em transação única, aplica migrations e verifica as tabelas necessárias. A confirmação substitui todo o conteúdo de teste existente.

## Retenção e solicitação de titular

Mensagens, contatos, conversas e eventos de webhook são mantidos para operar a Inbox, sincronizar o provedor e deduplicar entregas. Sessões e convites têm expiração/revogação; não há expurgo automático de histórico nesta campanha. O acesso é limitado por organização e papel; credenciais de integração são cifradas; timestamps de atividade e integração apoiam a investigação técnica.

Estado técnico nesta versão:

```text
DATA_SUBJECT_EXPORT=DEFERRED
DATA_SUBJECT_DELETE=DEFERRED
```

Não há exportação/apagamento completo por titular que reúna mensagens, identidades, eventos e referências externas. Antes de atender uma solicitação, preserve o escopo e encaminhe ao processo interno apropriado. Este guia descreve controles técnicos, não é parecer jurídico.
