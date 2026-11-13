import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Icon } from "./brand.jsx";
import { ChoiceInput } from "./fields.jsx";
import { Thumb } from "./Scanner.jsx";
import { normCode, genCode, scanUrl, parseScan, compressImage, svgToDataUrl } from "./codes.js";

// ── Étiquettes (admin) : relier un code à un article, image, impression ──────
// Champs ajoutés aux articles (stock_items) :
//   codes[]     codes reconnus au scan (code généré « MB… » et/ou code-barres du produit)
//   codeFormat  "qr" (seul format : les étiquettes sont toujours des QR codes)
//   scanQty     quantité retirée à chaque scan (1 par défaut)
//   image       data URL (photo JPEG réduite ou pictogramme SVG généré par l'IA), imageKind "photo" | "ai"

// Graphique du code : QR code (lien vers le scanner de l'app)
export function CodeGraphic({ code, size = 120 }) {
  const [qr, setQr] = useState({ key: "", url: "" });
  useEffect(() => {
    if (!code) return;
    let alive = true;
    QRCode.toDataURL(scanUrl(code), { margin: 1, width: 360, errorCorrectionLevel: "M" })
      .then(url => { if (alive) setQr({ key: code, url }); })
      .catch(() => { if (alive) setQr({ key: code, url: "" }); });
    return () => { alive = false; };
  }, [code]);
  if (!code) return null;
  return qr.key === code && qr.url
    ? <img src={qr.url} alt={`QR code ${code}`} style={{ display: "block", width: size, height: size, imageRendering: "pixelated" }} />
    : <div style={{ width: size, height: size }} />;
}

// Une étiquette (aperçu et impression) — toujours noir sur blanc
export function LabelCard({ item, big }) {
  const code = (item.codes || [])[0] || "";
  const qrSize = big ? 150 : 104;
  return (
    <div className="lb-card" style={{ background: "#fff", color: "#111", border: "1px dashed #b9b9b9", borderRadius: 6, padding: big ? 14 : 10, display: "flex", flexDirection: "column", gap: big ? 10 : 7, breakInside: "avoid", fontFamily: "'DM Sans',sans-serif" }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", minHeight: big ? 64 : 46 }}>
        {item.image && <img src={item.image} alt="" style={{ width: big ? 64 : 46, height: big ? 64 : 46, objectFit: "contain", flexShrink: 0 }} />}
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: "'Jost',sans-serif", fontWeight: 600, fontSize: big ? 17 : 13.5, lineHeight: 1.2 }}>{item.name || "Article"}</div>
          {(item.category || item.location) && <div style={{ fontSize: big ? 12 : 10.5, color: "#555", marginTop: 2 }}>{[item.category, item.location].filter(Boolean).join(" · ")}</div>}
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "center" }}><CodeGraphic code={code} size={qrSize} /></div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6, fontSize: big ? 11.5 : 9.5, color: "#444" }}>
        <span style={{ fontFamily: "ui-monospace,Menlo,monospace", letterSpacing: "0.08em", color: "#111" }}>{code}</span>
        <span>{item.trackMode === "visual" ? "Scanner = stock bas" : `Scanner = −${Math.max(1, Number(item.scanQty) || 1)} ${item.unit || ""}`}</span>
      </div>
    </div>
  );
}

