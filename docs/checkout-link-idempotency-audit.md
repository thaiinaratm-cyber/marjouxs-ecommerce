# Idempotencia distribuida do checkout - auditoria de 22/10/2026

## Decisao e limites

Precisa de RPC: **SIM**. Precisa de coluna/tabela/indice/constraint/RLS nova: **NAO**.
Precisa de script SQL para funcoes: **SIM**, sujeito a aprovacao. Nada foi aplicado.
Nenhum fluxo real foi corrigido nesta auditoria: o risco distribuido continua no codigo atual.

A unica edicao anterior a retomada foi a criacao de
`lib/checkout/create-checkout-idempotency.audit.test.ts`, exclusivamente para diagnostico.
Depois foram adicionados este relatorio, o SQL proposto e o rollback. Nenhum arquivo
de runtime, env, catalogo, frete, Pix, webhook, pagamento, outbox ou e-mail foi editado.

## Reproducao atual

Testes executam o `createCheckout` real com provider, catalogo, frete e Supabase mockados.
Cada importacao apos `vi.resetModules()` tem seu proprio `attemptLocks`; os mocks do
banco/provider sao compartilhados. Sao instancias independentes do modulo, nao dois
processos de sistema operacional nem funcoes reais da Netlify.
O banco simulado modela a unicidade atomica verificada na RPC; nao substitui teste SQL.
`fetch` global e bloqueado, e o teste verifica zero chamadas de rede.

| Cenario atual | Pedidos | Attempts | Provider calls totais | Duplicidade / risco |
| --- | ---: | ---: | ---: | --- |
| A: simultaneas, mesmo modulo/intencao | 1 | 1 | 1 | Map local funciona |
| B: simultaneas, modulos independentes/mesma intencao | 1 | 1 | **2** | Dois links externos; segundo registro diverge e exige revisao |
| C: retry apos link persistido, outra instancia | 1 | 1 | 1 | **0 novas** chamadas; link reaproveitado |
| D: refresh com outro requestId | 2 | 2 | 2 | Duas intencoes tecnicas para a mesma compra percebida |
| E: creating ja existente, outro processo em curso | 1 | 1 | 2 | Nao ha verificacao de idade/owner/lease |
| F: pending com URL/ID persistidos | 1 | 1 | 1 | **0 novas** chamadas; reuso atual confirmado |
| G: provider concluiu, ID/URL nao persistidos | 1 | 1 | 2 | Orfao externo mais novo link; crash modelado pelo estado duravel restante |
| Mesma chave, payload/hash diferente | 1 | 1 | 1 | SQLSTATE 23505 modelado, **0 novas** chamadas |
| Paid | 1 | 1 | 1 | **0 novas** chamadas; retorna confirmacao |
| Failed | 1 | 1 | 1 | **0 novas** chamadas; mesma intencao bloqueada |

Os testes sao de caracterizacao da falha atual, nao uma afirmacao de que a falha foi
corrigida. Devem virar testes de regressao com contador esperado = 1 apos a aprovacao.

## Caminho atual e mesma intencao

1. `app/checkout/page.tsx:149`: `checkoutAttempt` fica apenas em `useRef`.
2. `:500`: fingerprint = JSON de `paymentItems`, cliente normalizado e entrega.
3. `:502`: UUID novo se fingerprint mudou ou ref nao existe; refresh/remount perde ref.
4. `submissionLocked` sincrono reduz duplo clique na mesma tela; nao protege instancias.
5. `lib/checkout/hash.ts`: chave persistida = `checkout:${requestId}`.
6. `lib/checkout/create-checkout.ts:243`: hash SHA-256 canonico de cliente, entrega e
   itens autoritativos. Analytics ficam fora. Arrays preservam ordem.
7. `ecommerce_create_checkout` persiste chave/hash, pedido, itens e primeira attempt
   na mesma transacao. Conflito de chave com outro hash e recusado.
8. Attempt recebe `idempotency_key = infinitepay:` + chave do checkout;
   `order_nsu = order_number`; status inicial `creating`.
9. `create-checkout.ts:335`: Map por attempt_id, somente depois da RPC de criacao.
10. `:146`: chamada externa `/links`; `:176`: RPC persiste URL/provider_checkout_id.

