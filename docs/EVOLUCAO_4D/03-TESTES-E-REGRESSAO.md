# Plano de testes obrigatório e política anti-regressão

## Política de qualidade
Não confiar somente em build verde. Executar unitários, integração, E2E de UI quando infraestrutura disponível, testes manuais guiados e benchmarks. Para cada bug: reprodução, teste falhando, correção, teste passando, suíte completa. Documentar falhas preexistentes separadamente. Cada PR deve ter checklist e evidências; bloquear merge em regressões críticas. Criar testes novos antes ou junto da implementação.

## Comandos baseline (confirmar ambiente)
```sh
npm ci
npm run typecheck
npm test
npm run build
```
Se algum comando não existir ou falhar por ambiente, explicar causa e alternativa; não ocultar falhas. Verificar `package.json`, lockfile, CI, Node, Electron e scripts de build específicos. Os comandos acima são INSTRUÇÕES para o Codex, não foram executados nesta preparação.

## Matriz mínima de regressão
| ID | Cenário | Resultado esperado |
| --- | --- | --- |
| P01 | Criar dois projetos e importar IFC/cronograma distintos | Dados não se cruzam |
| P02 | Salvar, fechar e reabrir | IFC, cronograma, links e presets recuperados |
| P03 | Importar revisão IFC com GlobalIds estáveis | Vínculos preservados |
| P04 | Revisão com IDs removidos/duplicados | Relatório e confirmação, sem perda silenciosa |
| P05 | Migrar arquivo legado | Conteúdo recuperado sem corrupção |
| V01 | Selecionar um elemento | Somente elemento correto destacado |
| V02 | Ctrl+click em vários | Seleção múltipla exata |
| V03 | Clicar vazio | Desmarcar e restaurar pivô |
| V04 | Orbitar selecionado | Pivô na seleção, sem salto |
| V05 | Orbitar sem seleção | Pivô padrão |
| V06 | Pan/zoom/fit com seleção e cortes | Navegação consistente |
| H01 | Ocultar seleção | Apenas selecionados ocultos |
| H02 | Isolar seleção | Apenas selecionados visíveis |
| H03 | Ghost | Seleção destacada e restante translúcido |
| H04 | Mostrar todos após H01/H02/H03 | Estado restaurado conforme regra |
| H05 | Modelo com olho desligado | Não reaparece por seleção/ghost |
| H06 | Seleção pela árvore | Sincronização com viewport |
| L01 | Vincular quatro paredes | Exatamente quatro elementos vinculados |
| L02 | Reabrir projeto | Vínculos persistem |
| L03 | Trocar cronograma/revisão | Órfãos detectados e reportados |
| S01 | Simular datas antes/durante/depois de atividade | Estado 4D correto |
| S02 | Ghost/ocultação durante playback | Sem interferência nos dados 4D |
| R01 | Alternar Técnico/Realista/Técnico | Aparência técnica recuperada |
| R02 | Céu, sol e sombras | Mudanças visuais sem alterar geometria |
| R03 | Vegetação e água decorativas | Não entram em quantitativos ou vínculos |
| E01 | Exportar vídeo com datas conhecidas | Sequência temporal correta |
| E02 | Exportação cancelada | Recursos liberados, projeto intacto |
| E03 | Repetir exportação mesmos parâmetros | Resultados consistentes |
| B01 | IFC grande e árvore longa | Sem congelamento ou crescimento de memória descontrolado |
| B02 | Múltiplos IFCs | IDs sem colisão e visibilidade independente |

## Datasets e fixtures
Criar fixtures IFC com dois modelos contendo GlobalId igual para testar namespace; 4 paredes independentes; um IFC com pavimentos; IFC com coordenadas distantes; IFC com materiais e transparências; cronograma de 5 atividades com datas de borda; dois projetos de mesma nomenclatura; arquivo legado; modelos de escala crescente. Não adicionar arquivos de clientes sem autorização. Validar hashes e versões de fixtures.

## Evidência por teste
Registrar ID, SHA, ambiente SO/browser/GPU/Node, dataset e tamanho, passos, esperado, observado, resultado PASS/FAIL/BLOCKED, screenshot/log, issue do bug. Benchmark: tempo de abertura IFC, FPS de órbita, uso de memória, tempo por frame, tamanho de exportação. Comparar contra baseline; estabelecer limites após medições, não inventar números.

## Gate de etapa
[ ] Código inspecionado e risco documentado
[ ] Testes novos adicionados
[ ] Typecheck, suíte e build executados com evidência
[ ] Testes manuais dos fluxos afetados executados
[ ] Sem perda de dados, IDs, vínculos ou recursos existentes
[ ] Performance comparada
[ ] Relatório da etapa e rollback escritos
[ ] PR draft revisável
[ ] Aprovação explícita para próxima etapa
