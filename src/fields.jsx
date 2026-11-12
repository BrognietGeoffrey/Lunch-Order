import { useState } from "react";

// Liste déroulante des valeurs connues (Réglages) + « Autre… » pour saisir une nouvelle valeur.
// Remplace <input list="…"> : le navigateur n'y propose que les valeurs qui commencent comme le texte déjà saisi.
export function ChoiceInput({ id, value, options, onChange, style, placeholder = "Saisir…", emptyLabel = "—" }) {
  const list = (options || []).filter(Boolean);
  const known = !value || list.includes(value);
  const [custom, setCustom] = useState(!known);
  const all = known ? list : [...list, value];

  if (custom) return (
    <div style={{ display: "flex", gap: 6, minWidth: 0 }}>
      <input id={id} style={{ ...style, flex: 1, minWidth: 0 }} value={value || ""} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus />
      {list.length > 0 && (
        <button type="button" onClick={() => { setCustom(false); if (value && !list.includes(value)) onChange(""); }} title="Revenir à la liste"
          style={{ ...style, width: "auto", flexShrink: 0, cursor: "pointer", padding: "0 10px", fontSize: 13 }}>Liste</button>
      )}
    </div>
  );
  return (
    <select id={id} style={{ ...style, cursor: "pointer" }} value={value || ""}
      onChange={e => { if (e.target.value === "__other") { setCustom(true); onChange(""); } else onChange(e.target.value); }}>
      <option value="">{emptyLabel}</option>
      {all.map(o => <option key={o} value={o}>{o}</option>)}
      <option value="__other">Autre…</option>
    </select>
  );
}
