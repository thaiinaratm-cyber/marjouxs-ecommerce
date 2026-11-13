# Runbook do release unico - Marjouxs

Data: 2026-11-04. **PLANO FUTURO. NENHUM COMANDO DE STAGING/RELEASE/ROLLBACK/PAGAMENTO
DESTE DOCUMENTO FOI EXECUTADO.** Exige autorizacao separada no dia da operacao.
Manifesto complementar: release-single-deploy-manifest.md.

## Estado de partida e regra de parada

- main local: f6379978c54c97d270b7ed0b1be98faf3aae1004, um commit nao enviado.
- origin/main local e remoto consultado: b37690c797c21591b8bc5e3d7fb7bea19469cdb0.
- Futuro commit seletivo: <NOVO_RELEASE_SHA>, ainda NAO existe.
- Publicacao planejada: UM push com os dois commits, UM build/deploy automatico.
- Deploy automatico de main ja confirmado ativo; reconfirmar no preflight, sem
  editar configuracao nem disparar deploy manual.
- Nao usar deploy manual de pasta local, git add . / -A, force push, reset --hard,
  checkout/restore globais, clean ou descarte de mudancas.
- Se remoto/HEAD/conteudo mudou desde a fotografia, PARAR e revisar antes de stage.
- Indice deve iniciar vazio; depois de stage deve conter somente os 126 caminhos
  aprovados; depois do commit deve voltar a vazio. Worktree paralelo pode continuar sujo.
- Um teste verde no worktree completo NAO valida automaticamente o indice seletivo.

## 1. Preflight do dia do deploy

1. Obter autorizacao explicita para preparar indice/commit/push e alterar SOMENTE
   as quatro envs de embalagem. Pagamento real exige outra autorizacao posterior.
2. Confirmar creditos Netlify renovados e suficientes para um build; nao consumir
   credito com redeploy/teste manual antes do push unico.
3. Confirmar branch main, HEAD, parent, origin/main REAL e ahead/behind.
4. Confirmar indice vazio e registrar/guardar mudancas paralelas sem remove-las.
5. Revisar o manifesto, os 7 mistos e a fronteira dos pre-requisitos pedidos/outbox.
6. Confirmar Node 22.x; ultimo build conhecido 22.23.3. Next 15.5.28/React
   19.3.1/Zod 4.6.6 devem continuar exatos. Node 22.x e compativel com Next
   15.5.28. Nao atualizar dependencias agora.
7. Confirmar por leitura a configuracao essencial ja existente e escopos
   Builds/Functions, sem copiar secrets. CHECKOUT_CATALOG_SOURCE ja e database;
   nao alterar para static nem confundir com o default static da biblioteca.
8. Confirmar ausencia/false de ORDER_NOTIFICATIONS_ENABLED. E-mail esta fora do
   escopo ATIVO deste primeiro deploy, embora seus modulos sejam dependencia do enqueue.
9. Confirmar RPCs/grants/checksums e outbox pelos SELECTs read-only auditados.
   Qualquer divergencia e NO-GO, nao motivo para reinstalar SQL automaticamente.
10. Confirmar attempt legada preservada e selecionar janela de drain/contencao.
11. So prosseguir se nenhum arquivo/incerteza/migration nova exigir aprovacao.

Consultas Git somente leitura sugeridas:

```powershell
git branch --show-current
git rev-parse HEAD
git rev-parse origin/main
git ls-remote --exit-code origin refs/heads/main
git rev-list --left-right --count HEAD...origin/main
git status --short --untracked-files=all
git diff --cached --name-status
git show --check f6379978c54c97d270b7ed0b1be98faf3aae1004
```

Nao usar fetch/rebase/stash por rotina nesta janela se o estado esperado nao mudou.
Se remoto mudou, parar e planejar integracao separada, preservando o worktree.

## 2. Staging FUTURO: lista explicita e ordem

1. Pre-requisitos orders/notifications e testes; sao necessarios a verify-payment.
2. Etapas 2/3/4/5, frete e respectivos testes/documentos.
3. Mudancas Next-only em paginas existentes, cookies e testes.
4. Montar os 7 blobs parciais, incluindo o par de manifests de dependencias.
5. Revisar o indice e exportar candidato isolado. NAO commitar antes da validacao.

