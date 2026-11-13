# Auditoria de seguranca e resistencia do checkout

Data: 2026-11-04. Escopo: Etapa 5 LOCAL, preservando as Etapas 2, 3 e 4.

## Veredito

**BLOQUEADO PARA APROVACAO FINAL/DEPLOY.** Existe um risco ALTO de dependencia
na versao instalada do Next.js (H2 abaixo). Testes funcionais aprovados nao
eliminam essa vulnerabilidade. Nao foi feita atualizacao major nem ataque de DoS.

Nenhuma requisicao real a InfinitePay, Melhor Envio, Resend ou Supabase foi feita
por esta auditoria. Nenhum pedido, pagamento, attempt ou evento real foi criado.
Todos os cenarios financeiros usam fixtures/mocks em memoria; nenhuma RPC foi
executada no banco. Nenhuma configuracao, env, Netlify ou producao foi alterada.

## Modelo de ameacas anterior as correcoes

| Vetor | Impacto potencial | Controle auditado |
| --- | --- | --- |
| Confirmacao financeira falsa, vazamento de service role, dispatch duplicado | CRITICO | payment_check oficial, projecao de respostas, RPC atomica |
| Preco/subtotal/total/frete adulterado; produto inelegivel | ALTO | catalogo autoritativo, schemas estritos, nova cotacao |
| Bypass de admin e exposicao de dados privados | ALTO | claims verificados, membership ativo, DTO publico |
| Quantidades/gravações enormes, abuso e enumeracao | MEDIO | limites de entrada, UUID opaco, erros genericos |
| XSS e CSRF | ALTO se exploraveis | escaping React, templates de e-mail, Server Actions e SameSite |
| Cache de respostas financeiras e duplicacao de analytics | BAIXO a MEDIO | no-store, purchase via outbox, transaction_id estavel |

Severidade potencial nao significa vulnerabilidade encontrada.

## Achados

Total: **7** achados; **0 criticos, 2 altos, 4 medios e 1 baixo**.
Cinco corrigidos localmente. Dois permanecem abertos: H2 e M4.

### H1 - Dados privados na consulta por numero/e-mail - ALTO - CORRIGIDO

`getPublicOrderByCustomer` usava a hidratacao completa, apesar de numero sequencial
e e-mail nao serem prova forte de identidade. O teste reproduziu retorno de endereco,
gravacao e recibo. A consulta agora retorna a mesma projecao publica reduzida da
confirmacao: endereco, personalizacao, recibo e rastreio nulos. A selecao deixa de
carregar esses campos. A rota aplica uma segunda projecao explicita.

O resumo comercial/andamento continua acessivel com numero + e-mail; esse mecanismo
NAO deve ser usado como autenticacao para dados pessoais ou operacoes financeiras.
Prova forte (conta autenticada ou link opaco enviado ao titular) e protecao contra
enumeracao ficam como recomendacao futura, sem criar novo fluxo nesta etapa (M4).

Testes: `orders.test.ts`, `app/api/orders/lookup/route.test.ts`.

### H2 - Next.js vulneravel a DoS em Server Actions - ALTO - ABERTO/BLOQUEANTE

Versao local instalada: **14.2.35**. O projeto usa App Router e Server Actions.
O aviso oficial GHSA-p3m5-59mp-jv5r inclui Next >=13.0.0 e <=15.5.27.
O fornecedor informa correcao em 15.5.28/16.4.1 e ausencia de workaround.

Fonte primaria: https://github.com/vercel/next.js/security/advisories/GHSA-p3m5-59mp-jv5r

Acao necessaria: atualizar para uma linha suportada e corrigida, rever todos os
avisos aplicaveis nessa atualizacao e validar a migracao/compatibilidade Next,
React e plugin Netlify em recorte separado. **Nao instalar apenas uma versao minima
citada sem conferir os avisos posteriores.** Nenhum pacote/lockfile foi alterado.

O aviso critico de imagem GHSA-2464-fhr4-w9xw tambem foi consultado. O projeto usa
`images.unoptimized=true`; nao foi demonstrada exposicao do caminho de otimizacao
nesse estado. O handler instalado em `next-server.js` retorna 404 nesse modo antes
do otimizador. Isso nao remove H2 nem autoriza declarar toda a dependencia segura.

Fonte primaria: https://github.com/vercel/next.js/security/advisories/GHSA-2464-fhr4-w9xw

### M1 - Quantidade sem teto operacional - MEDIO - CORRIGIDO

O schema aceitava 1.000.000 de unidades enquanto o total coubesse no inteiro seguro.
Agora: maximo **10 unidades comerciais por checkout**, somadas entre linhas,
inclusive em linhas repetidas. Schema, validacao do carrinho e calculo de envio
aplicam o mesmo limite; quantidade precisa ser numero inteiro positivo seguro.
Aliança continua sendo um par com quantidade 1 por linha.

