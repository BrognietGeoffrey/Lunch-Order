// ── Règles d'un code personnel (partagé app / serveur) ────────────────────────
// Deux formes acceptées :
//   - code PIN : uniquement des chiffres, 6 minimum
//   - mot de passe : 8 caractères minimum
// Refusés : suites évidentes (123456, 000000, azerty…), même caractère répété, le nom de la personne.

const WEAK = ["123456", "1234567", "12345678", "123456789", "1234567890", "654321", "111111", "000000", "121212", "123123", "112233",
  "password", "motdepasse", "azertyui", "azerty123", "qwertyui", "abcdefgh", "abcd1234", "12341234", "notaire", "lunchorder", "gestionetude"];

export function checkSecret(secret, username = "") {
  const s = String(secret ?? "");
  const isPin = /^\d+$/.test(s);
  if (isPin && s.length < 6) return "Un code PIN doit contenir au moins 6 chiffres.";
  if (!isPin && s.length < 8) return "Un mot de passe doit contenir au moins 8 caractères (ou choisis un code PIN de 6 chiffres).";
  if (s.length > 128) return "128 caractères maximum.";
  if (/^(.)\1+$/.test(s)) return "Évite de répéter le même caractère.";
  const low = s.toLowerCase();
  if (WEAK.includes(low)) return "Ce code est trop courant, choisis-en un autre.";
  if (isPin && ("01234567890".includes(s) || "09876543210".includes(s))) return "Évite les suites de chiffres (123456…).";
  const u = String(username).toLowerCase().replace(/\s+/g, "");
  if (u && u.length >= 3 && low.replace(/\s+/g, "").includes(u)) return "Le code ne doit pas contenir ton nom.";
  return "";
}

export const secretKind = s => /^\d+$/.test(String(s ?? "")) ? "pin" : "password";
