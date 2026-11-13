# Etapa 4 local: confirmacao e pos-pagamento

Data: 2026-11-04. Sem stage, commit, push, deploy, env ou escrita no banco.

## Auditoria anterior a esta etapa

- `/pedido/confirmacao` recebe `searchParams.token` e renderiza OrderConfirmation.
- O componente consulta GET `/api/orders/<token>`; nao consulta o provider.
- A API valida UUIDv4, procura exatamente public_token e usa o estado do banco.
- A resposta por token ja omite endereco, gravacoes, comprovante e IDs internos
  desde a Etapa 3. Nao existe expiracao automatica do public_token no schema atual;
  ela nao deve ser confundida com o TTL de 24h da intencao no navegador.
- Pending consultava a cada 3 segundos sem limite total; falhas tentavam novamente
  a cada 8 segundos indefinidamente. 404 interrompia; paid/review/failed paravam.
- O cliente fazia cast do JSON para PublicOrder sem validar o contrato em runtime.
- Erros de consulta podiam mostrar mensagens recebidas da API; com pedido anterior
  carregado, a falha nao era claramente apresentada ao cliente.
- Loading dizia que estava confirmando pagamento antes de concluir a leitura.
- Suporte usava o WhatsApp global; nao havia CTA para pending prolongado.
- GA4 purchase e server-side: confirmacao financeira -> outbox ga4_purchase ->
  Measurement Protocol. A pagina nao cria/processa outbox e nao chama trackPurchase.
- `trackPurchase` legado nao tem call sites no fluxo atual; nao foi removido.
- Google Ads usa um evento distinto, `conversion`, com transaction_id publico e
  valor do pedido paid retornado pela API; nao e o purchase do GA4. A deduplicacao
  anterior usava memoria/localStorage, mas sem serializacao explicita entre abas.

## Fluxo final

Token da URL -> GET read-only por public_token -> projecao/validacao publica ->
observador limitado -> apresentacao. Nao existe chamada a `/links`, payment_check,
create checkout, reconciliacao ou processamento de outbox nesse fluxo.

O mesmo helper de projecao e usado pela API e pelo cliente; nao ha uma segunda
maquina financeira de estados. O banco continua sendo autoridade.

## Estados visuais

| Situacao | Titulo/mensagem | Acao | Polling |
| --- | --- | --- | --- |
| Loading | Consultando seu pedido | Aguarda leitura, sem afirmar pagamento | Consulta inicial |
| paid | Pagamento confirmado | Referencia publica, total, entrega/retirada, proximos passos e acompanhamento | Para imediatamente |
| pending | Aguardando confirmacao; nao precisa pagar novamente | Aguarda confirmacao autoritativa | Limitado a 2 minutos |
| requires_review | Seu pagamento esta em verificacao; pedido recebido; nenhuma nova cobranca automatica | Suporte e acompanhamento | Para imediatamente |
| failed | Nao foi possivel confirmar este pagamento | Suporte e voltar a loja; sem reabrir cobranca | Para imediatamente |
| Referencia invalida/indisponivel | Confira o link recebido ou fale com a Marjouxs | Suporte e voltar a loja | Para; nao tenta adivinhar pedido |
| Erro temporario de consulta | Consulta indisponivel nao significa que o pagamento falhou | Consultar novamente e suporte | Backoff dentro do limite |
| Pending alem do limite | Estamos aguardando a confirmacao. Voce nao precisa pagar novamente | Consultar novamente e suporte | Para sem mudar status financeiro |

Failed nao e reinterpretado como recusa comprovada, nem como impossibilidade de
um fato financeiro tardio. O observador para; uma nova leitura pode refletir
pagamento reconhecido depois pelo fluxo financeiro existente.

## Politica de polling

- Janela maxima: 120 segundos desde a montagem ou consulta manual.
- Timeout individual: 10 segundos, cobrindo headers e leitura/JSON do corpo.
- Pending: intervalo de 3 segundos nos primeiros 30 segundos; depois 10 segundos.
- Erros: backoff de 6, 12 e no maximo 15 segundos, dentro da janela total.
- Deadline dedicado interrompe inclusive uma resposta que nao termina.
- Sem requests sobrepostos: a proxima leitura e agendada apos encerrar a anterior.
- Stop em paid, review, failed, 404/410, deadline, troca de token ou desmontagem.
- AbortController e cancelamento dos timers descartam respostas atrasadas.
- JSON invalido, contrato invalido, offline, abort ou 5xx sao erros de consulta,
  nunca uma transicao local do pagamento para failed.
