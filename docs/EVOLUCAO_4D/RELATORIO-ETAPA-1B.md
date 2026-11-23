# STRATUM 4D — Etapa 1B — Revisões de IFC e cronograma

Base `933170f1365fbec5cc44790ca9ab78fb75e8416f`, na branch `feature/evolucao-stratus-4d`. A Etapa 1 de projetos independentes foi validada anteriormente. O adendo de revisões foi aplicado antes da Etapa 2 de navegação.

## Fluxos entregues

| Ação | Resultado |
| --- | --- |
| **Cronograma → Atualizar cronograma** | Lê XML do Project ou XER do Primavera. Abre a prévia no contexto da obra atual. Mostra datas de corte, atividades adicionadas, removidas e alteradas, calendários, predecessoras e vínculos com correspondência. O arquivo precisa corresponder ao projeto e à origem do cronograma vigente. |
| **Modelos → Substituir revisão** | Compara a revisão carregada com a candidata no mesmo sistema de coordenadas da federação. Mostra GlobalIds que entraram, saíram ou permaneceram com geometria, posição, nome, classe ou hierarquia alterada. Avisa sobre mudança de georreferência ou deslocamento comum. |
| **Correspondência manual** | Permite associar elementos com GlobalId alterado ou atividades sem correspondência segura. Destinos precisam existir na revisão e ser usados uma vez na mesma operação. Ações sem destino ficam registradas no estado anterior. |
| **Histórico de revisões** | Registra origem, SHA-256 quando o arquivo está disponível, número, data, data de corte, autor autenticado ou perfil local e resumo. Permite baixar o manifesto anterior ou restaurar a obra. Antes de restaurar, cria uma cópia do estado vigente. |

O arquivo recebido é lido e comparado antes de substituir o estado da obra. A aplicação da revisão exige gravar no armazenamento local o arquivo recebido e o checkpoint anterior. Cancelar, receber um arquivo inválido ou falhar no preparo preserva o estado ativo. Restaurar exige que os IFCs da cópia anterior estejam disponíveis. Fotos e vídeos anteriormente baixados permanecem como arquivos locais das respectivas entregas.

## Decisões de integração

- O cronograma usa códigos únicos dentro da sua própria origem. IDs internos novos não invalidam correspondências seguras. No XML do Project, conflitos entre UID e código visível são encaminhados à revisão manual. Uma revisão do cronograma comercial não substitui baseline, baselines armazenadas ou suas seleções de comparação. A função explícita de baseline também passa a rejeitar códigos duplicados.
- O IFC mantém as chaves com namespace do modelo. Os IDs Express sem GlobalId são tratados como dependentes da revisão. A comparação de geometria usa dados de malha carregados, com a transformação de cada IFC já aplicada. Mudanças de referência ou deslocamentos comuns são avisos. A revisão depende da verificação de alinhamento quando esses avisos aparecem.
- Vistas preservam pose, direção de referência, FOV, recorte próximo/distante, aspecto observado, tamanho do canvas e cortes com referência em coordenadas de cena. O visualizador continua em perspectiva e ajusta a proporção à tela. A comparação lado a lado e a resolução fixa da entrega pertencem à exportação do adendo. Divisões e fusões aparecem como candidatos a conferência dos elementos ou atividades adicionados e removidos. A ferramenta exige remapeamento explícito nessas ocorrências.
- O manifesto v4 inclui o diário. Projetos v1 a v3 continuam legíveis. Arquivos IFC, fontes XER/XML e checkpoints usam o armazenamento local por hash. Em outro navegador, endereço ou instalação, o manifesto pode ter referências a arquivos que ainda não estão disponíveis. O histórico não transfere os binários entre perfis.

## Evidência e rollback

| Cenário | Validação |
| --- | --- |
| R01/R02/R09 · UID novo, tarefa renomeada e baseline | Comparação de XML com UID interno alterado e código preservado. O teste verifica vínculos e caminhos, datas da baseline e detecção da mudança de nome, datas reais e duração. Dois XMLs homônimos com GUIDs de projeto diferentes não são tratados como revisões. |
| R03/R04 · Duplicidade e remoção | O núcleo rejeita códigos duplicados na revisão e na atribuição de baseline. Remoção de atividade com vínculo é identificada e separada do conjunto ativo. |
| R05/R06/R07 · Geometria, coordenadas e GlobalId | O teste de núcleo usa coordenadas alteradas e mudança de hierarquia. No navegador, um IFC sintético deslocado produziu aviso de origem. Um GlobalId alterado exigiu um destino válido e manteve o vínculo após remapeamento explícito. |
| R08 e câmera de R20 · Rollback e câmera | Cancelar preserva o manifesto da obra. Histórico restaurado após reabrir recupera os vínculos e data anteriores com os IFCs e a câmera esperados. A exportação integrada de entregas está prevista na Etapa 6B. |
| Regressão da Etapa 1 | O mesmo roteiro volta a abrir duas obras, testar cópia e arquivamento e recuperar um projeto v2 com relocalização de IFC. |

O roteiro `tests/projects.browser.mjs` roda em um perfil de teste separado, com o XML de amostra do STRATUM e IFCs sintéticos. Usar `STRATUM_TEST_BUILD=1` para executar contra a compilação. A suíte de unidades e integração é executada com `npm test -- --maxWorkers=1 --minWorkers=1`.

`npm run build` passou. A suíte final aprovou 295 testes em 47 arquivos, com cinco testes condicionais pulados. O browser validou a versão compilada com dois projetos, baseline preservada, manutenção de vistas salvas, cancelamento, histórico, rollback e remapeamento de IFC.

Para reverter um caso no aplicativo, abra o histórico da obra e selecione **Restaurar estado anterior** no registro correspondente. Se for voltar ao software da Etapa 1, guarde antes as exportações v4 e a última cópia anterior compatível com v3. Manter o checkout e a biblioteca originais permite rollback da implantação local sem sobrescrever os dados de trabalho.
