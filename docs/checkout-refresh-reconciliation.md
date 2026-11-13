# Checkout: refresh e reconciliacao manual (Etapa 2 local)

## Auditoria anterior

O `requestId` era criado com `crypto.randomUUID()` no submit e mantido somente
em `useRef`. Reenvios no mesmo mount eram idempotentes, mas refresh, remontagem
ou outra aba podiam gerar uma chave nova. O teste de auditoria que cria duas
chaves diferentes continua documentando esse limite do contrato do servidor.

Resposta sobre o risco anterior: **DEPENDE**. Refresh seguido de novo submit
com outra chave podia criar outro pedido, outra attempt e outro link.
Reenviar a chave anterior com a mesma compra reaproveitava o link persistido.

## Intencao por aba

`marjouxs-checkout-intent-v1`, no `sessionStorage`, guarda somente:

- versao do formato;
- UUID opaco de `requestId`;
- SHA-256 do contexto comercial normalizado.

Nao guarda nome, email, CPF, telefone, endereco, itens, precos, link de pagamento,
token publico do pedido, token do provider ou credenciais. O hash nao autoriza
pagamento: o servidor continua recalculando catalogo, frete e total.

A duracao e a da sessao da aba. Nao ha prazo artificial que gere outro pedido
enquanto uma intencao pendente ainda e reaproveitavel. Fechar a sessao da aba
encerra essa garantia local; nao existe busca publica por dados do cliente.

Campos do formulario nao sao persistidos. Apos refresh, pode ser necessario
preenche-los novamente; dados normalizados iguais recuperam a mesma intencao.
Falha/bloqueio/corrupcao do storage interrompe o submit antes de criar pedido.
Falha HTTP ou resposta perdida nao apagam a intencao.

Uma aba nova independente tem outra intencao. Uma aba duplicada pode herdar o
sessionStorage; nesse caso, a RPC distribuida continua impedindo dois dispatches
para a mesma chave. Nao usamos localStorage compartilhado entre compradores.

Entre as alternativas, sessionStorage + a idempotencia server-side ja instalada
e o menor recorte: localStorage compartilharia intencoes entre abas; cookie
HttpOnly exigiria um protocolo adicional para associar o contexto comercial;
lookup server-side ainda precisaria de um identificador persistido, sem buscar
clientes por dados pessoais. Nenhuma dessas camadas extras foi adicionada.

## Mudancas materiais e reaproveitamento

Itens, quantidades, precos, personalizacoes (incluindo Unicode), cliente,
endereco/CEP, modalidade, servico, frete e total participam da identidade.
Os IDs ja existentes das linhas da sacola distinguem uma compra nova depois
que a sacola anterior foi encerrada, sem alterar o formato do carrinho.

UUID/data de uma nova cotacao nao sao mudancas comerciais. O hash do servidor
tambem ignora esse UUID e inclui o frete/total revalidados. Uma mudanca efetiva
no servidor com chave antiga causa conflito, nao reaproveitamento de valor
antigo nem criacao silenciosa de outro pedido.

O cliente reenviara a mesma chave; nao persiste nem confia em link no browser.
`ecommerce_create_checkout` e `ecommerce_checkout_link_transition` continuam
sendo a autoridade para reutilizar pending/link e retornar pedido ja pago.
O pagamento nao e consultado na InfinitePay durante polling publico.

## Reconciliacao manual

O detalhe `/admin/pedidos/[id]` oferece **Reconciliar pagamento** para pedido
pendente InfinitePay. Usa Server Action POST existente do Next, com protecao
de origem do framework e verificacao server-side da sessao/admin ativo em cada
execucao. Nao foi criado endpoint publico, cron, job ou integracao externa.

O formulario envia somente o ID do pedido. Amount, paid_amount, status e
referencias enviadas pelo browser nao sao usados. O servidor le o pedido e a
attempt mais recente, e usa somente `order_nsu`, `provider_checkout_id`,
`transaction_nsu` e recibo ja persistidos.

