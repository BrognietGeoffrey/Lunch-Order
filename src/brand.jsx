// ── Identité « Gestion Étude » : logo et icônes au trait ──────────────────────
// Le logo vient de public/brand/*.svg (tracé vectoriel du logo de l'étude).
// onDark : affiche le logo en blanc (sur fond sombre) ; sinon en noir.

export function BrandLogo({ variant = "full", height, width, onDark = false, alt = "Logo de l'étude", style }) {
  const src = variant === "mono" ? "/brand/monogram-mb.svg" : "/brand/logo-mb.svg";
  return (
    <img src={src} alt={alt} draggable={false}
      style={{ display: "block", height, width, maxWidth: "100%", filter: onDark ? "invert(1)" : "none", userSelect: "none", ...style }} />
  );
}

// Icônes au trait (24×24, trait 1.6) — dessin volontairement sobre, en écho aux lignes du monogramme
const P = {
  home: "M3 10.5 12 3l9 7.5M5 9.5V21h5v-6h4v6h5V9.5",
  box: "M3 7.5 12 3l9 4.5v9L12 21l-9-4.5v-9ZM3 7.5 12 12l9-4.5M12 12v9",
  ticket: "M4 6h16v4a2 2 0 0 0 0 4v4H4v-4a2 2 0 0 0 0-4V6ZM14 6v2M14 11v2M14 16v2",
  laptop: "M5 5h14v10H5zM2.5 19h19M9 19l.5-2h5l.5 2",
  calendar: "M4 6h16v15H4zM4 10h16M8 3v5M16 3v5",
  settings: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19.4 13.5l1.6 1-2 3.5-1.8-.6a7 7 0 0 1-2 1.2L15 21h-4l-.3-1.9a7 7 0 0 1-2-1.2l-1.8.6-2-3.5 1.6-1a7 7 0 0 1 0-2.4l-1.6-1 2-3.5 1.8.6a7 7 0 0 1 2-1.2L11 3h4l.3 1.9a7 7 0 0 1 2 1.2l1.8-.6 2 3.5-1.6 1a7 7 0 0 1 0 2.4Z",
  building: "M4 21V5l8-2v18M12 7l8 2v12M2 21h20M7 8h2M7 12h2M7 16h2M15 12h2M15 16h2",
  utensils: "M7 3v8M5 3v5a2 2 0 0 0 4 0V3M7 11v10M17 3c-2 1.5-3 4-3 7h3v11",
  alert: "M12 3 2 20h20L12 3ZM12 10v4.5M12 17.2v.3",
  mail: "M3 5h18v14H3zM3 6l9 7 9-7",
  copy: "M8 8h12v12H8zM16 8V4H4v12h4",
  pencil: "M4 20h4L19 9l-4-4L4 16v4ZM13.5 6.5l4 4",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM4 21a8 8 0 0 1 16 0",
  pin: "M12 21s7-6.2 7-11.5A7 7 0 0 0 5 9.5C5 14.8 12 21 12 21ZM12 12a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  shield: "M12 3 4 6v6c0 4.5 3.4 8 8 9 4.6-1 8-4.5 8-9V6l-8-3Z",
  list: "M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01",
  logout: "M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11",
  sun: "M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4",
  moon: "M20 14.5A8 8 0 1 1 9.5 4a6.5 6.5 0 0 0 10.5 10.5Z",
  plus: "M12 5v14M5 12h14",
  check: "M5 12.5 10 17 19 7",
  arrow: "M5 12h14M13 6l6 6-6 6",
  clipboard: "M8 4h8v3H8zM8 5.5H5V21h14V5.5h-3M8.5 12h7M8.5 16h5",
  chart: "M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3",
  wallet: "M3 7h16v13H3zM3 7l12-3v3M15 13.5h4",
  chat: "M4 5h16v11H9l-5 4V5Z",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18ZM12 7v5l3 2",
};

export function Icon({ name, size = 18, stroke = 1.6, style, title }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden={title ? undefined : true} role={title ? "img" : undefined} style={{ display: "inline-block", flexShrink: 0, verticalAlign: "-0.2em", ...style }}>
      {title && <title>{title}</title>}
      <path d={P[name] || ""} />
    </svg>
  );
}
