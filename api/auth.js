// Authentification des membres (Gestion Étude)
// POST { action, ... } — voir la liste des actions plus bas.
// Les codes sont vérifiés ici (jamais dans le navigateur) et stockés chiffrés (scrypt) dans member_secrets.
// Une connexion réussie renvoie un jeton Firebase signé (custom token) portant le nom du membre : les règles Firestore
// n'ouvrent la base qu'aux membres connectés.
import { getAdmin } from "./_lib/admin.js";
import { sendMail, layout, esc, mailReady } from "./_lib/mail.js";
import {
  idOf, uidOf, secretRef, hashSecret, verifySecret, newMailCode, hashMailCode, maskEmail,
  loadMembers, findMember, patchMember, usernameByEmail, migrateLegacyCodes,
} from "./_lib/members.js";
import { checkSecret } from "../src/secretPolicy.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_FAILS = 5, LOCK_MS = 15 * 60000, CODE_TTL = 15 * 60000, RESEND_GAP = 45000;
const BAD_LOGIN = "Identifiant ou code incorrect.";

class HttpError extends Error { constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; } }
const fail = (status, message, extra) => { throw new HttpError(status, message, extra); };

async function issueToken(admin, member, rec) {
  const token = await admin.auth.createCustomToken(uidOf(member.username), { member: member.username, admin: !!member.isAdmin });
  return {
    token, username: member.username,
    mustChange: !rec || !rec.hash || !!rec.mustChange,
    email: rec?.emailVerified ? rec.email : "",
  };
}

// Membre connecté (jeton Firebase envoyé par l'app dans Authorization: Bearer …)
async function caller(admin, req) {
  const m = /^Bearer (.+)$/.exec(req.headers.authorization || "");
  if (!m) fail(401, "Session expirée. Reconnecte-toi.");
  let decoded;
  try { decoded = await admin.auth.verifyIdToken(m[1]); } catch { fail(401, "Session expirée. Reconnecte-toi."); }
  if (!decoded.member) fail(401, "Session expirée. Reconnecte-toi.");
  const list = await loadMembers(admin.db);
  const member = list.find(x => x.username === decoded.member);
  if (!member) fail(403, "Ce compte n'existe plus.");
  return { member, list };
}

async function resolveMember(db, list, id) {
  const raw = String(id || "").trim();
  if (!raw) return null;
  if (raw.includes("@")) { const u = await usernameByEmail(db, raw); return u ? findMember(list, u) : null; }
  return findMember(list, raw) || null;
}

async function saveSecret(admin, username, secret, { mustChange = false } = {}) {
  await secretRef(admin.db, username).set({
    username, hash: await hashSecret(secret), mustChange, updatedAt: Date.now(), fails: 0, lockUntil: 0, reset: null,
  }, { merge: true });
  await patchMember(admin.db, username, m => { delete m.code; m.secured = mustChange ? "temp" : true; return m; });
}

