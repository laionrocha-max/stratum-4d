# 07 — Registro geral da discussão, decisões e análise crítica — 23/11/2026

**Repositório:** `laionrocha-max/stratum-4d`  
**Branch:** `feature/evolucao-stratus-4d`  
**Finalidade:** registrar **todos os eixos técnicos e estratégicos discutidos** sobre branches, integração, arquitetura, engenharia de software, desempenho, qualidade, auditoria e evolução.  
**Status:** registro documental, **não é implementação, homologação, aprovação de etapa nem autorização para merge/deploy**.  
**Complementa:** documentos 00 a 06 de `docs/EVOLUCAO_4D/`. O documento 06 detalha especificamente qualidade, renderização, arquitetura e critérios técnicos.

## A. Contexto e prioridades efetivamente expressas pelo proprietário

1. STRATUM 4D é um aplicativo para uso pessoal, destinado à criação de simulações 4D, imagens e vídeos de construção, potencialmente comercializáveis como entregas.
2. O usuário quer evolução consistente com conceitos e padrões profissionais de engenharia de software, **sem copiar burocracia e infraestrutura de grandes empresas**.
3. O usuário exige avaliação crítica, fundamentada e honesta: não aceitar sugestões por conveniência, não chamar de melhor uma solução sem critérios, não afirmar que algo foi testado sem execução.
4. **Qualidade final é prioridade obrigatória**, e desempenho deve ser otimizado sem degradá-la. A precisão técnica da obra é igualmente obrigatória.
5. Preservar o trabalho e as funcionalidades existentes, evitar perda de dados, regressões, reescritas e complexidade sem benefício.
6. Não iniciar etapas novas, merges ou deploys sem autorização expressa e validação correspondente.
7. Registrar integralmente o raciocínio e as decisões no GitHub antes de retomar o desenvolvimento.

## B. Branches: hierarquia, propósito e riscos

### B1. Estrutura identificada em consultas anteriores
- `main`: referência funcional a preservar; **não modificar nem integrar sem aprovação**.
- `feature/evolucao-stratus-4d`: branch de desenvolvimento das melhorias e documentos; é a branch de trabalho atual.
- `struxelo-desktop-prototype`: protótipo antigo/divergente; não presumir que deve ser mesclado.
- `gh-pages`: histórico específico de publicação; não presumir que é parte do código principal a integrar.

A comparação anterior de `feature/evolucao-stratus-4d` contra `main` indicou **13 commits à frente e 0 atrás naquele momento**, antes dos novos commits documentais. **Reconsultar antes de qualquer merge.**

### B2. Correção de recomendação anterior
Foi sugerido criar uma branch temporária de integração como se fosse requisito. **Isso foi excessivo**: quando `main` é ancestral da branch de evolução, a integração pode ser fast-forward, sem necessidade intrínseca de terceira branch. Uma branch temporária pode servir para ensaio isolado, mas não deve virar burocracia obrigatória.

### B3. O que ausência de conflito significa e não significa
- Git pode mesclar arquivos sem conflito textual e o aplicativo ainda falhar.
- Duas branches podem executar isoladamente e falhar quando funcionalidades são combinadas.
- A compatibilidade exige testes de integração, regressão, persistência, exportação e uso real, não apenas comparação de commits.
- Branches não precisam ser todas fundidas. Recursos úteis de protótipos antigos devem ser avaliados e recuperados **pontualmente**, se necessário.
- Evitar atualizar `main` apenas porque uma branch está à frente ou porque o Codex reportou testes verdes.

### B4. Estratégias avaliadas
1. **Branch longa de evolução:** simples e preserva `main`, mas acumula mudanças e pode dificultar localizar regressões.
2. **Branches curtas por funcionalidade:** favorecem revisão/integração incremental, mas exigem disciplina adicional.
3. **Branch de evolução atual com commits pequenos, gates por etapa e testes completos:** opção **provisoriamente mais proporcional ao estado atual**, sem prova de ser universalmente a melhor.
4. **Branch de integração adicional:** opcional conforme risco e necessidade de ensaio, não obrigatória.

**Decisão operacional proposta:** manter a branch de evolução atual por enquanto, sem criar branches extras automaticamente. Reavaliar a estratégia se a quantidade de mudanças simultâneas, conflitos ou regressões justificar.

## C. Critérios para avaliar o processo de engenharia de software

