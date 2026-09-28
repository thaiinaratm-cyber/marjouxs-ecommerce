# Google Merchant Center — implementação e auditoria

Implementação: 27/09/2026. Validação isolada para publicação autorizada: 28/09/2026.

## Diagnóstico inicial

O Product JSON-LD é gerado por `lib/seo.ts` e inserido na página `app/produtos/[slug]/page.tsx`. Não havia feed Merchant, Google Shopping ou Content API. A ausência de disponibilidade vinha da regra que omitia o campo para itens sob encomenda.

Para publicação isolada, o feed reutiliza `getVisibleProducts()`, de `lib/products.ts`, a mesma fonte das páginas já publicadas: `data/products.ts`. A camada `lib/catalog` pertence a outra fase ainda não versionada e não faz parte deste deploy. Quando essa migração for publicada, o ponto de leitura do feed deverá acompanhá-la. Nenhum arquivo do catálogo ou da integração com Supabase foi alterado.

O modelo contém ID, slug, nome, categoria/subcategoria, material, preço atual/anterior, preço textual, desconto/parcelamento, descrição, imagens ordenadas, status e encomenda. Não contém GTIN, MPN, cor nem SKUs de variações por tamanho. Os aros são escolhidos durante a compra: um intervalo de aros não foi transformado em uma variação fictícia.

O responsável confirmou nesta conversa que nenhum produto elegível tem GTIN/EAN ou MPN atribuído. Por isso o feed usa `identifier_exists=false`. Essa decisão deve ser revista quando o catálogo passar a incluir produtos com identificadores de fabricante.

O checkout calcula o frete por CEP pelo Melhor Envio, considerando os dados reais da encomenda. Não existe tarifa universal nem tabela estática completa que permita preencher corretamente OfferShippingDetails. A política de entrega publicada ainda descreve atendimento/entrega combinados; essa diferença em relação ao checkout precisa de revisão comercial posterior, sem alteração automática nesta tarefa.

As políticas de trocas/devoluções e garantia preveem contato com a loja, avaliação da peça e análise individual de itens personalizados, gravados ou com medidas específicas. Não estabelecem prazo de devolução, taxas, método de transporte nem uma regra geral de aceitação/rejeição suficiente para preencher todos os campos de devolução no Offer.

## Arquivos desta tarefa

Criados:
- `app/google-merchant.xml/route.ts`
- `app/google-merchant.xml/route.test.ts`
- `lib/google-merchant.ts`
- `lib/google-merchant.test.ts`
- `lib/google-product-fields.ts`
- `docs/google-merchant.md`

Alterados:
- `lib/seo.ts`
- `lib/seo.test.ts`
- `next.config.mjs`

O TypeScript/build também atualiza o cache gerado `tsconfig.tsbuildinfo`, já modificado antes desta tarefa. As demais alterações que já estavam presentes no workspace não pertencem a esta implementação.

## Feed e critérios de publicação

URL após deploy: https://marjouxsjoias.com.br/google-merchant.xml

Endpoint dinâmico, público, GET/HEAD, RSS 2.0 com namespace `http://base.google.com/ns/1.0`, UTF-8, sem autenticação nem escrita. A saída contém somente campos públicos explicitamente selecionados; não serializa objetos administrativos, tokens ou clientes. POST recebe 405. Falha de leitura, IDs duplicados ou catálogo elegível vazio retornam 503 genérico, com Retry-After e sem detalhes internos. O cache HTTP é no-store.

Somente produtos públicos, físicos, com slug válido, nome, descrição, preço positivo válido, imagem principal existente e status Disponível/Sob encomenda entram no feed. Não entram serviços, itens indisponíveis, orçamento sem preço ou imagens ausentes/placeholder.

`next.config.mjs` gera automaticamente um inventário dos arquivos públicos de imagem existentes e não vazios durante o build. Somente os caminhos públicos são incorporados à função. Assim o endpoint funciona em funções Netlify sem depender da presença física de `public/` dentro da função. O XML é gerado a cada requisição a partir do mesmo catálogo versionado utilizado pelas páginas. Atualizações em `data/products.ts` e adição/remoção de imagens locais exigem build/deploy, como já ocorre no site.

IDs reais são preservados quando atendem ao limite de 50 caracteres ASCII permitidos pela implementação. Nos demais casos, usa-se `mj-` e 44 caracteres de SHA-256 do ID original. O mesmo identificador aparece em Product.sku; não se trata de MPN. Colisões, inclusive de caixa, são recusadas.

