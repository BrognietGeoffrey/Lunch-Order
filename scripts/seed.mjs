// Import initial des données dans Firestore.
// Usage :  node --env-file=.env scripts/seed.mjs            (n'écrase rien d'existant)
//          node --env-file=.env scripts/seed.mjs --force    (écrase tous les documents config/*)
//
// - Reprend automatiquement les anciennes personnalisations de menus
//   (config/snackMenu, config/libanaisMenu, config/boubouleMenu, config/boubouleSpeciaux).
// - Si config/members existe déjà sans compte admin, ajoute le compte admin du fichier seed.

import { readFile } from "node:fs/promises";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, getDoc, setDoc } from "firebase/firestore";
import { getAuth, signInAnonymously } from "firebase/auth";

const env = process.env;
const app = initializeApp({
  apiKey: env.VITE_FIREBASE_API_KEY,
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.VITE_FIREBASE_APP_ID,
});
const db = getFirestore(app);
await signInAnonymously(getAuth(app));

const force = process.argv.includes("--force");
const seed = JSON.parse(await readFile(new URL("./seed-data.json", import.meta.url), "utf8"));
const read = async (id) => {
  const s = await getDoc(doc(db, "config", id));
  return s.exists() ? s.data() : null;
};

// 1. Migration des anciennes surcharges de menus
const legacy = {
  "snack-merode": await read("snackMenu"),
  "libanais": await read("libanaisMenu"),
};
const bbMenu = await read("boubouleMenu");
const bbSpec = await read("boubouleSpeciaux");

for (const r of seed.config.restaurants.list) {
  const ov = legacy[r.id];
  if (ov?.sections) {
    r.sections = r.sections.map((s) => {
      if (s.action?.type === "frite") return s; // nouveau format (Petite/Moyenne/Grande)
      const o = ov.sections.find((x) => x.cat === s.cat);
      return o?.items ? { ...s, items: o.items } : s;
    });
  }
  if (r.kind === "glace") {
    r.sections = r.sections.map((s) => {
      if (s.aiKey === "classiques" && bbMenu?.classiques) return { ...s, items: bbMenu.classiques };
      if (s.aiKey === "speciaux" && bbSpec?.list) return { ...s, items: bbSpec.list.map((name) => ({ name })) };
      return s;
    });
  }
}

// 2. Écriture
for (const [id, value] of Object.entries(seed.config)) {
  const existing = await read(id);
  if (existing && !force) {
    if (id === "members") {
      const list = existing.list || [];
      if (!list.some((m) => m.isAdmin)) {
        const admins = value.list.filter((m) => m.isAdmin && !list.some((x) => x.username === m.username));
        await setDoc(doc(db, "config", id), { ...existing, list: [...admins, ...list] });
        console.log(`✓ ${id} : compte admin ajouté`);
        continue;
      }
    }
    console.log(`• ${id} existe déjà, ignoré (--force pour écraser)`);
    continue;
  }
  await setDoc(doc(db, "config", id), value);
  console.log(`✓ ${id} écrit`);
}

console.log("Terminé.");
process.exit(0);
