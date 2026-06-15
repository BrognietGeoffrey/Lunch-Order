import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBuZ98mNM-FRYpIkWzb6HiZYgX7ynlMXMU",
  authDomain: "lunch-order-af7e4.firebaseapp.com",
  projectId: "lunch-order-af7e4",
  storageBucket: "lunch-order-af7e4.firebasestorage.app",
  messagingSenderId: "111273452874",
  appId: "1:111273452874:web:f2d5c32f21419f8cc08db3",
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);

const ADMIN = { username: "Admin", code: "0000" };
const DEFAULT_MEMBERS = [
  { username: "Boryana",      code: "200" },
  { username: "Maïté",        code: "201" },
  { username: "Audrey",       code: "202" },
  { username: "Dorothée",     code: "203" },
  { username: "Salle d'acte", code: "204" },
  { username: "Catherine",    code: "205" },
  { username: "Diana",        code: "206" },
  { username: "Julie",        code: "207" },
  { username: "Frédérique",   code: "208" },
  { username: "Sarah",        code: "210" },
];
const DEFAULT_SAUCES   = ["Mayo","Ketchup","Andalouse","Samourai","Pickles","Cocktail"];
const DEFAULT_CRUDITES = ["Tomate","Salade","Oignon","Cornichon","Poivron"];
const DEFAULT_BOISSONS = ["Eau","Coca","Fanta","Ice Tea","Jus d'orange"];
const DEFAULT_EXTRAS   = [];
const EXTRA_ACCENTS    = ["#c084fc","#fb923c","#38bdf8","#a3e635","#f472b6","#34d399"];

const LUNCH_OPTIONS = [
  { id: "ice-cream",    label: "🍦 Ice Cream",    accent: "#f472b6", glow: "#f472b633" },
  { id: "snack-merode", label: "🥪 Snack Merode", accent: "#fb923c", glow: "#fb923c33" },
  { id: "libanais",     label: "🥙 Libanais",     accent: "#34d399", glow: "#34d39933" },
];

// ── Design tokens ─────────────────────────────────────────────────────────────
const T = {
  // Backgrounds
  bg:        "#0f0e0c",       // near-black warm
  bgCard:    "rgba(255,248,235,0.05)",
  bgCardHov: "rgba(255,248,235,0.08)",
  bgGlass:   "rgba(255,248,235,0.04)",
  bgInput:   "rgba(255,248,235,0.06)",
  bgSection: "rgba(255,248,235,0.03)",

  // Borders
  border:    "rgba(255,220,150,0.12)",
  borderGlow:"rgba(255,200,100,0.25)",
  borderSub: "rgba(255,220,150,0.07)",

  // Text
  text:      "#f5efe6",
  textSub:   "#a89880",
  textFaint: "#5a4f44",
  textAccent:"#f0c070",

  // Accents
  amber:     "#f0c070",
  amberGlow: "rgba(240,192,112,0.20)",
  amberDeep: "#c8922a",
  green:     "#22c55e",
  red:       "#f87171",

  // Blur
  blur:      "blur(20px)",
};

const LIGHT_T = {
  bg:        "#f5f0e8",
  bgCard:    "rgba(255,255,255,0.85)",
  bgCardHov: "rgba(255,255,255,0.95)",
  bgGlass:   "rgba(255,255,255,0.6)",
  bgInput:   "rgba(255,255,255,0.9)",
  bgSection: "rgba(0,0,0,0.02)",
  border:    "rgba(180,140,80,0.20)",
  borderGlow:"rgba(180,140,80,0.40)",
  borderSub: "rgba(180,140,80,0.10)",
  text:      "#2c1f0e",
  textSub:   "#7a6040",
  textFaint: "#b0956a",
  textAccent:"#c8922a",
  amber:     "#c8922a",
  amberGlow: "rgba(200,146,42,0.15)",
  amberDeep: "#a06820",
  green:     "#16a34a",
  red:       "#dc2626",
  blur:      "blur(20px)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatCrudites(o, allCrudites) {
  if (!o.crudites?.length) return null;
  if (o.cruditesTout) {
    const excl = allCrudites.filter(c => !o.crudites.includes(c));
    return excl.length > 0 ? "Tout sauf: "+excl.join(", ") : "Toutes crudités";
  }
  return "Crudités: "+o.crudites.join(", ");
}

function formatOrderFull(o, extras=[], allCrudites=[]) {
  if (!o?.choice) return [];
  const lines = [];
  if (o.choice==="snack-merode") {
    const firstPart = [o.snackType, o.detail].filter(Boolean).join(" ");
    if (firstPart) lines.push({ emoji:"🥙", text: firstPart });
    extras.filter(ex=>ex.appliesTo?.includes("snack-merode")).forEach(ex=>{
      const sel=(o.extras||{})[ex.id]||[];
      sel.forEach(opt=>lines.push({ emoji:"➕", text: opt }));
    });
    if (o.frites)     lines.push({ emoji:"🍟", text: o.frites });
    if (o.friteSup)   lines.push({ emoji:"🍟", text: "Frite sup. "+o.friteSup });
    if (o.sauceFrite) lines.push({ emoji:"🥣", text: "Sauce frite: "+o.sauceFrite });
    const cru = formatCrudites(o, allCrudites);
    if (cru)          lines.push({ emoji:"🥗", text: cru });
    if (o.sauces?.length) lines.push({ emoji:"🫙", text: o.sauces.join(", ") });
    if (o.boisson)    lines.push({ emoji:"🥤", text: o.boisson });
  } else if (o.choice==="ice-cream") {
    if (o.boules)  lines.push({ emoji:"🍦", text: o.boules });
    if (o.detail)  lines.push({ emoji:"✨", text: o.detail });
    extras.filter(ex=>ex.appliesTo?.includes("ice-cream")).forEach(ex=>{
      const sel=(o.extras||{})[ex.id]||[];
      sel.forEach(opt=>lines.push({ emoji:"➕", text: opt }));
    });
    if (o.boisson) lines.push({ emoji:"🥤", text: o.boisson });
  } else {
    if (o.detail)  lines.push({ emoji:"🥙", text: o.detail });
    extras.filter(ex=>ex.appliesTo?.includes("libanais")).forEach(ex=>{
      const sel=(o.extras||{})[ex.id]||[];
      sel.forEach(opt=>lines.push({ emoji:"➕", text: opt }));
    });
    if (o.boisson) lines.push({ emoji:"🥤", text: o.boisson });
  }
  return lines;
}

function formatOrder(o, extras=[], allCrudites=[]) {
  return formatOrderFull(o,extras,allCrudites).map(l=>l.text).join(" · ");
}

// ── Styles helpers ────────────────────────────────────────────────────────────
const CSS = (theme) => `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${theme.bg}; font-family: 'DM Sans', sans-serif; }
  textarea { resize: vertical; }
  input:focus, textarea:focus, button:focus, select:focus { outline: none; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: ${theme.border}; border-radius: 4px; }
  @keyframes fadeUp    { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
  @keyframes shake     { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
  @keyframes slideDown { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:0.4} }
  @keyframes toastIn   { from{opacity:0;transform:translateX(-50%) translateY(16px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
  @keyframes glow      { 0%,100%{box-shadow:0 0 20px rgba(240,192,112,0.1)} 50%{box-shadow:0 0 40px rgba(240,192,112,0.25)} }
  .row-hover:hover { background: ${theme.bgCardHov} !important; }
  .tab-btn:hover { color: ${theme.textAccent} !important; }
  .pill-btn:hover { opacity: 0.85; }
`;

const glassCard = (theme, extra={}) => ({
  background: theme.bgCard,
  backdropFilter: theme.blur,
  WebkitBackdropFilter: theme.blur,
  border: `1px solid ${theme.border}`,
  borderRadius: 16,
  ...extra,
});

const inputStyle = (theme) => ({
  width:"100%",
  background: theme.bgInput,
  backdropFilter: theme.blur,
  border: `1px solid ${theme.border}`,
  borderRadius: 10,
  color: theme.text,
  padding: "10px 14px",
  fontSize: 14,
  fontFamily: "'DM Sans', sans-serif",
  transition: "border-color 0.2s",
});