Este e um limite de entrada/processamento, NAO estoque e NAO prova de capacidade
da embalagem. O pacote permanece 16x11x3 cm/0,07 kg, sem inferir quantas pecas cabem.
Medicao fisica para sacolas maiores continua sendo uma dependencia operacional.

### M2 - Gravacao sem limite - MEDIO - CORRIGIDO

Entrada acima de 200 caracteres era aceita. O schema server-side e o campo visual
agora limitam a **200 unidades UTF-16**, sem truncar, remover acentos ou normalizar
Unicode. E limite tecnico, nao promessa comercial de que todo texto cabe na joia.
Textos validos com acentos, simbolos e emojis continuam preservados.

### M3 - Mensagem arbitraria de excecao nos logs - MEDIO - CORRIGIDO

`apiError` copiava `Error.message` ao console. Um teste com segredo/PII/SQL sinteticos
falhou antes da correcao. Erros inesperados agora geram somente codigo fixo
`internal_error`, sem texto original. Diagnosticos financeiros por etapa existentes
foram preservados. Mensagens de configuracao podem citar o NOME de uma variavel,
mas nunca seu valor; os erros brutos de provider/SQL nao sao enviados ao cliente.

### M4 - Abuso de APIs e consulta por identidade fraca - MEDIO - ABERTO

Nao existe limitador distribuido de requisicoes no codigo auditado. Um atacante
pode chamar cotacao, lookup, create ou webhook repetidamente e gastar recursos;
UUIDs diferentes sao intencoes diferentes e nao oferecem deduplicacao global.
O lookup numero/e-mail ainda revela resumo comercial a quem conhece essa dupla.

Nao foi criada infraestrutura paralela. Recomendacao: aprovar limites no edge por
IP/rota, observabilidade sem PII e identidade forte para qualquer retorno privado.
Os limites desta etapa nao impedem corpos JSON gigantes antes do parsing nem
substituem protecao de rede. Nao foi simulada carga hostil contra servicos reais.

### L1 - Politica de cache implicita em POSTs - BAIXO - CORRIGIDO

Nao houve demonstracao de vazamento por cache. Ainda assim faltava politica
explicita em create/webhook/quote/cart validate. O helper `checkoutJson` aplica
`Cache-Control: private, no-store, max-age=0` e `Referrer-Policy: no-referrer`.
Todas as respostas dessas rotas, inclusive erros, usam o helper. Lookup,
confirmacao e recuperacao ja tinham no-store e foram preservados.

## Matriz adversarial

