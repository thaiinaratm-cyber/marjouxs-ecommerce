# Frete: cotacao e cobranca com postagem manual

## Auditoria de 21/10/2026

- Antes: a aplicacao ja consultava `/api/v2/me/shipment/calculate`, revalidava o frete antes do pagamento e persistia seu snapshot. Nao havia chamadas de compra, carrinho de envios, etiquetas, geracao, impressao ou cancelamento no Melhor Envio.
- Agora: o mesmo fluxo tem endpoint de calculo restrito aos hosts oficiais HTTPS, sem caminho configuravel e sem redirects. A aplicacao nao contrata transporte, compra etiquetas ou debita saldo de frete.
- Permissoes de compra nao foram adicionadas. O token local de QA continua isolado; allowlist local `2` nao constitui aprovacao comercial de producao.
- A Marjouxs prepara a peca e realiza a postagem manual. O pagamento ou a alteracao de status nao chama o Melhor Envio.

## Valores e seguranca

- O servidor valida CEP/existencia via ViaCEP, consulta produtos/precos atuais e revalida quantidade, personalizacao de aliancas e modalidade. Faz nova cotacao antes de criar o pedido/link.
- A API aceita a referencia do servico, nunca preco, carrier ou total definidos pelo cliente. Um servico ausente da cotacao autorizada bloqueia a criacao.
- Valores usam centavos inteiros seguros no TypeScript e bigint no banco. Subtotal 50000 + frete 2885 = total-base 52885, sem desconto local.
- `ecommerce_create_checkout` grava frete no pedido, nao nos itens de produto. A RPC instalada define `shipping_provider=melhor_envio` para entrega: origem da cotacao, nao compra da etiqueta.
- Snapshot existente: `delivery_method`, `shipping_zip`, endereco, `shipping_carrier`, `shipping_service`, `shipping_service_id`, `shipping_cents`, `shipping_deadline_days`, `shipping_quote_id`, `shipping_quoted_at`.
- A InfinitePay recebe os produtos e uma linha de cobranca de frete exigida pelo contrato atual `/links`. Essa linha nao vira produto em `ecommerce_order_items`. O total e contado uma unica vez.
- A confirmacao compara o amount oficial com o requested_amount/total-base, incluindo frete. O paid_amount legitimo do provider e preservado separadamente, inclusive Pix; divergencias vao para revisao. RPCs e implementacao de pagamento nao foram alteradas.
- Carrinho armazena itens, nao cotacao definitiva. Troca de CEP limpa modalidade/frete e cancela respostas antigas. Antes do pagamento ocorre nova cotacao.

## Apresentacao e operacao

- Checkout exibe transportadora/servico (por exemplo, Correios — SEDEX), preco e transporte. Confeccao de 3 a 5 dias uteis permanece separada; nao ha soma implicita de dias uteis.
- Falhas de autenticacao, timeout, provider e configuracao exibem mensagem amigavel. CEP invalido, inexistente e indisponibilidade de validacao continuam distintos. Sem cobertura nao cria preco fixo ou frete zero.
- Retirada tem frete zero, sem CEP de transporte, ViaCEP ou Melhor Envio. Nao mostra SEDEX/postagem. Pronto para retirada e exclusivo dessa modalidade.
- Admin mantem indicador Entrega/Retirada na lista; detalhe de entrega mostra endereco/CEP, transportadora/servico, frete cobrado, transporte, confeccao, status e Postagem manual. WhatsApp administrativo existente nao menciona entrega e foi preservado.
- E-mail order.paid usa somente snapshot: inclui CEP, servico, transportadora, frete, transporte e postagem manual quando entrega. CPF e secrets ficam fora. Campos novos de leitura sao opcionais para snapshots antigos. Mensagens ja congeladas para retry permanecem intactas; idempotencia, retry e limite de 23h nao mudaram.
- GA4 foi preservado: value usa total do pedido e shipping separado, conforme convencao preexistente; nenhum evento extra foi criado. Checkout continua noindex; SEO nao mudou.

## Rastreio: pendencia de aprovacao

A leitura do schema real confirmou ausencia de tracking_code, tracking_url e shipped_at. shipping_carrier ja existe. Nenhuma migration foi criada/aplicada, nenhuma RPC/RLS foi modificada e nenhum dado foi preenchido.

Proposta minima para etapa futura, SOMENTE apos aprovacao: adicionar tracking_code text nullable, tracking_url text nullable e shipped_at timestamptz nullable em ecommerce_orders. Reutilizar shipping_carrier, manter todos os registros existentes NULL e nao preencher automaticamente. A interface/escrita de rastreio depende dessa aprovacao; o status Enviado existente continua disponivel para postagem manual.

## Validacao

Testes cobrem cotacao simples/multipla/parcial, allowlist, CEP, erros, preco/prazo invalidos, bloqueio de endpoints, 500 + 28,85, adulteracao de campos/servico/CEP, retirada, price_changed, confirmacao com frete/Pix, admin, e-mail e GA4. Testes live genericos continuam desabilitados por padrao.

QA real deve usar apenas Sandbox local e token isolado, sem criar pedido, pagamento, evento outbox ou etiqueta. Resultados atuais e validacoes finais constam no relatorio de entrega. Nao promover configuracao para producao nesta etapa.

### Resultados reais locais (21/10/2026)

Origem 07400610, pacote 16 x 12 x 6 cm, 0,3 kg, declaracao de valor zero no runner isolado:

| Destino | Servico aceito | Preco | Transporte |
| --- | --- | --- | --- |
| 07400805 | Correios / SEDEX / ID 2 | R$ 9,94 | 2 dias uteis |
| 20040002 | Correios / SEDEX / ID 2 | R$ 28,85 | 2 dias uteis |

Outros servicos eventualmente retornaram preco, mas nao foram aceitos fora da allowlist 2. Nenhum erro individual descartou a opcao SEDEX valida. Runner confirmou zero acessos ao Vault e arquivo .env.local identico antes/depois.

A rota HTTP local /api/shipping/quote tambem respondeu 200 para 07400805 com item real do catalogo estatico (subtotal R$ 179,90): SEDEX R$ 11,48, transporte 2 dias uteis. O payload existente declara o subtotal como valor segurado; portanto nao e o mesmo cenario de declaracao zero acima. Nenhum valor foi fixado no codigo e a regra de seguro nao foi alterada. Total-base correspondente: R$ 191,38.

A automacao do navegador abortou a abertura de URLs locais. A revisao visual interativa desktop/mobile e a troca para retirada na UI ficaram pendentes de confirmacao manual; nao devem ser confundidas com os testes de renderizacao e fluxos simulados aprovados.
