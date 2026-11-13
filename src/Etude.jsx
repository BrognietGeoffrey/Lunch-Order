import { useState, useEffect, useRef } from "react";
import {
  collection, doc, onSnapshot, addDoc, setDoc, updateDoc, deleteDoc,
  increment, runTransaction, query, orderBy, limit, arrayUnion,
} from "firebase/firestore";
import Planning from "./Planning.jsx";
import { accessOf } from "./access.js";
import { BrandLogo, Icon } from "./brand.jsx";
import { ChoiceInput } from "./fields.jsx";
import { ScanTab, ConfirmSheet, Thumb } from "./Scanner.jsx";
import { LabelsTab, LabelModal, LabelPrintSheet } from "./Labels.jsx";
import { normCode, parseScan, findByCode } from "./codes.js";
import { num, isLow, isVisual } from "./stockRules.js";
import { recipientsOf } from "./alertRules.js";
import { AlertSettings } from "./AlertSettings.jsx";
import { ApprovalSettings } from "./ApprovalSettings.jsx";
import { approvalFor, canApprove, involves } from "./approval.js";

// ── Espace Étude : stock, demandes, matériel, planning ────────────────────────
// Firestore :
//   stock_items/{id}  { name, category, unit, qty, threshold, location, supplier, note, orderedAt, updatedAt,
//                       codes[], codeFormat, scanQty, image, imageKind }   → scanner et étiquettes (Scanner.jsx, Labels.jsx)
//                       trackMode "count"|"visual", lowFlag, lowAt, lowBy  → seuil visuel (voir stockRules.js)
//   stock_moves/{id}  { itemId, itemName, delta, qtyAfter, reason, by, ts }
//   tickets/{id}      { number, title, description, category, priority, status, requester, assignee, assetId, comments[], createdAt, updatedAt,
//                       approval { required, state, approvers[], by, at, comment, auto } }   → approbation (approval.js)
//   assets/{id}       { tag, type, brand, model, serial, assignedTo, location, status, purchaseDate, warrantyEnd, note, updatedAt }
//   config/etude      { title, stockCategories[], units[], locations[], ticketCategories[], assetTypes[], ticketSeq,
//                       alertRecipients[{email,instant,digest,days,hour}], digestSent, digestLastRun } → alertes mail (alertRules.js)

// Étapes de traitement (structure du workflow, pas des données métier)
const TICKET_STATUSES = [
  { id: "approval", label: "À approuver", color: "#b7791f" },
  { id: "new", label: "Nouveau", color: "#1c7ed6" },
  { id: "progress", label: "En cours", color: "#e67700" },
  { id: "waiting", label: "En attente", color: "#7048e8" },
  { id: "resolved", label: "Résolu", color: "#2f9e44" },
  { id: "rejected", label: "Refusée", color: "#b3261e" },
  { id: "closed", label: "Fermé", color: "#868e96" },
];
const OPEN = ["approval", "new", "progress", "waiting"];
const APPROVAL_ONLY = ["approval", "rejected"]; // statuts posés uniquement par la décision d'approbation
const PRIORITIES = [
  { id: "low", label: "Basse", color: "#868e96" },
  { id: "normal", label: "Normale", color: "#1c7ed6" },
  { id: "high", label: "Haute", color: "#e8590c" },
  { id: "urgent", label: "Urgente", color: "#c92a2a" },
];
const ASSET_STATUSES = [
  { id: "in_use", label: "En service", color: "#2f9e44" },
  { id: "stock", label: "En réserve", color: "#1c7ed6" },
  { id: "repair", label: "En réparation", color: "#e67700" },
  { id: "retired", label: "Hors service", color: "#868e96" },
];
// Listes de départ, écrites dans config/etude au premier passage d'un admin puis modifiables dans Réglages
const STARTER_CFG = {
  stockCategories: ["Papeterie", "Impression", "Cuisine", "Entretien", "Informatique"],
  units: ["pièce", "boîte", "ramette", "paquet", "cartouche"],
  locations: [],
  ticketCategories: ["Fournitures", "Informatique", "Matériel", "Bâtiment", "Autre"],
  assetTypes: ["PC portable", "PC fixe", "Écran", "Imprimante", "Téléphone", "Autre"],
  alertEmails: [],
};
// Demande au serveur d'envoyer l'alerte mail (il vérifie lui-même le seuil et n'envoie qu'une fois)
const notifyLow = itemId => fetch("/api/stock-alert", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "item", itemId }) }).catch(() => {});
const LIST_FIELDS = [
  { key: "stockCategories", label: "Catégories de stock", hint: "Ex. Papeterie, Cuisine" },
  { key: "units", label: "Unités", hint: "Ex. boîte, ramette" },
  { key: "locations", label: "Emplacements", hint: "Ex. Armoire accueil, Cave" },
  { key: "ticketCategories", label: "Catégories de demandes", hint: "Ex. Informatique" },
  { key: "assetTypes", label: "Types de matériel", hint: "Ex. PC portable" },
];

