# Etapas detalhadas, tarefas e critérios de aceite

## Etapa 0 — Inventário e linha de base (bloqueante)
- Mapear estrutura do repo, entrypoints, rotas, stores, UI, serviços, API, Electron, persistência, modelos, cronogramas, vínculos, simulador, exportação, autenticação e configurações.
- Ler arquivos relevantes integralmente e desenhar fluxos: importar IFC; importar XER/MSP; vincular; salvar; fechar; reabrir; atualizar IFC; simular; exportar; selecionar/ocultar/ghost; trocar projeto.
- Auditar testes, scripts, CI, fixtures, licenças, segurança e arquivos grandes. Confirmar versão do Node e lockfile; instalar dependências em ambiente isolado; executar `npm run typecheck`, `npm test`, `npm run build` e scripts pertinentes, anotando saídas reais. Não presumir sucesso.
- Confirmar persistência do modelo e origem dos bytes, tratamento de GlobalId duplicado, colisão entre IFCs, versionamento, serialização e estado da câmera.
- Mapear diferenças entre Stratum e BIM4D; identificar recursos já existentes e acessibilidade de cada um. Registrar matriz 'existe / parcial / ausente / não verificado'.
- Criar dados de teste pequenos e grandes, com consentimento para dados reais. Baseline de FPS, memória, tempo de importação, screenshot e exportação. Testar reabertura.
**Aceite:** mapa de arquitetura + relatório de bugs preexistentes + testes reproduzíveis + estratégia de rollback. Não modificar funcionalidades nesta etapa.

## Etapa 1 — Projetos independentes
- Propor entidades Project(id imutável, nome, metadados), Model(id, projectId, nome, revisão, hash, origem, bytes ou referência durável), Schedule(id, projectId, revisão, formato), ElementRef(projectId, modelId, globalId ou expressId de fallback), Link(projectId, activityId, refs), View, SimulationPreset, Settings.
- Decidir armazenamento real após inspeção; evitar duplicação desnecessária de arquivos; manter manifest de integridade e migração compatível com formato atual.
- Criar biblioteca de projetos na abertura: criar, abrir, renomear, duplicar, arquivar, excluir com confirmação e aviso de impacto. Troca de projeto limpa seleção, filtros, vínculos temporários e estados de câmera não persistidos.
- Dentro de projeto, importação IFC (adicionar, remover, substituir revisão), cronograma (importar, atualizar), vínculos e simulação. Nunca listar dados de outra obra em seletores comuns.
- Em revisão IFC: comparar IDs, preservar vínculos válidos, sinalizar perdidos, novos e ambíguos; exigir confirmação antes de descartar.
- Preservar funcionalidade P6 multiprojeto como modo avançado explícito, sem misturar contextos por padrão.
**Aceite:** duas obras isoladas; salvar/reabrir offline conforme plataforma; atualizar IFC sem perder vínculos correspondentes; migração de projeto legado sem perda; testes de exclusão/duplicação e troca de contexto.

## Etapa 2 — Câmera e navegação Navisworks-like
- Investigar `Viewer.ts` e eventos da UI antes de mudar. OrbitControls.target: sem seleção pivô padrão do modelo; um objeto pivô no centro de bounds world-space; múltiplos objetos centro do bounding box agregado; clique vazio remove seleção e restaura alvo padrão.
- Evitar saltos: mudar target mantendo pose e direção aparente quando possível, animar transição controlada, cancelar animações concorrentes. Pan, zoom, orbit, fit all, fit selected, reset view e câmera salva.
- Testar bounds de objetos invisíveis, seccionados, explodidos, transformados e coordenadas distantes; considerar rebase/origin shifting se comprovadamente necessário.
**Aceite:** seleção única/múltipla, clique vazio, orbit e pan sem saltos, teste de cenas com grande escala, sem quebra de viewpoints ou exportação.

