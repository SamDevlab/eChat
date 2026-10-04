# Auditoria de dependências

Auditoria executada em 2026-10-03, após `npm ci` e as atualizações pontuais desta campanha.

## Resultado

```text
npm audit: 4 moderate, 0 high, 0 critical
npm audit --omit=dev: 0 vulnerabilities
```

Foram atualizados `drizzle-orm` para `0.45.3`, `vitest` para `4.1.11`, `vite` para `7.3.6` e `@vitejs/plugin-react` para `5.2.0`. O ORM atualizado inclui a correção publicada em `0.45.2` para escaping de identificadores SQL. O código do eChat usa tabelas/colunas estáticas nas consultas e não constrói identificadores a partir de dados de requisição. Referência: [advisory do Drizzle ORM](https://github.com/drizzle-team/drizzle-orm/security/advisories/GHSA-gpj5-g38j-94v9).

Vite e `@vitejs/plugin-react` foram classificados como dependências de desenvolvimento/build. `tailwindcss` foi removido porque não era usado pelo código da aplicação.

## Findings residuais

Os quatro findings moderados vêm da ferramenta de geração de migrations `drizzle-kit@0.30.6`, que é `devDependency` de `@echat/db`, e da sua cadeia `@esbuild-kit/esm-loader@2.6.5` → `@esbuild-kit/core-utils@3.3.2` → versões antigas de `esbuild`. Não fazem parte do runtime implantado. `npm audit --omit=dev` confirmou zero findings de produção.

Os pacotes `@esbuild-kit/esm-loader` e `@esbuild-kit/core-utils` estão deprecated; o registry os marca como incorporados ao `tsx`. O manifesto upstream da versão estável `drizzle-kit@0.31.11` ainda lista `@esbuild-kit/esm-loader`, e o repair automático do npm propõe atravessar a faixa declarada atual. Para não trocar o gerador de migrations por um salto não validado nesta campanha, a cadeia fica registrada para remoção ou atualização isolada com geração de migrations revisada. Referências: [manifesto upstream do drizzle-kit](https://github.com/drizzle-team/drizzle-orm/blob/main/drizzle-kit/package.json) e [advisory do esbuild](https://github.com/advisories/GHSA-67mh-4wv8-2f99).

Não foi executado `npm audit fix --force`. O CI e os comandos locais devem continuar registrando findings de desenvolvimento até a cadeia do gerador ser substituída.
