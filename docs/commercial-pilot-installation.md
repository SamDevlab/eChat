# Instalação do piloto comercial

Este guia prepara um ambiente de laboratório e um servidor dedicado para um piloto controlado. O ambiente atual usa eChat no Windows e Chatwoot Community Edition no WSL1. WSL1 é apenas LAB; use um host Linux compatível para qualquer instalação Chatwoot com disponibilidade para uma empresa.

## Requisitos

- Windows 10/11 com PowerShell, Git e Node.js 20 ou superior para executar o eChat LAB.
- PostgreSQL acessível localmente, com um banco dedicado chamado `echat_test`.
- Para o Chatwoot LAB existente: distribuição WSL `EChat-Chatwoot-Lab`, PostgreSQL dedicado 16/main na porta local 5433 e Redis dedicado na porta 6380.
- Para o piloto hospedado: siga a matriz e o procedimento Linux VM oficiais do [Chatwoot Self-Hosted](https://developers.chatwoot.com/self-hosted). A página oficial documenta Ubuntu 24.04 LTS; confirme requisitos de CPU, memória, PostgreSQL, Redis, Ruby e armazenamento novamente ao provisionar.

## Preparar o eChat LAB no Windows

1. Clone somente `SamDevlab/eChat` e entre na raiz do repositório.
2. Instale dependências e crie o arquivo local de configuração:

   ```powershell
   npm ci
   Copy-Item .env.example .env
   ```

3. Edite `.env` localmente. Use um banco isolado `echat_test` em `DATABASE_URL` e `DATABASE_URL_TEST`, `DATABASE_ENV=TEST`, `ECHAT_OUTBOUND_MODE=disabled` e `ECHAT_OUTBOUND_PILOT_CONVERSATIONS=`. Não compartilhe o arquivo nem o adicione ao Git.
4. Crie `echat_test` no serviço PostgreSQL escolhido e confirme acesso pelo mesmo usuário da URL local.
5. Inicie os serviços necessários:

   ```powershell
   .\scripts\lab\start-lab.ps1
   .\scripts\lab\status-lab.ps1
   ```

   O início aplica migrations somente quando a URL aponta para `echat_test`, inicia Chatwoot/Redis/PostgreSQL do LAB apenas se estiverem parados e inicia eChat API/Web sem duplicar serviços ativos. O PostgreSQL compartilhado do Windows não é encerrado pelo script.

6. Abra `http://localhost:5173`, crie o workspace e Owner pelo cadastro da aplicação e convide atendentes na página **Equipe**.
7. Em **Canais**, configure a conexão Chatwoot, rode o teste somente de leitura e confirme a conta e Inbox. Depois, use **Ativar webhook** somente quando o callback HTTPS estiver alcançável.

O modo `disabled` é obrigatório para os scripts do LAB. Não use o seed demo em dados reais. Para massa sintética local, defina explicitamente `ECHAT_ALLOW_DEMO_SEED=1` depois de confirmar `DATABASE_ENV=TEST` e `DATABASE_URL` em `echat_test`.

## Callback público

O callback eChat precisa ser HTTPS alcançável pelo Chatwoot: `/api/v1/webhooks/chatwoot`. `PUBLIC_APP_URL` deve ser somente a origem, sem caminho ou credenciais. Marque `PUBLIC_URL_PERSISTENT=1` apenas quando a URL estável estiver implantada e testada.

O LAB atual não tem URL persistente configurada. Um Quick Tunnel serve apenas para desenvolvimento: a URL é temporária, qualquer pessoa que a conheça pode acessar o serviço publicado e ela deixa de funcionar quando o processo termina. Consulte [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/) e [Cloudflare Tunnel](https://developers.cloudflare.com/tunnel/get-started/). Uma URL nomeada requer conta e domínio gerido pela Cloudflare. Este guia não provisiona conta, domínio, túnel ou DNS.

## Canal de teste local

O Website Widget já hospedado no Chatwoot LAB é o canal local canônico para testar o percurso inbound do piloto. Use uma Inbox de teste dedicada e mantenha o outbound desativado; o widget percorre Chatwoot, webhook e Inbox eChat sem criar um adaptador ou provider novo. WhatsApp e Instagram reais ficam para uma campanha com contas e autorização próprias.

## Hospedagem de piloto

Separe eChat, Chatwoot, PostgreSQL e Redis dos ambientes pessoais. Use TLS na borda, segredos em um cofre ou arquivo de ambiente somente do servidor, backups fora do host e acesso de rede mínimo. Não exponha PostgreSQL/Redis. O procedimento de produção no [guia de implantação do Chatwoot em Linux VM](https://developers.chatwoot.com/self-hosted/deployment/linux-vm) é referência para instalação direta em Linux.

O repositório também contém uma configuração de implantação existente em [deployment.md](deployment.md); ela descreve outro método de execução. Este fluxo de LAB não instala Docker.

## Verificação inicial

```powershell
npm run db:migrate
npm run check
npm run test
npm run build
npm run test:integration
npm run qualify:chatwoot
git diff --check
```

Os testes PostgreSQL usam `DATABASE_URL_TEST` e devem apontar apenas para `echat_test`. A qualificação Chatwoot é somente leitura; registro de webhook e envio têm ações separadas.
