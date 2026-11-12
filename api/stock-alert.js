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

import { recipientsOf, localNow, dueForDigest } from "../src/alertRules.js";
import { getDb } from "./_lib/db.js";
import { sendMail } from "./_lib/mail.js";

const env = process.env;

const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
// Même règle que src/stockRules.js : « seuil visuel » = article signalé (lowFlag), sinon quantité ≤ seuil
const isVisual = it => it?.trackMode === "visual";
const isLow = it => isVisual(it) ? !!it.lowFlag : num(it.qty) <= num(it.threshold);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

// Un mail par destinataire : les adresses des autres n'apparaissent pas
async function sendEach(list, subject, html, text) { for (const e of list) await sendMail([e], subject, html, text); }

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
    <p style="margin:24px 0 0;color:#6b6b6b;font-size:12px">Alerte automatique envoyée par Gestion Étude. Destinataires, jours et heures : Administration → Réglages → Alertes par mail.</p></div>`;
}

export default async function handler(req, res) {
  if (!env.RESEND_API_KEY) return res.status(500).json({ error: "RESEND_API_KEY n'est pas configurée dans Vercel." });
  try {
    const db = await getDb();
    const cfg = (await db.get("config/etude")) || {};
    const recipients = recipientsOf(cfg);
    const space = cfg.brandName || "Gestion Étude";

    // ── Récapitulatif planifié ──
    // Appelé par Vercel Cron (1×/jour) et/ou un déclencheur horaire externe : chaque passage envoie le récap
    // aux destinataires dont le jour et l'heure choisis sont atteints et qui ne l'ont pas encore reçu aujourd'hui.
    if (req.method === "GET") {
      if (!env.CRON_SECRET || req.headers.authorization !== `Bearer ${env.CRON_SECRET}`) return res.status(401).json({ error: "Non autorisé" });
      const now = localNow();
      const sentLog = cfg.digestSent || {};
      const due = recipients.filter(r => dueForDigest(r, now, sentLog[r.email]));
      await db.merge("config/etude", { digestLastRun: Date.now() });
      if (!due.length) return res.status(200).json({ skipped: "personne à cette heure", now });
      const low = (await db.list("stock_items")).filter(isLow);
      if (low.length) {
        low.sort((a, b) => (a.orderedAt ? 1 : 0) - (b.orderedAt ? 1 : 0) || (a.name || "").localeCompare(b.name || "", "fr"));
        const todo = low.filter(i => !i.orderedAt).length;
        const subject = `${space} · ${todo ? `${todo} article${todo > 1 ? "s" : ""} à commander` : "articles en attente de livraison"}`;
        const html = layout("Récapitulatif du stock", `${low.length} article${low.length > 1 ? "s sont" : " est"} au niveau du seuil d'alerte ou en dessous.`, itemsTable(low));
        const text = `Récapitulatif du stock (${space})\n\n${textList(low)}`;
        for (const r of due) await sendMail([r.email], subject, html, text); // un mail par personne : les adresses ne se voient pas
      }
      // noté comme traité pour aujourd'hui, même s'il n'y avait rien à commander
      await db.merge("config/etude", { digestSent: Object.fromEntries(due.map(r => [r.email, now.date])) });
      return res.status(200).json({ sent: low.length ? due.length : 0, checked: due.map(r => r.email), now });
    }

    if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
    const { type, itemId, email } = req.body || {};

    // ── Mail de test ──
    if (type === "test") {
      const targets = email ? recipients.filter(r => r.email === String(email).trim().toLowerCase()) : recipients;
      if (!targets.length) return res.status(400).json({ error: email ? "Cette adresse n'est pas dans la liste des destinataires. Enregistre-la d'abord." : "Ajoute au moins une adresse mail valide." });
      for (const r of targets) await sendMail([r.email], `${space} · mail de test`, layout("Les alertes mail fonctionnent", "Tu recevras un mail ici selon les réglages choisis dans Administration → Réglages → Alertes par mail.", ""), "Les alertes mail de Gestion Étude fonctionnent.");
      return res.status(200).json({ sent: targets.length });
    }

    // ── Alerte immédiate pour un article ──
    if (type === "item" && typeof itemId === "string") {
      const to = recipients.filter(r => r.instant).map(r => r.email);
      if (!to.length) return res.status(200).json({ skipped: "aucun destinataire pour le mail immédiat" });
      if (!/^[A-Za-z0-9_-]{1,64}$/.test(itemId)) return res.status(400).json({ error: "Requête invalide" });
      const data = await db.get(`stock_items/${itemId}`);
      if (!data) return res.status(404).json({ error: "Article introuvable" });
      const it = { id: itemId, ...data };
      if (!isLow(it)) return res.status(200).json({ skipped: "au-dessus du seuil" });
      if (it.alertSentAt) return res.status(200).json({ skipped: "déjà signalé" });
      const sup = it.supplier ? " Fournisseur : " + it.supplier : "";
      if (isVisual(it)) {
        const who = it.lowBy ? ` par ${it.lowBy}` : "";
        await sendEach(to, `${space} · Stock bas : ${it.name}`,
          layout(`Stock bas : ${it.name}`, `Signalé à vue${esc(who)} : il en reste peu. Pense à commander.`, itemsTable([it])),
          `${it.name} : stock bas, signalé à vue${who}.${sup}`);
      } else {
        const out = num(it.qty) <= 0;
        await sendEach(to, `${space} · ${out ? "Rupture" : "Stock bas"} : ${it.name}`,
          layout(`${out ? "Rupture de stock" : "Stock bas"} : ${it.name}`, `Il reste <strong>${num(it.qty)} ${esc(it.unit || "")}</strong> pour un seuil d'alerte de ${num(it.threshold)}. Pense à commander.`, itemsTable([it])),
          `${it.name} : ${num(it.qty)} ${it.unit || ""} restant(s), seuil ${num(it.threshold)}.${sup}`);
      }
      await db.update(`stock_items/${itemId}`, { alertSentAt: Date.now() });
      return res.status(200).json({ sent: to.length });
    }

    return res.status(400).json({ error: "Requête invalide" });
  } catch (e) {
    console.error("stock-alert", e);
    return res.status(500).json({ error: e.message || "Erreur inconnue" });
  }
}
