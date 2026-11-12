// ── Règles de stock partagées (Administration, badge Lunch) ──────────────────
// Deux façons de suivre un article (stock_items.trackMode) :
//   "count"  (défaut) : on compte les unités ; « à commander » quand qty ≤ threshold
//   "visual" : seuil visuel, sans comptage (ex. une pile de fardes) ; quelqu'un signale « stock bas »
//              (scan de l'étiquette ou bouton) → lowFlag, lowAt, lowBy ; un admin remet à OK au réassort
// (même règle dupliquée côté serveur dans api/stock-alert.js)

export const num = v => { const n = Number(v); return Number.isFinite(n) ? n : 0; };
export const isVisual = it => it?.trackMode === "visual";
export const isLow = it => isVisual(it) ? !!it.lowFlag : num(it.qty) <= num(it.threshold);