const pill = (accent, active, disabled, theme) => ({
  background: active ? accent+"22" : "transparent",
  border: `1px solid ${active ? accent : theme.border}`,
  borderRadius: 20,
  padding: "4px 12px",
  fontSize: 12,
  fontWeight: active ? 600 : 400,
  color: active ? accent : theme.textSub,
  cursor: disabled ? "not-allowed" : "pointer",
  transition: "all 0.15s",
  fontFamily: "inherit",
  whiteSpace: "nowrap",
  opacity: disabled ? 0.3 : 1,
  boxShadow: active ? `0 0 12px ${accent}33` : "none",
});

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, theme, toggleTheme, members }) {
  const [username, setUsername] = useState("");
  const [code, setCode]         = useState("");
  const [error, setError]       = useState("");
  const [shake, setShake]       = useState(false);
  const allUsers = [...members, ADMIN];

  const attempt = () => {
    const user = allUsers.find(u=>u.username.toLowerCase()===username.toLowerCase()&&u.code===code.trim());
    if (user) { onLogin(user.username); }
    else { setError("Nom ou code invalide."); setShake(true); setTimeout(()=>setShake(false),600); }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center",
      background: `radial-gradient(ellipse at 30% 20%, rgba(240,192,112,0.08) 0%, transparent 60%),
                   radial-gradient(ellipse at 70% 80%, rgba(251,146,60,0.06) 0%, transparent 60%),
                   ${theme.bg}`,
      fontFamily:"'DM Sans',sans-serif" }}>
      <style>{CSS(theme)}</style>
      <button onClick={toggleTheme} style={{ position:"fixed", top:20, right:20, background:theme.bgCard,
        backdropFilter:theme.blur, border:`1px solid ${theme.border}`, borderRadius:10,
        padding:"8px 12px", fontSize:16, cursor:"pointer", color:theme.text }}>
        {theme===T?"☀️":"🌙"}
      </button>

      <div style={{ ...glassCard(theme), padding:"48px 40px", width:380, textAlign:"center",
        boxShadow:`0 32px 80px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,220,150,0.1)`,
        animation: shake?"shake 0.5s":"fadeUp 0.6s both" }}>

        {/* Logo */}
        <div style={{ width:64, height:64, borderRadius:16, background:`linear-gradient(135deg, ${theme.amber}22, ${theme.amber}44)`,
          border:`1px solid ${theme.amber}44`, display:"flex", alignItems:"center", justifyContent:"center",
          fontSize:28, margin:"0 auto 20px", boxShadow:`0 0 30px ${theme.amber}22` }}>🍽️</div>

        <h1 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:26, color:theme.text, marginBottom:4, letterSpacing:"-0.5px" }}>Lunch Orders</h1>
        <p style={{ color:theme.textSub, fontSize:14, marginBottom:32 }}>Connecte-toi pour commander</p>

        <div style={{ textAlign:"left", marginBottom:14 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:600, color:theme.textSub, marginBottom:6, letterSpacing:"0.08em", textTransform:"uppercase" }}>Nom</label>
          <select style={{ ...inputStyle(theme) }} value={username} onChange={e=>setUsername(e.target.value)}>
            <option value="">— Choisis ton nom —</option>
            {allUsers.map(u=><option key={u.username} value={u.username}>{u.username}</option>)}
          </select>
        </div>

        <div style={{ textAlign:"left", marginBottom:20 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:600, color:theme.textSub, marginBottom:6, letterSpacing:"0.08em", textTransform:"uppercase" }}>Code</label>
          <input style={{ ...inputStyle(theme) }} type="password" value={code} placeholder="••••"
            onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()} />
        </div>

        {error && <p style={{ color:theme.red, fontSize:13, marginBottom:14 }}>{error}</p>}

        <button style={{ width:"100%", background:`linear-gradient(135deg, ${theme.amber}, ${theme.amberDeep})`,
          color:"#1a1000", border:"none", borderRadius:12, padding:"13px 0", fontSize:15, fontWeight:700,
          fontFamily:"'Syne',sans-serif", cursor:"pointer", letterSpacing:"0.02em",
          boxShadow:`0 4px 20px ${theme.amberGlow}`, transition:"transform 0.15s, box-shadow 0.15s" }}
          onMouseEnter={e=>{e.target.style.transform="translateY(-1px)";e.target.style.boxShadow=`0 8px 30px ${theme.amberGlow}`;}}
          onMouseLeave={e=>{e.target.style.transform="";e.target.style.boxShadow=`0 4px 20px ${theme.amberGlow}`;}}
          onClick={attempt}>Entrer →</button>

        <p style={{ color:theme.textFaint, fontSize:11, marginTop:20 }}>Ton code = ton numéro de poste 😉</p>
      </div>
    </div>
  );
}

