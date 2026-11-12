import { useState } from "react";
import { BrandLogo, Icon } from "./brand.jsx";
import { authApi } from "./authClient.js";
import { checkSecret, secretKind } from "./secretPolicy.js";

// ── Compte : code personnel et email de travail ───────────────────────────────
const styles = T => ({
  inp: { width: "100%", fontSize: 15, border: `1px solid ${T.border}`, background: T.bgInput, color: T.text, borderRadius: 8, padding: "11px 12px", fontFamily: "inherit", boxSizing: "border-box" },
  lbl: { display: "flex", flexDirection: "column", gap: 6, fontSize: 11, fontWeight: 600, color: T.textSub, letterSpacing: "0.1em", textTransform: "uppercase" },
  btn: { background: T.bgCard, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "10px 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  primary: { background: T.text, border: `1px solid ${T.text}`, color: T.bg, borderRadius: 8, padding: "11px 18px", fontSize: 14.5, fontWeight: 600, cursor: "pointer" },
  link: { background: "transparent", border: "none", color: T.textSub, fontSize: 13, cursor: "pointer", textDecoration: "underline", padding: 0 },
  err: { color: T.red, fontSize: 13 },
  ok: { color: T.green, fontSize: 13 },
});

// Saisie d'un nouveau code (PIN ≥ 6 chiffres ou mot de passe ≥ 8 caractères)
export function SecretForm({ T, username, requireCurrent, submitLabel = "Enregistrer", onSubmit, idPrefix = "sf", autoFocus = true }) {
  const S = styles(T);
  const [cur, setCur] = useState(""), [a, setA] = useState(""), [b, setB] = useState("");
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false), [err, setErr] = useState("");
  const policy = a ? checkSecret(a, username) : "";
  const mismatch = b && a !== b;
  const ok = a && !policy && a === b && (!requireCurrent || cur) && !busy;
  const submit = async () => {
    if (!ok) return;
    setBusy(true); setErr("");
    try { await onSubmit(a, cur); setA(""); setB(""); setCur(""); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const type = show ? "text" : "password";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {requireCurrent && <label style={S.lbl}>Code actuel<input id={`${idPrefix}-cur`} type={type} autoComplete="current-password" style={S.inp} value={cur} onChange={e => setCur(e.target.value)} /></label>}
      <label style={S.lbl}>Nouveau code ou mot de passe
        <input id={`${idPrefix}-new`} type={type} autoComplete="new-password" style={S.inp} value={a} onChange={e => setA(e.target.value)} autoFocus={autoFocus && !requireCurrent} />
      </label>
      <div style={{ fontSize: 12.5, color: policy ? T.orange : a ? T.green : T.textFaint, marginTop: -4 }}>
        {policy || (a ? (secretKind(a) === "pin" ? "✓ Code PIN valide" : "✓ Mot de passe valide") : "Code PIN de 6 chiffres minimum, ou mot de passe de 8 caractères minimum.")}
      </div>
      <label style={S.lbl}>Confirmer
        <input id={`${idPrefix}-confirm`} type={type} autoComplete="new-password" style={S.inp} value={b} onChange={e => setB(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
      </label>
      {mismatch && <div style={{ ...S.err, marginTop: -4 }}>Les deux saisies ne correspondent pas.</div>}
      <label htmlFor={`${idPrefix}-show`} style={{ display: "inline-flex", gap: 8, alignItems: "center", fontSize: 13, color: T.textSub, cursor: "pointer" }}>
        <input id={`${idPrefix}-show`} type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />Afficher
      </label>
      {err && <div role="alert" style={S.err}>{err}</div>}
      <button style={{ ...S.primary, opacity: ok ? 1 : .5 }} disabled={!ok} onClick={submit}>{busy ? "Enregistrement…" : submitLabel}</button>
    </div>
  );
}

// Lier son email de travail (code de vérification envoyé par mail)
export function EmailLink({ T, auth, email, onChange, idPrefix = "el" }) {
  const S = styles(T);
  const [val, setVal] = useState(""), [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState(""), [busy, setBusy] = useState(""), [err, setErr] = useState(""), [info, setInfo] = useState("");
  const run = async (key, fn) => { setBusy(key); setErr(""); setInfo(""); try { await fn(); } catch (e) { setErr(e.message); } setBusy(""); };
  const start = to => run("start", async () => { const r = await authApi("emailStart", { email: to }, auth); setSentTo(r.email); setCode(""); setInfo(`Code envoyé à ${r.email}. Regarde ta boîte de réception (et les indésirables).`); });
  const verify = () => run("verify", async () => { const r = await authApi("emailVerify", { code }, auth); setSentTo(""); setVal(""); onChange(r.email); setInfo("Adresse liée."); });
  const remove = () => run("remove", async () => { await authApi("emailRemove", {}, auth); onChange(""); setInfo("Adresse retirée."); });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {email && !sentTo && (
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", background: T.bgHover, border: `1px solid ${T.borderLight}`, borderRadius: 10, padding: "10px 12px" }}>
          <Icon name="mail" size={17} />
          <span style={{ flex: 1, minWidth: 160, fontSize: 14, fontWeight: 600, overflowWrap: "anywhere" }}>{email}</span>
          <span style={{ fontSize: 12, color: T.green, fontWeight: 600 }}>✓ vérifiée</span>
          <button style={{ ...S.link }} disabled={!!busy} onClick={remove}>Retirer</button>
        </div>
      )}
      {!sentTo ? (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input id={`${idPrefix}-email`} type="email" inputMode="email" autoComplete="email" style={{ ...S.inp, flex: "1 1 220px", width: "auto" }} value={val} onChange={e => setVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && val.trim() && start(val.trim())} placeholder={email ? "Changer d'adresse…" : "prenom.nom@etude.be"} />
          <button style={{ ...S.btn, opacity: val.trim() ? 1 : .5 }} disabled={!val.trim() || !!busy} onClick={() => start(val.trim())}>{busy === "start" ? "Envoi…" : "Envoyer un code"}</button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input id={`${idPrefix}-code`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} style={{ ...S.inp, flex: "1 1 140px", width: "auto", letterSpacing: "0.3em", fontSize: 18, fontWeight: 600 }}
            value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ""))} onKeyDown={e => e.key === "Enter" && code.length === 6 && verify()} placeholder="000000" />
          <button style={{ ...S.primary, opacity: code.length === 6 ? 1 : .5 }} disabled={code.length !== 6 || !!busy} onClick={verify}>{busy === "verify" ? "Vérification…" : "Valider"}</button>
          <button style={S.link} disabled={!!busy} onClick={() => start(sentTo)}>Renvoyer</button>
          <button style={S.link} disabled={!!busy} onClick={() => { setSentTo(""); setInfo(""); }}>Changer d'adresse</button>
        </div>
      )}
      {err && <div role="alert" style={S.err}>{err}</div>}
      {info && !err && <div style={S.ok}>{info}</div>}
      <div style={{ fontSize: 12, color: T.textFaint, lineHeight: 1.5 }}>Ton adresse sert à te connecter avec ton email, à recevoir un code si tu oublies ton mot de passe, et à recevoir tes notifications (par exemple la réponse à tes demandes).</div>
    </div>
  );
}