| Dado | Participacao atual |
| --- | --- |
| requestId | Define a chave de identidade; hash igual nao une requestIds diferentes |
| Carrinho | Hash inclui IDs, slugs, quantidades, valores e snapshot dos itens |
| Cliente | Nome, telefone, email e CPF opcional entram no hash, nunca nos logs desta auditoria |
| CEP/endereco | Entram na entrega/hash quando shipping |
| Modalidade | Pickup/shipping e serviceId entram |
| Personalizacoes | Entram nos itens/hash |
| Frete | serviceId e shippingQuoteId do cliente entram; **preco autoritativo do frete nao entra** |
| Total | Subtotal/valores dos itens entram indiretamente; total final com frete nao e incluido explicitamente |

Teste adicional: duas requotes de 994 e 1500 centavos, com mesmo payload de entrada,
produzem o mesmo hash. Se pending ja existe, o retorno atual usa o total persistido de
16994, nao o novo 17500. Nenhuma regra de frete foi alterada nesta auditoria.
O hash tambem inclui metadados do item; nao e apenas uma identidade comercial pura.

Refresh pode gerar novo pedido/link hoje: **SIM**, se houver nova submissao apos refresh.
Duas abas independentes normalmente geram UUIDs diferentes. Retry de rede mantem o
UUID somente enquanto a mesma tela/ref e fingerprint sobrevivem. Mudanca de quote UUID,
preco ou formulario pode gerar outra chave; `price_changed` tambem limpa a ref.

Mitigacao minima proposta, ainda nao implementada: persistir apenas UUID opaco da
intencao em sessionStorage (sem cliente, endereco, gravacao, payload ou hash de PII),
reutiliza-lo apos reload e deixar o hash server-side detectar alteracao de conteudo.
Um conflito exige revisao/confirmacao de nova intencao, nao rotacao automatica em
timeout/in_progress/dispatch_uncertain. Duas abas criadas de forma independente e
limpeza do armazenamento ainda podem ser novas intencoes; nao deduplicar clientes por
nome/email/carrinho, pois compras repetidas legitimas devem continuar possiveis.

## Banco real: leitura apenas

Inspecao de pg_proc, pg_constraint, pg_indexes, colunas, triggers e grants; nenhum pedido
ou dado pessoal foi selecionado. Definicoes exportadas em base64, com MD5 conferido.

- `ecommerce_orders_checkout_idempotency_key`: UNIQUE(checkout_idempotency_key).
- `ecommerce_payment_attempts_idempotency_key`: UNIQUE(idempotency_key).
- `ecommerce_payment_attempts_order_nsu_key`: UNIQUE(order_nsu).
- `ecommerce_payment_attempts_provider_checkout_id_key`: UNIQUE parcial, ID nao NULL.
- `ecommerce_payment_attempts_one_active_per_order`: UNIQUE(order_id) em creating/pending.
- `ecommerce_payment_attempts_one_paid_per_order`: UNIQUE(order_id) em paid.
- Status permitidos da attempt: creating, pending, paid, failed, requires_review.
- Sem timestamp/owner/lease especifico. Ha created_at, updated_at e request_metadata JSONB.
- request_metadata exige objeto JSON; a RPC inicial grava apenas order_id/order_number.
- RLS esta habilitada. service_role tem SELECT, mas **nao UPDATE direto** nas duas tabelas.
- RPCs existentes SECURITY DEFINER, search_path vazio, owner postgres; EXECUTE service_role.
- Triggers mantem updated_at e protegem registros pagos.
- RPC create MD5: `b1143320c126176b8ef8a7f2ff1552a6`.
- RPC set link MD5: `dc92c928aa83da39ade7f603dbdfbb23`.

Unicidade de linha nao equivale a exclusividade do efeito externo. O segundo processo
pode chamar /links antes de qualquer provider ID ser conhecido pelo banco.
A RPC atual de registro detecta IDs diferentes tarde demais e exige revisao.
Creating pode ficar indefinidamente sem politica de abandono.

## Alternativas e recomendacao

| Alternativa | Avaliacao |
| --- | --- |
| A: claim no banco | Resolve concorrencia se persistente; lease sozinho nao resolve crash apos HTTP |
| B: creating + unicidade atual | Ja existe; nao identifica quem recebeu permissao de enviar |
| C: RPC atomica | Menor limite seguro de autoridade, compativel com serverless |
| D: advisory lock | Lock transacional acaba ao retornar a RPC, antes do HTTP; lock de sessao e inadequado ao pool PostgREST |
| E: constraint + retry | Impede duplicar linhas, nao links externos ja criados |
| F: constraints atuais + claim em RPC | **Recomendado**; reaproveita schema, RLS, indices e finalizador |

