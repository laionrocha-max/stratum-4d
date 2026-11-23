import { useMemo, useState } from "react";
import { linkHealth } from "../core/health";
import { activityFields, applyRules, elementPropertyValue, mergeLinks, propertyKeys, suggestRules, unlink, type RuleSuggestion } from "../core/linking";
import { LINK_PROFILE_KEY } from "./Present";
import { PLAN_COLORS } from "../core/simulation";
import { solarPosition, type SolarSettings } from "../core/solar";
import { splitAt, splitElement, splitGrid } from "../core/motion";
import { cloneProfile, STATUS_COLORS } from "../core/profiles";
import type { AppearanceProfile, GrowthDirection, LinkMatch, LinkRule, PhaseAppearance } from "../core/types";
import { fmtDate, useStore, type SideTab } from "./store";

const SIDE_TABS = [
  { id: "selection", label: "Seleção" },
  { id: "rules", label: "Regras" },
  { id: "tools", label: "Ferramentas" },
  { id: "profiles", label: "Perfis" },
  { id: "display", label: "Exibição" },
  { id: "check", label: "Verificação" },
] satisfies { id: SideTab; label: string }[];

export function SidePanel() {
  const tab = useStore((s) => s.sideTab);
  const setTab = useStore((s) => s.setSideTab);
  return (
    <div className="side">
      <div className="tabs">
        {SIDE_TABS.map(({ id, label }) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {label}
          </button>
        ))}
      </div>
      <div className="tab-body">
        {tab === "selection" && <SelectionTab />}
        {tab === "rules" && <RulesTab />}
        {tab === "profiles" && <ProfilesTab />}
        {tab === "display" && <DisplayTab />}
        {tab === "check" && <CheckTab />}
        {tab === "tools" && <ToolsTab />}
      </div>
    </div>
  );
}