Lista exata de 119 caminhos integrais/pre-requisitos. O comando abaixo e somente
para uso FUTURO autorizado; nao e um script automatico para executar agora:

```powershell
$releaseWholeFiles = @(
  'app/acompanhar-pedido/page.tsx',
  'app/admin/(protected)/produtos/novo/page.tsx',
  'app/admin/login/page.tsx',
  'app/aneis/[material]/[[...tipo]]/page.tsx',
  'app/api/address/lookup/route.test.ts',
  'app/api/address/lookup/route.ts',
  'app/api/cart/validate/route.ts',
  'app/api/orders/[token]/route.test.ts',
  'app/api/orders/[token]/route.ts',
  'app/api/orders/lookup/route.test.ts',
  'app/api/orders/lookup/route.ts',
  'app/api/payments/infinitepay/create/route.ts',
  'app/api/payments/infinitepay/webhook/route.test.ts',
  'app/api/payments/infinitepay/webhook/route.ts',
  'app/api/shipping/quote/route.ts',
  'app/categorias/[slug]/page.tsx',
  'app/checkout/page.tsx',
  'app/pedido/confirmacao/page.tsx',
  'app/produtos/page.tsx',
  'components/order-confirmation.tsx',
  'components/order-summary.tsx',
  'components/product-purchase-actions.tsx',
  'lib/checkout/catalog-server.test.ts',
  'lib/checkout/catalog.ts',
  'lib/checkout/checkout-form.test.ts',
  'lib/checkout/checkout-form.ts',
  'lib/checkout/config.test.ts',
  'lib/checkout/config.ts',
  'lib/checkout/create-checkout-idempotency.audit.test.ts',
  'lib/checkout/create-checkout.test.ts',
  'lib/checkout/create-checkout.ts',
  'lib/checkout/diagnostics.test.ts',
  'lib/checkout/diagnostics.ts',
  'lib/checkout/hash.ts',
  'lib/checkout/http.ts',
  'lib/checkout/infinitepay.test.ts',
  'lib/checkout/infinitepay.ts',
  'lib/checkout/orders.test.ts',
  'lib/checkout/orders.ts',
  'lib/checkout/outbox.test.ts',
  'lib/checkout/outbox.ts',
  'lib/checkout/schemas.ts',
  'lib/checkout/shipping.test.ts',
  'lib/checkout/shipping.ts',
  'lib/google-ads.test.ts',
  'lib/google-ads.ts',
  'lib/order-status.test.ts',
  'lib/order-status.ts',
  'lib/supabase/server.ts',
  'next-env.d.ts',
  'app/admin/(protected)/pedidos/[id]/page.tsx',
  'app/admin/(protected)/pedidos/actions.ts',
  'app/admin/(protected)/pedidos/error.tsx',
  'app/admin/(protected)/pedidos/page.tsx',
  'app/admin/(protected)/pedidos/pages.test.tsx',
  'app/admin/(protected)/pedidos/reconcile-action.test.ts',
  'app/api/checkout/intent/route.ts',
  'app/api/payments/infinitepay/create/security.test.ts',
  'app/next15-compatibility.test.tsx',
  'components/order-confirmation.test.tsx',
  'components/order-security.test.tsx',
  'docs/admin-orders-audit.md',
  'docs/admin-orders-schema-audit.sql',
  'docs/admin-orders-validation.md',
  'docs/checkout-link-idempotency-audit.md',
  'docs/checkout-link-idempotency.proposed.sql',
  'docs/checkout-link-idempotency.rollback.sql',
  'docs/checkout-post-payment-confirmation.md',
  'docs/checkout-refresh-reconciliation.md',
  'docs/checkout-security-audit.md',
  'docs/checkout-states-expiry-recovery.md',
  'docs/dependency-security-audit.md',
  'docs/manual-shipping.md',
  'docs/melhor-envio-local-sandbox-qa.md',
  'docs/nextjs-15-security-upgrade.md',
  'docs/order-paid-claim-outbox.proposed.sql',
  'docs/order-paid-claim-outbox.rollback.sql',
  'docs/order-paid-event-type.proposed.sql',
  'docs/order-paid-event-type.rollback.sql',
  'docs/shipping-real-package.md',
  'lib/admin/auth.test.ts',
  'lib/admin/orders.test.ts',
  'lib/admin/orders.ts',
  'lib/admin/reconcile-payment.test.ts',
  'lib/admin/reconcile-payment.ts',
  'lib/checkout/confirmation-polling.test.ts',
  'lib/checkout/confirmation-polling.ts',
  'lib/checkout/confirmation.fixture.ts',
  'lib/checkout/confirmation.test.ts',
  'lib/checkout/confirmation.ts',
  'lib/checkout/http.test.ts',
  'lib/checkout/intent.test.ts',
  'lib/checkout/intent.ts',
  'lib/checkout/limits.ts',
  'lib/checkout/melhor-envio-local-sandbox.ts',
  'lib/checkout/payment-state.test.ts',
  'lib/checkout/payment-state.ts',
  'lib/checkout/postal-code-lookup.test.ts',
  'lib/checkout/postal-code-lookup.ts',
  'lib/checkout/postal-code.ts',
  'lib/checkout/recover-intent.test.ts',
  'lib/checkout/recover-intent.ts',
  'lib/checkout/security-input.test.ts',
  'lib/checkout/shipping-local-sandbox.test.ts',
  'lib/checkout/shipping-messages.test.ts',
  'lib/checkout/shipping-messages.ts',
  'lib/checkout/shipping-postal-code.test.ts',
  'lib/checkout/verify-payment.ts',
  'lib/notifications/order-email.test.ts',
  'lib/notifications/order-email.ts',
  'lib/notifications/order-paid.test.ts',
  'lib/notifications/order-paid.ts',
  'lib/orders/fixture.ts',
  'lib/orders/model.test.ts',
  'lib/orders/model.ts',
  'lib/orders/selects.ts',
  'lib/supabase/server.test.ts',
  'docs/release-single-deploy-manifest.md',
  'docs/release-single-deploy-runbook.md'
)
git --literal-pathspecs add -- $releaseWholeFiles
```

