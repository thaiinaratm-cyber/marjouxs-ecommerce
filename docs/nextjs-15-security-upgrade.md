# Next.js 15 - upgrade local de seguranca

Data: 2026-11-04. Etapa 5B. Sem commit, push, deploy ou alteracao de producao.

## Resultado e limite da aprovacao

Next.js **14.2.35 -> 15.5.28**. O advisory **GHSA-p3m5-59mp-jv5r** deixou de
afetar a versao instalada. A conclusao desta etapa e restrita a esse upgrade e
suas regressoes de compatibilidade; **nao equivale a liberar producao** nem a
declarar `npm audit` limpo. Ha riscos residuais fora do recorte, especialmente Zod.

O aviso oficial inclui >=13.0.0 e <=15.5.27, informa correcao em 15.5.28 e nao
oferece workaround alem do upgrade para aplicacoes afetadas. Este projeto usa
App Router e Server Actions. Nenhum exploit/ataque de DoS foi executado.

Fonte primaria: https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r

## Versoes efetivas e peers

| Componente | Antes | Depois |
| --- | --- | --- |
| next | 14.2.35 | 15.5.28 exato |
| react | 18.3.1 | 19.3.1 exato |
| react-dom | 18.3.1 | 19.3.1 exato |
| eslint-config-next | 14.2.35 | 15.5.28 exato |
| @types/react | 18.3.29 | 19.3.0 exato |
| @types/react-dom | 18.3.7 | 19.3.0 exato |
| TypeScript | 5.9.3 | 5.9.3, preservado |
| ESLint | 8.57.1 | 8.57.1, preservado |
| Node local | 24.16.0 | 24.16.0, preservado |
| npm | 11.13.0 | 11.13.0, preservado |
| @netlify/plugin-nextjs | 5.15.11 | 5.15.11, preservado |

Lockfile: `package-lock.json`, mantido no formato npm existente. `npm ls` retornou
sucesso; `npm ls --all --json` confirmou problems/invalid/missing vazios, sem peers
invalidos. Next aceita React ^19.0.0; React DOM 19.3.1 exige
React ^19.3.1, atendido. A documentacao de migracao do App Router recomenda/exige
React 19, motivo do upgrade conjunto e dos tipos correspondentes.

Fonte primaria: https://nextjs.org/docs/app/guides/upgrading/version-15

Nao houve `npm update`, `npm audit fix`, `--force`, `--legacy-peer-deps` nem
codemod automatico. A instalacao seletiva usou `--ignore-scripts --no-audit
--no-fund`; os scripts de instalacao nao foram executados.

## Baseline antes de atualizar

- `npm test`: 1072 aprovados, 6 live ignorados, 88 arquivos.
- `npm run lint`: aprovado sem warnings/erros ESLint.
- `npx tsc --noEmit --incremental false`: aprovado.
- `npm run build`: Next 14 aprovado em copia isolada fora do OneDrive.
- `git diff --check`: aprovado.

Manifests anteriores preservados fora do repositorio em
`checkout-stage5b-audit-20261104/package.before.json` e `package-lock.before.json`.
A copia `checkout-stage5b-baseline-20261104` preserva os fontes anteriores, sem envs.

## Auditoria de lockfile

Comparacao com o lockfile local imediatamente anterior, NAO com HEAD (que ja tinha
mudancas paralelas): **32 registros adicionados, 34 removidos e 21 com versao
alterada**. Os registros multiplataforma nem sempre correspondem a pacotes
instalados fisicamente no Windows.

- Alterados Next, @next/env, plugin ESLint Next, binarios SWC e @swc/helpers.
- React/React DOM, scheduler e seus tipos acompanharam a migracao.
- styled-jsx e react-hooks acompanham as dependencias dos pacotes atualizados.
- Next passou a incluir sharp opcional e a matriz @img/libvips de plataformas.
- semver 7.8.1 -> 7.8.6 foi necessario para `sharp@0.35.5`, que exige ^7.8.5;
  foi reutilizado/hoisted na arvore ESLint existente. Nao foi um update amplo.
- Removidos auxiliares que deixaram de ser exigidos pelas arvores Next/ESLint e
  os tipos antigos de prop-types. Nenhuma biblioteca comercial foi trocada.
