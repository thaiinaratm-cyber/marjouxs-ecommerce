# Validacao de amount e paid_amount - InfinitePay

Auditoria: 30/10/2026. Nenhuma transacao real foi executada.

## Evidencias oficiais e lacunas

Fontes consultadas:

- [Documentacao oficial do Checkout](https://www.infinitepay.io/checkout-documentacao)
- [Guia oficial do Checkout Integrado](https://ajuda.infinitepay.io/pt-BR/articles/10766888-como-usar-o-checkout-integrado-da-infinitepay)
- [Configuracao de descontos por metodo](https://ajuda.infinitepay.io/pt-BR/articles/15503297-como-oferecer-desconto-por-metodo-de-pagamento)

A documentacao define `amount` como a cobranca original em centavos e `paid_amount` como o pagamento efetivo; este pode aumentar quando taxas de parcelamento sao repassadas. O metodo documentado e `capture_method`, com `pix` e `credit_card`. A resposta documentada nao inclui um campo explicito de desconto. Os exemplos nao estabelecem uma formula de desconto Pix nem seu arredondamento.

O guia permite percentuais configuraveis por metodo, inclusive por link em `options.discounts`. Isso comprova a possibilidade do desconto, nao um percentual universal de 10% nem a configuracao real desta conta. Essas opcoes por link requerem API Key; nao foram adicionadas nesta tarefa.

Classificacao:

| Ponto | Evidencia |
| --- | --- |
| Valor original e valor efetivamente pago sao campos diferentes | Comprovado |
| Metodo em capture_method | Comprovado |
| Taxas podem produzir paid_amount maior no cartao | Comprovado; valor exato da taxa desta conta nao auditado |
| Todo Pix tem desconto de 10% | NAO COMPROVADO |
| Conta Marjouxs esta configurada com 10% | NAO COMPROVADO |
| Formula/arredondamento do provider para Pix com desconto | NAO COMPROVADO |
| Desconto aplicado ao frete e sua representacao nos dois campos | NAO COMPROVADO |
| Campo de desconto autoritativo na resposta payment_check | NAO DOCUMENTADO nas fontes consultadas |

## Origem local dos 10%

`lib/product-pricing.ts` possui `PRODUCT_PAGE_PIX_DISCOUNT_PERCENT = 10`, usado no preco de apresentacao. A vitrine tambem possui textos de 10% OFF.

Esse valor nao e enviado em options na criacao de links, nao e um snapshot da configuracao InfinitePay e nao consta como desconto da attempt. A criacao atual conserva `discount_cents = 0` e o total-base inclui produtos e frete.

Nenhum desses arquivos, valores, textos comerciais ou payload de criacao foi alterado. Nao e seguro reutilizar um percentual de apresentacao como prova do valor autorizado para um pagamento.

## Fluxo anterior

O webhook recebia identificadores, localizava a attempt e consultava payment_check. Exigia success/paid, paid_amount positivo e amount igual ao valor solicitado. Em seguida chamava ecommerce_confirm_payment. A RPC mantem verificacoes adicionais, mas exige apenas paid_amount positivo quanto a esse valor, sem regra de desconto/taxa por metodo.

Assim, amount igual a base com paid_amount de um centavo podia ultrapassar a verificacao financeira anterior. Isso e uma simulacao de elegibilidade, nao um pagamento realizado.

## Regra conservadora implementada

Somente a validacao interna anterior a confirmacao foi alterada no webhook, conforme autorizacao especifica do usuario. URL, schema de entrada, identificadores, chamada oficial payment_check, argumentos de confirmacao e fluxo posterior de eventos foram preservados.

`evaluatePaymentAmounts` trata valores em centavos inteiros seguros:

1. success e paid precisam ser booleanos true; caso contrario nao confirmar.
2. O total solicitado armazenado precisa ser positivo e representavel exatamente. Strings decimais inteiras do PostgreSQL sao aceitas sem parseFloat.
3. amount precisa ser inteiro seguro positivo e igual ao total-base solicitado.
4. paid_amount precisa ser inteiro seguro positivo.
5. Metodo precisa ser pix ou credit_card; parcelas entre 1 e 12, e Pix em uma parcela.
6. O conjunto atualmente comprovado para aprovacao automatica e paid_amount exatamente igual ao total-base.
7. Diferencas nao sao declaradas fraude nem interpretadas como desconto/taxa valida: seguem para requires_review. Isso inclui Pix possivelmente legitimo com 10% e cartao possivelmente legitimo com repasse de taxas.

Essa igualdade e uma politica temporaria de aprovacao automatica, nao uma afirmacao de que o provider sempre devolve valores iguais. Casos divergentes precisam ser reconciliados antes de ampliar o conjunto permitido.

Pix menor recebe payment_pix_discount_unverified. Diferencas no cartao e valores maiores recebem payment_paid_amount_mismatch. Base divergente conserva payment_amount_mismatch. Metodos e parcelas invalidos nunca chegam a confirmacao.

O parser de payment_check exige numeros inteiros seguros, sem coagir strings/booleanos em dinheiro. Um metodo desconhecido ou resposta malformada gera erro seguro antes da politica, sem confirmacao; a validacao defensiva tambem cobre esses casos caso o parser seja contornado em testes/outra chamada interna.

## Centavos e arredondamento

Tolerancia zero. Nao ha arredondamento na decisao financeira nem multiplicacao por 0.90. Valores fracionarios sao recusados, nao arredondados para o centavo mais proximo. Um centavo acima/abaixo nao e tolerado automaticamente.

A formula visual existente nao foi promovida a contrato financeiro. Enquanto nao houver evidencia do provider, nao existe um "valor Pix com desconto permitido" automaticamente.

## Simulacoes numericas

Premissas: amount=100000, flags positivas, identificadores, metodo e parcelas validos, sem outras divergencias SQL.

| Base | Efetivamente pago | Regra anterior | Nova regra Pix | Nova regra cartao |
| --- | --- | --- | --- | --- |
| 1000,00 | 1000,00 | Elegivel para paid | Elegivel para paid | Elegivel para paid |
| 1000,00 | 900,00 | Elegivel para paid | requires_review | requires_review |
| 1000,00 | 899,99 | Elegivel para paid | requires_review | requires_review |
| 1000,00 | 900,01 | Elegivel para paid | requires_review | requires_review |
| 1000,00 | 0,01 | Elegivel para paid | requires_review | requires_review |
| 1000,00 | 1100,00 | Elegivel para paid | requires_review | requires_review |

O caso base 1030,00/pago 927,00 tambem fica em revisao. "Elegivel" significa apenas que a guarda financeira permite chamar a RPC; somente a RPC pode confirmar paid apos validar todos os demais requisitos.

## Requires review e falhas

A revisao usa exclusivamente a RPC existente ecommerce_fail_payment_attempt com p_requires_review=true. A confirmacao e o enqueue de order.paid nao sao chamados para divergencias.

Falha ao registrar a revisao retorna payment_review_unavailable/503, sem afirmar que o estado foi salvo e sem confirmar. Logs dessa falha usam somente codigo constante, nunca o erro cru de transporte/banco. Pedidos ja pagos continuam protegidos pelas RPCs instaladas, sem alteracao de SQL.

## Limites desta etapa

- Nenhum SQL/RPC/RLS alterado ou executado.
- Nenhuma env nova ou mudanca em configuracoes de pagamento da conta.
- Nenhuma alteracao em idempotencia, links, catalogo, frete, retirada, admin, ERP ou outbox.
- Sem transacao real, payment_check real, link real, webhook real ou e-mail real.
- Sem commit, push, deploy ou alteracao Netlify.

## Bloqueio para validacao real futura

REGRA DE PIX PARCIALMENTE VALIDADA; PAGAMENTO REAL CONTROLADO AINDA NECESSÁRIO PARA CONFIRMAR O CONTRATO DO PROVIDER.

Antes de qualquer ensaio autorizado separadamente, confirmar a configuracao real de desconto/taxas da conta e acordar um procedimento de baixo valor que respeite o minimo do provider. Observar amount, paid_amount, capture_method e installments em casos de desconto e de centavos nao exatos. Confirmar tambem a base do desconto quando houver frete.

Nao usar exemplos ou arredondamento visual como prova. Nenhum pagamento foi iniciado nesta auditoria; um ensaio futuro depende de autorizacao especifica e participacao do responsavel pela conta.
