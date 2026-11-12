// ── Codes d'articles (QR / code-barres) et images ─────────────────────────────
// Un article du stock peut porter plusieurs codes (stock_items.codes[]) :
// un code généré par l'app (ex. « MB7K2QXA ») et/ou le code-barres imprimé sur le produit (EAN…).

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sans 0/O ni 1/I pour éviter les confusions

export const normCode = s => String(s ?? "").trim().toUpperCase();

export function genCode(taken = []) {
  const used = new Set(taken.map(normCode));
  for (;;) {
    const bytes = crypto.getRandomValues(new Uint8Array(6));
    const c = "MB" + Array.from(bytes, b => ALPHABET[b % ALPHABET.length]).join("");
    if (!used.has(c)) return c;
  }
}

// Le QR code contient un lien vers l'app : scanné avec l'appareil photo du téléphone, il ouvre l'app sur le scanner.
export const scanUrl = code => `${window.location.origin}/#scan/${encodeURIComponent(normCode(code))}`;

// Accepte un code brut (douchette, code-barres) ou un lien de QR code de l'app
export function parseScan(text) {
  const t = String(text ?? "").trim();
  const m = /#scan\/([^/?#\s]+)/.exec(t);
  return normCode(m ? decodeURIComponent(m[1]) : t);
}

export const findByCode = (items, code) => {
  const c = normCode(code);
  return c ? items.find(it => (it.codes || []).some(x => normCode(x) === c)) : undefined;
};

// Réduit une photo (max 480 px, JPEG) pour la stocker directement dans Firestore (~30–60 Ko)
export function compressImage(file, max = 480, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const r = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * r); c.height = Math.round(img.height * r);
      const g = c.getContext("2d");
      g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height);
      g.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image illisible")); };
    img.src = url;
  });
}

export const svgToDataUrl = svg => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);

// Lien de scan en attente (QR code ouvert depuis l'appareil photo avant la connexion)
const PENDING = "pending_scan";
export function takePendingFromHash() {
  const m = /^#scan\/(.+)$/.exec(window.location.hash || "");
  if (m) {
    try { sessionStorage.setItem(PENDING, normCode(decodeURIComponent(m[1]))); } catch { /* stockage indisponible */ }
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  try { return sessionStorage.getItem(PENDING) || ""; } catch { return ""; }
}
export function clearPendingScan() { try { sessionStorage.removeItem(PENDING); } catch { /* stockage indisponible */ } }
