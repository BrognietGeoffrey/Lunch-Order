import { useState } from "react";
import { Icon } from "./brand.jsx";
import { EMAIL_RE, WEEKDAYS, DEFAULT_RECIPIENT, recipientsOf, describeSchedule } from "./alertRules.js";

// ── Réglages → Alertes par mail : un réglage par destinataire ────────────────
export function AlertSettings({ T, card, h2, btn, inp, muted, isMobile, cfg, saveCfg, showToast }) {
  const list = recipientsOf(cfg);
  const [mail, setMail] = useState("");
  const [testing, setTesting] = useState("");
  const mailOk = EMAIL_RE.test(mail.trim()) && !list.some(r => r.email === mail.trim().toLowerCase());

  const save = next => saveCfg({ alertRecipients: next, alertEmails: next.map(r => r.email) });
  const patch = (email, p) => save(list.map(r => r.email === email ? { ...r, ...p } : r));
  const add = () => { if (!mailOk) return; save([...list, { email: mail.trim().toLowerCase(), ...DEFAULT_RECIPIENT, days: [...DEFAULT_RECIPIENT.days] }]); setMail(""); };
  const remove = email => save(list.filter(r => r.email !== email));
  const toggleDay = (r, id) => patch(r.email, { days: r.days.includes(id) ? r.days.filter(d => d !== id) : [...r.days, id] });
  const test = async email => {
    setTesting(email || "all");
    try {
      const res = await fetch("/api/stock-alert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "test", email }) });
      const j = await res.json().catch(() => ({}));
      if (res.ok) showToast(email ? `Mail de test envoyé à ${email}` : `Mail de test envoyé à ${j.sent} adresse${j.sent > 1 ? "s" : ""}`);
      else showToast(j.error || `Échec de l'envoi (${res.status})`, "error");
    } catch { showToast("Le serveur ne répond pas. Réessaie une fois l'app déployée.", "error"); }
    setTesting("");
  };

  // Le récap n'est envoyé que lors d'un passage du planificateur (Vercel 1×/jour, ou déclencheur horaire)
  const last = cfg.digestLastRun;
  const ageH = last ? (new Date().getTime() - last) / 3600000 : null;
  const needsHourly = list.some(r => r.digest && r.hour > 7);

  const check = (id, on, onChange, label) => (
    <label htmlFor={id} style={{ display: "inline-flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13.5, fontWeight: 600 }}>
      <input type="checkbox" id={id} checked={on} onChange={e => onChange(e.target.checked)} style={{ width: 18, height: 18, accentColor: T.accent }} />{label}
    </label>
  );

  return (
    <section style={card}>
      <h2 style={{ ...h2, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><Icon name="mail" />Alertes par mail</h2>
      <p style={{ ...muted, margin: "0 0 14px" }}>Pour chaque personne, choisis si elle reçoit le mail immédiat et le récapitulatif, avec ses jours et son heure (heure de Bruxelles).</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 14 }}>
        {list.length === 0 && <div style={{ ...muted, color: T.orange, fontSize: 13 }}>Aucun destinataire : aucun mail ne part pour l'instant.</div>}
        {list.map((r, i) => (
          <div key={r.email} style={{ border: `1px solid ${T.borderLight}`, borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 10, background: T.bgHover }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ flex: 1, minWidth: 160, fontWeight: 600, fontSize: 14, overflowWrap: "anywhere" }}>{r.email}</span>
              <button style={{ ...btn, padding: "5px 10px", fontSize: 12 }} disabled={!!testing} onClick={() => test(r.email)}>{testing === r.email ? "Envoi…" : "Tester"}</button>
              <button onClick={() => remove(r.email)} aria-label={`Retirer ${r.email}`} style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>✕</button>
            </div>
            <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
              {check(`al-inst-${i}`, r.instant, v => patch(r.email, { instant: v }), "Mail immédiat")}
              {check(`al-dig-${i}`, r.digest, v => patch(r.email, { digest: v }), "Récapitulatif")}
            </div>
            {r.digest && (
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <div role="group" aria-label="Jours du récapitulatif" style={{ display: "flex", gap: 4 }}>
                  {WEEKDAYS.map(w => {
                    const on = r.days.includes(w.id);
                    return (
                      <button key={w.id} onClick={() => toggleDay(r, w.id)} aria-pressed={on} title={w.label}
                        style={{ width: isMobile ? 34 : 32, height: isMobile ? 34 : 32, borderRadius: 16, border: `1px solid ${on ? T.text : T.border}`, background: on ? T.text : T.bgCard, color: on ? T.bg : T.textSub, fontSize: 12.5, fontWeight: 700, cursor: "pointer", padding: 0 }}>
                        {w.short}
                      </button>
                    );
                  })}
                </div>
                <label htmlFor={`al-hour-${i}`} style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: T.textSub }}>à
                  <select id={`al-hour-${i}`} value={r.hour} onChange={e => patch(r.email, { hour: Number(e.target.value) })} style={{ ...inp, width: "auto", padding: "6px 8px" }}>
                    {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{h} h</option>)}
                  </select>
                </label>
              </div>
            )}
            <div style={{ fontSize: 12, color: T.textFaint }}>
              {[r.instant ? "Mail immédiat dès qu'un article est à commander" : "Pas de mail immédiat", describeSchedule(r)].join(" · ")}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input id="cfg-mail" type="email" inputMode="email" autoComplete="email" style={{ ...inp, flex: 1 }} value={mail} onChange={e => setMail(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} placeholder="adresse@exemple.be" />
        <button style={{ ...btn, opacity: mailOk ? 1 : .5 }} disabled={!mailOk} onClick={add}>Ajouter</button>
      </div>

      <div style={{ fontSize: 12.5, color: T.textSub, background: T.bgHover, borderRadius: 10, padding: "10px 12px", lineHeight: 1.5 }}>
        <strong style={{ color: T.text }}>Envois programmés</strong> · {last ? `dernière vérification ${ageH < 1 ? "il y a moins d'une heure" : `il y a ${Math.round(ageH)} h`}` : "pas encore de vérification"}.
        {" "}Le récap part au premier passage du planificateur après l'heure choisie (un seul par jour et par personne), et seulement s'il reste des articles à commander.
        {needsHourly && <span style={{ display: "block", marginTop: 6, color: ageH != null && ageH > 1.5 ? T.orange : T.textSub }}>
          Pour une heure après 7 h, il faut une vérification toutes les heures (déclencheur horaire). Sans lui, ces récaps ne partent pas.
        </span>}
      </div>
    </section>
  );
}
