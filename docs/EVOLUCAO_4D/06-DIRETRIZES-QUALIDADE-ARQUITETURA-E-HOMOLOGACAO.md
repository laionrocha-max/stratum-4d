# 06 — Diretrizes estratégicas: qualidade visual, arquitetura, desempenho e homologação

**Projeto:** STRATUM 4D  
**Registro:** 23/11/2026  
**Natureza:** consolidação de requisitos e recomendações para avaliação; NÃO é implementação, aprovação de etapa, homologação ou autorização de merge/deploy.  
**Branch de trabalho:** `feature/evolucao-stratus-4d`. Preservar `main`.  
**Documentos vinculados:** `00-LEIA-PRIMEIRO.md`, `01-ETAPAS-E-ACEITE.md`, `02-UX-E-ARQUITETURA.md`, `03-TESTES-E-REGRESSAO.md`, `04-ORDEM-PARA-CODEX.md`, `05-REVISOES-PROGRESSO-E-ENTREGAS.md`.

## 1. Decisões e prioridades do proprietário

1. O aplicativo é prioritariamente de **uso individual**, destinado à produção de **simulações 4D, imagens e vídeos de obras**; eventual comercialização refere-se aos **produtos gerados**, não necessariamente à venda/licenciamento do aplicativo.
2. **Qualidade visual da entrega final é prioridade obrigatória.** Desempenho deve ser melhorado sempre que possível, mas nenhuma otimização pode degradar silenciosamente a qualidade final solicitada.
3. **Precisão técnica também é obrigatória:** cronograma, datas, baseline, realizado, forecast, vínculos, identidade IFC, revisões e estados construtivos devem continuar corretos. Uma imagem bonita com simulação incorreta não atende.
4. Admite-se **maior tempo de renderização final** para alcançar qualidade superior; isso não significa aceitar travamentos, corrupção, consumo ilimitado ou tempos impraticáveis.
5. A experiência de edição pode usar efeitos/resolução adaptáveis para fluidez, **sem limitar a exportação final**. Essa separação é uma diretriz de projeto, **não uma capacidade atual comprovada**.
6. Preservar o modo **Técnico** e tornar os modos **Realista/Apresentação** reversíveis, sem alterar dados técnicos.
7. Preservar funcionalidades e projetos existentes; evoluir por etapas, com evidências e aprovação explícita. Não reescrever tudo, não introduzir SaaS/microsserviços/multiusuário ou portabilidade entre computadores sem necessidade comprovada.
8. Armazenamento local é aceitável para o uso atual, desde que existam proteção, backup e recuperação verificáveis.

## 2. Estado conhecido versus lacunas de evidência

**Confirmado por inspeção focal do repositório (não por execução independente):**
- Existem módulos `src/ui`, `src/core`, `src/viewer`, `src/backend`, `src/services`.
- `src/ui/App.tsx` concentra importações de UI, cronograma, IFC, revisões, armazenamento e visualizador (aproximadamente 77 mil caracteres na inspeção). `src/viewer/Viewer.ts` reúne responsabilidades gráficas (aproximadamente 39 mil caracteres). Tamanho e importações são **sinais para investigar acoplamento**, não prova de defeito.
- `package.json` define `typecheck`, `test` (Vitest), `build`, scripts Electron e dependências Three.js, React, Zustand, web-ifc. Isso **não comprova** que testes, builds ou instaladores passaram.
- Os documentos existentes exigem baseline, testes por etapa, regressão, preservação de dados e aprovação; o plano marca 0, 1, 1B, 2 e 3 como concluídas pelo fluxo de desenvolvimento, mas **não homologadas independentemente nesta análise**.
- A comparação anteriormente consultada entre `main` e `feature/evolucao-stratus-4d` indicou 13 commits à frente e 0 atrás naquele momento. Revalidar antes de qualquer integração.
- O `package.json` contém metadados de origem/autoria de outro projeto/repositório; verificar procedência, atribuições e licenças antes de distribuição comercial, sem inferir irregularidade apenas desses metadados.
- Foram consultados dois caminhos convencionais de workflows de CI sem encontrá-los; **não se conclui daí ausência total de CI**.

