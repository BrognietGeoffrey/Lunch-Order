export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { imageBase64, mediaType } = req.body;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1000,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
          { type: "text", text: `Cette image montre les parfums de glace disponibles chez Bou·Boul·e.
Extrais UNIQUEMENT les noms des parfums en deux catégories : "classiques" et "speciaux".
Réponds UNIQUEMENT en JSON valide, sans markdown, sans explication :
{"classiques":["nom1","nom2"],"speciaux":["nom3","nom4"]}
Si un parfum a un symbole végane (feuille, 🌿, etc.), garde l'emoji 🌿 dans le nom.` }
        ]
      }]
    })
  });

  const data = await response.json();
  const text = data.content?.map(c => c.text || "").join("").trim();
  const clean = text.replace(/```json|```/g, "").trim();

  try {
    const parsed = JSON.parse(clean);
    res.status(200).json(parsed);
  } catch {
    res.status(500).json({ error: "Parse failed", raw: text });
  }
}
