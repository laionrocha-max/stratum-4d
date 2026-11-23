export function Help({ onClose, onDemo }: { onClose: () => void; onDemo: () => void }) {
  return (
    <div className="help-backdrop" onClick={onClose}>
      <div className="help" role="dialog" aria-label="Primeiros passos" onClick={(e) => e.stopPropagation()}>
        <img src="./stratum-lockup.png" alt="Stratum 4D da Miqyas Labs" className="help-logo logo-light" />
        <img src="./stratum-lockup-dark.png" alt="" aria-hidden className="help-logo logo-dark" />
        <h2>Primeiros passos</h2>
        <p className="muted">Monte uma simulação 4D em quatro etapas a partir de um cronograma e de um modelo.</p>
        <ol>
          <li>
            <b>Importe o cronograma.</b> Exporte o projeto do Primavera P6 em XER ou do Microsoft Project em XML. O Stratum lê a EAP, as atividades, as dependências, os códigos, os dados realizados e as datas da linha de base.
          </li>
          <li>
            <b>Importe o modelo.</b> Exporte o modelo do Revit, Archicad, Tekla ou de outro programa em IFC2x3 ou IFC4. Você também pode importar glTF, GLB, OBJ, STL e FBX, com os nomes e as propriedades personalizadas.
          </li>
          <li>
            <b>Crie os vínculos.</b> Para criar vínculos automaticamente, use <i>Regras → Localizar propriedades correspondentes</i>. O Stratum procura propriedades do modelo que já contêm IDs ou códigos de atividade. Para vincular manualmente, selecione elementos no modelo 3D ou use <i>Seleção → Selecionar por propriedade</i>. Em seguida, escolha uma atividade no Gantt, selecione um perfil e clique em <i>Vincular</i>.
          </li>
          <li>
            <b>Reproduza e confira.</b> Clique em Reproduzir. A aba <i>Verificação</i> lista atividades sem vínculo, elementos que não aparecem na simulação e vínculos quebrados.
          </li>
        </ol>
        <h3>Planejamento no Stratum</h3>
        <p>
          Selecione uma atividade e abra a aba <i>Tarefa</i> para editar durações, dependências, restrições, avanço e recursos, ou adicionar atividades. Pressione <kbd>F9</kbd> para recalcular o caminho crítico, as datas tardias e as folgas. <i>Exportar → P6 XER</i> gera um arquivo para o Primavera. A opção <i>CSV</i> gera um arquivo para o Excel.
        </p>
        <p>
          <i>Custos e valor agregado</i> mostra o valor agregado e as curvas S. <i>Recursos</i> exibe o histograma semanal. <i>Quantitativos</i> usa dados do modelo para mostrar o que foi instalado até a data da simulação. Na aba <i>Ferramentas</i> você pode agrupar elementos, dividir lajes e paredes em etapas de concretagem e simular o deslocamento de equipamentos.
        </p>
        <h3>Atualizações semanais</h3>
        <p>
          Com o projeto aberto, importe o novo XER e escolha <i>Atualizar</i>. Os vínculos são preservados pelo ID da atividade. A aba <i>Verificação</i> mostra alterações na data de término e na situação das atividades, além de novas atividades que precisam de vínculos.
        </p>
        <h3>Salvamento automático</h3>
        <p>
          O navegador salva os vínculos, as regras e os perfis periodicamente. Use <i>Salvar arquivo de projeto</i> para guardar uma cópia ou compartilhar o projeto.
        </p>
        <h3>Atalhos de teclado</h3>
        <table>
          <tbody>
            <tr><td><kbd>Espaço</kbd></td><td>Reproduzir ou pausar</td></tr>
            <tr><td><kbd>←</kbd> <kbd>→</kbd></td><td>Avançar ou voltar um dia</td></tr>
            <tr><td><kbd>Turno</kbd> + <kbd>←</kbd> <kbd>→</kbd></td><td>Avançar ou voltar uma semana</td></tr>
            <tr><td><kbd>Home</kbd> / <kbd>End</kbd></td><td>Ir ao início ou ao fim do cronograma</td></tr>
            <tr><td>Clique ou <kbd>Turno</kbd>+ clique na vista 3D</td><td>Selecionar ou ampliar a seleção</td></tr>
            <tr><td><kbd>Alt</kbd>+ clique em uma atividade</td><td>Selecionar os elementos vinculados</td></tr>
            <tr><td>Double+ clique em uma atividade</td><td>Ir ao início da atividade na linha do tempo</td></tr>
            <tr><td><kbd>F9</kbd></td><td>Calcular o caminho crítico</td></tr>
            <tr><td><kbd>Esc</kbd></td><td>Cancelar o desenho do trajeto ou fechar a ajuda</td></tr>
            <tr><td><kbd>?</kbd></td><td>Abrir esta ajuda</td></tr>
          </tbody>
        </table>
        <p className="credit brand-credit">
          <img src="./miqyas-labs.png" alt="Miqyas Labs" className="logo-light" />
          <img src="./miqyas-labs-dark.png" alt="" aria-hidden className="logo-dark" />
          <span>
            Stratum 4D da <b>Miqyas Labs</b>, desenvolvido por <b>Junaid Quamar</b>, engenheiro sênior de planejamento.{" "}
          </span>
          <a href="https://www.linkedin.com/in/junaidquamar/" target="_blank" rel="noreferrer">
            LinkedIn
          </a>
        </p>
        <div className="row" style={{ marginTop: 16, justifyContent: "flex-end" }}>
          <button onClick={onDemo}>Experimentar a demonstração</button>
          <button className="primary" onClick={onClose}>Fechar</button>
        </div>
      </div>
    </div>
  );
}
