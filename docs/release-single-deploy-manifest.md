# Manifesto do release unico - Marjouxs

Data: 2026-11-04. Etapa 6 LOCAL. Preparacao, NAO execucao do release.

## Resposta objetiva: o que um push enviaria

**Se executar git push agora**, entram somente os 16 arquivos ja commitados em
f637997; NENHUMA das 206 mudancas pendentes iniciais entra no push por existir no
worktree. Isso publicaria um estado anterior, sem as Etapas 2-5C completas.

O plano e criar futuramente UM commit seletivo adicional em cima de f637997 e
enviar os DOIS commits juntos em UM unico push. Netlify deve construir somente
o tip novo. Nao publicar f637997 isoladamente, nem usar deploy da pasta local mista.

**Mapa concluido para revisao/preparacao seletiva futura; NAO e liberacao para
push/deploy hoje.** Os 7 blobs parciais e o lockfile recortado ainda nao foram
montados no indice nem testados como candidato isolado, conforme proibicao de
staging/codigo nesta etapa. Essa validacao continua obrigatoria antes do commit.
Nenhuma migration pendente foi identificada para o recorte descrito.

## Git real, sem fetch ou mutacao

- Branch: main.
- HEAD: f6379978c54c97d270b7ed0b1be98faf3aae1004.
- Pai e origin/main local: b37690c797c21591b8bc5e3d7fb7bea19469cdb0.
- Main REAL do remoto, via git ls-remote: mesmo b37690c797c21591b8bc5e3d7fb7bea19469cdb0.
- Ahead 1 / behind 0.
- Indice vazio, confirmado por git diff --cached --name-status.
- Fotografia inicial: 206 caminhos, sendo 79 rastreados modificados/excluidos e
  127 untracked individuais. git diff --stat considera so os 79 rastreados.
- Esta etapa acrescentou somente os dois documentos de release: fotografia final
  confirmada de 208 caminhos, 79 rastreados e 129 untracked. Os 206 caminhos da
  fotografia inicial conservaram status e conteudo.
- Plano do novo commit: **126 caminhos**, 119 integrais/pre-requisitos e **7 parciais**.
- **82 caminhos inteiramente fora** (78 J + 4 K), alem dos hunks paralelos nos 7 mistos.
- Nao ha caminho incerto (L). O arquivo sem extensao foi identificado pelo
  conteudo como saida de git diff colorida, nao fonte executavel.
- Uniao do delta do commit pronto com o novo commit planejado: **133 caminhos
  distintos**, pois 9 dos 16 arquivos ja commitados recebem alteracoes posteriores.

Fechamento: 119 integrais (incluindo 21 documentos tecnicos) + 7 parciais +
78 paralelos + 4 artefatos = **208 caminhos**. As 4 exclusoes de artefatos (K)
ja estao dentro das 82 exclusoes; os ignorados abaixo nao entram nessa soma.

Ignorados relevantes: .env.local, .next/, node_modules/, dev-3001.log,
dev-server.log e dev-slider.log. tsconfig.tsbuildinfo e rastreado, embora seja
artefato: permanece fora do plano. Nenhum ignorado deve ser adicionado por force.

Baseline e evidencia completa fora do repositorio:
C:/Users/ravya/.codex/visualizations/2026/06/02/019e85ba-f5c3-78d0-807c-95c2876e6fb0/release-stage6-20261104/

Foram registrados git status individual, diff binario, hashes dos 206 caminhos,
classificacao, dependencia/lock e consulta SQL somente leitura. Nao foi usado
git add, commit, push, fetch, reset, checkout ou restore para preparar esse mapa.

## Commit ja pronto

- Hash: f6379978c54c97d270b7ed0b1be98faf3aae1004.
- Mensagem: fix: protege confirmacao e criacao de checkout.
- Pai: b37690c797c21591b8bc5e3d7fb7bea19469cdb0.
- 16 arquivos; 1391 insercoes e 140 remocoes; git show --check passou.
- Contem protocolo TypeScript de dispatch distribuido, verificacao financeira
  conservadora, origem HTTPS canonica de producao, testes e documentacao.
- Nao contem sozinho refresh/recovery/confirmacao final, Next 15 e Zod corrigido.

- `app/api/payments/infinitepay/create/site-url.test.ts`
- `app/api/payments/infinitepay/webhook/route.test.ts`
- `app/api/payments/infinitepay/webhook/route.ts`
- `docs/checkout-link-idempotency-integration.md`
- `docs/infinitepay-payment-validation.md`
- `lib/checkout/checkout-link.test.ts`
- `lib/checkout/checkout-link.ts`
- `lib/checkout/config.test.ts`
- `lib/checkout/config.ts`
- `lib/checkout/create-checkout-idempotency.audit.test.ts`
- `lib/checkout/create-checkout.test.ts`
- `lib/checkout/create-checkout.ts`
- `lib/checkout/infinitepay.test.ts`
- `lib/checkout/infinitepay.ts`
- `lib/checkout/payment-validation.test.ts`
- `lib/checkout/payment-validation.ts`

Arquivos desse commit com mudancas locais posteriores, que NAO estao ainda no commit:

- `app/api/payments/infinitepay/webhook/route.test.ts`
- `app/api/payments/infinitepay/webhook/route.ts`
- `lib/checkout/config.test.ts`
- `lib/checkout/config.ts`
- `lib/checkout/create-checkout-idempotency.audit.test.ts`
- `lib/checkout/create-checkout.test.ts`
- `lib/checkout/create-checkout.ts`
- `lib/checkout/infinitepay.test.ts`
- `lib/checkout/infinitepay.ts`

## Fronteira e pre-requisitos que nao podem ser cortados cegamente

1. Etapa 2 publica reconciliacao em /admin/pedidos/[id]. O HEAD ainda nao tem essa
   base de paginas/modelos; por isso o plano inclui a base de pedidos, detalhe,
   actions/status e modelos ja implementados, mais seus testes. Isso e pre-requisito
   do fluxo aprovado, nao inclusao do dashboard ou busca/duplicacao de produtos.
2. verify-payment importa ensurePaidOrderEvent de lib/notifications/order-paid.
   Esse modulo usa order-email e lib/orders/selects/model. O worker outbox tambem
   usa esses modulos. Exclui-los por parecerem "e-mail paralelo" quebraria imports
   ou alteraria o contrato financeiro ja aprovado na Etapa 2.
3. Os quatro arquivos de notifications e a base de orders entram como dependencias.
   **Envio Resend fica DESATIVADO**, pois ORDER_NOTIFICATIONS_ENABLED esta ausente
   na Netlify e o default e false. Nao criar essa flag, API key ou destinatario
   neste release. order.paid pode ficar pending no outbox; nao promete e-mail.
4. O arquivo netlify/functions/process-ecommerce-outbox.ts ja esta no HEAD e nao
   muda, mas seu bundle muda por dependencia de outbox. Schedule existente
   de 5 em 5 minutos e preservado; nenhum cron/job novo e criado.
5. O helper de token Sandbox local e importado por shipping. Entra com o frete,
   pois ja foi implementado/testado e bloqueia seu uso em NODE_ENV=production.
   Nenhum token local, env de QA, allowlist 2 ou segredo entra no commit/Netlify.
6. Somente o link Pedidos do layout admin pertence ao recorte. Dashboard/Visao
   geral, exclusao de app/admin/page.tsx e nova pagina protegida /admin ficam fora.
   O redirect /admin existente no HEAD deve permanecer.
