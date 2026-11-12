import { useState, useEffect, useRef } from "react";
import { Icon } from "./brand.jsx";

// ── Caméra : lit les QR codes et codes-barres (EAN, Code 128…) ────────────────
// Fonctionne sur iPhone (Safari) et Android, en HTTPS. Démarrage sur un geste de l'utilisateur.
export function CameraScanner({ T, onDetect, label = "Activer la caméra", height = 260 }) {
  const videoRef = useRef(null);
  const ctrl = useRef(null);
  const cb = useRef(onDetect);
  const [state, setState] = useState("idle"); // idle | starting | on | error
  const [err, setErr] = useState("");

  useEffect(() => { cb.current = onDetect; });
  useEffect(() => () => { ctrl.current?.stop(); ctrl.current = null; }, []);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("error"); setErr("La caméra n'est pas disponible ici. Ouvre l'app en HTTPS dans Safari ou Chrome.");
      return;
    }
    setState("starting"); setErr("");
    try {
      const { BrowserMultiFormatReader } = await import("@zxing/browser"); // chargé seulement quand on active la caméra
      const reader = new BrowserMultiFormatReader();
      ctrl.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" } }, audio: false },
        videoRef.current,
        res => { if (res) cb.current(res.getText()); },
      );
      setState("on");
    } catch (e) {
      setState("error");
      setErr(e?.name === "NotAllowedError" ? "L'accès à la caméra a été refusé. Autorise la caméra pour ce site dans les réglages du navigateur, puis réessaie."
        : e?.name === "NotFoundError" ? "Aucune caméra n'a été trouvée sur cet appareil."
        : `La caméra n'a pas pu démarrer (${e?.message || e}).`);
    }
  };
  const stop = () => { ctrl.current?.stop(); ctrl.current = null; setState("idle"); };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ position: "relative", width: "100%", height, borderRadius: 12, overflow: "hidden", background: "#0c0c0e" }}>
        <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: state === "on" ? "block" : "none" }} />
        {state === "on" && (
          <div aria-hidden="true" style={{ position: "absolute", inset: "18% 14%", border: "2px solid rgba(255,255,255,.85)", borderRadius: 12, boxShadow: "0 0 0 2000px rgba(0,0,0,.25)" }}>
            <div style={{ position: "absolute", left: 8, right: 8, top: "50%", height: 2, background: "#e2675d", opacity: .85 }} />
          </div>
        )}
        {state !== "on" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "rgba(255,255,255,.8)", padding: 16, textAlign: "center" }}>
            <Icon name="scan" size={40} stroke={1.3} />
            {state === "error" ? <div style={{ fontSize: 13, maxWidth: 320, color: "#ffb4ab" }}>{err}</div> : <div style={{ fontSize: 13 }}>Vise le QR code ou le code-barres de l'article.</div>}
            <button onClick={start} disabled={state === "starting"}
              style={{ background: "#fff", color: "#121214", border: "none", borderRadius: 9, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
              <Icon name="camera" size={17} />{state === "starting" ? "Démarrage…" : state === "error" ? "Réessayer" : label}
            </button>
          </div>
        )}
      </div>
      {state === "on" && (
        <button onClick={stop} style={{ alignSelf: "center", background: "transparent", border: `1px solid ${T.border}`, color: T.textSub, borderRadius: 8, padding: "6px 12px", fontSize: 12.5, cursor: "pointer" }}>Arrêter la caméra</button>
      )}
    </div>
  );
}