### Arquivos parciais

- `.env.example`
- `app/admin/(protected)/layout.tsx`
- `app/admin/(protected)/produtos/[id]/page.tsx`
- `app/admin/(protected)/produtos/page.tsx`
- `app/produtos/[slug]/page.tsx`
- `package-lock.json`
- `package.json`

Usar git add -p nos seis arquivos de texto apropriados, com split/edit quando
o hunk juntar alteracoes. Exemplo futuro:

```powershell
git --literal-pathspecs add -p -- "app/produtos/[slug]/page.tsx"
git --literal-pathspecs add -p -- "app/admin/(protected)/produtos/page.tsx"
git --literal-pathspecs add -p -- "app/admin/(protected)/produtos/[id]/page.tsx"
git --literal-pathspecs add -p -- "app/admin/(protected)/layout.tsx"
git --literal-pathspecs add -p -- ".env.example"
git --literal-pathspecs add -p -- "package.json"
```

Nao aceitar o hunk inteiro se ele carregar Markdown, caracteristicas tecnicas,
duplicacao, product-navigation, dashboard, scripts de migracao ou imports paralelos.
O manifesto identifica linhas/ancoras exatas. O recorte Next-only nao depende de
product-navigation.ts: conservar consultas, JSX e imports do HEAD, alterando
somente os tipos/await especificados.

### Lockfile: equivalente seguro somente no indice

O package-lock.json atual NAO pode ser adicionado integralmente.
A preparacao futura deve gerar em pasta externa um par de manifests coerente:
sete versoes aprovadas, sem react-markdown/scripts de migracao; remover somente
79 registros exclusivos de Markdown e recalcular as seis flags dev compartilhadas
identificadas no manifesto, sem mudar versoes/resolved/integrity restantes.
Partir de package.json do HEAD com os sete pins e do lock local auditado.
Remover react-markdown da raiz do lock, conferir as 520 entradas restantes e
verificar que nao restaram dependencias orfas ou resolucoes divergentes.
Nao instalar/desinstalar pacotes no worktree para facilitar esse recorte.

Apos validar o arquivo externo, uma importacao do blob via hash-object/update-index
pode ser usada como equivalente a staging parcial, SOMENTE sob autorizacao futura.
Nao executar nesta etapa. Nao selecionar pedacos aleatorios do lockfile.