// Écran imposé après connexion : nouveau code obligatoire, puis proposition de lier l'email
export function ForcedSetup({ T, auth, account, username, isDark, onDone, onLogout }) {
  const S = styles(T);
  const [step, setStep] = useState(account.mustChange ? "secret" : "email");
  const [email, setEmail] = useState(account.email || "");
  return (
    <div style={{ minHeight: "100vh", background: T.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: "32px 16px", fontFamily: "'DM Sans',sans-serif", color: T.text }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 22 }}>
          <BrandLogo variant="mono" height={36} onDark={isDark} />
          <div style={{ fontSize: 12, color: T.textFaint, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 600 }}>Étape {step === "secret" ? 1 : 2} sur 2 · Sécurité du compte</div>
        </div>
        <div style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 14, padding: "24px 22px", boxShadow: T.shadow }}>
          {step === "secret" ? (
            <>
              <h1 style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 22, margin: "0 0 6px" }}>Choisis ton nouveau code, {username}</h1>
              <p style={{ fontSize: 14, color: T.textSub, margin: "0 0 18px", lineHeight: 1.5 }}>Pour sécuriser l'application, chacun choisit son propre code. L'ancien code ne fonctionnera plus.</p>
              <SecretForm T={T} username={username} idPrefix="fs" submitLabel="Continuer"
                onSubmit={async s => { await authApi("setSecret", { secret: s }, auth); setStep(email ? "done" : "email"); if (email) onDone({ ...account, mustChange: false, email }); }} />
            </>
          ) : (
            <>
              <h1 style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 22, margin: "0 0 6px" }}>Lier ton email de travail</h1>
              <p style={{ fontSize: 14, color: T.textSub, margin: "0 0 18px", lineHeight: 1.5 }}>Facultatif, mais conseillé : sans email, seul un administrateur pourra te débloquer si tu oublies ton code.</p>
              <EmailLink T={T} auth={auth} email={email} onChange={e => { setEmail(e); if (e) onDone({ ...account, mustChange: false, email: e }); }} idPrefix="fe" />
              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
                <button style={S.btn} onClick={() => onDone({ ...account, mustChange: false, email })}>Plus tard</button>
              </div>
            </>
          )}
        </div>
        <button onClick={onLogout} style={{ ...S.link, marginTop: 16, display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}><Icon name="logout" size={15} />Se déconnecter</button>
      </div>
    </div>
  );
}

