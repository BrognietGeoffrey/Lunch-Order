/* global process */
// Pictogramme d'article dessiné par Claude (SVG), pour les étiquettes de l'espace Administration
// POST { name, category } → { svg }
// Utilise ANTHROPIC_API_KEY (déjà configurée pour l'analyse d'images).

const MAX_SVG = 60000;

// Nettoyage défensif : le SVG est affiché dans l'app, on retire tout ce qui pourrait exécuter du code ou charger une ressource
function sanitize(svg) {
  let s = svg;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<\/?(image|use|a|iframe|object|embed|feImage)\b[^>]*>/gi, ""); // balises retirées, contenu conservé
  s = s.replace(/\son[a-z]+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  s = s.replace(/\s(xlink:)?href\s*=\s*("[^"]*"|'[^']*')/gi, "");
  s = s.replace(/url\(\s*(['"]?)(?!#)[^)]*\1\s*\)/gi, "none");
  s = s.replace(/<!--[\s\S]*?-->/g, "");
  return s.trim();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Méthode non autorisée" });
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY n'est pas configurée dans Vercel." });

  const name = String(req.body?.name || "").trim().slice(0, 80);
  const category = String(req.body?.category || "").trim().slice(0, 40);
  if (!name) return res.status(400).json({ error: "Nom de l'article manquant." });

  const prompt = `Dessine un pictogramme pour l'article de fournitures de bureau suivant : « ${name} »${category ? ` (catégorie : ${category})` : ""}.
Contraintes :
- Réponds uniquement avec le code SVG, sans texte autour ni balise markdown.
- <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"> avec un fond transparent.
- Style pictogramme plat et lisible imprimé en petit : formes simples, contours #1a1a1a d'épaisseur 3 à 4, 2 à 4 couleurs douces au maximum.
- L'objet doit être reconnaissable, centré, occupant environ 80 % de la surface.
- Aucun texte, aucune lettre, aucun logo de marque, aucune image externe, aucun script.`;

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: "claude-sonnet-4-6", max_tokens: 4000, messages: [{ role: "user", content: prompt }] }),
    });
    if (!r.ok) return res.status(502).json({ error: `L'IA n'a pas répondu (${r.status}). Réessaie dans un instant.` });
    const data = await r.json();
    const text = (data.content || []).map(c => c.text || "").join("");
    const m = /<svg[\s\S]*<\/svg>/i.exec(text);
    if (!m) return res.status(502).json({ error: "L'IA n'a pas renvoyé d'image exploitable. Réessaie." });
    const svg = sanitize(m[0]);
    if (svg.length > MAX_SVG) return res.status(502).json({ error: "L'image générée est trop lourde. Réessaie." });
    return res.status(200).json({ svg });
  } catch (e) {
    console.error("item-image", e);
    return res.status(500).json({ error: "La génération a échoué. Réessaie dans un instant." });
  }
}
