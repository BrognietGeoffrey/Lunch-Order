/* global process */
// Prévient par mail les approbateurs d'une nouvelle demande « À approuver »
// POST { ticketId } — appelé par l'app juste après la création de la demande.
// Le serveur relit la demande et la config : il n'envoie que si la demande attend vraiment une approbation,
// seulement aux approbateurs désignés qui ont une adresse, et une seule fois (approval.notifiedAt).
// Variables Vercel : RESEND_API_KEY, ALERT_FROM, APP_URL (comme les alertes stock)

import { initializeApp, getApps } from "firebase/app";
import { getFirestore, doc, getDoc, updateDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";
import { approvalCfg } from "../src/approval.js";

const env = process.env;
const PRIORITY = { low: "Basse", normal: "Normale", high: "Haute", urgent: "Urgente" };
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const ticketNo = n => "DEM-" + String(n || 0).padStart(4, "0");

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

async function sendMail(to, subject, html, text) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.ALERT_FROM || "Étude <onboarding@resend.dev>", to: [to], subject, html, text }),
  });
  if (!r.ok) throw new Error(`Envoi refusé par Resend (${r.status}) : ${await r.text()}`);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (!env.RESEND_API_KEY) return res.status(500).json({ error: "RESEND_API_KEY n'est pas configurée dans Vercel." });
  const ticketId = String(req.body?.ticketId || "");
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(ticketId)) return res.status(400).json({ error: "Demande invalide" });
  try {
    const db = await firebase();
    const ref = doc(db, "tickets", ticketId);
    const s = await getDoc(ref);
    if (!s.exists()) return res.status(404).json({ error: "Demande introuvable" });
    const t = s.data();
    if (t.status !== "approval" || t.approval?.state !== "pending") return res.status(200).json({ skipped: "pas en attente d'approbation" });
    if (t.approval?.notifiedAt) return res.status(200).json({ skipped: "déjà notifié" });

    const cfgSnap = await getDoc(doc(db, "config", "etude"));
    const cfg = cfgSnap.exists() ? cfgSnap.data() : {};
    const wanted = new Set(t.approval.approvers || []);
    const to = approvalCfg(cfg).approvers.filter(a => wanted.has(a.username) && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(a.email)).map(a => a.email);
    if (!to.length) return res.status(200).json({ skipped: "aucun approbateur avec une adresse" });

    const brand = cfg.brandName || "Gestion Étude";
    const no = ticketNo(t.number);
    const rows = [["Demandeur", t.requester], ["Catégorie", t.category], ["Priorité", PRIORITY[t.priority] || t.priority]]
      .filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b6b6b">${k}</td><td style="padding:4px 0"><strong>${esc(v)}</strong></td></tr>`).join("");
    const link = env.APP_URL ? `<p style="margin:20px 0 0"><a href="${esc(env.APP_URL)}" style="background:#24345f;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Ouvrir les demandes</a></p>` : "";
    const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#121214;max-width:640px">
      <h2 style="margin:0 0 6px">Demande à approuver · ${esc(no)}</h2>
      <p style="margin:0 0 14px;font-size:16px">${esc(t.title)}</p>
      <table style="border-collapse:collapse;font-size:14px">${rows}</table>
      ${t.description ? `<div style="margin-top:12px;padding:12px;background:#f6f6f4;border-radius:8px;white-space:pre-wrap;font-size:14px">${esc(t.description)}</div>` : ""}
      ${link}
      <p style="margin:24px 0 0;color:#6b6b6b;font-size:12px">Tu reçois ce mail car tu es approbateur dans ${esc(brand)} (Administration → Réglages → Approbation des demandes). Approuve ou refuse la demande dans l'app.</p></div>`;
    const text = `Demande à approuver ${no} : ${t.title}\nDemandeur : ${t.requester}${t.category ? `\nCatégorie : ${t.category}` : ""}\n\n${t.description || ""}${env.APP_URL ? `\n\n${env.APP_URL}` : ""}`;
    for (const e of to) await sendMail(e, `${brand} · ${no} à approuver : ${t.title}`, html, text);
    await updateDoc(ref, { "approval.notifiedAt": Date.now() });
    return res.status(200).json({ sent: to.length });
  } catch (e) {
    console.error("ticket-notify", e);
    return res.status(500).json({ error: e.message || "Erreur inconnue" });
  }
}