**Não verificado de modo independente:**
- Execução real da suíte, build, E2E, Electron e importação/exportação com IFC/XER/XML reais.
- Dependências completas entre módulos e perfil de CPU/GPU/memória.
- Qualidade atual do render final, limites do Three.js no aplicativo, resolução e FPS efetivos.
- Persistência, backup, restauração, migração e rollback em falhas reais.
- Compatibilidade visual/temporal de revisões e exportações.
- Hardware-alvo efetivo e limites aceitáveis de duração de exportação.

**Regra de evidência:** distinguir sempre `CONFIRMADO POR INSPEÇÃO`, `EXECUTADO E APROVADO`, `RELATADO PELO CODEX`, `HIPÓTESE`, `PROPOSTA`, `BLOQUEADO`. Nunca chamar uma etapa de homologada apenas por relatório ou build declarado.

## 3. Estratégia de arquitetura

**Direção recomendada, sujeita a auditoria:** monólito modular, orientado ao domínio, com fronteiras explícitas entre:
- **UI e interação:** telas, seleção, comandos, estado de apresentação e feedback.
- **Casos de uso/aplicação:** importar, atualizar revisão, vincular, simular, salvar, exportar; coordenar transações e tratamento de erros.
- **Domínio:** entidades, IDs compostos, cronograma, baseline, realizado, forecast, regras 4D, validações e cálculos puros.
- **Visualizador:** câmera, seleção, geometria, materiais, visibilidade e recursos GPU; não decidir regras de negócio.
- **Renderização/entregas:** presets, cenas, captura, fila, exportação, manifestos, consistência temporal.
- **Infraestrutura/adaptadores:** IndexedDB/arquivos, Electron, parsers IFC/XML/XER, persistência e integração externa.

**Não impor imediatamente uma nova árvore de pastas.** Primeiro mapear dependências reais, fluxos de dados, ciclos, estado duplicado e pontos de mudança. Extrair funções de `App.tsx` ou `Viewer.ts` apenas quando houver responsabilidade clara, testes e ganho justificável. Evitar reescrita total, microsserviços, repositórios separados e duplicação de motores.

**Contratos importantes:**
1. Chaves de elemento com `projectId/modelId/GlobalId` e fallback identificado; nunca usar GUID isolado entre modelos.
2. Atividades com identidade estável por projeto/cronograma e regra explícita de reconciliação de revisões.
3. Estado temporal separado de estado visual; esconder/ghost/isolar não pode apagar vínculo nem mudar avanço.
4. Dados serializáveis e snapshots persistidos; objetos Three.js e recursos GPU reconstruídos, não gravados como dados do projeto.
5. Presets de câmera/iluminação/resolução/recorte/cenário versionados por projeto e aplicáveis à exportação.
6. Atualizações IFC/XER/XML em duas fases (prévia de diferenças e confirmação), preservando baseline e possibilitando rollback.
7. Assets decorativos separados dos elementos BIM, quantitativos e progresso físico.
8. Contratos testáveis entre simulação e render: para uma data e revisão dadas, o render consome um estado 4D explícito e validado.

## 4. Política de qualidade visual: requisito de aceite, não apenas lista de efeitos

O plano já prevê céu, sol, sombras, materiais, vegetação, água e modos Técnico/Realista/Apresentação (Etapa 5), vídeo 4D (6) e fotos independentes (6B). **Adicionar efeitos não equivale a qualidade comercial.**

**Antes de escolher soluções técnicas, definir referências visuais aprovadas pelo proprietário**, incluindo:
- Obra em fases distintas, com concreto, aço, vidro, solo, paisagismo e elementos BIM reais.
- Vistas aéreas, gerais e próximas; dia ensolarado, céu encoberto e outras condições relevantes.
- Materiais e texturas, sombras de contato, reflexos, transparência, escala, exposição, composição e legibilidade.
- Consistência entre quadros, ausência de cintilação/flicker, mudanças de luz inesperadas, popping e artefatos.
- Limitações do IFC: geometria e atributos técnicos podem não fornecer texturas PBR, detalhamento, mobiliário, vegetação ou contexto suficientes. Definir enriquecimento visual explícito, sem inventar dados técnicos.

