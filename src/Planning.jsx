import { useState, useEffect, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

// ── Planning (profil « planning uniquement ») ─────────────────────────────────
// Données : Firestore config/planning  →  { cards:[{id,name,slots:[{id,start,end,type,label}]}], statuses:[{id,label,color}], updatedAt, updatedBy }

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const toMin = t => { if (!/^\d{1,2}:\d{2}$/.test(t || "")) return NaN; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = m => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmtDur = m => { if (!(m > 0)) return "—"; const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${r ? String(r).padStart(2, "0") : ""}` : `${r} min`; };
// Statuts de départ, utilisés seulement tant que config/planning n'a pas encore de liste « statuses »
const DEFAULT_STATUSES = [
  { id: "free", label: "Libre", color: "#2f9e44" },
  { id: "busy", label: "Occupé", color: "#c92a2a" },
  { id: "pause", label: "Pause", color: "#868e96" },
];
const SWATCHES = ["#2f9e44", "#74b816", "#f59f00", "#e8590c", "#c92a2a", "#d6336c", "#ae3ec9", "#7048e8", "#1c7ed6", "#0c8599", "#868e96", "#495057"];
const rgba = (hex, a) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return `rgba(134,142,150,${a})`; const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const sortByTime = slots => [...slots].sort((a, b) => (toMin(a.start) || 0) - (toMin(b.start) || 0));
const swap = (arr, i, j) => { const a = [...arr]; [a[i], a[j]] = [a[j], a[i]]; return a; };

export default function Planning({ db, T, user, isDark, toggleTheme, onLogout, isMobile }) {
  const [cards, setCards] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [saveState, setSaveState] = useState("idle"); // idle | saving | saved | error
  const [confirm, setConfirm] = useState(null);
  const saveTimer = useRef(null);
  const dirty = useRef(false);
  const version = useRef(0);
  const drag = useRef(null);
  const [overId, setOverId] = useState(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [printSel, setPrintSel] = useState([]);
  const [onePerPage, setOnePerPage] = useState(false);
  const [printing, setPrinting] = useState(null); // ids des cartes à imprimer
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES);
  const [statusOpen, setStatusOpen] = useState(false);
  const [newStatus, setNewStatus] = useState({ label: "", color: SWATCHES[2] });

  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(null);
    window.addEventListener("afterprint", done);
    const t = setTimeout(() => window.print(), 50); // laisse le temps au rendu de la feuille
    return () => { clearTimeout(t); window.removeEventListener("afterprint", done); };
  }, [printing]);

  const openPrint = () => { setPrintSel(cards.map(c => c.id)); setPrintOpen(true); };
  const togglePrint = id => setPrintSel(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  const launchPrint = () => { if (!printSel.length) return; setPrintOpen(false); setPrinting(cards.filter(c => printSel.includes(c.id)).map(c => c.id)); };

  const ref = doc(db, "config", "planning");

  useEffect(() => onSnapshot(ref, s => {
    if (s.metadata.hasPendingWrites || dirty.current) return; // on ignore l'écho de nos propres écritures
    const d = s.exists() ? s.data() : {};
    setCards(Array.isArray(d.cards) ? d.cards : []);
    setStatuses(Array.isArray(d.statuses) && d.statuses.length ? d.statuses : DEFAULT_STATUSES);
    setLoaded(true);
  }, () => setLoaded(true)), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const commit = (next, nextStatuses = statuses) => {
    setCards(next);
    setStatuses(nextStatuses);
    dirty.current = true;
    setSaveState("saving");
    const v = ++version.current;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await setDoc(ref, { cards: next, statuses: nextStatuses, updatedAt: Date.now(), updatedBy: user });
        if (v === version.current) setSaveState("saved");
      } catch (e) {
        console.error("Planning : sauvegarde échouée", e);
        setSaveState("error");
      } finally { if (v === version.current) dirty.current = false; }
    }, 500);
  };

  const updCard = (ci, patch) => commit(cards.map((c, i) => i === ci ? { ...c, ...patch } : c));
  const updSlot = (ci, si, patch) => updCard(ci, { slots: cards[ci].slots.map((s, i) => i === si ? { ...s, ...patch } : s) });

  const stOf = id => statuses.find(x => x.id === id) || { id, label: "Sans statut", color: "#868e96" };
  const defType = (statuses.find(x => x.id === "free") || statuses[0]).id;
  const hasPause = statuses.some(x => x.id === "pause");
  const totals = slots => {
    const t = {};
    slots.forEach(s => { const d = toMin(s.end) - toMin(s.start); if (d > 0 && s.type !== "pause") t[s.type] = (t[s.type] || 0) + d; });
    return statuses.filter(x => t[x.id]).map(x => ({ ...x, mins: t[x.id] }));
  };

  // ── Gestion des statuts ──
  const updStatus = (i, patch) => commit(cards, statuses.map((x, j) => j === i ? { ...x, ...patch } : x));
  const addStatus = () => {
    const label = newStatus.label.trim();
    if (!label) return;
    commit(cards, [...statuses, { id: "st_" + uid(), label, color: newStatus.color }]);
    setNewStatus({ label: "", color: newStatus.color });
  };
  const removeStatus = i => {
    if (statuses.length <= 1) return;
    const gone = statuses[i].id;
    const rest = statuses.filter((_, j) => j !== i);
    const fallback = (rest.find(x => x.id === "free") || rest[0]).id;
    commit(cards.map(c => ({ ...c, slots: c.slots.map(s => s.type === gone ? { ...s, type: fallback } : s) })), rest);
  };
  const usage = id => cards.reduce((n, c) => n + c.slots.filter(s => s.type === id).length, 0);

  const addCard = () => commit([...cards, { id: uid(), name: "Nouveau", slots: [{ id: uid(), start: "09:00", end: "10:00", type: defType, label: "" }] }]);
  const addSlot = (ci, type = defType) => {
    const slots = cards[ci].slots;
    const last = [...slots].reverse().find(s => !isNaN(toMin(s.end)));
    const start = last ? last.end : "09:00";
    const end = toTime(toMin(start) + 60);
    updCard(ci, { slots: [...slots, { id: uid(), start, end, type, label: type === "pause" ? "pause déjeuner" : "" }] });
  };
  const askOrDo = (key, fn) => { if (confirm === key) { fn(); setConfirm(null); } else setConfirm(key); };

  const onDrop = (ci, si) => {
    const src = drag.current; drag.current = null; setOverId(null);
    if (!src) return;
    const next = cards.map(c => ({ ...c, slots: [...c.slots] }));
    const [item] = next[src.ci].slots.splice(src.si, 1);
    const at = si == null ? next[ci].slots.length : si;
    next[ci].slots.splice(at, 0, item);
    commit(next);
  };

  // ── Styles ──
  const colOf = id => { const c = stOf(id).color; return { bg: rgba(c, T.isDark ? .22 : .13), line: rgba(c, T.isDark ? .5 : .4), chip: c }; };
  const btn = { background: T.bgCard, border: `1px solid ${T.border}`, color: T.text, borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
  const icon = { background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", padding: "4px 6px", borderRadius: 6, fontSize: 13, lineHeight: 1 };
  const ghost = { background: "transparent", border: `1px dashed ${T.border}`, color: T.textSub, borderRadius: 8, padding: "6px 10px", fontSize: 12.5, cursor: "pointer" };
  const timeInp = { fontFamily: "ui-monospace,Menlo,monospace", fontSize: 14, border: `1px solid transparent`, background: "transparent", color: T.text, borderRadius: 6, padding: "2px 2px", fontVariantNumeric: "tabular-nums", minWidth: 0 };
  const savedTxt = { idle: "", saving: "Enregistrement…", saved: "✓ Enregistré", error: "⚠️ Échec de l'enregistrement, vérifie ta connexion" }[saveState];

  const printCards = printing ? cards.filter(c => printing.includes(c.id)) : [];
  const todayRaw = new Date().toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const today = todayRaw.charAt(0).toUpperCase() + todayRaw.slice(1);

  return (
    <>
    <style>{PRINT_CSS}</style>
    <div className="pl-screen" style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans',sans-serif", paddingBottom: 40 }}>
      <header style={{ position: "sticky", top: 0, zIndex: 5, background: T.sidebar, color: "#fff", padding: `calc(12px + env(safe-area-inset-top, 0px)) 16px 12px`, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, flex: 1, minWidth: 120 }}>📅 Planning</div>
        <span style={{ fontSize: 12, opacity: .75 }}>{savedTxt}</span>
        <span style={{ fontSize: 12.5, opacity: .85 }}>{user}</span>
        <button onClick={toggleTheme} aria-label="Changer de thème" style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", borderRadius: 8, padding: "5px 9px", cursor: "pointer" }}>{isDark ? "☀️" : "🌙"}</button>
        <button onClick={onLogout} style={{ background: "rgba(255,255,255,.12)", border: "none", color: "#fff", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}>Déconnexion</button>
      </header>

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: "18px 16px 0", display: "flex", flexDirection: "column", gap: 16 }}>
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, justifyContent: "space-between" }}>
          <p style={{ margin: 0, fontSize: 12.5, color: T.textSub, maxWidth: 640 }}>
            Touche un nom ou une heure pour modifier · la pastille permet de choisir le statut · ▲▼ (ou glisser ⠿ sur ordinateur) pour réordonner.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {cards.length > 0 && <button style={btn} onClick={() => commit(cards.map(c => ({ ...c, slots: sortByTime(c.slots) })))}>Trier tout par heure</button>}
            <button style={btn} onClick={() => setStatusOpen(true)}>🎨 Statuts</button>
            {cards.length > 0 && <button style={btn} onClick={openPrint}>🖨️ Imprimer</button>}
            <button style={{ ...btn, background: T.accent, borderColor: T.accent, color: "#fff" }} onClick={addCard}>+ Ajouter une carte</button>
          </div>
        </div>

        {!loaded ? (
          <div style={{ color: T.textSub, fontSize: 14, padding: 30, textAlign: "center" }}>Chargement du planning…</div>
        ) : cards.length === 0 ? (
          <div style={{ border: `1px dashed ${T.border}`, borderRadius: 14, padding: "40px 16px", textAlign: "center", color: T.textSub }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: T.text, marginBottom: 6 }}>Le planning est vide</div>
            <div style={{ fontSize: 13, marginBottom: 14 }}>Ajoute une carte par personne, puis ses créneaux de la journée.</div>
            <button style={{ ...btn, background: T.accent, borderColor: T.accent, color: "#fff" }} onClick={addCard}>+ Ajouter une carte</button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(330px,1fr))", gap: 14, alignItems: "start" }}>
            {cards.map((c, ci) => {
              const tot = totals(c.slots);
              const cKey = "card:" + c.id;
              return (
                <article key={c.id} style={{ background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 14, boxShadow: T.shadow, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 4, padding: "12px 10px 8px 12px", borderBottom: `1px solid ${T.borderLight}` }}>
                    <input id={`pl-name-${c.id}`} value={c.name} onChange={e => updCard(ci, { name: e.target.value })} aria-label="Nom"
                      style={{ flex: 1, minWidth: 0, fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 21, border: "1px solid transparent", background: "transparent", color: T.text, padding: "2px 6px", borderRadius: 6 }} />
                    <button style={icon} disabled={ci === 0} title="Déplacer à gauche" onClick={() => commit(swap(cards, ci, ci - 1))}>◀</button>
                    <button style={icon} disabled={ci === cards.length - 1} title="Déplacer à droite" onClick={() => commit(swap(cards, ci, ci + 1))}>▶</button>
                    <button style={icon} title="Dupliquer" onClick={() => { const n = [...cards]; n.splice(ci + 1, 0, { ...c, id: uid(), name: c.name + " (copie)", slots: c.slots.map(s => ({ ...s, id: uid() })) }); commit(n); }}>⧉</button>
                    <button style={confirm === cKey ? { ...icon, background: T.red, color: "#fff", fontSize: 11.5 } : icon} title="Supprimer la carte"
                      onClick={() => askOrDo(cKey, () => commit(cards.filter((_, i) => i !== ci)))}>{confirm === cKey ? "Confirmer" : "✕"}</button>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 14px", fontSize: 12, color: T.textSub, padding: "8px 14px 0", fontVariantNumeric: "tabular-nums" }}>
                    {tot.length ? tot.map(x => (
                      <span key={x.id}><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: x.color, marginRight: 5 }} />{x.label} {fmtDur(x.mins)}</span>
                    )) : <span>Aucun créneau</span>}
                  </div>

                  <div style={{ padding: 10, display: "flex", flexDirection: "column", gap: 6 }}
                    onDragOver={e => { if (drag.current && e.target === e.currentTarget) e.preventDefault(); }}
                    onDrop={e => { if (e.target === e.currentTarget) { e.preventDefault(); onDrop(ci, null); } }}>
                    {c.slots.map((s, si) => {
                      const d = toMin(s.end) - toMin(s.start);
                      const prev = c.slots[si - 1];
                      const overlap = prev && toMin(s.start) < toMin(prev.end);
                      const bad = !(d > 0);
                      const sKey = "slot:" + s.id;
                      const col = colOf(s.type);
                      const st = stOf(s.type);
                      return (
                        <div key={s.id} draggable={!isMobile}
                          onDragStart={e => { drag.current = { ci, si }; e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", s.id); } catch { /* */ } }}
                          onDragEnd={() => { drag.current = null; setOverId(null); }}
                          onDragOver={e => { if (!drag.current) return; e.preventDefault(); setOverId(s.id); }}
                          onDrop={e => { e.preventDefault(); onDrop(ci, si); }}
                          style={{ display: "grid", gridTemplateColumns: "auto 1fr auto auto", alignItems: "center", gap: 6, padding: "7px 6px 7px 4px", borderRadius: 10,
                            background: col.bg, border: `1px ${s.type === "pause" ? "dashed" : "solid"} ${col.line}`, outline: overId === s.id ? `2px solid ${T.accent}` : "none" }}>
                          <span style={{ cursor: isMobile ? "default" : "grab", color: T.textFaint, padding: "0 3px", userSelect: "none", visibility: isMobile ? "hidden" : "visible" }}>⠿</span>
                          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 2, minWidth: 0 }}>
                            <input type="time" id={`pl-st-${s.id}`} value={s.start} onChange={e => updSlot(ci, si, { start: e.target.value })} aria-label="Début" style={timeInp} />
                            <span style={{ color: T.textFaint }}>→</span>
                            <input type="time" id={`pl-en-${s.id}`} value={s.end} onChange={e => updSlot(ci, si, { end: e.target.value })} aria-label="Fin" style={timeInp} />
                            {s.type === "pause" && (
                              <input id={`pl-lb-${s.id}`} value={s.label || ""} onChange={e => updSlot(ci, si, { label: e.target.value })} placeholder="Libellé" aria-label="Libellé"
                                style={{ width: "100%", fontSize: 12.5, border: "1px solid transparent", background: "transparent", color: T.textSub, padding: "2px 4px", borderRadius: 6 }} />
                            )}
                            <div style={{ width: "100%", fontSize: 11.5, paddingLeft: 3, color: bad || overlap ? T.red : T.textSub, fontWeight: bad || overlap ? 600 : 400, fontVariantNumeric: "tabular-nums" }}>
                              {bad ? "La fin est avant le début" : `${fmtDur(d)} · ${st.label.toLowerCase()}${overlap ? " · chevauche le précédent" : ""}`}
                            </div>
                          </div>
                          <select id={`pl-ty-${s.id}`} value={s.type} aria-label="Statut"
                            onChange={e => updSlot(ci, si, { type: e.target.value, label: s.label || (e.target.value === "pause" ? "pause déjeuner" : "") })}
                            style={{ appearance: "none", WebkitAppearance: "none", background: col.chip, color: "#fff", border: "none", borderRadius: 999, padding: "5px 22px 5px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", maxWidth: 150, textOverflow: "ellipsis",
                              backgroundImage: "linear-gradient(45deg,transparent 50%,#fff 50%),linear-gradient(135deg,#fff 50%,transparent 50%)", backgroundPosition: "calc(100% - 11px) 50%,calc(100% - 7px) 50%", backgroundSize: "4px 4px", backgroundRepeat: "no-repeat" }}>
                            {!statuses.some(x => x.id === s.type) && <option value={s.type}>Sans statut</option>}
                            {statuses.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}
                          </select>
                          <div style={{ display: "flex", alignItems: "center" }}>
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <button style={{ ...icon, fontSize: 10, padding: "1px 5px" }} disabled={si === 0} aria-label="Monter" onClick={() => updCard(ci, { slots: swap(c.slots, si, si - 1) })}>▲</button>
                              <button style={{ ...icon, fontSize: 10, padding: "1px 5px" }} disabled={si === c.slots.length - 1} aria-label="Descendre" onClick={() => updCard(ci, { slots: swap(c.slots, si, si + 1) })}>▼</button>
                            </div>
                            <button style={confirm === sKey ? { ...icon, background: T.red, color: "#fff", fontSize: 11 } : icon} aria-label="Supprimer le créneau"
                              onClick={() => askOrDo(sKey, () => updCard(ci, { slots: c.slots.filter((_, i) => i !== si) }))}>{confirm === sKey ? "Oui ?" : "✕"}</button>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "0 10px 12px" }}>
                    <button style={ghost} onClick={() => addSlot(ci)}>+ Créneau</button>
                    {hasPause && <button style={ghost} onClick={() => addSlot(ci, "pause")}>+ Pause</button>}
                    <button style={ghost} onClick={() => updCard(ci, { slots: sortByTime(c.slots) })}>Trier par heure</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>

      {statusOpen && (
        <div role="dialog" aria-modal="true" aria-label="Statuts" onClick={e => { if (e.target === e.currentTarget) setStatusOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.45)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 16 }}>
          <div style={{ background: T.bgCard, color: T.text, width: "100%", maxWidth: 440, maxHeight: "88vh", overflow: "auto", borderRadius: isMobile ? "16px 16px 0 0" : 16, padding: `18px 18px calc(18px + env(safe-area-inset-bottom, 0px))`, boxShadow: T.shadowHover }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>🎨 Statuts</div>
            <div style={{ fontSize: 12.5, color: T.textSub, marginBottom: 14 }}>Renomme, change la couleur ou ajoute tes propres statuts (ex. « Occupé mais dispo »). Touche la pastille de couleur pour la changer.</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 16 }}>
              {statuses.map((x, i) => {
                const k = "status:" + x.id, n = usage(x.id);
                return (
                  <div key={x.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 8px", borderRadius: 10, background: rgba(x.color, T.isDark ? .2 : .1), border: `1px solid ${rgba(x.color, .4)}` }}>
                    <input type="color" id={`pl-sc-${x.id}`} value={x.color} onChange={e => updStatus(i, { color: e.target.value })} aria-label={`Couleur de ${x.label}`}
                      style={{ width: 30, height: 30, padding: 0, border: "none", borderRadius: 8, background: "transparent", cursor: "pointer", flexShrink: 0 }} />
                    <input id={`pl-sl-${x.id}`} value={x.label} onChange={e => updStatus(i, { label: e.target.value })} aria-label="Nom du statut"
                      style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 600, border: `1px solid ${T.borderLight}`, background: T.bgInput, color: T.text, borderRadius: 7, padding: "6px 8px" }} />
                    <span style={{ fontSize: 11, color: T.textFaint, whiteSpace: "nowrap" }}>{n} créneau{n > 1 ? "x" : ""}</span>
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      <button style={{ ...icon, fontSize: 10, padding: "1px 5px" }} disabled={i === 0} aria-label="Monter" onClick={() => commit(cards, swap(statuses, i, i - 1))}>▲</button>
                      <button style={{ ...icon, fontSize: 10, padding: "1px 5px" }} disabled={i === statuses.length - 1} aria-label="Descendre" onClick={() => commit(cards, swap(statuses, i, i + 1))}>▼</button>
                    </div>
                    <button disabled={statuses.length <= 1} title={n ? "Les créneaux concernés passeront au premier statut restant" : "Supprimer"}
                      style={confirm === k ? { ...icon, background: T.red, color: "#fff", fontSize: 11 } : icon}
                      onClick={() => askOrDo(k, () => removeStatus(i))}>{confirm === k ? (n ? `Oui (${n})` : "Oui ?") : "✕"}</button>
                  </div>
                );
              })}
            </div>

            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 8 }}>Nouveau statut</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <input id="pl-ns-label" value={newStatus.label} onChange={e => setNewStatus({ ...newStatus, label: e.target.value })} onKeyDown={e => e.key === "Enter" && addStatus()}
                placeholder="Ex. Occupé mais dispo" style={{ flex: 1, minWidth: 0, fontSize: 14, border: `1px solid ${T.border}`, background: T.bgInput, color: T.text, borderRadius: 8, padding: "8px 10px" }} />
              <input type="color" id="pl-ns-color" value={newStatus.color} onChange={e => setNewStatus({ ...newStatus, color: e.target.value })} aria-label="Couleur"
                style={{ width: 38, height: 38, padding: 0, border: "none", borderRadius: 8, background: "transparent", cursor: "pointer", flexShrink: 0 }} />
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {SWATCHES.map(c => (
                <button key={c} aria-label={`Couleur ${c}`} onClick={() => setNewStatus({ ...newStatus, color: c })}
                  style={{ width: 26, height: 26, borderRadius: 13, background: c, border: newStatus.color === c ? `3px solid ${T.text}` : `2px solid ${T.bgCard}`, boxShadow: `0 0 0 1px ${T.border}`, cursor: "pointer", padding: 0 }} />
              ))}
            </div>
            {newStatus.label.trim() && (
              <div style={{ marginBottom: 12, fontSize: 12, color: T.textSub }}>Aperçu : <span style={{ background: newStatus.color, color: "#fff", borderRadius: 999, padding: "3px 10px", fontWeight: 700 }}>{newStatus.label.trim()}</span></div>
            )}
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={btn} onClick={() => setStatusOpen(false)}>Fermer</button>
              <button disabled={!newStatus.label.trim()} onClick={addStatus}
                style={{ ...btn, background: T.accent, borderColor: T.accent, color: "#fff", opacity: newStatus.label.trim() ? 1 : .5 }}>+ Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {printOpen && (
        <div role="dialog" aria-modal="true" aria-label="Imprimer le planning" onClick={e => { if (e.target === e.currentTarget) setPrintOpen(false); }}
          style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.45)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 16 }}>
          <div style={{ background: T.bgCard, color: T.text, width: "100%", maxWidth: 420, maxHeight: "85vh", overflow: "auto", borderRadius: isMobile ? "16px 16px 0 0" : 16, padding: `18px 18px calc(18px + env(safe-area-inset-bottom, 0px))`, boxShadow: T.shadowHover }}>
            <div style={{ fontFamily: "'Syne',sans-serif", fontWeight: 700, fontSize: 18, marginBottom: 4 }}>🖨️ Imprimer le planning</div>
            <div style={{ fontSize: 12.5, color: T.textSub, marginBottom: 12 }}>Choisis les cartes à imprimer.</div>
            <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
              <button style={{ ...ghost, borderStyle: "solid" }} onClick={() => setPrintSel(cards.map(c => c.id))}>Tout sélectionner</button>
              <button style={{ ...ghost, borderStyle: "solid" }} onClick={() => setPrintSel([])}>Aucune</button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, marginBottom: 14 }}>
              {cards.map(c => (
                <label key={c.id} htmlFor={`pl-pr-${c.id}`} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", borderRadius: 9, background: printSel.includes(c.id) ? T.accentLight : T.bgHover, cursor: "pointer", fontSize: 14 }}>
                  <input type="checkbox" id={`pl-pr-${c.id}`} checked={printSel.includes(c.id)} onChange={() => togglePrint(c.id)} style={{ width: 18, height: 18, accentColor: T.accent }} />
                  <span style={{ flex: 1, fontWeight: 600 }}>{c.name || "Sans nom"}</span>
                  <span style={{ fontSize: 12, color: T.textFaint }}>{c.slots.length} créneau{c.slots.length > 1 ? "x" : ""}</span>
                </label>
              ))}
            </div>
            <label htmlFor="pl-pr-onepage" style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, color: T.textSub, marginBottom: 16, cursor: "pointer" }}>
              <input type="checkbox" id="pl-pr-onepage" checked={onePerPage} onChange={e => setOnePerPage(e.target.checked)} style={{ width: 16, height: 16, accentColor: T.accent }} />
              Une carte par page
            </label>
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button style={btn} onClick={() => setPrintOpen(false)}>Annuler</button>
              <button disabled={!printSel.length} onClick={launchPrint}
                style={{ ...btn, background: T.accent, borderColor: T.accent, color: "#fff", opacity: printSel.length ? 1 : .5, cursor: printSel.length ? "pointer" : "not-allowed" }}>
                Imprimer{printSel.length ? ` (${printSel.length})` : ""}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>

    {/* Feuille d'impression (invisible à l'écran) */}
    <div className="pl-print">
      <div className="pl-print-head">
        <div className="pl-print-title">Planning</div>
        <div className="pl-print-date">{today}</div>
      </div>
      <div className={onePerPage ? "pl-print-list" : "pl-print-grid"}>
        {printCards.map(c => {
          const tot = totals(c.slots);
          return (
            <section key={c.id} className={"pl-print-card" + (onePerPage ? " pl-big" : "")}>
              <div className="pl-print-name">{c.name}</div>
              <div className="pl-print-stats">{tot.map(x => `${x.label} ${fmtDur(x.mins)}`).join(" · ")}</div>
              {c.slots.map(s => {
                const st = stOf(s.type);
                return (
                  <div key={s.id} className={"pl-print-slot" + (s.type === "pause" ? " pause" : "")} style={{ background: rgba(st.color, .14), borderColor: rgba(st.color, .5) }}>
                    <span className="pl-print-time">{s.start || "--:--"} – {s.end || "--:--"}</span>
                    <span className="pl-print-dur">{fmtDur(toMin(s.end) - toMin(s.start))}</span>
                    <span className="pl-print-state" style={{ color: st.color }}>{s.type === "pause" ? (s.label || st.label) : st.label}</span>
                  </div>
                );
              })}
            </section>
          );
        })}
      </div>
    </div>
    </>
  );
}

// Styles d'impression : à l'écran la feuille est masquée, à l'impression seule la feuille apparaît
const PRINT_CSS = `
.pl-print{display:none}
@media print{
  @page{size:A4 landscape;margin:10mm}
  html,body,#root{background:#fff !important;color:#111 !important}
  .pl-screen{display:none !important}
  .pl-print{display:block !important;font-family:'DM Sans',system-ui,sans-serif;color:#111}
  .pl-print *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .pl-print-head{display:flex;justify-content:space-between;align-items:baseline;border-bottom:2px solid #111;padding-bottom:4mm;margin-bottom:5mm}
  .pl-print-title{font-family:'Syne',system-ui,sans-serif;font-weight:700;font-size:20pt}
  .pl-print-date{font-size:11pt;color:#444}
  .pl-print-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:5mm;align-items:start}
  .pl-print-list .pl-print-card{break-after:page}
  .pl-print-list .pl-print-card:last-child{break-after:auto}
  .pl-print-card{break-inside:avoid;border:1px solid #bbb;border-radius:3mm;padding:4mm}
  .pl-print-name{font-family:'Syne',system-ui,sans-serif;font-weight:700;font-size:15pt;margin-bottom:1mm}
  .pl-print-stats{font-size:8.5pt;color:#555;margin-bottom:3mm}
  .pl-print-slot{display:grid;grid-template-columns:auto 1fr auto;gap:3mm;align-items:center;padding:2mm 3mm;border-radius:2mm;margin-bottom:1.5mm;font-size:10pt;border:1px solid}
  .pl-print-slot.pause{border-style:dashed}
  .pl-print-time{font-family:ui-monospace,Menlo,monospace;font-weight:600;font-variant-numeric:tabular-nums}
  .pl-print-dur{color:#555;font-size:9pt}
  .pl-print-state{font-weight:700;font-size:9pt}
  .pl-print-slot.pause .pl-print-state{font-weight:500;font-style:italic}
  .pl-big .pl-print-name{font-size:26pt}
  .pl-big .pl-print-slot{font-size:15pt;padding:4mm 5mm;margin-bottom:3mm}
  .pl-big .pl-print-state,.pl-big .pl-print-dur{font-size:13pt}
}
`;
