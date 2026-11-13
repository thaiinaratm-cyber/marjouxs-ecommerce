# Marjouxs: painel de pedidos e notificacao de venda paga

Data: 2026-10-17. Trabalho local, sem commit/push/deploy/alteracao na Netlify.

## Implementacao

- `/admin/pedidos`: menu administrativo, listagem recente primeiro, 20 itens
  por pagina, busca por numero/nome/email/telefone e filtros pelos nove status.
- Cards globais: Novos/Pagos, Em producao, Prontos e Enviados. Todas as
  contagens exigem payment_status=paid; pendentes nao contam como venda.
- `/admin/pedidos/[id]`: cliente, CPF se existente, entrega, pagamento,
  referencias de attempts e itens dos snapshots persistidos. Nenhuma compra
  antiga e reconstruida a partir do catalogo atual.
- Aliancas: dois aros, gravacoes opcionais e Unicode. Produto comum nao recebe
  dados ficticios de alianca. Imagem, preco, material e subtotal sao snapshots.
- Retirada nao mostra frete/endereco/rastreio vazios. Entrega exibe somente
  dados presentes. Nao foi criada coluna de rastreio.
- Link WhatsApp do cliente com a mensagem solicitada; nenhum envio automatico.
- Admin usa a sessao existente e ecommerce_admin_users ativo, verificados no
  servidor antes de obter o cliente privilegiado. As tabelas de pedidos seguem
  com RLS habilitada, sem criar politicas nem expor service role no navegador.
- Atualizacao aceita apenas estados operacionais reais, com verificacao de
  payment_status e controle otimista do status anterior. Pagamento pendente
  nunca vira pago pelo admin. Pickup nao pode ser marcado como shipped.
- Progresso operacional nao regride; pedidos concluidos/cancelados nao sao
  reabertos pelo seletor. Conflito de outra sessao tem mensagem propria.
- Revalidacao da listagem e do detalhe apos salvar. Cancelamento operacional
  nao solicita estorno nem altera o estado financeiro.

## Evento e entrega do email

- O webhook conserva payment_check e ecommerce_confirm_payment. Apos resposta
  paga aceita, tenta registrar order.paid; falha de enqueue nunca desfaz a venda.
- O registro e relido no servidor com payment_status=paid e paid_at preenchido.
- UNIQUE(order_id,event_type), upsert ignoreDuplicates e verificacao de 23505
  impedem duplicacao e preservam payload/status de evento ja existente.
- O worker existente reconcilia, em lotes limitados, pedidos pagos sem evento
  para recuperar falhas de enqueue. Isso ocorre somente com emails habilitados.
  Ao habilitar, pedidos pagos antigos que ainda nao tenham evento tambem podem
  entrar nessa reconciliacao; nao houve backfill remoto nesta validacao.
- Reutiliza claim/complete/fail, locks e backoff existentes. O arquivo de
  agendamento Netlify e sua frequencia de cinco minutos nao foram alterados.
- Resend via fetch server-side, sem dependencia adicional. HTML e text/plain,
  assunto solicitado e link autenticado do painel. Sem CPF, tokens, secrets,
  payload bruto de pagamento ou imagens externas essenciais no email.
- Itens, aros/gravacoes, valores, contato e dados necessarios de entrega sao
  congelados no enqueue com snapshot_version=1. Uma allowlist remove CPF e
  campos alheios ao email. Edicoes futuras nao substituem esse snapshot.
- Eventos anteriores sem versao continuam compativeis: leem o snapshot do
  pedido uma vez, nunca o catalogo. Snapshot versionado invalido falha fechado.
- O worker revalida payment_status=paid e paid_at antes de qualquer envio.
- A mensagem e congelada em payload.notification sob o lock atual antes de
  qualquer envio; remetente, destinatarios e conteudo ficam estaveis no retry.
- Corpo HTTP serializado em ordem fixa para resistir a reordenacao de JSONB.
- Chave idempotente por evento, reaproveitada nas tentativas e timeouts.
- O Resend retém chaves por 24h. Apos 23h desde o preparo congelado, o sistema
  nao faz novo envio automatico: deixa failed com
  notification_retry_review_required. Exige revisao do operador; nao ha botao
  de reenvio irrestrito nem reset automatico da chave.
- Falhas de rede/provedor usam fail/retry existente e preservam pedido pago.
  Logs de notificacao usam somente stage/codigos seguros, nao dados pessoais.
- Email disabled nao reivindica order.paid, nao envia e nao marca como processado.

Fonte do limite idempotente: https://resend.com/docs/dashboard/emails/idempotency-keys
API utilizada: https://resend.com/docs/api-reference/emails/send-email

## Configuracao futura (nao aplicada a Netlify)

```dotenv
ORDER_NOTIFICATIONS_ENABLED=false
RESEND_API_KEY=
ORDER_NOTIFICATION_EMAIL=
ORDER_NOTIFICATION_FROM=
```