**Aceite visual:** usar cenas, câmeras, iluminação, resolução e datas controladas; comparar render atual, referência e render candidato; registrar imagens, parâmetros e avaliação. A aprovação estética pelo proprietário complementa, mas **não substitui**, testes objetivos de precisão/integridade. Não prometer fotorrealismo antes da prova de conceito.

**Preservar:**
- Identidade e picking de elementos, cortes, seleção, visibilidade, Ghost, câmera e geometria técnica.
- Cores e materiais originais no modo Técnico e retorno reversível após alternar modos.
- Dados de cronograma e progresso inalterados por efeitos de apresentação.
- Configurações e assets licenciados, com procedência documentada.

## 5. Prova de viabilidade visual antes da implementação completa da Etapa 5

Criar um **marco de decisão (gate) de viabilidade visual**, preparado durante a auditoria e executado antes de comprometer a implementação integral de realismo.

**Entregas:**
1. Inventário do pipeline atual: Three.js/WebGL, shaders, materiais, sombras, pós-processamento, resolução, captura, dependências e limites observados.
2. Cena IFC representativa, com geometria, materiais, revisões e cronograma controlados; pelo menos uma cena mais complexa quando houver dataset autorizado.
3. Referências de qualidade e critérios de avaliação aprovados.
4. Protótipo comparativo reproduzível com métricas de qualidade, memória, tempo e integridade 4D.
5. Decisão documentada: (A) melhorar pipeline atual; (B) ampliar render final mantendo visualizador; (C) estudar alternativa de renderização. Comparar qualidade, precisão, integração, licença, custo de manutenção, risco e tempo.
6. Resultado `APROVADO`, `REPROVADO` ou `INCONCLUSIVO` com evidências, limitações e ações.

**Não pressupor** que Three.js seja insuficiente ou suficiente. Não substituir engine por marketing, nem descartar alternativa sem prova. Se render alternativo for considerado, testar transferência fiel de geometria, IDs, estados por data, materiais e câmeras, e a complexidade do pipeline.

## 6. Política de desempenho subordinada à qualidade

- Medir primeiro: tempo de abertura IFC, CPU, FPS e latência de interação, draw calls, uso de GPU/RAM, tempo por quadro, duração de exportação, tamanho dos arquivos e falhas.
- Identificar gargalos reais por profiling. Investigar, sem presumir culpados: geometria/draw calls, instancing/LOD, parsing IFC, árvore longa, materiais, sombras, atualização por data, renderização repetida, liberação de recursos, concorrência e armazenamento.
- **Nenhuma redução silenciosa** de resolução, amostras, sombras, materiais, precisão 4D ou FPS final para cumprir tempo. Toda opção de qualidade reduzida deve ser explícita e reversível.
- Edição interativa pode ter ajustes de qualidade próprios; render final usa preset independente, **se viabilizado tecnicamente**.
- Otimizações devem preservar comparações de imagem, precisão de datas/IDs e testes de regressão.
- Não definir limites numéricos arbitrários de FPS, tempo, RAM ou resolução sem hardware, dataset e baseline. Estabelecer metas mensuráveis após testes.
- Admitir render offline mais lento para máxima qualidade, mas manter progresso, cancelamento seguro, mensagens de falha e recuperação.

## 7. Requisitos de imagens e vídeos

**Imagens (6B):**
- Exportação independente da fila de vídeo, incluindo imagem avulsa e 1/2/4/8 por mês, conforme documento 05.
- Datas exatas pré-visualizadas; cenário baseline/vigente/realizado/forecast/comparativo; câmera e iluminação controladas.
- Resolução e qualidade configuráveis; metadados e manifesto com projeto, revisão, cenário, data, viewpoint, preset e parâmetros.
- Comparações sob mesmas condições de câmera, FOV, escala, recorte, iluminação e resolução.
- Persistência e recuperação dos arquivos gerados; revisão do cronograma não deve sobrescrever entregas anteriores.

**Vídeo (6):**
- Datas e estados por quadro determinísticos; régua temporal independente de FPS e duração.
- Exportação com resolução/FPS/qualidade configuráveis, overlays corretos, transições coerentes e ausência de flicker perceptível.
- Processamento em lotes quando necessário, progresso/cancelamento/limpeza de recursos e preservação do projeto.
- Não usar frequência de fotos mensais como substituto da quantidade de quadros de vídeo.
- Verificar formatos, codec, compressão e possíveis perdas de qualidade; não afirmar suporte sem teste.
- Repetibilidade visual e temporal, com parâmetros registrados em manifesto.