Nao ampliar UPDATE da service_role nem usar read-then-update em TypeScript.
Nao manter transacao/lock PostgreSQL aberto durante HTTP.

## Protocolo proposto, nao instalado

Arquivos: `checkout-link-idempotency.proposed.sql` e `checkout-link-idempotency.rollback.sql`.

1. Alteracao minima de ecommerce_create_checkout: apenas acrescentar marcador
   `checkout_link_dispatch: {version: 1, state: unclaimed}` no request_metadata de
   **attempts novas**. Assinatura, retorno, validacoes, owner e grants existentes ficam iguais.
2. Nova RPC `ecommerce_checkout_link_transition(uuid,text,uuid,text,text)`;
   acoes claim/begin_dispatch/complete. Owner postgres, SECURITY DEFINER, search_path
   vazio, EXECUTE apenas service_role. Nenhuma permissao de tabela e ampliada.
3. Metadados existentes guardam owner UUID gerado no servidor, claimed_at, lease_until
   e dispatched_at. Nao vao ao frontend/logs; nao sao credenciais de cliente.
4. Locks sempre na ordem pedido -> attempt, como no finalizador atual. Apenas duram
   a transacao da RPC, nunca o HTTP. Begin + commit autoriza uma unica chamada externa.
5. `claim`: unclaimed ou reserved expirado pode ser reservado. Lease proposto de
   **2 minutos**, decisao operacional para aprovacao, nao expiracao do link/provider.
6. Reserved recente retorna in_progress, sem chamada ao provider. Reserved expirado
   pode mudar de owner. Begin do owner anterior e recusado (stale_claim).
7. `begin_dispatch`: somente owner atual dentro do lease muda reserved -> dispatched.
   Apenas resposta dispatch_granted, recebida com sucesso, permite o POST /links.
   Timeout/resposta perdida nesta RPC significa **nao enviar**, consultar mesma intencao.
8. Dispatched nunca e reatribuido automaticamente: dentro da janela retorna in_progress;
   depois, dispatch_uncertain. Lease vencido **nao prova que o provider nao criou o link**.
9. `complete`: exige owner do dispatch, usa ecommerce_set_checkout_link existente e
   devolve a URL canonica persistida. Resultado provider pode ser regravado com seguranca
   pelo mesmo owner, sem outro POST. Paid retorna confirmacao; pending valido retorna reuse_link.
10. Attempts historicas creating sem marcador retornam legacy_dispatch_unknown.
    Nao presumir que nunca tiveram chamada externa. Pending/paid antigos continuam reutilizaveis.

O protocolo nao muda status/regras de requires_review, amount, paid_amount, Pix,
confirmacao, payment_check, webhook, invoice_slug, frete ou outbox. O finalizador
existente continua responsavel por suas regras; complete so o cerca com ownership.

### Crash e limite real da garantia

- Crash antes de begin_dispatch: reserva expirada pode ser recuperada, sem segundo envio.
- Crash apos begin_dispatch, antes do HTTP: resultado incerto, bloqueio conservador.
- Crash apos provider criar link, antes de persistir: mesmo bloqueio, **nao cria outro link**.
- Resposta perdida de complete: repetir complete/reler URL; nunca repetir /links.
- Incerto exige reconciliacao com o provider/suporte antes de liberar nova tentativa.
  Nao foi proposta uma RPC de reset automatico nem mudanca de status comercial.

A documentacao oficial consultada descreve order_nsu como identificador de rastreamento,
mas nao documenta garantia de deduplicacao de /links por ele nem Idempotency-Key:
https://www.infinitepay.io/checkout-documentacao . Ausencia dessa garantia na referencia
nao prova que o provider nunca a implemente; significa que nao podemos depender dela.
Nao houve request para a API InfinitePay. So leitura da documentacao publica.

Assim, a proposta garante exclusividade da permissao de envio por attempt entre
workers aderentes ao protocolo; nao promete entrega exatamente uma vez com recuperacao
automatica em toda falha externa. Ela prioriza evitar cobrancas/links duplicados,
aceitando bloqueio assistido em resultado desconhecido.

## Impacto, rollout e rollback

- create-checkout.ts precisara chamar claim -> begin_dispatch -> provider -> complete;
  manter o Map apenas como otimizacao. Tratar in_progress/stale/uncertain sem nova UUID
  automatica e sem loops de criacao. Retornar URL canonica, nao URL local perdedora.