- Supabase, Zod, Netlify, lucide, react-markdown, TypeScript e integracoes existentes
  conservaram as versoes do lockfile anterior.

## Incompatibilidades e correcoes

1. `params`/`searchParams` agora sao Promises em paginas, metadata e na rota publica
   de consulta por token. Foram aguardados antes do acesso a seus campos.
2. `cookies()` e aguardado no adaptador SSR do Supabase. O contrato de sessao,
   getAll/setAll e comportamento de Server Components read-only foi preservado.
3. Fixtures de testes de dashboard/pedidos/token passaram a usar Promise.resolve.
4. Um teste novo de metadata precisou usar uma assercao sobre o objeto para tratar
   o retorno alternativo de categoria invalida; nenhuma regra de SEO foi alterada.
5. `next-env.d.ts` foi atualizado automaticamente pelo Next 15 com a referencia a
   `.next/types/routes.d.ts` e o endereco atual da documentacao. Nao e tsbuildinfo.

Nao ha uso server-side de `headers()`/`draftMode()` a migrar. `useSearchParams`
client-side permanece como antes. Nao foram introduzidos novos Server Actions.

## Cache, rendering e configuracao

`next.config.mjs`, `middleware.ts`, `netlify.toml`, politicas comerciais e envs nao
foram modificados. `next/image` continua `unoptimized=true`, com os mesmos hosts e
arquivos. Nao ha `next/font` a adaptar.

O cache de catalogo permanece explicito (`unstable_cache`, tag e TTL existentes);
leituras frescas mantem no-store. Revalidate de admin, metadata, sitemap e headers
privados dos endpoints financeiros foram preservados. O novo default de GET/fetch
do Next 15 nao foi usado para mudar regras do projeto. Nao foi habilitado cache
global, PPR, React Compiler, Turbopack experimental ou qualquer recurso novo.

Avisos observados, sem ignorar criticidade:
- Framework: `next lint` deprecated, mas ainda suportado no Next 15. A troca futura
  para ESLint CLI ficou fora deste recorte.
- Framework/browser: aviso de preparacao futura para `scroll-behavior: smooth`
  (`data-scroll-behavior`). Nao e hydration/runtime error; nao houve mudanca global
  do HTML/CSS apenas para silenciar o aviso.
- Dependencia/dados: Browserslist desatualizado, ja presente no baseline.
- Webpack dev: serializacao de strings grandes no cache; aviso de performance,
  sem falha funcional ou alteracao de cache para silencia-lo.
- Nenhum warning novo critico do Next 15 foi observado.

## Server Actions reais: 14 em 5 arquivos

| Arquivo | Action | Acesso/input |
| --- | --- | --- |
| app/admin/login/actions.ts | loginAction | publica para login; FormData validado, autentica e exige membership ativo |
| app/admin/(protected)/actions.ts | logoutAction | requireActiveAdmin; sem input comercial |
| app/admin/(protected)/produtos/actions.ts | createDraftProductAction | admin ativo; FormData validado |
| mesmo arquivo | duplicateProductAction | admin ativo; origem/retorno validados |
| mesmo arquivo | updateProductAction | admin ativo; FormData/id/versao validados |
| mesmo arquivo | activateProductAction | admin ativo; requisitos de publicacao existentes |
| mesmo arquivo | deactivateProductAction | admin ativo; id/confirmacao existentes |
| app/admin/(protected)/produtos/image-actions.ts | refreshProductImagesAction | admin ativo; UUID |
| mesmo arquivo | setPrimaryImageAction | admin ativo via imageContext; UUIDs; RPC existente |
| mesmo arquivo | moveProductImageAction | admin ativo; UUIDs/direcao |
| mesmo arquivo | updateProductImageAltAction | admin ativo via imageContext; UUIDs/texto |
| mesmo arquivo | removeProductImageAction | admin ativo via imageContext; protecao de principal ativa |
| app/admin/(protected)/pedidos/actions.ts | updateOrderStatusAction | admin ativo; id/status esperado validado |
| mesmo arquivo | reconcilePaymentAction | admin ativo; somente id validado, referencias financeiras server-side |

