/* global process */
// Alertes stock par mail (espace Étude)
//
// POST { type: "item", itemId }  → mail immédiat si l'article est sous son seuil (une seule fois, jusqu'au réassort)
// POST { type: "test" }          → mail de test aux destinataires configurés
// GET  (Vercel Cron, voir vercel.json) → récapitulatif du matin s'il reste des articles sous le seuil
//
// Réglages lus dans Firestore config/etude : alertEmails[], alertInstant (bool), alertDigest (bool), title
// Variables d'environnement Vercel :
//   RESEND_API_KEY  (obligatoire)  clé https://resend.com
//   ALERT_FROM      (optionnel)    expéditeur, ex. "Étude <stock@mondomaine.be>" ; par défaut l'adresse de test Resend
//   CRON_SECRET     (obligatoire pour le récap) Vercel l'envoie automatiquement aux tâches planifiées
//   APP_URL         (optionnel)    lien vers l'app dans le mail
//   VITE_FIREBASE_* (déjà présentes)

import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, getDocs, collection, updateDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const env = process.env;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function firebase() {
  const app = getApps()[0] || initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  if (!auth.currentUser) await signInAnonymously(auth);
  return getFirestore(app);
}

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// Même règle que src/stockRules.js : « seuil visuel » = article signalé (lowFlag), sinon quantité ≤ seuil
const isVisual = it => it?.trackMode === "visual";
const isLow = it => isVisual(it) ? !!it.lowFlag : num(it.qty) <= num(it.threshold);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function sendMail(to, subject, html, text) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.ALERT_FROM || "Étude <onboarding@resend.dev>", to, subject, html, text }),
  });
  if (!r.ok) throw new Error(`Envoi refusé par Resend (${r.status}) : ${await r.text()}`);
}

function itemsTable(items) {
  const rows = items.map(it => `
    <tr>
      <td style="padding:8px 10px;border-top:1px solid #e4e6ea"><strong>${esc(it.name)}</strong>${it.category ? `<br><span style="color:#6b6b6b;font-size:12px">${esc(it.category)}</span>` : ""}</td>
      <td style="padding:8px 10px;border-top:1px solid #e4e6ea;text-align:right;color:${!isVisual(it) && num(it.qty) <= 0 ? "#c92a2a" : "#e8590c"};font-weight:700">${isVisual(it) ? "bas" : `${num(it.qty)} ${esc(it.unit || "")}`}</td>
      <td style="padding:8px 10px;border-top:1px solid #e4e6ea;text-align:right;color:#6b6b6b">${isVisual(it) ? "visuel" : num(it.threshold)}</td>
      <td style="padding:8px 10px;border-top:1px solid #e4e6ea;color:#3a3a3a">${esc(it.supplier || "—")}</td>
      <td style="padding:8px 10px;border-top:1px solid #e4e6ea;color:${it.orderedAt ? "#1c7ed6" : "#e8590c"};font-size:12px;font-weight:600">${it.orderedAt ? "Commandé" : "À commander"}</td>
    </tr>`).join("");
  return `<table style="border-collapse:collapse;width:100%;font-size:14px">
    <tr style="color:#6b6b6b;font-size:12px;text-align:left"><th style="padding:6px 10px">Article</th><th style="padding:6px 10px;text-align:right">En stock</th><th style="padding:6px 10px;text-align:right">Seuil</th><th style="padding:6px 10px">Fournisseur</th><th style="padding:6px 10px">État</th></tr>
    ${rows}</table>`;
}
const textList = items => items.map(it => `- ${it.name} : ${isVisual(it) ? `stock bas (signalé${it.lowBy ? " par " + it.lowBy : ""})` : `${num(it.qty)} ${it.unit || ""} (seuil ${num(it.threshold)})`}${it.supplier ? " · " + it.supplier : ""}${it.orderedAt ? " · déjà commandé" : ""}`).join("\n");

function layout(title, intro, body) {
  const link = env.APP_URL ? `<p style="margin:20px 0 0"><a href="${esc(env.APP_URL)}" style="background:#3b5bdb;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Ouvrir l'espace Étude</a></p>` : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#0a0a0a;max-width:640px">
    <h2 style="margin:0 0 6px">${esc(title)}</h2><p style="margin:0 0 16px;color:#3a3a3a">${intro}</p>${body}${link}
    <p style="margin:24px 0 0;color:#6b6b6b;font-size:12px">Alerte automatique envoyée par l'espace Étude. Destinataires et options : Étude → Réglages → Alertes par mail.</p></div>`;
}

