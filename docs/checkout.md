# Checkout Marjouxs

## Fluxo

1. O carrinho persiste somente IDs, slugs, quantidades e personalizações em um envelope versionado no `localStorage`.
2. O servidor recarrega produtos e preços de `data/products.ts` antes de validar frete ou criar pedido.
3. Retirada usa frete zero e não exige endereço. Envio sempre é recalculado no Melhor Envio.
4. A RPC `ecommerce_create_checkout` cria o pedido e a tentativa idempotente.
5. O backend cria e registra o link da InfinitePay e redireciona o comprador.
6. O webhook chama `payment_check`; somente o retorno oficial válido pode confirmar o pagamento.
7. A confirmação cria `ga4_purchase` e `erp_financial` no outbox. O worker processa somente GA4 nesta etapa.

Nenhum SQL estrutural faz parte da aplicação. As tabelas e RPCs `ecommerce_*` precisam existir no Supabase antes do deploy.

## Variáveis

Use `.env.local` no desenvolvimento e configure os mesmos nomes no Netlify:

```env
NEXT_PUBLIC_SITE_URL=https://marjouxsjoias.com.br
NEXT_PUBLIC_WHATSAPP_NUMBER=5511915818241

SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

INFINITEPAY_HANDLE=marjouxsjoias
INFINITEPAY_BASE_URL=https://api.checkout.infinitepay.io

MARJOUXS_ORIGIN_ZIP=07400610
DEFAULT_SHIPMENT_WEIGHT_KG=0.3
DEFAULT_SHIPMENT_LENGTH_CM=16
DEFAULT_SHIPMENT_WIDTH_CM=12
DEFAULT_SHIPMENT_HEIGHT_CM=6
MELHOR_ENVIO_CLIENT_ID=
MELHOR_ENVIO_CLIENT_SECRET=
MELHOR_ENVIO_BASE_URL=https://sandbox.melhorenvio.com.br
MELHOR_ENVIO_REDIRECT_URI=https://marjouxsjoias.com.br/api/shipping/melhor-envio/oauth/callback
MELHOR_ENVIO_USER_AGENT=Marjouxs Ecommerce (marjouxsgold@gmail.com)
MELHOR_ENVIO_OAUTH_SETUP_KEY=
MELHOR_ENVIO_ALLOWED_JEWELRY_SERVICE_IDS=1,2

NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
GA4_API_SECRET=
```

`SUPABASE_SERVICE_ROLE_KEY`, `MELHOR_ENVIO_CLIENT_SECRET`, `MELHOR_ENVIO_OAUTH_SETUP_KEY` e `GA4_API_SECRET` são segredos e nunca podem usar o prefixo `NEXT_PUBLIC_`.

## Melhor Envio

- O fluxo usa OAuth2 integralmente no servidor. `access_token`, `refresh_token` e expiração ficam no Vault por meio das RPCs `ecommerce_*`; nenhum token é salvo em arquivo ou enviado ao navegador.
- Durante a homologação, mantenha `MELHOR_ENVIO_BASE_URL=https://sandbox.melhorenvio.com.br`.
- Cadastre exatamente `https://marjouxsjoias.com.br/api/shipping/melhor-envio/oauth/callback` como callback do aplicativo Sandbox.
- Gere `MELHOR_ENVIO_OAUTH_SETUP_KEY` como um segredo aleatório com pelo menos 32 caracteres. Essa chave protege a única rota que inicia uma nova autorização.
- Depois de configurar as variáveis e publicar o site, abra `https://marjouxsjoias.com.br/api/shipping/melhor-envio/oauth/authorize`. No prompt HTTP Basic, use o usuário `marjouxs` e a setup key como senha. A chave não deve ser adicionada à URL.
- Autorize o aplicativo no Melhor Envio. O callback valida um `state` assinado e temporário, troca o `code` no servidor e guarda as credenciais pelas RPCs já instaladas.
- A cotação reutiliza o token enquanto houver mais de cinco minutos de validade. Próximo da expiração, uma única instância reivindica o lock, renova e persiste também o `refresh_token` rotacionado; as demais aguardam de forma limitada e consultam o Vault novamente.
- Se ainda não houver credencial, a cotação retorna `melhor_envio_authorization_required`, sem expor configuração ou segredo.
- Preencha `MELHOR_ENVIO_USER_AGENT` com o nome da aplicação e um contato técnico.
- Valide comercialmente quais serviços aceitam as joias da loja e informe somente seus IDs em `MELHOR_ENVIO_ALLOWED_JEWELRY_SERVICE_IDS`.
- A lista vazia aplica `default deny`: nenhum frete é oferecido, mas a retirada continua disponível.
- O MVP representa toda a remessa como um único pacote de 0,3 kg e 16 x 12 x 6 cm. Esses valores ficam centralizados e devem ser revistos quando as embalagens reais forem medidas.

O callback é exato e está cadastrado no domínio de produção. Portanto, previews e `localhost` podem exercitar o fluxo apenas com testes automatizados. Para uma homologação OAuth interativa em outra URL, ela precisa ser cadastrada exatamente no aplicativo Sandbox antes do uso; não altere silenciosamente o callback de produção.

## InfinitePay

- Habilite o Checkout Integrado para a InfiniteTag `marjouxsjoias`.
- O backend envia itens em centavos, `order_nsu`, cliente, endereço quando houver, redirect e webhook.
- Pix e cartão usam o valor integral nesta versão. O método e as parcelas reais vêm de `payment_check`.
- Webhook de produção: `https://marjouxsjoias.com.br/api/payments/infinitepay/webhook`.
- Redirect por pedido: `https://marjouxsjoias.com.br/pedido/confirmacao?token=TOKEN_PUBLICO`.

Em deploy preview, `NEXT_PUBLIC_SITE_URL` precisa apontar para uma URL pública que a InfinitePay consiga chamar. O webhook não funciona em `localhost` sem túnel HTTPS.

## Desenvolvimento

```bash
npm install
npm run dev
npm test
npm run lint
npx tsc --noEmit
npm run build
```

Para testar localmente sem chamar provedores reais, use a suíte Vitest. Para homologação completa, use credenciais de sandbox quando o provedor oferecer esse ambiente, um webhook HTTPS público e um pedido de baixo valor controlado.

Casos cobertos por testes automatizados: migração do carrinho, preço autoritativo, produto sem preço, aliança como par, aros inválidos, gravação Unicode, pacote de 300 g, allowlist de frete, OAuth sem código, `state` inválido, token ausente, refresh próximo da expiração, rotação de refresh token, renovação concorrente, criação concorrente, validação do `payment_check`, webhook repetido, `transaction_nsu` divergente e GA4 sem PII.

## Outbox e ERP

`netlify/functions/process-ecommerce-outbox.ts` roda a cada cinco minutos e reivindica somente `ga4_purchase`. Configure `NEXT_PUBLIC_GA_MEASUREMENT_ID` e `GA4_API_SECRET` para o Measurement Protocol.

Eventos `erp_financial` permanecem pendentes. Esta etapa não grava diretamente em `financial_movements` nem `payment_receipts`; o processamento financeiro depende de uma RPC oficial do ERP.