Funcoes de `lib/*` sem diretiva `use server` nao foram contadas como actions publicas.
Todas as actions administrativas verificam permissao no servidor antes de acesso
sensivel/mutacao; RLS e regras anteriores permanecem. Nenhuma foi substituida por
Route Handler. Inputs, assinaturas de negocio e destinos de redirect nao mudaram.

## Testes e paginas

Regressoes preservadas: create, payment validation, webhook, reconcile, confirmacao,
polling, idempotencia 2/10/100 concorrentes, refresh/recovery, frete, catalogo,
produtos, cookies/admin, outbox, analytics, sitemap, robots e SEO.

Adicionados nove testes de compatibilidade: sete para paginas/metadata e dois para
cookies assíncronos. Os testes de pagamentos e integracoes usam mocks; live tests
continuam desabilitados.

| Validacao final | Resultado |
| --- | --- |
| npm test | 1081 aprovados, 6 ignorados; 86 arquivos aprovados e 4 ignorados |
| npm run lint | aprovado, sem warnings/erros ESLint; deprecation do comando documentada |
| npx tsc --noEmit --incremental false | aprovado apos ajuste da assercao de metadata |
| npm run build | Next 15.5.28 aprovado fora do OneDrive; 40 paginas estaticas geradas |
| git diff --check | aprovado; avisos locais LF/CRLF nao sao erros de whitespace |

Uma repeticao do build isolado recebeu EPERM ao criar uma pasta de chunks em
`.next`. A mesma execucao, sem mudanca de codigo/configuracao, passou com permissao
de execucao apropriada. O build final usou os mesmos fontes do worktree (incluindo
a ultima assercao de teste corrigida), fora do OneDrive e sem copiar `.env*`.

QA local em `http://127.0.0.1:3000`:
- Home carregou o catalogo database, sem fallback ou excecao server-side.
- Produto `anel-ouro-18k-com-perola`: nome, preco vigente R$ 3.600,00 e canonical
  corretos. Comprar agora adicionou somente a sacola local, sem criar pedido.
- Carrinho: uma unidade, preco/subtotal R$ 3.600,00. Checkout: mesmo item/total,
  entrega e retirada visiveis, confecção separada, nenhum botao de pagamento acionado.
- Confirmacao sem token: mensagem generica segura, sem inventar pedido ou pago.
- `/admin` sem sessao (cliente HTTP) redirecionou para login. No navegador, a
  sessao existente abriu `/admin/produtos`, com titulo Administracao | Marjouxs e
  sem erro de console ou overflow. Nenhuma credencial foi digitada nem action de
  escrita executada. Acesso admin ativo/inativo e cookies tambem cobertos por testes.
- Categoria Prata 950, Anéis/Pérola e busca responderam HTTP 200; sitemap/robots
  tambem responderam 200 (592 URLs no sitemap). Params, searchParams e metadata
  exercitados.
- Desktop 1280 e mobile 390: sem overflow horizontal nas telas conferidas.
- Nao foram observados hydration errors nem excecao runtime nas paginas verificadas.
- A imagem local `anel-teste-01.jpg` ja estava excluida no worktree antes do upgrade;
  o produto usa o fallback de imagem existente. Essa alteracao paralela NAO foi
  revertida nem atribuida ao Next 15.

## npm audit: avisos residuais SEPARADOS do alvo

Relatorio completo salvo fora do repositorio: `checkout-stage5b-audit-20261104/
npm-audit.after.json`. Resultado npm audit: exit 1, **34 pacotes afetados** (nao 34
vulnerabilidades independentes): 24 moderados, 8 altos e 2 criticos. Dos pacotes,
29 sao exclusivos de desenvolvimento e 5 possuem caminho de producao no lockfile.
O texto GHSA-p3m5-59mp-jv5r nao aparece no relatorio. Next ainda figura por uma
dependencia PostCSS, nao pelo advisory-alvo. Nao houve audit fix.

Classificacao abaixo e uma analise de alcance provavel do projeto, nao exploracao
nem garantia de ausencia de vulnerabilidade.

