// ── Droits d'accès par membre ─────────────────────────────────────────────────
// Champs d'un membre (config/members.list[]) :
//   lunch : boolean               → accès à l'espace Lunch Order
//   etude : "none"|"user"|"admin" → accès à l'espace Étude (stock, demandes, matériel, planning)
// Compatibilité avec les anciens membres sans ces champs :
//   - planningOnly:true  → pas de Lunch, Étude « utilisateur »
//   - isAdmin:true       → Étude « admin » par défaut
export const ETUDE_ROLES = [
  { id: "none", label: "Aucun accès" },
  { id: "user", label: "Utilisateur" },
  { id: "admin", label: "Admin" },
];

export function accessOf(m) {
  if (!m) return { lunch: true, etude: "none" };
  const lunch = typeof m.lunch === "boolean" ? m.lunch : !m.planningOnly;
  const etude = ["none", "user", "admin"].includes(m.etude)
    ? m.etude
    : m.isAdmin ? "admin" : m.planningOnly ? "user" : "none";
  return { lunch: m.isAdmin ? true : lunch, etude };
}