Produtos sob encomenda que continuam compráveis são mapeados para `in_stock` / `https://schema.org/InStock`, considerando o prazo de confecção informado. Isso não muda o status visual “Sob encomenda” nem a operação comercial. Não foram criados preorder, backorder ou datas de reposição fictícias.

Preço sem promoção: `price=product.price`. Promoção real: `price=oldPrice` e `sale_price=product.price`, somente quando o preço anterior é válido e maior que o atual. O preço efetivo coincide com a página e o JSON-LD. Desconto Pix e parcelas não são usados como preço do produto.

Nome e descrição vêm da fonte; HTML é removido e caracteres XML são escapados. Links são absolutos de produção em HTTPS. São incluídas até dez imagens adicionais reais e distintas, material, categoria Google e hierarquia categoria/subcategoria. Brand é “Marjouxs Joias” e condition é “new”, conforme solicitado. Não são inventados GTIN, MPN, cor, tamanho, avaliações ou notas.

Categorias Google: Alianças/Anéis 200; Brincos 194; Correntes 196; Pulseiras/Braceletes 191; Pingentes 192; Relógios 201.

## Dados estruturados e avisos

Preservados Product, metadados, canonical, descrições SEO, breadcrumbs, sitemap e robots. Product recebeu disponibilidade consistente, SKU estável e marca igual ao feed. A loja recebeu MerchantReturnPolicy com somente merchantReturnLink apontando para /trocas-e-devolucoes. Essa é uma alternativa documentada para o nível da organização, sem inferir dias, taxas ou regras não publicadas.

Após deploy e novo rastreamento, espera-se resolver o aviso de availability nos produtos elegíveis sob encomenda. O código local, por si só, não muda os relatórios já processados pelo Google.

Os avisos de review/aggregateRating permanecem até haver avaliações reais. Não foram adicionados shippingDetails nem uma política completa em offers: os dados necessários não estão disponíveis. O link na organização não garante a remoção do aviso específico de hasMerchantReturnPolicy em offers.

## Configuração manual no Merchant Center

1. Após aprovar e realizar o deploy, verificar a URL pública e cadastrar uma fonte programada por URL para Brasil, português e BRL.
2. Confirmar a reivindicação do domínio na conta Merchant. A verificação no Search Console não substitui necessariamente essa configuração da conta.
3. Substituir o frete provisório de R$ 30 por uma configuração de serviços/regiões/custos compatível com os valores reais cobrados. Definir horário de corte, dias úteis, prazo de preparação e trânsito com a operação. Não assumir que o Merchant consulta o Melhor Envio automaticamente.
4. O prazo informado para confecção é de 3 a 5 dias úteis; confirmar sua aplicação por grupo de produtos. Não confundir confecção com trânsito da transportadora.
5. Definir com a loja os termos reais de devolução, incluindo país, prazo, método, custos e exceções de personalizados/gravados. Publicar eventuais decisões nas políticas antes de replicá-las no Merchant.
6. Revisar as necessidades de tamanho/gênero/faixa etária/cor conforme os destinos e programas ativados; o modelo atual não permite preencher todos esses atributos. Não gerar dados por inferência apenas para eliminar diagnósticos.
7. Revisar os diagnósticos da primeira importação e eventuais requisitos de qualidade de imagens. Não há garantia de aprovação automática pelo Google.
8. A exclusão local de `/produtos/anel-teste-01.jpg` pertence a outra tarefa e não integra esta publicação. A imagem existe na versão publicada e o produto `anel-ouro-18k-com-perola` permanece elegível. Nenhuma imagem ou produto foi alterado nesta etapa.

## Referências oficiais

