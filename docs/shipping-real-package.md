# Embalagem real de postagem - preparo local

## Configuracao aprovada

| Medida | Provisoria anterior | Real medida |
| --- | --- | --- |
| Comprimento | 16 cm | 16 cm |
| Largura | 12 cm | 11 cm |
| Altura | 6 cm | 3 cm |
| Peso pronto para postagem | 0,3 kg | 0,07 kg (70 g) |

`lib/checkout/config.ts` continua sendo a unica origem dos fallbacks.
`getShippingConfiguration()` le os overrides de ambiente e valida numeros
positivos. `buildShipmentPayload()` em `lib/checkout/shipping.ts` consome essa
configuracao. Nao houve mudanca no parser, OAuth, checkout ou regras financeiras.

As quatro envs estavam ausentes do `.env.local`, portanto o ambiente local usava
os fallbacks. Foram adicionadas somente as quatro medidas aprovadas:

```dotenv
DEFAULT_SHIPMENT_LENGTH_CM=16
DEFAULT_SHIPMENT_WIDTH_CM=11
DEFAULT_SHIPMENT_HEIGHT_CM=3
DEFAULT_SHIPMENT_WEIGHT_KG=0.07
```

O peso ja esta em kg: 70 / 1000 = 0,07. Nao existe conversao adicional no envio
para a API, nem interpretacao de 70 como kg. Overrides por env continuam tendo
precedencia; nenhum peso foi duplicado em outra constante de runtime.

## Payload

Continua existindo um unico produto/pacote logistico, com `quantity: 1`:

```json
{
  "id": "marjouxs-package",
  "width": 11,
  "height": 3,
  "length": 16,
  "weight": 0.07,
  "insurance_value": 3600,
  "quantity": 1
}
```

O valor 3600 acima e o subtotal validado usado no teste, nao uma constante.
No payload efetivo ele continua sendo calculado: `subtotalCents / 100`, com a normalizacao anterior.
Origem, destino, allowlist, `receipt: false` e `own_hand: false` foram preservados.

## Cotacao controlada no Sandbox

Comparacao executada com as funcoes reais de configuracao, payload, cotacao e
parser, usando apenas o token Sandbox local. A protecao de QA impede acesso ao
Vault e qualquer endpoint diferente de shipment/calculate no Sandbox.

- Origem: 07400610.
- Destino: 07400805.
- Servico permitido local: 2, SEDEX, Correios.
- Subtotal: R$ 3.600,00, obtido pela validacao autoritativa local de um produto
  real do catalogo; nenhum pedido foi criado.
- Valor declarado: R$ 3.600,00 em ambas as consultas, sem reducao/zeramento.

| Pacote | Preco retornado | Prazo de transporte |
| --- | --- | --- |
| Anterior: 16 x 12 x 6 cm / 0,3 kg | R$ 45,68 | 2 dias uteis |
| Real: 16 x 11 x 3 cm / 0,07 kg | R$ 45,68 | 2 dias uteis |

Diferenca observada: R$ 0,00 e zero dias. Esse resultado nao e uma tarifa fixa
nem promessa para outros valores/destinos. Os precos nao foram hardcoded.
Prazo de confeccao de 3 a 5 dias uteis permanece separado e inalterado.

## Limite de capacidade

O modelo continua sendo uma embalagem por checkout, sem incremento por quantidade,
multiplas caixas ou faixas inventadas. Compras maiores podem precisar de revisao
futura da embalagem, apos medir capacidade e outros pacotes reais.

## Netlify e futuro deploy unico

As quatro envs foram confirmadas visualmente como existentes, em All scopes e
com o mesmo valor nos deploy contexts. Nenhuma configuracao da Netlify foi editada.
Como envs tem precedencia sobre fallbacks, no futuro sera necessario conferir e
aplicar os quatro valores aprovados antes do deploy autorizado, incluindo 11 cm,
3 cm e 0.07 kg. O comprimento permanece 16 cm.

Recorte desta tarefa para revisao seletiva futura:

- `lib/checkout/config.ts`: apenas os fallbacks fisicos.
- `.env.example`: valores publicos de exemplo.
- `lib/checkout/config.test.ts`: unidades, fallbacks e overrides.
- `lib/checkout/shipping.test.ts`: payload, seguro integral e pacote unico.
- `docs/shipping-real-package.md`: este relatorio.

`.env.local` e somente local, ignorado pelo Git, e NAO deve entrar no commit.
QA, JSON de comparacao, logs e build isolado ficam fora do repositorio. Os arquivos
ja contem mudancas paralelas em alguns casos; nao usar git add . para o recorte.

Nenhuma alteracao em producao, banco, RPC, Vault, pagamento, Pix, webhook ou Etapa 2.
Nenhum stage, commit, push, deploy, pedido ou pagamento real nesta tarefa.

## Validacoes finais

- Testes focados: 113 passaram.
- `npm test`: 878 passaram; 6 testes live ignorados na suite normal.
- QA Sandbox opt-in fora do repositorio: 1 passou; duas cotacoes HTTP 200,
  token_source local_sandbox e nenhuma chamada ao Vault.
- `npm run lint`: sem avisos ou erros ESLint.
- `npx tsc --noEmit --incremental false`: passou.
- `npm run build`: passou em copia isolada fora do OneDrive, sem copiar envs.
- `git diff --check`: passou.
- Avisos nao bloqueantes do build: cache webpack e Browserslist desatualizado;
  nenhuma dependencia atualizada.
- Comparacao de integridade: os 18 arquivos da Etapa 2 permaneceram identicos.
- Demais valores do `.env.local` permaneceram iguais, sem exibir ou copiar secrets.
- Indice Git permaneceu vazio. `.env.local` continua ignorado pelo Git.
