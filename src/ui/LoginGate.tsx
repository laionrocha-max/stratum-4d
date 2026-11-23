// Sign-in screen for the hosted web build. Only active when the build sets
// VITE_LOGIN_HASH (SHA-256 of "user:password"); the desktop app and local
// builds skip it. It runs in the browser, so it keeps out casual visitors but
// is not server-side security.
//
// A public demo account (VITE_DEMO_USER / VITE_DEMO_PASS) is shown on the page
// with copy buttons, so visitors can try the app; the owner's own account
// (the hash) is not shown anywhere.

import { Check, Copy } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { endDemoSession } from "../backend/demo";

const HASH = (import.meta.env.VITE_LOGIN_HASH as string | undefined)?.trim().toLowerCase() || "";
const DEMO_USER = (import.meta.env.VITE_DEMO_USER as string | undefined)?.trim() || "";
const DEMO_PASS = (import.meta.env.VITE_DEMO_PASS as string | undefined) || "";
const KEY = "stratum.login.v1";
const BASE = import.meta.env.BASE_URL;

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const signedIn = () => {
  try {
    const v = localStorage.getItem(KEY);
    return v === HASH || (!!DEMO_USER && v === `demo:${DEMO_USER}`);
  } catch {
    return false;
  }
};

/** Sign out; in the demo this also ends the session, so the next sign-in starts with fresh samples. */
export async function signOut() {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
  await endDemoSession();
  location.reload();
}

export const loginEnabled = !!HASH;

function CopyField({ label, value }: { label: string; value: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
    } catch {
      // Older browsers: select a temporary field and copy.
      const t = document.createElement("textarea");
      t.value = value;
      document.body.appendChild(t);
      t.select();
      document.execCommand("copy");
      t.remove();
    }
    setDone(true);
    setTimeout(() => setDone(false), 1500);
  };
  return (
    <div className="login-demo-row">
      <span className="login-demo-k">{label}</span>
      <code>{value}</code>
      <button type="button" className="login-copy" onClick={() => void copy()} aria-label={`Copiar ${label.toLowerCase()}`} title={`Copiar ${label.toLowerCase()}`}>
        {done ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
        <span>{done ? "Copiado" : "Copiar"}</span>
      </button>
    </div>
  );
}

export function LoginGate({ children }: { children: ReactNode }) {
  const [ok, setOk] = useState(() => !HASH || signedIn());
  const [user, setUser] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  if (ok) return <>{children}</>;
  const remember = (v: string) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      /* session only */
    }
  };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const u = user.trim();
    if (DEMO_USER && u.toLowerCase() === DEMO_USER.toLowerCase() && pass === DEMO_PASS) {
      remember(`demo:${DEMO_USER}`);
      setBusy(false);
      setOk(true);
      return;
    }
    const h = await sha256(`${u}:${pass}`);
    setBusy(false);
    if (h === HASH) {
      remember(HASH);
      setOk(true);
    } else setErr("Usuário ou senha incorretos.");
  };
  const year = new Date().getFullYear();
  return (
    <div className="login-page">
      <main className="login-main">
        <section className="login-brand" aria-label="Stratum 4D">
          <img className="login-lockup" src={`${BASE}stratum-lockup-dark.png`} alt="Stratum 4D" />
          <h2>Planejamento e simulação 4D de obras</h2>
          <ul>
            <li>Layouts do Primavera P6 e do Microsoft Project, com cálculo do caminho crítico</li>
            <li>Vincule o cronograma ao modelo IFC e reproduza a sequência dia a dia</li>
            <li>Painéis, relatórios e valor agregado com os mesmos dados</li>
          </ul>
        </section>

        <section className="login-panel">
          <form className="login-card" onSubmit={submit}>
            <img className="login-logo" src={`${BASE}miqyas-labs.png`} alt="Miqyas Labs" />
            <h1>Entrar no Stratum 4D</h1>
            <p className="login-sub">Demonstração web. Seus cronogramas ficam neste navegador.</p>
            <label>
              Usuário
              <input autoFocus autoComplete="username" value={user} onChange={(e) => (setUser(e.target.value), setErr(""))} />
            </label>
            <label>
              Senha
              <input type="password" autoComplete="current-password" value={pass} onChange={(e) => (setPass(e.target.value), setErr(""))} />
            </label>
            {err && (
              <p className="login-err" role="alert">
                {err}
              </p>
            )}
            <button className="primary login-submit" type="submit" disabled={busy || !user || !pass}>
              Entrar
            </button>

            {DEMO_USER && DEMO_PASS && (
              <div className="login-demo" aria-label="Conta de demonstração">
                <div className="login-demo-head">
                  <b>Conta de demonstração</b>
                  <button type="button" className="login-fill" onClick={() => (setUser(DEMO_USER), setPass(DEMO_PASS), setErr(""))}>
                    Preencher
                  </button>
                </div>
                <CopyField label="Usuário" value={DEMO_USER} />
                <CopyField label="Senha" value={DEMO_PASS} />
                <p className="login-sub">A demonstração abre projetos de exemplo. Os dados ficam neste navegador.</p>
              </div>
            )}
          </form>
        </section>
      </main>

      <footer className="login-foot">
        <span>© {year} Miqyas Labs. Todos os direitos reservados.</span>
        <nav aria-label="Links">
          <a href="https://miqyaslabs.com/">Página inicial</a>
          <a href="https://miqyaslabs.com/manual/">Manual do usuário</a>
          <a href="https://miqyaslabs.com/#download">Baixar</a>
          <a href="https://www.linkedin.com/in/junaidquamar/" target="_blank" rel="noopener noreferrer">
            Desenvolvido por Junaid Quamar
          </a>
        </nav>
      </footer>
    </div>
  );
}
