# Etapa 3 local: estados, expiracao e recuperacao

Data: 2026-11-04. Implementacao local; sem deploy, alteracao de env, schema,
RPC instalada, pagamento ou chamada real a `/links`/`payment_check`.

## Fontes e auditoria somente leitura

Foram comparados o codigo atual, o snapshot SQL auditado e os corpos
pos-instalacao das RPCs de 2026-10-29, sem reinstalar ou executar essas RPCs.
Uma consulta SELECT no SQL Editor do projeto aprovado confirmou as constraints
atuais e contou somente estados, sem consultar/exibir dados de clientes:

- 7 pedidos: `payment_status=pending`, `order_status=pending_payment`.
- 7 pendentes antigos (24h ou mais), 0 recentes.
- Attempts: 6 `pending`, 1 `creating`.
- A attempt legada conhecida continua `creating`, sem marcador de dispatch,
  sem provider_checkout_id e sem transaction_nsu. Nenhum registro foi alterado.
- A consulta REST inicial somente com apikey retornou 401. Isso nao foi tratado
  como prova de chave invalida: o client SDK real do projeto (com seus headers de
  autenticacao) respondeu HTTP 200 na nova rota local. Nao houve ajuste/rotacao de
  chave; as contagens/constraints foram lidas pela sessao autenticada do SQL Editor.

## Maquina de estados real e autoridade

`payment-state.ts` apenas classifica leitura e apresentacao. Nao implementa
transicoes de escrita nem substitui locks/constraints/RPCs do banco.

| Estado / camada | Significado e classe | Entrada | Saida permitida / autoridade |
| --- | --- | --- | --- |
| pedido `pending` + `pending_payment` | Aguardando fato financeiro; recuperavel | RPC create | Confirm RPC -> paid; fail RPC -> failed/requires_review; admin pode cancelar operacionalmente |
| attempt `creating`, unclaimed | Nova; recuperavel | Create inicializa marcador apenas para novas attempts | Transition claim -> reserved |
| attempt `creating`, reserved | Preparacao pre-dispatch; recuperavel | Transition claim | begin_dispatch do owner; outra claim somente apos lease de 2 minutos sem dispatch |
| attempt `creating`, dispatched | Efeito externo pode ter ocorrido; indeterminado | begin_dispatch atomico | Complete do owner registra link; sem isso nao ha redispatch, mesmo apos lease |
| attempt `creating`, sem marcador | LEGACY / DISPATCH UNKNOWN | Historico pre-protocolo | Somente revisao manual futura; nunca inferir unclaimed ou fazer backfill |
| attempt `pending` com link HTTPS + identificador | Link persistido; recuperavel | Complete -> set_checkout_link | Reutiliza mesmo link; verificacao financeira pode levar a paid/review |
| attempt `pending` sem link/referencia | Inconsistente; revisao manual | Dado incompleto | Bloqueia outro dispatch; nao cria attempt substituta |
| pedido/attempt `paid` | Terminal financeiro e imutavel | Somente confirm RPC apos consulta e validacao oficial | Nenhum novo dispatch ou rebaixamento; status operacional pode avancar sem mudar paid |
| pedido/attempt `failed` | Falha registrada; bloqueia nova cobranca automatica | Fail RPC em rejeicao comprovada de criacao | Mesma intencao nao cria outra attempt. Um pagamento tardio comprovado ainda pode ser reconhecido pela RPC financeira |
| pedido/attempt `requires_review` | Revisao manual, nao significa recusado | Divergencia de valores/referencias ou verificacao | Somente nova consulta oficial quando aplicavel; nunca confirmacao por valor digitado |
| operacional `payment_failed` | Apresentacao operacional da falha financeira | Fail RPC | Nao autoriza automaticamente outro link |
| operacional `paid`, `preparing`, `ready_for_pickup`, `shipped`, `completed` | Fluxo pos-pagamento | Confirm RPC e admin autenticado | Admin apenas progressao permitida; exige payment_status paid; retirada nao vai para shipped |
| operacional `cancelled` | Terminal operacional | Admin autenticado | Nao reabre no checkout. Cancelar pedido NAO cancela link nem apaga fato financeiro tardio |
| expiracao local | Bloqueio do uso da intencao pelo navegador | Relogio local >= expiresAt | Consulta somente leitura continua; nao escreve failed/expired/cancelled no banco |

