// Training lessons. Each step explains one idea, points at the part of the
// screen it is about, and (where it makes sense) asks the learner to do it,
// ticking off by itself when the app's state shows it is done.
//
// The lessons use the 220 kV GIS substation sample, so every number the
// learner reads matches the screen. Values are read live from the schedule.

import { useConfig } from "../../backend/config";
import { useStore, fmtDate } from "../store";
import { useMsp } from "../msp/state";
import { $, byText, click, row, setValue, wait, type Ctx, type Lesson } from "./engine";

const hpd = (c: Ctx) => c.s.schedule?.calendars?.find((x) => x.id === c.s.schedule?.defaultCalendarId)?.hoursPerDay ?? 8;
const d = (c: Ctx, h: number | null | undefined) => (h == null ? "–" : `${Math.round((h / hpd(c)) * 10) / 10} d`);
const tab = (label: string) => () => byText(".p6-tabs button", label, true);
const tabOn = (label: string) => !!tab(label)()?.classList.contains("active");
const rail = (label: string) => () => byText(".p6-rail button", label, true);
/** What the P6 lower pane shows (the list at its top left). */
const lowerView = () => ($(".p6-lowersel") as HTMLSelectElement | null)?.value ?? "";
const pick = async (code: string) => {
  setValue(".p6-find", code);
  await wait(300);
  click(row(code));
  await wait(200);
};
const findCleared = (c: Ctx) => c.s.ganttFilter.text === "";

export const COURSES = ["Primeiros passos", "Prática de planejamento", "Controle de projetos", "4D e relatórios"];