Se o resultado nao for coerente, npm ci falhar ou surgir nova versao transitiva:
PARAR. Nao usar audit fix, npm update, force ou incluir Markdown para "passar".

## 3. Revisao obrigatoria do indice e candidato isolado

```powershell
git diff --cached --stat
git diff --cached --name-only
git diff --cached --name-status
git diff --cached
git diff --cached --check
git status --short
```

Comparar o conjunto exato com os 119 integrais + 7 parciais; nenhum caminho a mais
ou a menos. Revisar conteudo, nao apenas nomes. Confirmar explicitamente:

- Sem dashboard/produtos paralelo, Conforto/Estrutura, normalizacao tecnica ou Markdown.
- Sem banners novos, exclusao de anel-teste-01.jpg ou imagem de importacao nao relacionada.
- Sem .env.local, outros secrets, .next, node_modules, tsconfig.tsbuildinfo,
  logs, screenshots, temporarios ou saida colorida de diff.
- Nenhuma nova migration/cron/ERP/fiscal. SQLs docs sao historicos, nao executados.
- .env.example contem so o recorte aprovado de medidas, sem secrets.
- O app/admin/page.tsx do HEAD continua; nao adicionar o dashboard protegido /admin
  sem remover a rota original, pois isso criaria conflito. Neste recorte nao entra nenhum dos dois hunks do dashboard.
- E-mail continua desativado; o enqueue/order.paid existente permanece consistente.

Exportar SOMENTE o indice para uma pasta nova fora do OneDrive, nao copiar o
worktree inteiro como se fosse candidato. Exemplo futuro apos staging autorizado:

```powershell
$candidateRoot = Join-Path $env:TEMP ("marjouxs-release-" + [guid]::NewGuid())
New-Item -ItemType Directory -Path $candidateRoot | Out-Null
$gitPrefix = $candidateRoot.Replace('\','/') + '/'
git checkout-index --all --prefix=$gitPrefix
```

Esse checkout-index exporta para a pasta externa; nao muda o worktree original.
Conferir paths e destino antes de executar. Nao copiar .env.local nem credenciais.
Usar envs sinteticas/mocks para testes; nenhum live opt-in.

No candidato isolado, executar e registrar:

```powershell
npm ci --ignore-scripts --no-audit --no-fund
npm ls next react react-dom eslint-config-next @types/react @types/react-dom zod --depth=0
npm test
npm run lint
npx tsc --noEmit --incremental false
npm run build
```

O npm ci deve usar o lock selecionado sem atualizar versoes. Nao apagar testes
do HEAD para resolver falhas. Registrar quantidade de testes do RECORTE; nao
fingir que os 1081 testes do worktree completo pertencem todos ao candidato.
Devem permanecer cobertos idempotencia, seguranca, frete, estados, confirmacao e auth.

A validacao desta Etapa 6 foi do worktree completo: 1081 passaram/6 ignorados,
lint/TypeScript/build/diff-check verdes. O candidato seletivo ainda nao foi
montado/testado, por ordem expressa de nao fazer staging nesta etapa.

## 4. Commit futuro e verificacao

Mensagem sugerida:

```text
feat: consolida checkout seguro e release Next 15
```

Apenas apos todos os gates do indice/candidato:

```powershell
git commit -m "feat: consolida checkout seguro e release Next 15"
git show --stat --oneline HEAD
git show --check HEAD
git diff HEAD^ HEAD
git diff --name-status b37690c797c21591b8bc5e3d7fb7bea19469cdb0..HEAD
git status --short --branch
git diff --cached --name-status
git log --oneline origin/main..HEAD
```

Esperado: DOIS commits nao enviados, f637997 e o novo release, nessa ordem.
Anotar <NOVO_RELEASE_SHA>; conferir parent f637997. Uniao de 133 caminhos distintos.
Indice vazio depois do commit, com as alteracoes paralelas ainda preservadas.
Se houver commit extra/hunk paralelo: PARAR; nunca force push.

## 5. Quatro envs de frete, antes do push autorizado

