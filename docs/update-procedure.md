# Procedimento de atualização

Execute primeiro em ambiente de teste isolado. Para produção, mantenha o serviço parado ou coloque-o em manutenção antes da migração; não execute este procedimento contra `echat_test` por engano.

1. Registre a versão/commit em execução e confirme que rollback está disponível.
2. Faça backup e valide que o arquivo pode ser lido:

   ```powershell
   .\scripts\lab\backup-echat.ps1
   ```

3. Baixe a revisão aprovada e instale dependências do lockfile:

   ```powershell
   git fetch origin
   git checkout <revisao-aprovada>
   npm ci
   ```

4. Confirme ambiente e banco antes de migrar. Em produção, configure `DATABASE_ENV=PRODUCTION`; o script LAB recusa produção.
5. Aplique migrations, verifique tipos, testes e build:

   ```powershell
   npm run db:migrate
   npm run check
   npm run test
   npm run build
   ```

6. Reinicie apenas os serviços do ambiente de implantação escolhido.
7. Verifique `/api/health`, `/api/ready`, login, Inbox e diagnóstico Chatwoot. Faça um inbound sintético somente se o endpoint público de teste estiver pronto.
8. Registre commit, hora, backup e resultado. Se falhar, volte ao binário/revisão anterior e restaure somente depois de confirmar o banco de destino e o arquivo de backup.

Não há auto-updater. Não reverta migrations manualmente sem um plano de compatibilidade.