export const LESSONS: Lesson[] = [
  // ==================================================================
  {
    id: "tour",
    course: "Primeiros passos",
    title: "Conhecendo o aplicativo",
    minutes: 6,
    level: "Beginner",
    summary: "Conheça o layout P6, a data de corte, as barras Diretório e Comandos e a leitura do gráfico de Gantt.",
    learn: ["Alternar entre layouts", "Localizar a data de corte", "Ler a tabela de atividades e as barras", "Recolher grupos da EAP"],
    needs: { mode: "p6", sample: true },
    steps: [
      {
        title: "Bem-vindo ao treinamento",
        body: () => (
          <>
            <p>Cada lição é um exercício rápido no próprio aplicativo. O cartão explica uma ideia de cada vez e destaca a área correspondente na tela.</p>
            <p>
              Quando a etapa mostrar <b>Sua vez</b>, faça o exercício. O cartão avança ao reconhecer a mudança. Se precisar de ajuda, clique em <b>Mostrar como fazer</b> para executar a etapa automaticamente.
            </p>
            <p>O exemplo é uma subestação GIS de 220/33 kV em Abu Dhabi. O cronograma inclui engenharia, suprimentos e construção de um edifício GIS com nove baias, dois transformadores de potência e um edifício de controle.</p>
          </>
        ),
      },
      {
        title: "Três layouts e a área de relatórios",
        target: ".mode-switch",
        body: () => (
          <>
            <p>Use o seletor para mudar o layout do mesmo projeto. <b>P6</b> segue o estilo do Primavera P6 Professional, <b>Projeto</b> segue o do Microsoft Project e <b>4D</b> reúne o modelo 3D e os controles de reprodução. <b>Relatórios</b> abre o editor de painéis.</p>
            <p>Use o layout que sua equipe conhece. O fluxo é o mesmo e a terminologia varia. O P6 usa <i>atividade</i> e <i>data de corte</i>. O Microsoft Project usa <i>tarefa</i> e <i>data de status</i>.</p>
          </>
        ),
      },
      {
        title: "Data de corte",
        target: ".p6-status",
        body: (c) => (
          <>
            <p>
              A barra de status mostra a <b>data de corte</b>: <b>{fmtDate(c.s.schedule?.dataDate ?? null)}</b>. Essa data separa o avanço registrado da previsão para o trabalho restante.
            </p>
            <p>A cada atualização, normalmente semanal ou mensal, registre o avanço até uma nova data de corte e recalcule o cronograma. O trabalho restante é programado a partir dessa data.</p>
          </>
        ),
      },
      {
        title: "Barra Diretório (à esquerda)",
        target: ".p6-rail-left",
        body: () => (
          <>
            <p>Como no P6, a barra à esquerda indica <i>onde consultar os dados</i>. Cada botão abre uma vista:</p>
            <ul>
              <li>
                <b>Projetos</b>, <b>Recursos</b>, <b>Relatórios</b> e <b>Acompanhamento</b>: lista de projetos, cadastro de recursos e painéis de acompanhamento.
              </li>
              <li>
                <b>EAP</b>, <b>Atividades</b> e <b>Atribuições</b>: edição da estrutura analítica do projeto, das atividades e das atribuições de recursos.
              </li>
              <li>
                <b>Entregáveis e documentos</b>, <b>Despesas</b>, <b>Limites</b>, <b>Pendências</b> e <b>Riscos</b>: registros do projeto.
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "Barra Comandos (à direita)",
        target: ".p6-rail-right",
        body: () => (
          <>
            <p>A barra à direita mostra <i>as ações disponíveis</i> para a vista atual. Você pode adicionar, excluir, recortar, copiar, colar, renumerar e vincular atividades, atribuir recursos e códigos, expandir ou recolher a EAP, usar <b>Calcular cronograma (F9)</b> e <b>Salvar</b>. Os mesmos comandos aparecem ao clicar com o botão direito na tabela.</p>
            <p>A maioria dos comandos tem um atalho de teclado. Passe o mouse sobre o botão para vê-lo.</p>
          </>
        ),
      },
      {
        title: "Como ler a tabela de atividades",
        target: ".gantt-cols",
        body: () => (
          <>
            <p>O layout clássico do P6 inclui estas colunas:</p>
            <ul>
              <li>
                <b>ID da atividade</b> e <b>Nome</b>: código exclusivo e descrição da atividade.
              </li>
              <li>
                <b>Duração original</b>: quantidade de dias úteis planejados. <b>Duração restante</b>: dias úteis que ainda faltam.
              </li>
              <li>
                <b>% concluído do cronograma</b>: medida do avanço da atividade.
              </li>
              <li>
                <b>Início</b> e <b>Término</b>: datas reais quando disponíveis (marcadas com <b>A</b>) ou datas previstas.
              </li>
              <li>
                <b>Folga total</b>: dias de atraso que a atividade pode absorver antes de adiar o término do projeto. Uma folga igual a zero ou negativa indica atividade crítica.
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "Como ler as barras",
        target: ".gantt-body",
        body: () => (
          <>
            <p>
              Cada barra vai do início ao término da atividade. O trecho <b style={{ color: "#2f6fd0" }}>azul</b> representa o trabalho realizado até a data de corte. O trecho <b style={{ color: "#3c9a3c" }}>verde</b> representa o trabalho restante. O trecho <b style={{ color: "#d03b3b" }}>vermelho</b> representa o trabalho restante no caminho crítico. Os losangos indicam marcos, eventos sem duração como a <i>energização em 220 kV</i>.
            </p>
            <p>A linha vertical tracejada é a data de corte. As linhas sombreadas agrupam as atividades por item da EAP.</p>
          </>
        ),
      },
      {
        title: "Recolher um grupo da EAP",
        target: ".gantt-row.wbs",
        task: "Clique em qualquer linha sombreada da EAP para recolher o grupo.",
        done: (c) => c.s.collapsedWbs.size > 0,
        showMe: () => void click(".gantt-row.wbs"),
        body: () => (
          <>
            <p>The <b>estrutura analítica do projeto</b> (EAP) divide o projeto em entregas. Neste exemplo, as áreas são Geral, Engenharia, Suprimentos e Construção. A construção se divide em obras civis, instalação e comissionamento.</p>
            <p>Ao recolher um grupo, o Gantt mostra uma única barra-resumo para ele. Expanda o grupo para consultar as atividades individuais.</p>
          </>
        ),
      },
      {
        title: "Expandir o grupo novamente",
        target: () => rail("Expandir tudo")(),
        task: "Clique em Expandir tudo na barra Comandos ou clique novamente na linha do grupo.",
        done: (c) => c.s.collapsedWbs.size === 0,
        showMe: () => void click(rail("Expandir tudo")),
        body: () => <p>Os comandos Expandir tudo e Recolher tudo agem em todos os grupos. Recolher os grupos mostra um resumo do projeto por itens da EAP.</p>,
      },
      {
        title: "Confira seu entendimento",
        body: () => <p>Responda antes de continuar.</p>,
        quiz: {
          q: "O que significa uma barra de atividade metade azul e metade vermelha?",
          options: ["A atividade foi concluída com atraso", "A atividade começou e o trabalho restante está no caminho crítico", "A atividade ainda não começou e tem folga", "É um marco"],
          answer: 1,
          explain: "O azul indica trabalho realizado antes da data de corte. O restante em vermelho está no caminho crítico, portanto um atraso nessa atividade adia o término do projeto.",
        },
      },
    ],
  },

  // ==================================================================
  {
    id: "activity",
    course: "Primeiros passos",
    title: "Como ler uma atividade",
    minutes: 6,
    level: "Beginner",
    summary: "Localize uma atividade e confira o tipo, a EAP, as durações, as datas e as dependências.",
    learn: ["Find by ID", "Use the detail tabs", "Predecessors and successors", "Relationship types and lag"],
    needs: { mode: "p6", sample: true },
    steps: [
      {
        title: "Localize uma atividade",
        target: ".p6-find",
        task: "Digite C-5000 no campo de busca.",
        done: (c) => c.s.ganttFilter.text.toLowerCase().includes("c-5000"),
        showMe: () => void setValue(".p6-find", "C-5000"),
        body: () => <p>Big schedules run to thousands of activities. The find box filters the table by ID or name as you type. In P6 itself this is Ctrl+F, which works here too.</p>,
      },
      {
        title: "Selecione a atividade",
        target: row("C-5000"),
        task: "Clique na linha C-5000.",
        done: (c) => c.sel()?.code === "C-5000",
        showMe: () => void click(row("C-5000")),
        body: () => <p>Selecting an activity fills the lower pane with its details, just as in P6.</p>,
      },
      {
        title: "Aba Geral",
        target: ".p6-lower",
        enter: () => void click(tab("Geral")),
        body: (c) => (
          <>
            <p>
              <b>{c.sel()?.code}</b> {c.sel()?.name}. The General tab holds what the activity <i>is</i>:
            </p>
            <ul>
              <li>
                <b>Tipo</b>: task dependent (uses its own calendar), resource dependent, level of effort (spans other work, such as site supervision), or start/finish milestone.
              </li>
              <li>
                <b>EAP</b>: where it sits in the breakdown.
              </li>
              <li>
                <b>Calendário</b>: working days and hours. This project works a UAE week, Monday to Saturday.
              </li>
            </ul>
          </>
        ),
      },
      {
        title: "Abra a aba Situação",
        target: tab("Situação"),
        task: "Clique na aba Situação.",
        done: () => tabOn("Situação"),
        showMe: () => void click(tab("Situação")),
        body: () => <p>The Status tab is where progress is recorded each update.</p>,
      },
      {
        title: "Durações e avanço",
        target: ".p6-lowerbody",
        body: (c) => {
          const a = c.sel();
          return (
            <>
              <p>
                For {a?.code}: original duration <b>{d(c, a?.originalDurationHours)}</b>, remaining <b>{d(c, a?.remainingDurationHours)}</b>, <b>{a?.percentComplete}%</b> complete, actual start <b>{fmtDate(a?.actualStart ?? null)}</b>.
              </p>
              <ul>
                <li>
                  <b>Duração original</b> is the plan. It does not change during the job.
                </li>
                <li>
                  <b>Remaining duration</b> is the planner's honest estimate of what is left. It drives the forecast finish.
                </li>
                <li>
                  <b>% concluído</b> measures progress; with costs loaded it also drives earned value.
                </li>
              </ul>
              <p>Below that, the dates table shows early, late and baseline dates and the total and free float.</p>
            </>
          );
        },
      },
      {
        title: "Predecessoras",
        target: tab("Predecessoras"),
        task: "Clique na aba Predecessoras.",
        done: () => tabOn("Predecessoras"),
        showMe: () => void click(tab("Predecessoras")),
        body: () => <p>Predecessors are the activities that must happen before this one can start or finish. They are the logic that turns a list of tasks into a schedule.</p>,
      },
      {
        title: "Tipos de dependência",
        target: ".p6-lowerbody",
        body: () => (
          <>
            <ul>
              <li>
                <b>FS, finish to start</b>: B starts after A finishes. By far the most common.
              </li>
              <li>
                <b>SS, start to start</b>: B starts after A starts, e.g. cable pulling can start once trenching has started.
              </li>
              <li>
                <b>FF, finish to finish</b>: B finishes after A finishes, e.g. testing finishes after installation finishes.
              </li>
              <li>
                <b>SF, start to finish</b>: rare; avoid it.
              </li>
            </ul>
            <p>
              <b>Lag</b> adds a wait: FS + 7 days means "7 days after A finishes". Good practice is to keep logic simple, avoid long lags (model the wait as an activity instead) and give every activity at least one predecessor and one successor.
            </p>
          </>
        ),
      },
      {
        title: "Sucessoras",
        target: tab("Sucessoras"),
        task: "Clique na aba Sucessoras.",
        done: () => tabOn("Sucessoras"),
        showMe: () => void click(tab("Sucessoras")),
        body: () => <p>Successors are the activities waiting on this one. A delay here flows into each of them, unless they have float to absorb it.</p>,
      },
      {
        title: "Confira seu entendimento",
        body: () => <p>A typical site situation:</p>,
        quiz: {
          q: "Formwork can be stripped 7 days after the concrete pour finishes. How do you link Pour → Strip?",
          options: ["SS with 7 days lag", "FS with 7 days lag", "FF with no lag", "No link; add a constraint"],
          answer: 1,
          explain: "Stripping waits for the pour to finish, then 7 days of curing: finish to start with a 7-day lag. Some planners model curing as its own activity instead.",
        },
      },
      {
        title: "Limpar a busca",
        target: ".p6-find",
        task: "Limpe o campo de busca para exibir todas as atividades novamente.",
        done: findCleared,
        showMe: () => void setValue(".p6-find", ""),
        body: () => <p>Filters stay on until you clear them, in every layout.</p>,
      },
    ],
  },

  // ==================================================================
  {
    id: "cpm",
    course: "Prática de planejamento",
    title: "Caminho crítico e folgas",
    minutes: 8,
    level: "Beginner",
    summary: "Entenda como funciona o método do caminho crítico e o que significam as folgas total e livre.",
    learn: ["Forward and backward pass", "Folga total e folga livre", "Filter the critical path", "Negative float"],
    needs: { mode: "p6", sample: true },
    steps: [
      {
        title: "How CPM calculates dates",
        body: () => (
          <>
            <p>The critical path method (CPM) runs two passes over the logic:</p>
            <ul>
              <li>
                <b>Forward pass</b>: from the data date, each activity starts as early as its predecessors allow. This gives the <b>early start and early finish</b>, and the project finish.
              </li>
              <li>
                <b>Backward pass</b>: from the project finish, each activity finishes as late as its successors allow. This gives the <b>late start and late finish</b>.
              </li>
            </ul>
            <p>
              <code>Total float = late finish − early finish</code>
            </p>
            <p>Activities with zero total float form the <b>critical path</b>: the longest chain through the project. Any delay on it moves the finish date by the same amount.</p>
          </>
        ),
      },
      {
        title: "Show only critical work",
        target: ".p6-layoutbar select",
        task: "Set the Filter to Critical.",
        done: (c) => c.s.ganttFilter.kind === "critical",
        showMe: () => void setValue(".p6-layoutbar select", "critical"),
        body: () => <p>P6 has the same filter under View → Filter By. It is the quickest way to see what drives the finish date.</p>,
      },
      {
        title: "This project's critical path",
        target: ".gantt-body",
        body: (c) => {
          const crit = (c.s.schedule?.activities ?? []).filter((a) => a.critical && a.status !== "complete");
          return (
            <>
              <p>
                {crit.length} open activities are critical. The chain runs through the <b>power transformers</b>: manufacture (P-3030), factory test and delivery (P-3040), crane placing (C-4900), erection and oil filling (C-5030, C-5040), then pre-commissioning, energisation, trial operation and the taking-over certificate.
              </p>
              <p>The GIS equipment itself is not critical; it has float. Long-lead equipment driving the finish is typical for substations, which is why planners track factory dates so closely.</p>
            </>
          );
        },
      },
      {
        title: "Calcular o cronograma",
        target: () => rail("Calcular cronograma")(),
        task: "Clique em Calcular cronograma na barra Comandos ou pressione F9.",
        done: (c) => c.act("P-3040")?.lateStart != null,
        showMe: () => void click(rail("Calcular cronograma")),
        body: () => <p>Late dates and float come from the backward pass, so they only exist after scheduling. Imported projects carry P6's float; pressing F9 recalculates it here.</p>,
      },
      {
        title: "Read the float of a critical activity",
        task: "Select P-3040 and open its Status tab.",
        target: () => row("P-3040")() ?? $(".gantt-body"),
        done: (c) => c.sel()?.code === "P-3040" && tabOn("Situação"),
        showMe: async () => {
          click(row("P-3040"));
          await wait(200);
          click(tab("Situação"));
        },
        body: (c) => {
          const a = c.act("P-3040");
          return (
            <p>
              P-3040 <i>{a?.name}</i> shows a total float of <b>{d(c, a?.totalFloatHours)}</b>. In the dates table you can see its early and late dates are the same: there is no room at all.
            </p>
          );
        },
      },
      {
        title: "Folga total e folga livre",
        target: ".p6-lowerbody",
        body: () => (
          <>
            <ul>
              <li>
                <b>Folga total</b>: how far an activity can slip before the <i>project finish</i> moves.
              </li>
              <li>
                <b>Free float</b>: how far it can slip before its <i>next activity</i> moves.
              </li>
            </ul>
            <p>Free float is never more than total float. Float belongs to the path, not to one activity: if an early activity uses it, the later ones on the same path lose it.</p>
            <p>
              <b>Negative float</b> means the schedule cannot meet a constraint or deadline; the number is how many days must be recovered.
            </p>
          </>
        ),
      },
      {
        title: "Back to all activities",
        target: ".p6-layoutbar select",
        task: "Set the Filter back to All Activities.",
        done: (c) => c.s.ganttFilter.kind === "all",
        showMe: () => void setValue(".p6-layoutbar select", "all"),
        body: () => <p>Now look for activities with small float, such as C-4090 cable trenches with a few days: these are "near-critical" and can become critical after one bad week.</p>,
      },
      {
        title: "Confira seu entendimento",
        body: () => <p>Float in practice:</p>,
        quiz: {
          q: "An activity has 10 days of total float and slips by 4 days. What happens?",
          options: ["The project finish moves 4 days", "Nothing moves; its total float drops to 6 days", "The project finish moves 10 days", "It becomes critical"],
          answer: 1,
          explain: "Float absorbs the slip, so the finish holds. But that float is now used: the path has 6 days left.",
        },
      },
      {
        title: "Confira seu entendimento",
        body: () => <p>One more:</p>,
        quiz: {
          q: "What is the critical path?",
          options: ["The activities with the most cost", "The longest chain of logic through the project; zero float", "All activities that have started", "Activities with constraints"],
          answer: 1,
          explain: "The critical path is the longest path through the network. Its length sets the project duration, so its activities have no float.",
        },
      },
    ],
  },

  // ==================================================================
  {
    id: "update",
    course: "Prática de planejamento",
    title: "Atualização semanal de avanço",
    minutes: 7,
    level: "Intermediate",
    summary: "Registre o avanço de uma atividade, recalcule com F9 e veja quais datas mudaram.",
    learn: ["The update cycle", "Enter % complete and remaining", "Calcular cronograma (F9)", "Commit to the database"],
    needs: { mode: "p6", sample: true },
    steps: [
      {
        title: "The update cycle",
        body: () => (
          <>
            <p>Every update period the planner:</p>
            <ol>
              <li>collects progress from site: actual starts and finishes, % complete and the remaining time for work in hand;</li>
              <li>enters it against the new data date;</li>
              <li>reschedules (F9) so remaining work is pushed after the data date;</li>
              <li>checks the critical path and float, and compares with the baseline;</li>
              <li>reports: S-curve, look-ahead, milestones, narrative.</li>
            </ol>
            <p>You will now do steps 2 and 3 on one activity.</p>
          </>
        ),
      },
      {
        title: "Where the data date is set",
        target: ".p6-status .dd-edit",
        body: (c) => (
          <p>
            The data date sits in the status bar: <b>{fmtDate(c.s.schedule?.dataDate ?? null)}</b>. Click it to pick a new date. In a real update you move it forward first (for a weekly update, by seven days) and then enter progress up to that date. For this lesson leave it where it is. In the MS Project layout the same box is <i>Project → Status Date</i>.
          </p>
        ),
      },
      {
        title: "Select C-5000",
        target: ".p6-find",
        task: "Find and select C-5000 (220 kV GIS installation – bays 1–5).",
        done: (c) => c.sel()?.code === "C-5000",
        showMe: () => pick("C-5000"),
        enter: (c) => {
          const a = c.act("C-5000");
          c.mem.pct = a?.percentComplete;
          c.mem.finish = a?.finish;
        },
        body: () => <p>GIS installation for bays 1–5 is in progress on site.</p>,
      },
      {
        title: "Abra a aba Situação",
        target: tab("Situação"),
        task: "Clique na aba Situação.",
        done: () => tabOn("Situação"),
        showMe: () => void click(tab("Situação")),
        body: (c) => (
          <p>
            It is at <b>{String(c.mem.pct ?? c.act("C-5000")?.percentComplete)}%</b>. The site engineer reports that bays 1–5 are now 45% installed.
          </p>
        ),
      },
      {
        title: "Enter the new % complete",
        target: '.p6-lowerbody input[type="number"][max="100"]',
        task: "Set % complete to 45.",
        done: (c) => c.act("C-5000")?.percentComplete === 45,
        showMe: () => void setValue('.p6-lowerbody input[type="number"][max="100"]', "45"),
        body: () => (
          <>
            <p>
              Base % complete on something you can measure: bays installed, metres of cable pulled, tonnes of steel erected. "Looks about half done" leads to the classic 90%-complete-for-months problem.
            </p>
            <p>
              Then check <b>Remaining duration</b>: does the time left match the work left? If the crew is slower than planned, increase it; the forecast finish moves accordingly.
            </p>
          </>
        ),
      },
      {
        title: "Recalcular cronograma",
        target: () => rail("Calcular cronograma")(),
        task: "Clique em Calcular cronograma na barra Comandos ou pressione F9.",
        done: (c) => !c.s.scheduleDirty,
        showMe: () => void click(rail("Calcular cronograma")),
        body: () => <p>Editing marks the schedule as changed. Scheduling runs CPM again: forward pass, backward pass, float, critical path. Always reschedule before you report.</p>,
      },
      {
        title: "What moved",
        target: ".cl-statusbar",
        body: (c) => {
          const r = c.s.scheduleReport;
          return (
            <>
              <p>The status bar reports the result. {r ? `The project now finishes ${fmtDate(r.projectFinish ?? null)}.` : ""}</p>
              <p>
                C-5000 finishes <b>{fmtDate(c.act("C-5000")?.finish ?? null)}</b>. Its finish depends on the remaining duration, not on the % complete: % complete is a measure of progress, remaining duration is the forecast.
              </p>
            </>
          );
        },
      },
      {
        title: "Salvar a atualização",
        target: () => rail("Salvar")(),
        body: () => (
          <p>
            <b>Commit (Ctrl+S)</b> writes the project to the database so the team and the reports see it. You do not need to commit for this lesson. If you would rather not keep the change, reload the sample from the start screen or reopen the last committed version from Projects.
          </p>
        ),
      },
      {
        title: "Confira seu entendimento",
        body: () => <p>About the data date:</p>,
        quiz: {
          q: "After you reschedule, can remaining work start before the data date?",
          options: ["Yes, if the logic allows", "No; remaining work is always scheduled on or after the data date", "Only for critical activities", "Only for milestones"],
          answer: 1,
          explain: "Everything before the data date is history. CPM places all remaining work on or after it.",
        },
      },
    ],
  },

  // ==================================================================
  {
    id: "baseline",
    course: "Controle de projetos",
    title: "Linhas de base e desvios",
    minutes: 6,
    level: "Intermediate",
    summary: "Compare o cronograma atual com a linha de base. Identifique desvios e filtre atividades atrasadas.",
    learn: ["O que é uma linha de base", "Show baseline bars", "Finish variance", "Filter late activities"],
    needs: { mode: "p6", sample: true },
    steps: [
      {
        title: "O que é uma linha de base",
        body: () => (
          <>
            <p>The <b>baseline</b> is the approved plan, frozen at the start of the project (and re-baselined only with the client's agreement, for example after an approved extension of time).</p>
            <p>
              Every update is measured against it: <code>variance = current finish − baseline finish</code>. Positive means late.
            </p>
          </>
        ),
      },
      {
        title: "Mostrar as barras da linha de base",
        target: ".p6-layoutbar button.p6-blbtn",
        task: "Clique em Barras da linha de base na barra de layout.",
        done: (c) => c.s.ganttTracking,
        showMe: () => void click(".p6-layoutbar button.p6-blbtn"),
        body: () => <p>In P6 this is the baseline bar option on the Bars dialog; in MS Project it is the Tracking Gantt.</p>,
      },
      {
        title: "Reading slippage",
        target: ".gantt-body",
        body: (c) => {
          const a = c.act("P-3030");
          return (
            <>
              <p>The thin grey bar under each activity is its baseline. When the current bar ends to the right of it, the activity is late.</p>
              <p>
                Transformer manufacture P-3030 was due <b>{fmtDate(a?.baselineFinish ?? null)}</b> and now finishes <b>{fmtDate(a?.finish ?? null)}</b>. Because it is on the critical path, that slip carries through to the end of the project.
              </p>
            </>
          );
        },
      },
      {
        title: "Atrasado em relação à linha de base",
        target: ".p6-layoutbar select",
        task: "Set the Filter to Late against Baseline.",
        done: (c) => c.s.ganttFilter.kind === "late",
        showMe: () => void setValue(".p6-layoutbar select", "late"),
        body: (c) => {
          const g = c.act("G-1900");
          const v = g?.finish != null && g?.baselineFinish != null ? Math.round((g.finish - g.baselineFinish) / 86_400_000) : null;
          return (
            <p>
              These are activities forecast to finish after their baseline. The taking-over certificate G-1900 is forecast <b>{fmtDate(g?.finish ?? null)}</b> against a baseline of <b>{fmtDate(g?.baselineFinish ?? null)}</b>
              {v !== null ? `: ${v} days late` : ""}. That is the number the client will ask about first.
            </p>
          );
        },
      },
      {
        title: "Restaurar a exibição",
        target: ".p6-layoutbar",
        task: "Set the Filter back to All Activities and switch the Layout back.",
        done: (c) => c.s.ganttFilter.kind === "all" && !c.s.ganttTracking,
        showMe: async () => {
          setValue(".p6-layoutbar select", "all");
          await wait(100);
          if (useStore.getState().ganttTracking) click(".p6-layoutbar button.p6-blbtn");
        },
        body: () => <p>A delay is only half the story; the next step is to explain it (cause, responsibility, recovery). The delay analysis practices used for extension of time claims start from exactly this comparison.</p>,
      },
      {
        title: "Confira seu entendimento",
        body: () => <p>Variance:</p>,
        quiz: {
          q: "Baseline finish 31-Jul-27, forecast finish 14-Aug-27. What is the finish variance?",
          options: ["−14 days (ahead)", "+14 days (late)", "0 days", "It depends on the float"],
          answer: 1,
          explain: "Forecast minus baseline: 14 days late.",
        },
      },
    ],
  },

  // ==================================================================
  {
    id: "evm",
    course: "Controle de projetos",
    title: "Custos, recursos e valor agregado",
    minutes: 8,
    level: "Intermediate",
    summary: "Valor planejado, valor agregado e custo real, além dos índices SPI e CPI e do uso de recursos.",
    learn: ["PV, EV and AC", "SPI and CPI", "Read the cost S-curve", "Resource usage profile"],
    needs: { mode: "p6", sample: true },
    steps: [
      {
        title: "Open the Activity Usage Profile",
        target: ".p6-lowersel",
        task: "In the list at the top left of the lower pane, choose Activity Usage Profile.",
        done: () => lowerView() === "activityProfile",
        showMe: () => void setValue(".p6-lowersel", "activityProfile"),
        body: () => <p>The lower pane switches to cost over time. The example project is cost-loaded in AED: every activity has resources with rates.</p>,
      },
      {
        title: "Three numbers",
        target: ".p6-lower",
        body: () => (
          <>
            <ul>
              <li>
                <b>Planned value (PV)</b>: the budgeted cost of the work <i>scheduled</i> by the data date, according to the baseline.
              </li>
              <li>
                <b>Earned value (EV)</b>: the budgeted cost of the work <i>actually done</i>: budget × % complete.
              </li>
              <li>
                <b>Actual cost (AC)</b>: what that work really cost.
              </li>
            </ul>
            <p>The S-curve plots all three cumulatively, with the forecast to completion dashed.</p>
          </>
        ),
      },
      {
        title: "SPI and CPI",
        target: ".p6-lower",
        body: () => (
          <>
            <p>
              <code>SPI = EV ÷ PV</code> is the schedule performance index. Below 1.0 means less work has been earned than planned.
            </p>
            <p>
              <code>CPI = EV ÷ AC</code> is the cost performance index. Below 1.0 means the work done cost more than its budget.
            </p>
            <p>This project reports SPI 0.96 and CPI 0.99: slightly behind schedule, close to budget. A common rule of thumb flags anything under 0.95 for a recovery plan.</p>
            <p>
              <code>EAC = BAC ÷ CPI</code> is the simplest estimate at completion: if the cost efficiency so far continues, this is the final cost.
            </p>
          </>
        ),
      },
      {
        title: "Resource usage",
        target: ".p6-lowersel",
        task: "Now choose Resource Usage Profile in the same list.",
        done: () => lowerView() === "resourceProfile",
        showMe: () => void setValue(".p6-lowersel", "resourceProfile"),
        body: () => (
          <>
            <p>The Resource Usage Profile stacks weekly hours by resource: design engineers, civil crew, electrical technicians, OEM specialists, testing engineers and plant.</p>
            <p>Peaks show where you need the most people; if a peak is higher than the crew you can mobilise, you need to level (move non-critical work into its float) or add resources.</p>
          </>
        ),
      },
      {
        title: "Back to activity details",
        target: ".p6-lowersel",
        task: "Choose Activity Details in the list to go back.",
        done: () => lowerView() === "details",
        showMe: () => void setValue(".p6-lowersel", "details"),
        body: () => <p>The Resources detail tab of any activity shows its assignments: budgeted, actual and remaining units and cost.</p>,
      },
      {
        title: "Confira seu entendimento",
        body: () => <p>Earned value:</p>,
        quiz: {
          q: "PV = 100, EV = 90, AC = 120. Which is true?",
          options: ["Ahead of schedule and under budget", "Behind schedule (SPI 0.90) and over budget (CPI 0.75)", "On schedule, over budget", "Behind schedule, under budget"],
          answer: 1,
          explain: "SPI = 90 ÷ 100 = 0.90 and CPI = 90 ÷ 120 = 0.75. Less work done than planned, and it cost more than budgeted.",
        },
      },
    ],
  },

  // ==================================================================
  {
    id: "logic",
    course: "Prática de planejamento",
    title: "Como adicionar e vincular uma atividade",
    minutes: 8,
    level: "Intermediate",
    summary: "Adicione uma atividade, informe nome, duração e predecessoras, recalcule o cronograma e depois remova a atividade de teste.",
    learn: ["Add after the selected activity", "Durations", "Add a predecessor with lag", "Schedule and check dates", "Delete safely"],
    needs: { mode: "p6", sample: true },
    steps: [
      {
        title: "Start from C-5000",
        target: ".p6-find",
        task: "Find and select C-5000.",
        done: (c) => c.sel()?.code === "C-5000",
        showMe: () => pick("C-5000"),
        enter: (c) => {
          c.mem.ids = new Set((c.s.schedule?.activities ?? []).map((a) => a.id));
        },
        body: () => <p>You will add a short activity after GIS installation of bays 1–5: a <i>bay 1–5 punch-list walk-down</i>.</p>,
      },
      {
        title: "Add an activity",
        target: () => rail("Adicionar")(),
        task: "Click Add on the Command bar (or press Ins).",
        done: (c) => (c.s.schedule?.activities ?? []).some((a) => !(c.mem.ids as Set<string>)?.has(a.id)),
        showMe: () => void click(rail("Adicionar")),
        enter: (c) => {
          if (!c.mem.ids) c.mem.ids = new Set((c.s.schedule?.activities ?? []).map((a) => a.id));
        },
        body: () => <p>Stratum adds it after the selected activity, in the same WBS, already linked finish-to-start from C-5000, and selects it.</p>,
      },
      {
        title: "Name it",
        target: ".p6-lowerbody label.span2 input",
        task: "On the General tab, change the name to: Bays 1–5 punch-list walk-down",
        enter: () => void click(tab("Geral")),
        done: (c) => {
          const n = (c.s.schedule?.activities ?? []).find((a) => !(c.mem.ids as Set<string>)?.has(a.id));
          return !!n && n.name !== "New activity" && n.name.trim().length > 3;
        },
        showMe: () => void setValue(".p6-lowerbody label.span2 input", "Bays 1–5 punch-list walk-down"),
        body: () => <p>Write names as verb + object + location, so they read clearly on their own: "Install GIS bays 1–5", not "GIS".</p>,
      },
      {
        title: "Set the duration",
        target: tab("Situação"),
        task: "Open the Status tab and set Original duration to 3 days.",
        done: (c) => {
          const n = (c.s.schedule?.activities ?? []).find((a) => !(c.mem.ids as Set<string>)?.has(a.id));
          return !!n && Math.abs((n.originalDurationHours ?? 0) - 3 * hpd(c)) < 0.01;
        },
        showMe: async () => {
          click(tab("Situação"));
          await wait(200);
          setValue('.p6-lowerbody input[type="number"]', "3");
        },
        body: () => <p>Durations are in working days on the activity's calendar. Keep construction activities short enough to measure progress, typically no longer than two update periods.</p>,
      },
      {
        title: "Add a second predecessor",
        target: tab("Predecessoras"),
        task: "On the Predecessors tab, add C-5060 as an SS predecessor with 5 days lag, then click Add.",
        done: (c) => {
          const n = (c.s.schedule?.activities ?? []).find((a) => !(c.mem.ids as Set<string>)?.has(a.id));
          const p = c.act("C-5060");
          return !!n && !!p && (c.s.schedule?.relationships ?? []).some((r) => r.successorId === n.id && r.predecessorId === p.id);
        },
        showMe: async () => {
          click(tab("Predecessoras"));
          await wait(200);
          setValue('.p6-lowerbody input[list="activity-codes"]', "C-5060");
          const sel = $(".p6-lowerbody section .row select");
          if (sel) setValue(() => sel, "SS");
          const lag = $('.p6-lowerbody section .row input[type="number"]');
          if (lag) setValue(() => lag, "5");
          await wait(150);
          click(() => byText(".p6-lowerbody section .row button", "Adicionar", true));
        },
        body: () => (
          <p>
            The walk-down also needs the 33 kV switchgear crew, who start C-5060 first. <b>SS + 5 days</b> means it can start 5 working days after C-5060 starts. The activity now has two predecessors; CPM takes whichever drives the later date.
          </p>
        ),
      },
      {
        title: "Schedule it",
        target: () => rail("Calcular cronograma")(),
        task: "Press F9 or click Schedule.",
        done: (c) => !c.s.scheduleDirty,
        showMe: () => void click(rail("Calcular cronograma")),
        body: () => <p>Until you schedule, the new activity sits at the data date with no float.</p>,
      },
      {
        title: "Read its dates",
        target: ".p6-lower",
        enter: () => void click(tab("Situação")),
        body: (c) => {
          const n = (c.s.schedule?.activities ?? []).find((a) => !(c.mem.ids as Set<string>)?.has(a.id));
          return (
            <p>
              {n?.code} now runs <b>{fmtDate(n?.start ?? null)}</b> to <b>{fmtDate(n?.finish ?? null)}</b> with <b>{d(c, n?.totalFloatHours)}</b> total float. It has no successor, so its float runs to the project finish; in a real schedule you would link it to a successor such as GIS HV testing (C-5020) so it cannot float freely. Open ends like this are one of the first things a schedule review checks.
            </p>
          );
        },
      },
      {
        title: "Remove the practice activity",
        target: () => rail("Excluir")(),
        task: "With it selected, click Delete on the Command bar and confirm.",
        done: (c) => !(c.s.schedule?.activities ?? []).some((a) => !(c.mem.ids as Set<string>)?.has(a.id)),
        showMe: (c) => {
          const n = (c.s.schedule?.activities ?? []).find((a) => !(c.mem.ids as Set<string>)?.has(a.id));
          if (n) {
            useStore.getState().deleteActivity(n.id);
            useStore.getState().selectActivity(null);
          }
        },
        body: () => <p>Deleting removes the activity and its relationships. Reschedule afterwards (F9) so the rest of the network is recalculated.</p>,
      },
      {
        title: "Tidy up",
        target: ".p6-find",
        task: "Clear the find box and press F9.",
        done: (c) => findCleared(c) && !c.s.scheduleDirty,
        showMe: async () => {
          setValue(".p6-find", "");
          await wait(100);
          click(rail("Calcular cronograma"));
        },
        body: () => <p>That is the full cycle of building logic: add, describe, estimate, link, schedule, check.</p>,
      },
    ],
  },

  // ==================================================================
  {
    id: "msp",
    course: "Primeiros passos",
    title: "Layout do Microsoft Project",
    minutes: 5,
    level: "Beginner",
    summary: "Veja o mesmo projeto no layout do Microsoft Project e compare seus termos com os do P6.",
    learn: ["Trocar para o layout Projeto", "Faixa de opções e linha do tempo", "Gantt de acompanhamento", "Termos do P6 e do Microsoft Project"],
    needs: { sample: true },
    steps: [
      {
        title: "Abra o layout Projeto",
        target: ".mode-switch",
        task: "Clique em Projeto no seletor de layout ou pressione Ctrl+Alt+2.",
        done: (c) => c.cfg.mode === "msp",
        showMe: () => useConfig.getState().update({ mode: "msp" }),
        body: () => <p>As datas e o projeto são os mesmos. A tela agora usa o layout e os termos do Microsoft Project.</p>,
      },
      {
        title: "Faixa de opções",
        target: ".msp-tabrow",
        body: () => (
          <p>
            Faixa de opções tabs group commands as in MS Project: <b>Tarefa</b> reúne comandos de avanço e edição de tarefas. <b>Recurso</b> e <b>Relatório</b> organizam atribuições e relatórios. Em <b>Projeto</b> você encontra informações e comandos de cálculo. Em <b>Exibir</b>, acesse o Gantt, a linha do tempo e outras vistas.
          </p>
        ),
      },
      {
        title: "Linha do tempo",
        target: ".msp-tl",
        body: () => <p>A linha do tempo resume a duração do projeto, os marcos principais e a data de status. Use essa vista para ilustrar relatórios.</p>,
      },
      {
        title: "Gantt de acompanhamento",
        target: () => byText(".msp-tabrow button", "Exibir", true),
        task: "Na aba Exibir, abra Outras exibições e escolha Gantt de acompanhamento.",
        done: () => useMsp.getState().view === "tracking",
        showMe: () => {
          click(() => byText(".msp-tabrow button", "Exibir", true));
          useMsp.getState().set({ view: "tracking" });
        },
        body: () => <p>O Gantt de acompanhamento mostra a linha de base abaixo de cada tarefa e destaca as tarefas críticas em vermelho. No layout P6, o resultado equivalente aparece ao ativar as barras da linha de base.</p>,
      },
      {
        title: "Termos equivalentes",
        body: () => (
          <table className="tr-table">
            <thead>
              <tr>
                <th>Primavera P6</th>
                <th>MS Project</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Atividade</td>
                <td>Tarefa</td>
              </tr>
              <tr>
                <td>Grupo da EAP</td>
                <td>Tarefa-resumo</td>
              </tr>
              <tr>
                <td>Data de corte</td>
                <td>Data de status</td>
              </tr>
              <tr>
                <td>Folga total</td>
                <td>Folga total</td>
              </tr>
              <tr>
                <td>Calcular cronograma (F9)</td>
                <td>Calcular projeto</td>
              </tr>
              <tr>
                <td>Relação</td>
                <td>Dependência / vínculo</td>
              </tr>
              <tr>
                <td>Duração original</td>
                <td>Duração (duração da linha de base)</td>
              </tr>
              <tr>
                <td>Código da atividade</td>
                <td>Campo personalizado / código da estrutura de tópicos</td>
              </tr>
            </tbody>
          </table>
        ),
      },
      {
        title: "Voltar ao gráfico de Gantt e ao P6",
        target: ".mode-switch",
        task: "Na aba Exibir, clique em Gráfico de Gantt. Depois escolha P6 no seletor de layout.",
        done: (c) => c.cfg.mode === "p6",
        showMe: async () => {
          click(() => byText(".rb-big", "Gráfico de Gantt", true));
          await wait(150);
          useConfig.getState().update({ mode: "p6" });
        },
        body: () => <p>Você pode mudar de layout a qualquer momento. A seleção e os filtros são preservados.</p>,
      },
    ],
  },

  // ==================================================================
  {
    id: "sim4d",
    course: "4D e relatórios",
    title: "Simulação 4D",
    minutes: 7,
    level: "Intermediate",
    summary: "Reproduza o cronograma com o modelo 3D e veja o que está em execução em cada data.",
    learn: ["Mudar para o layout 4D", "Navegar pelo modelo", "Reproduzir e avançar pela linha do tempo", "Usar regras de vínculo e perfis"],
    needs: { sample: true },
    steps: [
      {
        title: "Mudar para o layout 4D",
        target: ".mode-switch",
        task: "Clique em 4D no seletor de layout ou pressione Ctrl+Alt+3.",
        done: (c) => c.cfg.mode === "4d",
        showMe: () => useConfig.getState().update({ mode: "4d" }),
        body: () => <p>O layout 4D reúne o modelo 3D, a linha do tempo e as ferramentas de vínculo. Ao associar os elementos do modelo às atividades do cronograma, você consegue visualizar como a obra evolui ao longo do tempo.</p>,
      },
      {
        title: "O modelo",
        target: ".center .viewport",
        body: () => (
          <>
            <p>
              Arraste para girar a vista, arraste com o botão direito para deslocá-la e use a roda do mouse para dar zoom. As cores seguem o <b>perfil de aparência</b> de cada atividade. Os elementos em instalação ficam verdes, os concluídos aparecem na cor original e os que ainda não começaram ficam ocultos.
            </p>
            <p>Na data de corte, o edifício da subestação já está construído, as baias aguardam os transformadores e as valas de cabos estão em execução.</p>
          </>
        ),
      },
      {
        title: "Reproduzir o cronograma",
        target: ".timeline-controls",
        task: "Clique em Reproduzir ou pressione Espaço.",
        done: (c) => c.s.playing,
        showMe: () => useStore.getState().setPlaying(true),
        body: () => <p>A reprodução avança a data e atualiza o modelo dia a dia.</p>,
      },
      {
        title: "Pausar",
        target: ".timeline-controls",
        task: "Clique novamente no botão para pausar.",
        done: (c) => !c.s.playing,
        showMe: () => useStore.getState().setPlaying(false),
        body: () => <p>Use ◀ ou ▶ para mudar um dia e ◀◀ ou ▶▶ para mudar uma semana. Você também pode usar as setas do teclado, com Shift para mudar uma semana. A lista abaixo do controle mostra as atividades em andamento na data exibida.</p>,
      },
      {
        title: "Por que usar o 4D no planejamento",
        target: ".center .viewport",
        body: () => (
          <ul>
            <li>Confira se a sequência é executável. Por exemplo, o telhado vem depois dos pilares e a passagem dos cabos vem depois da abertura das valas.</li>
            <li>Identifique conflitos de espaço, como a instalação de transformadores por uma grua de 200 t durante a construção da via de acesso.</li>
            <li>Explique o plano a clientes, equipes de campo e autoridades sem depender da leitura do gráfico de Gantt.</li>
            <li>Mostre o avanço da obra em revisões e análises de pleitos.</li>
          </ul>
        ),
      },
      {
        title: "Como vincular elementos",
        target: ".right .tabs",
        body: () => (
          <>
            <p>
              As abas à direita reúnem as ferramentas 4D. <b>Regras</b> vincula os elementos do modelo às atividades automaticamente. Por exemplo, uma regra pode procurar elementos cuja propriedade Activity seja igual ao ID da atividade. <b>Perfis</b> define como cada tipo de trabalho aparece no modelo, como instalação, demolição e obras temporárias. <b>Seleção</b> mostra os vínculos da atividade selecionada. Clique em uma atividade com Alt para selecionar seus elementos.
            </p>
            <p>No exemplo, uma única regra vincula 202 elementos.</p>
          </>
        ),
      },
      {
        title: "Voltar ao P6",
        target: ".mode-switch",
        task: "Clique em P6 no seletor de layout.",
        done: (c) => c.cfg.mode === "p6",
        showMe: () => useConfig.getState().update({ mode: "p6" }),
        body: () => <p>Por padrão, o layout 4D usa tema escuro. Os layouts P6 e Microsoft Project usam tema claro.</p>,
      },
      {
        title: "Confira seu entendimento",
        body: () => <p>4D:</p>,
        quiz: {
          q: "O que torna um modelo 3D um modelo 4D?",
          options: ["Um nível de detalhamento maior", "Os elementos são vinculados às atividades correspondentes, o que permite visualizar o modelo em diferentes datas", "O modelo inclui custos", "O modelo é exibido em realidade virtual"],
          answer: 1,
          explain: "4D combina geometria 3D e tempo. A inclusão de custos acrescentaria a quinta dimensão.",
        },
      },
    ],
  },

  // ==================================================================
  {
    id: "reports",
    course: "4D e relatórios",
    title: "Painéis e relatórios",
    minutes: 8,
    level: "Beginner",
    summary: "Crie um painel de planejamento, aplique filtros, personalize componentes e compartilhe o resultado.",
    learn: ["Open Reports", "Start from a template", "Slicers", "Customise, add and style widgets", "PDF, Excel and email"],
    needs: { sample: true },
    steps: [
      {
        title: "Open Reports",
        target: ".mode-switch",
        task: "Click Reports in the layout switch (or Ctrl+Alt+4).",
        done: (c) => c.s.view === "dashboards",
        showMe: () => useStore.getState().setView("dashboards"),
        body: () => <p>Reports is the dashboard builder. It works with whatever project is open, or with any project saved in the database.</p>,
      },
      {
        title: "Start from a template",
        target: () => byText(".dash-new", "Painel de planejamento"),
        task: "Em Novo, clique em Painel de planejamento.",
        done: () => !!$(".widget.kind-gauge"),
        showMe: () => void click(() => byText(".dash-new", "Painel de planejamento")),
        body: () => <p>Templates give you a complete dashboard to adapt. This one has the views planners most often share every week.</p>,
      },
      {
        title: "Gauges",
        target: ".widget.kind-gauge",
        body: () => (
          <p>
            The SPI and CPI gauges have red, amber and green bands. Here both sit in amber, between 0.90 and 1.00. The physical progress gauge compares actual % with the baseline plan %. You set the band limits per widget.
          </p>
        ),
      },
      {
        title: "Use a slicer",
        target: ".widget.kind-slicer",
        task: "Click Procurement in the Discipline slicer.",
        done: () => !!$(".slicer button.on"),
        showMe: () => void click(() => byText(".slicer button", "Procurement", true)),
        body: () => <p>Slicers filter every widget on the dashboard at once. The bars, donuts and tables now show procurement only.</p>,
      },
      {
        title: "Clear the filter",
        target: () => byText(".dash-bar button", "Limpar filtros"),
        task: "Click Clear filters in the bar at the top.",
        done: () => !$(".slicer button.on"),
        showMe: () => void click(() => byText(".dash-bar button", "Limpar filtros")),
        body: () => <p>Slicer choices are saved with the dashboard, so clear them before you send a report you want to show the whole project.</p>,
      },
      {
        title: "Select a widget",
        target: ".widget.kind-groupbars",
        task: "The dashboard is in Customise mode. Click the 'Plan vs actual by discipline' card.",
        done: () => !!$(".widget.selected"),
        enter: () => {
          if (!$(".inspector")) click(() => byText(".dash-bar button", "Personalizar"));
        },
        showMe: () => void click(".widget.kind-groupbars"),
        body: () => (
          <p>
            In Customise mode, clicking a card opens its settings on the right: <b>Dados</b> (what it shows), <b>Aparência</b> (how it looks) and <b>Filtro</b> (which part of the project). Drag a card by its title to move it; drag its bottom-right corner to resize.
          </p>
        ),
      },
      {
        title: "Change its look",
        target: () => byText(".inspector .tabs button", "Aparência", true),
        task: "Open the Look tab and choose the Filled title bar.",
        done: () => !!$(".widget.selected.head-filled"),
        showMe: async () => {
          click(() => byText(".inspector .tabs button", "Aparência", true));
          await wait(150);
          click(() => byText(".inspector .seg button", "Preenchida", true));
        },
        body: () => <p>Colours, card style, text size and which chart series show are all here. Page-wide settings (theme, logo, header, footer, PDF orientation) are under Add / Page → Page &amp; theme.</p>,
      },
      {
        title: "Add a milestone tracker",
        target: ".inspector",
        task: "Feche as configurações do componente (✕) e clique em Acompanhamento de marcos na galeria.",
        enter: (c) => {
          c.mem.ms = document.querySelectorAll(".widget.kind-milestones").length;
        },
        done: (c) => document.querySelectorAll(".widget.kind-milestones").length > (c.mem.ms as number),
        showMe: async () => {
          click('.inspector button[title="Fechar (Esc)"]');
          await wait(150);
          click(() => byText(".gallery-item", "Acompanhamento de marcos"));
        },
        body: () => <p>New widgets go to the end of the page and are selected, ready to set up. Milestones are marked on track, at risk (little float left) or late.</p>,
      },
      {
        title: "Finish customising",
        target: () => byText(".dash-bar button", "Concluído"),
        task: "Click Done.",
        done: () => !$(".inspector"),
        showMe: () => void click(() => byText(".dash-bar button", "Concluído")),
        body: () => (
          <p>
            Changes save as you go. Ctrl+Z undoes the last change while customising. Under <b>Mais</b> you can duplicate the dashboard, save it as a template for your team, or export it as a file.
          </p>
        ),
      },
      {
        title: "Share it",
        target: ".dash-bar",
        body: () => (
          <p>
            <b>PDF</b> prints the dashboard with your header and footer, <b>Excel</b> exports the data behind it, and <b>E-mail</b> sends it on a schedule (for example every Monday 08:00) to the project manager and director. On a Stratum Server, schedules run even when nobody has the app open.
          </p>
        ),
      },
      {
        title: "Voltar ao cronograma",
        target: ".reports-topbar .mode-switch",
        task: "Click P6 in the switch at the top.",
        done: (c) => c.s.view === "workspace",
        showMe: () => {
          useStore.getState().setView("workspace");
          useConfig.getState().update({ mode: "p6" });
        },
        body: () => <p>The practice dashboard stays in your list; delete it from More if you do not need it.</p>,
      },
    ],
  },
];

export interface GlossaryEntry {
  term: string;
  def: string;
  alt?: string;
}

export const GLOSSARY: GlossaryEntry[] = [
  { term: "Activity", alt: "Task (MS Project)", def: "A unit of work with a duration, dates and logic, such as 'Install GIS bays 1–5'." },
  { term: "Actual cost (AC)", def: "What the work done so far has really cost." },
  { term: "Actual start / finish", def: "The dates the work really started or finished. Shown with an A after the date." },
  { term: "Baseline", def: "The approved plan, frozen and used to measure variance. Re-baselining needs the client's agreement." },
  { term: "Budget at completion (BAC)", def: "The total approved budget for the work." },
  { term: "Calendar", def: "Working days, hours and holidays used to turn durations into dates." },
  { term: "Constraint", def: "A date imposed on an activity (start on or after, finish on or before…). Use sparingly; logic should drive dates." },
  { term: "Cost performance index (CPI)", def: "EV ÷ AC. Below 1.0: work is costing more than budgeted." },
  { term: "Critical path", def: "The longest chain of logic through the project. Its activities have zero (or the least) total float; delaying them delays the finish." },
  { term: "CPM", def: "Critical path method: the forward and backward pass that calculates early and late dates and float." },
  { term: "Data date", alt: "Status date (MS Project)", def: "The date progress is recorded up to. Past is actual; future is forecast." },
  { term: "Earned value (EV)", def: "Budgeted cost of the work actually done: budget × % complete." },
  { term: "Estimate at completion (EAC)", def: "The forecast final cost; simplest form BAC ÷ CPI." },
  { term: "Finish variance", def: "Current finish minus baseline finish. Positive: late." },
  { term: "Float (total)", alt: "Total slack (MS Project)", def: "How long an activity can slip before the project finish moves. Late finish − early finish." },
  { term: "Float (free)", alt: "Free slack", def: "How long an activity can slip before its next activity moves." },
  { term: "Forecast", def: "Dates and costs for remaining work, calculated by CPM from the data date." },
  { term: "4D", def: "A 3D model linked to the schedule so it can be shown at any date." },
  { term: "Lag", def: "A wait added to a relationship, e.g. FS + 7 days for curing." },
  { term: "Level of effort (LOE)", def: "An activity that spans other work, such as site supervision or HSE, taking its dates from them." },
  { term: "Look-ahead", def: "A short-term view (2–6 weeks) of the work starting or running, used to plan crews, materials and permits." },
  { term: "Milestone", def: "A zero-duration event: contract award, energisation, taking-over." },
  { term: "Near-critical", def: "Activities with only a few days of float; they become critical after small delays." },
  { term: "Negative float", def: "The schedule cannot meet a constraint or deadline; the number of days to recover." },
  { term: "Open end", def: "An activity with no predecessor or no successor. Schedule quality checks flag them." },
  { term: "Original duration", def: "The planned duration in working days." },
  { term: "Planned value (PV)", def: "Budgeted cost of the work scheduled by the data date on the baseline." },
  { term: "% complete", def: "How far the work is done; base it on measurable quantities." },
  { term: "Relationship (FS, SS, FF, SF)", alt: "Dependency / link", def: "Logic between activities: finish-to-start, start-to-start, finish-to-finish, start-to-finish." },
  { term: "Remaining duration", def: "Working days still needed; drives the forecast finish." },
  { term: "Resource", def: "Labour, plant or material assigned to activities with quantities and rates." },
  { term: "S-curve", def: "Cumulative progress or cost over time; plan, actual and forecast compared." },
  { term: "Schedule performance index (SPI)", def: "EV ÷ PV. Below 1.0: less work done than planned." },
  { term: "Slicer", def: "Dashboard buttons that filter every widget, e.g. by discipline." },
  { term: "Update", def: "The periodic cycle of recording progress, rescheduling and reporting." },
  { term: "WBS", alt: "Summary tasks (MS Project)", def: "Work breakdown structure: the hierarchy of deliverables the activities sit under." },
  { term: "Weightage", def: "Each group's share of overall progress in an EPC progress report, by cost, hours, duration or agreed split." },
  { term: "XER", def: "Primavera P6's exchange file format." },
];
