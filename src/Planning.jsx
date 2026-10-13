import { useState, useEffect, useRef } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";

// ── Planning (profil « planning uniquement ») ─────────────────────────────────
// Données : Firestore config/planning  →  { cards:[{id,name,slots:[{id,start,end,type,label}]}], updatedAt, updatedBy }

const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-3);
const toMin = t => { if (!/^\d{1,2}:\d{2}$/.test(t || "")) return NaN; const [h, m] = t.split(":").map(Number); return h * 60 + m; };
const toTime = m => `${String(Math.floor(m / 60) % 24).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmtDur = m => { if (!(m > 0)) return "—"; const h = Math.floor(m / 60), r = m % 60; return h ? `${h}h${r ? String(r).padStart(2, "0") : ""}` : `${r} min`; };
const NEXT = { free: "busy", busy: "pause", pause: "free" };
const LABEL = { free: "Libre", busy: "Occupé", pause: "Pause" };
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

  const ref = doc(db, "config", "planning");

  useEffect(() => onSnapshot(ref, s => {
    if (s.metadata.hasPendingWrites || dirty.current) return; // on ignore l'écho de nos propres écritures
    const d = s.exists() ? s.data() : {};
    setCards(Array.isArray(d.cards) ? d.cards : []);
    setLoaded(true);
  }, () => setLoaded(true)), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => clearTimeout(saveTimer.current), []);

  const commit = next => {
    setCards(next);
    dirty.current = true;
    setSaveState("saving");
    const v = ++version.current;
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      try {
        await setDoc(ref, { cards: next, updatedAt: Date.now(), updatedBy: user });
        if (v === version.current) setSaveState("saved");
      } catch (e) {
        console.error("Planning : sauvegarde échouée", e);
        setSaveState("error");
      } finally { if (v === version.current) dirty.current = false; }
    }, 500);
  };

  const updCard = (ci, patch) => commit(cards.map((c, i) => i === ci ? { ...c, ...patch } : c));
  const updSlot = (ci, si, patch) => updCard(ci, { slots: cards[ci].slots.map((s, i) => i === si ? { ...s, ...patch } : s) });

  const addCard = () => commit([...cards, { id: uid(), name: "Nouveau", slots: [{ id: uid(), start: "09:00", end: "10:00", type: "free", label: "" }] }]);
  const addSlot = (ci, type = "free") => {
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
  const C = {
    free: { bg: T.isDark ? "#16301f" : "#e6f5ea", line: T.isDark ? "#2a5a38" : "#b9e2c7", chip: T.green },
    busy: { bg: T.isDark ? "#3a1c1a" : "#fbe9e9", line: T.isDark ? "#5d2a26" : "#f0c4c4", chip: T.red },
    pause: { bg: T.bgHover, line: T.border, chip: T.textFaint },
  };
  const btn = { background: T.bgCard, border: `1px solid ${T.border}`, color: T.text, borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer" };
  const icon = { background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", padding: "4px 6px", borderRadius: 6, fontSize: 13, lineHeight: 1 };
  const ghost = { background: "transparent", border: `1px dashed ${T.border}`, color: T.textSub, borderRadius: 8, padding: "6px 10px", fontSize: 12.5, cursor: "pointer" };
  const timeInp = { fontFamily: "ui-monospace,Menlo,monospace", fontSize: 14, border: `1px solid transparent`, background: "transparent", color: T.text, borderRadius: 6, padding: "2px 2px", fontVariantNumeric: "tabular-nums", minWidth: 0 };
  const savedTxt = { idle: "", saving: "Enregistrement…", saved: "✓ Enregistré", error: "⚠️ Échec de l'enregistrement, vérifie ta connexion" }[saveState];

  return (
    <div style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans',sans-serif", paddingBottom: 40 }}>
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
            Touche un nom ou une heure pour modifier · la pastille bascule Libre / Occupé / Pause · ▲▼ (ou glisser ⠿ sur ordinateur) pour réordonner.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {cards.length > 0 && <button style={btn} onClick={() => commit(cards.map(c => ({ ...c, slots: sortByTime(c.slots) })))}>Trier tout par heure</button>}
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
              let free = 0, busy = 0;
              c.slots.forEach(s => { const d = toMin(s.end) - toMin(s.start); if (d > 0) { if (s.type === "free") free += d; else if (s.type === "busy") busy += d; } });
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
                  <div style={{ display: "flex", gap: 14, fontSize: 12, color: T.textSub, padding: "8px 14px 0", fontVariantNumeric: "tabular-nums" }}>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: T.green, marginRight: 5 }} />Libre {fmtDur(free)}</span>
                    <span><span style={{ display: "inline-block", width: 8, height: 8, borderRadius: 4, background: T.red, marginRight: 5 }} />Occupé {fmtDur(busy)}</span>
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
                      const col = C[s.type] || C.free;
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
                              {bad ? "La fin est avant le début" : `${fmtDur(d)} · ${LABEL[s.type].toLowerCase()}${overlap ? " · chevauche le précédent" : ""}`}
                            </div>
                          </div>
                          <button onClick={() => updSlot(ci, si, { type: NEXT[s.type] || "free", label: s.label || (NEXT[s.type] === "pause" ? "pause déjeuner" : "") })}
                            style={{ background: col.chip, color: "#fff", border: "none", borderRadius: 999, padding: "4px 10px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", whiteSpace: "nowrap" }}>
                            ● {LABEL[s.type]}
                          </button>
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
                    <button style={ghost} onClick={() => addSlot(ci, "pause")}>+ Pause</button>
                    <button style={ghost} onClick={() => updCard(ci, { slots: sortByTime(c.slots) })}>Trier par heure</button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
