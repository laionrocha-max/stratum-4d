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

## Estado e ordem vigente
Consulte `AUDITORIA-DE-ACEITE.md` para evidências históricas e `04-ORDEM-PARA-CODEX.md` para diagnóstico atual, prioridades e prompt único vigente. As etapas 2 e 3 foram reabertas quanto à utilização real. A prova visual mínima foi antecipada, em paralelo e isolada, sem dispensar os gates de estabilidade e precisão. Os documentos 01–03 e 05–07 preservam os requisitos técnicos e critérios de aceite.

## Entrega obrigatória por etapa
Criar relatório `docs/EVOLUCAO_4D/RELATORIO-ETAPA-N.md` com: SHA inicial/final; arquivos alterados; comportamento antes/depois; decisões e alternativas rejeitadas; riscos; testes e saídas reais; bugs encontrados/corrigidos; testes pendentes; screenshots ou gravações quando cabível; impacto em performance; checklist de aceite; instruções de rollback. Abrir PR draft sem mesclar.

## Prompt de execução para Codex
Utilize exclusivamente o prompt vigente em [04-ORDEM-PARA-CODEX.md](04-ORDEM-PARA-CODEX.md). Leia também 05, 06, 07 e AUDITORIA-DE-ACEITE. Não repetir a Etapa 0 do zero nem seguir instruções históricas conflitantes.
