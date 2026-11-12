/* global process, Buffer */
// Firebase Admin (côté serveur uniquement) : lit et écrit la base sans passer par les règles Firestore.
// Variable Vercel FIREBASE_SERVICE_ACCOUNT = contenu du fichier JSON de la clé de service
// (Firebase → Paramètres du projet → Comptes de service → Générer une nouvelle clé privée), tel quel ou encodé en base64.
// Les fichiers de api/_lib ne sont pas des routes (préfixe « _ »).
import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";

let cached = null;
function readServiceAccount() {
  const raw = (process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
  if (!raw) return null;
  try { return JSON.parse(raw.startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8")); }
  catch { throw new Error("FIREBASE_SERVICE_ACCOUNT n'est pas un JSON valide. Colle le contenu complet du fichier de clé."); }
}

// null si la clé de service n'est pas encore configurée
export function getAdmin() {
  if (cached) return cached;
  const sa = readServiceAccount();
  if (!sa) return null;
  const app = getApps()[0] || initializeApp({ credential: cert(sa) });
  cached = { db: getFirestore(app), auth: getAuth(app), FieldValue };
  return cached;
}

export const adminConfigured = () => !!(process.env.FIREBASE_SERVICE_ACCOUNT || "").trim();