- Retries reutilizam mesma chave/attempt/link; validacoes autoritativas continuam.
- Nao alterar frete. Futuro hash deve explicitar valores monetarios autoritativos e
  normalizar identificadores efemeros com estrategia versionada, sem invalidar retries
  historicos. Isso nao foi implementado nem incluido no SQL desta proposta.
- Nenhuma linha existente e atualizada pela instalacao SQL: apenas funcoes mudam.
  A nova RPC escreve metadata somente quando o backend futuro for ativado.
- Nao ha backfill, DELETE/TRUNCATE nem migracao de dados. Triggers/indices/RLS intactos.
- A instalacao e transacional e protegida por MD5 do contrato lido; aborta se ele mudou.
- **Cutover coordenado obrigatorio**: workers antigos nao obedecem ao claim. Pausar
  criacao de checkout, drenar workers antigos, aplicar SQL aprovado e publicar codigo
  compativel antes de reabrir. Leitura da loja nao precisa parar. Nenhum deploy foi feito.
- SQL sozinho nao protege codigo antigo. Nao ativar novo fluxo antes da aprovacao e
  testes isolados. Nao introduzir fallback que volte ao caminho sem claim se RPC falhar.
- Rollback: manter criacao pausada, voltar codigo compatibilizado sob controle,
  executar rollback revisado. Ele restaura create_checkout por MD5 e remove a RPC nova,
  sem apagar pedidos/attempts/metadata. Retomar codigo antigo reintroduz o risco original.
  Incertos precisam de reconciliacao antes da reabertura. Nao apaga evidencia de dispatch.

## Testes pos-aprovacao

- Dois workers com o mesmo requestId: 1 pedido, 1 attempt, **1** POST mockado.
- Pending/link: 0 novos POSTs, URL canonica; paid: 0 POSTs.
- Claim recente: segundo worker recebe in_progress, 0 POSTs.
- Reserva expirada antes do dispatch: novo owner pode assumir; owner antigo e cercado.
- Lease expirado apos dispatch/crash: nao assume novamente; dispatch_uncertain, 0 POSTs.
- Perda de resposta de begin_dispatch/complete: nao repetir /links.
- Colisao de chave/payload: sem duplicar e sem enviar provider antes de validacao.
- Creating historico sem marcador: nao reenviar automaticamente.
- Refresh: UUID opaca reaproveitada, payload alterado exige revisao; nenhum PII armazenado.
- Retorno de owner incorreto ou URL/ID divergente: bloqueio/regras existentes preservadas.
- Anon/authenticated nao executam RPC; service_role nao ganha UPDATE direto.
- Transacoes SQL reais somente em fixture isolada aprovada; nao reivindicar/criar pedido real.
- Conferir triggers, grants, definicoes e counts antes/depois da instalacao futura.

## Validacao desta auditoria

Resultados finais:

- `npm test -- lib/checkout/create-checkout-idempotency.audit.test.ts lib/checkout/create-checkout.test.ts lib/checkout/hash.test.ts lib/checkout/infinitepay.test.ts`: **28 passaram**, em 4 arquivos.
- Teste novo: **10 passaram**, incluindo contador = 2 no problema distribuido atual.
- `npm run lint`: passou, sem warnings/erros ESLint.
- `npx tsc --noEmit --incremental false`: passou.
- `git diff --check`: passou; apenas avisos de LF/CRLF em arquivos paralelos existentes.
- Suite completa e testes live: nao executados nesta auditoria; somente os mocks focados.
- Build: nao executado nesta auditoria/proposta, sem mudanca de runtime.
- SQL: nao executado nem validado contra fixtures PostgreSQL; requer aprovacao.

Lint/TypeScript verificam somente arquivos locais, sem operacoes remotas.
Checksums finais confirmaram todos os arquivos preexistentes e .env.local inalterados,
HEAD inalterado e indice vazio. Apenas 4 arquivos novos pertencem a esta tarefa.

## Confirmacoes

Nenhum SQL/migration/RPC/grant foi aplicado; apenas introspecao antes da retomada.
Nenhuma chamada real a InfinitePay, criacao/alteracao de pedido ou attempt real,
pagamento, outbox ou email. Env local, Netlify e producao intactos.
Nenhum commit, staging, push ou deploy. Alteracoes paralelas preservadas.

**Parar para aprovacao da proposta SQL e do protocolo antes de implementar runtime.**