### C1. Critérios e prioridades propostos (não pontuação medida)
| Critério | Importância | Evidência necessária |
| --- | --- | --- |
| Preservação das funcionalidades existentes | Crítica | Regressão funcional e E2E |
| Integridade de projetos e arquivos | Crítica | Salvar/reabrir, revisões, falhas e recuperação |
| Rollback/backup de dados e código | Crítica | Procedimento testado |
| Integração entre módulos | Alta | Cenários ponta a ponta |
| Testabilidade | Alta | Suíte executada e rastreável |
| Manutenção e simplicidade | Alta | Dependências, acoplamento, legibilidade |
| Velocidade de evolução | Média | Tempo e retrabalho observados |
| Escala SaaS/multiusuário | Baixa no cenário atual | Só reavaliar se objetivo mudar |

### C2. Conclusão crítica
A organização atual segue **princípios** profissionais (Git, branch isolada, testes planejados, regressão e rollback), mas **não está demonstrado que possua maturidade operacional equivalente à de softwares consolidados**. Não confundir existência de scripts e relatórios com validação independente.

### C3. Verificações mínimas propostas
- `npm ci`, `npm run typecheck`, `npm test`, `npm run build` em ambiente controlado.
- Testes de navegador/Electron, conforme aplicáveis, e projetos reais autorizados.
- CI mínimo após confirmar o que já existe; dois nomes convencionais de workflows consultados não foram encontrados, mas isso **não prova ausência total de CI**.
- Cada falha deve ter reprodução, teste de regressão, correção, nova execução e evidência.
- Registrar commit SHA, versões, ambiente, datasets, resultados e bloqueios.
- Proteção de `main` e aprovação explícita antes de integração.

## D. Hierarquia interna do aplicativo: constatações e hipóteses

### D1. Organização observada em inspeção focal
- `src/ui`: React, interface e coordenação.
- `src/core`: regras, cronograma, simulação e tipos de projeto.
- `src/viewer`: visualização 3D e navegação.
- `src/backend`: persistência e serviços de dados locais.
- `src/services`: repositórios e integrações.
- `src/ui/store.ts`: estado compartilhado com Zustand.

`src/ui/App.tsx` tinha cerca de **77 mil caracteres** e importava diretamente lógica de cronograma, revisão, IFC, visualizador e armazenamento; `src/viewer/Viewer.ts` tinha cerca de **39 mil caracteres**. **Isso sugere investigar concentração de responsabilidades, não comprova mau desempenho ou defeito.** Não foi concluído um mapa integral de dependências.

### D2. Alternativas consideradas
- **Deixar tudo exatamente como está:** menor custo imediato, mas pode perpetuar acoplamento.
- **Reescrever tudo:** risco alto de regressões e perda de funcionalidades, sem benefício comprovado.
- **Refatorar toda a arquitetura antes de continuar:** não justificado por evidência suficiente.
- **Monólito modular com evolução incremental:** recomendação **provisória** mais proporcional ao uso individual e à base existente.

### D3. Hierarquia conceitual recomendada, não imposta como pastas
1. Interface e interação: exibir dados, receber comandos e feedback.
2. Aplicação/casos de uso: coordenar importar, revisar, salvar, vincular, simular e exportar.
3. Domínio: regras de cronograma, IDs, vínculos, progresso, baseline, forecast e estados 4D.
4. Visualização: câmera, seleção, geometria, materiais e GPU.
5. Infraestrutura: armazenamento, arquivos, parsers, Electron e serviços externos.
6. Entregas/renderização: cenas, presets, captura, vídeo, imagens e manifestos.

**Importante:** essa representação não significa que todas as camadas se chamem mutuamente em uma cadeia rígida. Contratos e dependências devem ser desenhados a partir do código real; componentes de infraestrutura podem implementar interfaces exigidas pela aplicação/domínio.

### D4. Regras para refatoração
- Primeiro mapear fluxos, dependências, estado duplicado, ciclos e riscos.
- Refatorar somente responsabilidades claramente delimitadas, com testes antes/depois.
- Evitar refatoração ampla simultânea a grandes recursos 4D.
- Não confundir quantidade de pastas ou linhas de arquivo com qualidade de arquitetura.
- Não impor microsserviços, múltiplos repositórios ou arquitetura distribuída para uso individual.
- Isolar tecnicamente o motor 4D do acabamento visual, preservando identidades, estados e precisão.

## E. Desempenho: correção da análise anterior

**Modularização NÃO produz ganho automático de FPS, memória, importação ou exportação.** Pode facilitar otimizações e testes, mas performance depende de gargalos reais.

Áreas de investigação, **não gargalos confirmados**:
1. Three.js: draw calls, geometria, materiais, sombras, picking e gestão de recursos GPU.
2. IFC: parsing, árvore, carregamento, cache, coordenadas distantes, grandes modelos e múltiplos IFCs.
3. Simulação: cálculos repetidos e atualizações de estados por data.
4. Render/exportação: tempo por frame, resolução, efeitos, memória, lotes e consistência.
5. Estado React/Zustand: rerenders e propagação de mudanças, caso profiling confirme.

