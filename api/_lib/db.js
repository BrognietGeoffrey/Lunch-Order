/* global process */
// Accès base pour les routes serveur : Firebase Admin si la clé de service est configurée (fonctionne avec la base verrouillée),
// sinon l'accès client anonyme d'avant (période de transition).
import { getAdmin } from "./admin.js";

const env = process.env;
let clientDb = null;
async function client() {
  if (clientDb) return clientDb;
  const { initializeApp, getApps } = await import("firebase/app");
  const fs = await import("firebase/firestore");
  const { getAuth, signInAnonymously } = await import("firebase/auth");
  const app = getApps()[0] || initializeApp({
    apiKey: env.VITE_FIREBASE_API_KEY, authDomain: env.VITE_FIREBASE_AUTH_DOMAIN, projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET, messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID, appId: env.VITE_FIREBASE_APP_ID,
  });
  const auth = getAuth(app);
  if (!auth.currentUser) await signInAnonymously(auth);
  const db = fs.getFirestore(app);
  const ref = path => fs.doc(db, ...path.split("/"));
  clientDb = {
    get: async path => { const s = await fs.getDoc(ref(path)); return s.exists() ? s.data() : null; },
    list: async name => { const s = await fs.getDocs(fs.collection(db, name)); const a = []; s.forEach(d => a.push({ id: d.id, ...d.data() })); return a; },
    merge: (path, data) => fs.setDoc(ref(path), data, { merge: true }),
    update: (path, data) => fs.updateDoc(ref(path), data),
  };
  return clientDb;
}

export async function getDb() {
  const admin = getAdmin();
  if (!admin) return client();
  const ref = path => admin.db.doc(path);
  return {
    admin,
    get: async path => { const s = await ref(path).get(); return s.exists ? s.data() : null; },
    list: async name => { const s = await admin.db.collection(name).get(); return s.docs.map(d => ({ id: d.id, ...d.data() })); },
    merge: (path, data) => ref(path).set(data, { merge: true }),
    update: (path, data) => ref(path).update(data),
  };
}