| Caso | Evidencia/resultado local |
| --- | --- |
| Preco menor/zero/1 centavo/maior, produto legado e admin-only | 409 price_changed antes da RPC; valor vigente e retornado para revisao |
| Preco negativo | schema rejeita; nenhum pedido/link |
| Subtotal, total, amount, paid_amount, status extras | endpoint create estrito rejeita com 400 |
| Inativo/draft em carrinho antigo | bloqueado, inclusive com flag de fallback ligada |
| Sem preco | pode existir na vitrine; chamada direta ao create e bloqueada |
| UUID inexistente/malformado e outra origem | somente ecommerce_* consultado; erro seguro, sem SQL/stack |
| Slug inexistente | static bloqueia; database resolve ID estavel e usa slug/nome atuais do servidor, nunca os do atacante |
| Quantidades 0/-1/decimal/string/null/NaN/Infinity/enormes | rejeitadas no schema e nos resolvers; JSON converte NaN/Infinity em null, tambem rejeitado |
| Limite operacional e linhas repetidas | soma >10 bloqueada; nao e regra de estoque |
| Overflow e centavos | multiplicacao/soma verificadas; repeticao de 1 centavo exata; numeric do banco convertido sem float financeiro |
| Aliança por par | dois aros 8-35 obrigatorios; limites especificos do produto respeitados; quantidade !=1 bloqueada |
| Gravacao longa/Unicode | excesso bloqueado; Unicode valido mantido |
| HTML/script em gravacao/nome/endereco | SSR e template de e-mail escapam; nenhum script foi executado |
| Frete zero/negativo/menor/maior e prazo falso no payload | campos extras rejeitados; cotacao server-side determina valor/prazo |
| Servico fora da cotacao/allowlist | sem servico elegivel, checkout bloqueado antes da RPC |
| CEP vazio/letras/malformado/inexistente | bloqueado; inexistente nao chega ao Melhor Envio nos mocks |
| ViaCEP/Melhor Envio indisponiveis | erro seguro, sem criar frete substituto |
| 401/403/429/5xx/timeout/JSON invalido e resposta parcial | suites de shipping preservam validos e classificam erros sem token/payload |
| Cotacao antiga e carrinho/preco alterados | servidor recota usando subtotal atual; fingerprint comercial muda; mesma requestId com hash diferente bloqueada |
| Renovacao apenas do UUID/data de cotacao | nao cria intencao nova se dados comerciais nao mudaram |
| Retirada | frete zero, sem provider; endereco/frete escondido em pickup rejeitado |
| Troca entrega/retirada | altera fingerprint; entrega exige servico vigente |
| Replay/concorrencia 2/10/100 | modelos RPC atomicos + instancias de modulo independentes: um unico dispatch para mesma intencao |
| requestIds diferentes | sao intencoes distintas; podem criar compras distintas; nao ha deduplicacao global por cliente/carrinho |
| Duas abas/refresh/reabertura | Web Locks + armazenamento por fingerprint preservam intencao; alteracoes materiais criam outra; estado financeiro nao e decidido pelo browser |
| Paid | create/reconcile/webhook repetidos nao chamam provider de novo; confirmacao e apenas leitura |
| Requires review | nao reabre link; reconcile autenticado so usa referencias persistidas e payment_check oficial |
| Failed | sem reabertura automatica da mesma intencao; nova compra deliberada exige novo ciclo/requestId; revisao humana se houver duvida |
| Dispatch incerto | perda de resposta apos begin_dispatch bloqueia redispatch, inclusive em outra instancia |
| Attempt legada sem marcador | mock preservado sem alteracao; nenhuma recuperacao/backfill; attempt real nao foi acessada |
| Create direto, campos ausentes/extras | mesmas validacoes da UI; nenhum status financeiro do cliente e autoridade |
| Reconcile sem login/nao-admin/admin inativo | bloqueado antes do client service role; FormData financeiro ignorado |
| IDs/referencias diferentes no reconcile | ID UUID validado; dados e referencias lidos do pedido selecionado no servidor; inexistente/sem referencia bloqueado |
| Admin pedidos/produtos | guard server-side nas actions; RLS de produtos preservada; botao oculto nao e autorizacao |
| Token curto/malformado/aleatorio/100 palpites | 404 generico; UUID exato consultado, sem retornar pedido anterior; posse de outro token concede apenas resumo publico daquele token |
| Webhook incompleto/JSON invalido/order falso/referencias falsas | rejeicao segura; referencias conflitantes bloqueiam antes de provider |
| Webhook forjado com amount/status | ignorados; nova confirmacao depende do payment_check oficial |
| Valor pago igual/menor/maior/zero/negativo/decimal/string | somente centavos inteiros exatos e metodo/parcelas elegiveis confirmam; demais review/erro seguro |
| Replay de webhook 2/10/100 simultaneos | uma confirmacao efetiva e eventos unicos no modelo atomico; paid replay nao consulta provider |
| Outbox | UNIQUE(order_id,event_type) e RPCs existentes preservadas; ga4_purchase/erp_financial/order.paid uma vez no modelo; falha de e-mail nao reverte paid |
| Analytics | sem runtime call de purchase GA4 no cliente; Google Ads usa transaction_id estavel, storage e Web Locks; refresh/reabertura cobertos |
| Cache | headers privados explicitos nos endpoints sensiveis; nenhum header global novo |
| Logs/erros | fixtures de PII/segredo/SQL nao chegam a log generico/cliente; diagnosticos estruturados preservados |

Os testes de concorrencia sao simulacoes do contrato SQL previamente instalado,
nao nova prova de carga do PostgreSQL remoto. Os arquivos SQL locais/backup foram
inspecionados para locks, grants e legado; nenhuma RPC foi chamada nesta etapa.

## Autorizacao, CSRF, cookies e XSS

- `requireActiveAdmin` usa `auth.getClaims()` e consulta membership ativo pelo sub
  verificado; visitante, token invalido, nao-admin e admin inativo falham fechados.
- Service role permanece somente em caminhos server-side; nao foi movida ao client.
- Server Actions usam POST e protecao Origin/Host nativa do Next, sem
  `allowedOrigins` amplo. O admin revalida permissao em cada action/helper sensivel.
  Isso protege autorizacao/CSRF, mas NAO corrige o DoS do parser/framework H2.
- O SDK SSR usa SameSite=Lax. HttpOnly=false e parte da integracao com cliente
  Supabase do painel, nao evidencia isolada de bypass. HTTPS/Secure e politica CDN
  devem ser reconferidos no deploy controlado, sem alterar cookies nesta auditoria.
- APIs publicas de checkout nao usam a sessao admin para autorizar writes; CORS/CSRF
  nao sao mecanismo de autorizacao financeira. Abuso por chamadas diretas e M4.