| Pacote | Severidade npm | Escopo | Impacto provavel / bloqueia deploy? |
| --- | --- | --- | --- |
| zod | alta | producao | DoS/memoria em colecoes enormes; schemas publicos sao superficie relevante. **SIM, tratar/revisar antes de liberar producao.** Fora do upgrade Next. |
| nanoid | alta | producao | loop com tamanhos invalidos em APIs especificas; sem uso direto no app. **Condicional**, alcance transitivo deve ser revisado. |
| postcss | alta | producao e dev | CSS/source maps nao confiaveis podem provocar leitura/DoS/XSS; pipeline local usa fontes do repo. **Condicional**, sem prova de caminho publico neste QA. |
| source-map-js | alta | producao | DoS com mapas adversariais; nao foi exposto novo parser de mapas. **Condicional**, revisar alcance transitivo. |
| next (via postcss) | moderada | producao | aviso transitivo anterior; **nao e o GHSA-alvo**, segue a avaliacao de PostCSS. |
| vitest | critica | dev | execucao/leitura via servidor UI ou inputs adversariais; usamos `vitest run`, sem UI publica. Nao bloqueia runtime por si, exige tratamento separado do tooling. |
| tinypool | critica | dev | gadgets de prototype pollution/RCE em opcoes de worker nao confiaveis; nao aceitar suites/opcoes de terceiros. Nao bloqueia runtime por si; tooling separado. |
| vite | alta | dev | servidor dev/launch-editor e paths adversariais; nao expor em rede publica. Nao bloqueia runtime por si. |
| brace-expansion | alta | dev | DoS em padroes adversariais; globbing local de fontes confiaveis. Nao bloqueia runtime por si. |
| browserslist | alta | dev | consultas/stats nao confiaveis podem causar OOM/crash; entradas locais confiaveis. Nao bloqueia runtime por si. |
| js-yaml | alta | dev | consumo de CPU em YAML adversarial; arquivos locais de ferramentas. Nao bloqueia runtime por si. |
| @vitest/mocker | moderada | dev | leitura/injecao por servidor de mocks; sem UI publica. Tooling separado. |
| baseline-browser-mapping | moderada | dev | encerramento por input invalido em tooling; nao e endpoint. Nao bloqueia runtime por si. |
| esbuild | moderada | dev | exposicao de resposta por servidor dev; nao usado como servidor publico. Nao bloqueia runtime por si. |
| minimatch | moderada | dev | DoS por padroes adversariais; glob local. Nao bloqueia runtime por si. |
| postcss-selector-parser | moderada | dev | recursao/complexidade de seletores; CSS local. Nao bloqueia runtime por si. |
| @eslint-community/eslint-utils | moderada | dev | propagacao transitiva da arvore ESLint; nao endpoint. Nao bloqueia runtime por si. |
| @eslint/eslintrc | moderada | dev | transitivo de minimatch; configuracao local. Nao bloqueia runtime por si. |
| @humanwhocodes/config-array | moderada | dev | transitivo de minimatch; configuracao local. Nao bloqueia runtime por si. |
| @typescript-eslint/eslint-plugin | moderada | dev | propagacao transitiva de lint/parser. Nao bloqueia runtime por si. |
| @typescript-eslint/parser | moderada | dev | propagacao transitiva de lint/parser. Nao bloqueia runtime por si. |
| @typescript-eslint/type-utils | moderada | dev | propagacao transitiva de lint/parser. Nao bloqueia runtime por si. |
| @typescript-eslint/typescript-estree | moderada | dev | transitivo de minimatch. Nao bloqueia runtime por si. |
| @typescript-eslint/utils | moderada | dev | propagacao transitiva de lint/parser. Nao bloqueia runtime por si. |
| eslint | moderada | dev | entradas/configuracoes locais confiaveis. Nao bloqueia runtime por si. |
| eslint-config-next | moderada | dev | propagacao transitiva de ESLint, nao advisory-alvo. Nao bloqueia runtime por si. |
| eslint-plugin-import | moderada | dev | propagacao transitiva de ESLint. Nao bloqueia runtime por si. |
| eslint-plugin-jsx-a11y | moderada | dev | propagacao transitiva de ESLint. Nao bloqueia runtime por si. |
| eslint-plugin-react | moderada | dev | propagacao transitiva de ESLint. Nao bloqueia runtime por si. |
| file-entry-cache | moderada | dev | propagacao transitiva em cache de ferramentas. Nao bloqueia runtime por si. |
| flat-cache | moderada | dev | propagacao transitiva em cache de ferramentas. Nao bloqueia runtime por si. |
| glob | moderada | dev | propagacao transitiva de glob/minimatch. Nao bloqueia runtime por si. |
| rimraf | moderada | dev | propagacao transitiva de glob/minimatch. Nao bloqueia runtime por si. |
| vite-node | moderada | dev | propagacao transitiva de Vite. Nao bloqueia runtime por si. |