**Limitacao explicita:** sem `transaction_nsu` ou demais referencias persistidas,
a acao retorna `reconcile_missing_reference`, sem chamar provider nem alterar
pedido. A API documentada exige essas referencias. Nao inventamos NSU, nao
consultamos por valores vazios e nao capturamos/persistimos parametros de retorno
nesta etapa. Assim, nao e prometida recuperacao de todo webhook perdido quando
o identificador da transacao nunca chegou ao sistema.

Attempts `creating`, failed/requires_review, pedido cancelado e dispatch legado
desconhecido ficam fora da reconciliacao. Pedido ja pago e no-op seguro.

## Um unico nucleo financeiro

Webhook e reconciliacao usam `verifyInfinitePayPayment`:

1. conferir referencias conhecidas;
2. `payment_check` server-to-server;
3. `evaluatePaymentAmounts`, sem novas regras de desconto;
4. a mesma RPC `ecommerce_confirm_payment` ou
   `ecommerce_fail_payment_attempt` com revisao;
5. o mesmo enqueue idempotente de `order.paid`.

GA4/ERP continuam sob o contrato atomico ja instalado na RPC. `order.paid`
continua usando UNIQUE `(order_id,event_type)` e o worker/outbox anteriores.
Falhas de notificacao nao revertem pagamento. Concorrencia entre instancias
continua dependendo dos locks/idempotencia SQL existentes, nao de memoria Node.

Timeout, provider indisponivel e resposta malformada nao confirmam pagamento.
Erros devolvem codigos fixos sem payload, dados pessoais ou secrets.

## Validacao e limites desta etapa

Testes unitarios/integrados usam fixtures sinteticas e mocks de provider/RPC.
Incluem refresh, link pendente, pedido pago, duas abas, mudancas materiais,
cotacao renovada, storage indisponivel, autenticacao, divergencia, metodo e
valor invalidos, timeout, JSON malformado, repeticao e corrida webhook/admin.

Nao executar teste live de provider, pedido, pagamento ou outbox reais. Nao ha
migration, alteracao de RPC/RLS, Netlify, commit, push ou deploy nesta etapa.

Referencia publica: https://www.infinitepay.io/checkout-documentacao

## Resultado local

- `npm test`: 873 passaram; 6 testes live ignorados, sem ativar flags live.
- `npm run lint`: sem avisos ou erros ESLint.
- `npx tsc --noEmit --incremental false`: passou.
- `npm run build`: passou em copia isolada fora do OneDrive, sem copiar envs.
- `git diff --check`: passou; avisos CRLF/LF nao sao erros de whitespace.
- Build: avisos nao bloqueantes de cache webpack e Browserslist desatualizado.
- Nenhum checkout/link, pagamento, conciliacao ou outbox real foi executado.
- Nenhum banco, RPC/RLS, env, configuracao Netlify ou dependencia foi alterado.
- Nenhum commit, push ou deploy realizado.

## Arquivos desta etapa

Runtime:

- `app/checkout/page.tsx`
- `lib/checkout/intent.ts`
- `lib/checkout/hash.ts`
- `lib/checkout/create-checkout.ts`
- `lib/checkout/infinitepay.ts`
- `lib/checkout/verify-payment.ts`
- `app/api/payments/infinitepay/webhook/route.ts`
- `lib/admin/reconcile-payment.ts`
- `app/admin/(protected)/pedidos/actions.ts`
- `app/admin/(protected)/pedidos/[id]/page.tsx`

Testes:

- `lib/checkout/intent.test.ts`
- `lib/checkout/create-checkout-idempotency.audit.test.ts`
- `lib/checkout/infinitepay.test.ts`
- `lib/admin/reconcile-payment.test.ts`
- `app/api/payments/infinitepay/webhook/route.test.ts`
- `app/admin/(protected)/pedidos/reconcile-action.test.ts`
- `app/admin/(protected)/pedidos/pages.test.tsx`

Documentacao: este arquivo. Sao 18 arquivos no recorte. Arquivos compartilhados
ja continham mudancas anteriores; um commit futuro exige revisao seletiva,
sem incluir automaticamente o restante do worktree.
