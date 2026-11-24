# STRATUM 4D — Etapa 0 — Auditoria e linha de base

22 de novembro de 2026 · versão 0.12.1

**Prioridade para a evolução.** Um projeto precisa reabrir com o IFC certo e manter vínculos e vistas quando os arquivos mudarem. Na base auditada, a interface consegue trocar o cronograma enquanto a geometria anterior continua ativa. Também é possível remapear um vínculo para a atividade errada quando um XML traz um código repetido. Esses problemas afetam a confiança na simulação, no progresso e nas entregas geradas a partir dela.

## Escopo e referência reproduzível

| Referência | Valor |
| --- | --- |
| `main` no início da auditoria | `3200e8b308b7524766285fd92d6ccdbfcad29560` |
| `feature/evolucao-stratus-4d` no início | `96e83beec1aba84d76a20d1ddaa93b36e7c09314` |
| SHA da aplicação testada ao final | `96e83beec1aba84d76a20d1ddaa93b36e7c09314` |
| Diferença inicial em relação à `main` | Oito commits à frente, sem divergência de código. A comparação alterava apenas os seis manuais de `docs/EVOLUCAO_4D`. |
| Entrega no Git | Este relatório. O SHA do commit documental consta no histórico do arquivo e no PR. |

A leitura incluiu os seis manuais e o adendo de revisões, progresso e entregas. Os ensaios foram executados em um clone separado, com perfil de navegador e portas próprios. A instalação usada pelo usuário contém 70 arquivos modificados e dois novos arquivos de código/teste sobre a mesma base. Nela já existem tradução parcial para português, correção de montagem do visualizador, ajustes de layout, federação de IFC, céu/sol configuráveis e opções de aparência e vídeo. Esses itens precisam entrar na verificação de regressão quando a implementação for autorizada. O quadro deste relatório descreve a branch auditada.

O backup local contém a última cópia de projeto exportada disponível (4.292.055 bytes), dois IFCs externos (15.218.753 e 376.713.772 bytes) e o patch das alterações locais, com os dois arquivos novos copiados à parte. As três cópias de projeto/modelo tiveram SHA-256 comparado com os originais. A cópia exportada recupera o estado no momento em que foi salva. Alterações posteriores ainda abertas no navegador não estão nesse arquivo. Os testes usaram exclusivamente amostras e modelos sintéticos.

## Arquitetura e fluxos

