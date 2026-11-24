# STRATUM 4D — Etapa 2 — Câmera, órbita e interface em português

Implementação a partir de `30a63aae59af15ef8890af66038f4a11668119fa` na branch `feature/evolucao-stratus-4d`. A versão original em português estava no diretório de trabalho da instância anterior. A instância de testes vinha executando o código da branch de evolução. As duas versões foram comparadas a partir da base comum.

## O que mudou

| Fluxo | Resultado |
| --- | --- |
| Seleção única e múltipla | A órbita passa pelo centro dos limites em coordenadas de cena da seleção. Uma rotação relativa ao pivô preserva a pose e o enquadramento da câmera quando a seleção muda. |
| Clique no vazio | O pivô volta ao centro de referência do modelo. Arrastar, deslocar a vista ou usar o botão direito não limpa a seleção. |
| Enquadrar e reorientar | Enquadrar seleção, enquadrar tudo, vistas por direção e redefinição isométrica. O movimento manual interrompe a transição da câmera. |
| Corte, movimento e explosão | O enquadramento considera os objetos visíveis, suas posições atuais, segmentos e planos de seção. Objetos cortados pelo plano já não são atingidos por um clique naquela região. |
| Pontos de vista e animação | Posições salvas podem registrar também a orientação relativa ao pivô. A interpolação trata vistas antigas como câmeras orientadas ao próprio pivô. Imagens e vídeo continuam capturando a câmera e os cortes da animação. |
| Português | A interface anterior foi incorporada com revisão dos conflitos em arquivos compartilhados. O código novo de projetos, federação, versões e restauração continua sendo o da branch de evolução. Perfis padrão em arquivos antigos recebem os rótulos em português quando identificados por seu ID e nome original. Nomes personalizados são preservados. |
| Opções de apresentação | Foram integradas as opções que já existiam na versão local, incluindo grade, céu, sol e exportação leve ou em modo apresentação. A instalação continua com a aparência técnica como padrão. |

As cópias do código e as bibliotecas do navegador têm escopos diferentes. Os projetos e os IFCs locais continuam associados ao navegador e ao endereço usados para salvá-los. O formato de projeto aceita o manifesto da versão em português anterior e a versão v4 usada em projetos e revisões.

## Verificação

- **Matemática da câmera.** Testes de troca repetida de pivô avaliam posição, rotação e ponto alvo separadamente. O caso usa coordenadas da ordem de milhões de unidades. Outro teste verifica que um quadro antigo e um quadro com a orientação adicionada interpolam suavemente.
- **Navegador e renderização.** O roteiro `tests/navigation.browser.mjs` simula gestos de mouse, seleção simples e múltipla, limpeza, câmera em movimento, enquadramento sem o objeto oculto, explosão, corte e exportação de imagem após restaurar a mesma vista. A conferência de imagem compara os pixels codificados em resolução fixa.
- **Regressão de projetos.** O roteiro `tests/projects.browser.mjs` usa a interface em português para manipular duas obras, importar XML e XER, salvar uma vista, revisar IFC, remapear GlobalId, reabrir, restaurar e migrar um manifesto v2. O roteiro inclui o caminho de exportação de imagem e vídeo.
- **Amostras.** Usamos IFCs e cronogramas sintéticos. O WebGL dos testes automatizados roda por software no Edge headless. As verificações não medem fluidez em um IFC real de grande porte nem entregam o controle temporal de vídeo da Etapa 6.

O build web e a verificação de tipos passaram. A suíte terminou com 302 testes aprovados em 49 arquivos e cinco testes condicionais pulados. A regressão do navegador passou na versão compilada em português. Ela verificou 31 quadros PNG em 1280 × 720, quadros distintos no início e no fim e a geração de um WebM. Os testes de navegação do visualizador também passaram, incluindo a interrupção de uma transição pelo mouse.

## Rollback

O commit da Etapa 2 pode ser revertido na branch de evolução sem sobrescrever o diretório da versão original. Os projetos mantêm o formato v4. Ao usar um build anterior, o enquadramento das vistas que possuíam uma orientação relativa ao pivô pode diferir. Guarde o build atual para reproduzir essas vistas.