| Env | Atual/rollback | Novo |
| --- | --- | --- |
| DEFAULT_SHIPMENT_LENGTH_CM | 16 | 16 |
| DEFAULT_SHIPMENT_WIDTH_CM | 12 | 11 |
| DEFAULT_SHIPMENT_HEIGHT_CM | 6 | 3 |
| DEFAULT_SHIPMENT_WEIGHT_KG | 0.3 | 0.07 |

Editar SOMENTE essas quatro variaveis existentes, preservando escopos/contextos
aprovados. Hoje sao All scopes / Same value in all deploy contexts.
Registrar o antes/depois SEM exportar secrets nem importar .env.local completo.
Comprimento nao muda de fato; deve ser reconfirmado. O peso e em kg, nao 70.

Nao tocar token, Vault, Client Secret, base URL, allowlist de transportadoras,
fontes de catalogo, Resend, GA4/Ads ou Node. Nenhuma nova env e exigida.
Next/Zod e as Etapas 2-5 usam as configuracoes existentes.

Salvar envs nao e prova de atualizacao do artefato ja publicado: Netlify aplica
as mudancas por novo build/deploy. Nao clicar em Trigger deploy/Retry/Clear cache
nesse momento; as envs devem ser consumidas pelo UNICO build do push planejado.
Fonte: https://docs.netlify.com/build/environment-variables/get-started/

## 6. Drain operacional: antes de trocar runtime

1. Definir operador, janela, responsavel financeiro e mecanismo de contencao
   previamente aprovado. O repositorio NAO possui uma flag global de manutencao
   que bloqueie create; esconder CTA ou pedir ao cliente para nao clicar nao basta.
2. Se nao houver mecanismo autorizado capaz de impedir novas chamadas a
   POST /api/payments/infinitepay/create durante a janela: NO-GO para uma troca que
   dependa de drain. Nao inventar uma nova env, regra Netlify ou feature nesta etapa.
3. Pausar novos criadores no ponto de entrada/edge autorizado. Manter webhook
   de pagamentos existentes e leituras de confirmacao acessiveis; nao descartar
   uma notificacao financeira legitima para conseguir um contador zero.
4. Esperar requests de create/dispatch em voo terminarem, usando logs/metricas
   sanitizados e nova consulta read-only de estados. Nao usar somente um sleep.
5. Lease SQL e 2 minutos antes de dispatch. Esperar a lease NAO torna dispatched
   seguro para redispatch nem prova ausencia de pagamento no provider.
6. Confirmar zero novos creating/reserved/dispatched ou conflitos/resultado incerto
   que nao tenham sido reconciliados por processo humano aprovado.
7. Excluir SOMENTE a excecao 6d743776...e00c desses contadores de "novo dispatch",
   depois de confirmar novamente seu hash/estado. Nao altera-la ou usa-la em teste.
8. Se aparecer novo dispatch incerto: manter bloqueio de criacao, preservar linhas
   e pedir aprovacao de reconciliacao separada. Nao expirar/failed/backfill automatico.
9. Tratar workers antigos que ignoram a RPC como incompatibilidade operacional:
   nao presumir seguranca distribuida enquanto eles ainda podem criar links.
10. Confirmar que o outbox worker preexistente e o ERP nao sao criadores de links;
    nao criar outro scheduler. Se rollback SQL for cogitado, considerar tambem
    consumidores de outbox/pagamento em voo e parar apenas sob plano aprovado.

Fotografia desta auditoria: outros creating=0, novas reservas=0, novos dispatched=0.
Essa fotografia nao substitui o drain no dia do deploy.

## 7. Push unico e deploy automatico unico

Depois de commit revisado, envs aplicadas, drain confirmado e autorizacao:

```powershell
git ls-remote --exit-code origin refs/heads/main
git status --short --branch
git log --oneline origin/main..HEAD
git push origin main
```

Nao enviar f637997 separadamente; nao pushar durante preparo intermediario.
Nao usar force. Se houver non-fast-forward, PARAR e planejar integracao separada,
sem rebase automatico com worktree sujo.

Acompanhar somente o deploy automatico do tip <NOVO_RELEASE_SHA>.
Confirmar branch/main, SHA, Node 22.x e versoes do build, functions corretas e
sucesso. Nao disparar deploy manual extra, retry ou clear-cache por rotina.
Se build falhar, registrar a causa; nao gastar novo deploy sem decisao aprovada.