export default async function handler(req, res) {
  if (!env.RESEND_API_KEY) return res.status(500).json({ error: "RESEND_API_KEY n'est pas configurée dans Vercel." });
  try {
    const db = await firebase();
    const cfgSnap = await getDoc(doc(db, "config", "etude"));
    const cfg = cfgSnap.exists() ? cfgSnap.data() : {};
    const to = (cfg.alertEmails || []).filter(e => EMAIL_RE.test(e));
    const space = cfg.title || "Étude";

    // ── Récapitulatif planifié (Vercel Cron) ──
    if (req.method === "GET") {
      if (!env.CRON_SECRET || req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) return res.status(401).json({ error: "Non autorisé" });
      if (cfg.alertDigest === false) return res.status(200).json({ skipped: "récap désactivé" });
      if (!to.length) return res.status(200).json({ skipped: "aucun destinataire" });
      const snap = await getDocs(collection(db, "stock_items"));
      const low = []; snap.forEach(d => { const it = { id: d.id, ...d.data() }; if (isLow(it)) low.push(it); });
      if (!low.length) return res.status(200).json({ skipped: "rien à commander" });
      low.sort((a, b) => (a.orderedAt ? 1 : 0) - (b.orderedAt ? 1 : 0) || (a.name || "").localeCompare(b.name || "", "fr"));
      const todo = low.filter(i => !i.orderedAt).length;
      const subject = `${space} · ${todo ? `${todo} article${todo > 1 ? "s" : ""} à commander` : "articles en attente de livraison"}`;
      await sendMail(to, subject,
        layout("Récapitulatif du stock", `${low.length} article${low.length > 1 ? "s sont" : " est"} au niveau du seuil d'alerte ou en dessous.`, itemsTable(low)),
        `Récapitulatif du stock (${space})\n\n${textList(low)}`);
      return res.status(200).json({ sent: low.length });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
    const { type, itemId } = req.body || {};

    // ── Mail de test ──
    if (type === "test") {
      if (!to.length) return res.status(400).json({ error: "Ajoute au moins une adresse mail valide." });
      await sendMail(to, `${space} · mail de test`, layout("Les alertes mail fonctionnent", "Tu recevras un mail ici quand un article du stock atteint son seuil d'alerte.", ""), "Les alertes mail de l'espace Étude fonctionnent.");
      return res.status(200).json({ sent: to.length });
    }

    // ── Alerte immédiate pour un article ──
    if (type === "item" && typeof itemId === "string") {
      if (cfg.alertInstant === false) return res.status(200).json({ skipped: "alerte immédiate désactivée" });
      if (!to.length) return res.status(200).json({ skipped: "aucun destinataire" });
      const ref = doc(db, "stock_items", itemId);
      const s = await getDoc(ref);
      if (!s.exists()) return res.status(404).json({ error: "Article introuvable" });
      const it = { id: s.id, ...s.data() };
      if (!isLow(it)) return res.status(200).json({ skipped: "au-dessus du seuil" });
      if (it.alertSentAt) return res.status(200).json({ skipped: "déjà signalé" });
      const sup = it.supplier ? " Fournisseur : " + it.supplier : "";
      if (isVisual(it)) {
        const who = it.lowBy ? ` par ${it.lowBy}` : "";
        await sendMail(to, `${space} · Stock bas : ${it.name}`,
          layout(`Stock bas : ${it.name}`, `Signalé à vue${esc(who)} : il en reste peu. Pense à commander.`, itemsTable([it])),
          `${it.name} : stock bas, signalé à vue${who}.${sup}`);
      } else {
        const out = num(it.qty) <= 0;
        await sendMail(to, `${space} · ${out ? "Rupture" : "Stock bas"} : ${it.name}`,
          layout(`${out ? "Rupture de stock" : "Stock bas"} : ${it.name}`, `Il reste <strong>${num(it.qty)} ${esc(it.unit || "")}</strong> pour un seuil d'alerte de ${num(it.threshold)}. Pense à commander.`, itemsTable([it])),
          `${it.name} : ${num(it.qty)} ${it.unit || ""} restant(s), seuil ${num(it.threshold)}.${sup}`);
      }
      await updateDoc(ref, { alertSentAt: Date.now() });
      return res.status(200).json({ sent: to.length });
    }

    return res.status(400).json({ error: "Requête invalide" });
  } catch (e) {
    console.error("stock-alert", e);
    return res.status(500).json({ error: e.message || "Erreur inconnue" });
  }
}
