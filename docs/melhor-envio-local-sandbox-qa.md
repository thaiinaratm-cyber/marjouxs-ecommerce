# QA local isolado do Melhor Envio Sandbox

O access token de QA deve ser independente da credencial central do Vault.
Nunca copie ou renove o refresh token central para preparar este teste.

## Configuracao manual

Preencher somente `.env.local` (ignorado pelo Git), sem enviar segredos pelo chat:

```dotenv
MELHOR_ENVIO_BASE_URL=https://sandbox.melhorenvio.com.br
MELHOR_ENVIO_LOCAL_SANDBOX_ACCESS_TOKEN=
MELHOR_ENVIO_USER_AGENT=Marjouxs Ecommerce (marjouxsgold@gmail.com)
```

Nao preencher automaticamente `MELHOR_ENVIO_ALLOWED_JEWELRY_SERVICE_IDS`.
Primeiro confirmar a configuracao do token, descobrir os servicos por uma
consulta controlada ao Sandbox e aprovar os IDs. Somente depois preencher:

```dotenv
MELHOR_ENVIO_ALLOWED_JEWELRY_SERVICE_IDS=
```

Sem allowlist, a rota normal de cotacao continua bloqueada (`shipping_allowlist_empty`).
A descoberta controlada nao publica modalidades nem altera essa configuracao.

Os defaults de embalagem permanecem: `MARJOUXS_ORIGIN_ZIP=07400610`,
`DEFAULT_SHIPMENT_WEIGHT_KG=0.3`, `DEFAULT_SHIPMENT_LENGTH_CM=16`,
`DEFAULT_SHIPMENT_WIDTH_CM=12`, `DEFAULT_SHIPMENT_HEIGHT_CM=6`.
Nao e necessario repeti-los no arquivo se nao houver overrides anteriores.

O token local nao precisa de Client ID, Client Secret, setup key, redirect URI
ou acesso ao Vault para cotar. A rota ainda resolve o carrinho pelo catalogo
configurado: o catalogo database pode precisar das suas proprias envs Supabase.
Reiniciar a instancia local depois de editar o arquivo.

## Guardas e prioridade

O token local so e lido no servidor, com `NODE_ENV !== "production"`,
env `MELHOR_ENVIO_BASE_URL` exatamente igual a `https://sandbox.melhorenvio.com.br`
e base efetiva da requisicao tambem exatamente igual a essa URL.
O modulo tem a barreira de compilacao `server-only` e verifica `window` em runtime.
Requisicoes com token local nao seguem redirecionamentos HTTP.

Nesse modo o token local tem prioridade: nenhuma RPC OAuth e chamada,
nem para leitura, lock, refresh, persistencia ou release. Nao ha refresh automatico,
fallback para o Vault apos falha, endpoint de token, prop ou resposta publica com segredo.
401/403 retornam `melhor_envio_local_sandbox_token_invalid`; obter outro token
Sandbox independente, sem tentar renovar a credencial central.

Em producao, ou com qualquer base diferente, o token local e ignorado e o fluxo
normal via Vault permanece. Sem token local, esse fluxo tambem permanece:
nao chamar a cotacao local sem o token de QA se a intencao for isolar o Vault.
Nao usar o callback OAuth atual para preparar QA: ele grava na credencial central.

## Respostas e erros

Valores `custom_*` validos tem prioridade; campos normais sao usados apenas
quando o customizado esta ausente/null. Customizacao invalida descarta o servico,
sem oferecer silenciosamente outro preco. Precos viram centavos inteiros seguros;
prazos nulos, fracionarios ou invalidos nao viram zero. Entradas malformadas e
servicos com erro nao eliminam os demais resultados validos.

O timeout continua em 12 segundos, com `shipping_provider_timeout` (504).
400, 401/403, 404, 422, 429, 5xx, rede e resposta invalida possuem classificacoes
distintas. Erros HTTP sao classificados antes de tentar ler JSON.
Corpos/mensagens externas de erro nao sao repassados ao cliente nem aos logs.
Diagnosticos de servicos usam `service_error` em lugar do texto livre do provedor.
Logs adicionais em desenvolvimento contem somente fonte do token, ambiente,
status HTTP e codigo de erro seguro. Nenhum teste automatizado desta feature
consulta servicos reais ou cria pedidos/pagamentos reais.

## Sequencia de QA

1. Configurar o token Sandbox local e confirmar, sem compartilhar seu valor.
2. Descobrir IDs, nomes e transportadoras sem escrever em Vault ou configurar allowlist.
3. Parar para aprovacao dos IDs; disponibilidade tecnica nao substitui validacao comercial para joias.
4. Somente apos aprovacao, testar Aruja (07400-805), capital, interior SP e outro estado.
5. Nao finalizar pedido, pagamento ou compra de etiqueta para testar cotacao.