// ── Onglet Scanner ────────────────────────────────────────────────────────────
export function ScanTab({ T, card, btn, primary, inp, muted, isMobile, isAdmin, log, onCode, onUndo, onAssociate }) {
  const [manual, setManual] = useState("");
  const last = log[0];
  const submit = () => { if (manual.trim()) { onCode(manual); setManual(""); } };

  const tone = e => e.undone ? T.border : e.status === "ok" ? T.green : e.status === "empty" ? T.orange : T.red;

  return (
    <>
      <div>
        <h1 style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 22, margin: 0 }}>Scanner</h1>
        <div style={muted}>Chaque scan retire l'article du stock. Une erreur ? Touche « Annuler ».</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1.1fr) minmax(0,1fr)", gap: 14, alignItems: "start" }}>
        <section style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
          <CameraScanner T={T} onDetect={t => onCode(t, "camera")} height={isMobile ? 280 : 320} />
          <div style={{ display: "flex", gap: 8 }}>
            <input id="scan-manual" style={{ ...inp, flex: 1 }} value={manual} onChange={e => setManual(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()}
              placeholder="Saisir un code ou utiliser une douchette" autoComplete="off" />
            <button style={btn} onClick={submit} disabled={!manual.trim()}>Valider</button>
          </div>
        </section>

        <section style={{ ...card, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 16 }}>Dernier scan</div>
          {last ? (
            <div aria-live="polite" style={{ border: `1px solid ${tone(last)}`, background: T.bgHover, borderRadius: 12, padding: 12 }}><ScanResult T={T} btn={btn} primary={primary} isAdmin={isAdmin} e={last} onUndo={onUndo} onAssociate={onAssociate} /></div>
          ) : (
            <div style={{ ...muted, fontSize: 13, padding: "8px 0" }}>Aucun scan pour l'instant. Active la caméra ou saisis un code.</div>
          )}
          {log.length > 1 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textFaint, marginTop: 4 }}>Avant</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {log.slice(1, 12).map(e => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "6px 2px", borderTop: `1px solid ${T.borderLight}` }}>
                    <span style={{ width: 7, height: 7, borderRadius: 4, background: tone(e), flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {e.status === "unknown" ? <>Code inconnu <span style={{ fontFamily: "ui-monospace,Menlo,monospace", color: T.textSub }}>{e.code}</span></> : e.name}
                    </span>
                    <span style={{ color: T.textSub, fontVariantNumeric: "tabular-nums" }}>{e.status === "ok" ? (e.undone ? "annulé" : `−${e.take}`) : e.status === "empty" ? "stock à 0" : ""}</span>
                    {e.status === "ok" && !e.undone && <button aria-label={`Annuler le scan de ${e.name}`} onClick={() => onUndo(e)} style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", padding: 2, display: "flex" }}><Icon name="undo" size={15} /></button>}
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function ScanResult({ T, btn, primary, isAdmin, e, onUndo, onAssociate }) {
  if (e.status === "ok") return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Thumb T={T} src={e.image} size={56} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{e.name}</div>
        <div style={{ fontSize: 13.5, color: T.textSub, fontVariantNumeric: "tabular-nums" }}>
          {e.undone ? "Annulé, rien n'a été retiré" : <>−{e.take} {e.unit || ""} · reste <strong style={{ color: e.after <= e.threshold ? T.orange : T.text }}>{e.after}</strong></>}
        </div>
        {!e.undone && e.after <= e.threshold && <div style={{ fontSize: 12, color: T.orange, fontWeight: 600, marginTop: 2 }}>Sous le seuil : à commander</div>}
      </div>
      {!e.undone && <button style={{ ...btn, padding: "7px 11px", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => onUndo(e)}><Icon name="undo" size={15} />Annuler</button>}
    </div>
  );
  if (e.status === "empty") return (
    <div><div style={{ fontWeight: 700, fontSize: 16 }}>{e.name}</div><div style={{ fontSize: 13.5, color: T.red }}>Stock déjà à 0 : rien n'a été retiré. Pense à commander.</div></div>
  );
  return (
    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>Code inconnu</div>
        <div style={{ fontSize: 13, color: T.textSub }}><span style={{ fontFamily: "ui-monospace,Menlo,monospace" }}>{e.code}</span> n'est lié à aucun article.</div>
      </div>
      {isAdmin && <button style={{ ...primary, padding: "7px 12px" }} onClick={() => onAssociate(e.code)}>Associer à un article</button>}
    </div>
  );
}

export function Thumb({ T, src, size = 48, radius = 10 }) {
  return src ? (
    <img src={src} alt="" style={{ width: size, height: size, objectFit: "contain", borderRadius: radius, background: "#fff", border: `1px solid ${T.borderLight}`, flexShrink: 0 }} />
  ) : (
    <span style={{ width: size, height: size, borderRadius: radius, background: T.bgTag, color: T.textFaint, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}><Icon name="box" size={Math.round(size * 0.45)} stroke={1.4} /></span>
  );
}
