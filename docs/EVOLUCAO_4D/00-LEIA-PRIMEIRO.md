# Plano mestre de evolução segura do Stratum 4D

## Objetivo e regras inegociáveis
O aplicativo atual já é útil e funcional. Evoluir sem regressão. A branch de trabalho é `feature/evolucao-stratus-4d`; a branch `main` é baseline e não deve ser alterada, mesclada ou receber commits de implementação automaticamente. Antes de modificar qualquer arquivo: registrar SHA da main e branch, executar os testes e build atuais, documentar resultados e falhas preexistentes. Fazer backup dos dados de projetos, não apenas do código. Não excluir nem substituir recursos existentes sem equivalência comprovada.

## Orientações obrigatórias ao Codex
1. Trabalhar estritamente uma etapa por vez, em commits pequenos e revisáveis. Não iniciar a etapa seguinte antes de testes, relatório e aprovação da etapa anterior.
2. Primeiro ler o código integralmente relevante e procurar implementações existentes; não recriar Ghost, controles, persistência, IFC ou 4D sem justificar.
3. Para cada etapa: inventário de arquivos e fluxos; diagnóstico com evidências e referências a caminhos/linhas; desenho de arquitetura; implementação mínima; testes unitários, integração, regressão e manuais; relatório de resultados e riscos; commit e PR em draft para revisão.
4. Nunca declarar 'testado' sem registrar comando executado, ambiente, saída e resultado. Se não for possível executar teste, marcar NÃO TESTADO e bloquear a conclusão.
5. Antes de qualquer migração, preservar compatibilidade e oferecer recuperação; migrations versionadas, idempotentes, testadas em cópias.
6. Separar fatos comprovados de hipóteses. Evitar promessas de fotorrealismo sem materiais, geometria, hardware e provas.
7. O motor atual Three.js/WebGL + web-ifc deve ser preservado até benchmark demonstrar necessidade de mudança. Manter modo Técnico independente de efeitos visuais.
8. Não misturar IFC, cronogramas, vínculos, vistas ou configurações de projetos diferentes. Não apagar recursos multiprojeto existentes: isolar fluxo comum e preservar opção avançada explicitamente.
9. Qualquer alteração de seleção, visibilidade, câmera ou renderização deve ser testada também durante simulação, importação, reabertura e exportação.
10. Ao encontrar bug, escrever teste reproduzindo-o ANTES da correção, corrigir, repetir teste e toda suíte de regressão.
11. Não efetuar merge na main, exclusão de branch, mudança destrutiva ou deploy sem aprovação explícita.

## Evidências preliminares, NÃO auditoria completa
- `src/viewer/Viewer.ts`: Three.js, OrbitControls, seleção Set, setFocus com Ghost, câmera, estados por elemento, raycasting.
- `src/viewer/ifcLoader.ts`: web-ifc, geometria por elemento, GlobalId, MeshLambertMaterial, propriedades.
- `src/core/project.ts`: formato de projeto registra modelFileName; modelo não embutido. Reabertura pode requerer reimportação.
- `src/core/multiproject.ts`: combinação de cronogramas P6, que não deve ser perdida.
- `src/ui/ProjectsDialog.tsx`: persistência e abertura de projetos de cronograma.
- `src/ui/App.tsx`: fluxos de importação, save/load e seleção.
- Repositório comparativo `laionrocha-max/BIM4D`: ViewerToolbar, ViewerShell, ProjectDialog, ScheduleLinkPanel, Gantt e persistência; usar apenas como referência, sem copiar cegamente.
Esses achados vêm de inspeção parcial de arquivos. Nenhum teste ou execução foi realizado nesta preparação.

## Ordem de trabalho
Etapa 0 auditoria e baseline; 1 projetos e persistência; 2 câmera; 3 seleção e visibilidade; 4 vínculos 4D; 5 visual realista; 6 vídeo; 7 validação integrada. Consulte `01-ETAPAS-E-ACEITE.md`, `02-UX-E-ARQUITETURA.md` e `03-TESTES-E-REGRESSAO.md`.

## Entrega obrigatória por etapa
Criar relatório `docs/EVOLUCAO_4D/RELATORIO-ETAPA-N.md` com: SHA inicial/final; arquivos alterados; comportamento antes/depois; decisões e alternativas rejeitadas; riscos; testes e saídas reais; bugs encontrados/corrigidos; testes pendentes; screenshots ou gravações quando cabível; impacto em performance; checklist de aceite; instruções de rollback. Abrir PR draft sem mesclar.

## Prompt de execução para Codex
'Leia integralmente docs/EVOLUCAO_4D/00-LEIA-PRIMEIRO.md, 01-ETAPAS-E-ACEITE.md, 02-UX-E-ARQUITETURA.md e 03-TESTES-E-REGRESSAO.md. Execute APENAS a Etapa 0. Antes de editar código, audite fluxos e testes atuais, registre baseline com evidências e reporte riscos. Não faça alterações funcionais, não faça merge, não avance sem aprovação. Após aprovação explícita, prossiga para a etapa indicada, sempre com testes de regressão e relatório de evidências.'

## ADENDO OBRIGATÓRIO — Revisões, realizado e entregas
Leia também integralmente `docs/EVOLUCAO_4D/05-REVISOES-PROGRESSO-E-ENTREGAS.md`. Este documento amplia o escopo e introduz Etapa 4B; prevalece para requisitos de atualização IFC/XML, baseline, percentual físico, data de corte, forecast, viewpoints e exportação separada de fotos/vídeo. Na Etapa 0, auditar esses fluxos. Não avançar ou implementar sem aprovação.
