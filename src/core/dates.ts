// Fixed English month names, as P6 prints them. Locale data in some
// browsers gives "Sept", which planners don't expect.
export const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
export const WEEKDAYS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
export const monthShort = (d: Date) => MONTHS[d.getUTCMonth()];

const ENGLISH_MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];

/** Accept both the localized display format and month names from imported English schedules. */
export function shortMonthIndex(month: string): number {
  const key = month.toLowerCase();
  const local = MONTHS.findIndex((name) => name.toLowerCase() === key);
  return local >= 0 ? local : ENGLISH_MONTHS.indexOf(key);
}
