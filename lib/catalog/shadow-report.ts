import type { ShadowDifference, ShadowResult } from "./shadow-compare";
import { shadowMetrics } from "./shadow-compare.ts";

function sectionRows(differences: ShadowDifference[]) {
  if (differences.length === 0) return "Nenhuma.";
  return differences
    .map((difference) =>
      `- \`${difference.slug}\` / \`${difference.field}\`: esperado \`${difference.expected.replace(/`/g, "'")}\`; banco \`${difference.actual.replace(/`/g, "'")}\`.`
    )
    .join("\n");
}

function slugRows(slugs: string[]) {
  return slugs.length === 0 ? "Nenhum." : slugs.map((slug) => `- \`${slug}\``).join("\n");
}

export function renderShadowReport(result: ShadowResult, generatedAt = new Date().toISOString()) {
  const metrics = shadowMetrics(result);
  const critical = result.differences.filter((difference) => difference.severity === "critical");
  const expected = result.differences.filter((difference) => difference.severity === "expected");
  const informational = result.differences.filter((difference) => difference.severity === "informational");
  const priceDifferences = critical.filter((difference) => difference.field === "price" || difference.field === "old_price");
  const imageDifferences = critical.filter((difference) => difference.field === "images" || difference.field === "orphan_image");
  const taxonomyDifferences = critical.filter((difference) =>
    ["category_id", "subcategory_id", "material_id", "mapping"].includes(difference.field)
  );

  return `# Paridade do catálogo em modo sombra

Gerado em: ${generatedAt}.

Consulta somente leitura. O catálogo público e o checkout continuam usando \`data/products.ts\`.

## Resumo

| Métrica | Total |
| --- | ---: |
| Catálogo estático | ${metrics.static_count} |
| Legados no banco | ${metrics.database_legacy_count} |
| Produtos manuais | ${result.adminOnlyCount} |
| Correspondências por \`legacy_id\` | ${metrics.matched_count} |
| Faltantes no banco | ${metrics.missing_in_db_count} |
| Extras no banco | ${metrics.extra_in_db_count} |
| Diferenças críticas | ${metrics.critical_diff_count} |
| Diferenças esperadas | ${metrics.expected_diff_count} |
| Diferenças informativas | ${informational.length} |

## Status comercial

- Legados ativos: ${result.status.active}.
- Legados inativos: ${result.status.inactive}.
- \`stock_status = made_to_order\`: ${result.status.madeToOrder}.
- \`is_custom_order = true\`: ${result.status.customOrder}.

### Produtos faltantes

${slugRows(result.missingInDb)}

### Produtos extras

${slugRows(result.extraInDb)}

## Preços

- Preços iguais: ${result.prices.equal}.
- Produtos com \`price\` ou \`old_price\` divergente: ${result.prices.divergent}.
- Produtos sem preço na fonte: ${result.prices.withoutPrice}.
- A comparação de \`price\` e \`old_price\` usa representação decimal com duas casas. Descontos também são comparados.

${sectionRows(priceDifferences)}

## Imagens

- Produtos com lista de imagens igual: ${result.images.equal}.
- Produtos com imagem esperada ausente no banco: ${result.images.missing}.
- Produtos com placeholder no catálogo estático: ${result.images.placeholders}.
- Metadados de imagem legada no banco: ${result.images.legacyImages}.
- Caminhos compartilhados: ${result.images.sharedPaths.length}.
- Todas as imagens legadas esperadas usam \`source_type = local\`, principal e ordem conforme o mapeamento da migração.

${sectionRows(imageDifferences)}

### Arquivos compartilhados

${slugRows(result.images.sharedPaths)}

## Alianças

- Total no catálogo estático: ${result.alliances.total}.
- Vendidas por par no banco: ${result.alliances.soldAsPair}.
- Com aros 8 a 35: ${result.alliances.withSizeRange}.
- Com gravação disponível: ${result.alliances.engravingAvailable}.
- Com gravação inclusa: ${result.alliances.engravingIncluded}.
- Com caixinha inclusa: ${result.alliances.jewelryBoxIncluded}.
- Inconsistências: ${result.alliances.inconsistencies.length}.

${sectionRows(result.alliances.inconsistencies)}

## Taxonomia

- Categorias cadastradas no banco: ${result.taxonomy.categories}; divergências em produtos: ${result.taxonomy.categoryDifferences}.
- Subcategorias cadastradas no banco: ${result.taxonomy.subcategories}; divergências em produtos: ${result.taxonomy.subcategoryDifferences}.
- Materiais cadastrados no banco: ${result.taxonomy.materials}; divergências em produtos: ${result.taxonomy.materialDifferences}.

${sectionRows(taxonomyDifferences)}

## Produto manual

- \`admin_only\`: ${result.adminOnlyCount}.
- Slug: \`${result.manual.slug ?? "ausente"}\`.
- \`legacy_id = null\`, ativo e com uma imagem: ${result.manual.valid ? "sim" : "não"}.
- Comparação de identidade, nome e status com o snapshot anterior: ${result.manual.baselineChecked ? "realizada" : "snapshot indisponível"}.
- A imagem manual é validada por quantidade. O snapshot anterior não inclui seu caminho nem todos os campos, portanto a verificação integral pré/pós depende do resultado \`manual_preserved = true\` da Fase 2C.

## Diferenças esperadas

${sectionRows(expected)}

## Diferenças críticas

${sectionRows(critical)}

## Diferenças informativas

${sectionRows(informational)}
`;
}
