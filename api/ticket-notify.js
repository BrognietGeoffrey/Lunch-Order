// Notifications par mail liées aux demandes (tickets)
// POST { ticketId, event }
//   event "approval" (défaut) : nouvelle demande « À approuver » → mail aux approbateurs désignés (une seule fois)
//   event "decision"          : demande approuvée ou refusée → mail au demandeur (adresse vérifiée de son compte)
// Le serveur relit la demande et n'envoie que si son état correspond à l'événement.
// Adresse d'un approbateur : celle saisie dans Réglages → Approbation, sinon l'adresse vérifiée de son compte.
import { getDb } from "./_lib/db.js";
import { sendMail, layout, esc, mailReady } from "./_lib/mail.js";
import { memberEmail } from "./_lib/members.js";
import { approvalCfg } from "../src/approval.js";

const PRIORITY = { low: "Basse", normal: "Normale", high: "Haute", urgent: "Urgente" };
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ticketNo = n => "DEM-" + String(n || 0).padStart(4, "0");

const accountEmail = async (db, username) => db.admin ? memberEmail(db.admin.db, username) : "";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  if (!mailReady()) return res.status(500).json({ error: "RESEND_API_KEY n'est pas configurée dans Vercel." });
  const ticketId = String(req.body?.ticketId || "");
  const event = req.body?.event === "decision" ? "decision" : "approval";
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(ticketId)) return res.status(400).json({ error: "Demande invalide" });
  try {
    const db = await getDb();
    const t = await db.get(`tickets/${ticketId}`);
    if (!t) return res.status(404).json({ error: "Demande introuvable" });
    const cfg = (await db.get("config/etude")) || {};
    const brand = cfg.brandName || "Gestion Étude";
    const no = ticketNo(t.number);

    if (event === "decision") {
      const st = t.approval?.state;
      if (!["approved", "rejected"].includes(st) || t.approval?.auto) return res.status(200).json({ skipped: "pas de décision à annoncer" });
      if (t.approval?.decisionNotifiedAt) return res.status(200).json({ skipped: "déjà notifié" });
      const to = await accountEmail(db, t.requester);
      if (!to) return res.status(200).json({ skipped: "le demandeur n'a pas d'adresse vérifiée" });
      const ok = st === "approved";
      const comment = t.approval.comment ? `<p style="margin:10px 0 0;padding:10px 12px;background:#f6f6f4;border-radius:8px">« ${esc(t.approval.comment)} »</p>` : "";
      await sendMail(to, `${brand} · ${no} ${ok ? "approuvée" : "refusée"} : ${t.title}`,
        layout(`Ta demande a été ${ok ? "approuvée" : "refusée"}`, `${esc(no)} · <strong>${esc(t.title)}</strong><br>Décision de ${esc(t.approval.by)}.${ok ? " Elle va maintenant être traitée." : ""}`, comment,
          "Tu reçois ce mail car ton adresse est liée à ton compte Gestion Étude (Mon compte)."),
        `Ta demande ${no} « ${t.title} » a été ${ok ? "approuvée" : "refusée"} par ${t.approval.by}.${t.approval.comment ? `\n« ${t.approval.comment} »` : ""}`);
      await db.update(`tickets/${ticketId}`, { "approval.decisionNotifiedAt": Date.now() });
      return res.status(200).json({ sent: 1 });
    }

    if (t.status !== "approval" || t.approval?.state !== "pending") return res.status(200).json({ skipped: "pas en attente d'approbation" });
    if (t.approval?.notifiedAt) return res.status(200).json({ skipped: "déjà notifié" });
    const conf = approvalCfg(cfg).approvers;
    const to = [];
    for (const u of t.approval.approvers || []) {
      const set = conf.find(a => a.username === u)?.email || "";
      const e = EMAIL_RE.test(set) ? set : await accountEmail(db, u);
      if (e && !to.includes(e)) to.push(e);
    }
    if (!to.length) return res.status(200).json({ skipped: "aucun approbateur avec une adresse" });
    const rows = [["Demandeur", t.requester], ["Catégorie", t.category], ["Priorité", PRIORITY[t.priority] || t.priority]]
      .filter(([, v]) => v).map(([k, v]) => `<tr><td style="padding:4px 12px 4px 0;color:#6b6b6b">${k}</td><td style="padding:4px 0"><strong>${esc(v)}</strong></td></tr>`).join("");
    const body = `<table style="border-collapse:collapse;font-size:14px">${rows}</table>${t.description ? `<div style="margin-top:12px;padding:12px;background:#f6f6f4;border-radius:8px;white-space:pre-wrap;font-size:14px">${esc(t.description)}</div>` : ""}`;
    const html = layout(`Demande à approuver · ${no}`, `<span style="font-size:16px">${esc(t.title)}</span>`, body,
      `Tu reçois ce mail car tu es approbateur dans ${esc(brand)}. Approuve ou refuse la demande dans l'app (Administration → Demandes).`);
    const text = `Demande à approuver ${no} : ${t.title}\nDemandeur : ${t.requester}${t.category ? `\nCatégorie : ${t.category}` : ""}\n\n${t.description || ""}`;
    for (const e of to) await sendMail(e, `${brand} · ${no} à approuver : ${t.title}`, html, text);
    await db.update(`tickets/${ticketId}`, { "approval.notifiedAt": Date.now() });
    return res.status(200).json({ sent: to.length });
  } catch (e) {
    console.error("ticket-notify", e);
    return res.status(500).json({ error: e.message || "Erreur inconnue" });
  }
}
