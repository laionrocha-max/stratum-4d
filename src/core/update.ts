// Schedule updates: bring a new XER (e.g. next week's progress update) into an
// existing project without losing links, and report what changed.
//
// P6's internal task_id can change between exports (copied projects, different
// databases), so links are carried across by the user-facing Activity ID.

import type { Activity, Link, MotionPath, Schedule } from "./types";

export interface ActivityChange {
  code: string;
  name: string;
  /** Movement in calendar days; positive = later. */
  startShiftDays: number | null;
  finishShiftDays: number | null;
  statusFrom: Activity["status"];
  statusTo: Activity["status"];
  pctFrom: number;
  pctTo: number;
  fields: string[];
}

export interface ScheduleDiff {
  added: { code: string; name: string }[];
  removed: { code: string; name: string }[];
  changed: ActivityChange[];
  /** Project finish movement in calendar days (positive = slipped). */
  finishShiftDays: number | null;
  dataDateFrom: number | null;
  dataDateTo: number | null;
  calendarsChanged: boolean;
  relationshipsChanged: boolean;
}

const DAY = 86_400_000;

function shift(a: number | null, b: number | null): number | null {
  if (a === null || b === null) return null;
  return Math.round(((b - a) / DAY) * 10) / 10;
}

function projectFinish(s: Schedule): number | null {
  let f = -Infinity;
  for (const a of s.activities) if (a.finish !== null) f = Math.max(f, a.finish);
  return Number.isFinite(f) ? f : null;
}

export function diffSchedules(prev: Schedule, next: Schedule): ScheduleDiff {
  const before = new Map(prev.activities.map((a) => [a.code, a]));
  const after = new Map(next.activities.map((a) => [a.code, a]));
  const added = next.activities.filter((a) => !before.has(a.code)).map((a) => ({ code: a.code, name: a.name }));
  const removed = prev.activities.filter((a) => !after.has(a.code)).map((a) => ({ code: a.code, name: a.name }));
  const changed: ActivityChange[] = [];
  const calendarsBefore = new Map((prev.calendars ?? []).map((c) => [c.id, JSON.stringify(c)]));
  const calendarsAfter = new Map((next.calendars ?? []).map((c) => [c.id, JSON.stringify(c)]));
  const predecessorSignatures = (schedule: Schedule) => {
    const codes = new Map(schedule.activities.map((a) => [a.id, a.code]));
    const signatures = new Map<string, string[]>();
    for (const link of schedule.relationships) {
      const predecessor = codes.get(link.predecessorId);
      const successor = codes.get(link.successorId);
      if (predecessor === undefined || successor === undefined) continue;
      const list = signatures.get(successor) ?? [];
      list.push(JSON.stringify([predecessor, link.type, link.lagHours]));
      signatures.set(successor, list);
    }
    return new Map([...signatures].map(([code, items]) => [code, items.sort().join("|")]));
  };
  const predecessorsBefore = predecessorSignatures(prev);
  const predecessorsAfter = predecessorSignatures(next);
  for (const a of next.activities) {
    const b = before.get(a.code);
    if (!b) continue;
    const s = shift(b.start, a.start);
    const f = shift(b.finish, a.finish);
    const fields = [
      [a.name !== b.name, "Nome"],
      [a.start !== b.start || a.finish !== b.finish, "Programação"],
      [a.actualStart !== b.actualStart || a.actualFinish !== b.actualFinish, "Datas reais"],
      [a.status !== b.status, "Situação"],
      [a.percentComplete !== b.percentComplete || a.physicalPercent !== b.physicalPercent || a.pctType !== b.pctType, "Avanço"],
      [a.remainingDurationHours !== b.remainingDurationHours || a.originalDurationHours !== b.originalDurationHours, "Duração"],
      [a.calendarId !== b.calendarId || calendarsBefore.get(b.calendarId ?? "") !== calendarsAfter.get(a.calendarId ?? ""), "Calendário"],
      [predecessorsBefore.get(a.code) !== predecessorsAfter.get(a.code), "Predecessoras"],
      [a.baselineStart !== b.baselineStart || a.baselineFinish !== b.baselineFinish, "Baseline recebida"],
    ].filter(([diff]) => diff).map(([, label]) => String(label));
    if (fields.length) {
      changed.push({
        code: a.code,
        name: a.name,
        startShiftDays: s,
        finishShiftDays: f,
        statusFrom: b.status,
        statusTo: a.status,
        pctFrom: b.percentComplete,
        pctTo: a.percentComplete,
        fields,
      });
    }
  }
  changed.sort((x, y) => Math.abs(y.finishShiftDays ?? 0) - Math.abs(x.finishShiftDays ?? 0));
  return {
    added,
    removed,
    changed,
    finishShiftDays: shift(projectFinish(prev), projectFinish(next)),
    dataDateFrom: prev.dataDate,
    dataDateTo: next.dataDate,
    calendarsChanged: calendarsBefore.size !== calendarsAfter.size || prev.defaultCalendarId !== next.defaultCalendarId ||
      [...calendarsBefore].some(([id, value]) => calendarsAfter.get(id) !== value),
    relationshipsChanged: predecessorsBefore.size !== predecessorsAfter.size ||
      [...predecessorsBefore].some(([code, value]) => predecessorsAfter.get(code) !== value),
  };
}

