# STRATUM 4D — Reauditoria e ordem de avanço

Base `7247f566e4fdf46383557fee7023ab88c57a2858`. Código final verificado `1b723b2988537cb796b68456b3286205584c9e24`. Os requisitos dos documentos 00–07 foram cruzados com os relatórios anteriores e os testes foram reexecutados em uma cópia limpa, separada do rascunho local da Etapa 4. As evidências usam obras sintéticas e perfis locais descartáveis.

## Aceite por etapa

| Etapa | Situação na base e nesta entrega | O que ainda limita o aceite |
| --- | --- | --- |
| 0 · Auditoria, linha de base e rollback | Reexecutados instalação, build, suíte e navegador. O build de Electron no Windows falhava ao copiar o WASM com `cp`. Os três scripts agora usam a mesma cópia via Node. | Conferir execução do CI hospedado e uso de GPU em obra real na homologação. O instalador NSIS continua pendente. |
| 1 · Projetos e persistência | A biblioteca recuperava o projeto no mesmo perfil. Em perfil vazio, o manifesto simples abria os vínculos e solicitava os IFCs. A nova cópia guarda os arquivos referenciados e entra na biblioteca como obra independente. | A cópia inclui os arquivos associados ao projeto. Vídeos e imagens já baixados continuam em seus destinos locais. |
| 1B · Revisão e recuperação | XML e XER foram revisados pela interface. Os vínculos seguiram os códigos de atividade e o XML preservou a baseline. A revisão de IFC preservou o identificador do modelo e exigiu decisão para o GlobalId alterado. | A verificação da obra multidisciplinar real e o impacto de arquivos muito maiores são parte do aceite integrado. |
| 2 · Câmera | Passaram órbita e pan com foco, zoom, pivô simples e múltiplo, objetos cortados e movidos, coordenadas distantes e imagem após restaurar a câmera. | O português foi exercitado no fluxo 4D. A localização completa das interfaces clássicas exige revisão própria. |
| 3 · Árvore IFC, seleção e Ghost | Passaram a seleção árvore ↔ 3D, busca, filtro de sistema, múltipla seleção, olhos, isolamento, Ghost, desfazer/refazer e precedência durante o playback. | A validação de desempenho e usabilidade no hardware de trabalho integra a Etapa 7. |
| 4 · Vínculos BIM-cronograma | A versão atual vincula quatro paredes e conserva os vínculos ao reabrir. Os cinco testes do núcleo do rascunho local passaram. | A checagem de tipos do rascunho encontrou a integração incompleta de regras, escopo de seleção e desfazer. Fechar também o atalho, a navegação modelo ↔ tarefa e os diagnósticos. Executar L01–L03 e S01–S02 após integrar. |
| 4B · Avanço físico e previsão | Há cálculo temporal, dados de progresso e linha de base. | Validar o tipo de percentual na origem, registro físico datado, corte e previsão. Provar o cenário de 100 dias, dia 50 e 70% físico. |
| 5 · Qualidade visual | Existem modo técnico, modo apresentação e ajustes de iluminação e céu. | Fazer a prova visual comparativa nas cenas e no hardware escolhidos, antes de decidir motor, materiais, água e vegetação. |
| 6 · Vídeo | A exportação existente gerou PNG e WebM. | Verificar determinismo de cada quadro, régua desacoplada de FPS, repetibilidade, qualidade, cancelamento e recuperação. |
| 6B · Imagens | Existe captura PNG de uma vista e ZIP de quadros de animação. | Entrega de fotos independente, datas e cenários selecionáveis, presets mensais, comparação e manifestos. |
| 7 · Homologação | Existem roteiros automatizados reexecutáveis na base anterior. | Obra real autorizada no hardware de trabalho, avaliação visual/UX, desempenho, licenças, recuperação e aceite do proprietário. |

A Etapa 7 exige homologação integrada com obra real, critérios visuais e o hardware de trabalho.

## Recuperação de obra

Em **Arquivo**, **Gerar cópia de segurança…** cria um arquivo `.stratum-backup` com o manifesto, os modelos, os arquivos de cronograma disponíveis por hash e os estados anteriores referenciados pelo histórico. O pacote usa um índice versionado e guarda uma única cópia de cada arquivo com o mesmo SHA-256. A conferência percorre também as revisões. Se um arquivo referenciado estiver ausente ou corrompido, o aplicativo explica qual arquivo precisa ser recuperado.

**Restaurar cópia de segurança…** verifica o índice e os arquivos antes da gravação. Os arquivos são gravados em uma transação IndexedDB. A obra entra na biblioteca com nova identidade e o rótulo **cópia restaurada**. Abra essa entrada para inspecioná-la e usar o histórico. O comando de manifesto JSON continua disponível para os fluxos legados.

