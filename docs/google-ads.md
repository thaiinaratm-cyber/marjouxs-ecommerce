# Google Ads — conversão Compra

## Arquitetura

A Google Tag usa o componente global `components/google-analytics.tsx`, já incluído uma vez em `app/layout.tsx`. `next/script` carrega um único `gtag.js` com `afterInteractive`, após a inicialização client-side da fila. Não há acesso a `window` no SSR nem alteração em metadata/layout. O GA4 configurado em `NEXT_PUBLIC_GA_MEASUREMENT_ID` continua ativo; quando ausente, Ads funciona sozinho.

Identificadores públicos:

- Google Ads: `AW-18482833340`.
- Compra: `AW-18482833340/t-gCCNS624odELzPpu1E`.
- Moeda: `BRL`.

## Fonte confiável e momento do disparo

`OrderConfirmation` consulta `GET /api/orders/{token}` sem cache. Somente depois de uma resposta HTTP válida e ainda pertencente à requisição/token ativo, entrega o pedido a `trackGoogleAdsPurchaseWhenReady`. Essa função exige `paymentStatus === "paid"`, `paidAt` válido, `totalCents` inteiro positivo e `orderNumber` válido. A conversão aguarda também o carregamento do script da Google Tag.

O backend existente consulta a API oficial `payment_check` da InfinitePay no webhook. Exige `success`, `paid` e `paid_amount > 0`, compara `amount` com o valor solicitado e então chama `ecommerce_confirm_payment`. O redirect do gateway, o clique em pagar e a montagem do componente não confirmam uma compra.

Payload comercial permitido:

- `value`: `ecommerce_orders.total_cents / 100`, exposto pela API como `totalCents`. É o total do pedido, com os descontos e frete persistidos pelo servidor. Não usa `paid_amount`, que pode incluir diferenças da operação do gateway.
- `transaction_id`: `ecommerce_orders.order_number`, exposto como `orderNumber`; é o mesmo identificador estável usado pelo GA4 existente.
- `currency`: `BRL`.
- `send_to`: destino Compra acima.

Nenhum preço, estado de pagamento ou ID de transação é extraído da URL. O único parâmetro utilizado pela página é o token de consulta; a API valida UUID e existência do pedido. Nenhum token, CPF, e-mail, endereço, gravação ou credencial é copiado para a conversão. `new_customer` não é enviado porque não existe uma classificação confiável disponível nesse fluxo.

## Duplicidades e carregamento

Uma marca por destino e pedido em memória impede repetição durante rerenders, Strict Mode e montagens repetidas. `localStorage` preserva a marca em F5 e revisitas. Um pedido futuro tem outra chave e pode converter normalmente. Se o armazenamento estiver indisponível ou duas abas enviarem simultaneamente, o mesmo `transaction_id` permite ao Google Ads deduplicar a ação.

A marca é salva após a chamada ao `gtag`; erro de execução não marca a compra. A prontidão do script usa um evento local: respostas rápidas da API aguardam o carregamento, e desmontagem/troca de token cancela esse acompanhamento. Nenhuma chamada ao gateway/banco foi adicionada pela medição.

## Atribuição e privacidade

A Google Tag está em todas as páginas públicas e usa o mecanismo nativo de atribuição/cookies do Google Ads. Não há armazenamento próprio de GCLID/GBRAID/WBRAID nem alteração do redirect da InfinitePay. O retorno já usa o domínio da loja, onde os cookies continuam disponíveis no mesmo navegador.

O contexto enviado à tag mantém `gclid`, `gbraid`, `wbraid`, `gclsrc`, `_gl` e parâmetros UTM. Demais parâmetros e fragmentos são removidos de `page_location`/`page_referrer`, principalmente o token privado da confirmação. A URL real do navegador não é alterada. A atribuição continua sujeita a consentimento, bloqueadores e restrições do navegador; não foi implementada uma nova política de consentimento nesta tarefa.

## Limitações e validação

- A conversão Ads depende de o cliente abrir/manter a confirmação depois de o pagamento ser registrado. Fechar a página antes disso pode perder a conversão; o GA4 via outbox existente permanece separado e inalterado.
- O polling existente para fora de `pending`. Uma aprovação posterior de um pedido em análise exige nova consulta/revisita.
- O retorno de `gtag` confirma o envio ao mecanismo de medição, não a recepção/atribuição no painel do Google. Bloqueadores e falhas de rede podem impedir a medição.
- Um navegador pode executar JavaScript manualmente; esta implementação impede que parâmetros da URL se tornem dados de compra, mas uma tag client-side não é um mecanismo antifraude contra execução arbitrária no próprio navegador.
- SQL/RLS das funções de pagamento estão em infraestrutura externa, conforme `docs/checkout.md`; a auditoria avaliou o contrato de backend e os testes existentes, sem modificar o banco.
- Não enviar `purchase` adicional ao GA4 pelo navegador nem importar outra ação para contar a mesma venda em duplicidade. A ação Ads configurada no painel deve corresponder ao destino informado.

Executar `npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` e `git diff --check`. Os testes cobrem configuração única, convivência com GA4, SSR, privacidade, atribuição, valor/ID, estados inválidos, URL manipulada, deduplicação, carregamento tardio e cancelamento. Não realizar compra paga sem autorização.

Referências oficiais: [Next.js 14 — Script](https://nextjs.org/docs/14/app/api-reference/components/script), [roteamento da Google Tag](https://developers.google.com/tag-platform/gtagjs/routing), [deduplicação por transaction_id](https://support.google.com/google-ads/answer/6386790?hl=en).
