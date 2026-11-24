# STRATUM 4D — Etapa 1 — Projetos independentes

Base de implementação `c7ae87a37b720dc7bd498e99e5c1335c02a4a288`, na branch `feature/evolucao-stratus-4d`. A versão final está no histórico do PR.

## Comportamento entregue

- **Projetos** reúne criação, busca, abertura, salvamento, duplicação, renomeação, arquivamento e exclusão da biblioteca. A exclusão pede confirmação e preserva os arquivos IFC originais. Se a biblioteca já tem obras, o modo 4D oferece a lista na abertura.
- **Modelos** adiciona arquivos à obra ativa e indica quais foram carregados. Dois IFCs podem conter o mesmo GlobalId sem misturar seleção e vínculos. IFCs adicionais usam a transformação compartilhada do primeiro IFC carregado. Uma revisão deve ser exportada nas coordenadas compatíveis com a federação.
- A troca de obra monta a nova cena a partir dos arquivos da própria obra. A troca repõe cronograma, vínculos, grupos, segmentos, regras, perfis, data e vistas. Seleção, filtros temporários, reprodução, caminhos em edição e estado da câmera anterior são descartados. Resultados atrasados de uma importação anterior não são aplicados à obra recém-aberta.
- A prévia de substituição de IFC mostra os identificadores compatíveis, os novos elementos e o impacto nos vínculos e demais referências. Cancelar ou carregar um IFC inválido preserva a versão anterior. IDs estáveis são mantidos. Express IDs sem GlobalId não são considerados identidade estável entre revisões. Um arquivo com GlobalIds duplicados é rejeitado.
- Projetos legados mantêm suas referências. Para completar a migração, **Modelos → Localizar arquivo** pede o IFC original e indica quantos vínculos correspondem aos IDs encontrados. Quando existe hash no manifesto, o arquivo precisa corresponder à revisão salva.
- O modo P6 conserva a abertura de múltiplos cronogramas como ação explícita. O salvamento combinado atualiza o cronograma de cada obra e conserva seu manifesto. Importar a revisão de um cronograma com código de atividade duplicado é bloqueado antes de transferir vínculos.

## Persistência e limites

O formato v3 guarda a identidade da obra, os IDs imutáveis dos modelos, hash SHA-256, tamanho, revisão e transformação IFC. Os bytes são guardados por hash no IndexedDB da instalação. Projetos duplicados reutilizam esses bytes. A geometria Three.js é reconstruída. O JSON do projeto guarda o manifesto e os dados de planejamento.

O armazenamento é local ao perfil e ao endereço do aplicativo. No Electron, fica no perfil da instalação. Em outro computador, perfil ou endereço, é preciso localizar os arquivos originais uma vez. Na versão com servidor, o banco guarda os manifestos, e os binários continuam locais. Falta um armazenamento de IFC compartilhado pelo servidor. Se o armazenamento local recusar um arquivo, o aplicativo exibe a falha e permite trabalhar na sessão com o original disponível para relocalizar.

O desenho mantém a câmera e as vistas da obra ao substituir a revisão IFC. A prévia atual compara identidade e referências. Histórico navegável e rollback de revisões já confirmadas, diferença detalhada de geometria e transformação e o fluxo completo de atualização XML/XER com baseline pertencem ao adendo de revisões.

## Validação

Foi usado o Edge headless com SwiftShader, Node 22 e arquivos sintéticos. O IFC de sala veio da coleção sintética do OpenBIMStudio. O teste cria variações independentes para exercitar IDs repetidos entre modelos e um arquivo inválido com duplicidade interna.

| Cenário | Resultado |
| --- | --- |
| IFC antes do XML do Project | O cronograma foi importado mantendo o IFC. Quatro paredes foram vinculadas pelo fluxo da interface. |
| Federação | Dois arquivos com GlobalIds iguais receberam namespaces distintos. Os quatro vínculos ficaram restritos ao modelo da arquitetura. |
| Revisão | IFC com ID duplicado foi rejeitado. Cancelar a troca preservou o manifesto anterior. Confirmar uma revisão com os mesmos GlobalIds manteve todos os vínculos e o ID do modelo. |
| Duas obras | Uma obra com dois modelos, Project XML e quatro vínculos e outra com um modelo e XER foram salvas. Após fechar a página, abrir A e B recuperou os respectivos arquivos, cronogramas, vínculos e câmera. |
| Biblioteca | Duplicar, arquivar e excluir a cópia preservou a obra original. |
| Projeto v2 | Em perfil separado, o projeto indicou o IFC pendente. Localizar o original recuperou os vínculos com IDs legados. O projeto voltou a salvar em v3. |
| SQLite | Dois salvamentos concorrentes da mesma versão produziram um vencedor e um conflito. O arquivo em disco conservou o manifesto, o nome e o arquivamento ao reabrir. Exclusão não permitiu recriar a obra com versão antiga. |

Para repetir os fluxos no navegador, executar `node tests/projects.browser.mjs` com Chromium do Playwright ou apontar `STRATUM_BROWSER` para um Chromium local. O ensaio usa a porta 5191 e um perfil descartável. Para testar o build, definir também `STRATUM_TEST_BUILD=1` após compilar.

## Verificação geral e rollback

- `npm run build` concluiu a verificação de tipos e a compilação web.
- A suíte final, executada com `npm test -- --maxWorkers=1 --minWorkers=1`, aprovou 291 testes em 46 arquivos e pulou cinco testes condicionais. Foi necessário completar a cópia do WASM do MCP no Windows, como na Etapa 0. Uma execução anterior junto ao build e ao navegador excedeu o limiar de 500 ms do teste temporal de 50 mil elementos. O mesmo teste passou na suíte final.
- O ensaio de interface passou em Vite dev. A versão compilada também foi iniciada em uma porta local separada e respondeu com HTTP 200. Os testes locais não exercitaram um Primavera conectado, um banco PostgreSQL real ou o instalador desktop.

O caminho de rollback mantém arquivos v1/v2 e a exportação anterior disponíveis. Antes de voltar à aplicação antiga, guarde uma cópia dos projetos v3 e dos IFCs originais. A aplicação antiga abre os manifestos v1/v2. O relatório e o código podem ser revertidos na branch de evolução sem alterar a biblioteca da sessão original. Os testes foram executados em perfis separados.