Medir baseline antes de otimizar; registrar hardware, datasets, FPS, tempos, RAM/VRAM, CPU/GPU e qualidade. Comparar depois e rejeitar ganhos obtidos com degradação silenciosa de qualidade.

## F. Qualidade visual, renderização e precisão técnica

### F1. Prioridade do proprietário
**Qualidade visual final obrigatória, desempenho desejável; precisão técnica obrigatória.** É aceitável render final mais lento para qualidade superior, mas não exportação instável ou impraticável.

### F2. Separar edição e entrega final
A edição pode usar resolução/efeitos adaptáveis para fluidez; a exportação final deve ter presets próprios e maior qualidade quando tecnicamente viável. **Isso é objetivo arquitetural, não funcionalidade já verificada.**

### F3. Etapas existentes
- **5:** céu, sol, iluminação, sombras, materiais, vegetação, água, modos Técnico/Realista/Apresentação.
- **6:** vídeo 4D com quadros corretos, FPS/resolução configuráveis, determinismo e gerenciamento de recursos.
- **6B:** imagens independentes de vídeo, datas e quantidades configuráveis, comparativos.
- **7:** homologação integrada.

### F4. Crítica à primeira proposta
Foi precipitado prescrever modularização, perfis de render e efeitos como solução sem verificar se o pipeline existente consegue atingir o padrão desejado. **Adicionar efeitos não comprova qualidade comercial.** O IFC pode não conter texturas/materiais/contexto suficientes.

### F5. Recomendação corrigida
Criar um **gate de viabilidade visual** antes da implementação completa da Etapa 5:
- Inventariar render atual e pipeline de exportação.
- Definir referências visuais concretas com o proprietário.
- Preparar cena IFC representativa e teste comparativo.
- Medir qualidade, estabilidade, desempenho, precisão e custo.
- Comparar melhoria incremental no Three.js com eventual pipeline alternativo apenas se houver motivo demonstrado.
- Documentar decisão e limitações. **Não afirmar que Three.js é suficiente ou insuficiente antes dos testes.**

Os critérios detalhados, incluindo 17 testes de aceite, constam no documento **06**. Este registro os complementa e não os substitui.

## G. Auditoria das Etapas 0, 1, 1B, 2 e 3: situação real

Os relatórios do fluxo de desenvolvimento declaram etapas concluídas e resultados de testes, mas a **auditoria independente ainda é parcial**. Foram examinados documentos e trechos selecionados de código e testes; **não foram executados independentemente todos os comandos, browser tests ou testes com dados reais**.

### Pontos de auditoria obrigatórios
- **Etapa 0:** inventário, baseline, métricas, licenças, testes, regressões e rollback.
- **Etapa 1:** isolamento de projetos, persistência IFC, salvar/reabrir, migração, exclusão/duplicação.
- **Etapa 1B:** revisões IFC/XER/XML, identidade, vínculos, baseline, diffs, órfãos, confirmação e rollback.
- **Etapa 2:** câmera, pivô, orbit/pan/zoom, seleção, coordenadas distantes e viewpoints.
- **Etapa 3:** árvore IFC, seleção múltipla, ocultar/isolar/Ghost, precedência e desfazer/refazer.

### Questões específicas
- Arquivos IFC armazenados localmente não são automaticamente portáveis por Git ou por manifesto; uso local é aceitável, mas restauração precisa ser testada.
- Persistência concorrente e fallbacks de bloqueio precisam de análise no ambiente-alvo, sem presumir bug.
- Atualização de revisão deve preservar links válidos e reportar ambiguidade, nunca reassociar silenciosamente.
- Não declarar que todos os testes passaram com base apenas no relato do Codex.
- Antes da Etapa 4, registrar lacunas e falhas bloqueantes; nenhuma aprovação retroativa implícita.

## H. Fluxos críticos que precisam permanecer íntegros

1. Criar projetos independentes e importar IFC/crongramas diferentes sem mistura.
2. Salvar, fechar e reabrir projeto preservando IFC, cronograma, links, câmera e presets.
3. Atualizar IFC preservando GlobalIds válidos, identificando alterações/órfãos e mantendo revisão anterior.
4. Atualizar XML/XER com reconciliação de atividades, baseline imutável e relatório de diferenças.
5. Selecionar, ocultar, isolar, Ghost e navegar sem alterar vínculos.
6. Vincular elementos exatos a atividades, simular corretamente e reabrir.
7. Separar baseline, vigente, realizado e forecast; respeitar data de corte e progresso físico.
8. Alternar Técnico/Realista/Apresentação sem perder geometria, IDs, visibilidade e simulação.
9. Exportar fotos independentemente do vídeo; manter parâmetros, datas e revisões.
10. Exportar vídeo determinístico, com datas, FPS, qualidade e overlays corretos.
11. Cancelar/falhar e recuperar sem perda de dados ou vazamentos evidentes.
12. Testar projeto representativo de escala real e desempenho no hardware-alvo.

