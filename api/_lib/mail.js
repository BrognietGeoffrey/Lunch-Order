/* global process */
// Envoi de mails via Resend (RESEND_API_KEY, ALERT_FROM, APP_URL)
const env = process.env;

export const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
export const mailReady = () => !!env.RESEND_API_KEY;

export async function sendMail(to, subject, html, text) {
  if (!env.RESEND_API_KEY) throw new Error("RESEND_API_KEY n'est pas configurée dans Vercel.");
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: env.ALERT_FROM || "Gestion Étude <onboarding@resend.dev>", to: Array.isArray(to) ? to : [to], subject, html, text }),
  });
  if (!r.ok) throw new Error(`Envoi refusé par Resend (${r.status}) : ${await r.text()}`);
}
// Un mail par destinataire : les adresses des autres n'apparaissent pas
export async function sendEach(list, subject, html, text) { for (const e of list) await sendMail([e], subject, html, text); }

export function layout(title, intro, body = "", footer = "") {
  const link = env.APP_URL ? `<p style="margin:20px 0 0"><a href="${esc(env.APP_URL)}" style="background:#24345f;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Ouvrir Gestion Étude</a></p>` : "";
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#121214;max-width:640px">
    <h2 style="margin:0 0 6px">${esc(title)}</h2><p style="margin:0 0 16px;color:#3a3a3a">${intro}</p>${body}${link}
    ${footer ? `<p style="margin:24px 0 0;color:#6b6b6b;font-size:12px">${footer}</p>` : ""}</div>`;
}
