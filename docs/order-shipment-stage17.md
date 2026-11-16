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

## Publicação e rollback

A migration não foi aplicada em produção. Para uma publicação separadamente
aprovada, verificar RLS/grants atuais, aplicar em transação e só então publicar
o aplicativo. Para rollback operacional, voltar primeiro à versão anterior do
aplicativo, mantendo as colunas e os dados. Se for necessário reverter a
estrutura, exportar antes os campos logísticos, remover a RPC, os três CHECKs e
as sete colunas em transação separadamente aprovada. Preservar o
`order_status` real, os dados financeiros e a cotação.
