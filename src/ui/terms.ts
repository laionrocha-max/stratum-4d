// Words and defaults for each interface mode. The data and engine are the
// same; only what people read changes, so a P6 planner sees "ID da atividade" and
// "Folga total" while an MS Project user sees "ID" and "Folga total".

import type { InterfaceMode } from "../core/reporting";
import { useConfig } from "../backend/config";

export interface Terms {
  modeName: string;
  activity: string;
  activities: string;
  activityId: string;
  activityName: string;
  wbs: string;
  dataDate: string;
  totalFloat: string;
  freeFloat: string;
  originalDuration: string;
  remainingDuration: string;
  percentComplete: string;
  predecessors: string;
  successors: string;
  relationship: string;
  baseline: string;
  schedule: string;
  resources: string;
  constraint: string;
  milestone: string;
  project: string;
  projects: string;
  playbackDate: string;
  /** How durations are shown in tables. */
  durationUnit: "d" | " dias" | "d ";
}

const P6: Terms = {
  modeName: "Estilo P6",
  activity: "Atividade",
  activities: "Atividades",
  activityId: "ID da atividade",
  activityName: "Nome da atividade",
  wbs: "EAP",
  dataDate: "Data de corte",
  totalFloat: "Folga total",
  freeFloat: "Folga livre",
  originalDuration: "Duração original",
  remainingDuration: "Duração restante",
  percentComplete: "% físico concluído",
  predecessors: "Predecessoras",
  successors: "Sucessoras",
  relationship: "Relação",
  baseline: "Linha de base",
  schedule: "Calcular cronograma",
  resources: "Recursos",
  constraint: "Restrição principal",
  milestone: "Marco",
  project: "Projeto",
  projects: "Projetos",
  playbackDate: "Data da escala de tempo",
  durationUnit: "d",
};

const MSP: Terms = {
  modeName: "Estilo MS Project",
  activity: "Tarefa",
  activities: "Tarefas",
  activityId: "ID",
  activityName: "Nome da tarefa",
  wbs: "Estrutura de tópicos",
  dataDate: "Data de status",
  totalFloat: "Folga total",
  freeFloat: "Folga livre",
  originalDuration: "Duração",
  remainingDuration: "Duração restante",
  percentComplete: "% concluído",
  predecessors: "Predecessoras",
  successors: "Sucessoras",
  relationship: "Vínculo",
  baseline: "Linha de base",
  schedule: "Calcular",
  resources: "Nomes dos recursos",
  constraint: "Tipo de restrição",
  milestone: "Marco",
  project: "Projeto",
  projects: "Projetos",
  playbackDate: "Data",
  durationUnit: " dias",
};

const FOURD: Terms = {
  modeName: "Estilo 4D",
  activity: "Tarefa",
  activities: "Tarefas",
  activityId: "ID da tarefa",
  activityName: "Nome da tarefa",
  wbs: "EAP",
  dataDate: "Data de corte",
  totalFloat: "Folga total",
  freeFloat: "Folga livre",
  originalDuration: "Duração planejada",
  remainingDuration: "Duração restante",
  percentComplete: "% concluído",
  predecessors: "Predecessoras",
  successors: "Sucessoras",
  relationship: "Dependência",
  baseline: "Linha de base",
  schedule: "Recalcular cronograma",
  resources: "Recursos",
  constraint: "Restrição",
  milestone: "Marco",
  project: "Projeto",
  projects: "Projetos",
  playbackDate: "Data da simulação",
  durationUnit: "d",
};

export const TERMS: Record<InterfaceMode, Terms> = { p6: P6, msp: MSP, "4d": FOURD };

export function useTerms(): Terms {
  return TERMS[useConfig((s) => s.config.mode)];
}

export const MODE_INFO: Record<InterfaceMode, { title: string; blurb: string; points: string[] }> = {
  p6: {
    title: "Estilo P6",
    blurb: "Layout inspirado na janela de atividades do Primavera P6 Professional.",
    points: ["Barra de menus, diretório à esquerda e comandos à direita", "Tabela de atividades e Gantt agrupados pela EAP", "Abas de detalhes da atividade: Geral, Status, Recursos, Predecessoras, Sucessoras e Códigos", "Cálculo do cronograma, data de dados e folga total como no P6"],
  },
  msp: {
    title: "Estilo MS Project",
    blurb: "Layout inspirado no gráfico de Gantt do Microsoft Project.",
    points: ["Faixa de opções: Tarefa, Recurso, Relatório, Projeto e Exibição", "Linha do tempo acima do gráfico de Gantt", "Números das linhas, duração, predecessoras e nomes dos recursos", "Formulário de tarefas, Gantt de acompanhamento e uso de recursos"],
  },
  "4d": {
    title: "Estilo 4D",
    blurb: "Layout com foco no modelo para planejamento e revisão 4D.",
    points: ["Modelo 3D no centro", "Gantt à esquerda e ferramentas de vínculo à direita", "Linha do tempo e controles de reprodução na parte inferior", "Acesso a vínculos, perfis e trajetos"],
  },
};
