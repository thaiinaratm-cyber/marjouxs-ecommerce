# Paridade do catálogo em modo sombra

Gerado em: 2026-09-28T18:23:08.386Z.

Consulta somente leitura. O catálogo público e o checkout continuam usando `data/products.ts`.

## Resumo

| Métrica | Total |
| --- | ---: |
| Catálogo estático | 400 |
| Legados no banco | 400 |
| Produtos manuais | 1 |
| Correspondências por `legacy_id` | 400 |
| Faltantes no banco | 0 |
| Extras no banco | 0 |
| Diferenças críticas | 0 |
| Diferenças esperadas | 14 |
| Diferenças informativas | 1 |

## Status comercial

- Legados ativos: 387.
- Legados inativos: 13.
- `stock_status = made_to_order`: 132.
- `is_custom_order = true`: 61.

### Produtos faltantes

Nenhum.

### Produtos extras

Nenhum.

## Preços

- Preços iguais: 396.
- Produtos com `price` ou `old_price` divergente: 0.
- Produtos sem preço na fonte: 4.
- A comparação de `price` e `old_price` usa representação decimal com duas casas. Descontos também são comparados.

Nenhuma.

## Imagens

- Produtos com lista de imagens igual: 400.
- Produtos com imagem esperada ausente no banco: 0.
- Produtos com placeholder no catálogo estático: 13.
- Metadados de imagem legada no banco: 387.
- Caminhos compartilhados: 1.
- Todas as imagens legadas esperadas usam `source_type = local`, principal e ordem conforme o mapeamento da migração.

Nenhuma.

### Arquivos compartilhados

- `/produtos/aliancas-ouro-18k-750-polida-3200.png`

## Alianças

- Total no catálogo estático: 143.
- Vendidas por par no banco: 143.
- Com aros 8 a 35: 143.
- Com gravação disponível: 143.
- Com gravação inclusa: 143.
- Com caixinha inclusa: 143.
- Inconsistências: 0.

Nenhuma.

## Taxonomia

- Categorias cadastradas no banco: 9; divergências em produtos: 0.
- Subcategorias cadastradas no banco: 40; divergências em produtos: 0.
- Materiais cadastrados no banco: 7; divergências em produtos: 0.

Nenhuma.

## Produto manual

- `admin_only`: 1.
- Slug: `anel-feminino`.
- `legacy_id = null`, ativo e com uma imagem: sim.
- Comparação de identidade, nome e status com o snapshot anterior: realizada.
- A imagem manual é validada por quantidade. O snapshot anterior não inclui seu caminho nem todos os campos, portanto a verificação integral pré/pós depende do resultado `manual_preserved = true` da Fase 2C.

## Diferenças esperadas

- `aliancas-em-ouro-18k-anatomicas` / `inactive_by_migration`: esperado `no valid source image`; banco `is_active=false`.
- `aliancas-em-prata-para-namoro` / `inactive_by_migration`: esperado `no valid source image`; banco `is_active=false`.
- `anel-solitario-em-ouro-18k` / `inactive_by_migration`: esperado `no valid source image`; banco `is_active=false`.
- `anel-feminino-em-ouro` / `inactive_by_migration`: esperado `no valid source image`; banco `is_active=false`.
- `brinco-ponto-de-luz` / `inactive_by_migration`: esperado `no valid source image`; banco `is_active=false`.
- `brinco-argola` / `inactive_by_migration`: esperado `no valid source image`; banco `is_active=false`.
- `corrente-masculina-em-prata` / `inactive_by_migration`: esperado `no valid source image`; banco `is_active=false`.
- `pulseira-infantil-chapinha` / `inactive_by_migration`: esperado `no valid source image`; banco `is_active=false`.
- `pingente-religioso` / `inactive_by_migration`: esperado `no valid source image`; banco `is_active=false`.
- `troca-de-bateria-de-relogio` / `inactive_by_migration`: esperado `no valid source image`; banco `is_active=false`.
- `banho-de-joia` / `inactive_by_migration`: esperado `no valid source image`; banco `is_active=false`.
- `polimento-de-alianca` / `inactive_by_migration`: esperado `no valid source image`; banco `is_active=false`.
- `gravacao-em-alianca` / `inactive_by_migration`: esperado `no valid source image`; banco `is_active=false`.
- `anel-feminino` / `admin_only`: esperado `excluded from static catalog`; banco `one manual product`.

## Diferenças críticas

Nenhuma.

## Diferenças informativas

- `catalog` / `database_metadata`: esperado `not compared`; banco `UUIDs and timestamps`.
