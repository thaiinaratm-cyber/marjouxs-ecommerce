# Etapa 16A: CHECK de personalização dos itens do pedido

## Definição instalada

Resultado exato de `pg_get_constraintdef` no Supabase Marjouxs (`degyoeckqbggmezedudi`, leitura de 16/11/2026). A constraint `public.ecommerce_order_items.ecommerce_order_items_customization_ck` estava validada; `category` e `quantity` são `NOT NULL`. As duas colunas da migration da pedra ainda não estavam instaladas.

```sql
CHECK ((((category = 'Alianças'::text) AND (quantity = 1) AND (ecommerce_valid_ring_pair(customization) IS TRUE)) OR ((category <> 'Alianças'::text) AND (customization IS NULL))))
```

O inventário somente leitura encontrou 12 itens: todos não-alianças com `customization` SQL `NULL`, nenhum formato JSON persistido e nenhuma incompatibilidade histórica. Os 12 casos continuam aceitos pelo ramo legado preservado. A fixture representa todos pelo formato agregado, acrescenta duas alianças legadas sintéticas e valida a migração sobre as 14 linhas, sem copiar dados reais.

## Definição proposta

```sql
CHECK (
  (category = 'Alianças' AND quantity = 1 AND public.ecommerce_valid_ring_pair(customization) IS TRUE)
  OR (category <> 'Alianças' AND customization IS NULL)
  OR CASE
    WHEN pg_catalog.jsonb_typeof(customization) = 'object'
      AND pg_catalog.jsonb_typeof(customization -> 'stone_color') = 'string'
      AND (customization ->> 'stone_color') COLLATE pg_catalog."C" ~ '^[a-z0-9][a-z0-9-]{0,39}$'
    THEN (category = 'Alianças' AND quantity = 1
        AND customization -> 'type' = '"ring_pair"'::jsonb
        AND public.ecommerce_valid_ring_pair(customization - 'stone_color') IS TRUE)
      OR (category <> 'Alianças' AND customization -> 'type' = '"stone"'::jsonb AND customization - ARRAY['type', 'stone_color'] = '{}'::jsonb)
    ELSE false
  END IS TRUE
)
```

- A regra legada permanece como alternativa independente. Para itens comuns, só se acrescenta o objeto com exatamente `type: "stone"` e `stone_color`. Para alianças, exige-se `type: "ring_pair"`, quantidade 1 e o mesmo validador de par depois de retirar somente `stone_color`. O validador continua responsável por aros, gravações e chaves adicionais do par.
- O novo ramo exige ID textual no formato da Etapa 15A: 1 a 40 caracteres, começando com letra minúscula ASCII ou dígito e podendo conter hífen depois. O ramo rejeita valores nulos, formatos arbitrários, chaves desconhecidas e objetos incompletos. Não duplica a lista comercial nem consulta outras tabelas.
- A RPC continua verificando se o produto é elegível, se habilita pedra e se a cor pertence às opções desse produto. Seu corpo e seus privilégios não mudaram em relação à Etapa 15A. MD5 esperado de `pg_get_functiondef`: `034cbcc8da9804d49024d9aaf8aee935` no formato do baseline, ou `11f5e1e6523eedfa6cf4dc6a4414269b` com CRLF convertido em LF.

## Substituição e rollback

A migration verifica o nome, a definição e o estado validado da CHECK anterior. Em uma única transação, cria `ecommerce_order_items_customization_stone_ck` com `NOT VALID`, valida todas as linhas enquanto a constraint antiga ainda existe, remove a antiga e renomeia a já validada. Qualquer falha aborta a migration inteira, inclusive a alteração da RPC e as duas colunas aditivas. Nenhum dado de pedido é reescrito.

- **Antes de haver itens com pedra:** bloquear novas escolhas de pedra e checar por leitura se a regra antiga aceita todas as linhas. Mediante autorização separada, restaurar a RPC anterior pelo backup auditado e restaurar a CHECK antiga com a mesma sequência de adição, validação e troca em transação. As colunas aditivas podem permanecer com a personalização desativada.
- **Depois de haver itens com pedra:** não restaurar a CHECK antiga e não remover `stone_color` dos pedidos. Desabilitar novas escolhas pelo painel antes de um rollback de aplicação; manter a CHECK ampliada, as colunas e os itens históricos. Qualquer retorno da RPC ao corpo anterior exige reconciliação dos fluxos em andamento e autorização separada.

## Teste da proteção

O teste PGlite falha se a fixture não tiver a definição exata da CHECK antiga e o validador real (MD5 com LF `ebef676d1b0dec8eb0bbc23fa1b448d8`). Também verifica que ambos os formatos com pedra falham na CHECK antiga e persistem pela RPC depois da troca, sem alterações no histórico. Rejeições mantêm as contagens de pedidos, itens e tentativas; nenhuma API externa é chamada.
