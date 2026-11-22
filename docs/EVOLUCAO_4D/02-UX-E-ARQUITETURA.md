# Especificação de interface, interação e arquitetura

## Layout principal
**Tela inicial:** cabeçalho Stratum 4D, busca, lista/grid de projetos com nome, código, última alteração, estado de modelos e cronograma, botão primário Novo projeto. Menu de cada card: abrir, renomear, duplicar, arquivar, excluir (confirmação). Não mostrar arquivos de outros projetos ao abrir uma obra.
**Workspace:** barra superior fixa com breadcrumb 'Projetos / Obra ativa', botão de trocar projeto e salvar; abas Modelos, Cronograma, Vínculos 4D, Simulação. O usuário pode exibir painéis simultaneamente, mas contexto de projeto único.
**Barra do visualizador (acima do canvas):** grupo Navegação (Selecionar, Orbitar, Pan, Enquadrar tudo, Enquadrar seleção); grupo Visibilidade (Ocultar seleção, Isolar seleção, Destacar/Ghost, Mostrar todos, menu mais opções); grupo Ferramentas (Seção, Medir, vistas); seletor Aparência (Técnico, Realista, Apresentação).
**Esquerda:** árvore com modelos IFC e olhos individuais, hierarquia, busca e filtros; Ctrl+click múltiplo; ações no menu direito.
**Direita contextual:** propriedades e GlobalId, informações de seleção, lista de elementos, ações de vínculo com atividade, conjunto salvo e ajustes de aparência.
**Rodapé expansível:** Gantt, linha do tempo, playback, data atual e estado de simulação. Nunca sobrepor controles críticos ao canvas em telas menores; painel responsivo e colapsável.

## Comportamento detalhado
- Clicar em elemento seleciona e realça; Ctrl+click alterna associação ao conjunto; clicar vazio limpa seleção; seleção na árvore sincroniza viewer. Mostrar breadcrumb de quantidade selecionada.
- Ocultar seleção: tornar invisíveis apenas os IDs selecionados; manter outros. Isolar: somente selecionados visíveis; Ghost: selecionados em destaque e demais translúcidos, sem confundir com isolamento. Mostrar todos restaura visibilidade global; definir e testar como respeita olhos de modelos e filtros ativos.
- Ao orbitar: pivô centro de bounds do selecionado; seleção múltipla usa bounds unidos; sem seleção, pivô padrão. Preservar visão e evitar saltos.
- Botão direito no elemento: Ocultar, Isolar, Destacar/Ghost, Enquadrar, Selecionar semelhantes (abrir escopo), Vincular atividade, Propriedades. Botão direito em vazio: Mostrar todos, Enquadrar tudo, Limpar seleção.
- Árvore: olhos por modelo, categoria e elemento; estados parcial/total; menu contextual equivalente; seleção não muda visibilidade.
- Aparência: modo Técnico reversível; Realista com céu/sol/sombras/material; Apresentação para qualidade de exportação. Painel de ajustes agrupado em Céu e atmosfera, Sol e sombras, Materiais, Vegetação, Água, Qualidade. Presets persistidos por projeto.
- Importação IFC dentro do projeto: Adicionar modelo, Substituir revisão, Remover; mostrar confirmação e prévia do impacto de vínculos. Importação de cronograma também dentro do projeto.
- Não exibir controles que aparentam funcionar mas não estão implementados; disponibilizar progressivamente com flags e testes.

## Contratos de estado sugeridos (propostas, não afirmações sobre código)
ProjectContext: projectId ativo obrigatório. ModelRef: modelId único no projeto, sourceFile, revision, contentHash. ElementKey: projectId/modelId/globalId. ScheduleKey: projectId/scheduleId/activityId. ViewState: camera, selectedIds, hiddenIds, isolateIds, ghostIds, modelVisibility, clipping, appearancePreset. TemporalState: simulationDate, task states.
A ordem de precedência de ocultação deve ser definida por especificação e testes: modelo desligado e filtro explícito prevalecem sobre destaque/seleção; a simulação pode controlar visibilidade construtiva sem apagar o estado manual. 'Mostrar todos' não deve reativar um modelo que o usuário desligou explicitamente, salvo ação 'Reativar todos os modelos'. Registrar essa escolha em UI.
Salvar apenas dados serializáveis, não objetos Three.js; recursos GPU reconstruídos ao carregar. Evitar IDs globais de IFC sem namespace do modelo. Manter backups e migração de versões do projeto.

## Acessibilidade e performance
Atalhos documentados e sem conflito com edição de texto; aria-label e tooltips; foco visível; navegação por teclado na árvore; indicadores de processamento; cancelar operações longas. Não renderizar toda árvore de IFC gigante sem virtualização. Atualizar somente objetos alterados e não recriar materiais por frame. Medir FPS e memória antes/depois.

## Referências
Navisworks: órbita em torno de seleção, árvore e visibilidade; Trimble Connect: Ghost e seleção; SYNCHRO: vínculos e simulação. Essas são referências de UX, não autorização para copiar código, marcas ou assets proprietários. O repositório BIM4D conectado pode ser estudado como comparação de implementação e licenças.