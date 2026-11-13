# Auditoria local de dependencias - Etapa 5C

Data: 2026-11-04. Projeto Marjouxs. Sem commit, push ou deploy.

## Resultado e criterio de liberacao

O unico pacote atualizado nesta etapa foi **zod 4.6.2 -> 4.6.6**, patch minimo
corrigido, fixado exatamente. Next 15.5.28, React/React DOM 19.3.1, tipos,
integracoes, schemas comerciais e demais dependencias foram preservados.
Nenhum override foi criado.

Nao foi identificado critico ou alto com caminho de runtime externo alcancavel
remanescente na configuracao e nos fluxos examinados. Isso nao significa
`npm audit` limpo nem garantia de ausencia de vulnerabilidades. Tooling residual
continua exigindo manutencao separada; a classificacao depende dos limites abaixo.

**NETLIFY NODE = 22.x** na configuracao atual de build do projeto correto.
O ultimo build publicado registra **22.23.3 / npm 10.9.9**.
A configuracao e o log foram lidos no painel autenticado, sem acionar build,
deploy ou alterar envs. O runtime futuro padrao de Functions acompanha essa linha,
conforme regra oficial da Netlify e ausencia de override. Nao se afirma ter
executado um novo runtime remoto nem ter observado seu patch interno exato.

## Coletas e comparacao correta

| Momento | Criticos | Altos | Moderados | Baixos | Pacotes afetados |
| --- | --- | --- | --- | --- | --- |
| Relatorio historico da Etapa 5B | 2 | 8 | 24 | 0 | 34 |
| Audit inicial 5C, ANTES de qualquer alteracao | 2 | 8 | 12 | 0 | 22 |
| Audit final 5C, APOS patch Zod | 2 | 7 | 12 | 0 | 21 |

Os totais do npm contam **pacotes afetados**, incluindo propagacao em ancestrais;
nao representam 34 CVEs independentes. A uniao dos relatorios contem 38 GHSAs,
39 combinacoes GHSA/pacote (um advisory envolve dois pacotes).

A queda inicial de 34 para 22 NAO foi causada pelo upgrade:
o mesmo GHSA-g3hv-75wg-m249 de minimatch mudou na registry de `<11.0.1`
para `>=7.0.0 <11.0.1`. Assim minimatch 3.1.5 e 12 ancestrais da arvore
ESLint deixaram de constar. Minimatch 10.2.5 continua afetado.
O relatorio historico foi preservado, nao reescrito.

A unica reducao atribuida ao codigo/dependencia desta etapa e Zod:
22 -> 21 pacotes; altos 8 -> 7. Criticos/moderados permaneceram visiveis.
`npm audit` inicial/final retornou exit 1 pelos avisos residuais.
O advisory GHSA-p3m5-59mp-jv5r continua ausente.

Artefatos completos, fora do repositorio:
`C:/Users/ravya/.codex/visualizations/2026/06/02/019e85ba-f5c3-78d0-807c-95c2876e6fb0/dependency-security-stage5c-20261104/`

- `npm-audit.before.json`, `npm-audit.after.json`.
- `package.before.json`, `package-lock.before.json`.
- `dependency-tree.before.json`, `inventory.json`.
- `github-advisories.json`: 38 consultas publicas oficiais ao GitHub, sem credenciais.
- `source-before.json`: manifesto local para conferir preservacao do worktree.
- Logs de testes, lint, TypeScript e build. Nenhum .env foi copiado para os artefatos de build.

## Metodo de classificacao

- **A**: runtime de producao alcancavel por input controlado por usuario.
- **B**: build-time/lint/CSS somente, com fontes do repositorio.
- **C**: dev/test somente.
- **D**: transitivo cujo caminho vulneravel nao e alcancavel no uso identificado.
- **E**: indeterminado; deve bloquear conclusoes que dependam dessa prova.

Classificacoes sao por uso neste projeto, nao apenas pelo flag dev do lockfile.
Estar em dependencies de Next nao prova que o parser seja executado por uma
requisicao de cliente. Tambem nao se usou ausencia em .nft.json como prova unica:
Webpack pode incorporar codigo nos chunks (Zod, por exemplo).

Evidencias:
- Busca de imports no app/lib/components/scripts; ferramentas aparecem em testes
  e configuracoes, nao em handlers comerciais.
- package-lock e grafo de resolucao fisica, com caminhos completos abaixo.
- `npm test` executa `vitest run`, nao servidor UI. vitest.config usa environment
  node e forks locais; nenhuma API permite fornecer opcoes de worker ao Vitest.
- Inspecao de 223 JS gerados pelo build: marcadores de Zod em 4 arquivos e zero
  para os marcadores pesquisados de Vitest, Tinypool e imports Vite.
- As 59 listas de tracing examinadas no build anterior tambem nao listaram os
  modulos de teste. Tracing e busca textual corroboram o grafo; isoladamente nao
  sao uma demonstracao matematica de ausencia de todo codigo.
- Nao ha endpoint para compilar CSS, source maps, YAML ou globs enviados por clientes.
  CSS/PostCSS/Tailwind sao entradas do repositorio. Conteudo comercial nao vira CSS.
- Builds/PRs devem continuar tratados como execucao de codigo confiavel:
  nao expor UI/dev servers e nao aprovar fontes/fixtures/worker options adversariais.