const ACTIONS = {
  // ── Connexion par nom ou email ──
  async login(admin, req, b) {
    await migrateLegacyCodes(admin.db); // une seule fois en pratique : ne fait rien s'il ne reste aucun code en clair
    const list = await loadMembers(admin.db);
    const member = await resolveMember(admin.db, list, b.id);
    const secret = String(b.secret || "");
    if (!member || !secret) fail(401, BAD_LOGIN);
    const ref = secretRef(admin.db, member.username);
    const snap = await ref.get();
    const rec = snap.exists ? snap.data() : null;
    if (rec?.lockUntil > Date.now()) fail(429, `Trop d'essais. Réessaie dans ${Math.ceil((rec.lockUntil - Date.now()) / 60000)} min.`);
    // Ancien code en clair (avant la mise en place) : accepté une dernière fois, puis changement obligatoire
    const ok = rec?.hash ? await verifySecret(secret, rec.hash) : (member.code != null && String(member.code) === secret);
    if (!ok) {
      const fails = (rec?.fails || 0) + 1;
      await ref.set({ username: member.username, fails: fails >= MAX_FAILS ? 0 : fails, lockUntil: fails >= MAX_FAILS ? Date.now() + LOCK_MS : 0 }, { merge: true });
      fail(401, fails >= MAX_FAILS ? "Trop d'essais. Compte bloqué 15 minutes." : BAD_LOGIN);
    }
    if (rec && (rec.fails || rec.lockUntil)) await ref.set({ fails: 0, lockUntil: 0 }, { merge: true });
    return issueToken(admin, member, rec);
  },

  // ── Choisir / changer son code ──
  async setSecret(admin, req, b) {
    const { member } = await caller(admin, req);
    const snap = await secretRef(admin.db, member.username).get();
    const rec = snap.exists ? snap.data() : null;
    const forced = !rec?.hash || rec.mustChange;
    if (!forced) {
      const okCurrent = await verifySecret(String(b.current || ""), rec.hash);
      if (!okCurrent) fail(400, "Le code actuel est incorrect.");
    }
    const err = checkSecret(b.secret, member.username);
    if (err) fail(400, err);
    if (rec?.hash && await verifySecret(String(b.secret), rec.hash)) fail(400, "Choisis un code différent de l'ancien.");
    if (!rec?.hash && member.code != null && String(member.code) === String(b.secret)) fail(400, "Choisis un code différent de l'ancien.");
    await saveSecret(admin, member.username, b.secret);
    return { ok: true };
  },

  // ── Lier son email de travail : envoi d'un code ──
  async emailStart(admin, req, b) {
    const { member } = await caller(admin, req);
    const email = String(b.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) fail(400, "Adresse mail invalide.");
    if (!mailReady()) fail(503, "L'envoi de mails n'est pas configuré (RESEND_API_KEY).");
    const other = await usernameByEmail(admin.db, email);
    if (other && other !== member.username) fail(409, "Cette adresse est déjà liée à un autre compte.");
    const ref = secretRef(admin.db, member.username);
    const rec = (await ref.get()).data() || {};
    if (rec.emailPending?.sentAt && Date.now() - rec.emailPending.sentAt < RESEND_GAP) fail(429, "Un code vient d'être envoyé. Attends quelques secondes avant de redemander.");
    const code = newMailCode(), salt = idOf(member.username);
    await ref.set({ username: member.username, emailPending: { email, codeHash: hashMailCode(code, salt), expires: Date.now() + CODE_TTL, tries: 0, sentAt: Date.now() } }, { merge: true });
    await sendMail(email, `Ton code de vérification : ${code}`,
      layout("Vérification de ton adresse", `Bonjour ${esc(member.username)}, voici ton code pour lier cette adresse à ton compte :`,
        `<div style="font-size:30px;font-weight:700;letter-spacing:.3em;margin:6px 0 4px">${code}</div><p style="color:#6b6b6b;margin:0">Il est valable 15 minutes.</p>`,
        "Si tu n'as rien demandé, ignore ce mail."),
      `Ton code de vérification : ${code} (valable 15 minutes).`);
    return { ok: true, email };
  },

  // ── Lier son email : validation du code ──
  async emailVerify(admin, req, b) {
    const { member } = await caller(admin, req);
    const ref = secretRef(admin.db, member.username);
    const rec = (await ref.get()).data() || {};
    const p = rec.emailPending;
    if (!p || p.expires < Date.now()) fail(400, "Code expiré. Demande un nouveau code.");
    if (p.tries >= 5) fail(429, "Trop d'essais. Demande un nouveau code.");
    if (hashMailCode(String(b.code || "").trim(), idOf(member.username)) !== p.codeHash) {
      await ref.set({ emailPending: { ...p, tries: p.tries + 1 } }, { merge: true });
      fail(400, "Code incorrect.");
    }
    const other = await usernameByEmail(admin.db, p.email);
    if (other && other !== member.username) fail(409, "Cette adresse est déjà liée à un autre compte.");
    await ref.set({ email: p.email, emailVerified: true, emailPending: null }, { merge: true });
    await patchMember(admin.db, member.username, m => { m.hasEmail = true; m.emailHint = maskEmail(p.email); return m; });
    return { ok: true, email: p.email };
  },

  async emailRemove(admin, req) {
    const { member } = await caller(admin, req);
    await secretRef(admin.db, member.username).set({ email: "", emailVerified: false, emailPending: null }, { merge: true });
    await patchMember(admin.db, member.username, m => { delete m.hasEmail; delete m.emailHint; return m; });
    return { ok: true };
  },

  async me(admin, req) {
    const { member } = await caller(admin, req);
    const rec = (await secretRef(admin.db, member.username).get()).data() || {};
    return { username: member.username, email: rec.emailVerified ? rec.email : "", mustChange: !rec.hash || !!rec.mustChange };
  },

  // ── Code oublié : envoi d'un code au mail vérifié (réponse identique dans tous les cas) ──
  async forgot(admin, req, b) {
    const generic = { ok: true, message: "Si un email vérifié est lié à ce compte, un code vient d'y être envoyé. Sinon, demande à un administrateur de réinitialiser ton code." };
    const list = await loadMembers(admin.db);
    const member = await resolveMember(admin.db, list, b.id);
    if (!member || !mailReady()) return generic;
    const ref = secretRef(admin.db, member.username);
    const rec = (await ref.get()).data() || {};
    if (!rec.emailVerified || !rec.email) return generic;
    if (rec.reset?.sentAt && Date.now() - rec.reset.sentAt < RESEND_GAP) return generic;
    const code = newMailCode();
    await ref.set({ reset: { codeHash: hashMailCode(code, idOf(member.username)), expires: Date.now() + CODE_TTL, tries: 0, sentAt: Date.now() } }, { merge: true });
    await sendMail(rec.email, `Code pour réinitialiser ton accès : ${code}`,
      layout("Code oublié", `Bonjour ${esc(member.username)}, voici ton code pour choisir un nouveau mot de passe ou code PIN :`,
        `<div style="font-size:30px;font-weight:700;letter-spacing:.3em;margin:6px 0 4px">${code}</div><p style="color:#6b6b6b;margin:0">Il est valable 15 minutes.</p>`,
        "Si tu n'as rien demandé, ignore ce mail : ton code actuel reste valable."),
      `Code pour réinitialiser ton accès : ${code} (valable 15 minutes).`);
    return generic;
  },

  // ── Code oublié : nouveau code + connexion ──
  async reset(admin, req, b) {
    const list = await loadMembers(admin.db);
    const member = await resolveMember(admin.db, list, b.id);
    if (!member) fail(400, "Code incorrect ou expiré.");
    const ref = secretRef(admin.db, member.username);
    const rec = (await ref.get()).data() || {};
    const r = rec.reset;
    if (!r || r.expires < Date.now()) fail(400, "Code incorrect ou expiré.");
    if (r.tries >= 5) fail(429, "Trop d'essais. Demande un nouveau code.");
    if (hashMailCode(String(b.code || "").trim(), idOf(member.username)) !== r.codeHash) {
      await ref.set({ reset: { ...r, tries: r.tries + 1 } }, { merge: true });
      fail(400, "Code incorrect ou expiré.");
    }
    const err = checkSecret(b.secret, member.username);
    if (err) fail(400, err);
    await saveSecret(admin, member.username, b.secret);
    const fresh = (await ref.get()).data();
    return issueToken(admin, member, fresh);
  },

  // ── Administration (admins Lunch uniquement) ──
  async adminTemp(admin, req, b) {
    const { member, list } = await caller(admin, req);
    if (!member.isAdmin) fail(403, "Réservé aux administrateurs.");
    const target = list.find(x => x.username === b.target);
    if (!target) fail(404, "Membre introuvable.");
    const temp = String(b.temp || "");
    if (temp.length < 6) fail(400, "Le code temporaire doit faire au moins 6 caractères.");
    await saveSecret(admin, target.username, temp, { mustChange: true });
    return { ok: true };
  },
  async adminRename(admin, req, b) {
    const { member } = await caller(admin, req);
    if (!member.isAdmin) fail(403, "Réservé aux administrateurs.");
    const from = String(b.from || ""), to = String(b.to || "").trim();
    if (!from || !to) fail(400, "Nom manquant.");
    const oldRef = secretRef(admin.db, from), s = await oldRef.get();
    if (s.exists) { await secretRef(admin.db, to).set({ ...s.data(), username: to }); await oldRef.delete(); }
    return { ok: true };
  },
  async adminDelete(admin, req, b) {
    const { member } = await caller(admin, req);
    if (!member.isAdmin) fail(403, "Réservé aux administrateurs.");
    await secretRef(admin.db, String(b.target || "")).delete();
    return { ok: true };
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  const admin = getAdmin();
  // Tant que la clé de service n'est pas configurée, l'app garde l'ancienne connexion
  if (!admin) return res.status(503).json({ code: "NO_ADMIN", error: "La connexion sécurisée n'est pas encore configurée (FIREBASE_SERVICE_ACCOUNT)." });
  const b = req.body || {};
  const fn = ACTIONS[b.action];
  if (!fn) return res.status(400).json({ error: "Action inconnue" });
  try {
    return res.status(200).json(await fn(admin, req, b));
  } catch (e) {
    if (e instanceof HttpError) return res.status(e.status).json({ error: e.message, ...(e.extra || {}) });
    console.error("auth", b.action, e);
    return res.status(500).json({ error: "Erreur du serveur. Réessaie dans un instant." });
  }
}
