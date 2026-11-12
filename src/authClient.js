// Appels à /api/auth depuis l'app (connexion sécurisée)
// Erreur avec .code === "NO_ADMIN" (ou .status 404 en développement local) : la connexion sécurisée n'est pas encore
// configurée sur le serveur → l'app garde l'ancienne vérification le temps de la mise en place.
export async function authApi(action, body = {}, auth) {
  const headers = { "Content-Type": "application/json" };
  const u = auth?.currentUser;
  if (u && !u.isAnonymous) headers.Authorization = "Bearer " + await u.getIdToken();
  let r;
  try { r = await fetch("/api/auth", { method: "POST", headers, body: JSON.stringify({ action, ...body }) }); }
  catch { throw Object.assign(new Error("Le serveur ne répond pas. Vérifie ta connexion internet."), { network: true }); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `Erreur ${r.status}`), { status: r.status, code: j.code });
  return j;
}

export const secureUnavailable = e => e?.code === "NO_ADMIN" || e?.status === 404;
