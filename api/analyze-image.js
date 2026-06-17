export const config = {
  api: { bodyParser: { sizeLimit: "10mb" } }
};

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });

  const { imageBase64, mediaType } = req.body;
  if (!imageBase64) return res.status(400).json({ error: "Missing imageBase64" });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mediaType || "image/jpeg", data: imageBase64 }
            },
            {
              type: "text",
              text: `Cette image montre les parfums de glace disponibles chez Bou·Boul·e.
Extrais UNIQUEMENT les noms des parfums en deux catégories : "classiques" et "speciaux".
Réponds UNIQUEMENT en JSON valide, sans markdown, sans explication :
{"classiques":["nom1","nom2"],"speciaux":["nom3","nom4"]}
Si un parfum a un symbole végane (feuille verte, checkmark vert, etc.), ajoute 🌿 à la fin du nom.`
            }
          ]
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(500).json({ error: `Anthropic error ${response.status}`, detail: errText });
    }

    const data = await response.json();
    const text = data.content?.map(c => c.text || "").join("").trim();
    const clean = text.replace(/```json|```/g, "").trim();
    const parsed = JSON.parse(clean);
    return res.status(200).json(parsed);

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}