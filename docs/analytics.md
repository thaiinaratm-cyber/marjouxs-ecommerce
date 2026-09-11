# Google Analytics 4

## Configuração

Defina o Measurement ID do fluxo Web do GA4 no ambiente local e na hospedagem:

```env
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX
GA4_API_SECRET=seu-segredo-do-measurement-protocol
```

Use `.env.local` no desenvolvimento e a variável de ambiente do Netlify em produção. O valor não é um segredo, mas não fica gravado no código. Quando a variável está ausente ou não começa com `G-`, nenhum script é carregado e os helpers permanecem inativos.

## Eventos implementados

- `page_view`: navegações iniciais e client-side do App Router, sem duplicação automática.
- `view_item`: visualização da página individual, com dados comerciais do produto.
- `select_item`: clique em card, imagem, nome ou CTA de produto, com lista e origem.
- `search`: busca submetida no cabeçalho ou concluída após debounce no catálogo.
- `category_click`: clique em categoria na Home, mega menu, menu mobile, páginas e rodapé.
- `whatsapp_click`: clique nos CTAs de WhatsApp, identificado apenas pela localização no site.
- `directions_click`: clique em “Como chegar”.
- `size_guide_click`: acesso ao guia de tamanhos, com produto quando aplicável.
- `contact_click`: WhatsApp, Instagram, e-mail e direções na página de contato.

`service_contact_click` também está disponível para um CTA futuro ligado a um serviço específico. Os CTAs gerais atuais de Serviços usam `whatsapp_click`, pois não representam um serviço individual.

Os itens de e-commerce usam `currency: BRL` e, quando disponíveis, `item_id`, `item_name`, categoria, subcategoria, material e preço. Nenhum evento envia nome de cliente, telefone, e-mail, endereço, conteúdo de mensagem, CPF ou dados de pagamento.

## Eventos do checkout

O checkout dispara:

- `add_to_cart`
- `view_cart`
- `remove_from_cart`
- `begin_checkout`
- `add_payment_info`
- `add_shipping_info`

`purchase` não é disparado pelo redirect nem pelo navegador. A confirmação validada da InfinitePay cria um evento único `ga4_purchase` no outbox. A Scheduled Function do Netlify o envia pelo Measurement Protocol com `transaction_id = order_number`; o `UNIQUE(order_id, event_type)` e as RPCs de claim/complete evitam duplicação lógica. O payload contém somente dados comerciais do pedido, sem nome, telefone, e-mail, CPF, endereço ou gravações.

## Teste no DebugView

1. Configure um fluxo Web no GA4 e copie o ID `G-...`.
2. Adicione o ID ao `.env.local` e reinicie `npm run dev`.
3. Abra o site em uma janela sem bloqueador de anúncios.
4. No GA4, acesse **Administrador > Exibição de dados > DebugView**.
5. Navegue pelo site e clique nos elementos que deseja validar.
6. Abra cada evento no DebugView para conferir parâmetros como `location`, `source`, `item_id` e `item_list_name`.

Em desenvolvimento, a configuração envia `debug_mode: true`. Para confirmar a principal conversão atual, clique em qualquer CTA do WhatsApp e procure `whatsapp_click`. Para produto, abra uma página individual e procure `view_item`; volte à lista e clique em um card para conferir `select_item`.

## Eventos principais

Marque manualmente no GA4 como evento principal:

- Agora: `whatsapp_click`.
- Pagamento aprovado: `purchase`.
- Opcionalmente: `directions_click` e `service_contact_click`.

A camada central permite incluir uma futura decisão de consentimento dentro de `trackEvent` e do componente de carregamento, sem reescrever os componentes instrumentados.
