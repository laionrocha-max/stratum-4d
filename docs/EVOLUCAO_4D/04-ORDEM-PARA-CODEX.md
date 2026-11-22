# ORDEM DE TRABALHO PARA CODEX — NÃO PULAR ETAPAS

**Situação:** branch de preparação documental criada a partir de main. Não há implementação nem testes executados nesta preparação. Issues estão desabilitadas neste repositório (GitHub HTTP 410), então este documento é o ponto de acompanhamento.

## Prompt inicial (copiar integralmente para o Codex)
Você trabalhará no repositório laionrocha-max/stratum-4d, branch feature/evolucao-stratus-4d. A branch main contém a aplicação funcional e não deve ser alterada. Leia INTEGRALMENTE os quatro documentos docs/EVOLUCAO_4D/00-LEIA-PRIMEIRO.md, 01-ETAPAS-E-ACEITE.md, 02-UX-E-ARQUITETURA.md e 03-TESTES-E-REGRESSAO.md. Execute SOMENTE A ETAPA 0. Inspecione profundamente código, testes, UI, persistência, câmera, seleção, Ghost, IFC, cronograma, links, simulação, renderização e exportação. Compare com BIM4D quando pertinente. Rode typecheck, testes, build e smoke tests disponíveis; registre logs e bugs preexistentes, sem inventar resultados. Identifique dependências, riscos, contratos e pontos de integração. Produza docs/EVOLUCAO_4D/RELATORIO-ETAPA-0.md com evidências, matriz de funcionalidades existentes, plano de testes e proposta técnica priorizada. Não implemente novas funcionalidades, não altere main, não faça merge, não execute deploy e NÃO avance para a etapa 1 sem aprovação expressa do usuário. Se descobrir problemas graves, reporte-os com reprodução e prioridade. Faça commits pequenos na branch de evolução.

## Ciclo obrigatório nas etapas 1 a 7
Receber autorização explícita da etapa N; reler requisitos; revisar implementação existente; desenhar plano com arquivos e impacto; escrever testes; implementar mudança mínima; executar testes e corrigir bugs; executar regressão; registrar evidências e benchmarks; criar relatório; pedir aprovação antes de N+1. Nunca declarar concluído se algum teste obrigatório estiver bloqueado.

## Estado das etapas
- [ ] Etapa 0: auditoria e baseline (PRÓXIMA)
- [ ] Etapa 1: projetos e persistência
- [ ] Etapa 2: câmera e órbita
- [ ] Etapa 3: seleção, visibilidade e Ghost
- [ ] Etapa 4: vínculos BIM-cronograma
- [ ] Etapa 5: céu, iluminação, vegetação, água e materiais
- [ ] Etapa 6: exportação e vídeo
- [ ] Etapa 7: homologação

## Restrições de aceite
Sem perda de IFC, GlobalIds, vínculos, cronogramas, controles, cortes, medições, vistas, simulação, Ghost, projetos salvos ou exportações. Sem mistura de projetos. Preservar modo técnico. O visual realista é camada adicional e reversível. Evidências de testes obrigatórias, inclusive falhas.

## ADENDO OBRIGATÓRIO — Revisões, realizado e entregas
Leia também integralmente `docs/EVOLUCAO_4D/05-REVISOES-PROGRESSO-E-ENTREGAS.md`. Este documento amplia o escopo e introduz Etapa 4B; prevalece para requisitos de atualização IFC/XML, baseline, percentual físico, data de corte, forecast, viewpoints e exportação separada de fotos/vídeo. Na Etapa 0, auditar esses fluxos. Não avançar ou implementar sem aprovação.