function SelectionTab() {
  const { elements, selectedElements, selectElements, schedule, selectedActivity, links, setLinks, profiles, setStatus } = useStore();
  const [profileId, setProfileIdState] = useState(() => {
    try {
      const p = localStorage.getItem(LINK_PROFILE_KEY);
      if (p && profiles.some((x) => x.id === p)) return p;
    } catch {
      /* storage blocked */
    }
    return profiles[0]?.id ?? "install";
  });
  // Remembered for the Ctrl+Shift+A shortcut.
  const setProfileId = (id: string) => {
    setProfileIdState(id);
    try {
      localStorage.setItem(LINK_PROFILE_KEY, id);
    } catch {
      /* storage blocked */
    }
  };
  const [propKey, setPropKey] = useState("IfcType");
  const [propValue, setPropValue] = useState("");
  const keys = useMemo(() => propertyKeys(elements), [elements]);
  const byId = useMemo(() => new Map(elements.map((e) => [e.id, e])), [elements]);
  const actById = useMemo(() => new Map((schedule?.activities ?? []).map((a) => [a.id, a])), [schedule]);
  const values = useMemo(() => {
    const s = new Set<string>();
    for (const e of elements) {
      const v = elementPropertyValue(e, propKey);
      if (v) s.add(v);
      if (s.size > 300) break;
    }
    return [...s].sort();
  }, [elements, propKey]);

  const sel = [...selectedElements];
  const one = sel.length === 1 ? byId.get(sel[0]) : undefined;
  const selLinks = links.filter((l) => selectedElements.has(l.elementId));
  const activity = selectedActivity ? actById.get(selectedActivity) : undefined;

  const linkSelected = () => {
    if (!activity || sel.length === 0) return;
    setLinks(mergeLinks(links, sel.map((elementId) => ({ elementId, activityId: activity.id, profileId }))));
    setStatus(`${sel.length} elemento(s) vinculado(s) à atividade ${activity.code} (${profiles.find((p) => p.id === profileId)?.name}).`);
  };
  const selectByProperty = () => {
    const ids = elements.filter((e) => (elementPropertyValue(e, propKey) ?? "") === propValue).map((e) => e.id);
    selectElements(new Set(ids));
    setStatus(`${ids.length} elemento(s) selecionado(s) com ${propKey} = ${propValue}.`);
  };

  return (
    <div className="stack">
      <section>
        <h4>Selecionar por propriedade</h4>
        <select value={propKey} onChange={(e) => setPropKey(e.target.value)}>
          {keys.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <select value={propValue} onChange={(e) => setPropValue(e.target.value)}>
          <option value="">— valor —</option>
          {values.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
        <div className="row">
          <button onClick={selectByProperty} disabled={!propValue}>Selecionar</button>
          <button onClick={() => selectElements(new Set())} disabled={sel.length === 0}>Limpar seleção</button>
        </div>
        <p className="muted">Clique na vista 3D para selecionar. Use Shift ou Ctrl ao clicar para ampliar a seleção. Use Alt ao clicar em uma atividade para selecionar os elementos vinculados. Clique duas vezes para ir ao início da atividade na linha do tempo.</p>
      </section>

      <section>
        <h4>Vincular seleção à atividade</h4>
        <p>
          <b>{sel.length}</b> elemento(s) selecionado(s)
          <br />
          Atividade: {activity ? <b>{activity.code} – {activity.name}</b> : <span className="muted">selecione no Gantt</span>}
        </p>
        <label>
          Perfil
          <select value={profileId} onChange={(e) => setProfileId(e.target.value)}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <div className="row">
          <button className="primary" disabled={!activity || sel.length === 0} onClick={linkSelected}>Vincular</button>
          <button
            disabled={!activity}
            title="Selecionar os elementos já vinculados a esta atividade"
            onClick={() => selectElements(new Set(links.filter((l) => l.activityId === activity!.id).map((l) => l.elementId)))}
          >
            Selecionar vinculados
          </button>
          <button
            disabled={sel.length === 0 || selLinks.length === 0}
            onClick={() => {
              setLinks(unlink(links, selectedElements, activity?.id));
              setStatus(activity ? `Seleção desvinculada da atividade ${activity.code}.` : "Todos os vínculos da seleção foram removidos.");
            }}
          >
            {activity ? "Desvincular da atividade" : "Remover todos os vínculos da seleção"}
          </button>
        </div>
      </section>

      {selLinks.length > 0 && (
        <section>
          <h4>Vínculos da seleção ({selLinks.length})</h4>
          <ul className="list">
            {selLinks.slice(0, 50).map((l) => {
              const a = actById.get(l.activityId);
              return (
                <li key={`${l.elementId}|${l.activityId}`}>
                  {byId.get(l.elementId)?.name ?? l.elementId} → <b>{a?.code ?? l.activityId}</b> ({profiles.find((p) => p.id === l.profileId)?.name ?? l.profileId})
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {one && (
        <section>
          <h4>Propriedades</h4>
          <table className="props">
            <tbody>
              <tr><td>Nome</td><td>{one.name}</td></tr>
              <tr><td>IfcType</td><td>{one.ifcType}</td></tr>
              <tr><td>GlobalId</td><td>{one.id}</td></tr>
              {Object.entries(one.properties).map(([k, v]) => (
                <tr key={k}><td>{k}</td><td>{v}</td></tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}

function RulesTab() {
  const { elements, schedule, rules, setRules, links, setLinks, profiles, setStatus } = useStore();
  const keys = useMemo(() => propertyKeys(elements), [elements]);
  const fields = useMemo(() => activityFields(schedule), [schedule]);
  const [draft, setDraft] = useState<Omit<LinkRule, "id">>({
    elementProperty: "Name",
    activityField: "code",
    match: "equals",
    profileId: profiles[0]?.id ?? "install",
    caseSensitive: false,
  });

  const run = (subset: LinkRule[]) => {
    if (!schedule) return;
    const found = applyRules(subset, elements, schedule);
    setLinks(mergeLinks(links, found));
    const linkedEls = new Set(found.map((l) => l.elementId)).size;
    setStatus(`As regras criaram ${found.length} vínculo(s) em ${linkedEls} elemento(s).`);
  };

  const [suggestions, setSuggestions] = useState<RuleSuggestion[] | null>(null);
  const fieldLabel = (v: string) => fields.find((f) => f.value === v)?.label ?? v;

  return (
    <div className="stack">
      <section>
        <h4>Detectar automaticamente</h4>
        <p className="muted">Procura uma propriedade do modelo que já contenha IDs, nomes, códigos de atividade ou itens da EAP.</p>
        <button
          disabled={!schedule || elements.length === 0}
          onClick={() => {
            const found = suggestRules(elements, schedule!);
            setSuggestions(found);
            setStatus(found.length ? `${found.length} regra(s) sugerida(s).` : "Nenhuma propriedade do modelo corresponde exatamente aos valores do cronograma.");
          }}
        >
          Localizar propriedades correspondentes
        </button>
        {suggestions && suggestions.length === 0 && <p className="muted">Nenhuma correspondência exata. Experimente uma regra «contém» ou vincule pela seleção.</p>}
        {suggestions && suggestions.length > 0 && (
          <ul className="list suggestions">
            {suggestions.map((sg) => (
              <li key={`${sg.elementProperty}|${sg.activityField}`}>
                <code>{sg.elementProperty}</code> = <code>{fieldLabel(sg.activityField)}</code>
                <br />
                <span className="muted">
                  {sg.elementMatches} elementos → {sg.activityMatches} atividades
                </span>{" "}
                <button
                  className="link"
                  onClick={() =>
                    setDraft({ ...draft, elementProperty: sg.elementProperty, activityField: sg.activityField, match: "equals", caseSensitive: false })
                  }
                >
                  usar
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h4>Nova regra</h4>
        <p className="muted">Vincule elementos cuja propriedade corresponde a um campo da atividade.</p>
        <label>
          Propriedade do elemento
          <select value={draft.elementProperty} onChange={(e) => setDraft({ ...draft, elementProperty: e.target.value })}>
            {keys.map((k) => (
              <option key={k}>{k}</option>
            ))}
          </select>
        </label>
        <label>
          Correspondência
          <select value={draft.match} onChange={(e) => setDraft({ ...draft, match: e.target.value as LinkMatch })}>
            <option value="equals">igual a</option>
            <option value="contains">contém</option>
            <option value="startsWith">começa com</option>
          </select>
        </label>
        <label>
          Campo da atividade
          <select value={draft.activityField} onChange={(e) => setDraft({ ...draft, activityField: e.target.value })}>
            {fields.map((f) => (
              <option key={f.value} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Perfil
          <select value={draft.profileId} onChange={(e) => setDraft({ ...draft, profileId: e.target.value })}>
            {profiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <label className="check">
          <input type="checkbox" checked={draft.caseSensitive} onChange={(e) => setDraft({ ...draft, caseSensitive: e.target.checked })} />
          Diferenciar maiúsculas de minúsculas
        </label>
        <div className="row">
          <button onClick={() => setRules([...rules, { ...draft, id: crypto.randomUUID() }])}>Adicionar regra</button>
          <button className="primary" disabled={!schedule || elements.length === 0} onClick={() => run([{ ...draft, id: "adhoc" }])}>
            Executar uma vez
          </button>
        </div>
      </section>
      <section>
        <h4>Regras salvas ({rules.length})</h4>
        {rules.length === 0 && <p className="muted">Nenhum item ainda.</p>}
        <ul className="list">
          {rules.map((r) => (
            <li key={r.id}>
              <code>{r.elementProperty}</code> {r.match} <code>{fields.find((f) => f.value === r.activityField)?.label ?? r.activityField}</code> →{" "}
              {profiles.find((p) => p.id === r.profileId)?.name}
              <button className="link" onClick={() => setRules(rules.filter((x) => x !== r))}>remover</button>
            </li>
          ))}
        </ul>
        <div className="row">
          <button className="primary" disabled={!rules.length || !schedule} onClick={() => run(rules)}>Executar todas as regras</button>
          <button disabled={!links.length} onClick={() => { setLinks([]); setStatus("Todos os vínculos foram removidos."); }}>Limpar todos os vínculos</button>
        </div>
        <p className="muted">{links.length} vínculo(s) no projeto.</p>
      </section>
    </div>
  );
}

function PhaseEditor({ label, value, onChange }: { label: string; value: PhaseAppearance; onChange: (v: PhaseAppearance) => void }) {
  return (
    <div className="phase">
      <b>{label}</b>
      <label className="check">
        <input type="checkbox" checked={value.visible} onChange={(e) => onChange({ ...value, visible: e.target.checked })} />
        Visível
      </label>
      <label className="check">
        <input type="checkbox" checked={value.color === null} onChange={(e) => onChange({ ...value, color: e.target.checked ? null : "#888888" })} />
        Cor do modelo
      </label>
      {value.color !== null && <input type="color" value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })} />}
      <label>
        Transparência {Math.round(value.transparency * 100)}%
        <input type="range" min={0} max={1} step={0.05} value={value.transparency} onChange={(e) => onChange({ ...value, transparency: Number(e.target.value) })} />
      </label>
    </div>
  );
}

function ProfilesTab() {
  const { profiles, setProfiles, links } = useStore();
  const [currentId, setCurrentId] = useState(profiles[0]?.id);
  const current = profiles.find((p) => p.id === currentId) ?? profiles[0];
  const update = (p: AppearanceProfile) => setProfiles(profiles.map((x) => (x.id === p.id ? p : x)));
  const inUse = (id: string) => links.some((l) => l.profileId === id);

  return (
    <div className="stack">
      <section>
        <h4>Perfis de aparência</h4>
        <div className="row wrap">
          {profiles.map((p) => (
            <button key={p.id} className={p.id === current?.id ? "active" : ""} onClick={() => setCurrentId(p.id)}>
              <span className="swatch" style={{ background: p.active.color ?? "#999" }} /> {p.name}
            </button>
          ))}
        </div>
        <div className="row">
          <button
            onClick={() => {
              if (!current) return;
              const id = crypto.randomUUID();
              setProfiles([...profiles, cloneProfile(current, id, `${current.name} copy`)]);
              setCurrentId(id);
            }}
          >
            Duplicar
          </button>
          <button
            disabled={!current || profiles.length <= 1 || inUse(current.id)}
            title={current && inUse(current.id) ? "Este perfil está em uso nos vínculos" : ""}
            onClick={() => {
              const rest = profiles.filter((p) => p.id !== current!.id);
              setProfiles(rest);
              setCurrentId(rest[0]?.id);
            }}
          >
            Excluir
          </button>
        </div>
      </section>
      {current && (
        <section>
          <label>
            Nome
            <input value={current.name} onChange={(e) => update({ ...current, name: e.target.value })} />
          </label>
          <PhaseEditor label="Antes da tarefa" value={current.before} onChange={(v) => update({ ...current, before: v })} />
          <PhaseEditor label="Durante a tarefa" value={current.active} onChange={(v) => update({ ...current, active: v })} />
          <PhaseEditor label="Após a tarefa" value={current.after} onChange={(v) => update({ ...current, after: v })} />
          <label className="check">
            <input type="checkbox" checked={current.progressiveFade} onChange={(e) => update({ ...current, progressiveFade: e.target.checked })} />
            Exibir gradualmente com o avanço da tarefa
          </label>
          <label>
            Crescimento durante a tarefa
            <select value={current.growth ?? "none"} onChange={(e) => update({ ...current, growth: e.target.value as GrowthDirection })}>
              <option value="none">Nenhum (elemento inteiro)</option>
              <option value="bottom-up">De baixo para cima</option>
              <option value="top-down">De cima para baixo</option>
              <option value="west-east">Oeste → leste</option>
              <option value="east-west">Leste → oeste</option>
              <option value="south-north">Sul → norte</option>
              <option value="north-south">Norte → sul</option>
            </select>
          </label>
        </section>
      )}
    </div>
  );
}

function SolarControls() {
  const { sim, setSim, schedule } = useStore();
  const solar = sim.solar ?? {
    date: new Date(schedule?.dataDate ?? Date.now()).toISOString().slice(0, 10),
    time: "15:00", utcOffset: -new Date().getTimezoneOffset() / 60, north: 0,
  };
  const position = solarPosition(solar);
  const update = (patch: Partial<SolarSettings>) => setSim({ solar: { ...solar, ...patch } });
  const fields = [
    { key: "latitude", label: "Latitude (°)", min: -90, max: 90, step: 0.0001 },
    { key: "longitude", label: "Longitude (°)", min: -180, max: 180, step: 0.0001 },
    { key: "utcOffset", label: "Fuso UTC (h)", min: -12, max: 14, step: 0.25 },
    { key: "north", label: "Ajuste do norte (°)", min: -360, max: 360, step: 1 },
  ] as const;
  return (
    <details className="solar-settings">
      <summary>Sol e localização</summary>
      <div className="solar-fields">
        {fields.map(({ key, label, min, max, step }) => (
          <label key={key}>{label}
            <input
              type="number" min={min} max={max} step={step}
              value={(solar as SolarSettings)[key] ?? ""}
              onChange={(e) => update({ [key]: e.target.value === "" ? undefined : e.target.valueAsNumber })}
            />
          </label>
        ))}
        <label>Data da iluminação<input type="date" value={solar.date} onChange={(e) => update({ date: e.target.value })} /></label>
        <label>Hora local<input type="time" value={solar.time} onChange={(e) => update({ time: e.target.value })} /></label>
      </div>
      <p className="muted">Use latitude sul e longitude oeste com sinal negativo. Ajuste o norte para coincidir com a orientação do IFC.</p>
      {position ? (
        <p className="muted">
          Sol a {position.elevation.toFixed(1)}° de elevação e {position.azimuth.toFixed(1)}° a partir do norte.
          {position.sunrise && position.sunset && ` Nascer por volta de ${position.sunrise}. Pôr por volta de ${position.sunset}.`}
        </p>
      ) : <p className="muted">Preencha a localização para calcular a direção do sol. Enquanto isso, o visor usa uma luz ilustrativa.</p>}
    </details>
  );
}

function DisplayTab() {
  const { sim, setSim, profiles, models, baseElements } = useStore();
  const loadedModels = new Set(baseElements.map((element) => element.id.includes(":") ? element.id.split(":")[0] : ""));
  return (
    <div className="stack">
      {!!models?.files.length && (
        <section>
          <h4>Modelos da obra</h4>
          <ul className="ifc-file-list">
            {models.files.map(({ id, name }) => (
              <li key={id}>{name} <span className="muted">({loadedModels.has(id) ? "em cena" : "aguardando arquivo"})</span></li>
            ))}
          </ul>
        </section>
      )}
      <section>
        <h4>Aparência do modelo</h4>
        <label className="check" title="Suaviza as cores do modelo e ativa a iluminação com sombras. Também se aplica aos vídeos exportados.">
          <input type="checkbox" checked={sim.presentationLook === true} onChange={(e) => setSim({ presentationLook: e.target.checked })} />
          Modo apresentação
        </label>
        <label className="check" title="Mostra um fundo de céu no modo apresentação.">
          <input type="checkbox" checked={sim.naturalSky === true} onChange={(e) => setSim({ naturalSky: e.target.checked })} />
          Céu natural
        </label>
        <SolarControls />
      </section>
      <section>
        <h4>Datas da simulação</h4>
        <label className="check">
          <input type="radio" checked={sim.dateSource === "current"} onChange={() => setSim({ dateSource: "current" })} />
          Cronograma atual (realizado e previsto)
        </label>
        <label className="check">
          <input type="radio" checked={sim.dateSource === "baseline"} onChange={() => setSim({ dateSource: "baseline" })} />
          Linha de base (datas de referência do P6)
        </label>
      </section>
      <section>
        <h4>Colorir por</h4>
        <label className="check">
          <input type="radio" checked={sim.colorMode === "profile"} onChange={() => setSim({ colorMode: "profile" })} />
          Perfil de aparência
        </label>
        <label className="check">
          <input type="radio" checked={sim.colorMode === "status"} onChange={() => setSim({ colorMode: "status" })} />
          Situação da atividade em relação à linha de base
        </label>
        <label className="check" title="Verde indica adiantamento, azul indica avanço conforme o plano e vermelho indica atraso, inclusive quando o trabalho já deveria estar concluído.">
          <input type="radio" checked={sim.colorMode === "plan-vs-actual"} onChange={() => setSim({ colorMode: "plan-vs-actual" })} />
          Planejado e realizado (adiantamento ou atraso)
        </label>
      </section>
      <section>
        <h4>Elementos sem vínculo</h4>
        {(["show", "ghost", "hide"] as const).map((u) => (
          <label className="check" key={u}>
            <input type="radio" checked={sim.unlinked === u} onChange={() => setSim({ unlinked: u })} />
            {{ show: "Mostrar", ghost: "Translúcidos", hide: "Ocultar" }[u]}
          </label>
        ))}
      </section>
      <section>
        <h4>Sobreposições</h4>
        <label className="check">
          <input type="checkbox" checked={sim.showGrid !== false} onChange={(e) => setSim({ showGrid: e.target.checked })} />
          Mostrar grade de referência
        </label>
        <label className="check">
          <input type="checkbox" checked={sim.showPaths !== false} onChange={(e) => setSim({ showPaths: e.target.checked })} />
          Mostrar trajetos de equipamentos
        </label>
      </section>
      <section>
        <h4>Legenda</h4>
        {sim.colorMode === "profile" ? (
          <ul className="legend">
            {profiles.map((p) => (
              <li key={p.id}>
                <span className="swatch" style={{ background: p.active.color ?? "#999" }} /> {p.name} (durante a tarefa)
              </li>
            ))}
          </ul>
        ) : sim.colorMode === "plan-vs-actual" ? (
          <ul className="legend">
            {[
              ["Ahead of baseline", PLAN_COLORS.ahead],
              ["On plan", PLAN_COLORS.onPlan],
              ["Behind baseline", PLAN_COLORS.behind],
            ].map(([k, c]) => (
              <li key={k}>
                <span className="swatch" style={{ background: c }} /> {k}
              </li>
            ))}
          </ul>
        ) : (
          <ul className="legend">
            {Object.entries(STATUS_COLORS).map(([k, c]) => (
              <li key={k}>
                <span className="swatch" style={{ background: c }} /> {k.replace("-", " ")}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function CheckTab() {
  const { schedule, elements, links, setLinks, selectElements, selectActivity, setSideTab, setStatus, lastUpdate, scheduleReport, setLeftTab } = useStore();
  const health = useMemo(() => (schedule ? linkHealth(schedule, elements, links) : null), [schedule, elements, links]);
  if (!schedule) return <p className="muted">Importe um cronograma para verificar os vínculos.</p>;
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  const shift = (d: number | null) => (d === null ? "" : d === 0 ? "0d" : `${d > 0 ? "+" : ""}${d}d`);

  const codeToId = new Map((schedule?.activities ?? []).map((a) => [a.code, a.id]));
  return (
    <div className="stack">
      {scheduleReport && (
        <section>
          <h4>Último cálculo do cronograma</h4>
          {scheduleReport.error ? (
            <p className="bad">{scheduleReport.error}</p>
          ) : (
            <p>
              Término do projeto <b>{fmtDate(scheduleReport.projectFinish)}</b>
              {scheduleReport.previousFinish !== null && scheduleReport.previousFinish !== scheduleReport.projectFinish && (
                <span className={scheduleReport.projectFinish > scheduleReport.previousFinish ? "bad" : "good"}>
                  {" "}
                  (anteriormente {fmtDate(scheduleReport.previousFinish)})
                </span>
              )}
              <br />
              {scheduleReport.criticalCount} atividades críticas · {scheduleReport.warnings.length} aviso(s)
            </p>
          )}
          {scheduleReport.warnings.length > 0 && (
            <ul className="list">
              {scheduleReport.warnings.slice(0, 60).map((w) => {
                const code = w.split(":")[0];
                const id = codeToId.get(code);
                return (
                  <li key={w}>
                    {id ? (
                      <button className="link" onClick={() => { selectActivity(id); setLeftTab("activity"); }}>
                        {code}
                      </button>
                    ) : (
                      code
                    )}
                    {w.slice(code.length)}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
      {lastUpdate && (
        <section>
          <h4>Última atualização do cronograma</h4>
          <p>
            Data de corte {fmtDate(lastUpdate.dataDateFrom)} → <b>{fmtDate(lastUpdate.dataDateTo)}</b>
            <br />
            Término do projeto{" "}
            <b className={(lastUpdate.finishShiftDays ?? 0) > 0 ? "bad" : (lastUpdate.finishShiftDays ?? 0) < 0 ? "good" : ""}>
              {lastUpdate.finishShiftDays ? shift(lastUpdate.finishShiftDays) : "unchanged"}
            </b>
            <br />
            {lastUpdate.changed.length} alteradas · {lastUpdate.added.length} adicionadas · {lastUpdate.removed.length} removidas
            <br />
            Vínculos preservados: {lastUpdate.keptLinks}
            {lastUpdate.droppedLinks > 0 && <span className="bad"> · removidos: {lastUpdate.droppedLinks} (atividades removidas)</span>}
          </p>
          {lastUpdate.changed.length > 0 && (
            <table className="props">
              <tbody>
                <tr>
                  <td><b>Atividade</b></td>
                  <td><b>Término / situação</b></td>
                </tr>
                {lastUpdate.changed.slice(0, 30).map((c) => (
                  <tr key={c.code}>
                    <td title={c.name}>{c.code}</td>
                    <td>
                      <span className={(c.finishShiftDays ?? 0) > 0 ? "bad" : (c.finishShiftDays ?? 0) < 0 ? "good" : ""}>{shift(c.finishShiftDays)}</span>{" "}
                      {c.statusFrom !== c.statusTo ? `${c.statusFrom} → ${c.statusTo}` : ""} {c.pctFrom !== c.pctTo ? `${c.pctFrom}→${c.pctTo}%` : ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {lastUpdate.added.length > 0 && (
            <p>
              <b>Novas atividades que precisam de vínculos:</b> {lastUpdate.added.map((a) => a.code).join(", ")}
            </p>
          )}
        </section>
      )}
      {health && (
        <>
          <section>
            <h4>Cobertura</h4>
            <p>
              Atividades de execução vinculadas: <b>{pct(health.coverage.activities)}</b>
              <br />
              Elementos do modelo vinculados: <b>{elements.length ? pct(health.coverage.elements) : "no model"}</b>
            </p>
          </section>
          <section>
            <h4>Atividades sem elementos vinculados ({health.unlinkedActivities.length})</h4>
            {health.unlinkedActivities.length === 0 ? (
              <p className="good">Todas as atividades de execução têm elementos vinculados.</p>
            ) : (
              <ul className="list">
                {health.unlinkedActivities.slice(0, 50).map((a) => (
                  <li key={a.id}>
                    <button className="link" onClick={() => { selectActivity(a.id); setSideTab("selection"); }}>{a.code}</button> {a.name}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h4>Elementos que não aparecem na simulação ({health.unlinkedElements.length})</h4>
            {health.unlinkedElements.length > 0 && (
              <button onClick={() => { selectElements(new Set(health.unlinkedElements.map((e) => e.id))); setStatus(`${health.unlinkedElements.length} elemento(s) sem vínculo selecionado(s).`); }}>
                Selecioná-los no 3D
              </button>
            )}
          </section>
          {health.duplicateInstalls.length > 0 && (
            <section>
              <h4>Instalados por mais de uma atividade ({health.duplicateInstalls.length})</h4>
              <p className="muted">Pode haver dupla contagem. Confira se um dos vínculos deveria usar outro perfil.</p>
              <ul className="list">
                {health.duplicateInstalls.slice(0, 30).map((d) => (
                  <li key={d.element.id}>
                    {d.element.name}: {d.activities.map((a) => a.code).join(", ")}
                  </li>
                ))}
              </ul>
            </section>
          )}
          {(health.orphanActivityLinks.length > 0 || health.orphanElementLinks.length > 0) && (
            <section>
              <h4>Vínculos quebrados</h4>
              <p>
                {health.orphanActivityLinks.length} para atividades ausentes · {health.orphanElementLinks.length} para elementos ausentes no modelo carregado
              </p>
              <button
                onClick={() => {
                  const bad = new Set([...health.orphanActivityLinks, ...health.orphanElementLinks]);
                  setLinks(links.filter((l) => !bad.has(l)));
                  setStatus(`${bad.size} vínculo(s) quebrado(s) removido(s).`);
                }}
              >
                Remover vínculos quebrados
              </button>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ToolsTab() {
  const st = useStore();
  const { selectedElements, selectedActivity, schedule, groups, segments, paths, pathDraft, baseElements, elements } = st;
  const sel = [...selectedElements];
  const [groupName, setGroupName] = useState("");
  const [axis, setAxis] = useState<"x" | "y" | "z">("x");
  const [parts, setParts] = useState(3);
  const [label, setLabel] = useState("Pour");
  const [splitMode, setSplitMode] = useState<"equal" | "at" | "grid">("equal");
  const [cutsText, setCutsText] = useState("30, 60");
  const [grid, setGrid] = useState<[number, number, number]>([2, 2, 1]);
  const cutList = cutsText
    .split(/[,;\s]+/)
    .map((x) => Number(x) / 100)
    .filter((x) => x > 0 && x < 1);
  const [pathName, setPathName] = useState("");
  const [orient, setOrient] = useState(false);
  const act = schedule?.activities.find((a) => a.id === selectedActivity);
  const baseIds = new Set(baseElements.map((e) => e.id));
  // Split works on whole elements; a selected segment means its parent.
  const parentsOf = (ids: string[]) => [...new Set(ids.map((id) => (baseIds.has(id) ? id : elements.find((e) => e.id === id)?.properties.ParentGlobalId ?? id)))];

  return (
    <div className="stack">
      <section>
        <h4>Grupos ({groups.length})</h4>
        <p className="muted">Salve a seleção como um grupo com nome, como uma grua, concretagem ou zona. Use a propriedade «Group» nas regras e na seleção.</p>
        <div className="row">
          <input placeholder="Nome do grupo" value={groupName} onChange={(e) => setGroupName(e.target.value)} />
          <button
            disabled={!sel.length || !groupName.trim()}
            onClick={() => {
              st.setGroups([...groups, { id: crypto.randomUUID(), name: groupName.trim(), color: "#7c3aed", elementIds: sel }]);
              st.setStatus(`Grupo «${groupName.trim()}» salvo com ${sel.length} elemento(s).`);
              setGroupName("");
            }}
          >
            Salvar seleção
          </button>
        </div>
        <ul className="list">
          {groups.map((g) => (
            <li key={g.id}>
              <b>{g.name}</b> ({g.elementIds.length}){" "}
              <button className="link" onClick={() => st.selectElements(new Set(g.elementIds))}>selecionar</button>
              <button className="link" disabled={!sel.length} onClick={() => st.setGroups(groups.map((x) => (x.id === g.id ? { ...x, elementIds: [...new Set([...x.elementIds, ...sel])] } : x)))}>
                adicionar seleção
              </button>
              <button className="link" onClick={() => st.setGroups(groups.filter((x) => x.id !== g.id))}>excluir</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h4>Dividir em trechos de concretagem ou vãos</h4>
        <p className="muted">Divida os elementos selecionados em partes. Você pode vincular cada parte a uma atividade diferente.</p>
        <label>
          Tipo de divisão
          <select value={splitMode} onChange={(e) => setSplitMode(e.target.value as typeof splitMode)}>
            <option value="equal">Partes iguais ao longo de um eixo</option>
            <option value="at">Posições personalizadas ao longo de um eixo</option>
            <option value="grid">Grade: colunas × linhas × camadas</option>
          </select>
        </label>
        {splitMode !== "grid" ? (
          <div className="row">
            <select value={axis} onChange={(e) => setAxis(e.target.value as "x" | "y" | "z")}>
              <option value="x">No eixo X (oeste–leste)</option>
              <option value="z">No eixo Z (sul–norte)</option>
              <option value="y">No eixo Y (altura)</option>
            </select>
            {splitMode === "equal" ? (
              <input type="number" min={2} max={50} value={parts} onChange={(e) => setParts(Number(e.target.value) || 2)} style={{ width: 56 }} title="Número de partes" />
            ) : (
              <input value={cutsText} onChange={(e) => setCutsText(e.target.value)} style={{ width: 96 }} title="Posições de corte em porcentagem do elemento, por exemplo 30 e 60" />
            )}
            <input value={label} onChange={(e) => setLabel(e.target.value)} style={{ width: 70 }} title="Nome da parte" />
          </div>
        ) : (
          <div className="row">
            {(["Columns (X)", "Rows (Z)", "Layers (height)"] as const).map((t, i) => (
              <label key={t} style={{ width: 82 }}>
                {t}
                <input type="number" min={1} max={20} value={grid[i]} onChange={(e) => setGrid(grid.map((g, j) => (j === i ? Math.max(1, Math.min(20, Number(e.target.value) || 1)) : g)) as [number, number, number])} />
              </label>
            ))}
            <input value={label} onChange={(e) => setLabel(e.target.value)} style={{ width: 70 }} title="Nome da parte" />
          </div>
        )}
        {splitMode === "at" && <p className="muted">Informe as posições em porcentagem do elemento. Por exemplo, informe 30 e 60 para criar partes de 30%, 30% e 40%.</p>}
        <div className="row">
          <button
            disabled={!sel.length || (splitMode === "at" && !cutList.length) || (splitMode === "grid" && grid[0] * grid[1] * grid[2] < 2)}
            onClick={() => {
              const targets = parentsOf(sel);
              const rest = segments.filter((s) => !targets.includes(s.parentId));
              const added = targets.flatMap((id) =>
                splitMode === "grid" ? splitGrid(id, grid[0], grid[1], grid[2], label) : splitMode === "at" ? splitAt(id, axis, cutList, label) : splitElement(id, axis, parts, label),
              );
              // Links on the element (or its earlier parts) move to every new part.
              const parentOfId = (id: string) => (targets.includes(id) ? id : segments.find((x) => x.id === id && targets.includes(x.parentId))?.parentId);
              const seen = new Set<string>();
              const linksNext = st.links.flatMap((l) => {
                const parent = parentOfId(l.elementId);
                if (!parent) return [l];
                return added
                  .filter((x) => x.parentId === parent)
                  .map((x) => ({ ...l, elementId: x.id }))
                  .filter((x) => {
                    const k = `${x.elementId}|${x.activityId}`;
                    if (seen.has(k)) return false;
                    seen.add(k);
                    return true;
                  });
              });
              st.setSegments([...rest, ...added]);
              st.setLinks(linksNext);
              st.selectElements(new Set(added.map((s) => s.id)));
              st.setStatus(`${targets.length} elemento(s) dividido(s) em ${added.length / Math.max(1, targets.length)} partes cada. Vincule cada parte à sua atividade.`);
            }}
          >
            Dividir seleção
          </button>
          <button
            disabled={!sel.length || !segments.some((s) => parentsOf(sel).includes(s.parentId))}
            onClick={() => {
              const targets = parentsOf(sel);
              const segIds = new Set(segments.filter((s) => targets.includes(s.parentId)).map((s) => s.id));
              // Parts' links go back to the whole element (deduplicated).
              const seen = new Set<string>();
              const parentOf = new Map(segments.map((x) => [x.id, x.parentId]));
              const linksNext = st.links
                .map((l) => (segIds.has(l.elementId) ? { ...l, elementId: parentOf.get(l.elementId)! } : l))
                .filter((l) => {
                  const k = `${l.elementId}|${l.activityId}`;
                  if (seen.has(k)) return false;
                  seen.add(k);
                  return true;
                });
              st.setSegments(segments.filter((s) => !targets.includes(s.parentId)));
              st.setLinks(linksNext);
              st.selectElements(new Set(targets));
            }}
          >
            Desfazer divisão
          </button>
        </div>
        <p className="muted">{segments.length} parte(s) no modelo.</p>
      </section>

      <section>
        <h4>Trajetos de equipamentos ({paths.length})</h4>
        <p className="muted">Mova os elementos selecionados, como uma grua ou um caminhão, ao longo de um trajeto durante a atividade.</p>
        {!pathDraft ? (
          <>
            <p>
              {sel.length} elemento(s) · atividade: {act ? <b>{act.code}</b> : <span className="muted">selecione no Gantt</span>}
            </p>
            <div className="row">
              <input placeholder="Nome do trajeto" value={pathName} onChange={(e) => setPathName(e.target.value)} />
            </div>
            <label className="check">
              <input type="checkbox" checked={orient} onChange={(e) => setOrient(e.target.checked)} /> Girar na direção do movimento
            </label>
            <button className="primary" disabled={!sel.length || !act} onClick={() => st.setPathDraft([])}>
              Desenhar trajeto em 3D
            </button>
          </>
        ) : (
          <>
            <p>
              Clique nos pontos da vista 3D: <b>{pathDraft.length}</b> posicionado(s).
            </p>
            <div className="row">
              <button
                className="primary"
                disabled={pathDraft.length < 2}
                onClick={() => {
                  st.setPaths([
                    ...paths,
                    { id: crypto.randomUUID(), name: pathName.trim() || `Path ${paths.length + 1}`, activityId: act!.id, elementIds: sel, points: pathDraft, orient },
                  ]);
                  st.setPathDraft(null);
                  setPathName("");
                  st.setStatus("Trajeto salvo. Reproduza a simulação para ver o movimento.");
                }}
              >
                Término
              </button>
              <button disabled={!pathDraft.length} onClick={() => st.setPathDraft(pathDraft.slice(0, -1))}>
                Desfazer último ponto
              </button>
              <button onClick={() => st.setPathDraft(null)}>Cancelar</button>
            </div>
          </>
        )}
        <ul className="list">
          {paths.map((p) => {
            const a = schedule?.activities.find((x) => x.id === p.activityId);
            return (
              <li key={p.id}>
                <b>{p.name}</b> · {a?.code ?? "?"} · {p.elementIds.length} elemento(s), {p.points.length} pontos{" "}
                <button className="link" onClick={() => st.selectElements(new Set(p.elementIds))}>selecionar</button>
                <button className="link" onClick={() => st.setPaths(paths.filter((x) => x.id !== p.id))}>excluir</button>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
