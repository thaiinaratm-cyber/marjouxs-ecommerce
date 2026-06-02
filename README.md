# Antoér Joalheria e Relojoaria

E-commerce mobile-first em Next.js, TypeScript, Tailwind CSS, Context API e localStorage.

## Estrutura

- `app/`: rotas do App Router, páginas institucionais, catálogo, carrinho e checkout.
- `components/`: componentes reutilizáveis de UI, filtros e cards.
- `context/`: estado global do carrinho com persistência local.
- `data/`: produtos e categorias mockados.
- `lib/`: formatação, busca, catálogo e mensagens de WhatsApp.
- `types/`: tipos centrais do domínio.

## Scripts

```bash
npm install
npm run dev
npm run import-products
npm run build
```

## Cadastro de produtos por CSV

Edite a planilha em `data/import/produtos.csv` e rode:

```bash
npm run import-products
```

O CSV deve ser salvo em UTF-8 e separado por ponto e vírgula (`;`). Esse é o formato esperado pelo Excel em português do Brasil, mantendo as colunas separadas e acentos corretos como `Alianças`, `Anéis`, `Serviços` e `Orçamento`.

O script lê o CSV e recria automaticamente `data/products.ts`, que é o arquivo usado pela loja. As colunas são:

`name`, `category`, `subcategory`, `material`, `price`, `oldPrice`, `discountPercent`, `cashDiscountPercent`, `installmentsCount`, `priceLabel`, `installments`, `description`, `image`, `featured`, `isCustomOrder`, `allowWhatsappQuote`, `stockStatus`.

Regras importantes:

- Use `;` como separador de colunas.
- Para centavos, use vírgula, por exemplo `249,90`.
- `price` vazio gera produto sob orçamento com `price: null`.
- Para preço normal, preencha apenas `price`, por exemplo `259`.
- Para produto promocional, preencha `oldPrice` maior que `price`, por exemplo `oldPrice = 289` e `price = 259`.
- `discountPercent` pode ficar vazio; a loja calcula o percentual automaticamente quando `oldPrice` for maior que `price`.
- `cashDiscountPercent` permite mostrar preço à vista com desconto, por exemplo `5`.
- `installmentsCount` permite mostrar parcela calculada, por exemplo `10` para `10x sem juros`.
- `featured`, `isCustomOrder` e `allowWhatsappQuote` aceitam `sim` ou `não`.
- `stockStatus` aceita `disponível`, `sob encomenda` ou `indisponível`.
- A coluna `image` deve ter só o nome do arquivo, por exemplo `anel-ouro.jpg`; o script gera `/produtos/anel-ouro.jpg`.
- Coloque as imagens reais em `public/produtos/` com o mesmo nome informado na planilha.
- O script gera `id` e `slug` automaticamente a partir do nome do produto.

## Gerar produtos por imagens

Coloque novas imagens em `public/produtos/importar` e rode:

```bash
npm run gerar-produtos
```

O gerador lê apenas essa pasta de importação, cria novas linhas em `data/import/produtos.csv`, move as imagens para `public/produtos` e roda o importador para atualizar `data/products.ts`. Produtos já existentes não são duplicados.

O nome do arquivo ajuda o sistema a identificar categoria, material e preço. Exemplos:

- `anel-ouro-18k-perola-990.jpg`
- `brinco-ponto-luz-zirconia-179.jpg`
- `alianca-prata-950-namoro-259.jpg`
- `alianca-prata-950-namoro-289-259.jpg`
- `alianca-ouro-18k-pedra-4200.png`
- `alianca-banhado-ouro-classica-299.webp`

Para preços, use o último número do nome do arquivo. Exemplo: `alianca-ouro-18k-pedra-4200.png` gera `R$ 4.200,00`. Se não houver preço, o produto fica como `Sob orçamento`.

Para preço promocional, use dois valores no final do arquivo: primeiro o preço antigo e depois o preço atual. Exemplo: `alianca-prata-950-namoro-289-259.jpg` gera `oldPrice = 289` e `price = 259`. Com apenas um valor, como `alianca-prata-950-namoro-259.jpg`, o gerador preenche somente `price = 259`.

Campos gerados automaticamente:

- `description` com texto comercial em português do Brasil.
- `priceLabel` em formato `R$ 990,00`, ou `Sob orçamento` quando não houver preço.
- `installments` como `Até 6x sem juros`, ou `Consulte condições de parcelamento` quando não houver preço.
- `featured: não`
- `allowWhatsappQuote: sim`
- `stockStatus: disponível`
- `isCustomOrder: sim` apenas para alianças sob encomenda ou serviços sob orçamento.

Regras especiais para alianças no gerador:

- `ouro-18k` ou `ouro18k`: `subcategory = Alianças Ouro 18k`, `material = Ouro 18k`, `installments = Até 12x sem juros`, `stockStatus = sob encomenda`, `isCustomOrder = sim`.
- `prata`, `prata-925` ou `prata-950`: `subcategory = Alianças Prata`, `material = Prata`, `Prata 925` ou `Prata 950`, `installments = Até 6x sem juros`, `stockStatus = disponível`, `isCustomOrder = não`.
- `banhado-ouro`, `banhadoouro`, `banho-de-ouro` ou `folheado-ouro`: `subcategory = Alianças Banhado a Ouro`, `material = Banhado a ouro`, `installments = Até 6x sem juros`, `stockStatus = disponível`, `isCustomOrder = não`.

## Integrações futuras previstas

A estrutura está separada para evoluir com painel admin, Supabase, upload de imagens, controle de pedidos e pagamentos por Mercado Pago ou Stripe, sem reescrever o catálogo atual.
