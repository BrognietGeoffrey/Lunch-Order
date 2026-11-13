import { useState, useEffect, useRef } from "react";
import { Icon } from "./brand.jsx";

// ── Caméra : lecture des QR codes ─────────────────────────────────────────────
// Fonctionne sur iPhone (Safari) et Android, en HTTPS. Démarrage sur un geste de l'utilisateur.
// Retour visible à chaque lecture retenue : cadre vert, bip, vibration. `paused` : la caméra continue de tourner
// (on suit encore le code pour ne pas le relire en boucle) mais rien n'est signalé.
const SCAN_CSS = `
@keyframes qr-sweep { 0% { top: 6%; } 50% { top: 90%; } 100% { top: 6%; } }
@keyframes qr-pop { 0% { transform: scale(1); } 40% { transform: scale(1.06); } 100% { transform: scale(1); } }
@media (prefers-reduced-motion: reduce) { .qr-line { animation: none !important; top: 50% !important; } .qr-frame { animation: none !important; } }`;

function beep(ctx, ok = true) {
  try {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = ok ? 1046 : 330;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + (ok ? 0.14 : 0.3));
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 0.32);
  } catch { /* son indisponible */ }
}

export function CameraScanner({ T, onDetect, paused = false, label = "Activer la caméra", height = 300 }) {
  const videoRef = useRef(null);
  const ctrl = useRef(null);
  const audio = useRef(null);
  const cb = useRef(onDetect);
  const pausedRef = useRef(paused);
  const [state, setState] = useState("idle"); // idle | starting | on | error
  const [err, setErr] = useState("");
  const [hit, setHit] = useState(null); // dernière lecture retenue : { t, bad } (cadre vert, ou rouge si code inconnu)

  useEffect(() => { cb.current = onDetect; pausedRef.current = paused; });
  useEffect(() => () => { ctrl.current?.stop(); ctrl.current = null; audio.current?.close?.(); }, []);
  useEffect(() => { if (!hit) return; const t = setTimeout(() => setHit(null), 900); return () => clearTimeout(t); }, [hit]);

  const start = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setState("error"); setErr("La caméra n'est pas disponible ici. Ouvre l'app en HTTPS dans Safari ou Chrome.");
      return;
    }
    setState("starting"); setErr("");
    try { audio.current = audio.current || new (window.AudioContext || window.webkitAudioContext)(); audio.current.resume?.(); } catch { /* pas de son */ }
    try {
      const { BrowserQRCodeReader } = await import("@zxing/browser"); // chargé seulement quand on active la caméra
      const reader = new BrowserQRCodeReader(undefined, { delayBetweenScanAttempts: 100, delayBetweenScanSuccess: 350 });
      ctrl.current = await reader.decodeFromConstraints(
        { video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false },
        videoRef.current,
        res => {
          if (!res) return;
          if (pausedRef.current) { cb.current(res.getText()); return; }
          // onDetect renvoie "ok" / "bad" quand la lecture est retenue (rien si le code est simplement encore dans le champ)
          const r = cb.current(res.getText());
          if (!r) return;
          setHit({ t: Date.now(), bad: r === "bad" }); beep(audio.current, r !== "bad");
          try { navigator.vibrate?.(r === "bad" ? [80, 60, 80] : 70); } catch { /* vibreur indisponible */ }
        },
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

  const lit = !!hit;
  const hitColor = hit?.bad ? "#ff6b5e" : "#3ddc84";
  const frameColor = lit ? hitColor : paused ? "rgba(255,255,255,.35)" : "#fff";
  const corner = pos => ({ position: "absolute", width: 34, height: 34, borderColor: frameColor, borderStyle: "solid", borderWidth: 0, transition: "border-color .15s", ...pos });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
      <style>{SCAN_CSS}</style>
      <div style={{ position: "relative", width: "100%", height, borderRadius: 14, overflow: "hidden", background: "#0c0c0e" }}>
        <video ref={videoRef} muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: state === "on" ? "block" : "none" }} />
        {state === "on" && (
          <>
            {/* voile autour du cadre + flash vert à la lecture */}
            <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: lit ? (hit.bad ? "rgba(255,107,94,.2)" : "rgba(61,220,132,.18)") : "transparent", transition: "background .2s" }} />
            <div aria-hidden="true" className="qr-frame"
              style={{ position: "absolute", left: "50%", top: "50%", width: `min(64%, ${Math.round(height * 0.68)}px)`, aspectRatio: "1", transform: "translate(-50%,-50%)", boxShadow: "0 0 0 2000px rgba(0,0,0,.38)", borderRadius: 14 }}>
              <div style={{ position: "absolute", inset: 0, animation: lit ? "qr-pop .35s ease" : "none", borderRadius: 14 }}>
                <span style={corner({ left: 0, top: 0, borderLeftWidth: 4, borderTopWidth: 4, borderTopLeftRadius: 14 })} />
                <span style={corner({ right: 0, top: 0, borderRightWidth: 4, borderTopWidth: 4, borderTopRightRadius: 14 })} />
                <span style={corner({ left: 0, bottom: 0, borderLeftWidth: 4, borderBottomWidth: 4, borderBottomLeftRadius: 14 })} />
                <span style={corner({ right: 0, bottom: 0, borderRightWidth: 4, borderBottomWidth: 4, borderBottomRightRadius: 14 })} />
                {!paused && !lit && <span className="qr-line" style={{ position: "absolute", left: "8%", right: "8%", height: 2, background: "#e2675d", boxShadow: "0 0 10px #e2675d", animation: "qr-sweep 2.4s ease-in-out infinite" }} />}
                {lit && <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", color: hitColor }}><Icon name={hit.bad ? "alert" : "check"} size={64} stroke={hit.bad ? 2.2 : 3} /></span>}
              </div>
            </div>
            {/* état en clair, en haut de l'image */}
            <div role="status" aria-live="polite" style={{ position: "absolute", left: "50%", top: 12, transform: "translateX(-50%)", display: "inline-flex", alignItems: "center", gap: 7, whiteSpace: "nowrap",
              background: lit ? (hit.bad ? "#b3261e" : "#1f9d55") : paused ? "rgba(0,0,0,.7)" : "rgba(0,0,0,.55)", color: "#fff", borderRadius: 999, padding: "6px 13px", fontSize: 13, fontWeight: 600 }}>
              {lit ? <><Icon name={hit.bad ? "alert" : "check"} size={15} stroke={2.4} />{hit.bad ? "QR code lu · à vérifier" : "QR code lu"}</> : paused ? "En pause : valide ou annule" : <><span style={{ width: 8, height: 8, borderRadius: 4, background: "#e2675d" }} />Recherche d'un QR code…</>}
            </div>
          </>
        )}
        {state !== "on" && (
          <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, color: "rgba(255,255,255,.8)", padding: 16, textAlign: "center" }}>
            <Icon name="scan" size={40} stroke={1.3} />
            {state === "error" ? <div style={{ fontSize: 13, maxWidth: 320, color: "#ffb4ab" }}>{err}</div> : <div style={{ fontSize: 13 }}>Place le QR code de l'article dans le cadre, à 10–20 cm.</div>}
            <button onClick={start} disabled={state === "starting"}
              style={{ background: "#fff", color: "#121214", border: "none", borderRadius: 9, padding: "11px 20px", fontSize: 14.5, fontWeight: 600, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 8 }}>
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

// ── Validation d'un scan ──────────────────────────────────────────────────────
// confirm = { kind: "count"|"visual"|"empty"|"unknown", code, item, qty }
export function ConfirmSheet({ T, btn, primary, isMobile, isAdmin, confirm, onConfirm, onCancel, onAssociate }) {
  const it = confirm.item;
  const max = it ? Math.max(0, Number(it.qty) || 0) : 0;
  const [qty, setQty] = useState(confirm.qty || 1);
  const [busy, setBusy] = useState(false);
  const canGo = confirm.kind === "count" ? qty >= 1 && qty <= max : confirm.kind === "visual" && !it.lowFlag;
  const go = async () => { if (!canGo || busy) return; setBusy(true); await onConfirm(qty); setBusy(false); };
  useEffect(() => {
    const k = e => { if (e.key === "Escape") onCancel(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  });
  const big = { ...btn, padding: "14px 16px", fontSize: 15.5, flex: 1, justifyContent: "center", display: "inline-flex", alignItems: "center", gap: 8 };
  const stepBtn = { width: 48, height: 48, borderRadius: 12, border: `1px solid ${T.border}`, background: T.bgCard, color: T.text, fontSize: 24, fontWeight: 700, cursor: "pointer" };
  const after = max - qty;
  const low = it && after <= (Number(it.threshold) || 0);

  return (
    <div role="dialog" aria-modal="true" aria-label="Valider le scan" onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
      style={{ position: "fixed", inset: 0, zIndex: 70, background: "rgba(0,0,0,.5)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 16 }}>
      <div style={{ background: T.bgCard, color: T.text, width: "100%", maxWidth: 440, borderRadius: isMobile ? "18px 18px 0 0" : 18, boxShadow: T.shadowHover, padding: `20px 20px calc(20px + env(safe-area-inset-bottom, 0px))`, display: "flex", flexDirection: "column", gap: 16 }}>
        {confirm.kind === "unknown" ? (
          <>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <span style={{ width: 56, height: 56, borderRadius: 14, background: "rgba(179,38,30,.1)", color: T.red, display: "flex", alignItems: "center", justifyContent: "center" }}><Icon name="alert" size={28} /></span>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 20 }}>Code inconnu</div>
                <div style={{ fontSize: 13.5, color: T.textSub, overflowWrap: "anywhere" }}><span style={{ fontFamily: "ui-monospace,Menlo,monospace" }}>{confirm.code}</span> n'est lié à aucun article.</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={big} onClick={onCancel}>Fermer</button>
              {isAdmin && <button style={{ ...big, ...primary, padding: "14px 16px" }} onClick={() => { onCancel(); onAssociate(confirm.code); }}>Associer à un article</button>}
            </div>
          </>
        ) : (
          <>
            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
              <Thumb T={T} src={it.image} size={72} radius={14} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.green }}>QR code lu</div>
                <div style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 21, lineHeight: 1.2 }}>{it.name}</div>
                <div style={{ fontSize: 13, color: T.textSub }}>{[it.category, it.location].filter(Boolean).join(" · ")}</div>
              </div>
            </div>

            {confirm.kind === "count" && (
              <>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: T.bgHover, borderRadius: 12, padding: "12px 14px" }}>
                  <div style={{ fontSize: 13.5, color: T.textSub }}>Quantité à retirer</div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button aria-label="Retirer une unité de moins" style={{ ...stepBtn, opacity: qty > 1 ? 1 : .4 }} disabled={qty <= 1} onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
                    <span style={{ minWidth: 40, textAlign: "center", fontFamily: "'Jost',sans-serif", fontSize: 30, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>{qty}</span>
                    <button aria-label="Retirer une unité de plus" style={{ ...stepBtn, opacity: qty < max ? 1 : .4 }} disabled={qty >= max} onClick={() => setQty(q => Math.min(max, q + 1))}>+</button>
                  </div>
                </div>
                <div style={{ fontSize: 13.5, color: T.textSub, fontVariantNumeric: "tabular-nums" }}>
                  En stock : <strong style={{ color: T.text }}>{max} {it.unit || ""}</strong> → après : <strong style={{ color: low ? T.orange : T.text }}>{after}</strong>
                  {low && <span style={{ color: T.orange, fontWeight: 600 }}> · passera « à commander »</span>}
                </div>
              </>
            )}
            {confirm.kind === "empty" && <div style={{ fontSize: 14, color: T.red, fontWeight: 600 }}>Stock déjà à 0 : il n'y a rien à retirer. Pense à commander.</div>}
            {confirm.kind === "visual" && (it.lowFlag
              ? <div style={{ fontSize: 14, color: T.textSub, lineHeight: 1.5 }}>Déjà signalé{it.lowBy ? ` par ${it.lowBy}` : ""}{it.lowAt ? ` le ${new Date(it.lowAt).toLocaleString("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : ""}.{it.orderedAt ? " La commande est passée." : " Rien de plus à faire."}</div>
              : <div style={{ fontSize: 14, color: T.textSub, lineHeight: 1.5 }}>Article suivi à vue. Signaler qu'il en reste peu ? Les admins seront prévenus par mail.</div>)}

            <div style={{ display: "flex", gap: 10 }}>
              <button style={big} onClick={onCancel}>{canGo ? "Annuler" : "Fermer"}</button>
              {canGo && (
                <button style={{ ...big, background: confirm.kind === "visual" ? T.orange : T.green, borderColor: confirm.kind === "visual" ? T.orange : T.green, color: "#fff", opacity: busy ? .6 : 1 }} disabled={busy} onClick={go}>
                  <Icon name="check" size={18} stroke={2.2} />{confirm.kind === "visual" ? "Signaler stock bas" : `Valider −${qty}`}
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Onglet Scanner ────────────────────────────────────────────────────────────
export function ScanTab({ T, card, btn, inp, muted, isMobile, log, confirm, onCode, onUndo }) {
  const [manual, setManual] = useState("");
  const last = log[0];
  const submit = () => { if (manual.trim()) { onCode(manual); setManual(""); } };
  const tone = e => e.undone ? T.border : e.status === "ok" ? T.green : e.status === "flagged" ? T.orange : T.textFaint;

  return (
    <>
      <div>
        <h1 style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 22, margin: 0 }}>Scanner</h1>
        <div style={muted}>Scanne le QR code de l'article, vérifie, puis valide : rien ne bouge dans le stock avant ta validation.</div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "minmax(0,1.1fr) minmax(0,1fr)", gap: 14, alignItems: "start" }}>
        <section style={{ ...card, display: "flex", flexDirection: "column", gap: 12 }}>
          <CameraScanner T={T} onDetect={t => onCode(t, "camera")} paused={!!confirm} height={isMobile ? 340 : 360} />
          <div style={{ display: "flex", gap: 8 }}>
            <input id="scan-manual" style={{ ...inp, flex: 1 }} value={manual} onChange={e => setManual(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); submit(); } }}
              placeholder="Ou saisis le code de l'étiquette" autoComplete="off" />
            <button style={btn} onClick={submit} disabled={!manual.trim()}>OK</button>
          </div>
        </section>

        <section style={{ ...card, display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 16 }}>Dernier scan validé</div>
          {last ? (
            <div aria-live="polite" style={{ border: `1px solid ${tone(last)}`, background: T.bgHover, borderRadius: 12, padding: 12 }}><ScanResult T={T} btn={btn} e={last} onUndo={onUndo} /></div>
          ) : (
            <div style={{ ...muted, fontSize: 13, padding: "8px 0" }}>Aucun scan validé pour l'instant.</div>
          )}
          {log.length > 1 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", color: T.textFaint, marginTop: 4 }}>Avant</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                {log.slice(1, 12).map(e => (
                  <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, padding: "6px 2px", borderTop: `1px solid ${T.borderLight}` }}>
                    <span style={{ width: 7, height: 7, borderRadius: 4, background: tone(e), flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.name}</span>
                    <span style={{ color: T.textSub, fontVariantNumeric: "tabular-nums" }}>{e.status === "ok" ? (e.undone ? "annulé" : `−${e.take}`) : (e.undone ? "annulé" : "signalé")}</span>
                    {!e.undone && <button aria-label={`Annuler le scan de ${e.name}`} onClick={() => onUndo(e)} style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", padding: 2, display: "flex" }}><Icon name="undo" size={15} /></button>}
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

function ScanResult({ T, btn, e, onUndo }) {
  const undo = !e.undone && <button style={{ ...btn, padding: "7px 11px", display: "inline-flex", alignItems: "center", gap: 6 }} onClick={() => onUndo(e)}><Icon name="undo" size={15} />Annuler</button>;
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
      <Thumb T={T} src={e.image} size={56} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 16 }}>{e.name}</div>
        {e.status === "ok" ? (
          <>
            <div style={{ fontSize: 13.5, color: T.textSub, fontVariantNumeric: "tabular-nums" }}>
              {e.undone ? "Annulé, rien n'a été retiré" : <>−{e.take} {e.unit || ""} · reste <strong style={{ color: e.after <= e.threshold ? T.orange : T.text }}>{e.after}</strong></>}
            </div>
            {!e.undone && e.after <= e.threshold && <div style={{ fontSize: 12, color: T.orange, fontWeight: 600, marginTop: 2 }}>Sous le seuil : à commander</div>}
          </>
        ) : (
          <div style={{ fontSize: 13.5, color: e.undone ? T.textSub : T.orange, fontWeight: e.undone ? 400 : 600 }}>
            {e.undone ? "Annulé : l'article est de nouveau OK" : "Signalé : stock bas. Les admins sont prévenus par mail."}
          </div>
        )}
      </div>
      {undo}
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
