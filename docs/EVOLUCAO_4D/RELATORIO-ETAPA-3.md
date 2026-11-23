# STRATUM 4D — Etapa 3 — Árvore IFC, seleção e visibilidade

Implementação a partir de `b6b46df0ac88af7244e52bb638de6e311b14923b` na branch `feature/evolucao-stratus-4d`.

## Uso na obra

1. Abra **Árvore IFC** na barra do modo 4D. Expanda o IFC desejado e navegue pela estrutura gravada pelo exportador, pelas categorias e pelos elementos. A busca aceita nome, classe IFC, GlobalId, etiqueta e nome de sistema. O filtro de sistema aparece quando o arquivo declara a relação com o elemento. Um IFC sem estrutura espacial aparece em **Sem hierarquia IFC informada**.
2. Clique em uma peça ou em um grupo. Use **Ctrl + clique** para acrescentar ou retirar itens da seleção. A seleção de uma peça no 3D abre seu ramo na árvore, quando a busca e o filtro estiverem livres. O botão direito permite enquadrar, selecionar semelhantes por ramo, classe ou sistema, consultar propriedades e seguir para o painel existente de vínculo.
3. Use o olho do arquivo, da categoria ou do elemento. **Ocultar seleção** esconde os itens selecionados. **Isolar** exibe somente a seleção permitida. **Ghost** destaca a seleção e torna translúcidas as demais peças visíveis. O controle de opacidade limita o quanto essas peças podem aparecer.
4. **Mostrar todos** limpa as ocultações de elementos e categorias, o isolamento e o Ghost manual. Use **Reativar modelos** ou o olho do arquivo para voltar a incluir um modelo desligado. O histórico **Desfazer visibilidade** e **Refazer visibilidade** acompanha as mudanças na obra ativa.

Na árvore, as setas navegam e expandem os ramos. **Enter** ou **Espaço** seleciona, **V** alterna o olho, **H** oculta, **I** isola, **G** ativa Ghost, **Esc** limpa a seleção e **Shift + F10** abre o menu. O Gantt permanece disponível logo abaixo.

## Regras da vista

| Ação ou estado | Resultado |
| --- | --- |
| Modelo, categoria ou peça com olho desligado | O elemento permanece oculto mesmo quando selecionado, isolado, destacado ou presente na data simulada. |
| Playback, prévia de animação e vídeo | A visibilidade manual continua aplicada conforme a vista ativa e o cronograma controla quando cada elemento pode aparecer. A seleção em pausa continua permitindo inspecionar peças antes da sua etapa quando a visibilidade manual permite. |
| Isolamento e Ghost manual | Alternar entre os modos troca o efeito. Um elemento de fundo do Ghost fica fora da seleção por clique no 3D. O foco do recurso Teardown volta ao limpar o Ghost manual. |
| Persistência | A visibilidade acompanha o projeto e pode ser registrada em pontos de vista e quadros de exibição. O manifesto v4 aceita os campos opcionais e as versões antigas abrem com os valores padrão. Vínculos, cronograma e GlobalIds continuam separados do estado visual. |

## Verificação

- `npm run build` passou com a checagem de tipos. A suíte passou com 308 testes em 50 arquivos, incluindo seis cenários novos de hierarquia e precedência de visibilidade. Cinco testes condicionais foram pulados.
- `tests/navigation.browser.mjs` verificou seleção de objetos no WebGL, transparência, ocultação, isolamento, modelo e categoria desligados, seleção em pausa, simulação em reprodução, prévia de animação e retorno do foco do Teardown. O roteiro também verificou câmera, corte, movimento e renderização.
- `tests/projects.browser.mjs` verificou no Edge e no build compilado a estrutura do IFC, o filtro por sistema, dois modelos com o mesmo GlobalId, seleção bidirecional por clique, seleção múltipla, menu, histórico e persistência de visibilidade. O roteiro também verificou importação de XML e XER, revisão de IFC e cronograma, reabertura, restauração, migração v2, 31 PNGs de 1280 × 720 e geração de WebM.
- O teste opcional `STRATUM_BIG_IFC` usa o IFC sintético de 4.000 paredes da Etapa 0. Ele verifica a busca, a seleção da última linha pelo teclado e a quantidade de linhas montadas na tela. A execução do build montou 22 linhas ao percorrer o resultado. O ensaio usa WebGL por software. O resultado depende do arquivo, do hardware e do navegador.

## Rollback

O manifesto mantém a versão v4. Um build anterior abre a obra com modelos, cronograma e vínculos, aplicando as regras visuais daquela versão. Para recuperar também a visibilidade registrada nesta etapa, preserve o projeto original junto com esta versão do aplicativo.