Se futuramente houver compilacao de CSS/mapas/YAML de terceiros, exposicao de
Vitest/Vite UI ou testes nao confiaveis em ambiente com secrets, reclassificar
B/C/D e corrigir antes dessa mudanca. Dev-only nao e isento de risco.

## Zod: exposicao e correcao minima

- Direta, producao, instalada 4.6.2; corrigida minima oficial **4.6.6**, sem major.
- GHSA-mrhx-c7xc-m3w5 / CVE-2023-54404, alta, faixa `<4.6.6`.
- Servidor: checkout/schemas, cart validate, shipping quote, create checkout,
  webhook, orders lookup/token, checkout intent, login/admin actions, validacao
  administrativa, OAuth e respostas de provedores.
- Cliente: armazenamento/normalizacao da sacola usa schemas compartilhados;
  confirmacao/polling e formularios administrativos tambem importam helpers Zod.
  Validacao no cliente nao substitui validacao server-side.
- Input externo: JSON do checkout/carrinho/frete, referencias de pedido, FormData
  administrativo e respostas de integracao. Portanto classe A antes da correcao.
- Existem limites comerciais de 50 linhas, 10 unidades, strings e gravacao;
  nao foram removidos nem tomados como substituto do patch da biblioteca.
- Alterados apenas package.json e o registro Zod no lockfile, alem da referencia
  raiz desse lockfile. Instalacao mudou **1 pacote**, com `--ignore-scripts
  --no-audit --no-fund`. Nenhum script de instalacao foi executado.
- Nao houve npm update, audit fix, force, major de Zod ou override.
- 138 testes direcionados passaram apos a troca. Suite completa passou sem
  mudar testes/schemas para acomodar comportamento incorreto.
- Nao foi executado exploit de exaustao, carga de DoS ou request financeiro real.

Fonte: [advisory e correcao minima](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5).

## Criticos e altos: caminho plausivel, tratamento e risco residual

| Pacote | Escopo / classe | Caminho de exploracao necessario | Evidencia e decisao |
| --- | --- | --- | --- |
| vitest 2.1.9, critica | dev / C | UI server acessivel com arquivo/execucao controlados pelo atacante | npm script run, nao UI; nao importado por handlers; marcadores ausentes no build. Atualizacao de tooling separada, nao runtime publico. |
| tinypool 1.1.1, critica | dev transitiva de Vitest / C | prototype pollution/opcoes de workers ou run controlados externamente | Somente forks de testes locais; checkout nao fornece worker options. Nao entra no fluxo de request publico; os dois GHSAs estao detalhados abaixo. |
| zod 4.6.2, alta | prod direta / A | colecoes adversariais nos parsers publicos | Atualizado para 4.6.6. Aviso removido no audit final. |
| postcss 8.4.31 e 8.5.15, alta | prod transitiva Next + dev / B | CSS/sourceMappingURL adversarial compilado ou CSS serializado sem a protecao adequada | Pipeline usa CSS do repositorio, sem compilador CSS publico. Patch do pai sugerido pelo audit e Next 16 (major), fora do recorte. Next fixa PostCSS 8.4.31; nenhum override sem contrato comprovado. Manter residual de build documentado. |
| source-map-js 1.2.1, alta | prod transitiva PostCSS + dev / B | source maps indexados adversariais processados | Consumido por PostCSS durante build; clientes nao fornecem source maps. Nao atualizar transitiva isolada sem necessidade de runtime. |
| nanoid 3.3.12, alta | prod transitiva PostCSS + dev / D | tamanho negativo/zero em geradores especificos | Nos dois PostCSS instalados, o unico consumo identificado e nanoid/non-secure com tamanho literal 6. Sem tamanho externo, custom generator ou import comercial direto. |
| brace-expansion 1.1.14 / 5.0.6, alta | dev, ESLint/minimatch / B | glob/braces adversariais | Analise de fontes/configuracoes locais, sem endpoint de glob. Corrigir em manutencao de lint; sem update amplo nesta etapa. |
| browserslist 4.28.2, alta | dev via Autoprefixer / B | queries/stats dinamicos nao confiaveis | Inputs locais de build; sem stats/queries de cliente. Nao confundir aviso de caniuse antigo com o advisory propriamente dito. |
| js-yaml 4.1.1, alta | dev via ESLint / B | YAML adversarial com aliases/merge/omap | Configuracoes locais, nenhum parser YAML publico. Residual de tooling/build. |
| vite 5.4.21, alta | dev via Vitest / C | servidor Vite/editor com paths/opcoes adversariais | Next dev e o servidor da aplicacao, nao Vite. Vitest run nao expoe a UI/API de editor. Sem caminho de request no ecommerce. |

Ha **2 pacotes criticos**, mas 3 GHSAs criticos (um de Vitest e dois de Tinypool).
Os 8 pacotes altos iniciais foram analisados acima; apos Zod restam 7, sem
caminho de runtime externo demonstrado no uso atual. Nao foram simplesmente
descartados por serem transitivos. Nao se expoem ferramentas para reproduzir RCE.

## Inventario dos 34 pacotes, incluindo os 12 historicos