Os estados financeiros reais sao `pending`, `paid`, `failed`, `requires_review`.
Attempts tambem aceitam `creating`. `expired`, `dispatch_unknown`, `pre_dispatch`,
`new` e `blocked` NAO sao novos estados no banco. Sao classificacoes locais/de leitura.

## Tres prazos distintos

1. Intencao no navegador: 24 horas fixas desde a criacao, sem renovacao por refresh.
2. Reserva do protocolo SQL: 2 minutos; recuperavel apenas antes de begin_dispatch.
3. Validade do link e pagamento: nenhuma expiracao e inventada pela aplicacao.

A [documentacao oficial InfinitePay](https://www.infinitepay.io/checkout-documentacao),
consultada nesta etapa, descreve `options.valid_until` como expiracao configuravel
com API Key; sem essa opcao nao se deve considerar o link expirado. Tambem descreve
`single_payment`. O payload atual nao configura essas opcoes. Nao foram adicionadas
chaves, opcoes ou regras comerciais nesta etapa. A trava de dispatch local nao
promete impedir um cliente de pagar novamente diretamente num link externo antigo.

## Persistencia escolhida

LocalStorage, por fingerprint da compra, coordenado com Web Locks. Mesma origem,
mesmo perfil do navegador e mesma compra reaberta compartilham um UUID. Nao ha
recuperacao cross-device, cross-origin ou entre modos privado/normal.

Chave: `marjouxs-checkout-intent-v1:<fingerprint>`. O sufixo evita que uma aba com
outra compra sobrescreva a referencia da primeira. O nome-base v1 foi preservado
por compatibilidade; o formato do registro agora e version 2:

```ts
{ version: 2, requestId, fingerprint, createdAt, expiresAt }
```

Nao armazena nome, CPF, email, telefone, endereco, itens, valores, checkout URL,
public token, transaction_nsu, provider token ou service role. O SHA-256 e apenas
identidade da compra, nao criptografia de dados pessoais nem autenticacao do cliente.

O snapshot/fingerprint da Etapa 2 permanece igual: inclui dados normalizados e
IDs das linhas do ciclo atual da sacola; ignora UUID/data renovada da cotacao.
O hash server-side continua usando precos e frete autoritativos. Frete fisico
16x11x3 cm / 0.07 kg e valor declarado foram preservados.

Migracao de sessionStorage v1: preserva o UUID e nao inventa uma data de criacao;
fica com lease local vencida (createdAt/expiresAt=0) e exige atendimento antes de
novo envio. Se nao houver referencia antiga, o fluxo aloca registro novo normalmente.

## Expirar nao e apagar cegamente

Referencia vencida nao pode abrir/reutilizar checkout automaticamente. Antes de
qualquer create, o navegador consulta `/api/checkout/intent` usando apenas o UUID:

- paid: informa que ja foi pago, mesmo depois das 24h;
- review/failed/cancelled/legado/dispatch desconhecido: bloqueia e orienta atendimento;
- pending: reutilizacao somente dentro das 24h e via RPC existente;
- pre-dispatch: tentativa com mesmo ID, sujeita a lease/owner da RPC instalada;
- expirado: nenhum create, link ou attempt novo; suporte para reconciliacao;
- ausencia de registro no banco: novo create apenas com lease local ainda valida;
- falha na leitura/timeout: fail closed antes de create.

As referencias minimas vencidas/pagas sao mantidas como tombstones. Nao existe GC
cego: apagar esses IDs na expiracao, na confirmacao em outra aba, ao voltar ou ao
fechar o navegador permitiria uma aba antiga alocar novo UUID para a mesma compra.
Isso e intencional: o uso comercial expira; a referencia de protecao nao e renovada.

| Evento | Politica de limpeza |
| --- | --- |
| Pagamento confirmado | Sacola correspondente e limpa pela regra existente. Referencia minima fica bloqueada por paid para proteger abas antigas; outro ciclo de sacola usa novos line IDs |
| Prazo local expirado | Bloqueia submit; preserva tombstone somente para consulta segura |
| Mudanca material | Seleciona/cria outro fingerprint; nao apaga referencia de compra potencialmente em andamento em outra aba |
| Fechar/voltar/cancelar navegacao | Nao cancela pedido nem limpa referencia pending |
| Cancelamento operacional explicito | Estado do banco bloqueia checkout; referencia nao e esquecida automaticamente |
| Dados corrompidos/storage sem acesso/quota | Bloqueia antes de create; nao apaga/renova automaticamente porque o ID perdido pode corresponder a dispatch real |
| Usuario limpa dados do navegador ou muda dispositivo | Nao e recuperavel por heuristica. Nova intencao; precisa consultar confirmacao/acompanhamento ou atendimento para pedido antigo |

A retencao dessas referencias minimas e deliberada e documentada, nao um TTL do
pedido. Nao ha promessa de deduplicacao se o navegador perder todos os identificadores.
Nao se procura pedido por nome, email, telefone, IP ou semelhanca do carrinho.

## Duas abas

Web Locks serializa alocacao/preflight por origem; sem suporte, falha fechado.
PostgreSQL continua sendo autoridade de concorrencia entre abas/processos/servidores.
Mesma compra conserva UUID; mudanca material usa outro fingerprint sem destruir o
anterior. Uma aba que ainda tem sacola antiga consulta paid antes de criar checkout.
Nao foi alterado o CartProvider nem introduzida sincronizacao paralela de sacola.

Se paid acontecer depois do preflight, a transition SQL volta a verificar paid
sob lock e nao libera dispatch. Se resposta de dispatch/complete se perder, nenhum
timeout/refresh/lease autoriza automaticamente outra chamada ao provider.

## Failed e review

- Falha local anterior ao dispatch: continua creating/reserved, nao failed;
  pode recuperar com o mesmo UUID apos a lease.
- HTTP de rejeicao comprovada na criacao: fail RPC registra failure_code existente;
  a mesma intencao nao cria nova attempt automaticamente.
- Timeout/HTTP 5xx/JSON invalido/resposta perdida depois de begin_dispatch: dispatch
  incerto, nao se converte automaticamente em failed ou nova tentativa.
- Falha em payment_check: nao marca pago, nao inventa recusado e preserva estado.
- Divergencia financeira: requires_review, mensagem neutra ao cliente, motivo seguro
  no admin. Sem detalhes brutos do provider ou errors com dados pessoais.
- Reconciliacao de review so permite motivos financeiros conhecidos e todas as
  referencias persistidas. Conflito de identificador, estado desconhecido e legado
  permanecem manuais. Usa exatamente o mesmo nucleo financeiro da Etapa 2.

LIMITACAO REAL: a constraint atual exige transaction_nsu NULL nas attempts nao pagas.
Por isso, no estado atual da base, geralmente nao e possivel reconciliar pending/review
sem uma referencia oficial segura. A acao retorna reconcile_missing_reference;
nao inventa NSU, nao consulta por PII e nao altera schema para contornar isso.

## Confirmacao e privacidade

public_token e UUIDv4 gerado por gen_random_uuid(), nao numero incremental.
Funciona como capacidade bearer de leitura, nao como prova da identidade pessoal.
Qualquer pessoa que possua um token valido pode ver o resumo comercial daquele
pedido; nao pode pagar, mudar status ou consultar outro pedido por enumeracao.

`/api/orders/[token]`: UUIDv4 invalido e UUID desconhecido retornam o mesmo 404.
Consulta exata por token, sem fallback de identidade. Resposta por token agora
omite endereco, personalizacao/gravacoes e receipt URL, alem de nunca incluir
nome/email/telefone/CPF, IDs internos, NSUs ou payload bruto. A consulta por numero
de pedido + email continua preservada e nao foi usada para recuperar intencoes.
Cache privado/no-store, referrer no-referrer; 404 nao entra em polling infinito.

Paid: confirmado. Pending: aguardando confirmacao, com polling de leitura.
Review: pagamento em analise, sem afirmar recusa. Failed: nao confirmado e
orientacao para atendimento, sem criar novo checkout automaticamente.

## Arquivos desta etapa

Runtime:
- lib/checkout/intent.ts
- lib/checkout/payment-state.ts (novo)
- lib/checkout/recover-intent.ts (novo)
- app/api/checkout/intent/route.ts (novo)
- app/checkout/page.tsx
- lib/checkout/orders.ts
- app/api/orders/[token]/route.ts
- app/pedido/confirmacao/page.tsx
- components/order-confirmation.tsx
- lib/admin/reconcile-payment.ts
- lib/admin/orders.ts
- lib/orders/model.ts
- app/admin/(protected)/pedidos/[id]/page.tsx

Testes:
- lib/checkout/intent.test.ts
- lib/checkout/payment-state.test.ts (novo)
- lib/checkout/recover-intent.test.ts (novo)
- lib/checkout/orders.test.ts
- app/api/orders/[token]/route.test.ts (novo)
- components/order-confirmation.test.tsx (novo)
- lib/admin/reconcile-payment.test.ts
- lib/checkout/create-checkout-idempotency.audit.test.ts

Documentacao: este arquivo. Varios arquivos ja estavam modificados pela Etapa 2;
o recorte desta etapa deve ser comparado ao baseline anterior, nao apenas ao HEAD.

## Matriz de testes

Cobertura adicionada/reaproveitada: pending refresh e fechamento/retorno; paid
refresh/back/repeticao/duas abas; review refresh; falha pre-dispatch recuperavel;
failed sem retry automatico; expiracao; mudanca de fingerprint; storage corrompido;
coordenacao de abas; timeout/HTTP5xx/JSON invalido; perda de resposta apos dispatch;
token invalido/outro pedido; pedido sem attempt; attempt sem URL; legado intacto;
pending antigo; paid imutavel; concorrencia de 2/10/100; outbox sem duplicidade.
Todos os casos financeiros usam mocks/fixtures em memoria, nunca registros reais.

## Validacoes finais

- `npm test`: 932 aprovados, 6 ignorados (testes live opt-in nao executados),
  incluindo as regressoes anteriores de Google Ads preservadas.
- `npm run lint`: sem erros ou avisos.
- `npx tsc --noEmit --incremental false`: aprovado.
- `npm run build`: aprovado em snapshot isolado fora do OneDrive, sem copiar envs.
- `git diff --check`: aprovado.
- A nova rota local respondeu HTTP 200 / state=new para UUID aleatorio. Foi apenas
  leitura: nenhum pedido, attempt ou link foi criado por essa chamada.
- Confirmacao com token invalido: mensagem segura, sem polling infinito, sem
  overflow no desktop e em 390px, meta referrer=no-referrer, sem erros React/hydration.
- Cenários financeiros, concorrencia e estados paid/review/failed foram validados
  por mocks/fixtures, nao por pagamentos reais nem alteracao de registros remotos.
- Os demais arquivos de codigo permaneceram identicos ao baseline da tarefa.
- `.env.local` permaneceu identico byte a byte. Nenhum arquivo de env foi editado.
- Configuracao/payload de frete fisico, insurance_value, Pix, webhook, outbox, RPCs,
  schema, catalogo e configuracoes da Netlify nao foram alterados nesta etapa.
- Indice Git vazio; HEAD preservado; sem commit, push ou deploy.

Capturas e build ficaram somente na pasta externa de visualizacoes do Codex.
O worktree continua contendo mudancas paralelas anteriores, preservadas integralmente.
Esta etapa esta validada localmente, nao publicada nem testada com pagamento real.
