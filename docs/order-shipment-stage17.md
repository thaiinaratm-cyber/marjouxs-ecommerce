# Etapa 17: envio e rastreamento

## Auditoria

O OpenAPI do projeto confirmou, somente por leitura de metadados, que
`ecommerce_orders` guarda `delivery_method`, endereço, valor, identificador e data
da cotação, prazo, provedor, transportadora e serviço (`shipping_*`). Não expõe
tabela separada de envio nem campos de rastreio. `shipping_carrier` identifica a
transportadora cotada; não deve ser reescrito como se fosse a transportadora que
de fato postou o pedido. Melhor Envio continua na cotação; a postagem é manual.

`payment_status` é independente de `order_status`. Os status operacionais úteis
são `paid`, `preparing`, `ready_for_pickup`, `shipped` e `completed`.
Não havia um status de trânsito, datas dos marcos nem log administrativo de
pedidos a reutilizar. A concorrência operacional já verificava o status atual;
a expedição compara o `updated_at` sob lock do pedido.

## Migration e acesso

`supabase/migrations/202611160002_order_shipment_tracking.sql` acrescenta
`dispatch_carrier`, `tracking_code`, `tracking_url` e `shipping_status` (text),
mais `shipped_at`, `in_transit_at` e `delivered_at` (timestamptz). As colunas
são nullable, sem valores padrão explícitos, índices ou backfill. CHECKs
restringem status, formato básico e escopo exclusivo de envio.

A RPC `ecommerce_update_order_shipment` usa `SECURITY DEFINER` com
`search_path` vazio e execução exclusiva de `service_role` entre as roles da
aplicação. Não altera RLS/policies ou grants de `anon`/`authenticated`. O painel
verifica a sessão de admin ativo antes de usar o cliente server-side. A página
do cliente exige o cookie HttpOnly de número + telefone e limita a consulta a
esse pedido; a API de confirmação não recebe os campos novos. URLs são
validadas como HTTPS no servidor, sem credenciais embutidas, e abertas sem
referrer. Nenhuma URL é gerada automaticamente a partir do código.

## Transições

| Estado efetivo | Operações permitidas |
| --- | --- |
| Preparando | Corrigir dados ou marcar Enviado |
| Enviado | Corrigir dados ou marcar Em trânsito |
| Em trânsito | Corrigir dados ou confirmar Entregue |
| Entregue | Corrigir dados, sem reabrir a entrega |

Salvar os dados sem mudar o status não marca envio. Cada data é gravada na
primeira transição explícita. Um pedido antigo já enviado ou concluído mantém o
status conhecido, mas não ganha datas históricas ou um trânsito fictício.
Controle de qualidade continua neutro. Para preservar a lista administrativa,
Enviado/Em trânsito correspondem ao status operacional `shipped` e Entregue a
`completed`; nenhum status financeiro é escrito. Retirada conserva a ação
operacional anterior e nunca recebe campos de envio.

## Versão do pedido

Na Etapa 22A, a auditoria confirmou que o trigger antigo de pedidos
sobrescrevia `updated_at` com `now()`, constante dentro de uma transação.
A função genérica `ecommerce_touch_updated_at()` também atende
`ecommerce_payment_attempts_10_touch_updated_at` (BEFORE UPDATE por linha),
conforme metadados históricos. O SQL histórico proposto do catálogo a
referencia ainda nos triggers BEFORE UPDATE por linha de `ecommerce_categories`,
`ecommerce_subcategories`, `ecommerce_materials` e `ecommerce_product_images`;
esses usos do catálogo não foram reconferidos em produção nesta etapa.

A migration reaponta somente `ecommerce_orders_10_touch_updated_at` para
`public.ecommerce_orders_touch_updated_at()`: SECURITY INVOKER, owner postgres,
`search_path` vazio, sem EXECUTE para PUBLIC ou roles da aplicação. A versão
ignora o valor solicitado pelo chamador e usa o maior entre o relógio atual
e o valor anterior mais um microssegundo. O guard exige `updated_at` NOT NULL,
com precisão de microssegundo; valores não finitos fazem a atualização falhar.
A RPC usa o timestamp que calcula apenas para os marcos de envio.
O trigger `ecommerce_orders_90_protect_paid` e a função genérica não mudam.

## Publicação e rollback

A migration não foi aplicada em produção. Para uma publicação separadamente
aprovada, usar apenas a migration versionada; o pré-check travado nela é
executado antes do DDL, na mesma transação. Ele exige o executor e owner
esperados, RLS sem policies, colunas-base compatíveis, nenhum vestígio da
instalação e os privilégios esperados. Só aceita os dois triggers não internos
auditados, com definições, vínculos e modos de execução exatos, além de owner,
configuração, ACL e SHA-256 das funções com CRLF normalizado. Um trigger
adicional, mesmo desativado, ou alteração em qualquer definição bloqueia.
Qualquer falha aborta a transação; não contornar o pré-check nem executar a
migration duas vezes. O lock exclusivo de `ecommerce_orders` impede mudanças
concorrentes entre a inspeção e o DDL. `lock_timeout = '5s'` limita cada espera
por lock, não a duração total da transação.

`npm test -- scripts/order-shipment-migration.test.ts` executa o SQL versionado
em PostgreSQL local isolado (PGlite), sem credenciais. O teste fixa o SHA-256
do SQL com finais LF; qualquer mudança deve passar por nova revisão antes de
atualizar esse valor. Não há script de instalação separado. Para verificar
contenção entre duas transações com um PostgreSQL local, execute
`node scripts/order-shipment-concurrency-local.mjs <diretório-bin>`.
O script inicia um cluster descartável apenas no loopback, comprova a espera
pelo lock e encerra o servidor no final. Não usa credenciais de produção.

Para rollback operacional, voltar primeiro à versão anterior do
aplicativo, mantendo as colunas e os dados. Se for necessário reverter a
estrutura, exportar antes os campos logísticos, reapontar o trigger de
timestamp para a função genérica original e remover a nova função, a RPC,
os três CHECKs e as sete colunas em transação separadamente aprovada. Preservar o
`order_status` real, os dados financeiros e a cotação.