| Pacote / versoes iniciais | Severidade npm | Direta? | Escopo instalado | Classe | Audit inicial / final | Propagado por |
| --- | --- | --- | --- | --- | --- | --- |
| @eslint-community/eslint-utils: 4.9.1 | moderate | nao | dev-only | B | historico apenas / nao | eslint |
| @eslint/eslintrc: 2.1.4 | moderate | nao | dev-only | B | historico apenas / nao | minimatch |
| @humanwhocodes/config-array: 0.13.0 | moderate | nao | dev-only | B | historico apenas / nao | minimatch |
| @typescript-eslint/eslint-plugin: 8.59.4 | moderate | nao | dev-only | B | sim / sim | @typescript-eslint/parser, @typescript-eslint/type-utils, @typescript-eslint/utils |
| @typescript-eslint/parser: 8.59.4 | moderate | nao | dev-only | B | sim / sim | @typescript-eslint/typescript-estree |
| @typescript-eslint/type-utils: 8.59.4 | moderate | nao | dev-only | B | sim / sim | @typescript-eslint/typescript-estree, @typescript-eslint/utils |
| @typescript-eslint/typescript-estree: 8.59.4 | moderate | nao | dev-only | B | sim / sim | minimatch |
| @typescript-eslint/utils: 8.59.4 | moderate | nao | dev-only | B | sim / sim | @typescript-eslint/typescript-estree |
| @vitest/mocker: 2.1.9 | moderate | nao | dev-only | C | sim / sim | vite |
| baseline-browser-mapping: 2.10.32 | moderate | nao | dev-only | B | sim / sim | advisory proprio |
| brace-expansion: 5.0.6, 1.1.14 | high | nao | dev-only | B | sim / sim | advisory proprio |
| browserslist: 4.28.2 | high | nao | dev-only | B | sim / sim | advisory proprio |
| esbuild: 0.21.5 | moderate | nao | dev-only | C | sim / sim | advisory proprio |
| eslint: 8.57.1 | moderate | sim | dev-only | B | historico apenas / nao | @eslint-community/eslint-utils, @eslint/eslintrc, @humanwhocodes/config-array, file-entry-cache, minimatch |
| eslint-config-next: 15.5.28 | moderate | sim | dev-only | B | historico apenas / nao | @typescript-eslint/eslint-plugin, @typescript-eslint/parser, eslint, eslint-plugin-import, eslint-plugin-jsx-a11y, eslint-plugin-react |
| eslint-plugin-import: 2.32.0 | moderate | nao | dev-only | B | historico apenas / nao | minimatch |
| eslint-plugin-jsx-a11y: 6.10.2 | moderate | nao | dev-only | B | historico apenas / nao | minimatch |
| eslint-plugin-react: 7.37.5 | moderate | nao | dev-only | B | historico apenas / nao | minimatch |
| file-entry-cache: 6.0.1 | moderate | nao | dev-only | B | historico apenas / nao | flat-cache |
| flat-cache: 3.2.0 | moderate | nao | dev-only | B | historico apenas / nao | rimraf |
| glob: 7.2.3 | moderate | nao | dev-only | B | historico apenas / nao | minimatch |
| js-yaml: 4.1.1 | high | nao | dev-only | B | sim / sim | advisory proprio |
| minimatch: 10.2.5, 3.1.5 | moderate | nao | dev-only | B | sim / sim | advisory proprio |
| nanoid: 3.3.12 | high | nao | prod | D | sim / sim | advisory proprio |
| next: 15.5.28 | moderate | sim | prod | B | sim / sim | postcss |
| postcss: 8.4.31, 8.5.15 | high | sim | prod + dev | B | sim / sim | advisory proprio |
| postcss-selector-parser: 6.1.2 | moderate | nao | dev-only | B | sim / sim | advisory proprio |
| rimraf: 3.0.2 | moderate | nao | dev-only | B | historico apenas / nao | glob |
| source-map-js: 1.2.1 | high | nao | prod | B | sim / sim | advisory proprio |
| tinypool: 1.1.1 | critical | nao | dev-only | C | sim / sim | advisory proprio |
| vite: 5.4.21 | high | nao | dev-only | C | sim / sim | esbuild |
| vite-node: 2.1.9 | moderate | nao | dev-only | C | sim / sim | vite |
| vitest: 2.1.9 | critical | sim | dev-only | C | sim / sim | @vitest/mocker, tinypool, vite, vite-node |
| zod: 4.6.2 | high | sim | prod | A | sim / nao | advisory proprio |

"Historico apenas" significa que o pacote permanece instalado, mas a registry
atual nao o acusa, devido ao estreitamento da faixa de minimatch. Nao significa
que foi removido do projeto ou atualizado por esta etapa.
Classe de Zod registra a exposicao inicial A; a versao final ja esta corrigida.

## Todos os advisories, CVEs, ranges e primeiras versoes corrigidas

Cada linha e uma combinacao GHSA/pacote, nao uma contagem de ancestrais npm.
As faixas/patches sao os ramos oficiais que atingem as versoes instaladas na base.
Versoes corrigidas sao informativas: nao foram instaladas automaticamente.
As linhas de alto/critico herdam a analise de alcance da secao anterior.
Moderados foram classificados por uso: build/dev ou propagacao transitiva;
nenhum moderado remanescente apresentou caminho publico plausivel que justificasse
upgrade de tooling neste recorte.

