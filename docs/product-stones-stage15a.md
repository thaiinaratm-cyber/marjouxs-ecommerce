# Pedra personalizável

## Contrato

- Administradores habilitam a opção por produto e escolhem uma lista de cores. Os IDs são estáveis; o nome e a amostra de cor ficam em lib/stone-customization.ts. Produtos desligados não têm seletor nem exigem uma cor.
- A sacola, o checkout e o pedido usam customization.stone_color. Peças unitárias usam type=stone; alianças mantêm type=ring_pair, os dois aros e as gravações. A confirmação privada projeta somente a cor, não as gravações. O painel do pedido mostra o nome da cor. Não há gerador de PDF do pedido no ecommerce.
- O hash existente já inclui customization; a mudança de cor resulta em outra intenção, mesmo com preço, frete e quantidade iguais. Não cancela retroativamente links já emitidos. Os valores e o dispatch não mudam.

## Migration

- supabase/migrations/202611160001_product_stone_customization.sql afeta ecommerce_products, a validação do item em ecommerce_create_checkout e a CHECK de customization em ecommerce_order_items. A compatibilização da CHECK e seu rollback estão descritos em [Etapa 16A](./product-stone-constraint-stage16a.md). Não adiciona coluna em ecommerce_order_items e não escreve dados operacionais.
- stone_customization_enabled é boolean NOT NULL DEFAULT false. stone_options é text[] NOT NULL DEFAULT '{}'. A CHECK exige array vazio quando desligado, e, quando ligado, entre 1 e 24 IDs com formato limitado e sem nulos. O formulário também impede duplicatas e opções fora do registro de cores. Sem backfill.
- Guardas da migration conferem a definição antiga, o owner e os acessos. Os blocos $legacy$ e $stone$ contêm a substituição exata. O teste local verifica igualdade de todo o restante da definição, inclusive linhas de subtotal, persistência, reutilização e dispatch.
- Assinatura preservada: public.ecommerce_create_checkout(p_order jsonb, p_items jsonb, p_checkout_idempotency_key text, p_request_hash text). Retorno: TABLE(result_order_id uuid, result_order_number text, result_public_token uuid, result_payment_attempt_id uuid, result_order_nsu text, result_total_cents bigint, result_attempt_status text, result_checkout_url text).
- Metadata preservado: SECURITY DEFINER, owner postgres, search_path vazio e EXECUTE para postgres/service_role. Nenhum GRANT/REVOKE na migration. Definition MD5 no baseline auditado: 4db53180b64a8234b0fe02aba7c814dc. Esperado com as quebras de linha do baseline: 034cbcc8da9804d49024d9aaf8aee935. Com LF normalizado: 11f5e1e6523eedfa6cf4dc6a4414269b.
- Teste isolado: node scripts/test-stone-rpc.mjs <caminho-do-pglite> <definição-sql-antes>. A fixture usa o corpo completo auditado da RPC, a CHECK e o validador legado de alianças reais, com dados sintéticos, sem credenciais ou rede. O SQL novo nunca foi executado em produção.

## Release consolidado e rollback

Em uma janela autorizada, revisar a ACL e os CHECKs de ecommerce_order_items, validar a migration em staging com o schema real e aplicá-la antes do build que passa a selecionar as novas colunas. Só habilitar produtos após smoke do catálogo e do checkout database. Não habilitar enquanto qualquer consumidor usar static.

Rollback lógico: desligar a personalização e limpar as opções dos produtos habilitados, sem alterar pedidos históricos. Se for necessário reverter a aplicação, manter as colunas aditivas e as escolhas já gravadas; a versão antiga as ignora. Se também for preciso restaurar a RPC, revalidar seu checksum e restaurar a definição auditada em operação aprovada separadamente, sem alterar grants. Não remover a coluna customization nem reescrever pedidos.
