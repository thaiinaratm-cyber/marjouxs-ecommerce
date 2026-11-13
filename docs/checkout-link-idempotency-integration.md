# Integracao TypeScript da idempotencia de links

## Contrato utilizado

RPC instalada: `public.ecommerce_checkout_link_transition(uuid,text,uuid,text,text)`.
O contrato foi reconfirmado por GET somente de leitura ao OpenAPI do projeto Supabase configurado. Os campos de retorno e o comportamento correspondem a definicao completa exportada e validada durante a instalacao SQL.

Argumentos: `p_attempt_id`, `p_action`, `p_claim_token`, `p_checkout_url` e `p_provider_checkout_id`. Os dois ultimos sao enviados somente em `complete`.

Retorno: `result_code`, `result_attempt_id`, `result_attempt_status`, `result_checkout_url`, `result_provider_checkout_id` e `result_lease_expires_at`.

## Fluxo

1. Preservar validacao de catalogo, precos, frete, hash e criacao/reuso do pedido/attempt.
2. Gerar um UUID server-side por operacao, sem alterar o requestId do cliente.
3. Executar `claim`.
4. Reutilizar `reuse_link`, ou retornar confirmacao em `already_paid`, sem HTTP externo.
5. Apenas em `reserved`, preparar configuracao, payload e serializacao localmente, ainda sem HTTP.
6. Executar `begin_dispatch` com o mesmo claim token.
7. Somente `dispatch_granted` permite o envio HTTP existente para `/links`.
8. Executar `complete` com o resultado validado do provider. A propria RPC delega a persistencia ao fluxo SQL aprovado; nao existe chamada TypeScript paralela a `ecommerce_set_checkout_link`.
9. Retornar a URL canonica persistida, nunca substituir essa URL por um resultado local nao confirmado.

A trava Map permanece apenas como otimizacao dentro do processo. Instancias independentes precisam obter autorizacao da RPC; nao existe fallback para o caminho antigo em caso de erro, contrato inesperado ou RPC ausente.

## Estados e respostas

| Resultado | Comportamento |
| --- | --- |
| reserved | Preparar a chamada e pedir begin_dispatch |
| dispatch_granted | Autoriza exatamente o ponto de envio HTTP |
| reuse_link | Retornar link persistido sem provider |
| registered / already_registered | Retornar resultado persistido de complete |
| already_paid | Retornar confirmacao sem provider, inclusive se o pedido foi pago por outra attempt |
| in_progress / stale_claim | HTTP 409, checkout_link_in_progress; retry manual com a mesma chave |
| legacy_dispatch_unknown | HTTP 409, checkout_link_legacy_unknown; nenhuma escrita na attempt legada |
| dispatch_uncertain | HTTP 409, checkout_link_dispatch_uncertain; reconciliacao manual |
| estado invalido / indisponivel / conflito | HTTP 409, checkout_link_state_invalid; atendimento |
| RPC indisponivel / resposta malformada | HTTP 503, checkout_link_unavailable; nenhum bypass |

As mensagens do formulario sao simples e seguras. Nao foi adicionado polling nem alterado o requestId, o refresh ou o layout.

## Fronteiras de falha

- Falha local durante preparacao: `begin_dispatch` ainda nao foi chamado. A reserva permanece reservada e pode ser recuperada pelo banco apos expirar a lease. Nao se inventou uma transicao de liberacao que nao existe no contrato.
- Perda da resposta de `begin_dispatch`: nao ha envio HTTP por este processo; como o commit da autorizacao pode ter ocorrido, o resultado fica bloqueado para reconciliacao. Nao e seguro inferir unclaimed.
- Crash depois de `begin_dispatch`: o protocolo nao permite desfazer/reivindicar novamente o dispatch, mesmo se o processo tiver caido no intervalo imediatamente anterior ao fetch. Esta e a fronteira conservadora do contrato SQL aprovado.
- Timeout, erro de transporte, HTTP 408/409/5xx ou resposta de sucesso invalida: resultado desconhecido; nao marcar failed nem liberar uma nova chamada. A attempt mantem o estado durable de dispatch para reconciliacao.
- Rejeicao HTTP 4xx explicita, exceto 408/409: usar o tratamento terminal existente `ecommerce_fail_payment_attempt`. Nenhum retry automatico ou reabertura para a mesma intencao.
- Falha/perda da resposta de `complete`: nao marcar failed; a persistencia pode ter sido concluida. Um retry posterior por claim reutiliza o pending se salvo, ou mantem bloqueio seguro se nao salvo.

Nenhuma regra de Pix, paid_amount, desconto, requires_review da verificacao de pagamento, payment_check, webhook, catalogo, frete, SQL ou schema foi alterada.

## Seguranca e testes

Os retornos sao validados por schema e associados ao attempt_id esperado. Link reutilizavel exige HTTPS, status pending e provider_checkout_id. O codigo falha fechado para resultados desconhecidos ou dados incompletos.

Logs novos possuem somente attempt_id parcial, transicao, outcome e provider_call_allowed. Erros SQL transportam somente SQLSTATE sanitizado; nao sao serializados erros crus, claim token, credenciais ou dados pessoais.

Os testes de concorrencia usam Promise.allSettled e modulos carregados independentemente, com Maps distintos e um mock atomico compartilhado do contrato SQL. Foram cobertos 2, 10 e 100 requests (100 simulados distribuidos por 10 instancias), sempre com uma unica chamada ao provider mock. Nao representam teste de carga real de sessoes PostgreSQL ou do provider.

Tambem sao cobertos recovery pre-dispatch, legado, paid, pending, falha confirmada, timeout, perda de resposta das RPCs antes/depois do commit, contratos invalidos, payload comercial preservado e logs sem dados pessoais/segredos. Os testes nao usam HTTP real para InfinitePay nem criam pedidos reais.

## Rollout futuro

Esta integracao foi feita somente no codigo local; nao foi feito deploy. Antes de uma publicacao futura, e necessario pausar/drenar criadores antigos: workers antigos que ainda ignoram a RPC nao ficam protegidos pelo codigo novo. Nao misturar workers antigos e novos como se a garantia ja estivesse ativa em todos eles.

A unicidade permanece vinculada a mesma chave de idempotencia. A persistencia do requestId entre refreshes e a reconciliacao de attempts desconhecidas nao fazem parte desta etapa.
