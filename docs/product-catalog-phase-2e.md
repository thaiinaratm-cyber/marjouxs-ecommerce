# Catálogo público controlado (Fase 2E)

- `PRODUCT_CATALOG_SOURCE=static` é o padrão. Valores desconhecidos também usam `static`.
- `PRODUCT_CATALOG_SOURCE=database` lê somente `is_active=true` e `legacy_id IS NOT NULL` via chave pública anon e RLS. Nesta fase, o produto manual `anel-feminino` fica excluído. Imagens legadas continuam em `/produtos/...`.
- `PRODUCT_CATALOG_FALLBACK=true` é o padrão. Falha de conexão, timeout, query ou estrutura inválida retorna a vitrine estática. Com `false`, a falha gera `public_catalog_unavailable`. Slug ausente em uma leitura bem-sucedida retorna 404, sem fallback.
- O catálogo do banco usa cache compartilhado do Next.js (`unstable_cache`) por 300 segundos e deduplicação por requisição (`React.cache`). Uma edição aprovada no painel pode levar até cinco minutos para aparecer. Falhas não são armazenadas nesse cache. Os logs `public_catalog` contêm apenas fonte e uso de fallback.
- Como o checkout permanece estático, divergência de preço ou slug em qualquer legado é tratada como falha estrutural: usa fallback (ou erro controlado, se desabilitado). Edições desses campos só devem ser publicadas após a próxima fase de migração do checkout.
- A ordem pública segue os IDs do catálogo legado, preservando destaques, relacionados e sitemap. `Product.id` usa `legacy_id` para manter o contrato da sacola.
- As páginas públicas usam a nova camada; o carrinho e a validação server-side do checkout permanecem estáticos em `data/products.ts`. Não altere a fonte do checkout antes de auditar paridade de preços e publicação. Se um preço no banco divergir, o checkout estático continua autoritativo.
- Para rollback, definir `PRODUCT_CATALOG_SOURCE=static` no ambiente e fazer novo deploy. Não há alteração de schema, dados ou arquivos de imagem nesta fase. Não configurar a flag no Netlify até aprovação.