| Pacote | GHSA / CVE | Severidade | Instalado antes | Faixa afetada (ramo instalado) | Primeira correcao por ramo | Classe | Residual |
| --- | --- | --- | --- | --- | --- | --- | --- |
| @vitest/mocker | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) / CVE-2026-84373 | moderate | 2.1.9 | nao afeta versao instalada na base oficial atual | N/A | C | sim |
| @vitest/mocker | [GHSA-qxg6-89mg-rqv8](https://github.com/advisories/GHSA-qxg6-89mg-rqv8) / CVE-2026-112949 | moderate | 2.1.9 | nao afeta versao instalada na base oficial atual | N/A | C | sim |
| baseline-browser-mapping | [GHSA-w5vr-8v7q-w6rv](https://github.com/advisories/GHSA-w5vr-8v7q-w6rv) / CVE-2026-45819 | moderate | 2.10.32 | nao afeta versao instalada na base oficial atual | N/A | B | sim |
| brace-expansion | [GHSA-3jxr-9vmj-r5cp](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp) / CVE-2026-13149 | high | 5.0.6, 1.1.14 | < 1.1.16 | 1.1.16 | B | sim |
| brace-expansion | [GHSA-mh99-v99m-4gvg](https://github.com/advisories/GHSA-mh99-v99m-4gvg) / CVE-2026-14257 | high | 5.0.6, 1.1.14 | < 1.1.17 | 1.1.17 | B | sim |
| brace-expansion | [GHSA-rgw5-rvv9-x895](https://github.com/advisories/GHSA-rgw5-rvv9-x895) / CVE-2026-69152 | high | 5.0.6, 1.1.14 | < 1.1.18 | 1.1.18 | B | sim |
| brace-expansion | [GHSA-q2hr-2g5m-vwhr](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr) / CVE-2026-102277 | moderate | 5.0.6, 1.1.14 | < 1.1.21 | 1.1.21 | B | sim |
| brace-expansion | [GHSA-qhr7-859c-m2p7](https://github.com/advisories/GHSA-qhr7-859c-m2p7) / CVE-2026-102278 | high | 5.0.6, 1.1.14 | < 1.1.20 | 1.1.20 | B | sim |
| brace-expansion | [GHSA-6j4f-fj2g-mc7p](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p) / CVE-2026-102276 | high | 5.0.6, 1.1.14 | < 1.1.19 | 1.1.19 | B | sim |
| browserslist | [GHSA-c83g-rgw3-j3cx](https://github.com/advisories/GHSA-c83g-rgw3-j3cx) / CVE-2026-73089 | high | 4.28.2 | <= 4.28.6 | 4.28.7 | B | sim |
| browserslist | [GHSA-73wf-gq98-2v4g](https://github.com/advisories/GHSA-73wf-gq98-2v4g) / CVE-2026-73088 | high | 4.28.2 | <= 4.28.6 | 4.28.7 | B | sim |
| esbuild | [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99) | moderate | 0.21.5 | <= 0.24.2 | 0.25.0 | C | sim |
| js-yaml | [GHSA-h67p-54hq-rp68](https://github.com/advisories/GHSA-h67p-54hq-rp68) / CVE-2026-53550 | moderate | 4.1.1 | nao afeta versao instalada na base oficial atual | N/A | B | sim |
| js-yaml | [GHSA-52cp-r559-cp3m](https://github.com/advisories/GHSA-52cp-r559-cp3m) / CVE-2026-59869 | high | 4.1.1 | nao afeta versao instalada na base oficial atual | N/A | B | sim |
| js-yaml | [GHSA-5p4m-2wfm-xmqj](https://github.com/advisories/GHSA-5p4m-2wfm-xmqj) | high | 4.1.1 | nao afeta versao instalada na base oficial atual | N/A | B | sim |
| js-yaml | [GHSA-2883-xcg3-v3hh](https://github.com/advisories/GHSA-2883-xcg3-v3hh) / CVE-2026-84375 | high | 4.1.1 | nao afeta versao instalada na base oficial atual | N/A | B | sim |
| minimatch | [GHSA-g3hv-75wg-m249](https://github.com/advisories/GHSA-g3hv-75wg-m249) / CVE-2026-118764 | moderate | 10.2.5, 3.1.5 | nao afeta versao instalada na base oficial atual | N/A | B | sim |
| nanoid | [GHSA-28wg-ghj8-5hjv](https://github.com/advisories/GHSA-28wg-ghj8-5hjv) / CVE-2026-67214 | high | 3.3.12 | < 3.3.16 | 3.3.16 | D | sim |
| nanoid | [GHSA-2v37-7h3g-55p8](https://github.com/advisories/GHSA-2v37-7h3g-55p8) / CVE-2026-67213 | high | 3.3.12 | < 3.3.18 | 3.3.18 | D | sim |
| postcss | [GHSA-qx2v-qp2m-jg93](https://github.com/advisories/GHSA-qx2v-qp2m-jg93) / CVE-2026-41305 | moderate | 8.4.31, 8.5.15 | < 8.5.10 | 8.5.10 | B | sim |
| postcss | [GHSA-6g55-p6wh-862q](https://github.com/advisories/GHSA-6g55-p6wh-862q) / CVE-2026-45623 | high | 8.4.31, 8.5.15 | <= 8.5.11 | 8.5.12 | B | sim |
| postcss | [GHSA-fxqj-rqcc-2cmp](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp) / CVE-2026-69153 | moderate | 8.4.31, 8.5.15 | <= 8.5.22 | 8.5.23 | B | sim |
| postcss | [GHSA-r28c-9q8g-f849](https://github.com/advisories/GHSA-r28c-9q8g-f849) / CVE-2026-73646 | high | 8.4.31, 8.5.15 | <= 8.5.17 | 8.5.18 | B | sim |
| postcss-selector-parser | [GHSA-w9m9-85wc-3x92](https://github.com/advisories/GHSA-w9m9-85wc-3x92) / CVE-2026-9358 | low | 6.1.2 | nao afeta versao instalada na base oficial atual | N/A | B | sim |
| postcss-selector-parser | [GHSA-rj75-hqrm-r3gf](https://github.com/advisories/GHSA-rj75-hqrm-r3gf) / CVE-2026-104844 | moderate | 6.1.2 | < 6.1.5 | 6.1.5 | B | sim |
| source-map-js | [GHSA-68fv-2mgg-jv7q](https://github.com/advisories/GHSA-68fv-2mgg-jv7q) / CVE-2026-93749 | high | 1.2.1 | nao afeta versao instalada na base oficial atual | N/A | B | sim |
| tinypool | [GHSA-5gmw-xhrv-c9v3](https://github.com/advisories/GHSA-5gmw-xhrv-c9v3) / CVE-2026-104848 | critical | 1.1.1 | <= 2.1.0 | 2.1.1 | C | sim |
| tinypool | [GHSA-85c8-ppgw-ccpr](https://github.com/advisories/GHSA-85c8-ppgw-ccpr) / CVE-2026-104849 | critical | 1.1.1 | < 2.1.2 | 2.1.2 | C | sim |
| vite | [GHSA-4w7w-66w2-5vf9](https://github.com/advisories/GHSA-4w7w-66w2-5vf9) / CVE-2026-39365 | moderate | 5.4.21 | <= 6.4.1 | 6.4.2 | C | sim |
| vite | [GHSA-v6wh-96g9-6wx3](https://github.com/advisories/GHSA-v6wh-96g9-6wx3) / CVE-2026-53632 | moderate | 5.4.21 | <= 6.4.2 | 6.4.3 | C | sim |
| vite | [GHSA-698v-4r3x-3vcv](https://github.com/advisories/GHSA-698v-4r3x-3vcv) / CVE-2026-112943 | moderate | 5.4.21 | <= 6.4.3 | 6.4.4 | C | sim |
| vite | [GHSA-r825-w8mm-5pxw](https://github.com/advisories/GHSA-r825-w8mm-5pxw) / CVE-2026-112944 | moderate | 5.4.21 | <= 6.4.3 | 6.4.4 | C | sim |
| vite | [GHSA-587h-7wmj-h5pm](https://github.com/advisories/GHSA-587h-7wmj-h5pm) / CVE-2026-112942 | high | 5.4.21 | <= 6.4.3 | 6.4.4 | C | sim |
| vite | [GHSA-9jrq-w75r-8gcw](https://github.com/advisories/GHSA-9jrq-w75r-8gcw) / CVE-2026-112945 | low | 5.4.21 | <= 6.4.3 | 6.4.4 | C | sim |
| vite | [GHSA-rq7h-c2jc-7f22](https://github.com/advisories/GHSA-rq7h-c2jc-7f22) / CVE-2026-112946 | moderate | 5.4.21 | <= 6.4.3 | 6.4.4 | C | sim |
| vite | [GHSA-fx2h-pf6j-xcff](https://github.com/advisories/GHSA-fx2h-pf6j-xcff) / CVE-2026-53571 | moderate | 5.4.21 | <= 6.4.2 | 6.4.3 | C | sim |
| vitest | [GHSA-5xrq-8626-4rwp](https://github.com/advisories/GHSA-5xrq-8626-4rwp) / CVE-2026-47429 | critical | 2.1.9 | < 3.2.6 | 3.2.6 | C | sim |
| vitest | [GHSA-82fw-gwwq-j7x9](https://github.com/advisories/GHSA-82fw-gwwq-j7x9) / CVE-2026-84373 | moderate | 2.1.9 | nao afeta versao instalada na base oficial atual | N/A | C | sim |
| zod | [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) / CVE-2023-54404 | high | 4.6.2 | < 4.6.6 | 4.6.6 | A | nao |

O JSON oficial preserva outros ramos nao instalados e todas as referencias.
Na base npm severity "moderate" corresponde a "medium" em algumas linhas do GitHub;
os totais acima usam sempre a classificacao npm capturada.

## Caminhos completos de dependencia

Um caminho completo minimo por dependencia direta introdutora e por instalacao
fisica; podem existir outros caminhos equivalentes devido a hoisting/peers.
As entradas dev/prod abaixo referem-se a raiz que introduz o caminho, nao
confundem uma dependencia compartilhada de build com um handler de runtime.

### @eslint-community/eslint-utils

- Instalacao: `node_modules/@eslint-community/eslint-utils` (4.9.1, dev).
  - dev: `marjouxs-ecommerce -> eslint@8.57.1 -> @eslint-community/eslint-utils@4.9.1`
  - dev: `marjouxs-ecommerce -> eslint-config-next@15.5.28 -> @typescript-eslint/eslint-plugin@8.59.4 -> @typescript-eslint/utils@8.59.4 -> @eslint-community/eslint-utils@4.9.1`

### @eslint/eslintrc

- Instalacao: `node_modules/@eslint/eslintrc` (2.1.4, dev).
  - dev: `marjouxs-ecommerce -> eslint@8.57.1 -> @eslint/eslintrc@2.1.4`

### @humanwhocodes/config-array

- Instalacao: `node_modules/@humanwhocodes/config-array` (0.13.0, dev).
  - dev: `marjouxs-ecommerce -> eslint@8.57.1 -> @humanwhocodes/config-array@0.13.0`

### @typescript-eslint/eslint-plugin

- Instalacao: `node_modules/@typescript-eslint/eslint-plugin` (8.59.4, dev).
  - dev: `marjouxs-ecommerce -> eslint-config-next@15.5.28 -> @typescript-eslint/eslint-plugin@8.59.4`

### @typescript-eslint/parser

- Instalacao: `node_modules/@typescript-eslint/parser` (8.59.4, dev).
  - dev: `marjouxs-ecommerce -> eslint-config-next@15.5.28 -> @typescript-eslint/parser@8.59.4`

### @typescript-eslint/type-utils

- Instalacao: `node_modules/@typescript-eslint/type-utils` (8.59.4, dev).
  - dev: `marjouxs-ecommerce -> eslint-config-next@15.5.28 -> @typescript-eslint/eslint-plugin@8.59.4 -> @typescript-eslint/type-utils@8.59.4`

### @typescript-eslint/typescript-estree

- Instalacao: `node_modules/@typescript-eslint/typescript-estree` (8.59.4, dev).
  - dev: `marjouxs-ecommerce -> eslint-config-next@15.5.28 -> @typescript-eslint/parser@8.59.4 -> @typescript-eslint/typescript-estree@8.59.4`

### @typescript-eslint/utils

- Instalacao: `node_modules/@typescript-eslint/utils` (8.59.4, dev).
  - dev: `marjouxs-ecommerce -> eslint-config-next@15.5.28 -> @typescript-eslint/eslint-plugin@8.59.4 -> @typescript-eslint/utils@8.59.4`

### @vitest/mocker

- Instalacao: `node_modules/@vitest/mocker` (2.1.9, dev).
  - dev: `marjouxs-ecommerce -> vitest@2.1.9 -> @vitest/mocker@2.1.9`

### baseline-browser-mapping

- Instalacao: `node_modules/baseline-browser-mapping` (2.10.32, dev).
  - dev: `marjouxs-ecommerce -> autoprefixer@10.5.0 -> browserslist@4.28.2 -> baseline-browser-mapping@2.10.32`

### brace-expansion

- Instalacao: `node_modules/@typescript-eslint/typescript-estree/node_modules/brace-expansion` (5.0.6, dev).
  - dev: `marjouxs-ecommerce -> eslint-config-next@15.5.28 -> @typescript-eslint/parser@8.59.4 -> @typescript-eslint/typescript-estree@8.59.4 -> minimatch@10.2.5 -> brace-expansion@5.0.6`
- Instalacao: `node_modules/brace-expansion` (1.1.14, dev).
  - dev: `marjouxs-ecommerce -> eslint@8.57.1 -> minimatch@3.1.5 -> brace-expansion@1.1.14`
  - dev: `marjouxs-ecommerce -> eslint-config-next@15.5.28 -> eslint-plugin-import@2.32.0 -> minimatch@3.1.5 -> brace-expansion@1.1.14`

### browserslist

- Instalacao: `node_modules/browserslist` (4.28.2, dev).
  - dev: `marjouxs-ecommerce -> autoprefixer@10.5.0 -> browserslist@4.28.2`

### esbuild

- Instalacao: `node_modules/esbuild` (0.21.5, dev).
  - dev: `marjouxs-ecommerce -> vitest@2.1.9 -> vite@5.4.21 -> esbuild@0.21.5`

### eslint

- Instalacao: `node_modules/eslint` (8.57.1, dev).
  - dev: `marjouxs-ecommerce -> eslint@8.57.1`

### eslint-config-next

- Instalacao: `node_modules/eslint-config-next` (15.5.28, dev).
  - dev: `marjouxs-ecommerce -> eslint-config-next@15.5.28`

### eslint-plugin-import

- Instalacao: `node_modules/eslint-plugin-import` (2.32.0, dev).
  - dev: `marjouxs-ecommerce -> eslint-config-next@15.5.28 -> eslint-plugin-import@2.32.0`

### eslint-plugin-jsx-a11y

- Instalacao: `node_modules/eslint-plugin-jsx-a11y` (6.10.2, dev).
  - dev: `marjouxs-ecommerce -> eslint-config-next@15.5.28 -> eslint-plugin-jsx-a11y@6.10.2`

### eslint-plugin-react

- Instalacao: `node_modules/eslint-plugin-react` (7.37.5, dev).
  - dev: `marjouxs-ecommerce -> eslint-config-next@15.5.28 -> eslint-plugin-react@7.37.5`

### file-entry-cache

- Instalacao: `node_modules/file-entry-cache` (6.0.1, dev).
  - dev: `marjouxs-ecommerce -> eslint@8.57.1 -> file-entry-cache@6.0.1`

### flat-cache

- Instalacao: `node_modules/flat-cache` (3.2.0, dev).
  - dev: `marjouxs-ecommerce -> eslint@8.57.1 -> file-entry-cache@6.0.1 -> flat-cache@3.2.0`

### glob

- Instalacao: `node_modules/rimraf/node_modules/glob` (7.2.3, dev).
  - dev: `marjouxs-ecommerce -> eslint@8.57.1 -> file-entry-cache@6.0.1 -> flat-cache@3.2.0 -> rimraf@3.0.2 -> glob@7.2.3`

### js-yaml

- Instalacao: `node_modules/js-yaml` (4.1.1, dev).
  - dev: `marjouxs-ecommerce -> eslint@8.57.1 -> js-yaml@4.1.1`

### minimatch

- Instalacao: `node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch` (10.2.5, dev).
  - dev: `marjouxs-ecommerce -> eslint-config-next@15.5.28 -> @typescript-eslint/parser@8.59.4 -> @typescript-eslint/typescript-estree@8.59.4 -> minimatch@10.2.5`
- Instalacao: `node_modules/minimatch` (3.1.5, dev).
  - dev: `marjouxs-ecommerce -> eslint@8.57.1 -> minimatch@3.1.5`
  - dev: `marjouxs-ecommerce -> eslint-config-next@15.5.28 -> eslint-plugin-import@2.32.0 -> minimatch@3.1.5`

### nanoid

- Instalacao: `node_modules/nanoid` (3.3.12, prod).
  - prod: `marjouxs-ecommerce -> next@15.5.28 -> postcss@8.4.31 -> nanoid@3.3.12`
  - dev: `marjouxs-ecommerce -> postcss@8.5.15 -> nanoid@3.3.12`
  - dev: `marjouxs-ecommerce -> tailwindcss@3.4.19 -> postcss@8.5.15 -> nanoid@3.3.12`
  - dev: `marjouxs-ecommerce -> vitest@2.1.9 -> vite@5.4.21 -> postcss@8.5.15 -> nanoid@3.3.12`

### next

- Instalacao: `node_modules/next` (15.5.28, prod).
  - prod: `marjouxs-ecommerce -> next@15.5.28`

### postcss

- Instalacao: `node_modules/next/node_modules/postcss` (8.4.31, prod).
  - prod: `marjouxs-ecommerce -> next@15.5.28 -> postcss@8.4.31`
- Instalacao: `node_modules/postcss` (8.5.15, dev).
  - dev: `marjouxs-ecommerce -> postcss@8.5.15`
  - dev: `marjouxs-ecommerce -> tailwindcss@3.4.19 -> postcss@8.5.15`
  - dev: `marjouxs-ecommerce -> vitest@2.1.9 -> vite@5.4.21 -> postcss@8.5.15`

### postcss-selector-parser

- Instalacao: `node_modules/postcss-selector-parser` (6.1.2, dev).
  - dev: `marjouxs-ecommerce -> tailwindcss@3.4.19 -> postcss-selector-parser@6.1.2`

### rimraf

- Instalacao: `node_modules/rimraf` (3.0.2, dev).
  - dev: `marjouxs-ecommerce -> eslint@8.57.1 -> file-entry-cache@6.0.1 -> flat-cache@3.2.0 -> rimraf@3.0.2`

### source-map-js

- Instalacao: `node_modules/source-map-js` (1.2.1, prod).
  - prod: `marjouxs-ecommerce -> next@15.5.28 -> postcss@8.4.31 -> source-map-js@1.2.1`
  - dev: `marjouxs-ecommerce -> postcss@8.5.15 -> source-map-js@1.2.1`
  - dev: `marjouxs-ecommerce -> tailwindcss@3.4.19 -> postcss@8.5.15 -> source-map-js@1.2.1`
  - dev: `marjouxs-ecommerce -> vitest@2.1.9 -> vite@5.4.21 -> postcss@8.5.15 -> source-map-js@1.2.1`

### tinypool

- Instalacao: `node_modules/tinypool` (1.1.1, dev).
  - dev: `marjouxs-ecommerce -> vitest@2.1.9 -> tinypool@1.1.1`

### vite

- Instalacao: `node_modules/vite` (5.4.21, dev).
  - dev: `marjouxs-ecommerce -> vitest@2.1.9 -> vite@5.4.21`

### vite-node

- Instalacao: `node_modules/vite-node` (2.1.9, dev).
  - dev: `marjouxs-ecommerce -> vitest@2.1.9 -> vite-node@2.1.9`

### vitest

- Instalacao: `node_modules/vitest` (2.1.9, dev).
  - dev: `marjouxs-ecommerce -> vitest@2.1.9`

### zod

- Instalacao: `node_modules/zod` (4.6.2, prod).
  - prod: `marjouxs-ecommerce -> zod@4.6.2`

## Node da Netlify e compatibilidade Next 15

Somente leitura no projeto `marjouxs-joias`, vinculado ao repositorio Marjouxs:

1. Project configuration > Developer settings > Dependency management:
   **Node.js 22.x**.
2. Busca por `NODE_VERSION` nas envs, Any scope / Any context: nenhum resultado.
3. Busca por `AWS_LAMBDA_JS_RUNTIME`: nenhum resultado.
4. Log Initializing do ultimo deploy publicado (2026-10-16):
   "Now using node v22.23.3 (npm v10.9.9)".
5. Repositorio sem .nvmrc/.node-version/engines Node, sem override em netlify.toml.
   Base directory /; build npm run build. Plugin existente preservado.
6. Netlify documenta que Functions usa por padrao a linha Node do build quando
   suportada por Lambda e nao proxima da descontinuacao. Node 22 continua suportado;
   a AWS projeta sua descontinuacao para 2027-04-30, alem da janela de dois meses.
7. Assim, com a configuracao atual, o proximo build usa **22.x** e o runtime
   padrao futuro acompanha **nodejs22.x**. O patch exato e escolhido pela
   plataforma; o patch interno da funcao ja publicada nao foi exposto na tela.
   Essa deducao usa configuracao remota real + regra oficial, NAO o Node local.
8. Node local **24.16.0**, npm **11.13.0**, inalterados.
   Next 15.5.28 engine: `^18.18.0 || ^19.8.0 || >=20.0.0`.
   Tanto 22.x quanto 24.16.0 sao compativeis. Nenhuma mudanca futura de Node e
   necessaria para este upgrade com a configuracao observada.
   A arvore de producao tambem nao apresentou incompatibilidade de engine para
   Linux x64/arm64 com Node 22.23.3, nem Windows x64 com Node 24.16.0.
   A entrada opcional sharp-win32-ia32 exige Node 20, mas e especifica de Windows
   32 bits e nao se aplica ao host local x64 nem a Netlify Linux. Nao foi alterada.
   A suite/build foram executados no Node local 24, nao em uma VM remota Node 22.
9. Nao foi feito novo build/deploy na Netlify para provar outro patch remoto.
   Revalidar configuracao e suporte de runtime se o deploy ocorrer muito depois
   desta auditoria ou houver alteracao de overrides/configuracao.

Fontes:
- [precedencia de versoes de build](https://docs.netlify.com/build/configure-builds/manage-dependencies/).
- [runtime padrao de Functions](https://docs.netlify.com/build/functions/configuration/).
- [Node 22 suportado no Lambda](https://docs.aws.amazon.com/lambda/latest/dg/lambda-runtimes.html).

## Regressao e validacoes finais

| Validacao | Resultado |
| --- | --- |
| Testes direcionados apos Zod | 138 passaram, 8 arquivos |
| npm test | 1081 passaram, 6 live ignorados, 90 arquivos (86 aprovados / 4 ignorados) |
| npm run lint | aprovado, sem erro/warning ESLint |
| npx tsc --noEmit --incremental false | aprovado |
| npm run build | aprovado, copia isolada fora do OneDrive; Next 15.5.28; 40 paginas estaticas |
| git diff --check | aprovado |

Cobertura de regressao preservada, usando mocks/fixtures sem efeitos remotos:
catalogo static/database, sacola, pares de aliancas/personalizacao/Unicode,
precificacao autoritativa, frete e CEP, checkout, payment validation, webhook,
reconcile, confirmacao/polling, admin/auth, outbox/retry/idempotencia.
Os testes live permaneceram bloqueados pelas flags existentes. Nenhuma cotacao
real, chamada InfinitePay, compra, pagamento ou outbox real foi executada.
Nenhum teste foi alterado apenas para fazer passar o patch de Zod.

Smoke local adicional apos reiniciar a previa com o pacote corrigido:
- Home, carrinho, checkout, confirmacao e admin responderam HTTP 200 (cliente sem
  sessao administrativa redirecionado para login, como esperado).
- Produto com nome/preco existentes abriu corretamente; checkout conservou o
  item existente, subtotal/total R$ 3.600,00, retirada e confeccao separada.
- No navegador com sessao existente, /admin abriu o dashboard autenticado.
  Produto sem overflow; ultima navegacao sem erros/warnings no console observado.
- Nenhuma quantidade alterada, formulario enviado ou botao de pagamento acionado.
- O reinicio encontrou EINVAL/readlink em arquivo gerado de .next no OneDrive.
  O cache foi movido para backup externo verificado, sem exclusao de fontes,
  e regenerado. Na primeira compilacao concorrente, um GET do produto retornou
  500 (factory call indefinida); a repeticao apos compilar retornou 200, assim
  como a navegacao no browser. Incidente local transitorio registrado, nao ocultado
  nem atribuido ao patch Zod. Build de producao isolado passou.
- Previa deixada disponivel em http://127.0.0.1:3000; somente um Next local foi
  reiniciado, sem modificar configuracao do projeto ou .env.local.

Avisos nao criticos existentes: next lint deprecated (Next 16), Browserslist
desatualizado e serializacao de strings grandes no cache Webpack. Nao alterados
tooling/configuracao para silencia-los.

## Diff e preservacao

Alteracoes exclusivas da Etapa 5C:
- package.json: somente Zod 4.6.6 exato.
- package-lock.json: somente Zod e referencia da raiz.
- docs/dependency-security-audit.md: este relatorio.

Sem alteracao em schemas comerciais, preco, catalogo, checkout, InfinitePay,
Melhor Envio, auth, banco/RPC/RLS, envs locais/produção ou Netlify.
Mudancas anteriores das Etapas 2-5 e mudancas paralelas foram preservadas.
Nao foram adicionados artefatos de build/logs/temporarios ao repositorio.
Indice permanece vazio. Nenhum commit, push ou deploy.

## Decisao para um futuro deploy

Pelo recorte examinado, nao resta critico/alto de **runtime externo alcancavel**
sem tratamento; Zod deixou de ser vulneravel e a linha Node remota comprovada e
compativel. Portanto nao ha bloqueio de seguranca conhecido desta Etapa 5C para
um futuro deploy controlado. Isso NAO autoriza executar deploy agora, ignorar os
21 pacotes residuais ou garantir seguranca de todo software/codigo nao auditado.

Manter como manutencao separada o tooling Vitest/Tinypool/Vite/ESLint/CSS, com
nova validacao de compatibilidade antes de upgrades majors. Nao usar npm audit
fix --force nem overrides sem prova de suporte do pai.