// ── Order detail cell (shared) ────────────────────────────────────────────────
function DetailCell({ name, order, canEdit, sauces, crudites, boissons, extras, mealExtras, theme,
  handleDetail, handleSubDetail, toggleMulti, toggleCruditesTout, toggleExtraOption, pb, ps, newBoissonInput, setNewBoissonInput, isMobile }) {

  if (!order.choice) return <span style={{ fontSize:12, color:theme.textFaint }}>{canEdit?"Choisis d'abord…":"🔒"}</span>;

  const P = (accent, active, disabled) => pill(accent, active, disabled, theme);
  const sauceInput = useRef(null);
  const sauceFriteInput = useRef(null);

  const BoissonSection = () => (
    <div style={{ paddingTop:8, marginTop:4, borderTop:`1px dashed ${theme.borderSub}` }}>
      <span style={{ fontSize:11, color:theme.textFaint, display:"block", marginBottom:5 }}>🥤 Boisson :</span>
      <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:5 }}>
        {boissons.map(b=>(
          <button key={b} disabled={!canEdit} className="pill-btn"
            onClick={()=>canEdit&&handleSubDetail(name,"boisson",order.boisson===b?"":b)}
            style={P("#38bdf8",order.boisson===b,!canEdit)}>{b}</button>
        ))}
      </div>
      <div style={{ display:"flex", gap:5, alignItems:"center" }}>
        <input style={{ flex:1, background:theme.bgInput, border:`1px solid ${theme.border}`, borderRadius:8,
          color:theme.text, padding:"4px 8px", fontSize:12, fontFamily:"'DM Sans',sans-serif", opacity:canEdit?1:0.35 }}
          disabled={!canEdit}
          value={newBoissonInput[name]??(!boissons.includes(order.boisson||"")?(order.boisson||""):"")}
          onChange={e=>{ setNewBoissonInput(p=>({...p,[name]:e.target.value})); handleSubDetail(name,"boisson",e.target.value); }}
          placeholder={canEdit?"Autre boisson…":"🔒"} />
        {canEdit && (newBoissonInput[name]||order.boisson||"").trim() && !boissons.includes((newBoissonInput[name]||order.boisson||"").trim()) && (
          <button className="pill-btn" onClick={async()=>{ const v=(newBoissonInput[name]||order.boisson||"").trim(); await pb([...boissons,v]); setNewBoissonInput(p=>({...p,[name]:""})); }}
            style={{ ...P("#38bdf8",false,false), padding:"4px 8px", fontSize:11 }}>+ Sauvegarder</button>
        )}
      </div>
    </div>
  );

  if (order.choice==="ice-cream") return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
        {["1 boule","2 boules"].map(opt=>(
          <button key={opt} disabled={!canEdit} className="pill-btn"
            onClick={()=>canEdit&&handleSubDetail(name,"boules",order.boules===opt?"":opt)}
            style={P("#f472b6",order.boules===opt,!canEdit)}>{opt}</button>
        ))}
      </div>
      <input style={{ ...inputStyle(theme), padding:"6px 10px", fontSize:13, opacity:canEdit?1:0.35 }}
        disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)} placeholder={canEdit?"Parfum(s)…":"🔒"} />
      {mealExtras.map(ex=>(
        <div key={ex.id} style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          <span style={{ fontSize:11, color:ex.accent, width:"100%", fontWeight:500 }}>➕ {ex.label} :</span>
          {ex.options.map(o=>(
            <button key={o} disabled={!canEdit} className="pill-btn"
              onClick={()=>canEdit&&toggleExtraOption(name,ex.id,o)}
              style={P(ex.accent,((order.extras||{})[ex.id]||[]).includes(o),!canEdit)}>{o}</button>
          ))}
        </div>
      ))}
      <BoissonSection/>
    </div>
  );

  if (order.choice==="libanais") return (
    <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
      <textarea style={{ ...inputStyle(theme), padding:"8px 10px", fontSize:13, lineHeight:1.5, opacity:canEdit?1:0.35 }}
        rows={2} disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)} placeholder={canEdit?"Précise ta commande…":"🔒"} />
      {mealExtras.map(ex=>(
        <div key={ex.id} style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          <span style={{ fontSize:11, color:ex.accent, width:"100%", fontWeight:500 }}>➕ {ex.label} :</span>
          {ex.options.map(o=>(
            <button key={o} disabled={!canEdit} className="pill-btn"
              onClick={()=>canEdit&&toggleExtraOption(name,ex.id,o)}
              style={P(ex.accent,((order.extras||{})[ex.id]||[]).includes(o),!canEdit)}>{o}</button>
          ))}
        </div>
      ))}
      <BoissonSection/>
    </div>
  );

  // Snack Merode
  return (
    <div style={{ display:"flex", flexDirection:"column", gap:0 }}>
      {/* Section 1: Durum/Bicky */}
      <div style={{ paddingBottom:8, marginBottom:6, borderBottom:`1px dashed ${theme.borderSub}` }}>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center", marginBottom:6 }}>
          {["Durum","Bicky"].map(opt=>(
            <button key={opt} disabled={!canEdit} className="pill-btn"
              onClick={()=>canEdit&&handleSubDetail(name,"snackType",order.snackType===opt?"":opt)}
              style={P("#fb923c",order.snackType===opt,!canEdit)}>{opt}</button>
          ))}
          <input style={{ flex:1, minWidth:80, background:theme.bgInput, border:`1px solid ${theme.border}`,
            borderRadius:8, color:theme.text, padding:"4px 8px", fontSize:13, fontFamily:"'DM Sans',sans-serif", opacity:canEdit?1:0.35 }}
            disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)}
            placeholder={canEdit?(order.snackType?"ex: falafel…":"Précise…"):"🔒"} />
        </div>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:6 }}>
          {["Frite dedans","Frite à part"].map(opt=>(
            <button key={opt} disabled={!canEdit} className="pill-btn"
              onClick={()=>canEdit&&handleSubDetail(name,"frites",order.frites===opt?"":opt)}
              style={P("#fbbf24",order.frites===opt,!canEdit)}>{opt}</button>
          ))}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5, marginBottom:4 }}>
          <span style={{ fontSize:11, color:theme.textFaint, width:"100%" }}>🫙 Sauce snack :</span>
          {sauces.map(s=>(
            <button key={s} disabled={!canEdit} className="pill-btn"
              onClick={()=>canEdit&&toggleMulti(name,"sauces",s)}
              style={P("#c084fc",(order.sauces||[]).includes(s),!canEdit)}>{s}</button>
          ))}
          {canEdit && (
            <div style={{ display:"flex", gap:5, alignItems:"center", width:"100%", marginTop:3 }}>
              <input ref={sauceInput} style={{ flex:1, background:theme.bgInput, border:`1px solid ${theme.border}`,
                borderRadius:8, color:theme.text, padding:"3px 8px", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}
                placeholder="Autre sauce…"
                onKeyDown={async e=>{ if(e.key==="Enter"&&e.target.value.trim()){await ps([...sauces,e.target.value.trim()]);e.target.value="";}}} />
              <button className="pill-btn" style={{ ...P("#c084fc",false,false), padding:"3px 8px", fontSize:11 }}
                onClick={()=>{ if(sauceInput.current?.value.trim()){ps([...sauces,sauceInput.current.value.trim()]);sauceInput.current.value="";}}}>+ Sauvegarder</button>
            </div>
          )}
        </div>
        {mealExtras.map(ex=>(
          <div key={ex.id} style={{ display:"flex", flexWrap:"wrap", gap:5, marginTop:5 }}>
            <span style={{ fontSize:11, color:ex.accent, width:"100%", fontWeight:500 }}>➕ {ex.label} :</span>
            {ex.options.map(o=>(
              <button key={o} disabled={!canEdit} className="pill-btn"
                onClick={()=>canEdit&&toggleExtraOption(name,ex.id,o)}
                style={P(ex.accent,((order.extras||{})[ex.id]||[]).includes(o),!canEdit)}>{o}</button>
            ))}
          </div>
        ))}
      </div>
      {/* Section 2: Frite extra */}
      <div style={{ paddingBottom:8, marginBottom:6, borderBottom:`1px dashed ${theme.borderSub}` }}>
        <span style={{ fontSize:11, color:theme.textFaint, display:"block", marginBottom:5 }}>🍟 Frite extra :</span>
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:5 }}>
          {["Petite","Moyenne","Grande"].map(opt=>(
            <button key={opt} disabled={!canEdit} className="pill-btn"
              onClick={()=>canEdit&&handleSubDetail(name,"friteSup",order.friteSup===opt?"":opt)}
              style={P("#fb923c",order.friteSup===opt,!canEdit)}>{opt}</button>
          ))}
        </div>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          <span style={{ fontSize:11, color:theme.textFaint, width:"100%" }}>🥣 Sauce frite :</span>
          {sauces.map(s=>(
            <button key={s} disabled={!canEdit} className="pill-btn"
              onClick={()=>canEdit&&handleSubDetail(name,"sauceFrite",order.sauceFrite===s?"":s)}
              style={P("#fbbf24",order.sauceFrite===s,!canEdit)}>{s}</button>
          ))}
          {canEdit && (
            <div style={{ display:"flex", gap:5, alignItems:"center", width:"100%", marginTop:3 }}>
              <input ref={sauceFriteInput} style={{ flex:1, background:theme.bgInput, border:`1px solid ${theme.border}`,
                borderRadius:8, color:theme.text, padding:"3px 8px", fontSize:12, fontFamily:"'DM Sans',sans-serif" }}
                placeholder="Autre sauce…"
                onKeyDown={async e=>{ if(e.key==="Enter"&&e.target.value.trim()){await ps([...sauces,e.target.value.trim()]);e.target.value="";}}} />
              <button className="pill-btn" style={{ ...P("#fbbf24",false,false), padding:"3px 8px", fontSize:11 }}
                onClick={()=>{ if(sauceFriteInput.current?.value.trim()){ps([...sauces,sauceFriteInput.current.value.trim()]);sauceFriteInput.current.value="";}}}> + Sauvegarder</button>
            </div>
          )}
        </div>
      </div>
      {/* Section 3: Crudités */}
      <div style={{ paddingBottom:8, marginBottom:6, borderBottom:`1px dashed ${theme.borderSub}` }}>
        <span style={{ fontSize:11, color:theme.textFaint, display:"block", marginBottom:5 }}>🥗 Crudités :</span>
        <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
          <button disabled={!canEdit} className="pill-btn"
            onClick={()=>canEdit&&toggleCruditesTout(name)}
            style={{ ...P("#34d399",order.cruditesTout,!canEdit), fontWeight:600 }}>Tout</button>
          {crudites.map(c=>(
            <button key={c} disabled={!canEdit} className="pill-btn"
              onClick={()=>canEdit&&toggleMulti(name,"crudites",c)}
              style={P("#34d399",(order.crudites||[]).includes(c),!canEdit)}>{c}</button>
          ))}
        </div>
      </div>
      {/* Section 4: Boissons */}
      <BoissonSection/>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]             = useState(null);
  const [members, setMembers]       = useState(DEFAULT_MEMBERS);
  const [orders, setOrders]         = useState({});
  const [favorites, setFavorites]   = useState({});
  const [sauces, setSauces]         = useState(DEFAULT_SAUCES);
  const [crudites, setCrudites]     = useState(DEFAULT_CRUDITES);
  const [boissons, setBoissons]     = useState(DEFAULT_BOISSONS);
  const [extras, setExtras]         = useState(DEFAULT_EXTRAS);
  const [payments, setPayments]     = useState({});
  const [history, setHistory]       = useState([]);
  const [tab, setTab]               = useState("order");
  const [status, setStatus]         = useState("connecting");
  const [savedMsg, setSavedMsg]     = useState(false);
  const [favNameInput, setFavNameInput]     = useState("");
  const [showFavModal, setShowFavModal]     = useState(false);
  const [newBoissonInput, setNewBoissonInput] = useState({});
  const [newExtraOption, setNewExtraOption]   = useState({});
  const [newMemberName, setNewMemberName]     = useState("");
  const [newMemberCode, setNewMemberCode]     = useState("");
  const [editingMember, setEditingMember]     = useState(null);
  const [newSauce, setNewSauce]       = useState("");
  const [newCrudite, setNewCrudite]   = useState("");
  const [newBoisson, setNewBoisson]   = useState("");
  const [newExtraLabel, setNewExtraLabel]     = useState("");
  const [newExtraApplies, setNewExtraApplies] = useState([]);
  const [isDark, setIsDark]           = useState(()=>localStorage.getItem("lunch_theme")!=="light");
  const [isMobile, setIsMobile]       = useState(()=>window.innerWidth<768);
  const [viewMode, setViewMode]       = useState("accordion");
  const [openHistory, setOpenHistory] = useState({}); // "accordion" | "columns"
  const detailTimers = useRef({});
  const theme = isDark ? T : LIGHT_T;

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    localStorage.setItem("lunch_theme", next?"dark":"light");
  };

  useEffect(()=>{
    const h = ()=>setIsMobile(window.innerWidth<768);
    window.addEventListener("resize",h);
    return ()=>window.removeEventListener("resize",h);
  },[]);

  useEffect(()=>{
    const u1 = onSnapshot(collection(db,"orders"),    snap=>{const d={};snap.forEach(s=>{d[s.id]=s.data();});setOrders(d);setStatus("live");}, ()=>setStatus("error"));
    const u2 = onSnapshot(doc(db,"config","members"), snap=>{if(snap.exists()&&snap.data().list)setMembers(snap.data().list);});
    const u3 = onSnapshot(doc(db,"config","sauces"),  snap=>{if(snap.exists()&&snap.data().list)setSauces(snap.data().list);});
    const u4 = onSnapshot(doc(db,"config","crudites"),snap=>{if(snap.exists()&&snap.data().list)setCrudites(snap.data().list);});
    const u4b= onSnapshot(doc(db,"config","boissons"),snap=>{if(snap.exists()&&snap.data().list)setBoissons(snap.data().list);});
    const u5 = onSnapshot(doc(db,"config","extras"),  snap=>{if(snap.exists()&&snap.data().list)setExtras(snap.data().list);});
    const u6 = onSnapshot(collection(db,"favorites"), snap=>{
      const d={};
      snap.forEach(s=>{
        const data=s.data();
        if(data.list) d[s.id]=data.list;
        else if(data.choice) d[s.id]=[{id:"fav_legacy",name:"Mon favori",...data}];
        else d[s.id]=[];
      });
      setFavorites(d);
    });
    const u7 = onSnapshot(collection(db,"history"),   snap=>{const days=[];snap.forEach(s=>days.push({id:s.id,...s.data()}));days.sort((a,b)=>b.id.localeCompare(a.id));setHistory(days);});
    const u8 = onSnapshot(doc(db,"payments","today"), snap=>{if(snap.exists())setPayments(snap.data());else setPayments({});});
    return ()=>{u1();u2();u3();u4();u4b();u5();u6();u7();u8();};
  },[]);

  useEffect(()=>{
    if(!user||user==="Admin")return;
    const favList=favorites[user]||[];
    if(!favList.length)return;
    const cur=orders[user];
    if(!cur?.choice){
      const first=favList[0];
      const {id:_fid,name:_fn,...orderData}=first;
      setDoc(doc(db,"orders",user),{...orderData});
    }
  },[user,favorites]);

  if(!user) return <LoginScreen onLogin={setUser} theme={theme} toggleTheme={toggleTheme} members={members}/>;

  // persist
  const pm = async l=>{setMembers(l);   await setDoc(doc(db,"config","members"), {list:l});};
  const ps = async l=>{setSauces(l);    await setDoc(doc(db,"config","sauces"),  {list:l});};
  const pc = async l=>{setCrudites(l);  await setDoc(doc(db,"config","crudites"),{list:l});};
  const pb = async l=>{setBoissons(l);  await setDoc(doc(db,"config","boissons"),{list:l});};
  const pe = async l=>{setExtras(l);    await setDoc(doc(db,"config","extras"),  {list:l});};

  const names = user==="Admin" ? members.map(m=>m.username) : [user,...members.map(m=>m.username).filter(n=>n!==user)];

  const addMember    = async()=>{const n=newMemberName.trim(),c=newMemberCode.trim();if(!n||!c||members.find(m=>m.username===n))return;await pm([...members,{username:n,code:c}]);setNewMemberName("");setNewMemberCode("");};
  const removeMember = async n=>{await pm(members.filter(m=>m.username!==n));await deleteDoc(doc(db,"orders",n));};
  const saveEdit     = async()=>{if(!editingMember)return;await pm(members.map(m=>m.username===editingMember.username?editingMember:m));setEditingMember(null);};
  const addSauce     = async()=>{const s=newSauce.trim();   if(s&&!sauces.includes(s))   {await ps([...sauces,s]);    setNewSauce("");}};
  const removeSauce  = async s=>{await ps(sauces.filter(x=>x!==s));};
  const addCrudite   = async()=>{const c=newCrudite.trim(); if(c&&!crudites.includes(c)) {await pc([...crudites,c]);  setNewCrudite("");}};
  const removeCrudite= async c=>{await pc(crudites.filter(x=>x!==c));};
  const addBoisson   = async()=>{const b=newBoisson.trim(); if(b&&!boissons.includes(b)) {await pb([...boissons,b]);  setNewBoisson("");}};
  const removeBoisson= async b=>{await pb(boissons.filter(x=>x!==b));};
  const addExtraCategory=async()=>{const label=newExtraLabel.trim();if(!label||!newExtraApplies.length)return;const id="extra_"+Date.now();const accent=EXTRA_ACCENTS[extras.length%EXTRA_ACCENTS.length];await pe([...extras,{id,label,options:[],appliesTo:newExtraApplies,accent}]);setNewExtraLabel("");setNewExtraApplies([]);};
  const removeExtraCategory=async id=>{await pe(extras.filter(e=>e.id!==id));};
  const addExtraOption=async(extraId)=>{const val=(newExtraOption[extraId]||"").trim();if(!val)return;const updated=extras.map(e=>e.id===extraId?{...e,options:[...e.options,val]}:e);await pe(updated);setNewExtraOption(prev=>({...prev,[extraId]:""}));};
  const removeExtraOption=async(extraId,opt)=>{const updated=extras.map(e=>e.id===extraId?{...e,options:e.options.filter(o=>o!==opt)}:e);await pe(updated);};
  const toggleExtraApplies=meal=>{setNewExtraApplies(prev=>prev.includes(meal)?prev.filter(x=>x!==meal):[...prev,meal]);};

  const toggleChoice=async(name,choice)=>{
    const cur=orders[name]||{};
    if(cur.choice===choice){await deleteDoc(doc(db,"orders",name));}
    else{await setDoc(doc(db,"orders",name),{choice,detail:"",sauces:[],crudites:[],cruditesTout:false,boules:"",snackType:"",frites:"",friteSup:"",sauceFrite:"",boisson:"",extras:{}});}
  };
  const handleDetail=(name,detail)=>{
    setOrders(prev=>({...prev,[name]:{...prev[name],detail}}));
    clearTimeout(detailTimers.current[name]);
    detailTimers.current[name]=setTimeout(async()=>{const cur=orders[name]||{};if(!cur.choice)return;await setDoc(doc(db,"orders",name),{...cur,detail});},600);
  };
  const handleSubDetail=async(name,field,value)=>{
    const cur=orders[name]||{};if(!cur.choice)return;
    const updated={...cur,[field]:value};
    setOrders(prev=>({...prev,[name]:updated}));
    await setDoc(doc(db,"orders",name),updated);
  };
  const toggleMulti=async(name,field,value)=>{
    const cur=orders[name]||{};if(!cur.choice)return;
    const current=cur[field]||[];
    const updated=current.includes(value)?current.filter(x=>x!==value):[...current,value];
    const newOrder={...cur,[field]:updated};
    setOrders(prev=>({...prev,[name]:newOrder}));
    await setDoc(doc(db,"orders",name),newOrder);
  };
  const toggleCruditesTout=async(name)=>{
    const cur=orders[name]||{};if(!cur.choice)return;
    const wasTout=cur.cruditesTout||false;
    const updated={...cur,cruditesTout:!wasTout,crudites:!wasTout?[...crudites]:[]};
    setOrders(prev=>({...prev,[name]:updated}));
    await setDoc(doc(db,"orders",name),updated);
  };
  const toggleExtraOption=async(name,extraId,value)=>{
    const cur=orders[name]||{};if(!cur.choice)return;
    const currentExtras=cur.extras||{};
    const current=currentExtras[extraId]||[];
    const updated=current.includes(value)?current.filter(x=>x!==value):[...current,value];
    const newOrder={...cur,extras:{...currentExtras,[extraId]:updated}};
    setOrders(prev=>({...prev,[name]:newOrder}));
    await setDoc(doc(db,"orders",name),newOrder);
  };
  const togglePayment=async name=>{
    const current=payments[name]||false;
    const updated={...payments,[name]:!current};
    setPayments(updated);
    await setDoc(doc(db,"payments","today"),updated);
  };
  const saveFavorite=async name=>{
    const cur=orders[name];if(!cur?.choice)return;
    const favName=favNameInput.trim()||formatOrder(cur,extras,crudites).slice(0,30)||"Mon favori";
    const existing=favorites[name]||[];
    const newFav={id:"fav_"+Date.now(),name:favName,...cur};
    await setDoc(doc(db,"favorites",name),{list:[...existing,newFav]});
    setFavNameInput("");setShowFavModal(false);
    setSavedMsg(true);setTimeout(()=>setSavedMsg(false),2500);
  };
  const deleteFavorite=async(username,favId)=>{
    const existing=favorites[username]||[];
    await setDoc(doc(db,"favorites",username),{list:existing.filter(f=>f.id!==favId)});
  };
  const resetAll=async()=>{
    if(!window.confirm("Archiver et effacer toutes les commandes du jour ?"))return;
    const today=new Date().toISOString().slice(0,10);
    const historyKey=`${today}_${Date.now()}`;
    const snapshot={};
    members.map(m=>m.username).forEach(n=>{if(orders[n]?.choice)snapshot[n]=orders[n];});
    if(Object.keys(snapshot).length>0)await setDoc(doc(db,"history",historyKey),{date:today,orders:snapshot,payments});
    await Promise.all(members.map(m=>deleteDoc(doc(db,"orders",m.username))));
    await setDoc(doc(db,"payments","today"),{});
  };
  const deleteHistory=async id=>{if(!window.confirm("Supprimer cet historique ?"))return;await deleteDoc(doc(db,"history",id));};

  const totalOrdered=names.filter(n=>orders[n]?.choice).length;
  const notOrdered=names.filter(n=>!orders[n]?.choice);
  const counts=LUNCH_OPTIONS.reduce((a,o)=>{a[o.id]=names.filter(n=>orders[n]?.choice===o.id).length;return a;},{});
  const P = (accent, active, disabled) => pill(accent, active, disabled, theme);

  const inp = { ...inputStyle(theme) };
  const addBtn = {
    background: `linear-gradient(135deg, ${theme.amber}, ${theme.amberDeep})`,
    color: "#1a1000", border:"none", borderRadius:10, padding:"10px 20px",
    fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Syne',sans-serif",
    whiteSpace:"nowrap", boxShadow:`0 4px 16px ${theme.amberGlow}`,
  };
  const secTitle = {
    fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18,
    marginBottom:18, color:theme.text, display:"flex", alignItems:"center", gap:12,
  };
  const badge = {
    background: theme.bgInput, border:`1px solid ${theme.border}`,
    color:theme.textSub, fontSize:12, padding:"3px 12px", borderRadius:20,
  };

  const extrasForMeal = choice => extras.filter(e=>e.appliesTo?.includes(choice));

  const detailCellProps = { sauces, crudites, boissons, extras, theme,
    handleDetail, handleSubDetail, toggleMulti, toggleCruditesTout, toggleExtraOption,
    pb, ps, newBoissonInput, setNewBoissonInput, isMobile };

  // ── Summary pill component
  const OrderPills = ({order}) => {
    const lines = formatOrderFull(order, extras, crudites);
    if (!lines.length) return <span style={{fontSize:12,color:theme.textFaint,fontStyle:"italic"}}>Aucun détail</span>;
    return (
      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
        {lines.map((line,i)=>(
          <span key={i} style={{
            background: theme.bgInput, border:`1px solid ${theme.border}`,
            borderRadius:20, padding:"2px 10px", fontSize:12, color:theme.textSub,
            display:"inline-flex", alignItems:"center", gap:3,
          }}><span>{line.emoji}</span><span>{line.text}</span></span>
        ))}
      </div>
    );
  };

  return (
    <div style={{ minHeight:"100vh", background: isDark
      ? `radial-gradient(ellipse at 20% 0%, rgba(240,192,112,0.06) 0%, transparent 50%),
         radial-gradient(ellipse at 80% 100%, rgba(251,146,60,0.04) 0%, transparent 50%),
         ${theme.bg}`
      : theme.bg,
      fontFamily:"'DM Sans',sans-serif", color:theme.text }}>
      <style>{CSS(theme)}</style>

      {/* ── Header ── */}
      <header style={{ ...glassCard(theme), borderRadius:0, borderLeft:"none", borderRight:"none", borderTop:"none",
        position:"sticky", top:0, zIndex:100, boxShadow:`0 1px 40px rgba(0,0,0,0.3)` }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:32, height:32, borderRadius:8,
              background:`linear-gradient(135deg, ${theme.amber}33, ${theme.amber}66)`,
              border:`1px solid ${theme.amber}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:16 }}>🍽️</div>
            <span style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:18, color:theme.text, letterSpacing:"-0.3px" }}>Lunch Orders</span>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontSize:11, color:status==="live"?theme.green:status==="error"?theme.red:"#f59e0b",
              display:"flex", alignItems:"center", gap:5, animation:status==="connecting"?"pulse 1.2s infinite":"none" }}>
              <span style={{ width:6, height:6, borderRadius:"50%", background:"currentColor", display:"inline-block" }}/>
              {status==="live"?"En direct":status==="error"?"Erreur":"Connexion…"}
            </span>
            <button onClick={toggleTheme} style={{ ...glassCard(theme), padding:"6px 10px", fontSize:14, cursor:"pointer", color:theme.text, border:`1px solid ${theme.border}` }}>
              {isDark?"☀️":"🌙"}
            </button>
            <div style={{ ...glassCard(theme), padding:"5px 12px", display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ width:24, height:24, borderRadius:6, background:theme.amberGlow,
                border:`1px solid ${theme.amber}44`, display:"flex", alignItems:"center", justifyContent:"center",
                fontSize:11, fontWeight:700, color:theme.amber }}>{user[0].toUpperCase()}</div>
              <span style={{ fontSize:13, color:theme.textSub }}>{user}</span>
            </div>
            <button style={{ background:"transparent", border:`1px solid ${theme.border}`, color:theme.textSub,
              borderRadius:8, padding:"6px 14px", fontSize:12, cursor:"pointer" }}
              onClick={()=>setUser(null)}>Déconnexion</button>
          </div>
        </div>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"0 20px", display:"flex", gap:2, overflowX:"auto" }}>
          {[["order","📋","Commander"],["summary","📊","Résumé"],["favorites","⭐","Favoris"],["history","📅","Historique"],["settings","⚙️","Config"]].map(([id,icon,label])=>(
            <button key={id} className="tab-btn"
              style={{ background:"transparent", border:"none", color:tab===id?theme.textAccent:theme.textSub,
                padding:"10px 16px", fontSize:13, fontWeight:tab===id?600:400, cursor:"pointer",
                borderBottom: tab===id?`2px solid ${theme.amber}`:"2px solid transparent",
                fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s", whiteSpace:"nowrap",
                display:"flex", alignItems:"center", gap:5 }}
              onClick={()=>setTab(id)}>{icon} {label}</button>
          ))}
        </div>
      </header>

      <main style={{ maxWidth:1200, margin:"0 auto", padding: isMobile?"16px 12px":"28px 24px" }}>

        {/* ════ ORDER TAB ════ */}
        {tab==="order" && (
          <div style={{ animation:"slideDown 0.3s ease" }}>

            {/* Quick favorites */}
            {user!=="Admin" && (favorites[user]||[]).length>0 && (
              <div style={{ marginBottom:24 }}>
                <p style={{ fontSize:12, color:theme.textSub, marginBottom:10, display:"flex", alignItems:"center", gap:6 }}>
                  <span style={{ color:theme.amber }}>⭐</span> Commande rapide
                </p>
                <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
                  {(favorites[user]||[]).map(fav=>{
                    const {id:favId,name:favName,...favOrder}=fav;
                    const opt=LUNCH_OPTIONS.find(o=>o.id===favOrder.choice);
                    const isActive=orders[user]?.choice===favOrder.choice&&formatOrder(orders[user],extras,crudites)===formatOrder(favOrder,extras,crudites);
                    return (
                      <button key={favId} className="pill-btn"
                        onClick={async()=>{ if(isActive){await deleteDoc(doc(db,"orders",user));}else{await setDoc(doc(db,"orders",user),{...favOrder});} }}
                        style={{ ...glassCard(theme), padding:"10px 16px", cursor:"pointer", textAlign:"left",
                          border:`1px solid ${isActive?opt?.accent:theme.border}`,
                          boxShadow: isActive?`0 0 20px ${opt?.glow}`:undefined,
                          background: isActive?opt?.glow:theme.bgCard,
                          minWidth: isMobile?"calc(50% - 5px)":180, flex:isMobile?"1":"0 1 auto",
                          display:"flex", flexDirection:"column", gap:3, transition:"all 0.2s" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:6, justifyContent:"space-between" }}>
                          <span style={{ fontSize:11, fontWeight:600, color:opt?.accent }}>{opt?.label}</span>
                          {isActive && <span style={{ fontSize:9, background:opt?.accent+"22", color:opt?.accent, padding:"1px 6px", borderRadius:10 }}>✓ Actif</span>}
                        </div>
                        <div style={{ fontSize:12, fontWeight:500, color:theme.text }}>{favName}</div>
                        <div style={{ fontSize:11, color:isActive?theme.red:opt?.accent, marginTop:1 }}>
                          {isActive?"Cliquer pour effacer ✕":"Cliquer pour commander →"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Table header */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <h2 style={secTitle}>
                Commandes du jour
                <span style={badge}>{totalOrdered} / {names.length}</span>
              </h2>
              {user==="Admin" && (
                <button onClick={()=>setViewMode(v=>v==="accordion"?"columns":"accordion")}
                  style={{ ...glassCard(theme), padding:"6px 14px", fontSize:12, cursor:"pointer",
                    color:theme.textAccent, border:`1px solid ${theme.amber}44`, display:"flex", alignItems:"center", gap:6 }}>
                  {viewMode==="accordion"?"⊞ Vue colonnes":"☰ Vue accordéon"}
                </button>
              )}
            </div>

            {/* ── VIEW A: Accordion (default for everyone) ── */}
            {viewMode==="accordion" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                {names.map((name,idx)=>{
                  const order=orders[name]||{};
                  const chosen=LUNCH_OPTIONS.find(o=>o.id===order.choice);
                  const canEdit=user===name||user==="Admin";
                  const isMe=user===name;
                  const isOpen=isMe || (order.choice && canEdit);
                  return (
                    <div key={name} style={{ ...glassCard(theme),
                      border:`1px solid ${isMe&&chosen?chosen.accent:isMe?theme.amber:chosen?chosen.accent+"44":theme.border}`,
                      boxShadow:isMe?`0 0 24px ${chosen?chosen.glow:theme.amberGlow}`:chosen?`0 0 12px ${chosen.glow}`:"none",
                      overflow:"hidden", transition:"all 0.2s" }}>

                      {/* Row header — always visible */}
                      <div style={{ padding:"12px 16px", display:"flex", alignItems:"center", gap:12,
                        background: isMe?theme.amberGlow:"transparent",
                        borderBottom: order.choice?`1px solid ${theme.borderSub}`:"none" }}>

                        {/* Number + avatar */}
                        <span style={{ fontSize:12, fontWeight:700, color:theme.textFaint, minWidth:20, textAlign:"right" }}>{idx+1}</span>
                        <div style={{ width:34, height:34, borderRadius:10, flexShrink:0,
                          background:chosen?chosen.glow:theme.bgInput,
                          border:`1px solid ${chosen?chosen.accent:theme.border}`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:13, fontWeight:700, color:chosen?chosen.accent:theme.textSub }}>
                          {name[0].toUpperCase()}
                        </div>

                        {/* Name */}
                        <div style={{ flex:1 }}>
                          <span style={{ fontSize:14, fontWeight:isMe?700:500, color:isMe?theme.amber:theme.text }}>{name}</span>
                          {isMe && <span style={{ marginLeft:6, fontSize:9, color:theme.textFaint, background:theme.bgInput, padding:"1px 6px", borderRadius:10 }}>toi</span>}
                          {chosen && !isOpen && (
                            <div style={{ display:"flex", gap:4, marginTop:3, flexWrap:"wrap" }}>
                              <OrderPills order={order}/>
                            </div>
                          )}
                        </div>

                        {/* Choice buttons (compact) */}
                        {canEdit && (
                          <div style={{ display:"flex", gap:6 }}>
                            {LUNCH_OPTIONS.map(opt=>(
                              <button key={opt.id} className="pill-btn"
                                onClick={()=>toggleChoice(name,opt.id)}
                                style={{ padding:"5px 10px", borderRadius:8, fontSize:11, fontWeight:600,
                                  border:`1px solid ${order.choice===opt.id?opt.accent:theme.border}`,
                                  background:order.choice===opt.id?opt.glow:theme.bgInput,
                                  color:order.choice===opt.id?opt.accent:theme.textSub,
                                  cursor:"pointer", transition:"all 0.15s",
                                  boxShadow:order.choice===opt.id?`0 0 10px ${opt.glow}`:undefined }}>
                                {isMobile ? opt.label.split(" ")[0] : opt.label}
                              </button>
                            ))}
                          </div>
                        )}
                        {!canEdit && chosen && (
                          <span style={{ fontSize:12, color:chosen.accent, fontWeight:500 }}>{chosen.label}</span>
                        )}
                        {user==="Admin" && (
                          <button style={{ background:"transparent", border:"none", color:theme.textFaint, fontSize:15, cursor:"pointer", padding:4, flexShrink:0 }}
                            onClick={()=>removeMember(name)}>✕</button>
                        )}
                      </div>

                      {/* Expanded details */}
                      {order.choice && (
                        <div style={{ padding:"14px 16px 14px 66px" }}>
                          <DetailCell name={name} order={order} canEdit={canEdit}
                            mealExtras={extrasForMeal(order.choice)} {...detailCellProps}/>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* ── VIEW C: 3 columns (admin only) ── */}
            {viewMode==="columns" && user==="Admin" && (
              <div style={{ display:"flex", gap:16, alignItems:"flex-start" }}>
                {LUNCH_OPTIONS.map(opt=>{
                  const people=names.filter(n=>orders[n]?.choice===opt.id);
                  const none=names.filter(n=>!orders[n]?.choice);
                  return (
                    <div key={opt.id} style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
                      {/* Column header */}
                      <div style={{ ...glassCard(theme), padding:"12px 16px", textAlign:"center",
                        border:`1px solid ${opt.accent}55`,
                        background:opt.glow, boxShadow:`0 0 20px ${opt.glow}` }}>
                        <div style={{ fontSize:24, marginBottom:4 }}>{opt.label.split(" ")[0]}</div>
                        <div style={{ fontSize:13, fontWeight:700, color:opt.accent, fontFamily:"'Syne',sans-serif" }}>{opt.label.slice(3)}</div>
                        <div style={{ fontSize:11, color:theme.textSub, marginTop:2 }}>{people.length} commande{people.length!==1?"s":""}</div>
                      </div>
                      {/* People in this column */}
                      {people.map((name,idx)=>{
                        const order=orders[name]||{};
                        return (
                          <div key={name} style={{ ...glassCard(theme), padding:"12px 14px",
                            border:`1px solid ${opt.accent}33` }}>
                            <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
                              <div style={{ width:28, height:28, borderRadius:8, background:opt.glow,
                                border:`1px solid ${opt.accent}44`, display:"flex", alignItems:"center",
                                justifyContent:"center", fontSize:11, fontWeight:700, color:opt.accent }}>
                                {name[0].toUpperCase()}
                              </div>
                              <span style={{ fontSize:13, fontWeight:600, color:theme.text, flex:1 }}>{name}</span>
                              <span style={{ fontSize:11, color:theme.textFaint }}>#{idx+1}</span>
                            </div>
                            <OrderPills order={order}/>
                          </div>
                        );
                      })}
                      {/* Drop zone if empty */}
                      {people.length===0 && (
                        <div style={{ ...glassCard(theme), padding:"20px", textAlign:"center",
                          color:theme.textFaint, fontSize:12, border:`1px dashed ${opt.accent}22` }}>
                          Personne ici
                        </div>
                      )}
                    </div>
                  );
                })}
                {/* Not ordered column */}
                <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
                  <div style={{ ...glassCard(theme), padding:"12px 16px", textAlign:"center",
                    border:`1px solid ${theme.border}` }}>
                    <div style={{ fontSize:24, marginBottom:4 }}>⏳</div>
                    <div style={{ fontSize:13, fontWeight:700, color:theme.textSub, fontFamily:"'Syne',sans-serif" }}>En attente</div>
                    <div style={{ fontSize:11, color:theme.textFaint, marginTop:2 }}>{names.filter(n=>!orders[n]?.choice).length} personne{names.filter(n=>!orders[n]?.choice).length!==1?"s":""}</div>
                  </div>
                  {names.filter(n=>!orders[n]?.choice).map(name=>(
                    <div key={name} style={{ ...glassCard(theme), padding:"10px 14px",
                      display:"flex", alignItems:"center", gap:8 }}>
                      <div style={{ width:28, height:28, borderRadius:8, background:theme.bgInput,
                        border:`1px solid ${theme.border}`, display:"flex", alignItems:"center",
                        justifyContent:"center", fontSize:11, fontWeight:700, color:theme.textFaint }}>
                        {name[0].toUpperCase()}
                      </div>
                      <span style={{ fontSize:13, color:theme.textSub }}>{name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════ SUMMARY TAB ════ */}
        {tab==="summary" && (
          <div style={{ animation:"slideDown 0.3s ease" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
              <h2 style={secTitle}>Résumé des commandes</h2>
              <button style={{ ...glassCard(theme), padding:"8px 16px", color:theme.red,
                border:`1px solid ${theme.red}33`, cursor:"pointer", fontSize:13, display:"flex", alignItems:"center", gap:6 }}
                onClick={resetAll}>🗑 Réinitialiser</button>
            </div>

            {/* Count cards */}
            <div style={{ display:"flex", gap:12, marginBottom:24, flexWrap:"wrap" }}>
              {LUNCH_OPTIONS.map(opt=>(
                <div key={opt.id} style={{ ...glassCard(theme), flex:1, minWidth:130, padding:"20px 24px", textAlign:"center",
                  border:`1px solid ${counts[opt.id]>0?opt.accent:theme.border}`,
                  boxShadow:counts[opt.id]>0?`0 0 30px ${opt.glow}`:undefined }}>
                  <div style={{ fontSize:44, fontWeight:800, fontFamily:"'Syne',sans-serif", color:counts[opt.id]>0?opt.accent:theme.textFaint, lineHeight:1 }}>{counts[opt.id]}</div>
                  <div style={{ fontSize:13, color:theme.textSub, marginTop:6 }}>{opt.label}</div>
                </div>
              ))}
            </div>

            {/* Order groups */}
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {LUNCH_OPTIONS.map(opt=>{
                const people=names.filter(n=>orders[n]?.choice===opt.id);
                if(!people.length)return null;
                const paidCount=people.filter(n=>payments[n]).length;
                return (
                  <div key={opt.id} style={{ ...glassCard(theme), border:`1px solid ${opt.accent}44`, overflow:"hidden" }}>
                    <div style={{ padding:"12px 20px", background:opt.glow, borderBottom:`1px solid ${opt.accent}33`,
                      display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <h3 style={{ fontSize:14, fontWeight:700, color:opt.accent, fontFamily:"'Syne',sans-serif" }}>{opt.label}</h3>
                      <span style={{ fontSize:12, color:paidCount===people.length?"#22c55e":theme.textSub }}>
                        💰 {paidCount}/{people.length} payé{paidCount>1?"s":""}
                      </span>
                    </div>
                    {people.map((name,idx)=>{
                      const paid=payments[name]||false;
                      return (
                        <div key={name} style={{ padding:"10px 20px", borderBottom:`1px solid ${theme.borderSub}`,
                          opacity:paid?0.5:1, transition:"opacity 0.2s", display:"flex", flexDirection:"column", gap:6 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                            <span style={{ fontSize:11, fontWeight:700, color:theme.textFaint, minWidth:20, textAlign:"right" }}>{idx+1}.</span>
                            <span style={{ fontSize:13, fontWeight:600, color:theme.text, flex:1, textDecoration:paid?"line-through":"none" }}>{name}</span>
                            <button onClick={()=>togglePayment(name)}
                              style={{ background:paid?`${theme.green}22`:"transparent",
                                border:`1px solid ${paid?theme.green:theme.border}33`,
                                borderRadius:8, padding:"3px 10px", fontSize:11, cursor:"pointer",
                                color:paid?theme.green:theme.textSub, whiteSpace:"nowrap", transition:"all 0.2s" }}>
                              {paid?"✓ Payé":"À payer"}
                            </button>
                            {name===user && (
                              <button style={{ ...glassCard(theme), padding:"3px 10px", fontSize:11, cursor:"pointer",
                                color:theme.textSub, border:`1px solid ${theme.border}`, whiteSpace:"nowrap" }}
                                onClick={()=>setShowFavModal(true)}>⭐ Sauvegarder</button>
                            )}
                          </div>
                          <div style={{ paddingLeft:30 }}>
                            <OrderPills order={orders[name]}/>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {totalOrdered===0 && (
                <div style={{ ...glassCard(theme), padding:"60px 24px", textAlign:"center", color:theme.textFaint }}>
                  <div style={{ fontSize:36, marginBottom:12 }}>🍽️</div>
                  <p>Aucune commande pour l'instant.</p>
                </div>
              )}
            </div>

            {notOrdered.length>0 && (
              <div style={{ ...glassCard(theme), padding:"14px 18px", marginTop:16,
                display:"flex", flexWrap:"wrap", gap:8, alignItems:"center" }}>
                <span style={{ color:theme.textSub, fontSize:13 }}>⏳ Pas encore commandé :</span>
                {notOrdered.map(n=>(
                  <span key={n} style={{ background:theme.bgInput, border:`1px solid ${theme.border}`,
                    color:theme.textSub, fontSize:12, padding:"3px 10px", borderRadius:20 }}>{n}</span>
                ))}
              </div>
            )}

            {/* Save modal */}
            {showFavModal && (
              <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.6)", backdropFilter:"blur(4px)",
                display:"flex", alignItems:"center", justifyContent:"center", zIndex:999 }}
                onClick={e=>e.target===e.currentTarget&&setShowFavModal(false)}>
                <div style={{ ...glassCard(theme), padding:"28px", width:340, boxShadow:`0 32px 80px rgba(0,0,0,0.5), 0 0 40px ${theme.amberGlow}` }}>
                  <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, color:theme.text, marginBottom:6 }}>⭐ Sauvegarder</h3>
                  <p style={{ fontSize:13, color:theme.textSub, marginBottom:16 }}>Donne un nom à cette commande.</p>
                  <input autoFocus style={{ ...inp, marginBottom:12 }} value={favNameInput}
                    onChange={e=>setFavNameInput(e.target.value)}
                    onKeyDown={e=>e.key==="Enter"&&saveFavorite(user)}
                    placeholder="ex: Durum falafel habituel…"/>
                  <div style={{ display:"flex", gap:8 }}>
                    <button style={{ ...addBtn, flex:1 }} onClick={()=>saveFavorite(user)}>Sauvegarder</button>
                    <button style={{ background:"transparent", border:`1px solid ${theme.border}`, color:theme.textSub, borderRadius:10, padding:"10px 16px", fontSize:13, cursor:"pointer" }}
                      onClick={()=>setShowFavModal(false)}>Annuler</button>
                  </div>
                </div>
              </div>
            )}

            {savedMsg && (
              <div style={{ position:"fixed", bottom:32, left:"50%", transform:"translateX(-50%)",
                ...glassCard(theme), border:`1px solid ${theme.amber}44`, color:theme.amber,
                padding:"12px 24px", fontSize:14, animation:"toastIn 0.3s ease", zIndex:999,
                boxShadow:`0 8px 32px ${theme.amberGlow}` }}>
                ⭐ Commande sauvegardée !
              </div>
            )}
          </div>
        )}

        {/* ════ FAVORITES TAB ════ */}
        {tab==="favorites" && (
          <div style={{ animation:"slideDown 0.3s ease" }}>
            <h2 style={secTitle}>⭐ Commandes favorites</h2>
            {user!=="Admin" && (
              (favorites[user]||[]).length===0 ? (
                <div style={{ ...glassCard(theme), padding:"60px 24px", textAlign:"center", color:theme.textFaint }}>
                  <div style={{ fontSize:36, marginBottom:12 }}>⭐</div>
                  <p>Pas encore de favori.</p>
                  <p style={{ fontSize:13, marginTop:8, color:theme.textFaint }}>Dans le Résumé, clique sur "⭐ Sauvegarder".</p>
                </div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {(favorites[user]||[]).map(fav=>{
                    const {id:favId,name:favName,...favOrder}=fav;
                    const opt=LUNCH_OPTIONS.find(o=>o.id===favOrder.choice);
                    const isActive=orders[user]?.choice===favOrder.choice&&formatOrder(orders[user],extras,crudites)===formatOrder(favOrder,extras,crudites);
                    return (
                      <div key={favId} style={{ ...glassCard(theme),
                        border:`1px solid ${isActive?opt?.accent:theme.border}`,
                        boxShadow:isActive?`0 0 24px ${opt?.glow}`:undefined, padding:"20px" }}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                            <span style={{ fontSize:14, fontWeight:700, color:theme.text }}>{favName}</span>
                            <span style={{ fontSize:11, color:opt?.accent }}>{opt?.label}</span>
                            {isActive && <span style={{ fontSize:9, background:opt?.accent+"22", color:opt?.accent, padding:"1px 8px", borderRadius:10 }}>✓ Actif</span>}
                          </div>
                          <button style={{ background:"transparent", border:"none", color:theme.red, cursor:"pointer", fontSize:15, padding:4 }}
                            onClick={async()=>{if(window.confirm(`Supprimer "${favName}" ?`))await deleteFavorite(user,favId);}}>🗑</button>
                        </div>
                        <div style={{ marginBottom:14 }}>
                          <OrderPills order={favOrder}/>
                        </div>
                        <button className="pill-btn"
                          style={{ width:"100%", padding:"10px", borderRadius:10, fontSize:13, cursor:"pointer",
                            background:isActive?`${theme.red}11`:opt?.glow,
                            border:`1px solid ${isActive?`${theme.red}44`:opt?.accent+"44"}`,
                            color:isActive?theme.red:opt?.accent, fontWeight:600 }}
                          onClick={async()=>{ if(isActive){await deleteDoc(doc(db,"orders",user));}else{await setDoc(doc(db,"orders",user),{...favOrder});setTab("order");} }}>
                          {isActive?"✕ Effacer ma commande":"↩ Commander ça maintenant"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            )}
            {user==="Admin" && (
              Object.keys(favorites).length===0 ? (
                <div style={{ ...glassCard(theme), padding:"48px", textAlign:"center", color:theme.textFaint }}>Aucun favori enregistré.</div>
              ) : (
                <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
                  {Object.entries(favorites).map(([username,favList])=>{
                    if(!favList?.length)return null;
                    return (
                      <div key={username} style={{ ...glassCard(theme), padding:"16px 20px" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:12 }}>
                          <div style={{ width:28, height:28, borderRadius:6, background:theme.amberGlow, border:`1px solid ${theme.amber}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:theme.amber }}>{username[0].toUpperCase()}</div>
                          <span style={{ fontSize:14, fontWeight:600, color:theme.text }}>{username}</span>
                          <span style={{ fontSize:12, color:theme.textSub }}>{favList.length} favori{favList.length>1?"s":""}</span>
                        </div>
                        {favList.map(fav=>{
                          const {id:favId,name:favName,...favOrder}=fav;
                          const opt=LUNCH_OPTIONS.find(o=>o.id===favOrder.choice);
                          return (
                            <div key={favId} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"8px 0", borderBottom:`1px solid ${theme.borderSub}` }}>
                              <span style={{ fontSize:11, color:opt?.accent, marginTop:2 }}>●</span>
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:13, fontWeight:600, color:theme.text, marginBottom:4 }}>{favName}</div>
                                <OrderPills order={favOrder}/>
                              </div>
                              <button style={{ background:"transparent", border:"none", color:theme.textFaint, cursor:"pointer", fontSize:14 }}
                                onClick={async()=>{if(window.confirm(`Supprimer "${favName}" de ${username} ?`))await deleteFavorite(username,favId);}}>🗑</button>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        )}

        {/* ════ HISTORY TAB ════ */}
        {tab==="history" && (
          <div style={{ animation:"slideDown 0.3s ease" }}>
            <h2 style={secTitle}>📅 Historique</h2>
            {history.length===0 && (
              <div style={{ ...glassCard(theme), padding:"60px 24px", textAlign:"center", color:theme.textFaint }}>
                <div style={{ fontSize:36, marginBottom:12 }}>📅</div>
                <p>Aucun historique pour l'instant.</p>
              </div>
            )}
            {history.map(day=>{
              const visibleOrders=user==="Admin"?Object.entries(day.orders||{}):Object.entries(day.orders||{}).filter(([n])=>n===user);
              if(!visibleOrders.length)return null;
              const isOpen = openHistory[day.id] || false;
              const toggle = () => setOpenHistory(prev=>({...prev,[day.id]:!prev[day.id]}));
              return (
                <div key={day.id} style={{ ...glassCard(theme), marginBottom:10, overflow:"hidden" }}>
                  {/* Header — always visible, click to expand */}
                  <div onClick={toggle} style={{ padding:"14px 20px", display:"flex", alignItems:"center",
                    justifyContent:"space-between", cursor:"pointer",
                    background: isOpen ? theme.bgSection : "transparent",
                    borderBottom: isOpen ? `1px solid ${theme.border}` : "none",
                    transition:"background 0.2s" }}>
                    <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                      <span style={{ fontSize:18, transition:"transform 0.2s", display:"inline-block",
                        transform: isOpen ? "rotate(90deg)" : "rotate(0deg)" }}>›</span>
                      <div>
                        <h3 style={{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:14, color:theme.text }}>
                          📆 {new Date(day.date||day.id).toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
                        </h3>
                        {!isOpen && (
                          <p style={{ fontSize:12, color:theme.textSub, marginTop:2 }}>
                            {visibleOrders.length} commande{visibleOrders.length>1?"s":""} · {LUNCH_OPTIONS.filter(opt=>visibleOrders.some(([,o])=>o.choice===opt.id)).map(o=>o.label).join(", ")}
                          </p>
                        )}
                      </div>
                    </div>
                    <div style={{ display:"flex", gap:8, alignItems:"center" }} onClick={e=>e.stopPropagation()}>
                      <span style={{ ...badge }}>{visibleOrders.length} commande{visibleOrders.length>1?"s":""}</span>
                      {user==="Admin" && (
                        <>
                          <button style={{ background:`${theme.green}11`, border:`1px solid ${theme.green}33`, color:theme.green, borderRadius:8, padding:"4px 10px", fontSize:12, cursor:"pointer" }}
                            onClick={async()=>{ if(!window.confirm("Restaurer ces commandes comme commandes du jour ?"))return;
                              await Promise.all(Object.entries(day.orders||{}).map(([name,order])=>setDoc(doc(db,"orders",name),order)));
                              if(day.payments)await setDoc(doc(db,"payments","today"),day.payments);
                            }}>↩ Restaurer</button>
                          <button style={{ background:`${theme.red}11`, border:`1px solid ${theme.red}33`, color:theme.red, borderRadius:8, padding:"4px 10px", fontSize:12, cursor:"pointer" }}
                            onClick={()=>deleteHistory(day.id)}>🗑</button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Content — only when open */}
                  {isOpen && (
                    <div>
                      {LUNCH_OPTIONS.map(opt=>{
                        const people=visibleOrders.filter(([,o])=>o.choice===opt.id);
                        if(!people.length)return null;
                        return (
                          <div key={opt.id} style={{ padding:"12px 20px", borderBottom:`1px solid ${theme.borderSub}` }}>
                            <div style={{ fontSize:12, fontWeight:600, color:opt.accent, marginBottom:8 }}>{opt.label}</div>
                            {people.map(([name,o],idx)=>{
                              const paid=(day.payments||{})[name]||false;
                              return (
                                <div key={name} style={{ display:"flex", gap:10, alignItems:"flex-start", padding:"6px 0", borderBottom:`1px solid ${theme.borderSub}` }}>
                                  <span style={{ fontSize:11, fontWeight:700, color:theme.textFaint, minWidth:20, textAlign:"right", marginTop:2 }}>{idx+1}.</span>
                                  <div style={{ flex:1 }}>
                                    <span style={{ fontSize:13, fontWeight:600, color:theme.text, textDecoration:paid?"line-through":"none", marginRight:8 }}>{name}</span>
                                    <div style={{ marginTop:4 }}><OrderPills order={o}/></div>
                                  </div>
                                  <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, flexShrink:0,
                                    background:paid?`${theme.green}22`:`${theme.red}11`,
                                    color:paid?theme.green:theme.textFaint }}>
                                    {paid?"✓ Payé":"Non payé"}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ════ CONFIG TAB ════ */}
        {tab==="settings" && (
          <div style={{ animation:"slideDown 0.3s ease" }}>
            {user!=="Admin" ? (
              <div style={{ ...glassCard(theme), padding:"60px 24px", textAlign:"center", color:theme.textFaint }}>
                <div style={{ fontSize:36, marginBottom:12 }}>🔒</div>
                <p>Réservé à l'Admin</p>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:32 }}>

                {/* Membres */}
                <div>
                  <h2 style={secTitle}>👥 Membres</h2>
                  <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
                    <input style={{ ...inp, flex:2, minWidth:140 }} value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} placeholder="Nom…"/>
                    <input style={{ ...inp, flex:1, minWidth:100 }} value={newMemberCode} onChange={e=>setNewMemberCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMember()} placeholder="Code…"/>
                    <button style={addBtn} onClick={addMember}>+ Ajouter</button>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
                    {members.map(m=>(
                      <div key={m.username} style={{ ...glassCard(theme), padding:"10px 16px" }}>
                        {editingMember?.username===m.username ? (
                          <div style={{ display:"flex", gap:10, alignItems:"center", flexWrap:"wrap" }}>
                            <input style={{ ...inp, flex:2, minWidth:120, padding:"6px 12px", fontSize:13 }} value={editingMember.username} onChange={e=>setEditingMember({...editingMember,username:e.target.value})}/>
                            <input style={{ ...inp, flex:1, minWidth:80, padding:"6px 12px", fontSize:13 }} value={editingMember.code} onChange={e=>setEditingMember({...editingMember,code:e.target.value})}/>
                            <button style={{ ...addBtn, padding:"6px 14px", fontSize:13, background:`linear-gradient(135deg, ${theme.green}, #16a34a)` }} onClick={saveEdit}>✓ Sauver</button>
                            <button style={{ background:"transparent", border:`1px solid ${theme.border}`, color:theme.textSub, borderRadius:8, padding:"6px 12px", fontSize:13, cursor:"pointer" }} onClick={()=>setEditingMember(null)}>Annuler</button>
                          </div>
                        ) : (
                          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                              <div style={{ width:32, height:32, borderRadius:8, background:theme.amberGlow, border:`1px solid ${theme.amber}44`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:700, color:theme.amber }}>{m.username[0].toUpperCase()}</div>
                              <div>
                                <span style={{ fontSize:14, fontWeight:500, color:theme.text }}>{m.username}</span>
                                <span style={{ marginLeft:10, fontSize:12, color:theme.textSub, background:theme.bgInput, border:`1px solid ${theme.border}`, padding:"1px 8px", borderRadius:20 }}>code : {m.code}</span>
                              </div>
                            </div>
                            <div style={{ display:"flex", gap:8 }}>
                              <button style={{ background:"transparent", border:`1px solid ${theme.border}`, color:theme.textSub, borderRadius:8, padding:"4px 10px", fontSize:12, cursor:"pointer" }} onClick={()=>setEditingMember({...m})}>✏️</button>
                              <button style={{ background:"transparent", border:"none", color:theme.red, cursor:"pointer", fontSize:16, padding:4 }} onClick={()=>removeMember(m.username)}>✕</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sauces */}
                {[
                  { label:"🥫 Sauces", items:sauces, newVal:newSauce, setNew:setNewSauce, add:addSauce, remove:removeSauce, accent:"#c084fc" },
                  { label:"🥗 Crudités", items:crudites, newVal:newCrudite, setNew:setNewCrudite, add:addCrudite, remove:removeCrudite, accent:"#34d399" },
                  { label:"🥤 Boissons", items:boissons, newVal:newBoisson, setNew:setNewBoisson, add:addBoisson, remove:removeBoisson, accent:"#38bdf8" },
                ].map(({label,items,newVal,setNew,add,remove,accent})=>(
                  <div key={label}>
                    <h2 style={secTitle}>{label}</h2>
                    <div style={{ display:"flex", gap:10, marginBottom:14 }}>
                      <input style={{ ...inp, flex:1 }} value={newVal} onChange={e=>setNew(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder={`Nouveau(elle)…`}/>
                      <button style={addBtn} onClick={add}>+ Ajouter</button>
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                      {items.map(item=>(
                        <div key={item} style={{ ...glassCard(theme), borderRadius:20, padding:"5px 12px", display:"flex", alignItems:"center", gap:6,
                          border:`1px solid ${accent}33` }}>
                          <span style={{ fontSize:13, color:theme.text }}>{item}</span>
                          <button style={{ background:"none", border:"none", color:theme.red, cursor:"pointer", fontSize:13 }} onClick={()=>remove(item)}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}

                {/* Extras */}
                <div>
                  <h2 style={secTitle}>➕ Catégories personnalisées</h2>
                  <div style={{ ...glassCard(theme), padding:"16px 20px", marginBottom:16 }}>
                    <p style={{ fontSize:13, color:theme.textSub, marginBottom:12 }}>Nouvelle catégorie</p>
                    <input style={{ ...inp, marginBottom:10 }} value={newExtraLabel} onChange={e=>setNewExtraLabel(e.target.value)} placeholder="Nom (ex: Toppings, Dips…)"/>
                    <div style={{ marginBottom:10 }}>
                      <p style={{ fontSize:12, color:theme.textSub, marginBottom:6 }}>Applicable à :</p>
                      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                        {LUNCH_OPTIONS.map(opt=>(
                          <button key={opt.id} className="pill-btn" onClick={()=>toggleExtraApplies(opt.id)}
                            style={P(opt.accent,newExtraApplies.includes(opt.id),false)}>{opt.label}</button>
                        ))}
                      </div>
                    </div>
                    <button style={{ ...addBtn, opacity:newExtraLabel&&newExtraApplies.length?1:0.5 }} onClick={addExtraCategory}>+ Créer</button>
                  </div>
                  {extras.map(ex=>(
                    <div key={ex.id} style={{ ...glassCard(theme), borderLeft:`3px solid ${ex.accent}`, padding:"16px 20px", marginBottom:10 }}>
                      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:10 }}>
                        <div>
                          <span style={{ fontSize:14, fontWeight:700, color:theme.text }}>{ex.label}</span>
                          <span style={{ marginLeft:10, fontSize:12, color:theme.textSub }}>→ {ex.appliesTo.map(id=>LUNCH_OPTIONS.find(o=>o.id===id)?.label).join(", ")}</span>
                        </div>
                        <button style={{ background:`${theme.red}11`, border:`1px solid ${theme.red}33`, color:theme.red, borderRadius:8, padding:"4px 10px", fontSize:12, cursor:"pointer" }}
                          onClick={()=>removeExtraCategory(ex.id)}>🗑 Supprimer</button>
                      </div>
                      <div style={{ display:"flex", flexWrap:"wrap", gap:6, marginBottom:10 }}>
                        {ex.options.map(o=>(
                          <div key={o} style={{ ...glassCard(theme), borderRadius:20, padding:"4px 12px", display:"flex", alignItems:"center", gap:4, border:`1px solid ${ex.accent}33` }}>
                            <span style={{ fontSize:12, color:theme.text }}>{o}</span>
                            <button style={{ background:"none", border:"none", color:theme.red, cursor:"pointer", fontSize:12 }} onClick={()=>removeExtraOption(ex.id,o)}>✕</button>
                          </div>
                        ))}
                      </div>
                      <div style={{ display:"flex", gap:8 }}>
                        <input style={{ ...inp, flex:1, padding:"6px 12px", fontSize:13 }} value={newExtraOption[ex.id]||""}
                          onChange={e=>setNewExtraOption(prev=>({...prev,[ex.id]:e.target.value}))}
                          onKeyDown={e=>e.key==="Enter"&&addExtraOption(ex.id)}
                          placeholder={`Nouvelle option…`}/>
                        <button style={{ ...addBtn, padding:"6px 14px", fontSize:13 }} onClick={()=>addExtraOption(ex.id)}>+ Ajouter</button>
                      </div>
                    </div>
                  ))}
                </div>

              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}