const nowTs = () => new Date().getTime(); // horodatage des écritures
const buzz = p => { try { navigator.vibrate?.(p); } catch { /* vibreur indisponible */ } };
const byId = (list, id) => list.find(x => x.id === id) || list[0];
const rgba = (hex, a) => { const m = /^#?([0-9a-f]{6})$/i.exec(hex || ""); if (!m) return `rgba(134,142,150,${a})`; const n = parseInt(m[1], 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };
const fmtDate = ts => ts ? new Date(ts).toLocaleDateString("fr-BE", { day: "numeric", month: "short", year: "numeric" }) : "—";
const fmtDateTime = ts => ts ? new Date(ts).toLocaleString("fr-BE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
const ticketNo = n => "DEM-" + String(n || 0).padStart(4, "0");
const daysUntil = d => { if (!d) return null; const t = new Date(d + "T00:00:00").getTime(); return Math.ceil((t - nowTs()) / 86400000); };
const stockState = it => {
  if (!isVisual(it) && num(it.qty) <= 0) return { label: "Rupture", color: "#c92a2a" };
  if (isLow(it)) return it.orderedAt ? { label: "Commandé", color: "#1c7ed6" } : { label: "À commander", color: "#e8590c" };
  return { label: "OK", color: "#2f9e44" };
};

export default function Etude({ db, T, user, members, role, canLunch, lunchName = "Lunch", brandName = "Gestion Étude", onSwitch, isDark, toggleTheme, onLogout, isMobile, pendingScan = "", onPendingDone, onAccount }) {
  const isAdmin = role === "admin";
  const [tab, setTab] = useState(() => { try { return localStorage.getItem("etude_tab") || "home"; } catch { return "home"; } });
  const [items, setItems] = useState([]);
  const [moves, setMoves] = useState([]);
  const [tickets, setTickets] = useState([]);
  const [assets, setAssets] = useState([]);
  const [cfgDoc, setCfgDoc] = useState(null); // null = pas encore chargé
  const [toast, setToast] = useState(null);
  const [stockFilter, setStockFilter] = useState({ q: "", cat: "", low: false });
  const [ticketFilter, setTicketFilter] = useState("open");
  const [assetFilter, setAssetFilter] = useState({ q: "", type: "", status: "" });
  const [itemModal, setItemModal] = useState(null);   // {…item} ou {} pour nouveau
  const [ticketModal, setTicketModal] = useState(null); // {title, category, …} pour nouvelle demande
  const [openTicketId, setOpenTicketId] = useState(null);
  const [assetModal, setAssetModal] = useState(null);
  const [showMoves, setShowMoves] = useState(false);
  const toastTimer = useRef(null);
  const [scanLog, setScanLog] = useState([]);
  const [labelModal, setLabelModal] = useState(null); // { itemId?, codes?, mode? }
  const [printLabels, setPrintLabels] = useState(null); // { ids, size, copies }
  const [moreOpen, setMoreOpen] = useState(false);
  const itemsRef = useRef([]);
  const lastSeen = useRef({ code: "", t: 0 });
  const scanSeq = useRef(0);
  const [confirmScan, setConfirmScan] = useState(null);
  const confirmRef = useRef(null);
  const pendingRef = useRef(pendingScan);
  const handleRef = useRef(null);
  const doneRef = useRef(onPendingDone);

  const cfg = { ...STARTER_CFG, ...(cfgDoc || {}) };
  const cfgRef = doc(db, "config", "etude");

  useEffect(() => {
    const unsubs = [
      onSnapshot(collection(db, "stock_items"), s => {
        const a = []; s.forEach(x => a.push({ id: x.id, ...x.data() })); a.sort((x, y) => (x.name || "").localeCompare(y.name || "", "fr"));
        itemsRef.current = a; setItems(a);
        // QR code scanné avec l'appareil photo du téléphone : on traite le code une fois le stock chargé
        if (pendingRef.current) { const c = pendingRef.current; pendingRef.current = ""; setTab("scan"); setTimeout(() => { handleRef.current?.(c); doneRef.current?.(); }, 0); }
      }),
      onSnapshot(query(collection(db, "stock_moves"), orderBy("ts", "desc"), limit(150)), s => { const a = []; s.forEach(x => a.push({ id: x.id, ...x.data() })); setMoves(a); }),
      onSnapshot(collection(db, "tickets"), s => { const a = []; s.forEach(x => a.push({ id: x.id, ...x.data() })); a.sort((x, y) => (y.createdAt || 0) - (x.createdAt || 0)); setTickets(a); }),
      onSnapshot(collection(db, "assets"), s => { const a = []; s.forEach(x => a.push({ id: x.id, ...x.data() })); a.sort((x, y) => (x.tag || "").localeCompare(y.tag || "", "fr", { numeric: true })); setAssets(a); }),
      onSnapshot(doc(db, "config", "etude"), s => setCfgDoc(s.exists() ? s.data() : {})),
    ];
    return () => unsubs.forEach(u => u());
  }, [db]);

  // Premier passage d'un admin : on écrit les listes de départ dans Firestore
  useEffect(() => {
    if (!isAdmin || cfgDoc === null) return;
    const missing = Object.keys(STARTER_CFG).filter(k => cfgDoc[k] === undefined);
    if (missing.length) setDoc(doc(db, "config", "etude"), Object.fromEntries(missing.map(k => [k, STARTER_CFG[k]])), { merge: true }).catch(() => {});
  }, [isAdmin, cfgDoc, db]);

  useEffect(() => { try { localStorage.setItem("etude_tab", tab); } catch { /* stockage indisponible */ } }, [tab]);

  const showToast = (msg, tone = "info") => { setToast({ msg, tone }); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 3500); };
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  const fail = e => { console.error(e); showToast("L'enregistrement a échoué. Vérifie la connexion et réessaie.", "error"); };

  // ── Dérivés ──
  const low = items.filter(isLow);
  const lowToOrder = low.filter(it => !it.orderedAt);
  const openTickets = tickets.filter(t => OPEN.includes(t.status));
  const myTickets = tickets.filter(t => t.requester === user);
  const visibleTickets = isAdmin ? tickets : tickets.filter(t => involves(t, user)); // demandeur ou approbateur
  const toApprove = tickets.filter(t => canApprove(t, user));
  const newTickets = tickets.filter(t => t.status === "new");
  const myAssets = assets.filter(a => a.assignedTo === user);
  const warrantySoon = assets.filter(a => a.status !== "retired" && a.warrantyEnd && daysUntil(a.warrantyEnd) <= 60);
  const memberNames = members.map(m => m.username);

  // ── Stock ──
  const changeQty = async (it, delta, reason) => {
    const before = num(it.qty), after = before + delta;
    if (after < 0) return;
    try {
      await updateDoc(doc(db, "stock_items", it.id), { qty: increment(delta), updatedAt: nowTs(), ...(after > num(it.threshold) ? { orderedAt: null, alertSentAt: null } : {}) });
      await addDoc(collection(db, "stock_moves"), { itemId: it.id, itemName: it.name, delta, qtyAfter: after, reason: reason || (delta < 0 ? "Sortie" : "Entrée"), by: user, ts: nowTs() });
      if (before > num(it.threshold) && after <= num(it.threshold)) {
        showToast(`⚠️ ${it.name} passe sous le seuil : ${after} ${it.unit || ""} restant${after > 1 ? "s" : ""}.`, "warn");
        notifyLow(it.id);
      }
    } catch (e) { fail(e); }
  };
  // Seuil visuel : signaler « stock bas » (scan ou bouton) / remettre à OK au réassort
  const flagLow = async (it, reason = "Signalé stock bas") => {
    if (it.lowFlag) return false;
    try {
      await updateDoc(doc(db, "stock_items", it.id), { lowFlag: true, lowAt: nowTs(), lowBy: user, updatedAt: nowTs() });
      await addDoc(collection(db, "stock_moves"), { itemId: it.id, itemName: it.name, delta: 0, qtyAfter: "bas", reason, by: user, ts: nowTs() });
      if (!reason.startsWith("Scan")) showToast(`⚠️ ${it.name} signalé : stock bas. Les admins sont prévenus.`, "warn"); // au scan, le résultat s'affiche déjà
      notifyLow(it.id);
      return true;
    } catch (e) { fail(e); return false; }
  };
  const clearLow = async (it, reason = "Réapprovisionné") => {
    try {
      await updateDoc(doc(db, "stock_items", it.id), { lowFlag: false, lowAt: null, lowBy: null, orderedAt: null, orderedBy: null, alertSentAt: null, updatedAt: nowTs() });
      await addDoc(collection(db, "stock_moves"), { itemId: it.id, itemName: it.name, delta: 0, qtyAfter: "OK", reason, by: user, ts: nowTs() });
      if (reason === "Réapprovisionné") showToast(`${it.name} : stock de nouveau OK`);
    } catch (e) { fail(e); }
  };
  // Ajoute aux listes des Réglages les valeurs saisies via « Autre… » (catégorie, unité, emplacement, type)
  const remember = vals => {
    const patch = {};
    Object.entries(vals).forEach(([key, val]) => { const x = (val || "").trim(); if (x && !(cfg[key] || []).includes(x)) patch[key] = arrayUnion(x); });
    if (Object.keys(patch).length) setDoc(cfgRef, patch, { merge: true }).catch(() => {});
  };
  const saveItem = async v => {
    remember({ stockCategories: v.category, units: v.unit, locations: v.location });
    const data = {
      name: v.name.trim(), category: (v.category || "").trim(), unit: (v.unit || "").trim(),
      threshold: Math.max(0, num(v.threshold)), location: (v.location || "").trim(),
      supplier: (v.supplier || "").trim(), note: (v.note || "").trim(), updatedAt: nowTs(),
      trackMode: v.trackMode === "visual" ? "visual" : "count",
    };
    const qty = Math.max(0, num(v.qty));
    try {
      if (v.id && data.trackMode === "visual") {
        await updateDoc(doc(db, "stock_items", v.id), data);
      } else if (v.id) {
        const old = items.find(x => x.id === v.id) || {};
        const delta = qty - num(old.qty);
        await updateDoc(doc(db, "stock_items", v.id), { ...data, qty, ...(qty > data.threshold ? { orderedAt: null, alertSentAt: null } : {}) });
        if (delta) await addDoc(collection(db, "stock_moves"), { itemId: v.id, itemName: data.name, delta, qtyAfter: qty, reason: "Ajustement", by: user, ts: nowTs() });
        if (num(old.qty) > num(old.threshold) && qty <= data.threshold) notifyLow(v.id);
      } else {
        const r = await addDoc(collection(db, "stock_items"), { ...data, qty: data.trackMode === "visual" ? 0 : qty, lowFlag: false, orderedAt: null, alertSentAt: null, createdAt: nowTs() });
        if (qty && data.trackMode !== "visual") await addDoc(collection(db, "stock_moves"), { itemId: r.id, itemName: data.name, delta: qty, qtyAfter: qty, reason: "Stock initial", by: user, ts: nowTs() });
      }
      setItemModal(null);
      showToast(v.id ? "Article enregistré" : "Article ajouté");
    } catch (e) { fail(e); }
  };
  const deleteItem = async it => { try { await deleteDoc(doc(db, "stock_items", it.id)); setItemModal(null); showToast("Article supprimé"); } catch (e) { fail(e); } };
  const markOrdered = async (it, on = true) => { try { await updateDoc(doc(db, "stock_items", it.id), { orderedAt: on ? nowTs() : null, orderedBy: on ? user : null }); } catch (e) { fail(e); } };
  const copyOrderList = async () => {
    const lines = low.map(it => `- ${it.name} : ${isVisual(it) ? "stock bas (signalé)" : `${num(it.qty)} ${it.unit || ""} en stock (seuil ${num(it.threshold)})`}${it.supplier ? " · " + it.supplier : ""}`);
    const text = `À commander (${fmtDate(nowTs())})\n${lines.join("\n")}`;
    try { await navigator.clipboard.writeText(text); showToast("Liste copiée, tu peux la coller dans un mail"); }
    catch { showToast("Copie impossible sur cet appareil", "error"); }
  };

  // ── Scanner ──
  // Chaque scan ouvre une validation : rien ne change dans le stock avant « Valider ».
  // source "camera" : la caméra relit le code à chaque image ; on ne le propose à nouveau
  // que s'il a quitté le champ (non vu depuis 1,5 s). Pendant une validation, la caméra est ignorée.
  const handleCode = (raw, source = "manual") => {
    const code = parseScan(raw);
    if (!code) return "";
    const t = nowTs();
    if (source === "camera") {
      const seen = lastSeen.current;
      lastSeen.current = { code, t };
      if (confirmRef.current) return "";
      if (seen.code === code && t - seen.t < 1500) return "";
    }
    if (confirmRef.current) return "";
    const id = t + "-" + (++scanSeq.current);
    const it = findByCode(itemsRef.current, code);
    let c;
    if (!it) c = { id, kind: "unknown", code };
    else if (isVisual(it)) c = { id, kind: "visual", code, item: it };
    else if (num(it.qty) <= 0) c = { id, kind: "empty", code, item: it };
    else c = { id, kind: "count", code, item: it, qty: Math.min(Math.max(1, num(it.scanQty) || 1), num(it.qty)) };
    const res = c.kind === "unknown" || c.kind === "empty" ? "bad" : "ok";
    if (source !== "camera") buzz(res === "bad" ? [80, 60, 80] : 60); // la caméra fait son propre retour (cadre, bip, vibration)
    confirmRef.current = c; setConfirmScan(c);
    return res;
  };
  const closeConfirm = () => { confirmRef.current = null; setConfirmScan(null); };
  const confirmScanNow = async qty => {
    const c = confirmRef.current; if (!c?.item) return closeConfirm();
    const it = itemsRef.current.find(x => x.id === c.item.id) || c.item; // état le plus récent
    const entry = { id: c.id, code: c.code, ts: nowTs(), itemId: it.id, name: it.name, image: it.image };
    if (c.kind === "visual") {
      if (!it.lowFlag) { setScanLog(l => [{ ...entry, status: "flagged" }, ...l].slice(0, 40)); await flagLow(it, "Scan : stock bas"); }
    } else if (c.kind === "count") {
      const before = num(it.qty);
      const take = Math.min(Math.max(1, num(qty) || 1), before);
      if (take > 0) {
        setScanLog(l => [{ ...entry, status: "ok", unit: it.unit, take, after: before - take, threshold: num(it.threshold) }, ...l].slice(0, 40));
        await changeQty(it, -take, "Scan");
      }
    }
    buzz(60);
    closeConfirm();
  };
  useEffect(() => { handleRef.current = handleCode; doneRef.current = onPendingDone; });
  const undoScan = async e => {
    const it = itemsRef.current.find(x => x.id === e.itemId);
    if (!it || e.undone) return;
    setScanLog(l => l.map(x => x.id === e.id ? { ...x, undone: true } : x));
    if (e.status === "flagged") await clearLow(it, "Annulation scan");
    else await changeQty(it, e.take, "Annulation scan");
  };

  // ── Étiquettes ──
  const generateImage = async (name, category) => {
    const r = await fetch("/api/item-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, category }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j.svg) throw new Error(j.error || "La génération a échoué. Réessaie dans un instant.");
    return j.svg;
  };
  const saveLabel = async v => {
    if (v.mode === "new") remember({ stockCategories: v.category, units: v.unit });
    const codes = v.codes.map(normCode).filter(Boolean);
    const data = { codes, codeFormat: "qr", scanQty: Math.max(1, num(v.scanQty) || 1), image: v.image || "", imageKind: v.imageKind || "", trackMode: v.trackMode === "visual" ? "visual" : "count", updatedAt: nowTs() };
    try {
      if (v.mode === "new") {
        const qty = data.trackMode === "visual" ? 0 : Math.max(0, num(v.qty));
        const r = await addDoc(collection(db, "stock_items"), {
          name: v.name.trim(), category: (v.category || "").trim(), unit: (v.unit || "").trim(), qty, threshold: Math.max(0, num(v.threshold)),
          location: "", supplier: "", note: "", lowFlag: false, orderedAt: null, alertSentAt: null, createdAt: nowTs(), ...data,
        });
        if (qty) await addDoc(collection(db, "stock_moves"), { itemId: r.id, itemName: v.name.trim(), delta: qty, qtyAfter: qty, reason: "Stock initial", by: user, ts: nowTs() });
      } else {
        if (!v.itemId) return;
        await updateDoc(doc(db, "stock_items", v.itemId), data);
      }
      setLabelModal(null);
      showToast("Étiquette enregistrée");
    } catch (e) { fail(e); }
  };
  const startPrint = (ids, size, copies) => setPrintLabels({ ids, size, copies });
  useEffect(() => {
    if (!printLabels) return;
    const done = () => setPrintLabels(null);
    window.addEventListener("afterprint", done);
    const t = setTimeout(() => window.print(), 700); // laisse le temps aux QR codes d'être générés
    return () => { clearTimeout(t); window.removeEventListener("afterprint", done); };
  }, [printLabels]);

  // ── Demandes ──
  const createTicket = async v => {
    const ap = approvalFor(cfg, v.category || "", user);
    const pending = !!ap && !ap.auto;
    const t0 = nowTs();
    const approval = !ap ? null : ap.auto
      ? { required: true, state: "approved", approvers: [], by: user, at: t0, auto: true }
      : { required: true, state: "pending", approvers: ap.approvers };
    const firstNote = !ap ? [] : [{ author: user, ts: t0, system: true,
      text: ap.auto ? "Approuvée automatiquement (le demandeur est le seul approbateur)" : `En attente d'approbation : ${ap.approvers.join(", ")}` }];
    try {
      const ref = doc(collection(db, "tickets"));
      const number = await runTransaction(db, async tx => {
        const s = await tx.get(cfgRef);
        const n = num(s.exists() ? s.data().ticketSeq : 0) + 1;
        tx.set(cfgRef, { ticketSeq: n }, { merge: true });
        tx.set(ref, {
          number: n, title: v.title.trim(), description: (v.description || "").trim(), category: v.category || "",
          priority: v.priority || "normal", status: pending ? "approval" : "new", requester: user, assignee: "", assetId: v.assetId || "",
          approval, comments: firstNote, createdAt: t0, updatedAt: t0,
        });
        return n;
      });
      setTicketModal(null);
      showToast(pending ? `Demande ${ticketNo(number)} envoyée pour approbation` : `Demande ${ticketNo(number)} créée`);
      if (pending) fetch("/api/ticket-notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId: ref.id }) }).catch(() => {});
    } catch (e) { fail(e); }
  };
  // Décision d'un approbateur
  const decideTicket = async (t, ok, comment) => {
    if (!canApprove(t, user)) return;
    const c = (comment || "").trim();
    try {
      await updateDoc(doc(db, "tickets", t.id), {
        status: ok ? "new" : "rejected", updatedAt: nowTs(),
        approval: { ...(t.approval || {}), state: ok ? "approved" : "rejected", by: user, at: nowTs(), comment: c },
        comments: arrayUnion({ author: user, ts: nowTs(), system: true, text: (ok ? "Approuvée" : "Refusée") + (c ? ` : ${c}` : "") }),
      });
      showToast(ok ? `${ticketNo(t.number)} approuvée` : `${ticketNo(t.number)} refusée`);
      fetch("/api/ticket-notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ticketId: t.id, event: "decision" }) }).catch(() => {});
    } catch (e) { fail(e); }
  };
  const updateTicket = async (t, patch, note) => {
    try {
      await updateDoc(doc(db, "tickets", t.id), { ...patch, updatedAt: nowTs(), ...(note ? { comments: arrayUnion({ author: user, text: note, ts: nowTs(), system: true }) } : {}) });
    } catch (e) { fail(e); }
  };
  const addComment = async (t, text) => {
    if (!text.trim()) return;
    try { await updateDoc(doc(db, "tickets", t.id), { comments: arrayUnion({ author: user, text: text.trim(), ts: nowTs() }), updatedAt: nowTs() }); } catch (e) { fail(e); }
  };
  const deleteTicket = async t => { try { await deleteDoc(doc(db, "tickets", t.id)); setOpenTicketId(null); showToast("Demande supprimée"); } catch (e) { fail(e); } };

  // ── Matériel ──
  const saveAsset = async v => {
    remember({ assetTypes: v.type, locations: v.location });
    const data = {
      tag: (v.tag || "").trim(), type: (v.type || "").trim(), brand: (v.brand || "").trim(), model: (v.model || "").trim(),
      serial: (v.serial || "").trim(), assignedTo: v.assignedTo || "", location: (v.location || "").trim(), status: v.status || "in_use",
      purchaseDate: v.purchaseDate || "", warrantyEnd: v.warrantyEnd || "", note: (v.note || "").trim(), updatedAt: nowTs(),
    };
    try {
      if (v.id) await updateDoc(doc(db, "assets", v.id), data);
      else await addDoc(collection(db, "assets"), { ...data, createdAt: nowTs() });
      setAssetModal(null);
      showToast(v.id ? "Matériel enregistré" : "Matériel ajouté");
    } catch (e) { fail(e); }
  };
  const deleteAsset = async a => { try { await deleteDoc(doc(db, "assets", a.id)); setAssetModal(null); showToast("Matériel supprimé"); } catch (e) { fail(e); } };

  // ── Réglages ──
  const saveCfg = async patch => { try { await setDoc(cfgRef, patch, { merge: true }); } catch (e) { fail(e); } };

  // ── Styles partagés ──
  const card = { background: T.bgCard, border: `1px solid ${T.borderLight}`, borderRadius: 14, boxShadow: T.shadow, padding: 16, minWidth: 0 };
  const h2 = { fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 16, color: T.text, margin: 0 };
  const btn = { background: T.bgCard, border: `1px solid ${T.border}`, color: T.text, borderRadius: 9, padding: "8px 14px", fontSize: 13, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" };
  const primary = { ...btn, background: T.accent, borderColor: T.accent, color: "#fff" };
  const danger = { ...btn, background: "transparent", borderColor: T.red, color: T.red };
  const inp = { width: "100%", fontSize: 14, border: `1px solid ${T.border}`, background: T.bgInput, color: T.text, borderRadius: 8, padding: "9px 10px", fontFamily: "inherit", boxSizing: "border-box" };
  const lbl = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12, fontWeight: 600, color: T.textSub, minWidth: 0 };
  const muted = { fontSize: 12, color: T.textFaint };
  const ctx = { T, card, h2, btn, primary, danger, inp, lbl, muted, isMobile };

  const TABS = [
    { id: "home", icon: "home", label: "Accueil" },
    { id: "stock", icon: "box", label: "Stock", badge: lowToOrder.length },
    { id: "scan", icon: "scan", label: "Scanner" },
    { id: "tickets", icon: "ticket", label: "Demandes", badge: (isAdmin ? newTickets.length : 0) + toApprove.length },
    { id: "assets", icon: "laptop", label: "Matériel" },
    { id: "planning", icon: "calendar", label: "Planning" },
    ...(isAdmin ? [{ id: "labels", icon: "tag", label: "Étiquettes" }, { id: "settings", icon: "settings", label: "Réglages" }] : []),
  ];
  // Mobile : 4 onglets principaux + « Plus »
  const MOBILE_MAIN = ["home", "stock", "scan", "tickets"];
  const mobileMore = TABS.filter(t => !MOBILE_MAIN.includes(t.id));
  const current = TABS.some(t => t.id === tab) ? tab : "home";
  const openTicket = tickets.find(t => t.id === openTicketId);

  const hdrBtn = { background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)", color: "#fff", borderRadius: 8, padding: "7px 10px", fontSize: 12.5, fontWeight: 500, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 7 };
  const badge = n => n > 0 && (
    <span style={{ position: "absolute", top: -5, right: -9, minWidth: 16, height: 16, borderRadius: 8, background: T.red, color: "#fff", fontSize: 10, fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center", padding: "0 4px" }}>{n}</span>
  );

  return (
    <div className={"etude-root" + (printLabels ? " lb-printing" : "")} style={{ minHeight: "100vh", background: T.bg, color: T.text, fontFamily: "'DM Sans',sans-serif", paddingBottom: isMobile ? "calc(78px + env(safe-area-inset-bottom, 0px))" : 40 }}>
      {/* En-tête */}
      <header className="no-print" style={{ position: "sticky", top: 0, zIndex: 20, background: T.sidebar, color: "#fff", padding: "calc(10px + env(safe-area-inset-top, 0px)) 16px 0" }}>
        <div style={{ maxWidth: 1280, margin: "0 auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", paddingBottom: isMobile ? 10 : 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14, flex: 1, minWidth: 0 }}>
            <BrandLogo variant="mono" height={isMobile ? 26 : 30} onDark />
            <span style={{ width: 1, height: 26, background: "rgba(255,255,255,.25)" }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: isMobile ? 11.5 : 12.5, letterSpacing: "0.28em", textTransform: "uppercase", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{brandName}</div>
              <div style={{ fontSize: 11.5, color: "rgba(255,255,255,.55)", letterSpacing: "0.04em" }}>Administration</div>
            </div>
          </div>
          {canLunch && <button onClick={() => onSwitch("lunch")} style={hdrBtn}><Icon name="utensils" size={16} />{!isMobile && lunchName}</button>}
          <button onClick={toggleTheme} aria-label="Changer de thème" style={hdrBtn}><Icon name={isDark ? "sun" : "moon"} size={16} /></button>
          {onAccount && <button onClick={onAccount} aria-label="Mon compte" title="Mon compte : code et email" style={hdrBtn}><Icon name="user" size={16} />{!isMobile && user}</button>}
          <button onClick={onLogout} aria-label="Déconnexion" title={`Déconnexion (${user})`} style={hdrBtn}><Icon name="logout" size={16} />{!isMobile && !onAccount && user}</button>
        </div>
        {!isMobile && (
          <nav style={{ maxWidth: 1280, margin: "0 auto", display: "flex", gap: 2, marginTop: 8, overflowX: "auto" }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ background: current === t.id ? T.bg : "transparent", color: current === t.id ? T.text : "rgba(255,255,255,.75)", border: "none", borderRadius: "10px 10px 0 0", padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap" }}>
                <Icon name={t.icon} size={17} />{t.label}
                {t.badge > 0 && <span style={{ minWidth: 18, height: 18, borderRadius: 9, background: T.red, color: "#fff", fontSize: 10.5, fontWeight: 700, display: "inline-flex", alignItems: "center", justifyContent: "center", padding: "0 5px" }}>{t.badge}</span>}
              </button>
            ))}
          </nav>
        )}
      </header>

      {/* Barre d'onglets mobile : Accueil, Stock, Scanner, Demandes, Plus */}
      {isMobile && (
        <nav className="no-print" style={{ position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 20, background: T.bgCard, borderTop: `1px solid ${T.border}`, display: "grid", gridTemplateColumns: "repeat(5,1fr)", paddingBottom: "env(safe-area-inset-bottom, 0px)" }}>
          {[...TABS.filter(t => MOBILE_MAIN.includes(t.id)), { id: "__more", icon: "more", label: "Plus" }].map(t => {
            const on = t.id === "__more" ? mobileMore.some(x => x.id === current) : current === t.id;
            const scan = t.id === "scan";
            return (
              <button key={t.id} onClick={() => { if (t.id === "__more") setMoreOpen(o => !o); else { setTab(t.id); setMoreOpen(false); } }}
                aria-label={t.label} style={{ background: "transparent", border: "none", padding: "8px 0 8px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, cursor: "pointer", color: on ? T.accent : T.textFaint }}>
                <span style={{ position: "relative", lineHeight: 1, ...(scan ? { background: T.text, color: T.bg, borderRadius: 12, padding: "5px 12px", marginTop: -2 } : {}) }}>
                  <Icon name={t.icon} size={scan ? 20 : 21} stroke={on || scan ? 1.9 : 1.5} />{badge(t.badge)}
                </span>
                <span style={{ fontSize: 10, fontWeight: on ? 700 : 500, color: scan && !on ? T.text : undefined }}>{t.label}</span>
              </button>
            );
          })}
        </nav>
      )}
      {isMobile && moreOpen && (
        <div className="no-print" onClick={() => setMoreOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 19, background: "rgba(0,0,0,.35)" }}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", right: 10, bottom: "calc(70px + env(safe-area-inset-bottom, 0px))", background: T.bgCard, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: T.shadowHover, padding: 6, minWidth: 200 }}>
            {mobileMore.map(t => (
              <button key={t.id} onClick={() => { setTab(t.id); setMoreOpen(false); }}
                style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", background: current === t.id ? T.bgHover : "transparent", border: "none", borderRadius: 10, padding: "11px 12px", fontSize: 14.5, color: T.text, cursor: "pointer", textAlign: "left" }}>
                <Icon name={t.icon} size={19} />{t.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <main style={{ maxWidth: 1280, margin: "0 auto", padding: current === "planning" ? 0 : "18px 16px 0", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Alerte stock, visible partout sauf dans Stock et Planning */}
        {toApprove.length > 0 && !["tickets", "planning"].includes(current) && (
          <button className="no-print" onClick={() => { setTicketFilter("toapprove"); setTab("tickets"); }}
            style={{ textAlign: "left", display: "flex", gap: 10, alignItems: "center", background: rgba("#b7791f", T.isDark ? .2 : .1), border: `1px solid ${rgba("#b7791f", .45)}`, color: T.text, borderRadius: 12, padding: "11px 14px", cursor: "pointer", fontSize: 13.5 }}>
            <Icon name="check" size={19} style={{ color: "#b7791f" }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong>{toApprove.length} demande{toApprove.length > 1 ? "s" : ""} à approuver</strong>
              <span style={{ color: T.textSub }}> · {toApprove.slice(0, 2).map(t => t.title).join(", ")}{toApprove.length > 2 ? "…" : ""}</span>
            </span>
            <span style={{ color: T.accent, fontWeight: 600, whiteSpace: "nowrap" }}>Voir →</span>
          </button>
        )}
        {lowToOrder.length > 0 && !["stock", "planning"].includes(current) && (
          <button className="no-print" onClick={() => { setStockFilter({ q: "", cat: "", low: true }); setTab("stock"); }}
            style={{ textAlign: "left", display: "flex", gap: 10, alignItems: "center", background: rgba("#e8590c", T.isDark ? .18 : .1), border: `1px solid ${rgba("#e8590c", .45)}`, color: T.text, borderRadius: 12, padding: "11px 14px", cursor: "pointer", fontSize: 13.5 }}>
            <Icon name="alert" size={19} style={{ color: T.orange }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <strong>{lowToOrder.length} article{lowToOrder.length > 1 ? "s" : ""} à commander</strong>
              <span style={{ color: T.textSub }}> · {lowToOrder.slice(0, 3).map(i => i.name).join(", ")}{lowToOrder.length > 3 ? "…" : ""}</span>
            </span>
            <span style={{ color: T.accent, fontWeight: 600, whiteSpace: "nowrap" }}>Voir →</span>
          </button>
        )}

        {current === "home" && (
          <Home {...ctx} isAdmin={isAdmin} noMail={!recipientsOf(cfg).length} user={user} low={low} openTickets={openTickets} myTickets={myTickets} assets={assets} myAssets={myAssets}
            warrantySoon={warrantySoon} tickets={tickets} go={setTab} onTicket={id => setOpenTicketId(id)} onNewTicket={() => setTicketModal({ category: cfg.ticketCategories[0] || "", priority: "normal" })}
            markOrdered={markOrdered} clearLow={clearLow} copyOrderList={copyOrderList} />
        )}

        {current === "stock" && (
          <Stock {...ctx} isAdmin={isAdmin} items={items} cfg={cfg} filter={stockFilter} setFilter={setStockFilter} changeQty={changeQty} flagLow={flagLow} clearLow={clearLow}
            onEdit={it => setItemModal({ ...it })} onNew={() => setItemModal({ unit: cfg.units[0] || "", category: cfg.stockCategories[0] || "", qty: 0, threshold: 2, trackMode: "count" })}
            markOrdered={markOrdered} copyOrderList={copyOrderList} lowCount={low.length} moves={moves} showMoves={showMoves} setShowMoves={setShowMoves} />
        )}

        {current === "tickets" && (
          <Tickets {...ctx} isAdmin={isAdmin} user={user} tickets={visibleTickets} toApprove={toApprove} filter={ticketFilter} setFilter={setTicketFilter}
            onOpen={id => setOpenTicketId(id)} onNew={() => setTicketModal({ category: cfg.ticketCategories[0] || "", priority: "normal" })} />
        )}

        {current === "assets" && (
          <Assets {...ctx} isAdmin={isAdmin} user={user} assets={isAdmin ? assets : myAssets} cfg={cfg} filter={assetFilter} setFilter={setAssetFilter}
            onEdit={a => setAssetModal({ ...a })} onNew={() => setAssetModal({ type: cfg.assetTypes[0] || "", status: "in_use" })}
            onReport={a => setTicketModal({ title: `Problème : ${a.type || "matériel"} ${a.tag || ""}`.trim(), category: cfg.ticketCategories.includes("Matériel") ? "Matériel" : (cfg.ticketCategories[0] || ""), priority: "normal", assetId: a.id })} />
        )}

        {current === "planning" && (
          <Planning db={db} T={T} user={user} isDark={isDark} toggleTheme={toggleTheme} onLogout={onLogout} isMobile={isMobile} embedded />
        )}

        {current === "scan" && (
          <ScanTab {...ctx} log={scanLog} confirm={confirmScan} onCode={handleCode} onUndo={undoScan} />
        )}

        {current === "labels" && isAdmin && (
          <LabelsTab {...ctx} items={items} onNew={() => setLabelModal({ mode: "new" })} onEdit={it => setLabelModal({ itemId: it.id })} onPrint={startPrint} />
        )}

        {current === "settings" && isAdmin && <Settings {...ctx} cfg={cfg} saveCfg={saveCfg} members={members} showToast={showToast} />}
      </main>

      {confirmScan && <ConfirmSheet key={confirmScan.id} {...ctx} isAdmin={isAdmin} confirm={confirmScan} onConfirm={confirmScanNow} onCancel={closeConfirm} onAssociate={code => setLabelModal({ mode: "existing", codes: [code] })} />}
      {labelModal && <LabelModal {...ctx} Sheet={Sheet} TrackModeField={TrackModeField} value={labelModal} items={items} cfg={cfg} onClose={() => setLabelModal(null)} onSave={saveLabel} onGenerateImage={generateImage} />}
      {printLabels && <LabelPrintSheet items={printLabels.ids.map(id => items.find(x => x.id === id)).filter(Boolean)} size={printLabels.size} copies={printLabels.copies} />}
      {itemModal && <ItemModal {...ctx} value={itemModal} cfg={cfg} onClose={() => setItemModal(null)} onSave={saveItem} onDelete={deleteItem} />}
      {ticketModal && <NewTicketModal {...ctx} value={ticketModal} cfg={cfg} assets={assets} onClose={() => setTicketModal(null)} onSave={createTicket} />}
      {openTicket && (
        <TicketDetail {...ctx} t={openTicket} isAdmin={isAdmin} user={user} onDecide={decideTicket} admins={members.filter(m => accessOf(m).etude === "admin").map(m => m.username)}
          asset={assets.find(a => a.id === openTicket.assetId)} onClose={() => setOpenTicketId(null)} onUpdate={updateTicket} onComment={addComment} onDelete={deleteTicket} />
      )}
      {assetModal && <AssetModal {...ctx} value={assetModal} cfg={cfg} memberNames={memberNames} onClose={() => setAssetModal(null)} onSave={saveAsset} onDelete={deleteAsset} />}

      {toast && (
        <div role="status" className="no-print" style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: isMobile ? "calc(86px + env(safe-area-inset-bottom, 0px))" : 24, zIndex: 80, maxWidth: "calc(100% - 32px)",
          background: toast.tone === "error" ? T.red : toast.tone === "warn" ? "#e8590c" : T.sidebar, color: "#fff", padding: "10px 16px", borderRadius: 10, fontSize: 13.5, fontWeight: 500, boxShadow: T.shadowHover }}>
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ── Petits composants ─────────────────────────────────────────────────────────
function Pill({ color, children, solid }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap", fontSize: 11.5, fontWeight: 700, borderRadius: 999, padding: "3px 9px",
      background: solid ? color : rgba(color, .14), color: solid ? "#fff" : color, border: solid ? "none" : `1px solid ${rgba(color, .35)}` }}>
      {!solid && <span style={{ width: 6, height: 6, borderRadius: 3, background: color }} />}{children}
    </span>
  );
}

function Sheet({ T, isMobile, title, onClose, children, footer, wide }) {
  useEffect(() => { const k = e => e.key === "Escape" && onClose(); window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={title} onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, zIndex: 60, background: "rgba(0,0,0,.45)", display: "flex", alignItems: isMobile ? "flex-end" : "center", justifyContent: "center", padding: isMobile ? 0 : 16 }}>
      <div style={{ background: T.bgCard, color: T.text, width: "100%", maxWidth: wide ? 640 : 480, maxHeight: isMobile ? "92vh" : "88vh", display: "flex", flexDirection: "column", borderRadius: isMobile ? "16px 16px 0 0" : 16, boxShadow: T.shadowHover }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "16px 18px 10px" }}>
          <div style={{ flex: 1, fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 18, minWidth: 0 }}>{title}</div>
          <button onClick={onClose} aria-label="Fermer" style={{ background: "transparent", border: "none", color: T.textFaint, fontSize: 18, cursor: "pointer", padding: 4 }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", padding: "4px 18px 14px", display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>
        {footer && <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end", padding: `12px 18px calc(14px + env(safe-area-inset-bottom, 0px))`, borderTop: `1px solid ${T.borderLight}` }}>{footer}</div>}
      </div>
    </div>
  );
}

function Confirm({ label, confirmLabel = "Confirmer la suppression", onConfirm, style, confirmStyle }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => { if (!armed) return; const t = setTimeout(() => setArmed(false), 4000); return () => clearTimeout(t); }, [armed]);
  return <button style={armed ? confirmStyle : style} onClick={() => armed ? onConfirm() : setArmed(true)}>{armed ? confirmLabel : label}</button>;
}

function Empty({ T, icon, title, text, action }) {
  return (
    <div style={{ border: `1px dashed ${T.border}`, borderRadius: 14, padding: "32px 16px", textAlign: "center", color: T.textSub }}>
      <div style={{ marginBottom: 8, color: T.textFaint }}><Icon name={icon} size={30} stroke={1.3} /></div>
      <div style={{ fontSize: 15, fontWeight: 700, color: T.text, marginBottom: 4 }}>{title}</div>
      <div style={{ fontSize: 13, marginBottom: action ? 14 : 0 }}>{text}</div>
      {action}
    </div>
  );
}

// ── Accueil ───────────────────────────────────────────────────────────────────
function Home({ T, card, h2, btn, primary, muted, isMobile, isAdmin, noMail, user, low, openTickets, myTickets, assets, myAssets, warrantySoon, tickets, go, onTicket, onNewTicket, markOrdered, clearLow, copyOrderList }) {
  const tiles = [
    { label: "À commander", value: low.filter(i => !i.orderedAt).length, sub: low.filter(i => i.orderedAt).length ? `${low.filter(i => i.orderedAt).length} déjà commandé(s)` : "sous le seuil", color: "#e8590c", to: "stock" },
    isAdmin
      ? { label: "Demandes ouvertes", value: openTickets.length, sub: `${openTickets.filter(t => t.status === "new").length} nouvelle(s)`, color: "#1c7ed6", to: "tickets" }
      : { label: "Mes demandes en cours", value: myTickets.filter(t => OPEN.includes(t.status)).length, sub: `${myTickets.length} au total`, color: "#1c7ed6", to: "tickets" },
    isAdmin
      ? { label: "Matériel en service", value: assets.filter(a => a.status === "in_use").length, sub: `${assets.length} équipement(s)`, color: "#2f9e44", to: "assets" }
      : { label: "Mon matériel", value: myAssets.length, sub: "attribué à moi", color: "#2f9e44", to: "assets" },
    ...(isAdmin ? [{ label: "Garanties ≤ 60 jours", value: warrantySoon.length, sub: "ou déjà expirées", color: "#7048e8", to: "assets" }] : []),
  ];
  const recent = (isAdmin ? tickets : myTickets).slice(0, 5);
  return (
    <>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
        <div>
          <h1 style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 24, margin: 0 }}>Bonjour {user}</h1>
          <div style={muted}>{new Date().toLocaleDateString("fr-BE", { weekday: "long", day: "numeric", month: "long" })}</div>
        </div>
        <button style={primary} onClick={onNewTicket}>+ Nouvelle demande</button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : `repeat(${tiles.length},1fr)`, gap: 10 }}>
        {tiles.map(t => (
          <button key={t.label} onClick={() => go(t.to)} style={{ ...card, padding: 14, textAlign: "left", cursor: "pointer", color: T.text }}>
            <div style={{ fontSize: 11, color: T.textSub, fontWeight: 600, letterSpacing: "0.1em", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 6 }}><span style={{ width: 7, height: 7, borderRadius: 4, background: t.color, flexShrink: 0 }} />{t.label}</div>
            <div style={{ fontFamily: "'Jost',sans-serif", fontSize: 30, fontWeight: 700, lineHeight: 1.15, color: t.value ? t.color : T.textFaint, fontVariantNumeric: "tabular-nums" }}>{t.value}</div>
            <div style={muted}>{t.sub}</div>
          </button>
        ))}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, alignItems: "start" }}>
        <section style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <h2 style={{ ...h2, flex: 1, display: "flex", alignItems: "center", gap: 8 }}><Icon name="box" />À commander</h2>
            {low.length > 0 && <button style={{ ...btn, padding: "6px 10px", fontSize: 12 }} onClick={copyOrderList}><Icon name="copy" size={14} /> Copier la liste</button>}
          </div>
          {isAdmin && noMail && <button onClick={() => go("settings")} style={{ ...btn, width: "100%", marginBottom: 10, fontWeight: 500, fontSize: 12.5, textAlign: "left", borderStyle: "dashed", color: T.textSub }}><Icon name="mail" size={15} /> Aucune adresse pour les alertes mail. Ajoute-en une dans Réglages →</button>}
          {low.length === 0 ? <div style={{ fontSize: 13, color: T.textSub }}>✓ Tout le stock est au-dessus des seuils.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {low.map(it => {
                const st = stockState(it);
                return (
                  <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 10, background: T.bgHover, flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: 120 }}>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{it.name}</div>
                      <div style={muted}>{isVisual(it) ? `Signalé${it.lowBy ? ` par ${it.lowBy}` : ""} le ${fmtDate(it.lowAt)}` : `${num(it.qty)} ${it.unit} · seuil ${num(it.threshold)}`}{it.supplier ? ` · ${it.supplier}` : ""}</div>
                    </div>
                    <Pill color={st.color}>{st.label}</Pill>
                    {isAdmin && (it.orderedAt
                      ? (isVisual(it) ? <button style={{ ...btn, padding: "5px 9px", fontSize: 11.5 }} onClick={() => clearLow(it)}>Réapprovisionné</button>
                        : <button style={{ ...btn, padding: "5px 9px", fontSize: 11.5 }} onClick={() => markOrdered(it, false)}>Annuler</button>)
                      : <button style={{ ...btn, padding: "5px 9px", fontSize: 11.5 }} onClick={() => markOrdered(it, true)}>Marquer commandé</button>)}
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section style={card}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <h2 style={{ ...h2, flex: 1, display: "flex", alignItems: "center", gap: 8 }}><Icon name="ticket" />{isAdmin ? "Dernières demandes" : "Mes demandes"}</h2>
            <button style={{ ...btn, padding: "6px 10px", fontSize: 12 }} onClick={() => go("tickets")}>Tout voir</button>
          </div>
          {recent.length === 0 ? <div style={{ fontSize: 13, color: T.textSub }}>Aucune demande pour l'instant.</div> : (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {recent.map(t => <TicketRow key={t.id} T={T} t={t} onOpen={onTicket} showRequester={isAdmin} />)}
            </div>
          )}
        </section>

        {isAdmin && warrantySoon.length > 0 && (
          <section style={card}>
            <h2 style={{ ...h2, marginBottom: 10, display: "flex", alignItems: "center", gap: 8 }}><Icon name="shield" />Garanties à surveiller</h2>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {warrantySoon.map(a => { const d = daysUntil(a.warrantyEnd); return (
                <div key={a.id} style={{ display: "flex", gap: 10, alignItems: "center", fontSize: 13.5 }}>
                  <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontWeight: 600 }}>{a.tag || "—"}</span>
                  <span style={{ flex: 1, color: T.textSub, minWidth: 0 }}>{[a.type, a.brand, a.model].filter(Boolean).join(" · ")}</span>
                  <Pill color={d < 0 ? "#c92a2a" : "#7048e8"}>{d < 0 ? "Expirée" : `${d} j`}</Pill>
                </div>
              ); })}
            </div>
          </section>
        )}
      </div>
    </>
  );
}

// ── Stock ─────────────────────────────────────────────────────────────────────
function Stock({ T, card, h2, btn, primary, inp, muted, isMobile, isAdmin, items, cfg, filter, setFilter, changeQty, flagLow, clearLow, onEdit, onNew, markOrdered, copyOrderList, lowCount, moves, showMoves, setShowMoves }) {
  const q = filter.q.trim().toLowerCase();
  const shown = items.filter(it =>
    (!filter.cat || it.category === filter.cat) &&
    (!filter.low || isLow(it)) &&
    (!q || [it.name, it.category, it.location, it.supplier].some(v => (v || "").toLowerCase().includes(q))));
  const cats = [...new Set([...cfg.stockCategories, ...items.map(i => i.category).filter(Boolean)])];
  const qtyBtn = { width: 36, height: 36, borderRadius: 10, border: `1px solid ${T.border}`, background: T.bgCard, color: T.text, fontSize: 18, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0 };
  return (
    <>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
        <input id="st-q" value={filter.q} onChange={e => setFilter({ ...filter, q: e.target.value })} placeholder="Rechercher un article…" style={{ ...inp, flex: "1 1 200px", width: "auto" }} />
        <select id="st-cat" value={filter.cat} onChange={e => setFilter({ ...filter, cat: e.target.value })} style={{ ...inp, width: "auto", flex: "0 1 180px" }} aria-label="Catégorie">
          <option value="">Toutes catégories</option>
          {cats.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button style={filter.low ? { ...btn, background: rgba("#e8590c", .14), borderColor: "#e8590c", color: "#e8590c" } : btn} onClick={() => setFilter({ ...filter, low: !filter.low })}>
          <Icon name="alert" size={15} /> Sous le seuil ({lowCount})
        </button>
        {lowCount > 0 && <button style={btn} onClick={copyOrderList}><Icon name="copy" size={15} /> Copier la liste</button>}
        {isAdmin && <button style={primary} onClick={onNew}>+ Article</button>}
      </div>

      {items.length === 0 ? (
        <Empty T={T} icon="box" title="Aucun article en stock" text={isAdmin ? "Ajoute les fournitures de l'étude avec leur seuil : une alerte apparaît dès que la quantité l'atteint." : "Un admin doit d'abord ajouter les articles."}
          action={isAdmin && <button style={primary} onClick={onNew}>+ Ajouter un article</button>} />
      ) : shown.length === 0 ? (
        <div style={{ ...muted, textAlign: "center", padding: 24, fontSize: 13 }}>Aucun article ne correspond à ces filtres.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(360px,1fr))", gap: 10 }}>
          {shown.map(it => {
            const st = stockState(it);
            const pct = Math.min(100, num(it.threshold) > 0 ? (num(it.qty) / (num(it.threshold) * 3)) * 100 : 100);
            return (
              <div key={it.id} style={{ ...card, padding: 12, display: "flex", flexDirection: "column", gap: 8, borderColor: st.label === "OK" ? T.borderLight : rgba(st.color, .45) }}>
                <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                  {it.image && <Thumb T={T} src={it.image} size={40} radius={8} />}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, display: "flex", alignItems: "center", gap: 6 }}>{it.name}{(it.codes || []).length > 0 && <span title="Article scannable" style={{ color: T.textFaint, display: "flex" }}><Icon name="scan" size={14} /></span>}</div>
                    <div style={muted}>{[it.category, it.location, it.supplier].filter(Boolean).join(" · ") || "—"}</div>
                  </div>
                  <Pill color={st.color}>{st.label}</Pill>
                  {isAdmin && <button onClick={() => onEdit(it)} aria-label="Modifier" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: T.textFaint, display: "flex" }}><Icon name="pencil" size={16} /></button>}
                </div>
                {isVisual(it) ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: T.textSub, background: T.bgTag, borderRadius: 999, padding: "3px 9px" }}><Icon name="alert" size={13} />Seuil visuel</span>
                    <span style={{ flex: 1, minWidth: 140, fontSize: 12.5, color: it.lowFlag ? T.text : T.textFaint }}>
                      {it.lowFlag ? <>Signalé le {fmtDateTime(it.lowAt)}{it.lowBy ? ` par ${it.lowBy}` : ""}</> : "Pas de comptage : signale quand il en reste peu."}
                    </span>
                    {!it.lowFlag && <button style={{ ...btn, padding: "6px 10px", fontSize: 12.5, borderColor: T.orange, color: T.orange }} onClick={() => flagLow(it)}>Signaler stock bas</button>}
                    {it.lowFlag && isAdmin && <button style={{ ...btn, padding: "6px 10px", fontSize: 12.5 }} onClick={() => clearLow(it)}><Icon name="check" size={13} /> Réapprovisionné</button>}
                  </div>
                ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button style={{ ...qtyBtn, opacity: num(it.qty) <= 0 ? .4 : 1 }} disabled={num(it.qty) <= 0} aria-label={`Retirer un ${it.unit || "article"}`} onClick={() => changeQty(it, -1, "Sortie")}>−</button>
                  <div style={{ minWidth: 70, textAlign: "center" }}>
                    <div style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 24, lineHeight: 1, fontVariantNumeric: "tabular-nums", color: st.label === "OK" ? T.text : st.color }}>{num(it.qty)}</div>
                    <div style={muted}>{it.unit || "unité"}</div>
                  </div>
                  {isAdmin && <button style={qtyBtn} aria-label="Ajouter un" onClick={() => changeQty(it, 1, "Entrée")}>+</button>}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ height: 6, borderRadius: 3, background: T.bgTag, overflow: "hidden" }}>
                      <div style={{ width: `${pct}%`, height: "100%", background: st.color, borderRadius: 3 }} />
                    </div>
                    <div style={{ ...muted, marginTop: 3 }}>Seuil d'alerte : {num(it.threshold)}</div>
                  </div>
                </div>
                )}
                {isAdmin && isLow(it) && (
                  <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
                    {it.orderedAt
                      ? <><span style={{ ...muted, flex: 1 }}>Commandé le {fmtDate(it.orderedAt)}{it.orderedBy ? ` par ${it.orderedBy}` : ""}</span><button style={{ ...btn, padding: "5px 9px", fontSize: 11.5 }} onClick={() => markOrdered(it, false)}>Annuler</button></>
                      : <button style={{ ...btn, padding: "5px 9px", fontSize: 11.5 }} onClick={() => markOrdered(it, true)}><Icon name="check" size={13} /> Marquer commandé</button>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && moves.length > 0 && (
        <section style={card}>
          <button onClick={() => setShowMoves(!showMoves)} style={{ ...h2, background: "transparent", border: "none", padding: 0, cursor: "pointer", display: "flex", width: "100%", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1, textAlign: "left", display: "flex", alignItems: "center", gap: 8 }}><Icon name="list" />Derniers mouvements</span><span style={{ fontSize: 13, color: T.textFaint }}>{showMoves ? "▴" : "▾"}</span>
          </button>
          {showMoves && (
            <div style={{ marginTop: 10, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, fontVariantNumeric: "tabular-nums" }}>
                <thead><tr style={{ color: T.textFaint, fontSize: 11.5, textAlign: "left" }}>
                  <th style={{ padding: "4px 6px" }}>Quand</th><th style={{ padding: "4px 6px" }}>Article</th><th style={{ padding: "4px 6px", textAlign: "right" }}>Mvt</th><th style={{ padding: "4px 6px", textAlign: "right" }}>Après</th><th style={{ padding: "4px 6px" }}>Motif</th><th style={{ padding: "4px 6px" }}>Par</th>
                </tr></thead>
                <tbody>{moves.map(m => (
                  <tr key={m.id} style={{ borderTop: `1px solid ${T.borderLight}` }}>
                    <td style={{ padding: "6px", whiteSpace: "nowrap", color: T.textSub }}>{fmtDateTime(m.ts)}</td>
                    <td style={{ padding: "6px" }}>{m.itemName}</td>
                    <td style={{ padding: "6px", textAlign: "right", fontWeight: 700, color: m.delta < 0 ? T.red : T.green }}>{m.delta > 0 ? "+" : ""}{m.delta}</td>
                    <td style={{ padding: "6px", textAlign: "right" }}>{m.qtyAfter}</td>
                    <td style={{ padding: "6px", color: T.textSub }}>{m.reason}</td>
                    <td style={{ padding: "6px", color: T.textSub }}>{m.by}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function ItemModal({ T, btn, primary, danger, inp, lbl, isMobile, value, cfg, onClose, onSave, onDelete }) {
  const [v, setV] = useState(value);
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  const ok = (v.name || "").trim().length > 0;
  const grid = { display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10 };
  return (
    <Sheet T={T} isMobile={isMobile} title={v.id ? "Modifier l'article" : "Nouvel article"} onClose={onClose}
      footer={<>
        {v.id && <Confirm label="Supprimer" onConfirm={() => onDelete(v)} style={danger} confirmStyle={{ ...danger, background: T.red, color: "#fff" }} />}
        <span style={{ flex: 1 }} />
        <button style={btn} onClick={onClose}>Annuler</button>
        <button style={{ ...primary, opacity: ok ? 1 : .5 }} disabled={!ok} onClick={() => onSave(v)}>Enregistrer</button>
      </>}>
      <label style={lbl}>Nom *<input id="it-name" style={inp} value={v.name || ""} onChange={e => set("name", e.target.value)} placeholder="Ex. Papier A4 80 g" autoFocus /></label>
      <TrackModeField T={T} btn={btn} lbl={lbl} value={v.trackMode} onChange={x => set("trackMode", x)} />
      {v.trackMode !== "visual" && (
        <>
          <div style={grid}>
            <label style={lbl}>Quantité en stock<input id="it-qty" type="number" inputMode="numeric" min="0" style={inp} value={v.qty ?? 0} onChange={e => set("qty", e.target.value)} /></label>
            <label style={lbl}>Seuil d'alerte<input id="it-thr" type="number" inputMode="numeric" min="0" style={inp} value={v.threshold ?? 0} onChange={e => set("threshold", e.target.value)} /></label>
          </div>
          <div style={{ fontSize: 12, color: T.textFaint, marginTop: -4 }}>L'alerte « à commander » s'affiche quand la quantité est égale ou inférieure au seuil.</div>
        </>
      )}
      <div style={grid}>
        <label style={lbl}>Catégorie<ChoiceInput id="it-cat" style={inp} value={v.category || ""} options={cfg.stockCategories} onChange={x => set("category", x)} placeholder="Nouvelle catégorie" /></label>
        <label style={lbl}>Unité<ChoiceInput id="it-unit" style={inp} value={v.unit || ""} options={cfg.units} onChange={x => set("unit", x)} placeholder="Nouvelle unité" /></label>
        <label style={lbl}>Emplacement<ChoiceInput id="it-loc" style={inp} value={v.location || ""} options={cfg.locations} onChange={x => set("location", x)} placeholder="Nouvel emplacement" /></label>
        <label style={lbl}>Fournisseur<input id="it-sup" style={inp} value={v.supplier || ""} onChange={e => set("supplier", e.target.value)} placeholder="Ex. Lyreco" /></label>
      </div>
      <label style={lbl}>Note<textarea id="it-note" rows={2} style={{ ...inp, resize: "vertical" }} value={v.note || ""} onChange={e => set("note", e.target.value)} placeholder="Référence, lien de commande…" /></label>
    </Sheet>
  );
}

// Choix du mode de suivi d'un article (aussi utilisé par Labels.jsx via la prop TrackModeField)
export function TrackModeField({ T, btn, lbl, value, onChange }) {
  const visual = value === "visual";
  const seg = on => ({ ...btn, padding: "7px 12px", fontSize: 13, background: on ? T.text : T.bgCard, borderColor: on ? T.text : T.border, color: on ? T.bg : T.text });
  return (
    <div style={{ ...lbl, gap: 6 }}>Suivi du stock
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
        <button type="button" style={seg(!visual)} onClick={() => onChange("count")}>Compter les unités</button>
        <button type="button" style={seg(visual)} onClick={() => onChange("visual")}>Seuil visuel</button>
      </div>
      <span style={{ fontSize: 12, fontWeight: 400, color: T.textFaint }}>
        {visual ? "Pas de comptage (ex. une pile de fardes). Quand le stock paraît bas, on scanne l'étiquette ou on touche « Signaler » : l'alerte et le mail partent tout seuls."
          : "Chaque scan retire des unités ; l'alerte part quand la quantité atteint le seuil."}
      </span>
    </div>
  );
}

// ── Demandes ──────────────────────────────────────────────────────────────────
function TicketRow({ T, t, onOpen, showRequester }) {
  const st = byId(TICKET_STATUSES, t.status), pr = byId(PRIORITIES, t.priority);
  return (
    <button onClick={() => onOpen(t.id)} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", background: T.bgHover, border: `1px solid ${T.borderLight}`, borderLeft: `4px solid ${pr.color}`, borderRadius: 10, padding: "9px 11px", cursor: "pointer", color: T.text, flexWrap: "wrap" }}>
      <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontSize: 12, color: T.textFaint, fontWeight: 600 }}>{ticketNo(t.number)}</span>
      <span style={{ flex: "1 1 160px", minWidth: 0 }}>
        <span style={{ display: "block", fontWeight: 600, fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.title}</span>
        <span style={{ fontSize: 11.5, color: T.textFaint }}>{[showRequester && t.requester, t.category, fmtDate(t.createdAt), (t.comments || []).filter(c => !c.system).length ? `💬 ${(t.comments || []).filter(c => !c.system).length}` : ""].filter(Boolean).join(" · ")}</span>
      </span>
      {(t.priority === "high" || t.priority === "urgent") && <Pill color={pr.color}>{pr.label}</Pill>}
      <Pill color={st.color} solid>{st.label}</Pill>
    </button>
  );
}

function Tickets({ T, btn, primary, muted, isAdmin, user, tickets, toApprove, filter, setFilter, onOpen, onNew }) {
  const filters = [
    ...(toApprove.length ? [{ id: "toapprove", label: "À approuver par moi", test: t => canApprove(t, user) }] : []),
    { id: "open", label: "Ouvertes", test: t => OPEN.includes(t.status) },
    ...TICKET_STATUSES.map(s => ({ id: s.id, label: s.label, test: t => t.status === s.id })),
    { id: "all", label: "Toutes", test: () => true },
  ];
  const f = filters.find(x => x.id === filter) || filters[0];
  const shown = tickets.filter(f.test);
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 22, margin: 0, flex: 1 }}>{isAdmin || toApprove.length ? "Demandes" : "Mes demandes"}</h1>
        <button style={primary} onClick={onNew}>+ Nouvelle demande</button>
      </div>
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
        {filters.map(x => {
          const n = tickets.filter(x.test).length, on = x.id === f.id;
          return <button key={x.id} onClick={() => setFilter(x.id)} style={{ ...btn, padding: "6px 11px", fontSize: 12.5, background: on ? T.accent : T.bgCard, borderColor: on ? T.accent : T.border, color: on ? "#fff" : T.text }}>{x.label} <span style={{ opacity: .7 }}>{n}</span></button>;
        })}
      </div>
      {tickets.length === 0 ? (
        <Empty T={T} icon="ticket" title="Aucune demande" text="Besoin de fournitures, d'un dépannage ou d'un nouvel équipement ? Crée une demande, elle sera suivie jusqu'à sa résolution."
          action={<button style={primary} onClick={onNew}>+ Nouvelle demande</button>} />
      ) : shown.length === 0 ? (
        <div style={{ ...muted, textAlign: "center", padding: 24, fontSize: 13 }}>Aucune demande dans ce statut.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {shown.map(t => <TicketRow key={t.id} T={T} t={t} onOpen={onOpen} showRequester={isAdmin || t.requester !== user} />)}
        </div>
      )}
    </>
  );
}

function NewTicketModal({ T, btn, primary, inp, lbl, isMobile, value, cfg, assets, onClose, onSave }) {
  const [v, setV] = useState(value);
  const [busy, setBusy] = useState(false);
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  const ok = (v.title || "").trim().length > 0 && !busy;
  const asset = assets.find(a => a.id === v.assetId);
  return (
    <Sheet T={T} isMobile={isMobile} title="Nouvelle demande" onClose={onClose}
      footer={<><button style={btn} onClick={onClose}>Annuler</button>
        <button style={{ ...primary, opacity: ok ? 1 : .5 }} disabled={!ok} onClick={async () => { setBusy(true); await onSave(v); setBusy(false); }}>{busy ? "Envoi…" : "Envoyer la demande"}</button></>}>
      <label style={lbl}>Objet *<input id="tk-title" style={inp} value={v.title || ""} onChange={e => set("title", e.target.value)} placeholder="Ex. Plus de toner dans l'imprimante de l'accueil" autoFocus /></label>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <label style={lbl}>Catégorie
          <select id="tk-cat" style={inp} value={v.category || ""} onChange={e => set("category", e.target.value)}>
            {!cfg.ticketCategories.includes(v.category) && <option value={v.category || ""}>{v.category || "—"}</option>}
            {cfg.ticketCategories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <label style={lbl}>Priorité
          <select id="tk-prio" style={inp} value={v.priority || "normal"} onChange={e => set("priority", e.target.value)}>
            {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
          </select>
        </label>
      </div>
      {asset && <div style={{ fontSize: 12.5, color: T.textSub }}>Matériel concerné : <strong>{asset.tag}</strong> {[asset.type, asset.brand, asset.model].filter(Boolean).join(" · ")}</div>}
      <label style={lbl}>Détails<textarea id="tk-desc" rows={4} style={{ ...inp, resize: "vertical" }} value={v.description || ""} onChange={e => set("description", e.target.value)} placeholder="Ce qu'il se passe, quantité souhaitée, urgence…" /></label>
    </Sheet>
  );
}

// Encadré d'approbation dans la fiche d'une demande
function ApprovalBox({ T, btn, inp, t, user, onDecide }) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const a = t.approval || {};
  const color = a.state === "approved" ? T.green : a.state === "rejected" ? T.red : "#b7791f";
  const decide = async ok => { setBusy(true); await onDecide(t, ok, note); setBusy(false); setNote(""); };
  return (
    <div style={{ border: `1px solid ${rgba(color, .5)}`, background: rgba(color, T.isDark ? .14 : .07), borderRadius: 12, padding: 12, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ fontWeight: 700, fontSize: 13.5, color, display: "flex", alignItems: "center", gap: 6 }}><Icon name="check" size={16} />
        {a.state === "approved" ? (a.auto ? "Approuvée automatiquement" : "Approuvée") : a.state === "rejected" ? "Refusée" : "En attente d'approbation"}
      </div>
      {a.state === "pending" && <div style={{ fontSize: 13, color: T.textSub }}>Approbateur{(a.approvers || []).length > 1 ? "s" : ""} : <strong style={{ color: T.text }}>{(a.approvers || []).join(", ") || "—"}</strong>. Un seul accord suffit.</div>}
      {a.state !== "pending" && !a.auto && (
        <div style={{ fontSize: 13, color: T.textSub }}>Par <strong style={{ color: T.text }}>{a.by}</strong> le {fmtDateTime(a.at)}{a.comment ? <> : « {a.comment} »</> : ""}</div>
      )}
      {canApprove(t, user) && (
        <>
          <textarea id="ap-note" rows={2} style={{ ...inp, resize: "vertical" }} value={note} onChange={e => setNote(e.target.value)} placeholder="Commentaire (obligatoire pour un refus)" />
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button disabled={busy} onClick={() => decide(true)} style={{ ...btn, background: T.green, borderColor: T.green, color: "#fff" }}>Approuver</button>
            <button disabled={busy || !note.trim()} onClick={() => decide(false)} title={note.trim() ? "" : "Indique le motif du refus"}
              style={{ ...btn, borderColor: T.red, color: T.red, opacity: note.trim() ? 1 : .5 }}>Refuser</button>
          </div>
        </>
      )}
    </div>
  );
}

function TicketDetail({ T, btn, danger, inp, lbl, muted, isMobile, t, isAdmin, user, admins, asset, onClose, onUpdate, onComment, onDelete, onDecide }) {
  const [txt, setTxt] = useState("");
  const st = byId(TICKET_STATUSES, t.status), pr = byId(PRIORITIES, t.priority);
  const canClose = !isAdmin && t.requester === user && OPEN.includes(t.status);
  return (
    <Sheet T={T} isMobile={isMobile} wide title={`${ticketNo(t.number)} · ${t.title}`} onClose={onClose}
      footer={<>
        {isAdmin && <Confirm label="Supprimer" onConfirm={() => onDelete(t)} style={danger} confirmStyle={{ ...danger, background: T.red, color: "#fff" }} />}
        {canClose && <button style={btn} onClick={() => onUpdate(t, { status: "closed" }, t.status === "approval" ? "Demande annulée par le demandeur" : "Demande fermée par le demandeur")}>{t.status === "approval" ? "Annuler ma demande" : "Fermer ma demande"}</button>}
        <span style={{ flex: 1 }} />
        <button style={btn} onClick={onClose}>Fermer</button>
      </>}>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
        <Pill color={st.color} solid>{st.label}</Pill><Pill color={pr.color}>Priorité {pr.label.toLowerCase()}</Pill>
        {t.category && <Pill color="#495057">{t.category}</Pill>}
      </div>
      <div style={muted}>Demandé par <strong style={{ color: T.text }}>{t.requester}</strong> le {fmtDateTime(t.createdAt)}{t.assignee ? <> · pris en charge par <strong style={{ color: T.text }}>{t.assignee}</strong></> : ""}</div>
      {asset && <div style={{ fontSize: 13, color: T.textSub, display: "flex", alignItems: "center", gap: 6 }}><Icon name="laptop" size={15} />{asset.tag} · {[asset.type, asset.brand, asset.model].filter(Boolean).join(" ")}</div>}
      {t.description && <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.5, background: T.bgHover, borderRadius: 10, padding: 12 }}>{t.description}</div>}

      {t.approval?.required && <ApprovalBox T={T} btn={btn} inp={inp} t={t} user={user} onDecide={onDecide} />}

      {isAdmin && (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10 }}>
          <label style={lbl}>Statut
            <select id="td-status" style={inp} value={t.status} disabled={t.status === "approval"} title={t.status === "approval" ? "En attente de la décision d'un approbateur" : undefined}
              onChange={e => onUpdate(t, { status: e.target.value }, `Statut : ${byId(TICKET_STATUSES, e.target.value).label}`)}>
              {TICKET_STATUSES.filter(s => !APPROVAL_ONLY.includes(s.id) || s.id === t.status).map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
            </select>
          </label>
          <label style={lbl}>Priorité
            <select id="td-prio" style={inp} value={t.priority} onChange={e => onUpdate(t, { priority: e.target.value }, `Priorité : ${byId(PRIORITIES, e.target.value).label}`)}>
              {PRIORITIES.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </label>
          <label style={lbl}>Pris en charge par
            <select id="td-assignee" style={inp} value={t.assignee || ""} onChange={e => onUpdate(t, { assignee: e.target.value, ...(t.status === "new" && e.target.value ? { status: "progress" } : {}) }, e.target.value ? `Pris en charge par ${e.target.value}` : "Plus personne n'est assigné")}>
              <option value="">Personne</option>
              {admins.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </label>
        </div>
      )}

      <div style={{ fontWeight: 700, fontSize: 13, marginTop: 4 }}>Suivi</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(t.comments || []).length === 0 && <div style={muted}>Aucun échange pour l'instant.</div>}
        {(t.comments || []).map((c, i) => c.system ? (
          <div key={i} style={{ fontSize: 12, color: T.textFaint, textAlign: "center" }}>— {c.text} · {c.author}, {fmtDateTime(c.ts)} —</div>
        ) : (
          <div key={i} style={{ alignSelf: c.author === user ? "flex-end" : "flex-start", maxWidth: "85%", background: c.author === user ? T.accentLight : T.bgHover, borderRadius: 12, padding: "8px 11px" }}>
            <div style={{ fontSize: 11, color: T.textFaint, marginBottom: 2 }}>{c.author} · {fmtDateTime(c.ts)}</div>
            <div style={{ fontSize: 14, whiteSpace: "pre-wrap" }}>{c.text}</div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8 }}>
        <input id="td-comment" style={{ ...inp, flex: 1 }} value={txt} onChange={e => setTxt(e.target.value)} placeholder="Ajouter un message…"
          onKeyDown={e => { if (e.key === "Enter" && txt.trim()) { onComment(t, txt); setTxt(""); } }} />
        <button style={btn} disabled={!txt.trim()} onClick={() => { onComment(t, txt); setTxt(""); }}>Envoyer</button>
      </div>
    </Sheet>
  );
}

// ── Matériel ──────────────────────────────────────────────────────────────────
function Assets({ T, card, btn, primary, inp, muted, isMobile, isAdmin, assets, cfg, filter, setFilter, onEdit, onNew, onReport }) {
  const q = filter.q.trim().toLowerCase();
  const shown = assets.filter(a =>
    (!filter.type || a.type === filter.type) && (!filter.status || a.status === filter.status) &&
    (!q || [a.tag, a.type, a.brand, a.model, a.serial, a.assignedTo, a.location].some(v => (v || "").toLowerCase().includes(q))));
  const types = [...new Set([...cfg.assetTypes, ...assets.map(a => a.type).filter(Boolean)])];
  return (
    <>
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <h1 style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 22, margin: 0, flex: 1 }}>{isAdmin ? "Parc matériel" : "Mon matériel"}</h1>
        {isAdmin && <button style={primary} onClick={onNew}>+ Matériel</button>}
      </div>
      {isAdmin && assets.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <input id="as-q" value={filter.q} onChange={e => setFilter({ ...filter, q: e.target.value })} placeholder="N°, modèle, série, personne…" style={{ ...inp, flex: "1 1 200px", width: "auto" }} />
          <select id="as-type" value={filter.type} onChange={e => setFilter({ ...filter, type: e.target.value })} style={{ ...inp, width: "auto" }} aria-label="Type">
            <option value="">Tous types</option>{types.map(x => <option key={x} value={x}>{x}</option>)}
          </select>
          <select id="as-status" value={filter.status} onChange={e => setFilter({ ...filter, status: e.target.value })} style={{ ...inp, width: "auto" }} aria-label="État">
            <option value="">Tous états</option>{ASSET_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>
      )}
      {assets.length === 0 ? (
        <Empty T={T} icon="laptop" title={isAdmin ? "Aucun matériel enregistré" : "Aucun matériel ne t'est attribué"}
          text={isAdmin ? "Enregistre les PC, écrans, imprimantes… avec leur n° de série, la personne qui les utilise et la fin de garantie." : "Si tu utilises du matériel de l'étude, demande à un admin de te l'attribuer."}
          action={isAdmin && <button style={primary} onClick={onNew}>+ Ajouter du matériel</button>} />
      ) : shown.length === 0 ? (
        <div style={{ ...muted, textAlign: "center", padding: 24, fontSize: 13 }}>Aucun matériel ne correspond à ces filtres.</div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(340px,1fr))", gap: 10 }}>
          {shown.map(a => {
            const st = byId(ASSET_STATUSES, a.status), d = daysUntil(a.warrantyEnd);
            return (
              <div key={a.id} style={{ ...card, padding: 12, display: "flex", flexDirection: "column", gap: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontFamily: "ui-monospace,Menlo,monospace", fontWeight: 700, fontSize: 14 }}>{a.tag || "Sans n°"}</span>
                  <span style={{ flex: 1, fontSize: 12.5, color: T.textSub, minWidth: 0 }}>{a.type}</span>
                  <Pill color={st.color}>{st.label}</Pill>
                  {isAdmin && <button onClick={() => onEdit(a)} aria-label="Modifier" style={{ background: "transparent", border: "none", cursor: "pointer", padding: 4, color: T.textFaint, display: "flex" }}><Icon name="pencil" size={16} /></button>}
                </div>
                <div style={{ fontWeight: 600, fontSize: 14.5 }}>{[a.brand, a.model].filter(Boolean).join(" ") || "—"}</div>
                <div style={{ ...muted, display: "flex", flexWrap: "wrap", gap: "2px 12px" }}>
                  {a.assignedTo && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="user" size={13} />{a.assignedTo}</span>}
                  {a.location && <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Icon name="pin" size={13} />{a.location}</span>}
                  {a.serial && <span style={{ fontFamily: "ui-monospace,Menlo,monospace" }}>S/N {a.serial}</span>}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  {a.warrantyEnd
                    ? <span style={{ fontSize: 12, color: d < 0 ? T.red : d <= 60 ? "#7048e8" : T.textFaint, fontWeight: d <= 60 ? 600 : 400, display: "inline-flex", alignItems: "center", gap: 5 }}><Icon name="shield" size={13} />Garantie {d < 0 ? `expirée le ${fmtDate(a.warrantyEnd + "T00:00:00")}` : `jusqu'au ${fmtDate(a.warrantyEnd + "T00:00:00")}`}</span>
                    : <span style={muted}>Garantie non renseignée</span>}
                  <span style={{ flex: 1 }} />
                  <button style={{ ...btn, padding: "5px 9px", fontSize: 11.5 }} onClick={() => onReport(a)}>Signaler un problème</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function AssetModal({ T, btn, primary, danger, inp, lbl, isMobile, value, cfg, memberNames, onClose, onSave, onDelete }) {
  const [v, setV] = useState(value);
  const set = (k, x) => setV(o => ({ ...o, [k]: x }));
  const ok = (v.tag || "").trim() || (v.model || "").trim();
  const grid = { display: "grid", gridTemplateColumns: isMobile ? "1fr 1fr" : "1fr 1fr 1fr", gap: 10 };
  return (
    <Sheet T={T} isMobile={isMobile} wide title={v.id ? "Modifier le matériel" : "Nouveau matériel"} onClose={onClose}
      footer={<>
        {v.id && <Confirm label="Supprimer" onConfirm={() => onDelete(v)} style={danger} confirmStyle={{ ...danger, background: T.red, color: "#fff" }} />}
        <span style={{ flex: 1 }} />
        <button style={btn} onClick={onClose}>Annuler</button>
        <button style={{ ...primary, opacity: ok ? 1 : .5 }} disabled={!ok} onClick={() => onSave(v)}>Enregistrer</button>
      </>}>
      <div style={grid}>
        <label style={lbl}>N° d'inventaire<input id="as-tag" style={inp} value={v.tag || ""} onChange={e => set("tag", e.target.value)} placeholder="Ex. PC-012" autoFocus /></label>
        <label style={lbl}>Type<ChoiceInput id="as-type-in" style={inp} value={v.type || ""} options={cfg.assetTypes} onChange={x => set("type", x)} placeholder="Nouveau type" /></label>
        <label style={lbl}>État
          <select id="as-status-in" style={inp} value={v.status || "in_use"} onChange={e => set("status", e.target.value)}>
            {ASSET_STATUSES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </label>
        <label style={lbl}>Marque<input id="as-brand" style={inp} value={v.brand || ""} onChange={e => set("brand", e.target.value)} /></label>
        <label style={lbl}>Modèle<input id="as-model" style={inp} value={v.model || ""} onChange={e => set("model", e.target.value)} /></label>
        <label style={lbl}>N° de série<input id="as-serial" style={inp} value={v.serial || ""} onChange={e => set("serial", e.target.value)} /></label>
        <label style={lbl}>Attribué à
          <select id="as-assign" style={inp} value={v.assignedTo || ""} onChange={e => set("assignedTo", e.target.value)}>
            <option value="">Personne</option>
            {!memberNames.includes(v.assignedTo) && v.assignedTo && <option value={v.assignedTo}>{v.assignedTo}</option>}
            {memberNames.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
        <label style={lbl}>Emplacement<ChoiceInput id="as-loc" style={inp} value={v.location || ""} options={cfg.locations} onChange={x => set("location", x)} placeholder="Nouvel emplacement" /></label>
        <span />
        <label style={lbl}>Date d'achat<input id="as-buy" type="date" style={inp} value={v.purchaseDate || ""} onChange={e => set("purchaseDate", e.target.value)} /></label>
        <label style={lbl}>Fin de garantie<input id="as-war" type="date" style={inp} value={v.warrantyEnd || ""} onChange={e => set("warrantyEnd", e.target.value)} /></label>
      </div>
      <label style={lbl}>Note<textarea id="as-note" rows={2} style={{ ...inp, resize: "vertical" }} value={v.note || ""} onChange={e => set("note", e.target.value)} placeholder="Licence, accessoires, historique…" /></label>
    </Sheet>
  );
}

// ── Réglages ──────────────────────────────────────────────────────────────────
function Settings({ T, card, h2, btn, inp, lbl, muted, isMobile, cfg, saveCfg, members, showToast }) {
  const [drafts, setDrafts] = useState({});
  const [name, setName] = useState(cfg.brandName || "");
  const [subtitle, setSubtitle] = useState(cfg.brandSubtitle || "");
  const add = key => { const v = (drafts[key] || "").trim(); if (!v || cfg[key].includes(v)) return; saveCfg({ [key]: [...cfg[key], v] }); setDrafts(d => ({ ...d, [key]: "" })); };
  const remove = (key, v) => saveCfg({ [key]: cfg[key].filter(x => x !== v) });
  const roleOf = m => accessOf(m).etude;
  return (
    <>
      <h1 style={{ fontFamily: "'Jost',sans-serif", fontWeight: 500, fontSize: 22, margin: 0 }}>Réglages de l'espace</h1>
      <section style={card}>
        <h2 style={{ ...h2, marginBottom: 4 }}>Identité de l'application</h2>
        <p style={{ ...muted, margin: "0 0 12px" }}>Affichée sur l'écran de connexion, dans les en-têtes et dans l'onglet du navigateur.</p>
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 10, marginBottom: 10 }}>
          <label style={lbl}>Nom<input id="cfg-brand" style={inp} value={name} onChange={e => setName(e.target.value)} placeholder="Gestion Étude" /></label>
          <label style={lbl}>Sous-titre (facultatif)<input id="cfg-brand-sub" style={inp} value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="Ex. Étude du notaire…" /></label>
        </div>
        <button style={btn} disabled={name.trim() === (cfg.brandName || "") && subtitle.trim() === (cfg.brandSubtitle || "")}
          onClick={() => saveCfg({ brandName: name.trim(), brandSubtitle: subtitle.trim() })}>Enregistrer</button>
      </section>
      <ApprovalSettings T={T} card={card} h2={h2} btn={btn} inp={inp} muted={muted} isMobile={isMobile} cfg={cfg} saveCfg={saveCfg} members={members} />
      <AlertSettings T={T} card={card} h2={h2} btn={btn} inp={inp} muted={muted} isMobile={isMobile} cfg={cfg} saveCfg={saveCfg} showToast={showToast} />
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "1fr 1fr", gap: 14, alignItems: "start" }}>
        {LIST_FIELDS.map(f => (
          <section key={f.key} style={card}>
            <h2 style={{ ...h2, marginBottom: 10 }}>{f.label}</h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {cfg[f.key].length === 0 && <span style={muted}>Aucune valeur.</span>}
              {cfg[f.key].map(v => (
                <span key={v} style={{ display: "inline-flex", alignItems: "center", gap: 4, background: T.bgTag, borderRadius: 999, padding: "4px 6px 4px 11px", fontSize: 13 }}>
                  {v}<button onClick={() => remove(f.key, v)} aria-label={`Retirer ${v}`} style={{ background: "transparent", border: "none", color: T.textFaint, cursor: "pointer", fontSize: 12, padding: "0 4px" }}>✕</button>
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input id={`cfg-${f.key}`} style={{ ...inp, flex: 1 }} value={drafts[f.key] || ""} onChange={e => setDrafts(d => ({ ...d, [f.key]: e.target.value }))} onKeyDown={e => e.key === "Enter" && add(f.key)} placeholder={f.hint} />
              <button style={btn} onClick={() => add(f.key)}>Ajouter</button>
            </div>
          </section>
        ))}
        <section style={card}>
          <h2 style={{ ...h2, marginBottom: 6 }}>Accès à l'espace</h2>
          <p style={{ ...muted, margin: "0 0 10px" }}>Les droits se règlent dans Lunch → Config → Membres.</p>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {members.filter(m => roleOf(m) !== "none").map(m => (
              <div key={m.username} style={{ display: "flex", justifyContent: "space-between", fontSize: 13.5 }}>
                <span>{m.username}</span><span style={{ color: T.textSub }}>{roleOf(m) === "admin" ? "Admin" : "Utilisateur"}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}