- Ultimo pedido valido continua visivel em falha temporaria, explicitamente
  identificado como ultima consulta, sem apresentar detalhe interno.
- Consultar novamente cria apenas outra janela limitada de GETs, nao pedido/link.
- Refresh pode iniciar outra janela de observacao; nao ha retry automatico infinito.
  Em aba suspensa, ao retomar execucao, o tempo decorrido e conferido antes de ler.

Os 120 segundos nao sao validade do link nem TTL do pedido. O TTL de 24h da
intencao da Etapa 3 permanece inalterado. Nao se adicionou estado financeiro expired.

## Privacidade e seguranca

- O identificador continua UUIDv4 opaco, sem ID incremental ou lookup por PII.
- Formato invalido e UUID desconhecido retornam a mesma resposta generica 404.
- A API e no-store/private inclusive em erro, com Referrer-Policy no-referrer.
- Consulta exatamente pelo token recebido, sem fallback para outro pedido.
- A projecao permite somente campos comerciais necessarios: referencia publica,
  estado, datas publicas, itens sem personalizacao, valores, meio/parcelamento,
  modalidade, transportadora/servico e prazo de transporte.
- Endereco do cliente, gravacoes, receipt URL, rastreio, IDs internos, NSUs,
  payloads e metadados administrativos nao sao projetados para a confirmacao.
  Campos privados ja previstos no contrato continuam null para compatibilidade.
- Propriedades inesperadas sao removidas tanto na API quanto no cliente.
- Dados malformados nao mostram paid nem autorizam conversao.
- O token continua uma capacidade bearer de leitura de resumo comercial. Quem
  possui um token valido pode ver esse resumo; ele nao autentica identidade nem
  autoriza escrita, pagamento, reconciliacao ou acesso ao detalhe administrativo.
- Nao existe prova de expiracao do public_token no schema atual. 410 e tratado
  genericamente se recebido, mas nenhuma expiracao foi inventada/aplicada.
- A pagina nao persiste token, dados do pedido ou PII em storage para consultar.
  Fechar/reabrir o link consulta novamente o servidor, mesmo sem estado de intencao.
- A regra conservadora de limpeza da sacola foi preservada: nao apaga por
  semelhanca uma compra personalizada cujas gravacoes estao ocultas nesta consulta.

## WhatsApp

CTA de pos-pagamento usa exclusivamente `5511919964393`, conforme a instrucao
expressa desta etapa. Numero global, rodape e outros contatos nao foram trocados.
Mensagem contem somente referencia publica validada e status generico. Se nao
ha referencia valida, envia apenas status generico de consulta indisponivel.
Nao inclui total, email, telefone, CPF, tokens, NSUs ou URL de pagamento.
Nao foi enviada mensagem real ao WhatsApp durante o QA.

## Refresh, retorno e abas

- Paid: nova leitura continua paid e para, sem nova cobranca ou evento financeiro.
- A apresentacao reconhece os status operacionais reais preparing (producao) e
  completed (entregue/retirado conforme modalidade), sempre exigindo paid antes
  de avancar. Aliases legados continuam funcionando. Nenhum status foi gravado.
- Pending: continua observando sem criar/reabrir checkout pela confirmacao.
- Review/failed: mantem mensagem neutra e suporte, sem gerar nova attempt.
- Duas abas podem ler o mesmo pedido; nenhuma delas confirma financeiramente.
- Voltar ao checkout preserva as travas e intencoes da Etapa 3; esta etapa nao
  altera create-checkout, fingerprint, expiracao ou recuperacao de dispatch.
- No navegador isolado foi verificado voltar/avancar com sacola vazia; os testes
  existentes da Etapa 3 cobrem a trava paid e o reuso pending com intencao/sacola.
- Fechar a aba e abrir novamente o link paid foi conferido sem gravar dados de
  pedido no browser. Mudanca de token nunca reaproveita visualmente outro pedido.

## Purchase, outbox e Google Ads

GA4 purchase permanece exclusivo do fluxo financeiro server-side e do outbox
existente. Nao foi movido para cliente nem criado outro sistema de eventos/retry.
GET da confirmacao nao enfileira, reivindica, confirma ou processa outbox.
Refresh/abas dessa pagina nao geram eventos financeiros.

