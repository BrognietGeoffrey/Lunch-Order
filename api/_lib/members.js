/* global Buffer */
// Accès serveur aux membres et à leurs secrets (Firebase Admin)
//   config/members.list[]          : liste publique (noms, droits, indicateurs secured / hasEmail / emailHint) — plus aucun code en clair
//   member_secrets/{sha256(nom)}   : { username, hash, mustChange, email, emailVerified, emailPending, reset, fails, lockUntil }
//                                    illisible depuis l'app (règles Firestore), lu et écrit uniquement par le serveur
import { createHash, randomBytes, scrypt as scryptCb, timingSafeEqual, randomInt } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb);
const N = 16384, R = 8, P = 1, KEYLEN = 64;

export const idOf = username => createHash("sha256").update(String(username)).digest("hex");
export const uidOf = username => "m_" + idOf(username).slice(0, 40);
export const secretRef = (db, username) => db.collection("member_secrets").doc(idOf(username));
export const membersRef = db => db.collection("config").doc("members");

export async function hashSecret(secret) {
  const salt = randomBytes(16);
  const key = await scrypt(String(secret), salt, KEYLEN, { N, r: R, p: P });
  return `scrypt$${N}$${R}$${P}$${salt.toString("base64")}$${key.toString("base64")}`;
}
export async function verifySecret(secret, stored) {
  const [algo, n, r, p, saltB64, keyB64] = String(stored || "").split("$");
  if (algo !== "scrypt") return false;
  const key = Buffer.from(keyB64, "base64");
  const got = await scrypt(String(secret), Buffer.from(saltB64, "base64"), key.length, { N: Number(n), r: Number(r), p: Number(p) });
  return got.length === key.length && timingSafeEqual(got, key);
}

// Codes à 6 chiffres envoyés par mail (liaison d'email, code oublié)
export const newMailCode = () => String(randomInt(0, 1000000)).padStart(6, "0");
export const hashMailCode = (code, salt) => createHash("sha256").update(`${salt}:${code}`).digest("hex");

export const maskEmail = e => {
  const [u, d] = String(e).split("@");
  return u && d ? `${u[0]}${"•".repeat(Math.max(2, Math.min(5, u.length - 1)))}@${d}` : "";
};

export async function loadMembers(db) {
  const s = await membersRef(db).get();
  return s.exists && Array.isArray(s.data().list) ? s.data().list : [];
}
export const findMember = (list, name) => list.find(m => String(m.username).toLowerCase() === String(name).trim().toLowerCase());

// Met à jour l'entrée publique d'un membre (indicateurs, suppression du code en clair)
export async function patchMember(db, username, fn) {
  await db.runTransaction(async tx => {
    const ref = membersRef(db);
    const s = await tx.get(ref);
    const list = s.exists && Array.isArray(s.data().list) ? s.data().list : [];
    tx.set(ref, { list: list.map(m => m.username === username ? fn({ ...m }) : m) }, { merge: true });
  });
}

// Adresse vérifiée d'un membre (pour ses notifications personnelles), ou ""
export async function memberEmail(db, username) {
  const s = await secretRef(db, username).get();
  return s.exists && s.data().emailVerified && s.data().email ? s.data().email : "";
}
export async function usernameByEmail(db, email) {
  const q = await db.collection("member_secrets").where("email", "==", String(email).trim().toLowerCase()).where("emailVerified", "==", true).limit(1).get();
  return q.empty ? "" : q.docs[0].data().username;
}

// Migration unique : chaque code encore en clair dans config/members devient une empreinte chiffrée
// (changement obligatoire à la prochaine connexion) et disparaît de la liste publique.
export async function migrateLegacyCodes(db) {
  const list = await loadMembers(db);
  const legacy = list.filter(m => m.code != null && String(m.code) !== "");
  if (!legacy.length) return 0;
  for (const m of legacy) {
    const ref = secretRef(db, m.username);
    const s = await ref.get();
    if (!s.exists || !s.data().hash) await ref.set({ username: m.username, hash: await hashSecret(String(m.code)), mustChange: true, updatedAt: Date.now() }, { merge: true });
  }
  await db.runTransaction(async tx => {
    const ref = membersRef(db);
    const snap = await tx.get(ref);
    const cur = snap.exists && Array.isArray(snap.data().list) ? snap.data().list : [];
    tx.set(ref, { list: cur.map(m => { if (m.code == null) return m; const c = { ...m }; delete c.code; c.secured = c.secured === true ? true : "temp"; return c; }) }, { merge: true });
  });
  return legacy.length;
}
