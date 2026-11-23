// First-run setup: interface mode, where data lives, optional P6 and email.
// Everything here can be changed later in Settings.

import { useState } from "react";
import { isDesktop, useConfig } from "../backend/config";
import { serverLogin, serverSetup, serverStatus } from "../backend/server";
import type { InterfaceMode } from "../core/reporting";
import { MODE_INFO } from "./terms";

type Step = "mode" | "storage" | "done";

export function SetupWizard({ onDone }: { onDone: (openSettings?: "p6" | "email") => void }) {
  const { config, update } = useConfig();
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<InterfaceMode>(config.mode);
  const [storage, setStorage] = useState<"local" | "server">(config.storage === "server" ? "server" : "local");
  const [url, setUrl] = useState(config.serverUrl || (location.protocol.startsWith("http") ? location.origin : ""));
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const desktop = isDesktop();

  const checkServer = async () => {
    setBusy(true);
    setMsg("");
    try {
      const st = await serverStatus(url);
      setNeedsSetup(st.needsSetup);
      update({ serverPdf: st.pdf });
      setMsg(st.needsSetup ? "New server: create the first administrator account." : "Server found. Sign in.");
    } catch (e) {
      setNeedsSetup(null);
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const connect = async () => {
    setBusy(true);
    setMsg("");
    try {
      const r = needsSetup ? await serverSetup(url, email, name, password) : await serverLogin(url, email, password);
      update({ storage: "server", serverUrl: url, token: r.token, user: r.user });
      setStep("done");
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const finish = (open?: "p6" | "email") => {
    update({ configured: true, mode });
    onDone(open);
  };

  return (
    <div className="help-backdrop">
      <div className="help wizard" role="dialog" aria-label="Configurar o Stratum">
        <img src="./stratum-lockup.png" alt="Stratum 4D by Miqyas Labs" className="help-logo logo-light" />
        <img src="./stratum-lockup-dark.png" alt="" aria-hidden className="help-logo logo-dark" />
        {step === "mode" && (
          <>
            <h2>Qual layout você prefere?</h2>
            <p className="muted">Escolha o layout que você prefere. Você pode trocar de layout a qualquer momento nas configurações.</p>
            <div className="mode-cards">
              {(Object.keys(MODE_INFO) as InterfaceMode[]).map((m) => (
                <button key={m} className={`mode-card ${mode === m ? "active" : ""}`} onClick={() => setMode(m)}>
                  <b>{MODE_INFO[m].title}</b>
                  <span className="muted">{MODE_INFO[m].blurb}</span>
                  <ul>
                    {MODE_INFO[m].points.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </button>
              ))}
            </div>
            <div className="row end">
              <button className="primary" onClick={() => setStep("storage")}>
                Avançar
              </button>
            </div>
          </>
        )}

        {step === "storage" && (
          <>
            <h2>Onde você quer armazenar os projetos?</h2>
            <div className="mode-cards two">
              <button className={`mode-card ${storage === "local" ? "active" : ""}`} onClick={() => setStorage("local")}>
                <b>Neste {desktop ? "computador" : "navegador"}</b>
                <span className="muted">
                  {desktop
                    ? "A local database file in your profile. Works offline. Scheduled reports go out while Stratum is open."
                    : "Saved in this browser only. For P6 connections and emailed reports, use the desktop app or a Stratum Server."}
                </span>
              </button>
              <button className={`mode-card ${storage === "server" ? "active" : ""}`} onClick={() => setStorage("server")}>
                <b>Servidor Stratum (compartilhado)</b>
                <span className="muted">Um banco de dados para toda a equipe, com login e permissões. Os relatórios programados são enviados por e-mail mesmo com os computadores desligados.</span>
              </button>
            </div>
            {storage === "server" && (
              <div className="stack server-form">
                <label>
                  Endereço do servidor
                  <div className="row">
                    <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://stratum.yourcompany.com" style={{ flex: 1 }} />
                    <button onClick={checkServer} disabled={!url || busy}>
                      Verificar
                    </button>
                  </div>
                </label>
                {needsSetup !== null && (
                  <>
                    {needsSetup && (
                      <label>
                        Seu nome
                        <input value={name} onChange={(e) => setName(e.target.value)} />
                      </label>
                    )}
                    <label>
                      E-mail
                      <input value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
                    </label>
                    <label>
                      Senha{needsSetup ? " (at least 8 characters)" : ""}
                      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={needsSetup ? "new-password" : "current-password"} />
                    </label>
                  </>
                )}
              </div>
            )}
            {msg && <p className={/error|cannot|wrong|invalid|failed/i.test(msg) ? "bad" : "muted"}>{msg}</p>}
            <div className="row end">
              <button onClick={() => setStep("mode")}>Voltar</button>
              {storage === "local" ? (
                <button
                  className="primary"
                  onClick={() => {
                    update({ storage: "local" });
                    setStep("done");
                  }}
                >
                  Avançar
                </button>
              ) : (
                <button className="primary" disabled={needsSetup === null || !email || !password || busy} onClick={connect}>
                  {needsSetup ? "Create admin and connect" : "Entrar"}
                </button>
              )}
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <h2>Tudo pronto</h2>
            <p>
              {MODE_INFO[mode].title} · {useConfig.getState().backend.label}
            </p>
            {useConfig.getState().backend.caps.p6 ? (
              <p className="muted">Você pode conectar ao Primavera P6 (EPPM ou P6 Professional) e configurar o envio de relatórios por e-mail agora ou depois em Configurações.</p>
            ) : (
              <p className="muted">Para conectar ao P6 ou enviar relatórios por e-mail, use o aplicativo para computador ou o servidor Stratum.</p>
            )}
            <div className="row end">
              {useConfig.getState().backend.caps.p6 && <button onClick={() => finish("p6")}>Conectar ao P6…</button>}
              {useConfig.getState().backend.caps.email && <button onClick={() => finish("email")}>Configurar e-mail…</button>}
              <button className="primary" onClick={() => finish()}>
                Início
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
