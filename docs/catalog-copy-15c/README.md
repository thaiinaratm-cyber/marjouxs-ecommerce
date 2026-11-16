# Revisão editorial do catálogo

Inventário preparado antes da edição sobre duas fontes: o catálogo público ativo do Supabase (consulta somente leitura de 16/11/2026) e `data/products.ts`. Os totais não devem ser somados como produtos distintos: 387 registros do banco têm correspondência com a fonte estática.

| Fonte | Auditados | Descrições revisadas | Mantidos | Adequados | Sem descrição | Pendentes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Supabase (proposta apenas) | 549 | 285 | 264 | 34 | 155 | 230 |
| Estática (edição local) | 400 | 279 | 121 | 46 | 0 | 75 |

`inventory.json` lista cada slug, classes, decisão e, quando aplicável, motivo. As classes podem se sobrepor: A = Markdown excessivo ou repetitivo; B = texto longo; C = título repetido; D = marca repetida; E = ficha técnica ou outras informações já exibidas na PDP; F = gramática, clareza ou tom; G = descrição ausente; H = texto adequado, mantido.

- As 155 descrições ausentes continuam vazias: o cadastro não traz detalhes suficientes para escrever além do título e do material.
- Em 71 produtos pareados, a disponibilidade depende de uma comparação entre a descrição do banco e a estática. Os textos ficaram intactos nas duas fontes para não alterar o rótulo.
- Quatro textos pareados também ficaram pendentes: três citam zircônia sem informação suficiente para confirmá-la, e um tem nome de modelo ambíguo.
- Na fonte estática, apenas `description` mudou. Na proposta para o banco, sete alterações também revisam `short_description`. A revisão remove superlativos, títulos e slogans repetidos e instruções operacionais desatualizadas sem alterar os dados de especificações, preços ou prazos.

## Proposta de dados, ainda não aplicada

[`updates.proposed.json`](./updates.proposed.json) registra UUID, slug, justificativa e textos antes/depois para cada produto. O arquivo não executa SQL e não entra no fluxo do site.

Uma futura aplicação depende de autorização separada. Antes de escrever, comparar em modo somente leitura os UUIDs, slugs, situação de publicação e os dois textos anteriores, inclusive `null`, com o catálogo atual. Aplicar apenas `description` e `short_description`, com verificação dos valores anteriores dentro da mesma transação (`IS NOT DISTINCT FROM`); abortar se houver qualquer divergência no número de registros ou nos valores. Não atualizar outros campos nem fazer backfill dos pendentes.