/** Move links from the old schedule's activity ids to the new one's, matching on Activity ID (code). */
export function remapLinks(prev: Schedule, next: Schedule, links: Link[]): { links: Link[]; dropped: Link[] } {
  const previous = new Map(prev.activities.map((a) => [a.id, a.code]));
  const ambiguous = new Set([...duplicates(prev.activities.map((a) => a.code)), ...duplicates(next.activities.map((a) => a.code))]);
  const idOf = new Map(next.activities.filter((a) => !ambiguous.has(a.code)).map((a) => [a.code, a.id]));
  const kept: Link[] = [];
  const dropped: Link[] = [];
  for (const l of links) {
    const code = previous.get(l.activityId);
    const newId = code !== undefined ? idOf.get(code) : undefined;
    if (newId === undefined) dropped.push(l);
    else kept.push({ ...l, activityId: newId });
  }
  return { links: kept, dropped };
}

export function duplicates(values: string[]): string[] {
  const seen = new Set<string>();
  const repeated = new Set<string>();
  for (const value of values) {
    if (!value || seen.has(value)) repeated.add(value || "(vazio)");
    seen.add(value);
  }
  return [...repeated];
}

export function sameScheduleIdentity(prev: Schedule, next: Schedule): boolean {
  const isMsp = prev.sourceFormat === "mspdi";
  if (isMsp !== (next.sourceFormat === "mspdi") || prev.projects?.length || next.projects?.length) return false;
  if (!isMsp) return !!prev.projectCode && prev.projectCode === next.projectCode;
  const projectGuid = (s: Schedule) => {
    const id = s.projectId.replace(/[{}]/g, "").toLowerCase();
    return /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(id) ? id : null;
  };
  const previousGuid = projectGuid(prev);
  const nextGuid = projectGuid(next);
  if (previousGuid && nextGuid) return previousGuid === nextGuid;
  return !!prev.projectCode && prev.projectCode !== "MSP" && prev.projectCode === next.projectCode;
}

export function planScheduleRevision(prev: Schedule, next: Schedule) {
  if (!sameScheduleIdentity(prev, next)) {
    throw new Error("A revisão precisa pertencer ao mesmo cronograma e à mesma origem. Use a importação de nova obra para outro cronograma.");
  }
  const isMsp = prev.sourceFormat === "mspdi";
  const clashes = new Set([...duplicates(prev.activities.map((a) => a.code)), ...duplicates(next.activities.map((a) => a.code))]);
  const ids = [...duplicates(prev.activities.map((a) => a.id)), ...duplicates(next.activities.map((a) => a.id))];
  if (clashes.size || ids.length) throw new Error(`Identificadores de atividades duplicados ou vazios: ${[...clashes, ...ids].slice(0, 12).join(", ")}. Corrija o arquivo antes de revisar.`);
  if (!next.activities.length) throw new Error("O cronograma recebido não contém atividades.");

  const byCode = new Map(next.activities.map((a) => [a.code, a]));
  const byId = new Map(next.activities.map((a) => [a.id, a]));
  const priorIds = new Map(prev.activities.map((a) => [a.id, a.code]));
  const matches = new Map<string, string>();
  const ambiguous = new Set<string>();
  for (const old of prev.activities) {
    const candidate = byCode.get(old.code);
    const sameUid = isMsp ? byId.get(old.id) : undefined;
    const priorCode = isMsp && candidate ? priorIds.get(candidate.id) : undefined;
    if ((sameUid && candidate?.id !== sameUid.id) || (priorCode && old.code !== priorCode)) ambiguous.add(old.id);
    else if (candidate && old.type === candidate.type) matches.set(old.id, candidate.id);
    else if (candidate) ambiguous.add(old.id);
  }
  return { matches, ambiguous, diff: diffSchedules(prev, next) };
}

export function applyScheduleRevision(prev: Schedule, incoming: Schedule, links: Link[], paths: MotionPath[], mapping: Map<string, string>) {
  const active = new Map(prev.activities.map((a) => [a.id, a]));
  const byNewId = new Map([...mapping].map(([oldId, newId]) => [newId, active.get(oldId)!]));
  const schedule: Schedule = {
    ...incoming,
    eps: incoming.eps ?? prev.eps,
    baselineInfo: prev.baselineInfo,
    baselines: prev.baselines,
    compareBaselines: prev.compareBaselines,
    activities: incoming.activities.map((activity) => {
      const original = byNewId.get(activity.id);
      return { ...activity, baselineStart: original?.baselineStart ?? null, baselineFinish: original?.baselineFinish ?? null };
    }),
  };
  const kept: Link[] = [];
  const orphaned: Link[] = [];
  for (const link of links) {
    const to = mapping.get(link.activityId);
    if (to === undefined) orphaned.push(link);
    else kept.push({ ...link, activityId: to });
  }
  const nextPaths = paths.flatMap((path) => {
    const activityId = mapping.get(path.activityId);
    return activityId === undefined ? [] : [{ ...path, activityId }];
  });
  return { schedule, links: kept, paths: nextPaths, orphaned };
}
