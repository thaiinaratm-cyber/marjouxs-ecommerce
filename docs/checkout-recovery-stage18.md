# Etapa 18: recuperação de checkout

- Abrir o site ou adicionar produtos não registra recuperação. A sacola segue no
  armazenamento local existente. A captura auxiliar é disparada quando a pessoa
  sai do campo WhatsApp no checkout com número válido e sacola validada, ou quando
  já há um identificador financeiro disponível no envio explícito do formulário.
- O navegador usa um segredo aleatório separado do `requestId` financeiro. O
  mesmo contato normalizado e a mesma sacola (ao menos uma linha em comum)
  reutilizam a recuperação no reload. O banco guarda só o hash desse token.
  Revisões antigas não sobrescrevem alterações novas. Trocar todas as linhas,
  trocar de contato ou renovar uma sessão vencida inicia outra intenção.
- O snapshot é ordenado e contém ID, nome, quantidade, preço validado em centavos
  e personalização estruturada (aro, pedra e gravação). Não entra na cobrança.
  Produtos sem preço ou não disponíveis não geram recuperação. Não persistimos
  CPF, e-mail, CEP, endereço, IP, Pix, URL de pagamento nem dados de cartão.
- Ao iniciar o pagamento, uma requisição auxiliar e sem espera registra o
  identificador já existente; não cria pedidos, tentativas ou links. O vínculo
  é lido pela chave idempotente e pelo mesmo telefone, restrito à Marjouxs. A
  recuperação pode acompanhar até oito identificadores distintos da mesma
  intenção. O checkout financeiro conserva seu próprio hash, idempotência e
  fluxo de retomada. Falha na captura só deixa a listagem incompleta.
- A visão administrativa calcula os estados em leitura. Link existente não
  converte; só `payment_status='paid'` converte, inclusive após webhook ou
  reconciliação. Pedido em revisão é separado. Sem atividade material por 1h
  uma intenção elegível aparece como abandonada. Repetição idêntica não renova
  atividade. Aos 30 dias o contato e snapshot deixam de ser exibidos; expurgo
  dos registros brutos requer operação aprovada à parte. Não há cron.
- Admin ativo tem listagem com telefone parcial, filtros e detalhe. WhatsApp
  manual só em intenção abandonada com opt-in específico marcado no checkout.
  Essa indicação não comprova a titularidade do número.
  Não há marketing presumido, disparo automático, cupom ou recuperação de link
  antigo. O admin pode ignorar intenções abertas; pagamento aprovado prevalece.

## Release local

`202611170001_checkout_recovery.sql` adiciona uma tabela, um índice de atividade
(além do PK e do índice único do token), uma visão invoker e uma RPC restrita a
`service_role`. RLS fica habilitado sem policies públicas. O guard verifica
owner, roles, colunas/tipos e SELECT nas origens, RLS e instalação parcial.
Triggers nas tabelas financeiras existentes permanecem intocados: a visão
apenas as lê. A instalação é transacional com `lock_timeout` de 5 segundos.

Rollback: retirar primeiro a captura e as rotas do app. Se a remoção de schema
for posteriormente autorizada, proteger/exportar os dados conforme a retenção,
depois remover a visão, a RPC e somente a tabela de recuperação em transação.
Não remover ou modificar pedidos, tentativas financeiras, outbox ou logística.