7. O leitor publico de catalogo, dados tecnicos, Conforto/Estrutura, Markdown,
   duplicacao e navegacao de produtos ficam fora. O checkout database usa campos
   ja presentes no HEAD; nao depende desses hunks tecnicos.

A checagem estrutural dos imports alias dos arquivos selecionados nao encontrou
alias ausente na uniao HEAD + novos arquivos selecionados. Isso NAO substitui
compilacao/testes do candidato parcial futuro nem testa todo import dinamico.

## Versoes finais desejadas

| Pacote | Versao exata |
| --- | --- |
| next | 15.5.28 |
| react | 19.3.1 |
| react-dom | 19.3.1 |
| eslint-config-next | 15.5.28 |
| @types/react | 19.3.0 |
| @types/react-dom | 19.3.0 |
| zod | 4.6.6 |

package.json, lockfile e instalacao atuais sao consistentes. Nenhum pacote foi
atualizado nesta Etapa 6. As demais versoes aprovadas permanecem congeladas.
react-markdown e os scripts migrate-products:* sao alteracoes paralelas e NAO
devem entrar no manifesto do package.json do release.

### Lockfile misto: recorte semantico, nunca staging cego

O lock atual tem 599 registros em packages, incluindo a raiz. O grafo identifica
**79 registros exclusivos da arvore react-markdown**, listados abaixo, a excluir
somente do blob FUTURO do indice. O worktree nao deve ser alterado/limpo.

Ha tambem 6 registros compartilhados a reclassificar como dev-only, sem mudar
versao/resolved/integrity: @types/estree 1.0.9, debug 4.4.3, ms 2.1.3,
@ungap/structured-clone 1.3.1, @types/react 19.3.0 e csstype 3.2.3.
A previsao sem novas resolucoes e 520 registros restantes.

Conferencia sem gravar o lockfile: comparando o recorte em memoria com o HEAD,
dos 522 registros originais (incluindo a raiz), saem 34 e entram 32. Alem
disso, 22 mudam de versao e 2 mudam apenas metadados, sem contar a raiz.
Cada linha abaixo e uma particao disjunta por alcance nas arvores antigas ou
novas, incluindo dependencias opcionais e peers:

| Arvore(s) de dependencia | Entram | Saem | Mudam versao | So metadados |
| --- | ---: | ---: | ---: | ---: |
| Next | 30 | 5 | 12 | 0 |
| eslint-config-next | 2 | 28 | 3 | 0 |
| Tipos React/React DOM | 0 | 1 | 2 | 0 |
| Next + React/React DOM | 0 | 0 | 3 | 0 |
| Next + eslint-config-next | 0 | 0 | 1 | 0 |
| Next + React/React DOM + eslint-config-next | 0 | 0 | 0 | 2 |
| Zod | 0 | 0 | 1 | 0 |
| Fora dessas arvores | 0 | 0 | 0 | 0 |

A raiz do par futuro deve conservar scripts e dependencias do HEAD, alterando
somente os sete pins aprovados. O recorte do lock usa as resolucoes ja auditadas
abaixo, sem consultar o registry para escolher novas versoes. Conferir grafo,
incluindo peers e opcionais, e validar o par com npm ci em copia isolada. Essa
comparacao em memoria nao e um lockfile pronto para stage.

No futuro, montar o par package.json/package-lock.json em snapshot externo,
usando parser JSON/grafo e preservando os registros aprovados, validar npm ci,
peers, testes e build. So depois importar os dois blobs para o indice, mediante
nova autorizacao. Se npm resolver qualquer versao nao prevista: PARAR e revisar.
Nao usar git add -p no lockfile enorme para apagar registros isolados sem grafo.

- `node_modules/@types/debug` 4.1.13
- `node_modules/@types/estree-jsx` 1.0.5
- `node_modules/@types/hast` 3.0.5
- `node_modules/@types/mdast` 4.0.4
- `node_modules/@types/ms` 2.1.0
- `node_modules/@types/unist` 3.0.3
- `node_modules/bail` 2.0.2
- `node_modules/ccount` 2.0.1
- `node_modules/character-entities` 2.0.2
- `node_modules/character-entities-html4` 2.1.0
- `node_modules/character-entities-legacy` 3.0.0
- `node_modules/character-reference-invalid` 2.0.1
- `node_modules/comma-separated-tokens` 2.0.3
- `node_modules/decode-named-character-reference` 1.3.0
- `node_modules/dequal` 2.0.3
- `node_modules/devlop` 1.1.0
- `node_modules/estree-util-is-identifier-name` 3.0.0
- `node_modules/extend` 3.0.2
- `node_modules/hast-util-to-jsx-runtime` 2.3.6
- `node_modules/hast-util-whitespace` 3.0.0
- `node_modules/html-url-attributes` 3.0.1
- `node_modules/inline-style-parser` 0.2.7
- `node_modules/is-alphabetical` 2.0.1
- `node_modules/is-alphanumerical` 2.0.1
- `node_modules/is-decimal` 2.0.1
- `node_modules/is-hexadecimal` 2.0.1
- `node_modules/is-plain-obj` 4.1.0
- `node_modules/longest-streak` 3.1.0
- `node_modules/mdast-util-from-markdown` 2.1.0
- `node_modules/mdast-util-mdx-expression` 2.0.1
- `node_modules/mdast-util-mdx-jsx` 3.2.0
- `node_modules/mdast-util-mdxjs-esm` 2.0.1
- `node_modules/mdast-util-phrasing` 4.1.0
- `node_modules/mdast-util-to-hast` 13.2.1
- `node_modules/mdast-util-to-markdown` 2.2.0
- `node_modules/mdast-util-to-string` 4.0.0
- `node_modules/micromark` 4.0.3
- `node_modules/micromark-core-commonmark` 2.0.4
- `node_modules/micromark-factory-destination` 2.0.1
- `node_modules/micromark-factory-label` 2.0.1
- `node_modules/micromark-factory-space` 2.1.0
- `node_modules/micromark-factory-title` 2.0.1
- `node_modules/micromark-factory-whitespace` 2.0.1
- `node_modules/micromark-util-character` 2.1.1
- `node_modules/micromark-util-chunked` 2.0.1
- `node_modules/micromark-util-classify-character` 2.0.1
- `node_modules/micromark-util-combine-extensions` 2.0.1
- `node_modules/micromark-util-decode-numeric-character-reference` 2.0.2
- `node_modules/micromark-util-decode-string` 2.0.1
- `node_modules/micromark-util-edit-map` 1.0.0
- `node_modules/micromark-util-encode` 2.0.1
- `node_modules/micromark-util-html-tag-name` 2.0.1
- `node_modules/micromark-util-normalize-identifier` 2.0.1
- `node_modules/micromark-util-resolve-all` 2.0.1
- `node_modules/micromark-util-sanitize-uri` 2.0.1
- `node_modules/micromark-util-subtokenize` 2.1.0
- `node_modules/micromark-util-symbol` 2.0.1
- `node_modules/micromark-util-types` 2.0.3
- `node_modules/parse-entities` 4.0.2
- `node_modules/parse-entities/node_modules/@types/unist` 2.0.11
- `node_modules/property-information` 7.2.0
- `node_modules/react-markdown` 10.1.0
- `node_modules/remark-parse` 11.0.0
- `node_modules/remark-rehype` 11.1.2
- `node_modules/space-separated-tokens` 2.0.2
- `node_modules/stringify-entities` 4.0.4
- `node_modules/style-to-js` 1.1.21
- `node_modules/style-to-object` 1.0.14
- `node_modules/trim-lines` 3.0.1
- `node_modules/trough` 2.2.0
- `node_modules/unified` 11.0.5
- `node_modules/unist-util-is` 6.0.1
- `node_modules/unist-util-position` 5.0.0
- `node_modules/unist-util-stringify-position` 4.0.0
- `node_modules/unist-util-visit` 5.1.0
- `node_modules/unist-util-visit-parents` 6.0.2
- `node_modules/vfile` 6.0.3
- `node_modules/vfile-message` 4.0.3
- `node_modules/zwitch` 2.0.4

