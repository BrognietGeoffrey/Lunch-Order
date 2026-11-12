// ── Approbation des demandes (tickets) ────────────────────────────────────────
// config/etude.approval = { enabled, approvers: [{ username, email }], categories: [] }
//   categories vide = toutes les catégories de demandes sont soumises à approbation
// ticket.approval = { required, state: "pending"|"approved"|"rejected", approvers: [usernames], by, at, comment, auto, notifiedAt }
// Le demandeur ne peut pas approuver sa propre demande ; s'il est le seul approbateur, la demande est approuvée automatiquement.

export function approvalCfg(cfg = {}) {
  const a = cfg.approval || {};
  return {
    enabled: !!a.enabled,
    approvers: (a.approvers || []).filter(x => x?.username).map(x => ({ username: x.username, email: (x.email || "").trim().toLowerCase() })),
    categories: Array.isArray(a.categories) ? a.categories : [],
  };
}

// null = pas d'approbation ; sinon { approvers: [usernames], auto }
export function approvalFor(cfg, category, requester) {
  const a = approvalCfg(cfg);
  if (!a.enabled || !a.approvers.length) return null;
  if (a.categories.length && !a.categories.includes(category)) return null;
  const others = a.approvers.map(x => x.username).filter(u => u !== requester);
  return { approvers: others, auto: others.length === 0 };
}

export const canApprove = (t, user) => t?.status === "approval" && (t.approval?.approvers || []).includes(user);
export const involves = (t, user) => t.requester === user || (t.approval?.approvers || []).includes(user) || t.approval?.by === user;