**Qualidade técnica dos cenários:** baseline, programação vigente, realizado observado e forecast devem permanecer distintos. Percentual por duração não é automaticamente avanço físico; não inventar realizado histórico a partir de snapshot único. Respeitar calendários, datas de corte, revisões, elementos indivisíveis e vínculos.

## 8. Segurança de dados e evolução

- Projetos independentes, arquivos IFC duráveis, vínculos persistentes, viewpoints, presets e cronogramas recuperáveis após fechar/reabrir.
- Testar backup/restauração e migração de versões; código em Git **não** é backup dos dados locais.
- Atualização de revisão em prévia + confirmação, relatório de diferenças/órfãos e rollback em falha.
- Testar falta de espaço, falha parcial, fechamento inesperado, arquivos grandes e reabertura; definir comportamento seguro.
- Respeitar privacidade e licença dos IFCs e assets; não incluir arquivos de clientes em fixtures sem autorização.
- Guardar baseline e exports anteriores sem sobrescrita implícita.

## 9. Política de Git, integração e validação

- Manter `main` preservada até aprovação explícita. Desenvolver na branch de evolução atual; **não criar branches adicionais por padrão** nem exigir merge de protótipos antigos.
- Commits pequenos e revisáveis, relatórios por etapa, testes e regressão. Preferir mudanças incrementais; evitar refatoração global simultânea à implementação.
- Branches que funcionam isoladamente não garantem compatibilidade funcional. Ausência de conflito textual Git não equivale a aprovação.
- Verificar novamente ancestralidade/ahead-behind antes de integrar. Quando `main` é ancestral, a integração pode ser fast-forward, mas **ainda requer testes**.
- Conferir automação existente e, se ausente, propor CI mínimo com `npm ci`, `npm run typecheck`, `npm test`, `npm run build`, e testes específicos Electron/browser quando disponíveis. Não declarar CI ativo sem evidência.
- Executar testes independentes dos relatos do Codex; registrar commit SHA, ambiente, datasets, comandos, logs, resultados e limitações.
- Antes de merge/deploy: validação de regressão, backups e rollback, revisão de licenças e **autorização explícita do proprietário**.
- Não tratar `struxelo-desktop-prototype` ou `gh-pages` como branches que precisam ser integradas; avaliar recursos antigos individualmente se houver necessidade.

## 10. Matriz de aceite e evidências

| ID | Área | Cenário mínimo | Critério de aceite |
| --- | --- | --- | --- |
| Q01 | Visual | Cena técnica → realista → técnica | Materiais técnicos, IDs e estados restaurados |
| Q02 | Visual | Cena de referência, iluminação e materiais | Avaliação visual documentada e aprovação explícita |
| Q03 | Visual | IFC com poucos atributos de material | Limitação indicada; enriquecimento sem alterar BIM |
| Q04 | Vídeo | Mesma cena em datas consecutivas | Sem estados temporais incorretos ou artefatos relevantes |
| Q05 | Vídeo | Repetir exportação com mesmos parâmetros | Consistência visual/temporal documentada |
| Q06 | Fotos | Exportar imagem sem vídeo | Funciona de forma independente |
| Q07 | Comparativo | Baseline × realizado na mesma data | Câmera, escala, luz e resolução equivalentes |
| Q08 | Dados | Revisão IFC preservando IDs | Vínculos e viewpoints preservados ou impactos reportados |
| Q09 | Dados | Falha durante revisão/importação | Projeto anterior recuperável, sem perda silenciosa |
| Q10 | Dados | Salvar, fechar, reabrir | IFC, cronograma, links, câmera e presets íntegros |
| Q11 | 4D | 100 dias, dia 50, 70% físico | Não confundir avanço físico com 50% temporal |
| Q12 | Performance | Dataset pequeno/médio/grande | Medidas reais, baseline e regressões documentadas |
| Q13 | Performance | Exportar em qualidade máxima | Qualidade solicitada preservada, sem downgrade oculto |
| Q14 | Arquitetura | Refatorar módulo | Contratos e regressão preservados |
| Q15 | Entrega | Cancelar exportação | Recursos liberados e projeto intacto |
| Q16 | Integração | Candidato a merge | Testes completos e aprovação do proprietário |
| Q17 | Procedência | Dependências/assets/metadados | Licenças e atribuições revisadas |