Referencias especificas para triagem futura:
- Zod: https://github.com/advisories/GHSA-mrhx-c7xc-m3w5
- Nanoid: GHSA-28wg-ghj8-5hjv e GHSA-2v37-7h3g-55p8.
- PostCSS: GHSA-qx2v-qp2m-jg93, GHSA-6g55-p6wh-862q, GHSA-fxqj-rqcc-2cmp e GHSA-r28c-9q8g-f849.
- source-map-js: GHSA-68fv-2mgg-jv7q.
- Vitest: GHSA-5xrq-8626-4rwp; Tinypool: GHSA-5gmw-xhrv-c9v3 e GHSA-85c8-ppgw-ccpr.
O JSON completo conserva os demais IDs/titulos/ranges, inclusive advisories multiplos
por pacote. Nao aplicar as sugestoes automaticas de downgrade/major exibidas pelo npm.

## Node e Netlify

Node local compativel: **SIM**, 24.16.0 atende o engine do Next 15.5.28
(`^18.18.0 || ^19.8.0 || >=20.0.0`) e do plugin Netlify instalado (`>=18.0.0`).
O adaptador existente suporta App Router, Server Actions, Middleware e Next 15;
nao foi reinstalado/alterado.

Fonte primaria: https://docs.netlify.com/build/frameworks/framework-setup-guides/nextjs/overview/

O repositorio nao fixa Node em .nvmrc/.node-version/netlify.toml. A versao efetiva
dos Builds/Functions atualmente publicada na Netlify nao foi consultada/alterada
nesta etapa: **INCONCLUSIVA**. Antes do deploy autorizado, conferir no log/config
que usa uma linha Node mantida e compativel (por exemplo 22/24). Nao e necessario
mudar o Node local; nao se inventou nem aplicou configuracao de hospedagem.

## Arquivos exclusivos desta etapa

- `package.json`, `package-lock.json`, `next-env.d.ts`.
- `lib/supabase/server.ts`, `lib/supabase/server.test.ts` (novo).
- `app/produtos/[slug]/page.tsx`, `app/produtos/page.tsx`.
- `app/categorias/[slug]/page.tsx`, `app/aneis/[material]/[[...tipo]]/page.tsx`.
- `app/acompanhar-pedido/page.tsx`, `app/pedido/confirmacao/page.tsx`.
- `app/api/orders/[token]/route.ts` e `route.test.ts`.
- `app/admin/login/page.tsx`, `app/admin/(protected)/page.tsx`.
- `app/admin/(protected)/produtos/page.tsx`, `produtos/novo/page.tsx`, `produtos/[id]/page.tsx`.
- `app/admin/(protected)/pedidos/page.tsx`, `pedidos/[id]/page.tsx`, `pedidos/pages.test.tsx`.
- `app/admin/(protected)/dashboard-page.test.tsx`.
- `app/next15-compatibility.test.tsx` (novo).
- `docs/nextjs-15-security-upgrade.md` (novo).

Total esperado: 24 arquivos em relacao ao baseline local desta etapa. O diff contra
HEAD tambem inclui mudancas anteriores/paralelas que NAO sao deste upgrade.

## Preservacao

Nenhum preco, catalogo, prazo de confeccao, regra de frete/Pix, payload financeiro,
idempotencia, reconciliacao, webhook, outbox, Supabase schema/RLS/RPC ou env foi
alterado nesta etapa. Apenas a rota de leitura por token recebeu o await de params.
Checkout/admin conservaram os guards e comportamentos existentes. Nenhum pedido,
pagamento ou chamada real a InfinitePay foi criado. Leituras do catalogo publico
no QA nao alteraram dados. Nenhum commit/staging/push/deploy; Netlify intacta.

Conclusao especifica: **ETAPA 5B CONCLUIDA LOCALMENTE**, removido o GHSA-alvo.
O risco residual de Zod e a triagem dos demais advisories permanecem separados;
nao ha aprovacao geral de deploy neste documento.