// « Mon compte » : changer son code, gérer son email
export function AccountModal({ T, auth, account, username, isMobile, onClose, onAccountChange }) {
  const [msg, setMsg] = useState("");
  const legacy = !account || account.legacy;
  return (
    <div role="dialog" aria-modal="true" aria-label="Mon compte" onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 90, background: "rgba(0,0,0,.45)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 16 }}>
      <div style={{ background: T.bgCard, color: T.text, width: "100%", maxWidth: 480, maxHeight: "92vh", overflowY: "auto", borderRadius: isMobile ? "16px 16px 0 0" : 16, boxShadow: T.shadowHover, padding: `20px 20px calc(20px + env(safe-area-inset-bottom, 0px))`, fontFamily: "'DM Sans',sans-serif" }}>
        <div style={{ display: "flex", alignItems: "center", marginBottom: 14 }}>
          <div style={{ flex: 1, fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 20 }}>Mon compte · {username}</div>
          <button onClick={onClose} aria-label="Fermer" style={{ background: "transparent", border: "none", color: T.textFaint, fontSize: 18, cursor: "pointer" }}>✕</button>
        </div>
        {legacy ? (
          <p style={{ fontSize: 14, color: T.textSub, lineHeight: 1.5 }}>La connexion sécurisée n'est pas encore activée sur le serveur. Un administrateur doit d'abord terminer la configuration.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
            <section>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><Icon name="mail" size={16} />Email de travail</div>
              <EmailLink T={T} auth={auth} email={account.email} onChange={e => onAccountChange({ ...account, email: e })} idPrefix="am-el" />
            </section>
            <section>
              <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><Icon name="settings" size={16} />Changer mon code</div>
              <SecretForm T={T} username={username} requireCurrent idPrefix="am-sf" submitLabel="Changer mon code"
                onSubmit={async (s, cur) => { await authApi("setSecret", { secret: s, current: cur }, auth); setMsg("Ton code a été changé."); }} />
              {msg && <div style={{ color: T.green, fontSize: 13, marginTop: 8 }}>{msg}</div>}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