Para cada caso registrar: `ID`, SHA do commit, SO/browser/Electron, CPU/GPU/RAM quando relevante, dataset e tamanho, passos, esperado, observado, evidência (imagem/vídeo/log), `PASS/FAIL/BLOCKED`, responsável e decisão. **Nunca substituir evidência por estimativa.**

## 11. Ordem recomendada, sem pular etapas

**Agora:** concluir auditoria independente das Etapas 0, 1, 1B, 2 e 3. Mapear arquitetura, fluxos, persistência, testes e riscos; colher baseline e requisitos visuais. Não declarar homologação sem execução.

**Antes da Etapa 4:** consolidar falhas bloqueantes e critérios de aceite. Não exigir refatoração total.

**Etapas 4 e 4B:** vínculos, atualização de cronograma, avanço físico, snapshots e previsão; manter precisão 4D como fundamento da renderização.

**Antes da implementação completa da Etapa 5:** gate de viabilidade visual com protótipo comparativo e decisão sobre pipeline. A investigação pode ser planejada antes sem iniciar implementação não autorizada.

**Etapa 5:** materiais, luz, céu, sombras, assets, modos e qualidade de apresentação, com testes de regressão e aprovação visual.

**Etapas 6 e 6B:** vídeo determinístico e fotos independentes, preservando qualidade, dados, comparativos e metadados.

**Etapa 7:** homologação integrada, incluindo cenas de referência, projetos representativos, desempenho, segurança de dados e aprovação explícita.

## 12. Critérios de decisão e prioridades

**Bloqueadores absolutos:** perda/corrupção de projetos, vínculos incorretos, estados 4D falsos, mistura de obras, impossibilidade de recuperar dados, exportação temporal incorreta e quebra de funções essenciais.

**Bloqueadores de qualidade final:** resultado visual abaixo do padrão de referência aprovado, degradação silenciosa de resolução/efeitos, artefatos graves e inconsistência entre quadros.

**Otimizações desejáveis:** menor tempo de render, maior FPS de edição, menor memória e abertura mais rápida, desde que não sacrifiquem requisitos obrigatórios.

**Trade-off autorizado conceitualmente:** maior tempo de render para elevar qualidade final. **Trade-offs não autorizados automaticamente:** perda de precisão, redução invisível de qualidade, incompatibilidade com projetos, dependências/licenças inadequadas, reescrita de alto risco.

**Critérios para escolher tecnologia:** resultado visual demonstrado; preservação do 4D e IFC; compatibilidade com arquitetura existente; estabilidade; recursos locais; manutenção; licenciamento; custo/tempo. Não escolher por popularidade ou promessa.

## 13. Pendências objetivas antes de modificar o plano mestre

1. Quais referências visuais concretas definem o padrão mínimo aceitável?
2. Qual hardware será usado para edição e exportação?
3. Quais datasets IFC e cronogramas representativos podem ser usados legalmente nos testes?
4. Qual é o estado real do pipeline atual de captura, materiais, sombras e exportação?
5. Quais testes e workflows de CI efetivamente executam e quais estão ausentes?
6. Quais fronteiras de módulo e fluxos têm acoplamento problemático demonstrável?
7. Como são feitos backup, recuperação e rollback dos dados locais na plataforma-alvo?
8. Quais limites operacionais de tempo, memória e tamanho de arquivo são aceitáveis após medição?

## 14. Controle de alterações deste documento

Este documento registra as prioridades e uma **proposta técnica detalhada** derivada da discussão com o proprietário. **Não altera automaticamente os critérios existentes, não muda o status das etapas e não autoriza desenvolvimento adicional.** Em caso de conflito, manter requisitos explícitos do proprietário e registrar a decisão antes de editar documentos anteriores. Alterações futuras devem ser rastreáveis por commit, com justificativa, evidência e aprovação.