## Envs do futuro deploy: somente estas quatro

Valores de Production lidos na Netlify, All scopes / Same value in all deploy contexts:

| Variavel | Atual remoto / rollback | Futuro aprovado |
| --- | --- | --- |
| DEFAULT_SHIPMENT_LENGTH_CM | 16 | 16 (reconfirmar) |
| DEFAULT_SHIPMENT_WIDTH_CM | 12 | 11 |
| DEFAULT_SHIPMENT_HEIGHT_CM | 6 | 3 |
| DEFAULT_SHIPMENT_WEIGHT_KG | 0.3 | 0.07 |

Sao quatro envs a conferir/aplicar, com tres valores efetivamente diferentes.
Nao alterar escopos/contextos ou importar .env.local inteiro. Mudancas na Netlify
dependem de autorizacao futura; NADA foi alterado agora.

Nenhuma nova env e exigida por Next 15, Zod, refresh, recovery, polling ou seguranca.
A fonte do checkout em Production ja e database; nao depende de mudar o default
static do codigo. O default static continua sendo o default da biblioteca, nao o
valor efetivo da Netlify. E-mail permanece desativado pela ausencia de flag.
Nao promover a allowlist local 2 nem o token Sandbox local para producao.

insurance_value continua sendo o subtotal integral validado server-side.
Um pacote continua sendo um pacote; limite tecnico de 10 unidades NAO comprova
capacidade fisica de 16x11x3 cm. Nao zerar declaracao nem inventar outras embalagens.

## Node

- Local: Node 24.16.0 / npm 11.13.0.
- Netlify: Node 22.x configurado; ultimo build comprovado 22.23.3 / npm 10.9.9.
- Sem .nvmrc, .node-version ou engines Node no repositorio; netlify.toml nao fixa Node.
- Next 15.5.28 aceita ^18.18.0 || ^19.8.0 || >=20.0.0: 22.x e compativel.
- Functions futuro acompanha a linha de build na ausencia de override, conforme
  documentacao oficial ja referenciada na auditoria 5C. Patch remoto nao e fixado
  a 22.23.3 para todo deploy futuro.
- Nao alterar Node/Netlify agora; revalidar no dia do release.

## Banco pronto: prova atual somente leitura

Consulta em transacao READ ONLY com ROLLBACK, sem executar RPCs de negocio:
verify-release.read-only.sql no diretorio externo da auditoria.

| RPC | Disponivel | Contrato/corpo |
| --- | --- | --- |
| ecommerce_checkout_link_transition | sim | assinatura uuid,text,uuid,text,text; MD5 aprovado 5360e199c1f9b69acb6b5e1f9aa09ba7 confere |
| ecommerce_create_checkout | sim | p_order jsonb, p_items jsonb, p_checkout_idempotency_key text, p_request_hash text; MD5 4db53180b64a8234b0fe02aba7c814dc confere |
| ecommerce_set_checkout_link | sim | MD5 dc92c928aa83da39ade7f603dbdfbb23 confere |
| ecommerce_confirm_payment | sim | MD5 7ede51f3400ca14a117c89fa71dcdcd5 confere |
| ecommerce_fail_payment_attempt | sim | MD5 ba643c7a7428b3e5618c685bff55d5dc confere |
| ecommerce_claim_outbox | sim | mesmos parametros tipos text[]/integer; contem ga4_purchase, erp_financial e order.paid |
| ecommerce_complete_outbox | sim | uuid,uuid -> boolean |
| ecommerce_fail_outbox | sim | uuid,uuid,text -> boolean |

Nas oito: owner postgres, SECURITY DEFINER, search_path vazio, service_role
EXECUTE permitido, anon/authenticated EXECUTE negado. Nenhuma ocorrencia invalida
de pg_catalog.coalesce nos corpos. A constraint do outbox aceita os tres eventos;
UNIQUE(order_id,event_type) permanece presente.

**SQL pendente para este recorte: NAO. RPCs necessarias prontas: SIM.**
SQLs proposed locais relacionados sao historicos da instalacao ja aprovada,
nao uma lista para executar novamente. SQL de produtos/tecnicos/rastreio nao e
pre-requisito deste release e fica fora.

## Attempt legada: excecao conhecida

Referencia sanitizada: 6d743776...e00c, LEGACY / DISPATCH UNKNOWN.

Leitura atual confirmou:
- status creating; order_status pending_payment; payment_status pending;
- marcador checkout_link_dispatch ausente;
- provider_checkout_id, transaction_nsu e checkout_url nulos;
- hash da linha INTEIRA da attempt igual ao backup aprovado;
- hash da linha INTEIRA do pedido relacionado igual ao backup aprovado.

Portanto metadata, NSUs e timestamps tambem permanecem intactos, sem expor valores.
Nenhuma consulta ao provider, migracao, backfill, reconciliacao ou escrita foi feita.

Fotografia atual: other_creating=0, new_reserved=0, new_dispatched=0.
Isso nao e um drain futuro nem prova ausencia de requests em voo na data do deploy.
Excluir SOMENTE essa excecao conhecida do contador de novos dispatches, nunca
todos os registros antigos nem attempts sem marcador de forma generica.
A RPC continua recusando recuperacao automatica do legado.

## Arquivos do novo commit futuro, agrupados

Cada caminho abaixo e unico no total de 126, embora alguns tenham mais de uma
etapa. A classificacao primaria F dos dois manifests de pacote inclui tambem G.

### A - Release checkout/pagamento e pre-requisitos

- `app/admin/(protected)/layout.tsx` [PARCIAL]
- `lib/checkout/outbox.test.ts`
- `lib/checkout/outbox.ts`
- `app/admin/(protected)/pedidos/[id]/page.tsx` [PRE-REQUISITO]
- `app/admin/(protected)/pedidos/actions.ts` [PRE-REQUISITO]
- `app/admin/(protected)/pedidos/error.tsx` [PRE-REQUISITO]
- `app/admin/(protected)/pedidos/page.tsx` [PRE-REQUISITO]
- `app/admin/(protected)/pedidos/pages.test.tsx` [PRE-REQUISITO]
- `app/admin/(protected)/pedidos/reconcile-action.test.ts` [PRE-REQUISITO]
- `lib/admin/orders.test.ts` [PRE-REQUISITO]
- `lib/admin/orders.ts` [PRE-REQUISITO]
- `lib/notifications/order-email.test.ts` [PRE-REQUISITO]
- `lib/notifications/order-email.ts` [PRE-REQUISITO]
- `lib/notifications/order-paid.test.ts` [PRE-REQUISITO]
- `lib/notifications/order-paid.ts` [PRE-REQUISITO]
- `lib/orders/fixture.ts` [PRE-REQUISITO]
- `lib/orders/model.test.ts` [PRE-REQUISITO]
- `lib/orders/model.ts` [PRE-REQUISITO]
- `lib/orders/selects.ts` [PRE-REQUISITO]

