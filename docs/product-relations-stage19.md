# Etapa 19: relacionados e cross-sell

A PDP já usava o snapshot público do catálogo, `RelatedProducts` e `ProductCard`.
Os produtos têm categoria, subcategoria, material, disponibilidade e preço
opcional. O legado mantém seu próprio ID público; as relações usam o UUID do
banco sem alterar o ID do catálogo, a publicação ou os campos de pedra.
Não foi encontrada uma relação manual no schema versionado ou no editor.

- A criação pode selecionar relacionados e gravá-los após criar o rascunho.
  Se só a gravação das relações falhar, o rascunho permanece e o admin avisa
  para repetir a seleção na edição. Na edição, há um formulário independente.
- A busca é por nome ou slug, com até 12 resultados ativos e disponíveis.
  O editor seleciona, remove e ordena até 8 itens. Cada seta tem nome acessível.
  A gravação compara a versão do produto e a lista ordenada esperada sob lock,
  sem alterar a versão nem os outros campos do produto.
- **Combine com** exibe apenas os manuais, na ordem salva. Uma relação antiga
  para item desativado ou indisponível não aparece. Mesmo com todos os itens
  ocultos, uma configuração manual existente não ativa o fallback.
- **Você também pode gostar** exibe até quatro automáticos. Considera a mesma
  categoria e afinidades explícitas do catálogo (alianças com solitários ou
  aparadores; correntes com pingentes), compatibilidade infantil/adulto,
  material, subcategoria, estilo de alianças, distância de preço quando
  comparável, destaque e nome/ID. Nenhum candidato adequado: sem seção.
- A PDP database reaproveita o catálogo já carregado e envia até 16 slugs em
  uma única consulta que prioriza as relações e checa disponibilidade atual.
  Erro de leitura omite recomendações em vez de inventar um fallback. O modo
  estático segue sem acesso ao banco e usa apenas sugestões automáticas.
- A grade usa os cards e placeholders atuais. Um relacionado sem preço
  mantém o rótulo do catálogo e pode exibir consulta pelo WhatsApp se o
  produto permite. Os cards mantêm links para sua própria PDP; não adicionam
  itens nem transferem aro, pedra ou gravação para outro produto.
- A verificação da PDP em 1366 px com movimento reduzido encontrou overflow
  no mega menu existente. A regra preserva a centralização horizontal e
  desliga só a transição e o deslocamento vertical nesse modo.

## Migration local

`202611170002_product_relations.sql` adiciona uma tabela direcional e duas
RPCs. Há PK composta, ordem única por produto, faixa 1–8, duas FKs com
`ON DELETE CASCADE` somente para a relação, proibição de autorrelação e
índice inverso. O guard verifica owner, RLS, colunas, PK, permissões e
instalação parcial. Não há backfill nem alteração de tabelas existentes.

RLS habilitado, sem policies ou grants para anon/authenticated. Apenas
`service_role` pode ler a tabela e executar as RPCs; a Server Action exige
admin ativo. A escrita é transacional e valida os alvos no banco.

Rollback: primeiro retirar os consumidores do app; se houver autorização
para desfazer o schema, exportar as relações e remover as duas RPCs e
somente a tabela nova em transação. Não mexer em produtos, preço, checkout,
frete, financeiro, logística ou recuperação.