- React interpola textos; nao ha HTML bruto de cliente nos componentes auditados.
  O renderer de e-mail tambem escapa dados. Testes SSR nao executam os payloads.

Fontes primarias consultadas:
- https://nextjs.org/blog/security-nextjs-server-components-actions
- https://nextjs.org/docs/app/api-reference/config/next-config-js/serverActions
- https://supabase.com/docs/guides/auth/server-side/advanced-guide

## Alteracoes somente desta etapa

Runtime:
- `lib/checkout/limits.ts` (novo)
- `lib/checkout/schemas.ts`
- `lib/checkout/catalog.ts`
- `lib/checkout/http.ts`
- `lib/checkout/orders.ts`
- `components/product-purchase-actions.tsx`
- `app/api/cart/validate/route.ts`
- `app/api/shipping/quote/route.ts`
- `app/api/payments/infinitepay/create/route.ts`
- `app/api/payments/infinitepay/webhook/route.ts` (somente resposta HTTP/cache)
- `app/api/orders/lookup/route.ts`

Testes novos:
- `lib/checkout/security-input.test.ts`
- `lib/checkout/http.test.ts`
- `lib/admin/auth.test.ts`
- `components/order-security.test.tsx`
- `app/api/payments/infinitepay/create/security.test.ts`

Testes ampliados:
- `lib/checkout/orders.test.ts`
- `lib/admin/reconcile-payment.test.ts`
- `app/api/orders/[token]/route.test.ts`
- `app/api/orders/lookup/route.test.ts`
- `app/api/payments/infinitepay/webhook/route.test.ts`

Documento: `docs/checkout-security-audit.md`.

## Validacoes

- Regressao vermelha antes da correcao: 6 falhas em privacidade, limites, log e cache;
  depois, todas aprovadas. Cache e defesa explicita, nao vazamento demonstrado.
- `npm test`: **1072 passaram, 6 ignorados**, 88 arquivos (84 aprovados/4 ignorados).
  **79 testes novos** em relacao ao inicio desta etapa; live tests nao executados.
- `npm run lint`: aprovado, sem warnings/erros ESLint.
- `npx tsc --noEmit --incremental false`: aprovado.
- `npm run build`: aprovado na copia isolada fora do OneDrive, sem arquivos .env;
  compilacao, verificacao de tipos e 45 paginas estaticas concluidas. Somente avisos
  preexistentes de Browserslist/cache webpack. Nenhuma dependencia foi atualizada.
- `git diff --check`: aprovado (avisos locais LF/CRLF nao sao erros de whitespace).
- Comparacao SHA-256 local, sem publicar hashes: `.env.local`, `.env.example`,
  `tsconfig.tsbuildinfo`, `package.json` e `package-lock.json` identicos ao inicio.
- Os arquivos de codigo/testes do snapshot e do worktree sao identicos.
- Nenhum identificador `SUPABASE_SERVICE_ROLE_KEY`, `RESEND_API_KEY` ou
  `MELHOR_ENVIO_CLIENT_SECRET` encontrado nos bundles `.next/static/*.js` gerados.
  O snapshot nao contem envs reais; esta verificacao nao substitui inspecao do
  artefato final da hospedagem no deploy autorizado.
- Indice Git vazio; HEAD preservado. Alteracoes anteriores/paralelas fora do recorte
  permanecem intactas; nenhum SQL/catalogo/env/pacote alterado nesta etapa.

## Dependencias para publicacao e limites da conclusao

1. Resolver H2 em atualizacao separada e revalidar antes de aprovar deploy.
2. Teste real de pagamento/webhook e comportamento do provider continuam pendentes
   de autorizacao/deploy; nao foram substituidos por mocks como prova de producao.
3. Politica Pix: desconto nao comprovado financeiramente vai para requires_review;
   esta etapa nao passa a aceitar 10% por inferencia da apresentacao comercial.
4. Sem storage/Web Locks compartilhados, nao se promete um unico envio de analytics;
   transaction_id permite deduplicacao da plataforma, sem afetar o estado financeiro.
5. Nova cotacao pode mudar frete antes da primeira persistencia. O servidor usa o
   valor vigente; nao foi criado novo fluxo de aceite de variacao nesta etapa.
6. Validar empiricamente a capacidade/peso da embalagem por quantidade. Nao se
   inventou peso por produto; insurance_value segue subtotal autoritativo integral.

Nenhum commit, staging, push ou deploy foi feito. A attempt legada real permanece
intacta porque nao houve acesso/escrita de banco nesta etapa. Nao declarar a Etapa 5
aprovada enquanto H2 estiver aberto, mesmo com todas as validacoes funcionais verdes.