### B - Etapa 2: refresh e reconciliacao

- `app/api/payments/infinitepay/webhook/route.test.ts`
- `app/api/payments/infinitepay/webhook/route.ts`
- `lib/checkout/create-checkout-idempotency.audit.test.ts`
- `lib/checkout/create-checkout.test.ts`
- `lib/checkout/create-checkout.ts`
- `lib/checkout/hash.ts`
- `lib/checkout/infinitepay.test.ts`
- `lib/checkout/infinitepay.ts`
- `lib/admin/reconcile-payment.test.ts`
- `lib/admin/reconcile-payment.ts`
- `lib/checkout/intent.test.ts`
- `lib/checkout/intent.ts`
- `lib/checkout/verify-payment.ts`

### C - Etapa 3: estados, expiracao e recuperacao

- `app/checkout/page.tsx`
- `app/api/checkout/intent/route.ts`
- `lib/checkout/payment-state.test.ts`
- `lib/checkout/payment-state.ts`
- `lib/checkout/recover-intent.test.ts`
- `lib/checkout/recover-intent.ts`

### D - Etapa 4: confirmacao e pos-pagamento

- `app/api/orders/[token]/route.test.ts`
- `app/api/orders/[token]/route.ts`
- `components/order-confirmation.tsx`
- `components/order-summary.tsx`
- `lib/google-ads.test.ts`
- `lib/google-ads.ts`
- `lib/order-status.test.ts`
- `lib/order-status.ts`
- `components/order-confirmation.test.tsx`
- `lib/checkout/confirmation-polling.test.ts`
- `lib/checkout/confirmation-polling.ts`
- `lib/checkout/confirmation.fixture.ts`
- `lib/checkout/confirmation.test.ts`
- `lib/checkout/confirmation.ts`

### E - Etapa 5: seguranca

- `app/api/cart/validate/route.ts`
- `app/api/orders/lookup/route.test.ts`
- `app/api/orders/lookup/route.ts`
- `app/api/payments/infinitepay/create/route.ts`
- `components/product-purchase-actions.tsx`
- `lib/checkout/catalog-server.test.ts`
- `lib/checkout/catalog.ts`
- `lib/checkout/http.ts`
- `lib/checkout/orders.test.ts`
- `lib/checkout/orders.ts`
- `lib/checkout/schemas.ts`
- `app/api/payments/infinitepay/create/security.test.ts`
- `components/order-security.test.tsx`
- `lib/admin/auth.test.ts`
- `lib/checkout/http.test.ts`
- `lib/checkout/limits.ts`
- `lib/checkout/security-input.test.ts`

### F - Next/React (e hunks compartilhados com Zod)

- `app/acompanhar-pedido/page.tsx`
- `app/admin/(protected)/produtos/[id]/page.tsx` [PARCIAL]
- `app/admin/(protected)/produtos/novo/page.tsx`
- `app/admin/(protected)/produtos/page.tsx` [PARCIAL]
- `app/admin/login/page.tsx`
- `app/aneis/[material]/[[...tipo]]/page.tsx`
- `app/categorias/[slug]/page.tsx`
- `app/pedido/confirmacao/page.tsx`
- `app/produtos/[slug]/page.tsx` [PARCIAL]
- `app/produtos/page.tsx`
- `lib/supabase/server.ts`
- `next-env.d.ts`
- `package-lock.json` [PARCIAL]
- `package.json` [PARCIAL]
- `app/next15-compatibility.test.tsx`
- `lib/supabase/server.test.ts`

### G - Dependency security / Zod

Zod compartilha package.json/package-lock.json com F; sem arquivo exclusivo adicional.

### H - Frete real e cotacao segura

- `.env.example` [PARCIAL]
- `app/api/address/lookup/route.test.ts`
- `app/api/address/lookup/route.ts`
- `app/api/shipping/quote/route.ts`
- `lib/checkout/checkout-form.test.ts`
- `lib/checkout/checkout-form.ts`
- `lib/checkout/config.test.ts`
- `lib/checkout/config.ts`
- `lib/checkout/diagnostics.test.ts`
- `lib/checkout/diagnostics.ts`
- `lib/checkout/shipping.test.ts`
- `lib/checkout/shipping.ts`
- `lib/checkout/melhor-envio-local-sandbox.ts`
- `lib/checkout/postal-code-lookup.test.ts`
- `lib/checkout/postal-code-lookup.ts`
- `lib/checkout/postal-code.ts`
- `lib/checkout/shipping-local-sandbox.test.ts`
- `lib/checkout/shipping-messages.test.ts`
- `lib/checkout/shipping-messages.ts`
- `lib/checkout/shipping-postal-code.test.ts`

### I - Documentacao tecnica

- `docs/admin-orders-audit.md`
- `docs/admin-orders-schema-audit.sql`
- `docs/admin-orders-validation.md`
- `docs/checkout-link-idempotency-audit.md`
- `docs/checkout-link-idempotency.proposed.sql`
- `docs/checkout-link-idempotency.rollback.sql`
- `docs/checkout-post-payment-confirmation.md`
- `docs/checkout-refresh-reconciliation.md`
- `docs/checkout-security-audit.md`
- `docs/checkout-states-expiry-recovery.md`
- `docs/dependency-security-audit.md`
- `docs/manual-shipping.md`
- `docs/melhor-envio-local-sandbox-qa.md`
- `docs/nextjs-15-security-upgrade.md`
- `docs/order-paid-claim-outbox.proposed.sql`
- `docs/order-paid-claim-outbox.rollback.sql`
- `docs/order-paid-event-type.proposed.sql`
- `docs/order-paid-event-type.rollback.sql`
- `docs/shipping-real-package.md`
- `docs/release-single-deploy-manifest.md`
- `docs/release-single-deploy-runbook.md`


## Sete arquivos mistos: hunks a incluir/excluir

Os headers abaixo identificam a fotografia auditada; se o diff mudar,
reabrir a revisao. Para hunks agrupados, usar split/edit ou equivalente de indice
montado a partir do HEAD. Nunca forcar o arquivo inteiro porque "compila".

### `.env.example`

- **Entrar:** So o bloco DEFAULT_SHIPMENT_*; excluir bloco opcional de e-mail.
- Headers do diff atual: `@@ -11,10 +11,10 @@ INFINITEPAY_HANDLE=marjouxsjoias`; `@@ -29,3 +29,10 @@ PRODUCT_CATALOG_SOURCE=static`

### `app/admin/(protected)/layout.tsx`

- **Entrar:** Incluir somente ClipboardList e link Pedidos; excluir LayoutDashboard, link Visao geral e retoques do dashboard.
- Headers do diff atual: `@@ -1,6 +1,6 @@`; `@@ -15,9 +15,10 @@ export default async function ProtectedAdminLayout({ children }: { children: Rea`; `@@ -25,6 +26,9 @@ export default async function ProtectedAdminLayout({ children }: { children: Rea`

### `app/admin/(protected)/produtos/[id]/page.tsx`