Nao mudar config de auto-publish para tentar simular drain. Uma trava de
publicacao nao bloqueia chamadas de checkout nem impede a cobranca de builds.

## 8. Smoke pos-deploy SEM pedido/link/pagamento real

Executar nesta ordem, registrando horario, SHA e resultado seguro:

| Caso | Verificacao |
| --- | --- |
| A Home | HTTPS canonico, HTTP 200, catalogo carrega, sem excecao |
| B Produto | Produto ativo com preco, imagem existente, 12x/Pix comercial sem mudar regra financeira |
| C Sacola | Adicionar somente item local, quantidade/preco corretos, personalizacao preservada |
| D Frete | Cotar CEP valido aprovado, transportadora/allowlist reais, transporte separado de confeccao 3-5, subtotal + frete = total uma vez |
| E Checkout | Abre, entrega/retirada alternam, retirada frete zero e sem nova chamada ao Melhor Envio; NAO submeter pagamento |
| F Admin-only ativo | Usar produto ja ativo/aprovado; vitrine/busca/categoria/URL e cart validate aceitam se elegivel, sem criar checkout |
| G Sem preco | Vitrine sob consulta; cart validate bloqueia. NAO chamar create para testar |
| H Admin login | Visitante bloqueado e sessao legitima ativa aceita; sem compartilhar credenciais |
| I Admin pedido | Abrir lista/detalhe existente autorizado; nao clicar Salvar status ou Reconciliar |
| J Confirmacao invalida | /pedido/confirmacao?token=invalido mostra ajuda segura; API invalida 404 generico; sem polling infinito |
| K Webhook GET | GET HTTPS /api/payments/infinitepay/webhook deve ser 405 (so POST e exportado); nunca enviar POST sintetico a pedido real |
| L Canonical | https://marjouxsjoias.com.br, sem localhost, 127.0.0.1, http, www ou porta |
| M Metadata | title/description/canonical coerentes; checkout/admin/confirmacao privados/noindex como definidos |
| N Runtime | Sem hydration error, erro React, 500 inesperado ou overflow relevante |

Nao ativar/publicar fixture para completar F/G. Se faltar produto real aprovado
adequado, registrar teste pendente e obter autorizacao separada; nao fingir validacao.
Nao usar o anel-feminino inativo nem a attempt legada como fixture.

Para frete: registrar resposta ATUAL, nao esperar tarifa Sandbox de R$ 9,94.
insurance_value continua subtotal autoritativo. Nao assumir ID 2 em producao.
Confirmar 16x11x3/0.07 na configuracao efetiva e contrato testado; nao adicionar
log de token/endereco/payload bruto para tentar provar isso.

Antes/depois do smoke, SELECTs de contagem/watermark devem provar que nao houve
novo order/payment attempt/outbox causado pelo smoke; considerar atividade
legitima de outros compradores separadamente pelo horario, sem publicar PII.
Monitorar que nao houve chamada /links ou payment_check por esse roteiro.
A API cart validate/consulta de intencao e read-only; nao usar create em seu lugar.

## 9. GO / NO-GO

GO somente apos:
- SHA/branch/deploy e versoes corretos.
- Home 200, produto/sacola/checkout funcionam e frete correto.
- Admin protegido abre e detalhe nao falha.
- Webhook publico responde 405 ao GET, contrato POST preservado.
- Canonical/metadata/privacidade corretos; nenhuma regressao runtime.
- Nenhuma escrita inesperada de pedido/attempt/outbox durante smoke.
- Nenhuma chamada InfinitePay real ainda.
- Drain/contencao liberados de forma controlada, sem novo dispatch incerto.
- Registros de cada teste completos, sem passar por suposicao.

Qualquer desvio relevante: NO-GO. Nao tentar pagamento para "ver se funciona",
nao contornar validação, nao reinstalar RPCs nem alterar catalogo para esconder erro.
Investigar primeiro; escolher contencao/rollback com responsavel autorizado.

## 10. Rollback de codigo: preferir artefato atomico, sem build extra

Referencia anterior conhecida:
- Commit b37690c797c21591b8bc5e3d7fb7bea19469cdb0.
- Deploy publicado conhecido 6ad26fec6eeadb743e34ebb0 (confirmar ainda disponivel).
- f637997 e local, NAO e o artefato anterior publicado.