// ── Onglet Étiquettes ─────────────────────────────────────────────────────────
export function LabelsTab({ T, card, btn, primary, inp, muted, isMobile, items, onEdit, onNew, onPrint }) {
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState([]);
  const [size, setSize] = useState("small");
  const [copies, setCopies] = useState(1);
  const withCode = items.filter(it => (it.codes || []).length);
  const shown = filter === "nocode" ? items.filter(it => !(it.codes || []).length) : filter === "code" ? withCode : items;
  const toggle = id => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const printable = sel.filter(id => withCode.some(it => it.id === id));
  const chip = (id, label, n) => {
    const on = filter === id;
    return <button key={id} onClick={() => setFilter(id)} style={{ ...btn, padding: "6px 11px", fontSize: 12.5, background: on ? T.text : T.bgCard, borderColor: on ? T.text : T.border, color: on ? T.bg : T.text }}>{label} <span style={{ opacity: .65 }}>{n}</span></button>;
  };
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 10, flexWrap: "wrap" }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <h1 style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 22, margin: 0 }}>Étiquettes</h1>
          <div style={muted}>Relie un QR code ou un code-barres à chaque article : le scanner retirera l'article du stock.</div>
        </div>
        <button style={{ ...primary, display: "inline-flex", alignItems: "center", gap: 7 }} onClick={onNew}><Icon name="plus" size={16} />Nouvelle étiquette</button>
      </div>

      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        {chip("all", "Tous les articles", items.length)}
        {chip("code", "Avec code", withCode.length)}
        {chip("nocode", "Sans code", items.length - withCode.length)}
      </div>

      {printable.length > 0 && (
        <div style={{ ...card, padding: 12, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", position: "sticky", top: isMobile ? 64 : 104, zIndex: 5 }}>
          <strong style={{ fontSize: 14 }}>{printable.length} étiquette{printable.length > 1 ? "s" : ""} sélectionnée{printable.length > 1 ? "s" : ""}</strong>
          <select id="lb-size" aria-label="Taille" value={size} onChange={e => setSize(e.target.value)} style={{ ...inp, width: "auto", padding: "7px 9px" }}>
            <option value="small">Petites (3 par ligne)</option>
            <option value="big">Grandes (2 par ligne)</option>
          </select>
          <label htmlFor="lb-copies" style={{ fontSize: 13, color: T.textSub, display: "inline-flex", alignItems: "center", gap: 6 }}>Exemplaires
            <input id="lb-copies" type="number" min="1" max="50" inputMode="numeric" value={copies} onChange={e => setCopies(e.target.value)} style={{ ...inp, width: 64, padding: "7px 8px" }} />
          </label>
          <span style={{ flex: 1 }} />
          <button style={btn} onClick={() => setSel([])}>Désélectionner</button>
          <button style={{ ...primary, display: "inline-flex", alignItems: "center", gap: 7 }} onClick={() => onPrint(printable, size, Math.min(50, Math.max(1, Number(copies) || 1)))}><Icon name="printer" size={16} />Imprimer</button>
        </div>
      )}

      {items.length === 0 ? (
        <div style={{ border: `1px dashed ${T.border}`, borderRadius: 14, padding: "32px 16px", textAlign: "center", color: T.textSub }}>
          <div style={{ marginBottom: 8, color: T.textFaint }}><Icon name="tag" size={30} stroke={1.3} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>Aucun article</div>
          <div style={{ fontSize: 13, marginBottom: 14 }}>Crée une étiquette : tu indiques ce que c'est, l'app crée l'article dans le stock et son code.</div>
          <button style={primary} onClick={onNew}>Nouvelle étiquette</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(330px,1fr))", gap: 10 }}>
          {shown.map(it => {
            const codes = it.codes || [], has = codes.length > 0, on = sel.includes(it.id);
            return (
              <div key={it.id} style={{ ...card, padding: 12, display: "flex", gap: 12, alignItems: "center", borderColor: on ? T.text : T.borderLight }}>
                {has && <input type="checkbox" id={`lb-sel-${it.id}`} aria-label={`Sélectionner ${it.name}`} checked={on} onChange={() => toggle(it.id)} style={{ width: 18, height: 18, accentColor: T.text, flexShrink: 0 }} />}
                <Thumb T={T} src={it.image} size={52} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14.5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</div>
                  {has ? (
                    <div style={{ fontSize: 12, color: T.textSub, display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontFamily: "ui-monospace,Menlo,monospace" }}>{codes[0]}</span>
                      {codes.length > 1 && <span>+{codes.length - 1}</span>}
                      <span style={{ color: T.textFaint }}>· QR code · {it.trackMode === "visual" ? "seuil visuel" : `−${Math.max(1, Number(it.scanQty) || 1)} par scan`}</span>
                    </div>
                  ) : <div style={{ fontSize: 12, color: T.orange }}>Pas encore de code</div>}
                </div>
                <button style={{ ...btn, padding: "6px 10px", fontSize: 12.5 }} onClick={() => onEdit(it)}>{has ? "Modifier" : "Créer le code"}</button>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

// ── Fenêtre de création / modification d'une étiquette ────────────────────────
export function LabelModal({ T, btn, primary, inp, lbl, muted, isMobile, Sheet, TrackModeField, value, items, cfg, onClose, onSave, onGenerateImage }) {
  const [v, setV] = useState(() => {
    const it = value.itemId ? items.find(x => x.id === value.itemId) : null;
    return {
      mode: value.mode || (it ? "existing" : "new"), itemId: it?.id || "",
      name: "", category: cfg.stockCategories[0] || "", unit: cfg.units[0] || "", qty: 0, threshold: 2,
      codes: [...(it?.codes || []), ...(value.codes || [])].map(normCode).filter((c, i, a) => c && a.indexOf(c) === i),
      codeFormat: "qr", scanQty: it?.scanQty || 1, image: it?.image || "", imageKind: it?.imageKind || "",
      trackMode: it?.trackMode || "count",
    };
  });
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState("");
  const [msg, setMsg] = useState("");
  const set = patch => setV(o => ({ ...o, ...patch }));
  const item = v.mode === "existing" ? items.find(x => x.id === v.itemId) : null;
  const name = v.mode === "new" ? v.name.trim() : item?.name || "";

  const pickItem = id => {
    const it = items.find(x => x.id === id);
    setV(o => ({ ...o, itemId: id, codes: [...(it?.codes || []), ...o.codes.filter(c => !(items.find(x => x.id === o.itemId)?.codes || []).includes(c))].filter((c, i, a) => a.indexOf(c) === i),
      codeFormat: "qr", scanQty: it?.scanQty || 1, image: it?.image || "", imageKind: it?.imageKind || "", trackMode: it?.trackMode || "count" }));
  };
  const owner = c => items.find(x => x.id !== v.itemId && (x.codes || []).map(normCode).includes(c));
  const addCode = raw => {
    const c = parseScan(raw);
    if (!c) return;
    const o = owner(c);
    if (o) { setMsg(`Le code ${c} est déjà lié à « ${o.name} ».`); return; }
    if (v.codes.includes(c)) { setMsg(`Le code ${c} est déjà dans la liste.`); return; }
    setMsg(""); set({ codes: [...v.codes, c] });
  };
  const generate = () => { const all = items.flatMap(x => x.codes || []).concat(v.codes); set({ codes: [genCode(all), ...v.codes] }); setMsg(""); };
  const onPhoto = async e => {
    const f = e.target.files?.[0]; e.target.value = "";
    if (!f) return;
    setBusy("photo"); setMsg("");
    try { set({ image: await compressImage(f), imageKind: "photo" }); } catch { setMsg("Cette image n'a pas pu être lue. Essaie une photo JPEG ou PNG."); }
    setBusy("");
  };
  const genImage = async () => {
    if (!name) { setMsg("Indique d'abord le nom de l'article, l'IA s'en sert pour dessiner."); return; }
    setBusy("ai"); setMsg("");
    try { const svg = await onGenerateImage(name, v.mode === "new" ? v.category : item?.category); set({ image: svgToDataUrl(svg), imageKind: "ai" }); }
    catch (e) { setMsg(e.message || "La génération a échoué. Réessaie dans un instant."); }
    setBusy("");
  };
  const ok = name && v.codes.length > 0 && !busy;
  const preview = { ...(item || {}), trackMode: v.trackMode, name, category: v.mode === "new" ? v.category : item?.category, unit: v.mode === "new" ? v.unit : item?.unit, codes: v.codes, codeFormat: "qr", scanQty: v.scanQty, image: v.image };
  const seg = (on) => ({ ...btn, padding: "7px 12px", fontSize: 13, background: on ? T.text : T.bgCard, borderColor: on ? T.text : T.border, color: on ? T.bg : T.text, display: "inline-flex", alignItems: "center", gap: 6 });
  const grid = { display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr 1fr", gap: 10 };
  const section = { fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textFaint, marginTop: 4 };

  return (
    <Sheet T={T} isMobile={isMobile} wide title={item ? `Étiquette · ${item.name}` : "Nouvelle étiquette"} onClose={onClose}
      footer={<>
        <span style={{ flex: 1 }} />
        <button style={btn} onClick={onClose}>Annuler</button>
        <button style={{ ...primary, opacity: ok ? 1 : .5 }} disabled={!ok} onClick={async () => { setBusy("save"); await onSave(v); setBusy(""); }}>{busy === "save" ? "Enregistrement…" : "Enregistrer"}</button>
      </>}>

      <div style={section}>1 · Ce que c'est</div>
      {!value.itemId && (
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button style={seg(v.mode === "existing")} onClick={() => set({ mode: "existing" })}>Article du stock</button>
          <button style={seg(v.mode === "new")} onClick={() => set({ mode: "new", itemId: "" })}>Nouvel article</button>
        </div>
      )}
      {v.mode === "existing" ? (
        <label style={lbl}>Article
          <select id="lb-item" style={inp} value={v.itemId} onChange={e => pickItem(e.target.value)} disabled={!!value.itemId}>
            <option value="">Choisis un article…</option>
            {items.map(it => <option key={it.id} value={it.id}>{it.name}{(it.codes || []).length ? " (a déjà un code)" : ""}</option>)}
          </select>
        </label>
      ) : (
        <>
          <label style={lbl}>Nom *<input id="lb-name" style={inp} value={v.name} onChange={e => set({ name: e.target.value })} placeholder="Ex. Toner HP 59A" /></label>
          <div style={grid}>
            <label style={lbl}>Catégorie<ChoiceInput id="lb-cat" style={inp} value={v.category} options={cfg.stockCategories} onChange={x => set({ category: x })} placeholder="Nouvelle catégorie" /></label>
            <label style={lbl}>Unité<ChoiceInput id="lb-unit" style={inp} value={v.unit} options={cfg.units} onChange={x => set({ unit: x })} placeholder="Nouvelle unité" /></label>
            {v.trackMode !== "visual" && <label style={lbl}>En stock<input id="lb-qty" type="number" min="0" inputMode="numeric" style={inp} value={v.qty} onChange={e => set({ qty: e.target.value })} /></label>}
            {v.trackMode !== "visual" && <label style={lbl}>Seuil d'alerte<input id="lb-thr" type="number" min="0" inputMode="numeric" style={inp} value={v.threshold} onChange={e => set({ threshold: e.target.value })} /></label>}
          </div>
        </>
      )}

      {(v.mode === "new" || item) && <TrackModeField T={T} btn={btn} lbl={lbl} value={v.trackMode} onChange={x => set({ trackMode: x })} />}

      <div style={section}>2 · Code</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {v.codes.length === 0 && <span style={{ ...muted, fontSize: 13 }}>Aucun code. Génère-en un : il sera imprimé en QR code.</span>}
        {v.codes.map((c, i) => (
          <span key={c} style={{ display: "inline-flex", alignItems: "center", gap: 6, background: T.bgTag, borderRadius: 999, padding: "5px 6px 5px 12px", fontSize: 13 }}>
            <span style={{ fontFamily: "ui-monospace,Menlo,monospace" }}>{c}</span>{i === 0 && <span style={{ fontSize: 10.5, color: T.textFaint }}>imprimé</span>}
            <button aria-label={`Retirer le code ${c}`} onClick={() => set({ codes: v.codes.filter(x => x !== c) })} style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", padding: "0 4px", fontSize: 12 }}>✕</button>
          </span>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={generate}><Icon name="plus" size={15} />Générer un code</button>
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input id="lb-typed" style={{ ...inp, flex: 1 }} value={typed} onChange={e => setTyped(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { addCode(typed); setTyped(""); } }} placeholder="Ou tape le code d'une étiquette existante" autoComplete="off" />
        <button style={btn} disabled={!typed.trim()} onClick={() => { addCode(typed); setTyped(""); }}>Ajouter</button>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "flex-end" }}>
        {v.trackMode !== "visual" && (
          <label style={{ ...lbl, width: 170 }}>Proposé à chaque scan
            <input id="lb-scanqty" type="number" min="1" inputMode="numeric" style={inp} value={v.scanQty} onChange={e => set({ scanQty: e.target.value })} />
          </label>
        )}
      </div>
      <div style={{ ...muted, fontSize: 12 }}>Le QR code se lit avec le scanner de l'app ou directement avec l'appareil photo du téléphone (il ouvre l'app sur le scanner). Chaque scan demande une validation avant de toucher au stock.</div>

      <div style={section}>3 · Image</div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <Thumb T={T} src={v.image} size={84} radius={12} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <label htmlFor="lb-photo" style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 6 }}><Icon name="camera" size={15} />{busy === "photo" ? "Traitement…" : "Photo"}</label>
            <input id="lb-photo" type="file" accept="image/*" onChange={onPhoto} style={{ position: "absolute", width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
            <button style={{ ...btn, display: "inline-flex", alignItems: "center", gap: 6 }} onClick={genImage} disabled={!!busy}><Icon name="sparkle" size={15} />{busy === "ai" ? "L'IA dessine…" : "Générer avec l'IA"}</button>
            {v.image && <button style={{ ...btn, color: T.textSub }} onClick={() => set({ image: "", imageKind: "" })}>Retirer</button>}
          </div>
          <div style={{ ...muted, fontSize: 12 }}>{v.imageKind === "ai" ? "Pictogramme dessiné par l'IA." : v.imageKind === "photo" ? "Photo réduite pour l'étiquette." : "Prends une photo de l'article ou laisse l'IA dessiner un pictogramme."}</div>
        </div>
      </div>

      {msg && <div role="alert" style={{ fontSize: 13, color: T.red, background: T.bgHover, borderRadius: 8, padding: "8px 10px" }}>{msg}</div>}

      {name && v.codes.length > 0 && (
        <>
          <div style={section}>Aperçu</div>
          <div style={{ maxWidth: 260 }}><LabelCard item={preview} /></div>
        </>
      )}
    </Sheet>
  );
}

// ── Feuille d'impression (masquée à l'écran) ─────────────────────────────────
const LABEL_PRINT_CSS = `
.lb-print{display:none}
@media print{
  @page{size:A4 portrait;margin:8mm}
  html,body,#root{background:#fff !important}
  .lb-printing > :not(.lb-print){display:none !important}
  .lb-printing{background:#fff !important;padding:0 !important;min-height:0 !important}
  .lb-print{display:grid !important;gap:4mm}
  .lb-print *{-webkit-print-color-adjust:exact;print-color-adjust:exact}
}`;
export function LabelPrintSheet({ items, size, copies }) {
  const list = items.flatMap(it => Array.from({ length: copies }, (_, i) => ({ it, k: it.id + "-" + i })));
  return (
    <>
      <style>{LABEL_PRINT_CSS}</style>
      <div className="lb-print" style={{ gridTemplateColumns: size === "big" ? "1fr 1fr" : "1fr 1fr 1fr" }}>
        {list.map(({ it, k }) => <LabelCard key={k} item={it} big={size === "big"} />)}
      </div>
    </>
  );
}