## Etapa 3 — Seleção, visibilidade e Ghost
- Reutilizar `setFocus`, `setSelection` e estados existentes. Definir separadamente selection Set, hidden Set, isolate filter, ghost/focus, visibility per-model, per-category, simulation visibility; especificar precedência de estados e reset.
- Comandos: ocultar selecionados; isolar selecionados (ocultar demais); mostrar todos; destacar com Ghost; ajustar transparência; selecionar semelhantes por escopo; selecionar múltiplos Ctrl+click; limpar seleção; enquadrar; desfazer/refazer.
- Painel árvore IFC por projeto > modelo > edifício > pavimento > categoria > elemento, com seleção bidirecional, busca e indicadores de visibilidade. Se IFC não contiver hierarquia, indicar ausência em vez de inventar.
- Ghost já existe: melhorar acesso e ergonomia, não duplicar engine. Objetos ghosted não devem ser selecionados inadvertidamente conforme política definida e testada.
- Menu de contexto no objeto e árvore; atalhos com indicação; foco de teclado e acessibilidade.
**Aceite:** ocultar e isolar vice-versa; mostrar todos recupera; seleção exata e multi; regras de precedência com simulação; links não são apagados ao ocultar; Ghost existente permanece.

## Etapa 4 — Vínculos BIM ↔ cronograma
- Identidade composta (projectId, modelId, GlobalId) para IFC; fallback expressId apenas com aviso de estabilidade; atividades identificadas por scheduleId e activityId.
- Seleção manual e conjuntos salvos, regras por propriedades (tipo, disciplina, pavimento etc.) e escopo explícito; preview com contagem e conflitos; auditoria de alterações e desfazer.
- Sincronização modelo↔atividade, destaque contextual, validação de atividades órfãs, elementos sem vínculo, duplicidades e vínculos entre projetos.
- Preservar engine 4D, perfis e segmentos; não alterar sem testes.
**Aceite:** vincular apenas 4 paredes escolhidas, simular corretamente, reabrir e atualizar revisão, detectar vínculos órfãos e não permitir associação entre projetos.

## Etapa 5 — Céu, iluminação e materiais realistas
- Preservar modo Técnico (aparência original IFC) e adicionar modos Realista e Apresentação configuráveis; feature flags por efeito.
- Auditar materiais IFC existentes: cor, alpha, representação, texturas quando disponíveis. Não presumir que IFC contenha mapas PBR, vegetação detalhada ou água realista.
- Avaliar MeshStandardMaterial/MeshPhysicalMaterial e mapeamento de materiais; preservar materiais originais para reversão, identidade de objetos, picking e 4D.
- Céu atmosférico, horizonte, posição solar configurável (data/hora e localização opcional), iluminação física coerente, sombras com bias e cascatas se justificadas, ambient occlusion, exposição e tone mapping. Definir comportamento offline sem coordenadas geográficas.
- Biblioteca de assets opcionais e licenciados para árvores, gramado, água, aço, vidro, concreto, madeira. Assets de apresentação separados dos elementos BIM e dos quantitativos. Água: reflexo, refração e ondulação somente quando compatíveis com geometria e desempenho.
- Comparar screenshots controlados em cenas técnicas e reais; benchmark GPU, memória, importação, interação e fallback de hardware. Não substituir Three.js sem prova comparativa e plano de migração.
**Aceite:** alternar Técnico/Realista sem perder IDs, vínculos, seleção, cortes, Ghost ou simulação; iluminação e céu configuráveis; assets não contaminam quantitativos.

## Etapa 6 — Render e vídeo 4D
- Investigar pipeline atual de captura/exportação antes de modificar; reutilizar cálculo temporal existente e estados construtivos.
- Renderizar quadros por instante da linha do tempo com resultado determinístico, câmera salva e presets; definir resolução, FPS, intervalo, formato, qualidade e estimativa de recursos.
- Processar em lotes, liberar GPU/memória, progresso, cancelamento, retomada quando viável, mensagens de falha, fallback para dispositivos sem efeitos avançados.
- Garantir que o modo apresentação não altera datas, vínculos ou geometria técnica.
**Aceite:** sequência temporal correta em datas de borda, repetibilidade, cancelamento seguro, exportação sem vazamentos evidentes e compatibilidade com vídeo atual.

## Etapa 7 — Homologação e entrega
- Matriz completa de regressão; modelos de pequeno/médio/grande porte; IFCs multidisciplinares e cronogramas reais anonimizados; testes cross-platform onde suportado.
- Revisão UX com usuário: descobrir e executar ocultar/isolar em até poucos cliques, navegar entre projetos sem mistura, abrir projeto salvo com modelos, produzir vídeo.
- Comparar métricas com baseline, classificar falhas por gravidade, corrigir bloqueantes, revisar segurança/licenças, documentação e rollback.
**Aceite:** nenhum bug crítico ou perda de dados, testes documentados, aprovação explícita antes de merge/deploy.