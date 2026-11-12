import { useState } from "react";
import { Icon } from "./brand.jsx";
import { accessOf } from "./access.js";
import { approvalCfg } from "./approval.js";

// ── Réglages → Approbation des demandes ───────────────────────────────────────
export function ApprovalSettings({ T, card, h2, btn, inp, muted, isMobile, cfg, saveCfg, members }) {
  const a = approvalCfg(cfg);
  const [pick, setPick] = useState("");
  const [emails, setEmails] = useState({}); // brouillons d'adresse, enregistrés en quittant le champ
  const save = patch => saveCfg({ approval: { enabled: a.enabled, approvers: a.approvers, categories: a.categories, ...patch } });
  const candidates = members.map(m => m.username).filter(u => !a.approvers.some(x => x.username === u));
  const addApprover = () => { if (!pick) return; save({ approvers: [...a.approvers, { username: pick, email: "" }] }); setPick(""); };
  const setEmail = (u, email) => save({ approvers: a.approvers.map(x => x.username === u ? { ...x, email: email.trim().toLowerCase() } : x) });
  const toggleCat = c => save({ categories: a.categories.includes(c) ? a.categories.filter(x => x !== c) : [...a.categories, c] });
  const chip = (on, label, onClick, key) => (
    <button key={key || label} onClick={onClick} aria-pressed={on}
      style={{ ...btn, padding: "6px 11px", fontSize: 12.5, background: on ? T.text : T.bgCard, borderColor: on ? T.text : T.border, color: on ? T.bg : T.text }}>{label}</button>
  );

  return (
    <section style={card}>
      <h2 style={{ ...h2, marginBottom: 4, display: "flex", alignItems: "center", gap: 8 }}><Icon name="check" />Approbation des demandes</h2>
      <p style={{ ...muted, margin: "0 0 12px" }}>Les demandes concernées passent « À approuver » et ne sont traitées qu'après l'accord d'un approbateur.</p>

      <label htmlFor="ap-enabled" style={{ display: "flex", gap: 10, alignItems: "center", cursor: "pointer", fontSize: 14, fontWeight: 600, marginBottom: 14 }}>
        <input type="checkbox" id="ap-enabled" checked={a.enabled} onChange={e => save({ enabled: e.target.checked })} style={{ width: 18, height: 18, accentColor: T.accent }} />
        Les nouvelles demandes doivent être approuvées
      </label>

      <div style={{ opacity: a.enabled ? 1 : .55, display: "flex", flexDirection: "column", gap: 14 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textFaint, marginBottom: 8 }}>Qui approuve</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {a.approvers.length === 0 && <div style={{ fontSize: 13, color: a.enabled ? T.orange : T.textFaint }}>Aucun approbateur : tant que la liste est vide, les demandes ne sont pas soumises à approbation.</div>}
            {a.approvers.map(x => {
              const m = members.find(mm => mm.username === x.username);
              const noAccess = !m || accessOf(m).etude === "none";
              return (
                <div key={x.username} style={{ border: `1px solid ${T.borderLight}`, background: T.bgHover, borderRadius: 10, padding: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <span style={{ fontWeight: 600, fontSize: 14, minWidth: 90 }}>{x.username}</span>
                  <input id={`ap-mail-${x.username}`} type="email" inputMode="email" aria-label={`Adresse mail de ${x.username}`}
                    style={{ ...inp, flex: "1 1 200px", width: "auto", padding: "7px 9px" }} placeholder="Adresse pour être prévenu (facultatif)"
                    value={emails[x.username] ?? x.email} onChange={e => setEmails(d => ({ ...d, [x.username]: e.target.value }))}
                    onBlur={e => { if (e.target.value.trim().toLowerCase() !== x.email) setEmail(x.username, e.target.value); }} />
                  <button onClick={() => save({ approvers: a.approvers.filter(y => y.username !== x.username) })} aria-label={`Retirer ${x.username}`}
                    style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 14, padding: "4px 6px" }}>✕</button>
                  {noAccess && <div style={{ width: "100%", fontSize: 12, color: T.orange }}>{x.username} n'a pas accès à l'Administration : donne-lui l'accès « Utilisateur » ou « Admin » (Lunch → Config → Membres) pour qu'il puisse approuver.</div>}
                </div>
              );
            })}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <select id="ap-pick" value={pick} onChange={e => setPick(e.target.value)} style={{ ...inp, flex: 1, width: "auto" }} aria-label="Ajouter un approbateur">
              <option value="">Choisir une personne…</option>
              {candidates.map(u => <option key={u} value={u}>{u}</option>)}
            </select>
            <button style={{ ...btn, opacity: pick ? 1 : .5 }} disabled={!pick} onClick={addApprover}>Ajouter</button>
          </div>
        </div>

        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textFaint, marginBottom: 8 }}>Pour quelles demandes</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {chip(a.categories.length === 0, "Toutes", () => save({ categories: [] }), "__all")}
            {cfg.ticketCategories.map(c => chip(a.categories.includes(c), c, () => toggleCat(c), c))}
          </div>
          <div style={{ ...muted, marginTop: 6 }}>{a.categories.length ? `Seules les demandes « ${a.categories.join(" », « ")} » demandent une approbation.` : "Toutes les demandes demandent une approbation."}</div>
        </div>

        <div style={{ fontSize: 12.5, color: T.textSub, background: T.bgHover, borderRadius: 10, padding: "10px 12px", lineHeight: 1.5 }}>
          Un seul accord suffit. Personne n'approuve sa propre demande : si le demandeur est le seul approbateur, sa demande est approuvée automatiquement.
          {isMobile ? " " : <br />}Les approbateurs avec une adresse reçoivent un mail à chaque nouvelle demande à approuver.
        </div>
      </div>
    </section>
  );
}