- **Entrar:** So Promises de params/searchParams, aliases pending* e await; excluir duplicacao, returnTo, Conforto/Estrutura, sortOrder e UX paralela.
- Headers do diff atual: `@@ -1,9 +1,10 @@`; `@@ -12,6 +13,7 @@ import { ProductImageManager } from "@/components/admin/product-image-manager";`; `@@ -19,6 +21,8 @@ const errors: Record<string, string> = {`; `@@ -30,11 +34,13 @@ const errors: Record<string, string> = {`; `@@ -51,22 +57,25 @@ export default async function AdminProductDetailPage({ params, searchParams }: P`; `@@ -75,10 +84,23 @@ export default async function AdminProductDetailPage({ params, searchParams }: P`; `@@ -109,6 +131,8 @@ export default async function AdminProductDetailPage({ params, searchParams }: P`; `@@ -129,6 +153,7 @@ export default async function AdminProductDetailPage({ params, searchParams }: P`; `@@ -140,7 +165,8 @@ export default async function AdminProductDetailPage({ params, searchParams }: P`; `@@ -149,10 +175,11 @@ export default async function AdminProductDetailPage({ params, searchParams }: P`

### `app/admin/(protected)/produtos/page.tsx`

- **Entrar:** So Promise em AdminProductsPageProps e await com fallback {}; manter consultas/filtros/markup do HEAD.
- Headers do diff atual: `@@ -1,32 +1,31 @@`; `@@ -38,42 +37,22 @@ export default async function AdminProductsPage({ searchParams = {} }: AdminProd`; `@@ -94,6 +73,7 @@ export default async function AdminProductsPage({ searchParams = {} }: AdminProd`; `@@ -101,50 +81,23 @@ export default async function AdminProductsPage({ searchParams = {} }: AdminProd`; `@@ -152,42 +105,51 @@ export default async function AdminProductsPage({ searchParams = {} }: AdminProd`

### `app/produtos/[slug]/page.tsx`

- **Entrar:** So params Promise/await em page/metadata; excluir Markdown, ProductCharacteristics e imports.
- Headers do diff atual: `@@ -6,6 +6,8 @@ import { ProductViewTracker } from "@/components/analytics-trackers";`; `@@ -21,7 +23,8 @@ import {`; `@@ -68,7 +71,8 @@ export async function generateMetadata({ params }: { params: { slug: string } })`; `@@ -152,13 +156,11 @@ export default async function ProductPage({ params }: { params: { slug: string }`

### `package-lock.json`

- **Entrar:** Recorte semantico F/G; excluir arvore exclusiva de react-markdown. Nao selecionar lockfile inteiro nem text-hunks cegos.
- Headers do diff atual: `@@ -12,19 +12,20 @@`; `@@ -570,619 +571,610 @@`; `@@ -1192,50 +1184,146 @@`; `@@ -1243,16 +1331,18 @@`; `@@ -1260,26 +1350,147 @@`; `@@ -1287,13 +1498,13 @@`; `@@ -1301,41 +1512,41 @@`; `@@ -1343,1137 +1554,2107 @@`; `@@ -2482,36 +3663,34 @@`; `@@ -2520,117 +3699,81 @@`; `@@ -2639,1426 +3782,1244 @@`; `@@ -4067,127 +5028,189 @@`; `@@ -4196,30 +5219,34 @@`; `@@ -4228,107 +5255,85 @@`; `@@ -4337,12 +5342,16 @@`; `@@ -4350,25 +5359,35 @@`; `@@ -4376,38 +5395,55 @@`; `@@ -4415,10 +5451,10 @@`; `@@ -4428,125 +5464,112 @@`; `@@ -4555,17 +5578,15 @@`; `@@ -4575,14 +5596,14 @@`; `@@ -4591,28 +5612,27 @@`; `@@ -4621,22 +5641,16 @@`; `@@ -4644,616 +5658,892 @@`; `@@ -5291,21 +6581,10 @@`; `@@ -5362,41 +6641,40 @@`; `@@ -5406,6 +6684,9 @@`; `@@ -5712,6 +6993,31 @@`; `@@ -5749,23 +7055,6 @@`; `@@ -6039,6 +7328,16 @@`; `@@ -6071,28 +7370,24 @@`; `@@ -6102,6 +7397,33 @@`; `@@ -6155,18 +7477,51 @@`; `@@ -6389,19 +7744,16 @@`; `@@ -6459,6 +7811,56 @@`; `@@ -6565,19 +7967,6 @@`; `@@ -6587,6 +7976,16 @@`; `@@ -6622,84 +8021,6 @@`; `@@ -6813,21 +8134,21 @@`; `@@ -6863,10 +8184,28 @@`; `@@ -6875,7 +8214,7 @@`; `@@ -7130,6 +8469,26 @@`; `@@ -7313,6 +8672,93 @@`; `@@ -7399,6 +8845,34 @@`; `@@ -7680,107 +9154,6 @@`; `@@ -7802,13 +9175,23 @@`

### `package.json`

- **Entrar:** Incluir 7 versoes F/G aprovadas; excluir react-markdown e scripts migrate-products:* (J).
- Headers do diff atual: `@@ -9,6 +9,8 @@`; `@@ -18,19 +20,20 @@`


### Ancoras exatas do recorte

- .env.example: incluir peso na linha 14, largura/altura nas linhas 16-17;
  comprimento 16 permanece; excluir o bloco novo iniciado apos linha 31.
- Admin produto detalhe: incluir somente as mudancas em tipos nas linhas atuais
  37-38 e assinatura/await nas linhas 41-43. Nao incluir returnTo ou imports novos.
- Admin lista de produtos: incluir somente o tipo Promise da linha atual 21 e
  assinatura/await nas linhas 27-28; conservar todo filtro/consulta/UI do HEAD.
- Produto publico: incluir assinatura/await de metadata nas linhas 26-27 e pagina
  nas linhas 74-75; conservar renderizacao da descricao e imports do HEAD.
- Layout admin: importar ClipboardList e adicionar link /admin/pedidos;
  nao importar LayoutDashboard nem adicionar /admin/Visao geral.
- package.json: somente as sete versoes; nenhum script de migracao ou Markdown.
- package-lock.json: aplicar o recorte semantico descrito acima, incluindo flags
  compartilhadas; resultado tem de ser compativel com o package.json selecionado.

Nao incluir product-navigation.ts para facilitar staging: o recorte Next-only
nao precisa dele. Nao deixar referencias a ProductCharacteristics/ProductDescription,
duplicacao, filtros novos ou dashboard nos blobs parciais selecionados.

## Matriz de TODOS os caminhos pendentes

INTEGRAL significa candidato a git add explicito no futuro, nao que foi staged.
DEPENDENCIA e a menor base funcional identificada para os fluxos ja aprovados.
PARCIAL exige os hunks acima. EXCLUIR significa preservar fisicamente no worktree.
Um arquivo excluido nao e descartado e sua exclusao local nao e staged.