O evento Google Ads `conversion` foi preservado por ser distinto do purchase
server-side do GA4. Continua exigindo paid/paidAt/total/referencia validos da API,
sem ler valor/status da URL ou da sacola. Agora coordena o check/send/marcador
com Web Locks entre abas da mesma origem, usando o marcador ja existente em
localStorage e memoria. Desmontagem cancela conversao que ainda espera o lock.

Sem suporte a Web Locks/storage, permanece o fallback anterior com transaction_id
estavel; nao se promete exatamente um envio HTTP ao Google em ambiente com
storage bloqueado. A [documentacao oficial Google Ads](https://support.google.com/google-ads/answer/6386790?hl=en)
explica a deduplicacao por transaction ID na mesma acao de conversao. Ela nao
substitui a autoridade financeira nem transforma pending/review em compra.

Nao foram alteradas configuracoes do Google Ads/Analytics. Eventual importacao
simultanea de conversoes GA4 e Ads na conta e configuracao externa nao auditada
nesta etapa. Nenhum evento real de conversao foi enviado no QA isolado.

## Arquivos desta etapa

Implementacao:
- components/order-confirmation.tsx
- components/order-summary.tsx (opcao privada exclusiva da confirmacao; default preservado)
- app/api/orders/[token]/route.ts
- lib/checkout/confirmation.ts (novo)
- lib/checkout/confirmation-polling.ts (novo)
- lib/google-ads.ts
- lib/order-status.ts (somente mapeamento de apresentacao de status reais)

Testes e fixture sintetica:
- components/order-confirmation.test.tsx
- app/api/orders/[token]/route.test.ts (regressoes anteriores preservadas)
- lib/google-ads.test.ts
- lib/checkout/confirmation.test.ts (novo)
- lib/checkout/confirmation-polling.test.ts (novo)
- lib/checkout/confirmation.fixture.ts (novo; nenhum registro persistido)
- lib/order-status.test.ts

Documentacao: este arquivo. Total: 15 arquivos, comparados ao inicio desta tarefa.

## Cobertura e QA

Testes de paid/pending/review/failed, loading, token invalido, 404/410, 5xx,
timeout de consulta, offline/abort, JSON/contrato invalido, polling -> paid,
stop conditions, limite pending sem mudar status, consulta manual, descarte de
resposta atrasada, refresh/reabertura de quatro estados, duas abas, projecao de
PII, suporte, ausencia de writers e GA4 purchase client-side e dedup Google Ads.
Regressoes existentes de checkout/idempotencia/webhook/outbox continuam incluidas.

QA no navegador foi feito em copia separada fora do repositorio, sem envs:
- API de pedidos substituida por fixtures locais; nenhum acesso a banco/provider.
- Scripts de analytics desativados apenas nessa copia de QA (0 scripts Google).
- Codigo visual/polling da confirmacao identico ao codigo entregue.
- Sete casos em desktop 1280px, mobile 390px e 320px: sem overflow.
- Larguras efetivas do browser conferidas, imagens carregadas e screenshots salvos.
- Pending prolongado chegou ao limite real e mostrou suporte/consulta novamente.
- Consulta manual apos erro recebeu foco no H1; WhatsApp validado sem clicar/enviar.
- Duas abas passaram de pending para paid; refresh paid e fechar/reabrir conferidos.
- Sem erros React/hydration. HTTP 500/404 esperados das fixtures nao sao falhas
  de hidratacao nem de pagamento.
- Capturas e harness de QA ficaram somente na pasta externa de visualizacoes.

## Validacoes finais

- npm test: 993 aprovados, 6 ignorados (61 testes adicionados; live/opt-in nao executados).
- npm run lint: aprovado, sem avisos/erros.
- npx tsc --noEmit --incremental false: aprovado.
- npm run build: aprovado na copia isolada fora do OneDrive, sem envs.
- git diff --check: aprovado.
- Indice vazio, HEAD preservado, mudancas paralelas preservadas.
- Nenhum pedido/pagamento real, nenhuma chamada real a API InfinitePay.
- Nenhum banco, schema/RPC, env, Netlify ou configuracao de producao alterados.
- Sem stage, commit, push ou deploy.

Validacao local nao equivale a teste de pagamento em producao. Nenhum envio real
de WhatsApp, conversao Google ou evento financeiro foi realizado por esta etapa.
