import { useEffect, useMemo, useRef } from "react";
import { activeAt, scheduleRange } from "../core/simulation";
import { DAY, fmtDate, useStore } from "./store";
import { useTerms } from "./terms";
const DATE_FORMAT = new Intl.DateTimeFormat("pt-BR", { weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });

const SPEEDS = [1, 3, 7, 14, 30, 60];

export function Timeline() {
  const schedule = useStore((s) => s.schedule);
  const terms = useTerms();
  const time = useStore((s) => s.time);
  const playing = useStore((s) => s.playing);
  const speed = useStore((s) => s.speed);
  const sim = useStore((s) => s.sim);
  const setTime = useStore((s) => s.setTime);
  const setPlaying = useStore((s) => s.setPlaying);
  const setSpeed = useStore((s) => s.setSpeed);
  const range = useMemo(() => (schedule ? scheduleRange(schedule, sim.dateSource) : null), [schedule, sim.dateSource]);
  const last = useRef<number | null>(null);

  useEffect(() => {
    if (!playing || !range) return;
    let raf = 0;
    last.current = null;
    const tick = (now: number) => {
      const prev = last.current ?? now;
      last.current = now;
      const { time: t, speed: sp } = useStore.getState();
      const next = t + ((now - prev) / 1000) * sp * DAY;
      if (next >= range.finish) {
        setTime(range.finish);
        setPlaying(false);
        return;
      }
      setTime(next);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, range, setTime, setPlaying]);

  const active = useMemo(() => (schedule ? activeAt(schedule, time, sim.dateSource) : []), [schedule, time, sim.dateSource]);

  if (!schedule || !range) return <div className="timeline empty">Importe um cronograma para usar a linha do tempo.</div>;

  const step = (days: number) => setTime(Math.min(range.finish, Math.max(range.start, time + days * DAY)));
  const dateLabel = DATE_FORMAT.format(time);


  return (
    <div className="timeline">
      <div className="timeline-controls">
        <button title="Ir para o início" onClick={() => setTime(range.start)}>⏮</button>
        <button title="Voltar 1 semana" onClick={() => step(-7)}>◀◀</button>
        <button title="Voltar 1 dia" onClick={() => step(-1)}>◀</button>
        <button className="primary" title="Reproduzir ou pausar (barra de espaço)" onClick={() => setPlaying(!playing)}>
          {playing ? "❚❚ Pausar" : "▶ Reproduzir"}
        </button>
        <button title="Avançar 1 dia" onClick={() => step(1)}>▶</button>
        <button title="Avançar 1 semana" onClick={() => step(7)}>▶▶</button>
        <button title="Ir para o fim" onClick={() => setTime(range.finish)}>⏭</button>
        {schedule.dataDate !== null && (
          <button title={`Ir para a ${terms.dataDate.toLowerCase()}`} onClick={() => setTime(schedule.dataDate!)}>
            {terms.dataDate}
          </button>
        )}
        <label>
          Velocidade
          <select value={speed} onChange={(e) => setSpeed(Number(e.target.value))}>
            {SPEEDS.map((s) => (
              <option key={s} value={s}>
                {s} dia{s > 1 ? "s" : ""}/s
              </option>
            ))}
          </select>
        </label>
        <strong className="timeline-date">{dateLabel}</strong>
        <span className="muted">{active.length} em andamento</span>
      </div>
      <input
        className="timeline-slider"
        type="range"
        min={range.start}
        max={range.finish}
        step={3_600_000}
        value={Math.min(range.finish, Math.max(range.start, time))}
        onChange={(e) => setTime(Number(e.target.value))}
      />
      <div className="timeline-ends muted">
        <span>{fmtDate(range.start)}</span>
        <span className="active-list">{active.slice(0, 6).map((a) => a.code).join(" · ")}{active.length > 6 ? " …" : ""}</span>
        <span>{fmtDate(range.finish)}</span>
      </div>
    </div>
  );
}