| Área | Contrato e fluxo observado | Ponto de integração |
| --- | --- | --- |
| Entrada e layouts | Vite inicia React em `StrictMode`. `LoginGate` resolve o acesso e `App` mantém o estado compartilhado entre 4D, P6 e Project. `DisplayWindow` atende as janelas secundárias via fragmento de URL. | [main.tsx](../../src/main.tsx), [App.tsx](../../src/ui/App.tsx), [config.ts](../../src/backend/config.ts) |
| Importação IFC e cena | Seletor lê os bytes. web-ifc importa com coordenadas trazidas à origem, mapeia metadados e pavimento e cria objetos Three.js. A importação troca o único mapa ativo. A cena deriva de objetos e segmentos. | [ifcLoader.ts](../../src/viewer/ifcLoader.ts#L30), [App.tsx](../../src/ui/App.tsx#L513), [Viewer.ts](../../src/viewer/Viewer.ts#L216) |
| Cronogramas | Arquivos passam por detectores XER/MSPDI e normalização em `Schedule`, com calendário, predecessoras, atividades, recursos, baseline e data de corte. XER multiprojeto tem seletor. MSPDI atribui código `T<ID>` e mantém `UID` como ID interno. O motor CPM edita e recalcula a programação. | [xer.ts](../../src/core/xer.ts), [mspdi.ts](../../src/core/mspdi.ts#L150), [cpm.ts](../../src/core/cpm.ts) |
| Vínculo e revisão | A seleção do viewport ou do painel alimenta vínculos manuais, grupos e regras. A atualização de cronograma é oferecida por sobreposição de código e remapeia atividades e caminhos. Carregar IFC mantém vínculos com IDs presentes. | [SidePanel.tsx](../../src/ui/SidePanel.tsx#L182), [update.ts](../../src/core/update.ts#L80), [App.tsx](../../src/ui/App.tsx#L392) |
| Salvar, fechar e abrir | JSON v2 leva cronograma, vínculos, regras, perfis, segmentos, grupos, caminhos e apresentação. A biblioteca e o autosave gravam dados serializados. Abertura repõe esses campos e regenera geometria apenas para exemplos internos. | [project.ts](../../src/core/project.ts#L9), [App.tsx](../../src/ui/App.tsx#L575), [autosave.ts](../../src/ui/autosave.ts) |
| APIs e armazenamento | Browser usa IndexedDB, serviço usa Fastify e repositório SQL, Electron usa IPC/host local. O mesmo payload passa por esses backends. Há versão otimista em gravações, com leitura e gravação separadas no backend do navegador. | [browser.ts](../../src/backend/browser.ts#L76), [server/app.ts](../../src/server/app.ts#L271), [services/repo.ts](../../src/services/repo.ts#L96), [host.ts](../../electron/host.ts) |
| Acesso e configuração | Modo local e sessão do servidor são configurados por dispositivo. API tem papéis de acesso, auditoria e aprovação para envio de alterações ao P6 conforme política. Base de testes cobre autenticação, conflitos e aprovação. O acesso por obra precisa integrar-se ao contrato de autorização quando existirem ativos persistidos. | [LoginGate.tsx](../../src/ui/LoginGate.tsx), [server/app.ts](../../src/server/app.ts#L129), [server.test.ts](../../tests/server.test.ts) |
| Câmera e aparência | OrbitControls, fit, cortes, explosão, grade e enquadramentos. A câmera e as vistas salvas já têm contratos serializáveis. A seleção realça objetos. O pivô muda ao executar enquadramento explícito ou aplicar uma câmera salva. | [Viewer.ts](../../src/viewer/Viewer.ts#L352), [presentation.ts](../../src/core/presentation.ts#L17) |
| Simulação e exportação | Linha do tempo atualiza a data no store. `computeStates` e `motionAt` calculam fases e movimento. A apresentação avalia quadros-chave independentes de câmera, data e vista. Exportação de animação reusa o visualizador e compõe legenda/data em canvas. | [Timeline.tsx](../../src/ui/Timeline.tsx), [simulation.ts](../../src/core/simulation.ts), [Present.tsx](../../src/ui/Present.tsx#L485) |

## Matriz funcional

| Requisito dos manuais | STRATUM auditado | Referência no BIM4D local |
| --- | --- | --- |
| Biblioteca de projetos e contexto isolado | **Parcial.** Biblioteca e controle de versão existem. Troca de projeto mantém o modelo anterior em alguns fluxos. | **Parcial.** Persistência do contexto inclui referências aos modelos, câmera e filtros. Isolamento entre todos os fluxos não ensaiado aqui. |
| Persistência e reabertura dos IFCs | **Ausente** para IFC externo. Só o nome do arquivo é persistido. | **Existe.** IndexedDB tem armazenamento de buffers, IDs de modelo e restauração. |
| Federação e revisão IFC | **Parcial.** Substituição mantém vínculos por GlobalId. Um modelo ativo, sem prévia ou rollback. | **Parcial.** Federação e buffers por modelo. Revisão com remapeamento e histórico não verificada. |
| P6 XER, Project XML, baseline e revisão | **Existe** importação XER e MSPDI, calendários, recursos, CPM e atribuição de baseline. **Parcial** para identidade entre revisões e integridade de correspondência. | **Existe** importação Project XML e tabelas. Equivalentes ao XER, à atualização P6 e ao CPM não identificados na inspeção. |
| Árvore e visibilidade por disciplina | **Parcial.** Propriedades e pavimento para regras, foco, seleção, segmentos e Ghost para itens sem vínculo. Árvore IFC navegável com olhos por modelo/ramo/item ausente. | **Existe.** Árvore por estrutura IFC com coleta de descendentes, visibilidade e isolamento. |
| Seleção, órbita e vistas | **Parcial.** Seleção manual simples/múltipla, fit, cortes, vistas e câmera persistida na apresentação. Pivô automático por seleção ausente. | **Parcial.** Seleção, navegação e restauração de câmera. Paridade de pivô e transições não verificada. |
| Vínculo e prévia de regras | **Parcial.** Vínculo manual, regras, sugestão e execução. Falta validação de escopo por projeto/modelo e prévia das mudanças antes de gravar. | **Parcial.** Vínculo por elemento e conjunto de seleção, referência útil para a interface. |
| Baseline, vigente, físico, forecast e ir para data | **Parcial.** Baseline/atual no simulador, data de corte e curva de progresso em relatórios. Falta fonte física explícita, snapshots e salto por data digitada. | **Não verificado** para o conjunto de requisitos do adendo. |
| Técnico, Realista, sol e cenário | **Parcial.** Three.js, cores, grade, materiais Lambert e iluminação técnica. Modos com céu/sol coexistem na instalação local, fora desta branch. Texturas realistas e biblioteca de vegetação não foram comprovadas. | **Não verificado** para paridade de renderização. |
| Imagens, vídeos e comparação de revisões | **Parcial.** PNG de vista salva, série PNG e WebM no editor de animação. Falta fila independente de fotos datadas, metadados comparáveis e exportação vinculada a revisões. | **Não verificado** para equivalência de exportação. |

No BIM4D, a referência técnica para persistência está em `src/lib/project/persist.ts` e `src/components/viewer/ViewerShell.tsx`. A árvore e visibilidade estão em `src/lib/bim/tree.ts` e `src/lib/bim/engine.ts`. O BIM4D declara MIT e usa Fragments. O STRATUM declara `UNLICENSED` e usa Three.js/web-ifc. A proposta aproveita os fluxos e mantém os contratos próprios do STRATUM.

## Achados e evidência

| Prioridade | Achado | Reprodução ou referência |
| --- | --- | --- |
| P0 | Projeto aberto pode manter o IFC de outra obra. JSON v2 não leva bytes do IFC nem referência durável. | Abra um XML e um IFC A, salve o projeto, importe IFC B e abra o JSON de A. Em contexto novo, o mesmo JSON pede para carregar o modelo. `applyProject` carrega dados sem repor a cena. [App.tsx](../../src/ui/App.tsx#L575) |
| P0 | Códigos duplicados podem desviar vínculos e baseline. Links usam o último código encontrado e caminhos usam a primeira ocorrência. | Dois IDs internos 20 e 30 receberam o código `T1`. O vínculo da parede foi transferido para 30, sem órfão reportado. A baseline registrou uma associação em vez de sinalizar a ambiguidade. [update.ts](../../src/core/update.ts#L80), [baseline.ts](../../src/core/baseline.ts#L16), [App.tsx](../../src/ui/App.tsx#L405) |
| P1 | Exemplo carregado com viewport vazio no servidor de desenvolvimento. | Em Vite dev, exemplo RC reportou 58 elementos, 58 vínculos e zero canvas na área 3D. No build, a mesma ação produziu um canvas. O teardown do efeito em `StrictMode` descarta o visualizador e deixa a referência preenchida. A instalação local tem ajuste específico. [App.tsx](../../src/ui/App.tsx#L129), [Viewer.ts](../../src/viewer/Viewer.ts#L158) |
| P1 | Substituição de IFC descarta vínculos ausentes sem prévia. IDs podem colidir. | A importação repõe os objetos e filtra os vínculos pelos IDs resultantes. GlobalId é a chave única no mapa e `expressId` é o fallback, dependente do arquivo. IFC duplicado e mudança de origem ainda precisam de ensaios específicos. [App.tsx](../../src/ui/App.tsx#L536), [ifcLoader.ts](../../src/viewer/ifcLoader.ts#L88) |
| P1 | Percentual da tarefa pode ser interpretado como avanço físico. | No XML sintético, `PercentComplete=40` e `PhysicalPercentComplete=12` produziram um único valor de 40. A geometria usa fase por tempo decorrido e a curva de realizado distribui avanço por interpolação até o corte. Com uma medição, os pontos entre datas são estimativas. [mspdi.ts](../../src/core/mspdi.ts#L152), [progress.ts](../../src/core/progress.ts#L190), [simulation.ts](../../src/core/simulation.ts#L33) |
| P1 | Empacotamento depende de `cp`, que não existe no shell padrão testado. | `build:server`, `build:electron` e o preparo de `mcpGuard` falharam na pós-cópia do WASM. Após copiar o mesmo WASM para o destino do MCP com PowerShell, a suíte completou. [package.json](../../package.json) |
| P2 | Troca de modelo remove objetos da cena sem liberar explicitamente os buffers e materiais associados. | `Viewer.clear()` limpa cena e mapas. Falta um ensaio de ciclos repetidos para medir retenção após descarte de renderização e GC. [Viewer.ts](../../src/viewer/Viewer.ts#L177) |
| P1 | O vídeo alonga quando a renderização é mais lenta que o intervalo entre quadros. A série PNG acumula frames em memória. | O WebM solicitado com 2 s reproduziu por 7,112 s no ensaio com renderização por software. `frameTimes` calcula instantes da simulação e `MediaRecorder` usa os tempos de gravação. Falta restauração garantida da cena quando ocorre exceção. [Present.tsx](../../src/ui/Present.tsx#L485), [presentation.ts](../../src/core/presentation.ts#L201) |

Uma árvore deve refletir a estrutura que o IFC fornece. Se o exportador criou uma piscina ou um bloco como um único `IfcBuildingElementProxy`, expandir esse nó não cria paredes com IDs próprios. Selecionar paredes separadamente depende de entidades IFC separadas ou de segmentos criados e validados no STRATUM. Para instalações, pavimento, classe e sistema complementam a hierarquia espacial quando esses dados vierem do arquivo.

## Verificação da linha de base

**Ambiente.** Windows, Node v22.23.5, npm 10.9.9, lockfile original. Edge headless 158.0.4370.33 a 1440 × 900, com SwiftShader para tornar o teste independente do acesso à GPU. O CI oficial configura Node 22. Os fluxos do repositório empacotam web, servidor e desktop. O roteiro desta revisão usou um checkout novo em portas de loopback e dados sintéticos.

| Comando | Resultado |
| --- | --- |
| `npm ci --no-audit --no-fund --prefer-offline` | PASS. 942 pacotes em cerca de 3 min. Houve avisos de dependências descontinuadas. |
| `npm run typecheck` | PASS. `tsc --noEmit`. |
| `npm test` | FAIL inicial. 44/45 arquivos, 283 testes aprovados e 10 pulados. O pacote MCP foi gerado, mas o script parou no `cp`. |
| `npm test` após completar apenas a cópia do WASM | PASS. 45/45 arquivos, 288 testes aprovados, 5 pulados em 16,59 s. Sem alterações no código ou no lockfile. |
| `npm run build` | PASS. 37,15 s no Vite. Chunks de entrada e IFC aproximadamente 2,07 MB e 3,07 MB minificados. O WASM IFC no repositório tem 1.188.286 bytes. |
| `npm run build:server` e `npm run build:electron` | FAIL na cópia do WASM no shell padrão. Os dois bundles foram gerados. Completar a cópia com PowerShell permitiu preparar os artefatos locais. |

Cobertura existente inclui XER/XML, baseline, progresso, cálculo de estados, regras, segmentação, quadros-chave, serviços, API, P6 e MCP. A suíte usa mocks e ambientes locais para integração. SQL Server real depende do ambiente definido em `tests/p6.test.ts`. O resultado não certifica banco remoto, conexão a um Primavera real, instalador desktop ou aplicação Android.

### Smoke em navegador e escala

| Cenário | Resultado observado |
| --- | --- |
| Exemplo de concreto armado em dev | FAIL. Interface informou 58 elementos e 58 vínculos. Nenhum canvas 3D na área de visualização. Captura `exemplo-dev.png`. |
| Mesmo exemplo no build | PASS. Canvas e cena exibidos. Captura `exemplo-build.png`. |
| Project XML de amostra | PASS. Três atividades, duas relações, um recurso e data de corte 04/03/2026. O modelo do exemplo anterior ainda aparecia até importar outro. |
| P01 · Salvar A, carregar B e reabrir A | FAIL. O nome esperado era `ifc4-single-room.ifc`. Salvar novamente revelou `ifc4-stress-400-walls.ifc` como modelo ativo. |
| P02 · Reabrir A em contexto novo | FAIL para recuperação completa. O cronograma abriu. A interface solicitou carregar o IFC manualmente. |
| P05 · Ler JSON sintético v1 | PASS no parser. Retornou versão 1, 58 vínculos e uma apresentação vazia inicializada. A migração futura de IFC e apresentação ainda exige aceite próprio. |
| Vídeo de 2 s · 15 FPS · 1280 × 720 | FAIL para duração. WebM válido de 22.983 bytes em 8,63 s de processamento. O arquivo reproduziu por 7,112 s em 1280 × 720, com 28 callbacks de quadros observados dos 31 solicitados. Callbacks observados não são contagem exata de quadros codificados. |
| Série de 2 s · 15 FPS · 1280 × 720 | O ZIP de 1.544.772 bytes contém 31 PNG e um README. Primeiro e último PNG têm hashes diferentes. A série segue os quadros da animação. Recorrência mensal e fila separada permanecem no escopo da Etapa 6B. |

| IFC sintético | Tamanho e elementos | Importação reportada pela aplicação | Tempo por seleção automatizada até o estado carregado | Órbita · callbacks de quadro por segundo | Heap JS após órbita |
| --- | --- | --- | --- | --- | --- |
| Sala IFC4 | 8.308 B · 5 elementos | 0,6 s | 1,00 s | — | — |
| Paredes IFC4 | 480.632 B · 400 elementos | 0,5 s | 0,88 s | 12 | 36,2 MB |
| Paredes IFC4 ampliado | 5.032.096 B · 4.000 elementos | 9,9 s | 10,86 s | 1 | 92,0 MB |

Os tempos e o heap são amostras pontuais. A órbita usa uma janela de dois segundos com movimento de mouse e conta `requestAnimationFrame`. O heap cobre JS no renderizador. Para medir WASM, GPU e eventual retenção, será necessário instrumentar ciclos idênticos e medir com aceleração e descarte. Nas duas rodadas, a cena de 400 elementos apresentou 12–13 callbacks/s. Depois da cena de 4.000, o heap ao voltar para 400 ficou em 172,8 MB naquele instante. Essa medição isolada não distingue demora de GC, renderização acumulada e retenção permanente.

**Reprodução.** Amostras de cronograma em `samples`. IFCs sintéticos de referência em `OpenBIMStudio/tests/fixtures/ifc-corpus/extended`, checkout `bdf5d6db263292bb1acfdb7a5de51872b9bcca48`. Os scripts locais de evidência são `escala-ifc.mjs`, `smoke.mjs`, `probe-core.mjs` e `inspect-exports.mjs`. Executar via Node no diretório do clone, após instalar e compilar. O script de escala usa dez blocos da cena de 400 paredes, com IDs e posições regionais distintos. `smoke.mjs` usa a cena ampliada quando `STRATUM_AUDIT_LARGE_FIXTURE` aponta para o IFC gerado. O navegador de teste substitui apenas o seletor nativo de arquivos. As ações de importar, salvar, abrir e exportar passam pela UI e pelos mesmos handlers do aplicativo.

| Fixture | SHA-256 |
| --- | --- |
| `ifc4-single-room.ifc` | `2cd07aa6a030e36115ae698a5a0a0065e130f57b3bd001b879fea7af30671c21` |
| `ifc4-stress-400-walls.ifc` | `3bc818927c6fc60b92c97b885e446d58a2d9f9c42038985caef5245f24f30e4b` |
| `ifc4-stress-4000-walls.ifc` | `123ca14d9ec4620b144e0b00d1f9c1bee2e594e1ef680f5a18df8e6df4e0ae25` |

## Proposta e ordem de execução

1. **Etapa 1 e 1B — Projeto, IFCs e revisões.** Colocar identidade e armazenamento atrás do contrato dos backends. Usar manifesto versionado com `projectId`, `modelId`, `scheduleId`, revisão, hash e dados de transformação. No navegador, separar os ativos binários dos dados JSON e verificar disponibilidade/limites antes de confirmar gravação. Desktop deve manter ativos no armazenamento gerenciado da obra. Para servidor, manter metadados/versionamento no repositório e avaliar a capacidade de armazenamento de ativos com autorização por projeto. Preparar validação e novos recursos da cena antes da troca, descartar a cena anterior após sucesso e cancelar importações pendentes quando mudar a obra. Validar em dois projetos, com gravações concorrentes e falha de carregamento. Tratar o escopo P6 multiprojeto explicitamente.
2. **Migração e correspondência.** Ler versões 1/2 e preservar o original. Solicitar o IFC quando a versão antiga tiver apenas o nome. Validar conjunto de GlobalIds e mostrar correspondência quando o usuário relocalizar o arquivo. Usar `projectId/modelId/GlobalId` em uma revisão identificada. Tratar fallback por Express ID como local à revisão. Comparar cronogramas por identidade de fonte e código único no contexto. Para MSPDI, validar o comportamento dos campos de identidade após renumeração e permitir mapeamento explícito quando o arquivo não trouxer chave confiável. Reusar relatório de diferenças para uma prévia com adições, remoções, incertezas, vínculos e marcos. Associar caminho e vínculo à mesma tabela de correspondência. Conservar baseline original, pose de câmera e revisões anteriores até confirmação da transação.
3. **Etapas 2 a 4 — Câmera, árvore e vínculos.** Corrigir a montagem do viewport sem depender do modo de execução. Calcular pivô a partir de bounds em coordenadas de mundo depois de aplicar transformações. Cobrir seleção simples, múltipla, clique vazio e restauração de câmera. Indexar hierarquia e propriedades do IFC na importação, exibir itens por modelo/edifício/pavimento/categoria e projetar grupos de disciplina e sistema a partir dos dados IFC. Virtualizar nós extensos. Aplicar modelo desligado e ocultação manual antes dos estados de seleção e Ghost. Conservar a lógica de simulação e o estado manual separadamente. Prévia das regras deve indicar IDs, conflitos e mudanças antes da aplicação.
4. **Etapa 4B — Realizado e previsão.** Estender o contrato de progresso com valor, unidade/tipo, fonte, data de medição e qualidade. Manter cenários de baseline, vigente, observado e previsão com datas coerentes. Usar 70% observado no dia 50 de uma atividade de 100 dias se a evolução tiver mapeamento físico válido. Exibir como desconhecidos os intervalos sem observação ou rotular a estimativa. Projetar somente o saldo após o corte, conforme regra escolhida e calendário. Visualizar elemento indivisível por estado discreto ou por segmentação validada. Um campo de data deve sincronizar Gantt, cena e legenda usando o mesmo calendário.
5. **Etapas 5 e 6 — Visualização e entregas.** Integrar os ajustes locais de céu/sol, grade, aparência e exportação rápida mediante teste. Usar o renderizador existente enquanto se avaliam materiais PBR e luz natural por georreferência e norte verificados. Manter objetos decorativos fora de vínculo e quantitativos. Planejar fotos independentes, com seleção avulsa ou 1, 2, 4 ou 8 por mês, datas em prévia, regras para meses curtos e manifesto. Conservar FPS, duração e régua do vídeo como parâmetros próprios. Para vídeos comparáveis, usar o mesmo relógio, plano de câmera, cortes, resolução e iluminação. Fixar a entrada de cada job, restaurar estado e liberar recursos em erro/cancelamento. Medir opções de encoder e compatibilidade antes de substituir WebM.
6. **Etapa 7 — Aceite integrado.** Exercitar projeto novo, migração, revisões, rollback, dois IFCs com os mesmos GlobalIds, órbita, árvore, regiões ocultas, vínculo de quatro elementos e verificação de progresso. Testar imagens, vídeo e a reabertura das entregas na revisão correta. Validar os mesmos controles essenciais no modo 4D e nos layouts P6/Project.

Incorporar IFCs diretamente ao JSON foi descartado como padrão por duplicação, aumento do arquivo e custo de memória. O empacotamento de projeto portátil pode ser avaliado com um manifesto explícito. Trocar todo o motor pelo do BIM4D exigiria refazer compatibilidade de cenas, cortes, segmentos e exportação. As ideias de árvore, olhos por modelo e reabertura com buffers têm aplicação direta no motor atual.

## Matriz de regressão e aceite da auditoria

| Grupo | Evidência disponível na Etapa 0 | Critério para implementar |
| --- | --- | --- |
| P01–P05 | Abertura de projetos e substituição de IFC no browser. Parser aceitou v1 sintético e preservou 58 vínculos. | Testar reabertura completa após fechar, prévia de revisão IFC com IDs estáveis/removidos/duplicados, rollback após falha e concorrência. |
| V01–V06 e H01–H06 | Inspeção de raycast, seleção, OrbitControls, foco, Ghost e seções. Órbita medida em fixture. | Testar centros de bounds, pivô sem salto e visibilidade por modelo inclusive durante Ghost e reprodução. |
| L01–L03 e S01–S02 | Exemplo tem vínculos. Núcleo exercita regras, fases e movimento. Duplicidade reproduzida no remapeamento e na baseline. | Vincular quatro paredes individuais e confirmar persistência. Testar dados antes/durante/depois da fase, espaço de IDs e órfãos. |
| R01–R03, E01–E03 e B01–B02 | WebM de 2 s reproduziu por 7,112 s nesta configuração. ZIP com 31 PNG válidos. Benchmarks usam cenas sintéticas. | Medir efeitos visuais e múltiplos IFCs com aceleração real, cancelamento, precisão temporal, memória após ciclos e repetição de exportação. |
| R01–R20 do adendo | Contratos de revisão, percentual físico e imagens comparáveis auditados. XML com 40% de programação e 12% físico reproduzido. | Cobrir duplicidade/renumeração/rollback, cenário 100d/50d/70%, data digitada, fevereiro bissexto, exposições comparáveis e trabalho concorrente de foto/vídeo. |

O código e os contratos foram inventariados e os checks da base foram executados. As evidências brutas ficam no diretório local `stratum-evidencias-etapa-0`. A matriz registra os ensaios específicos ainda necessários para o aceite das etapas de implementação. A autorização da Etapa 1 é o próximo gate dos manuais.

**Rollback da Etapa 0.** Reverter apenas o commit documental na branch de evolução se for preciso retirar o relatório. O backup permite recuperar o manifesto com os IFCs externos e as alterações locais de código. Validar o checksum de cada IFC, abrir o manifesto em contexto isolado e reimportar a geometria na versão compatível antes de usar a cópia para substituir dados de trabalho. Preservar o snapshot anterior e executar a restauração sem gravar sobre os arquivos originais.