O pacote usa fatias de Blob. A conferência de integridade lê cada arquivo individualmente. Não há benchmark de memória de uma obra real nesta rodada.

## Evidências reproduzíveis

| Teste | Ambiente e resultado |
| --- | --- |
| `npm ci --prefer-offline --no-audit --no-fund` | Node 22.23.5 no Windows 10.0.26200. A instalação limpa adicionou 942 pacotes. |
| `npm run build` e `npm test -- --maxWorkers=1 --minWorkers=1` | Base limpa com 308 testes aprovados e cinco condicionais pulados. Atualização com 312 aprovados, incluindo quatro testes de backup. |
| `npm run build:electron`, `npm run build:mcp`, `npm run build:server` | Compilação dos três alvos no Windows após trocar o comando de cópia. |
| `tests/navigation.browser.mjs` | Edge 158.0.4370.33 com SwiftShader. Câmera, geometria distante, cortes, arraste, zoom, Ghost, renderização e precedência temporal conferidos. |
| `STRATUM_TEST_BUILD=1 node tests/projects.browser.mjs` | Dois IFCs com GlobalIds reutilizados, duas obras, revisões IFC/XML/XER, legado v2, exportação de 31 PNGs a 1280 × 720 e WebM. Em perfil vazio foram confirmadas a recuperação do estado vigente e de revisões de IFC e XML, a rejeição de cópia truncada e a reversão integral da gravação após erro de espaço simulado no segundo arquivo. |
| `STRATUM_BIG_IFC` no teste acima | Base de 4.000 paredes sintéticas e 5.032.096 bytes. Importação em 12,9 s na base e 16,9 s na rodada final, com 22 linhas montadas em ambas. O tempo incluiu contenção com outros testes e empacotamento. As medições no SwiftShader são observações desta rodada. |
| `node tests/desktop.browser.mjs` | Electron 33.2.1 iniciado com perfil temporário e ponte nativa. Projeto de amostra salvo, aplicativo reiniciado e projeto recuperado. |
| Empacotamento Windows local | A geração do pacote de aplicativo com `app.asar` funcionou. O empacotador padrão ficou bloqueado por falta de privilégio para extrair links simbólicos. O ensaio sem assinatura chegou ao NSIS e falhou com `spawn UNKNOWN` ao executar o desinstalador intermediário. O instalador completo requer nova execução em ambiente compatível. |

Os workflows existentes de servidor e desktop foram inspecionados. O servidor tem gatilho para PR e executa tipos, testes e build. A consulta aos dois commits da base não encontrou execuções de PR visíveis. A execução local foi usada como evidência.

### Regressão reportada em Projetos → Nova obra

O roteiro anterior aceitava automaticamente a caixa de nome do navegador. Reproduzi o clique na versão que estava na porta 5180 dentro de um painel com caixas nativas bloqueadas. O Edge registrou que ignorou a chamada a `prompt()`. Uma primeira versão com campo na interface também falhou ao enviar o formulário nesse painel, por falta da permissão `allow-forms`.

A criação agora acontece no painel Projetos, com campo de nome, aviso ao trocar de obra, ação Criar obra e cancelamento. O roteiro `tests/new-project.browser.mjs` passou no Edge com os dois bloqueios ativos, incluindo mouse, teclado, validação de nome, cancelamento, salvamento e reabertura. `tests/desktop.browser.mjs` passou no Electron 33.2.1, com reabertura após reiniciar. A compilação e a suíte local passaram, com 312 testes aprovados e cinco condicionais pulados.

Um teste posterior reproduziu a obra aberta e ausente da biblioteca antes de **Salvar**. **Criar obra** agora grava a entrada antes de abrir a obra. O teste conferiu a entrada imediata, a persistência após recarregar o Edge e reiniciar o Electron e a atualização da mesma entrada por **Salvar**. Em uma falha simulada de armazenamento, a interface exibiu o erro e manteve a obra anterior aberta.

## Ordem de trabalho após o aceite da base

1. Concluir a Etapa 4 com vínculo de quatro paredes de um IFC específico, prévia, conflito, auditoria, atualização e reabertura.
2. Implementar e validar a Etapa 4B.
3. Aprovar uma prova visual com cenas de referência. Em seguida, executar Etapas 5, 6 e 6B.
4. Homologar num projeto real autorizado conforme a Etapa 7.

## Recuperação e rollback técnico

O manifesto de projeto continua v4. O contêiner `.stratum-backup` possui versão própria. Para usar uma versão anterior do Stratum, conserve também o manifesto e os IFCs originais. Guarde o pacote e esta versão do aplicativo se precisar recuperar o histórico completo. A auditoria e as correções ocorrem na branch de evolução.
