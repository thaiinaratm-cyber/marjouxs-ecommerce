# PDP: Características e descrição

- Sem migration. O leitor público seleciona apenas os campos técnicos conhecidos de ecommerce_products e os normaliza para o modelo de produto. Não incorpora observações internas nem peso/dimensões do pacote de frete.
- Peso aproximado em g, largura/espessura/altura/diâmetro em mm, comprimento em cm. Material, acabamento, pedra cadastrada, estilo, faixa de aros, Conforto (alianças) e Estrutura (correntes/pulseiras) são exibidos quando presentes. Valores ausentes e marcadores como “Não informado” não aparecem.
- A produção usa o prazo comercial existente, sem associá-lo ao prazo de transporte. Preço sob consulta e as ações de compra/WhatsApp não mudam.
- react-markdown 10.1.0 renderiza no servidor sem interpretar HTML cru. A lista de elementos não inclui mídia incorporada; links aceitam âncoras, caminhos internos absolutos e HTTPS sem credenciais. O catálogo mantém o texto original.