- [Disponibilidade](https://support.google.com/merchants/answer/6324448?hl=en)
- [Identifier exists](https://support.google.com/merchants/answer/6324478?hl=en)
- [Identificadores estáveis](https://support.google.com/merchants/answer/6324405?hl=en)
- [Preço promocional](https://support.google.com/merchants/answer/6324471?hl=en)
- [Especificação de dados](https://support.google.com/merchants/answer/7052112?hl=en)
- [RSS 2.0](https://support.google.com/merchants/answer/14987622?hl=en)
- [Política de devolução da organização](https://developers.google.com/search/docs/appearance/structured-data/return-policy)
- [Dados estruturados para listagens do comerciante](https://developers.google.com/search/docs/appearance/structured-data/merchant-listing)
- [Taxonomia Google](https://www.google.com/basepages/producttype/taxonomy-with-ids.en-US.txt)

## Validação isolada da versão para publicação

Resultado: 386 produtos elegíveis, incluindo 6 promoções reais. O catálogo estático tem 400 registros; 387 passam pelo filtro público já existente e 386 também têm preço/compra elegíveis e imagem existente na versão publicada. A contagem anterior de 385 correspondia ao workspace misto, que contém uma exclusão de imagem de outra tarefa. Quatro IDs da fonte excedem 50 caracteres e usam o identificador estável derivado no feed e em Product.sku.

- npm test: 155 aprovados na versão isolada. A execução anterior de 224 aprovados e 1 desativado incluía testes de fases que não fazem parte desta publicação. Os testes cobrem também checkout, pagamentos, carrinho e frete com dependências simuladas, sem transação real.
- npm run lint: aprovado, sem avisos ou erros.
- npx tsc --noEmit: aprovado.
- npm run build: aprovado na cópia isolada de HEAD com somente os nove arquivos Merchant, incluindo /google-merchant.xml dinâmico.
- git diff --check: aprovado.
- GET e HEAD /google-merchant.xml: 200; application/xml; charset=utf-8.
- POST /google-merchant.xml: 405.
- XML parseado por XmlReader/.NET com DTD proibido e resolução externa desativada: bem formado; namespace, preços, HTTPS, unicidade e tamanho dos IDs conferidos.
- Testes de acentos, apóstrofos, &, aspas, HTML e caracteres XML inválidos aprovados.
- Sitemap, robots, checkout, carrinho e políticas: HTTP 200 no servidor local de produção.
- Testes de consistência percorrem todos os itens elegíveis; a comparação HTTP detalhada cobriu os quatro produtos abaixo.

| Produto | Preço efetivo | Situação na fonte | JSON-LD / feed | Página e imagem |
| --- | ---: | --- | --- | --- |
| Alianças em Ouro 18k Tradicional | R$ 3.200,00 | Sob encomenda | InStock / in_stock | 200 / 200 |
| Aliança Prata 950 Ancora | R$ 590,00 | Disponível | InStock / in_stock | 200 / 200 |
| Brinco em Ouro 18k | R$ 10.360,00 | Disponível | InStock / in_stock | 200 / 200 |
| Alianças Ouro 18k 750 com Coração | R$ 6.100,00 | Sob encomenda | InStock / in_stock | 200 / 200 |

Para cada amostra, foram conferidos ID/sku, nome, preço visível na página, preço efetivo do feed, preço do JSON-LD, canonical, URL da imagem e disponibilidade. No produto promocional, sale_price coincide com o preço efetivo e price mantém o preço anterior real.

Os resultados HTTP acima são locais, usando npm run start após o build. A URL em produção deverá ser conferida após um deploy autorizado. Não foi feita compra real nem importação nesta conta Merchant.

### Exemplo real retornado pelo endpoint

O item abaixo fica dentro de rss/channel, com xmlns:g="http://base.google.com/ns/1.0" declarado no elemento rss.

```xml
    <item>
      <g:id>aliancas-em-ouro-18k-tradicional</g:id>
      <g:title>Alianças em Ouro 18k Tradicional</g:title>
      <g:description>Aliança em ouro 18k/750 com acabamento elegante, feita sob encomenda para momentos especiais. Confeccionamos diversos modelos em até 3 dias. Gravação dos nomes e caixinha inclusas como cortesia. Consulte numeração, prazo e parcelamento em até 12x sem juros pelo WhatsApp.</g:description>
      <g:link>https://marjouxsjoias.com.br/produtos/aliancas-em-ouro-18k-tradicional</g:link>
      <g:image_link>https://marjouxsjoias.com.br/produtos/aliancas-ouro-18k-750-polida-3200.png</g:image_link>
      <g:availability>in_stock</g:availability>
      <g:price>3200.00 BRL</g:price>
      <g:condition>new</g:condition>
      <g:brand>Marjouxs Joias</g:brand>
      <g:google_product_category>200</g:google_product_category>
      <g:product_type>Alianças &gt; Alianças Ouro 18k</g:product_type>
      <g:identifier_exists>false</g:identifier_exists>
      <g:material>Ouro 18k</g:material>
    </item>
```

- Imagens do feed: os 385 caminhos únicos responderam HTTP 200 com Content-Type de imagem e tamanho maior que zero, em requisições HEAD locais.