Em incidente: conter novos criadores e preservar evidencias/linhas financeiras.
Se autorizado e o artefato anterior ainda estiver disponivel, publicar esse
deploy existente na Netlify. Isso republica um artefato atomico, sem novo build.
Nao apertar Retry/Trigger deploy e nao fazer revert+push ao mesmo tempo.
Fonte: https://docs.netlify.com/deploy/manage-deploys/manage-deploys-overview/

**Risco importante:** b37690c usa a linha antiga do framework e runtime que nao
participa do protocolo novo. Rollback pode reintroduzir o GHSA corrigido e perder
travas de recuperacao. Nao chamar esse estado de "seguro" nem reabrir checkout
automaticamente. Manter contencao ate decisao explicita de risco/hotfix.

Se for necessario alinhar Git posteriormente, planejar revert em worktree limpo
separado, nao mexer no worktree paralelo. Exemplo conceitual FUTURO:

```text
criar worktree/branch codex/rollback-payment-release a partir de origin/main
git revert --no-commit <NOVO_RELEASE_SHA> f6379978c54c97d270b7ed0b1be98faf3aae1004
revisar conflitos, dependencias, seguranca, diff e testes
criar commit de reversao somente apos autorizacao
```

Nao executar nem inventar <NOVO_RELEASE_SHA>. Se houver conflito, analisar cada
arquivo; nunca resolver negocio automaticamente com ours/theirs.
Um futuro push desse revert dispara outro build: so executar se esse novo deploy
for deliberadamente escolhido, nao como duplicacao do rollback atomico.

Auto-publish pode substituir o deploy restaurado quando houver push novo.
Trava de publicacao, se necessaria, e uma decisao operacional separada aprovada;
ela nao impede builds nem substitui bloqueio de criacao de checkout.

## 11. Rollback de env

Restaurar SOMENTE os quatro valores anteriores da tabela da secao 5, nos mesmos
escopos/contextos aprovados; nada em .env.local, Vault ou outras envs.
Nao recalcular pedidos/cotacoes ja persistidos.

A alteracao do painel so afeta novo build/deploy. Um artefato antigo possui o
snapshot/configuracao da sua publicacao. Se o rollback atomico ja restabelece
a versao anterior, nao criar build adicional apenas para "sincronizar env".
Restaurar o estado futuro do painel para evitar que o proximo build use medidas
nao desejadas. Rollback apenas de env mantendo codigo atual pode exigir um novo
deploy: precisa de decisao/autorizacao separada, nunca e considerado instantaneo.

## 12. Rollback de banco: NAO automatico

Nao reverter automaticamente:
- ecommerce_checkout_link_transition.
- ecommerce_create_checkout com inicializacao do marcador.
- ecommerce_confirm_payment, ecommerce_fail_payment_attempt, ecommerce_set_checkout_link.
- Correcoes COALESCE e RPCs de claim/complete/fail de outbox.
- Constraint que aceita order.paid, nem eventos/linhas financeiras ja criados.

Codigo revertido nao desfaz pagamento externo nem autoriza apagar pedidos/outbox.
Nao restaurar backup inteiro do banco por falha visual.

Qualquer rollback SQL exige aprovacao nova, backups atuais, contratos/owners/grants
revisados, ausencia de writers/requests/claims em voo, inventario de TODAS as
attempts do protocolo novo e tratamento humano de resultado incerto.
Depois do primeiro dispatch novo, remover a RPC/marcador sem reconciliacao pode
permitir segunda cobranca: NO-GO.

O arquivo historico checkout-link-idempotency.rollback.sql tem guarda contra
qualquer creating; a attempt legada conhecida ainda pode impedir sua execucao.
A excecao aprovada para contagem operacional NAO autoriza editar/contornar essa
guarda ou recuperar a attempt. Nao executar esse arquivo por rotina.

## 13. Primeiro pagamento real: PLANO, nao execucao

Somente apos GO do smoke e autorizacao explicita com operador, valor maximo,
produto/meio e dados legitimos preenchidos pelo proprio responsavel.
Agendar separadamente do deploy: primeiro deploy, depois smoke e GO, e somente
entao pagamento autorizado. Nenhum pagamento faz parte do smoke.
Nunca enviar senha, cartao, CPF, token ou dados pessoais no chat.