Destinatarios separados por virgula ou ponto-e-virgula; sem email hardcoded.
O remetente precisa ser valido/autorizado no Resend. Reutiliza
NEXT_PUBLIC_SITE_URL para o painel; nao foi criado outro SITE_URL. Nenhuma
env local secreta foi editada. Secrets nao usam prefixo NEXT_PUBLIC_.

## Testes e evidencias

- Acesso admin/negado antes do cliente privilegiado; visitante, usuario comum
  e admin inativo; busca, filtros, ordenacao, paginacao e cards somente pagos.
- Snapshot de detalhe, entrega/retirada, valores, pagamento, aros, Unicode,
  WhatsApp e bloqueio de confirmacao financeira manual.
- Persistencia operacional e nova leitura verificadas com armazenamento
  simulado. Nenhum pedido remoto foi alterado para executar esse teste.
- Renderizacao SSR das duas paginas com fixtures sinteticas: sete testes.
- Evento somente pago, repeticao, conflito UNIQUE, disabled, template, timeout,
  sucesso/complete, falha/fail, reconciliacao anti-join e barreira de 23h.
- Snapshot JSONB com chaves reordenadas preserva corpo HTTP e chave idempotente.
- HTTP local sem sessao: ambas as rotas retornaram 307 para
  /admin/login?error=authentication.
- Preview: http://localhost:3000/admin/pedidos (Next iniciado localmente).
- Smoke autenticado concluido em localhost:3000: sete pedidos listados,
  detalhe de retirada e de entrega, cliente, itens, pagamento e WhatsApp.
- Busca por numero, nome, telefone e email conferida na UI; filtro de pagos
  exibe estado vazio sem erro. Console sem erros durante a conferencia.
- Os sete pedidos atuais cabem em uma pagina; navegacao entre paginas e
  manutencao dos filtros foram verificadas com fixtures de 21 pedidos.
- Nao foram testadas mudancas em pedidos reais, nem envio real no Resend.

Validacoes finais: npm test com 440 aprovados e cinco ignorados; lint sem
avisos; TypeScript --noEmit --incremental false aprovado; build aprovado
(45 paginas estaticas), em copia fora do OneDrive, sem .env.local e com as
mesmas fontes da aplicacao e dependencias reutilizadas. O modo estatico
padrao do build nao altera a configuracao do projeto original.

A falha local anterior de SUPABASE_URL foi resolvida antes desta continuacao;
nao houve nova alteracao no .env.local. ORDER_NOTIFICATIONS_ENABLED continua
desabilitado por padrao local. Nenhuma chamada real ao Resend, pagamento,
alteracao de pedido, migration, RLS, RPC, cron ou Netlify nesta continuacao.

## Ajustes desta continuacao

- lib/notifications/order-email.ts: contrato validado/permitido do snapshot.
- lib/notifications/order-paid.ts: snapshot congelado desde enqueue,
  compatibilidade anterior e confirmacao do estado pago antes do envio.
- lib/notifications/order-paid.test.ts: snapshot apos edicoes, payload
  invalido e pedido que deixa de estar pago.
- lib/orders/model.ts e model.test.ts: progresso operacional sem regressao.
- lib/admin/orders.ts e orders.test.ts: conflito detectado antes de validar
  a transicao, preservando a mensagem de concorrencia.
- docs/admin-orders-validation.md: este fechamento e evidencias.

## Arquivos desta feature

Modificados:
- .env.example
- app/admin/(protected)/layout.tsx
- app/api/payments/infinitepay/webhook/route.ts
- app/api/payments/infinitepay/webhook/route.test.ts
- lib/checkout/outbox.ts
- lib/checkout/outbox.test.ts

Adicionados:
- app/admin/(protected)/pedidos/page.tsx
- app/admin/(protected)/pedidos/[id]/page.tsx
- app/admin/(protected)/pedidos/actions.ts
- app/admin/(protected)/pedidos/error.tsx
- app/admin/(protected)/pedidos/pages.test.tsx
- lib/admin/orders.ts
- lib/admin/orders.test.ts
- lib/orders/model.ts
- lib/orders/model.test.ts
- lib/orders/selects.ts
- lib/orders/fixture.ts
- lib/notifications/order-email.ts
- lib/notifications/order-email.test.ts
- lib/notifications/order-paid.ts
- lib/notifications/order-paid.test.ts

Documentacao e SQL historico aprovado:
- docs/admin-orders-audit.md
- docs/admin-orders-schema-audit.sql
- docs/order-paid-event-type.proposed.sql
- docs/order-paid-event-type.rollback.sql
- docs/order-paid-claim-outbox.proposed.sql
- docs/order-paid-claim-outbox.rollback.sql
- docs/admin-orders-validation.md

Mudancas paralelas de produtos, campos tecnicos, banners, Merchant, migracoes,
package.json/lock e exclusoes preexistentes nao fazem parte desta feature.
Nenhum arquivo foi staged. .next, .env.local, tsconfig.tsbuildinfo, logs e
temporarios nao devem entrar em futuro commit seletivo.