| Caminho | Git | Classe primaria | Decisao futura | Motivo |
| --- | --- | --- | --- | --- |
| `.env.example` | M | H | PARCIAL | So o bloco DEFAULT_SHIPMENT_*; excluir bloco opcional de e-mail. |
| `app/acompanhar-pedido/page.tsx` | M | F | INTEGRAL | Compatibilidade Next 15 (APIs assincronas) ou teste correspondente. |
| `app/admin/(protected)/layout.tsx` | M | A | PARCIAL | Incluir somente ClipboardList e link Pedidos; excluir LayoutDashboard, link Visao geral e retoques do dashboard. |
| `app/admin/(protected)/produtos/[id]/page.tsx` | M | F | PARCIAL | So Promises de params/searchParams, aliases pending* e await; excluir duplicacao, returnTo, Conforto/Estrutura, sortOrder e UX paralela. |
| `app/admin/(protected)/produtos/actions.test.ts` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `app/admin/(protected)/produtos/actions.ts` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `app/admin/(protected)/produtos/image-actions.ts` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `app/admin/(protected)/produtos/novo/page.tsx` | M | F | INTEGRAL | Compatibilidade Next 15 (APIs assincronas) ou teste correspondente. |
| `app/admin/(protected)/produtos/page.tsx` | M | F | PARCIAL | So Promise em AdminProductsPageProps e await com fallback {}; manter consultas/filtros/markup do HEAD. |
| `app/admin/(protected)/produtos/technical-fields.test.ts` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `app/admin/login/page.tsx` | M | F | INTEGRAL | Compatibilidade Next 15 (APIs assincronas) ou teste correspondente. |
| `app/admin/page.tsx` | D | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `app/aneis/[material]/[[...tipo]]/page.tsx` | M | F | INTEGRAL | Compatibilidade Next 15 (APIs assincronas) ou teste correspondente. |
| `app/api/address/lookup/route.test.ts` | M | H | INTEGRAL | CEP existente antes da cotacao e erros seguros. |
| `app/api/address/lookup/route.ts` | M | H | INTEGRAL | CEP existente antes da cotacao e erros seguros. |
| `app/api/cart/validate/route.ts` | M | E | INTEGRAL | Validacao server-side, privacidade e headers no-store. |
| `app/api/orders/[token]/route.test.ts` | M | D | INTEGRAL | DTO publico, privacidade e params assincrono. |
| `app/api/orders/[token]/route.ts` | M | D | INTEGRAL | DTO publico, privacidade e params assincrono. |
| `app/api/orders/lookup/route.test.ts` | M | E | INTEGRAL | Validacao server-side, privacidade e headers no-store. |
| `app/api/orders/lookup/route.ts` | M | E | INTEGRAL | Validacao server-side, privacidade e headers no-store. |
| `app/api/payments/infinitepay/create/route.ts` | M | E | INTEGRAL | Validacao server-side, privacidade e headers no-store. |
| `app/api/payments/infinitepay/webhook/route.test.ts` | M | B | INTEGRAL | Mesmo verificador financeiro da reconciliacao; respostas privadas. |
| `app/api/payments/infinitepay/webhook/route.ts` | M | B | INTEGRAL | Mesmo verificador financeiro da reconciliacao; respostas privadas. |
| `app/api/shipping/quote/route.ts` | M | H | INTEGRAL | CEP existente antes da cotacao e erros seguros. |
| `app/categorias/[slug]/page.tsx` | M | F | INTEGRAL | Compatibilidade Next 15 (APIs assincronas) ou teste correspondente. |
| `app/checkout/page.tsx` | M | C | INTEGRAL | Refresh/estados/recuperacao, CEP e apresentacao de postagem manual integrados. |
| `app/pedido/confirmacao/page.tsx` | M | F | INTEGRAL | searchParams assincrono (F) com privacidade de confirmacao (C/D). |
| `app/produtos/[slug]/page.tsx` | M | F | PARCIAL | So params Promise/await em page/metadata; excluir Markdown, ProductCharacteristics e imports. |
| `app/produtos/page.tsx` | M | F | INTEGRAL | Compatibilidade Next 15 (APIs assincronas) ou teste correspondente. |
| `components/admin/deactivate-product-form.tsx` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `components/admin/product-fields.test.tsx` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `components/admin/product-fields.tsx` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `components/admin/product-image-manager.tsx` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `components/admin/product-search-input.tsx` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `components/order-confirmation.tsx` | M | D | INTEGRAL | Confirmacao publica, privacidade e deduplicacao da conversao. |
| `components/order-summary.tsx` | M | D | INTEGRAL | Confirmacao publica, privacidade e deduplicacao da conversao. |
| `components/product-purchase-actions.tsx` | M | E | INTEGRAL | Privacidade e limite tecnico de gravacao, preservando Unicode. |
| `docs/product-catalog-shadow-report.md` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/admin/product-form.test.ts` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/admin/product-form.ts` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/catalog/admin-publication.test.ts` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/catalog/database-products.ts` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/catalog/normalize-public.ts` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/catalog/public-catalog.test.ts` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/checkout/catalog-server.test.ts` | M | E | INTEGRAL | Limites, schemas, cache privado, validacao comercial server-side e testes. |
| `lib/checkout/catalog.ts` | M | E | INTEGRAL | Limites, schemas, cache privado, validacao comercial server-side e testes. |
| `lib/checkout/checkout-form.test.ts` | M | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/checkout/checkout-form.ts` | M | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/checkout/config.test.ts` | M | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/checkout/config.ts` | M | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/checkout/create-checkout-idempotency.audit.test.ts` | M | B | INTEGRAL | Intencao persistente, hash comercial e verificacao/reconciliacao compartilhada. |
| `lib/checkout/create-checkout.test.ts` | M | B | INTEGRAL | Intencao persistente, hash comercial e verificacao/reconciliacao compartilhada. |
| `lib/checkout/create-checkout.ts` | M | B | INTEGRAL | Intencao persistente, hash comercial e verificacao/reconciliacao compartilhada. |
| `lib/checkout/diagnostics.test.ts` | M | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/checkout/diagnostics.ts` | M | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/checkout/hash.ts` | M | B | INTEGRAL | Intencao persistente, hash comercial e verificacao/reconciliacao compartilhada. |
| `lib/checkout/http.ts` | M | E | INTEGRAL | Limites, schemas, cache privado, validacao comercial server-side e testes. |
| `lib/checkout/infinitepay.test.ts` | M | B | INTEGRAL | Intencao persistente, hash comercial e verificacao/reconciliacao compartilhada. |
| `lib/checkout/infinitepay.ts` | M | B | INTEGRAL | Intencao persistente, hash comercial e verificacao/reconciliacao compartilhada. |
| `lib/checkout/orders.test.ts` | M | E | INTEGRAL | Privacidade/projecao de consulta de pedido, sem PII. |
| `lib/checkout/orders.ts` | M | E | INTEGRAL | Privacidade/projecao de consulta de pedido, sem PII. |
| `lib/checkout/outbox.test.ts` | M | A | INTEGRAL | Integracao order.paid e erros sanitizados; dependencia do nucleo; nao habilita envio de e-mail. |
| `lib/checkout/outbox.ts` | M | A | INTEGRAL | Integracao order.paid e erros sanitizados; dependencia do nucleo; nao habilita envio de e-mail. |
| `lib/checkout/schemas.ts` | M | E | INTEGRAL | Limites, schemas, cache privado, validacao comercial server-side e testes. |
| `lib/checkout/shipping.test.ts` | M | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/checkout/shipping.ts` | M | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/google-ads.test.ts` | M | D | INTEGRAL | Confirmacao publica, privacidade e deduplicacao da conversao. |
| `lib/google-ads.ts` | M | D | INTEGRAL | Confirmacao publica, privacidade e deduplicacao da conversao. |
| `lib/order-status.test.ts` | M | D | INTEGRAL | Confirmacao publica, privacidade e deduplicacao da conversao. |
| `lib/order-status.ts` | M | D | INTEGRAL | Confirmacao publica, privacidade e deduplicacao da conversao. |
| `lib/product-merchandising.test.ts` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/product-merchandising.ts` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/supabase/server.ts` | M | F | INTEGRAL | Compatibilidade Next 15 (APIs assincronas) ou teste correspondente. |
| `next-env.d.ts` | M | F | INTEGRAL | Compatibilidade Next 15 (APIs assincronas) ou teste correspondente. |
| `package-lock.json` | M | F | PARCIAL | Recorte semantico F/G; excluir arvore exclusiva de react-markdown. Nao selecionar lockfile inteiro nem text-hunks cegos. |
| `package.json` | M | F | PARCIAL | Incluir 7 versoes F/G aprovadas; excluir react-markdown e scripts migrate-products:* (J). |
| `public/produtos/anel-teste-01.jpg` | D | J | EXCLUIR | Exclusao local paralela; manter imagem do HEAD no release. |
| `tsconfig.tsbuildinfo` | M | K | EXCLUIR | Temporario/artefato local; nao versionar neste release. |
| `types/product.ts` | M | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `.tmp-product-migration-apply.sql` | novo | K | EXCLUIR | Temporario/artefato local; nao versionar neste release. |
| `.tmp-product-migration-before.json` | novo | K | EXCLUIR | Temporario/artefato local; nao versionar neste release. |
| `app/admin/(protected)/dashboard-page.test.tsx` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `app/admin/(protected)/page.tsx` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `app/admin/(protected)/pedidos/[id]/page.tsx` | novo | A | DEPENDENCIA | Base de pedidos/detalhe e modelos exigidos pela reconciliacao da Etapa 2; nao e dashboard/produtos paralelo. |
| `app/admin/(protected)/pedidos/actions.ts` | novo | A | DEPENDENCIA | Base de pedidos/detalhe e modelos exigidos pela reconciliacao da Etapa 2; nao e dashboard/produtos paralelo. |
| `app/admin/(protected)/pedidos/error.tsx` | novo | A | DEPENDENCIA | Base de pedidos/detalhe e modelos exigidos pela reconciliacao da Etapa 2; nao e dashboard/produtos paralelo. |
| `app/admin/(protected)/pedidos/page.tsx` | novo | A | DEPENDENCIA | Base de pedidos/detalhe e modelos exigidos pela reconciliacao da Etapa 2; nao e dashboard/produtos paralelo. |
| `app/admin/(protected)/pedidos/pages.test.tsx` | novo | A | DEPENDENCIA | Base de pedidos/detalhe e modelos exigidos pela reconciliacao da Etapa 2; nao e dashboard/produtos paralelo. |
| `app/admin/(protected)/pedidos/reconcile-action.test.ts` | novo | A | DEPENDENCIA | Base de pedidos/detalhe e modelos exigidos pela reconciliacao da Etapa 2; nao e dashboard/produtos paralelo. |
| `app/api/checkout/intent/route.ts` | novo | C | INTEGRAL | Consulta de intencao somente leitura. |
| `app/api/payments/infinitepay/create/security.test.ts` | novo | E | INTEGRAL | Validacao server-side, privacidade e headers no-store. |
| `app/next15-compatibility.test.tsx` | novo | F | INTEGRAL | Compatibilidade Next 15 (APIs assincronas) ou teste correspondente. |
| `components/admin/product-list-filters.test.tsx` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `components/admin/product-list-filters.tsx` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `components/order-confirmation.test.tsx` | novo | D | INTEGRAL | Confirmacao publica, privacidade e deduplicacao da conversao. |
| `components/order-security.test.tsx` | novo | E | INTEGRAL | Privacidade e limite tecnico de gravacao, preservando Unicode. |
| `components/product-characteristics.test.tsx` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `components/product-characteristics.tsx` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `components/product-description.test.tsx` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `components/product-description.tsx` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `docs/admin-dashboard.md` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `docs/admin-orders-audit.md` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/admin-orders-schema-audit.sql` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/admin-orders-validation.md` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/admin-products-phase-1.md` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `docs/admin-products-phase-2a.md` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `docs/admin-products-schema.proposed.sql` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `docs/admin-validation-publication.md` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `docs/checkout-link-idempotency-audit.md` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/checkout-link-idempotency.proposed.sql` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/checkout-link-idempotency.rollback.sql` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/checkout-post-payment-confirmation.md` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/checkout-refresh-reconciliation.md` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/checkout-security-audit.md` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/checkout-states-expiry-recovery.md` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/dependency-security-audit.md` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/manual-shipping.md` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/melhor-envio-local-sandbox-qa.md` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/nextjs-15-security-upgrade.md` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/order-email-controlled-test.md` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `docs/order-paid-claim-outbox.proposed.sql` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/order-paid-claim-outbox.rollback.sql` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/order-paid-event-type.proposed.sql` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/order-paid-event-type.rollback.sql` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `docs/product-migration-before-apply.md` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `docs/product-migration-dry-run.md` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `docs/product-technical-fields.md` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `docs/product-technical-fields.proposed.sql` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `docs/shipping-real-package.md` | novo | I | INTEGRAL | Evidencia tecnica pertinente; SQL e arquivo historico/rollback, nao migration a executar no deploy. |
| `e devolucoes` | novo | K | EXCLUIR | Artefato de git diff colorido (ANSI) de paginas institucionais; nao e fonte executada nem arquivo do release. |
| `lib/admin/auth.test.ts` | novo | E | INTEGRAL | Testes dos guards de autorizacao usados pelo release. |
| `lib/admin/dashboard-model.test.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/admin/dashboard-model.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/admin/dashboard.test.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/admin/dashboard.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/admin/orders.test.ts` | novo | A | DEPENDENCIA | Base de pedidos/detalhe e modelos exigidos pela reconciliacao da Etapa 2; nao e dashboard/produtos paralelo. |
| `lib/admin/orders.ts` | novo | A | DEPENDENCIA | Base de pedidos/detalhe e modelos exigidos pela reconciliacao da Etapa 2; nao e dashboard/produtos paralelo. |
| `lib/admin/product-duplicate.test.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/admin/product-duplicate.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/admin/product-list.test.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/admin/product-list.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/admin/product-migration.test.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/admin/product-navigation.test.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/admin/product-navigation.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/admin/product-search.test.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/admin/product-search.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/admin/reconcile-payment.test.ts` | novo | B | INTEGRAL | Reconciliacao autenticada com referencias oficiais persistidas, sem novo link. |
| `lib/admin/reconcile-payment.ts` | novo | B | INTEGRAL | Reconciliacao autenticada com referencias oficiais persistidas, sem novo link. |
| `lib/admin/schema-safety.test.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/catalog/admin-publication.live.test.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/catalog/database-products.test.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/checkout/confirmation-polling.test.ts` | novo | D | INTEGRAL | Projecao publica, polling e fixtures da confirmacao/pos-pagamento. |
| `lib/checkout/confirmation-polling.ts` | novo | D | INTEGRAL | Projecao publica, polling e fixtures da confirmacao/pos-pagamento. |
| `lib/checkout/confirmation.fixture.ts` | novo | D | INTEGRAL | Projecao publica, polling e fixtures da confirmacao/pos-pagamento. |
| `lib/checkout/confirmation.test.ts` | novo | D | INTEGRAL | Projecao publica, polling e fixtures da confirmacao/pos-pagamento. |
| `lib/checkout/confirmation.ts` | novo | D | INTEGRAL | Projecao publica, polling e fixtures da confirmacao/pos-pagamento. |
| `lib/checkout/http.test.ts` | novo | E | INTEGRAL | Limites, schemas, cache privado, validacao comercial server-side e testes. |
| `lib/checkout/intent.test.ts` | novo | B | INTEGRAL | Intencao persistente, hash comercial e verificacao/reconciliacao compartilhada. |
| `lib/checkout/intent.ts` | novo | B | INTEGRAL | Intencao persistente, hash comercial e verificacao/reconciliacao compartilhada. |
| `lib/checkout/limits.ts` | novo | E | INTEGRAL | Limites, schemas, cache privado, validacao comercial server-side e testes. |
| `lib/checkout/melhor-envio-local-sandbox.ts` | novo | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/checkout/payment-state.test.ts` | novo | C | INTEGRAL | Estados, expiracao e recuperacao conservadora. |
| `lib/checkout/payment-state.ts` | novo | C | INTEGRAL | Estados, expiracao e recuperacao conservadora. |
| `lib/checkout/postal-code-lookup.test.ts` | novo | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/checkout/postal-code-lookup.ts` | novo | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/checkout/postal-code.ts` | novo | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/checkout/recover-intent.test.ts` | novo | C | INTEGRAL | Estados, expiracao e recuperacao conservadora. |
| `lib/checkout/recover-intent.ts` | novo | C | INTEGRAL | Estados, expiracao e recuperacao conservadora. |
| `lib/checkout/security-input.test.ts` | novo | E | INTEGRAL | Limites, schemas, cache privado, validacao comercial server-side e testes. |
| `lib/checkout/shipping-local-sandbox.test.ts` | novo | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/checkout/shipping-messages.test.ts` | novo | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/checkout/shipping-messages.ts` | novo | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/checkout/shipping-postal-code.test.ts` | novo | H | INTEGRAL | Frete real, CEP, parser/erros seguros e suporte QA relacionado; helper Sandbox desativado em production. |
| `lib/checkout/verify-payment.ts` | novo | B | INTEGRAL | Intencao persistente, hash comercial e verificacao/reconciliacao compartilhada. |
| `lib/notifications/order-email.test.ts` | novo | A | DEPENDENCIA | verify-payment importa enqueue order.paid; incluir fonte e testes, envio desativado por ausencia de flag na Netlify. |
| `lib/notifications/order-email.ts` | novo | A | DEPENDENCIA | verify-payment importa enqueue order.paid; incluir fonte e testes, envio desativado por ausencia de flag na Netlify. |
| `lib/notifications/order-paid.test.ts` | novo | A | DEPENDENCIA | verify-payment importa enqueue order.paid; incluir fonte e testes, envio desativado por ausencia de flag na Netlify. |
| `lib/notifications/order-paid.ts` | novo | A | DEPENDENCIA | verify-payment importa enqueue order.paid; incluir fonte e testes, envio desativado por ausencia de flag na Netlify. |
| `lib/orders/fixture.ts` | novo | A | DEPENDENCIA | Base de pedidos/detalhe e modelos exigidos pela reconciliacao da Etapa 2; nao e dashboard/produtos paralelo. |
| `lib/orders/model.test.ts` | novo | A | DEPENDENCIA | Base de pedidos/detalhe e modelos exigidos pela reconciliacao da Etapa 2; nao e dashboard/produtos paralelo. |
| `lib/orders/model.ts` | novo | A | DEPENDENCIA | Base de pedidos/detalhe e modelos exigidos pela reconciliacao da Etapa 2; nao e dashboard/produtos paralelo. |
| `lib/orders/selects.ts` | novo | A | DEPENDENCIA | Base de pedidos/detalhe e modelos exigidos pela reconciliacao da Etapa 2; nao e dashboard/produtos paralelo. |
| `lib/product-characteristics.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `lib/supabase/server.test.ts` | novo | F | INTEGRAL | Compatibilidade Next 15 (APIs assincronas) ou teste correspondente. |
| `public/produtos/anel-perola-natural-ouro-18k-3100.jpg` | novo | J | EXCLUIR | Importacao de imagem paralela; SELECT anon encontrou zero referencias ativas a esse basename; fora do recorte. |
| `publicbanners-categorias/aliancas-banhado-a-ouro.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/aliancas-ouro18k.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/aneis-ouro18k.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/aneis-prata950.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/anel-formatura-ouro18k.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/anel-perola-ouro18k.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/bracelete-ouro18k.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/braceletes-prata950.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/brinco-infantil-ouro18k.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/brincos-ouro18k.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/brincos-prata950.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/correntes-ouro18k.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/correntes-prata950.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/pingentes-ouro18k.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/pingentes-prata950.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/pulseira-infantil-ouro18k.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/pulseiras-ouro18k.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/pulseiras-prata950.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/relogios-femininos.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `publicbanners-categorias/relogios-masculinos.png` | novo | J | EXCLUIR | Copias paralelas de banners fora da pasta publica usada; nao pertencem ao release. |
| `scripts/test-order-email.live.test.ts` | novo | J | EXCLUIR | Feature paralela de produtos/admin/catalogo/Markdown, nao necessaria ao checkout; preservar no worktree. |
| `docs/release-single-deploy-manifest.md` | novo | I | INTEGRAL | Documento de preparacao criado nesta Etapa 6; sem staging ou execucao de release. |
| `docs/release-single-deploy-runbook.md` | novo | I | INTEGRAL | Documento de preparacao criado nesta Etapa 6; sem staging ou execucao de release. |

## Validacoes desta etapa e limites

- npm test: 1081 passaram, 6 live ignorados, 86 arquivos aprovados / 4 ignorados.
- npm run lint: passou, sem avisos/erros ESLint.
- npx tsc --noEmit --incremental false: passou.
- npm run build: passou fora do OneDrive, Next 15.5.28, 40 paginas estaticas.
- git diff --check: passou.
- git show --check f637997: passou.
- Versoes raiz, lock e instalacao atual conferem; nenhuma atualizacao feita.
- Banco/Netlify consultados somente por leitura; nenhum segredo exibido.
- Testes/build acima validam o WORKTREE COMPLETO, que contem features paralelas.
  Ainda NAO validam os blobs do futuro indice seletivo. Essa e uma etapa obrigatoria
  futura antes de commit/push, explicitada no runbook; nao e fingida como concluida.
- Os fontes de runtime usados no build isolado correspondem ao worktree; docs
  desta etapa nao mudam a compilacao.

## Decisao

Preparacao documental e mapeamento concluidos. Nenhum arquivo misto foi incluido
cegamente; nenhum SQL pendente conhecido. O release NAO foi executado e continua
**NO-GO para push agora**: falta autorizacao para staging, montagem/validacao do
recorte isolado, janela/drain e os gates operacionais do runbook.

Ver release-single-deploy-runbook.md para comandos FUTUROS, rollback, smoke sem
pagamento e plano do unico primeiro pagamento real. Nenhum comando de release
nesse documento constitui autorizacao para executa-lo nesta etapa.