Estrategia:
- Produto REAL existente, ativo, elegivel e de baixo valor. Confirmar nome/ID/preco
  vigente no dia, sem criar produto de R$ 1, editar preco ou usar fixture.
- Preferir retirada, frete zero, para isolar o pagamento do transporte.
- UM pedido, UMA attempt e UM pagamento. Nenhuma tentativa concorrente ou repetida.
- Se o objetivo for comprovar a representacao de desconto Pix, escolher Pix como
  UNICO meio desse teste; nao fazer Pix + cartao na mesma janela.
- Se escolher cartao em vez de Pix, a regra Pix continua NAO comprovada e nao pode
  ser liberada com base nesse pagamento.

### Antes

1. Registrar SHA/deploy/envs nao secretas e baseline read-only de orders,
   attempts e outbox, com horario/watermarks e estado do legado inalterado.
2. Anotar subtotal, frete zero, total-base em centavos e price_changed, se ocorrer.
   Preco mudou? Revisar conscientemente antes de criar; nao burlar a confirmacao.
3. Registrar a intencao/requestId em local seguro. Nenhuma PII em logs/prints publicos.
4. Confirmar que nenhum link/pagamento desse teste existe; se houver duvida, PARAR.
5. Autorizar o UNICO submit que cria o link. Nao testar /links manualmente.
6. O operador humano conclui o pagamento no ambiente oficial da InfinitePay.

### Depois: observar, nao forcar estados

- order: subtotal, shipping, total, payment_status, order_status.
- payment_attempt: status, order_nsu, provider_checkout_id, transaction_nsu.
- amount, paid_amount, capture_method, installments; todos oficiais e em centavos.
- webhook recebido, resultado do payment_check e decisao do verificador compartilhado.
- RPC confirm_payment: paid somente quando contrato/referencias/valores validarem.
- Outbox: UNIQUE por order/event; ga4_purchase/erp_financial e order.paid conforme
  contrato. ERP/financeiro podem ter efeitos reais: observar, nao editar por SQL.
- Admin lista/detalhe, confirmacao publica e ausencia de PII nessa pagina.
- GA4 purchase server-side/outbox e Google Ads conversion por transaction_id;
  refresh nao deve gerar segunda cobranca. Latencia do painel nao autoriza reenvio.
- E-mail: DESATIVADO neste plano. order.paid pending e esperado; nao habilitar
  Resend nesta janela para tentar "fechar" o teste.

### Pix conservador

Nao codificar 10% como regra financeira antes da evidencia oficial.
Comparar amount, paid_amount e capture_method reais; desconto na vitrine nao e
prova suficiente de que o valor menor pode confirmar o pedido.

Se retornar requires_review/payment_pix_discount_unverified ou outra divergencia:
PARAR, registrar a observacao sanitizada e pedir revisao/aprovacao da regra.
Nao marcar paid manualmente, nao alterar SQL, nao pagar novamente, nao criar outro
requestId ou link para "resolver". Um resultado em revisao pode ser o comportamento
correto e conservador deste teste, nao motivo para remover validacoes.

### Fronteiras de parada

Timeout, retorno perdido, dispatch_uncertain, referencia ausente, amount invalido,
conflito, pedido duplicado, erro 5xx ou ausencia de confirmacao autoritativa:
nao repetir criacao/pagamento. Preservar referencia e abrir investigacao.
Nao inventar transaction_nsu nem consultar provider com IDs da URL nao persistidos.
Reconciliacao manual posterior exige autorizacao e referencias oficiais completas.
Nao tocar a attempt legada conhecida.

## 14. Registro final da operacao FUTURA

Documentar SHA/deploy/Node, gates, envs de frete antes/depois, checksums RPC,
drain, smoke, baseline/delta de banco, uma referencia publica sanitizada e decisao.
Nao registrar secrets, payload bruto, endereco, telefone, email ou CPF do cliente.

Esta Etapa 6 executou apenas leitura, documentacao e testes locais com mocks.
Nenhum stage, commit, push, deploy, alteracao de Netlify/env/banco/RPC/catalogo,
chamada real /links/payment_check, webhook real ou pagamento foi realizado.