## I. Sequência de trabalho e critérios de avanço

**Não alterar o plano mestre por suposição nem iniciar implementação sem autorização.**

1. Completar auditoria independente de 0–3 e inventário da arquitetura e do pipeline visual.
2. Documentar resultados com `PASS/FAIL/BLOCKED`, riscos e ações corretivas.
3. Estabelecer CI e regressão reproduzível, se houver lacunas verificadas.
4. Corrigir falhas críticas de dados/fluxos antes de avançar.
5. Executar Etapas 4 e 4B mediante aprovação, com testes e relatórios próprios.
6. Antes da implementação integral da 5, realizar gate de viabilidade visual e decisão de tecnologia baseada em evidências.
7. Implementar e homologar 5, 6 e 6B com qualidade final aprovada e precisão 4D.
8. Realizar homologação integrada 7; integrar à `main` apenas com aprovação expressa.

**Critérios de passagem:** testes realmente executados, ausência de regressões bloqueantes, recuperação de dados, evidência de qualidade visual quando aplicável, riscos documentados, aprovação do proprietário. Nunca prometer ausência absoluta de bugs.

## J. Perguntas e evidências ainda pendentes

- Hardware real de desenvolvimento/renderização e limites operacionais aceitáveis.
- Cenas de referência e qualidade mínima visual concretamente desejada.
- IFCs e cronogramas de teste autorizados, inclusive modelos grandes.
- Pipeline real de exportação e limites de render observados.
- Execução independente de scripts, browser/Electron, CI e integração.
- Mapa de dependências e responsabilidades reais entre módulos.
- Procedimento de backup/restauração testado e recuperação em falhas.
- Licenças, atribuições e procedência de código/assets, incluindo metadados legados do `package.json`.

## K. Matriz de rastreabilidade da conversa

| Assunto discutido | Síntese fiel | Estado |
| --- | --- | --- |
| Duas branches funcionam isoladamente | Isso não garante compatibilidade ao integrar | Princípio confirmado |
| Necessidade de branch de integração | Não é obrigatória neste histórico de ancestralidade | Recomendação corrigida |
| Padrões das grandes empresas | Adotar princípios, não burocracia corporativa | Diretriz |
| Melhor estratégia Git | Branch atual + validação por etapa é opção proporcional, não certeza absoluta | Recomendação provisória |
| Critérios da escolha | Integridade, regressão, recuperação, testes, simplicidade e evolução | Critérios propostos |
| Hierarquia do aplicativo | Módulos existem, mas acoplamento real precisa ser mapeado | Inspeção parcial |
| Deixar como está? | Preservar base e modularizar pontualmente quando justificado | Recomendação provisória |
| Melhorará desempenho? | Não automaticamente; medir gargalos reais | Correção técnica |
| Qualidade versus velocidade | Qualidade final e precisão obrigatórias; desempenho subordinado | Prioridade do proprietário |
| Plano de melhorias | Manter etapas e acrescentar requisitos verificáveis | Proposta |
| Crítica à própria análise | Faltava viabilidade visual e evidência antes de escolher tecnologia | Correção registrada |
| Auditoria/homologação | Não concluir sem execução independente e testes reais | Pendência crítica |
| Registro no GitHub | Documento 06 insuficiente sozinho para representar toda a discussão | Complementado por este 07 |

## L. Controle de decisões e restrições

**Definido pelo proprietário:** prioridade da qualidade final, precisão técnica, uso individual, preservação de funcionalidades, honestidade de evidências, registro completo e autorização por etapa.

**Recomendado pelo assistente, ainda sujeito a validação:** monólito modular, refatoração gradual, manter branch de evolução, CI mínimo, separação de presets edição/exportação, gate de viabilidade visual.

**Não demonstrado:** qualidade final atingível pelo pipeline atual, ganho de performance da refatoração, testes completos passando, maturidade de backup/rollback, ausência de regressões, necessidade de trocar motor gráfico.

**Proibido inferir deste registro:** aprovação para editar código, criar branches, mesclar, publicar, comercializar software, mudar tecnologia ou declarar etapas homologadas.

**Próximo trabalho:** usar documentos 00–07 como referências, priorizando evidências reais e decisões explícitas do proprietário. Atualizar este registro quando decisões técnicas forem efetivamente tomadas e verificadas.
