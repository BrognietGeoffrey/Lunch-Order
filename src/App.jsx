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
const EXTRA_ACCENTS    = ["#9b7fa6","#c97a4a","#5a8f7b","#7a9ab5","#b5836a","#6b8f6b"];

const LUNCH_OPTIONS = [
  { id: "ice-cream",    label: "Ice Cream",    emoji:"🍦", accent: "#c97a8f", bg:"#fdf0f3" },
  { id: "snack-merode", label: "Snack Merode", emoji:"🥪", accent: "#c97a4a", bg:"#fdf5f0" },
  { id: "libanais",     label: "Libanais",     emoji:"🥙", accent: "#5a8f7b", bg:"#f0fdf8" },
];

// ── Themes ────────────────────────────────────────────────────────────────────
const LIGHT = {
  isDark: false,
  sidebar:      "#c4a882",
  sidebarBg:    "#d4b896",
  sidebarText:  "rgba(255,252,245,0.7)",
  sidebarActive:"#ffffff",
  sidebarHover: "rgba(255,252,245,0.15)",
  sidebarBorder:"rgba(255,252,245,0.12)",
  bg:          "#f5f0e8",
  bgCard:      "#ffffff",
  bgHover:     "#faf7f2",
  bgInput:     "#faf7f2",
  bgTag:       "#f0ebe0",
  border:      "#e8e0d0",
  borderLight: "#f0ebe0",
  text:        "#2c1f0e",
  textSub:     "#8a7560",
  textFaint:   "#bba88a",
  accent:      "#9b6a3a",
  accentLight: "#f5e8d5",
  green:       "#5a8f7b",
  red:         "#c0553a",
  shadow:      "0 2px 16px rgba(44,31,14,0.08)",
  shadowHover: "0 4px 24px rgba(44,31,14,0.12)",
};
const DARK = {
  isDark: true,
  sidebar:      "#2a1f14",
  sidebarBg:    "#1e1610",
  sidebarText:  "rgba(245,239,230,0.5)",
  sidebarActive:"#f5efe6",
  sidebarHover: "rgba(245,239,230,0.06)",
  sidebarBorder:"rgba(245,239,230,0.08)",
  bg:          "#0f0c08",
  bgCard:      "#1c1610",
  bgHover:     "#231c14",
  bgInput:     "#231c14",
  bgTag:       "#2a2018",
  border:      "#3a2e20",
  borderLight: "#2a2018",
  text:        "#f5efe6",
  textSub:     "#8a7560",
  textFaint:   "#5a4a35",
  accent:      "#c8922a",
  accentLight: "#2a2010",
  green:       "#5a8f7b",
  red:         "#c0553a",
  shadow:      "0 2px 16px rgba(0,0,0,0.3)",
  shadowHover: "0 4px 24px rgba(0,0,0,0.4)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getInitials(name) { return name.split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2); }

function avatarColor(name) {
  const colors = ["#9b7fa6","#c97a4a","#5a8f7b","#7a9ab5","#b5836a","#8f7a5a","#c97a8f","#6b8f9b"];
  let h = 0; for (let c of name) h = (h*31+c.charCodeAt(0))%colors.length;
  return colors[Math.abs(h)];
}

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
      (o.extras||{})[ex.id]?.forEach(opt=>lines.push({ emoji:"➕", text: opt }));
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
      (o.extras||{})[ex.id]?.forEach(opt=>lines.push({ emoji:"➕", text: opt }));
    });
    if (o.boisson) lines.push({ emoji:"🥤", text: o.boisson });
  } else {
    if (o.detail)  lines.push({ emoji:"🥙", text: o.detail });
    extras.filter(ex=>ex.appliesTo?.includes("libanais")).forEach(ex=>{
      (o.extras||{})[ex.id]?.forEach(opt=>lines.push({ emoji:"➕", text: opt }));
    });
    if (o.boisson) lines.push({ emoji:"🥤", text: o.boisson });
  }
  return lines;
}

function formatOrder(o, extras=[], allCrudites=[]) {
  return formatOrderFull(o,extras,allCrudites).map(l=>l.text).join(" · ");
}

// ── Global CSS ────────────────────────────────────────────────────────────────
const CSS = (T) => `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: ${T.bg}; font-family: 'DM Sans', sans-serif; color: ${T.text}; }
  textarea { resize: vertical; font-family: inherit; }
  input:focus, textarea:focus, button:focus, select:focus { outline: none; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
  @keyframes fadeUp    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes shake     { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} }
  @keyframes slideIn   { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
  @keyframes toastIn   { from{opacity:0;transform:translateX(-50%) translateY(12px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
  .nav-item { transition: background 0.15s, color 0.15s; }
  .nav-item:hover { background: ${T.sidebarHover||"rgba(255,252,245,0.12)"} !important; color: #fff !important; }
  .nav-item.active { background: rgba(255,252,245,0.18) !important; color: #fff !important; }
  .row-hover:hover { background: ${T.bgHover} !important; }
  .btn-ghost:hover { background: ${T.bgTag} !important; }
`;

// ── Components ────────────────────────────────────────────────────────────────
function Avatar({ name, size=36 }) {
  const color = avatarColor(name);
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:color+"22",
      border:`2px solid ${color}44`, display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*0.35, fontWeight:700, color, flexShrink:0, letterSpacing:"-0.5px" }}>
      {getInitials(name)}
    </div>
  );
}

function Tag({ children, color, bg }) {
  return (
    <span style={{ background:bg||"#f0ebe0", color:color||"#8a7560",
      borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:500, whiteSpace:"nowrap" }}>
      {children}
    </span>
  );
}

function Pill({ label, active, accent, onClick, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ background:active?accent+"18":"transparent",
        border:`1px solid ${active?accent:"#e0d8cc"}`,
        borderRadius:20, padding:"4px 12px", fontSize:12, fontWeight:active?600:400,
        color:active?accent:"#8a7560", cursor:disabled?"not-allowed":"pointer",
        transition:"all 0.15s", whiteSpace:"nowrap", opacity:disabled?0.35:1 }}>
      {label}
    </button>
  );
}

function OrderPills({ order, extras=[], crudites=[] }) {
  const lines = formatOrderFull(order, extras, crudites);
  if (!lines.length) return <span style={{fontSize:12,color:"#bba88a",fontStyle:"italic"}}>Aucun détail</span>;
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
      {lines.map((line,i)=>(
        <span key={i} style={{background:"#f5f0e8",border:"1px solid #e8e0d0",borderRadius:20,
          padding:"2px 10px",fontSize:11,color:"#8a7560",display:"inline-flex",alignItems:"center",gap:3}}>
          {line.emoji} {line.text}
        </span>
      ))}
    </div>
  );
}

// ── Detail cell ───────────────────────────────────────────────────────────────
function DetailCell({ name, order, canEdit, sauces, crudites, boissons, extras, mealExtras,
  handleDetail, handleSubDetail, toggleMulti, toggleCruditesTout, toggleExtraOption,
  pb, ps, newBoissonInput, setNewBoissonInput, T }) {

  const sauceRef = useRef(null);
  const sauceFriteRef = useRef(null);

  if (!order.choice) return <span style={{fontSize:12,color:T.textFaint}}>{canEdit?"Choisis un plat d'abord…":"🔒"}</span>;

  const opt = LUNCH_OPTIONS.find(o=>o.id===order.choice);

  const BoissonSection = () => (
    <div>
      <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>🥤 Boisson</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:5}}>
        {boissons.map(b=>(
          <Pill key={b} label={b} active={order.boisson===b} accent="#7a9ab5"
            disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"boisson",order.boisson===b?"":b)}/>
        ))}
      </div>
      {canEdit && (
        <div style={{display:"flex",gap:5,marginTop:4}}>
          <input style={{flex:1,background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,
            color:T.text,padding:"4px 8px",fontSize:12}} value={newBoissonInput[name]||""}
            onChange={e=>setNewBoissonInput(p=>({...p,[name]:e.target.value}))}
            placeholder="Autre boisson…"/>
          {(newBoissonInput[name]||"").trim() && !boissons.includes((newBoissonInput[name]||"").trim()) && (
            <button onClick={async()=>{ const v=(newBoissonInput[name]||"").trim(); await handleSubDetail(name,"boisson",v); await pb([...boissons,v]); setNewBoissonInput(p=>({...p,[name]:""}));}}
              style={{background:T.accentLight,border:`1px solid ${T.border}`,borderRadius:8,
                padding:"4px 10px",fontSize:11,color:T.accent,cursor:"pointer",whiteSpace:"nowrap"}}>+ Sauvegarder</button>
          )}
        </div>
      )}
    </div>
  );

  if (order.choice==="ice-cream") return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div>
        <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>🍦 Boules</p>
        <div style={{display:"flex",gap:5}}>
          {["1 boule","2 boules"].map(o=><Pill key={o} label={o} active={order.boules===o} accent={opt.accent} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"boules",order.boules===o?"":o)}/>)}
        </div>
      </div>
      <div>
        <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>✨ Parfum(s)</p>
        <input style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,
          color:T.text,padding:"6px 10px",fontSize:13,opacity:canEdit?1:0.4}}
          disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)} placeholder="ex: chocolat, vanille…"/>
      </div>
      {mealExtras.map(ex=>(
        <div key={ex.id}>
          <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>➕ {ex.label}</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {ex.options.map(o=><Pill key={o} label={o} active={((order.extras||{})[ex.id]||[]).includes(o)} accent={ex.accent} disabled={!canEdit} onClick={()=>canEdit&&toggleExtraOption(name,ex.id,o)}/>)}
          </div>
        </div>
      ))}
      <BoissonSection/>
    </div>
  );

  if (order.choice==="libanais") return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      <div>
        <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>🥙 Commande</p>
        <textarea style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,
          color:T.text,padding:"6px 10px",fontSize:13,lineHeight:1.5,opacity:canEdit?1:0.4}}
          rows={2} disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)} placeholder="Précise ta commande…"/>
      </div>
      {mealExtras.map(ex=>(
        <div key={ex.id}>
          <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>➕ {ex.label}</p>
          <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
            {ex.options.map(o=><Pill key={o} label={o} active={((order.extras||{})[ex.id]||[]).includes(o)} accent={ex.accent} disabled={!canEdit} onClick={()=>canEdit&&toggleExtraOption(name,ex.id,o)}/>)}
          </div>
        </div>
      ))}
      <BoissonSection/>
    </div>
  );

  // Snack Merode
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      {/* Section 1 */}
      <div style={{paddingBottom:12,borderBottom:`1px solid ${T.borderLight}`}}>
        <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>🥙 Sandwich</p>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",marginBottom:6}}>
          {["Durum","Bicky"].map(o=><Pill key={o} label={o} active={order.snackType===o} accent={opt.accent} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"snackType",order.snackType===o?"":o)}/>)}
          <input style={{flex:1,minWidth:80,background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,
            color:T.text,padding:"4px 8px",fontSize:12,opacity:canEdit?1:0.4}}
            disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)}
            placeholder={order.snackType?"ex: falafel…":"Précise…"}/>
        </div>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
          {["Frite dedans","Frite à part"].map(o=><Pill key={o} label={o} active={order.frites===o} accent="#c97a4a" disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"frites",order.frites===o?"":o)}/>)}
        </div>
        <p style={{fontSize:11,color:T.textFaint,marginBottom:4}}>🫙 Sauce snack</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:4}}>
          {sauces.map(s=><Pill key={s} label={s} active={(order.sauces||[]).includes(s)} accent="#9b7fa6" disabled={!canEdit} onClick={()=>canEdit&&toggleMulti(name,"sauces",s)}/>)}
        </div>
        {canEdit && (
          <div style={{display:"flex",gap:4}}>
            <input ref={sauceRef} style={{flex:1,background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,padding:"3px 8px",fontSize:11}} placeholder="Autre sauce…"
              onKeyDown={async e=>{if(e.key==="Enter"&&e.target.value.trim()){await ps([...sauces,e.target.value.trim()]);e.target.value="";}}}/>
            <button style={{background:T.accentLight,border:`1px solid ${T.border}`,borderRadius:8,padding:"3px 10px",fontSize:11,color:T.accent,cursor:"pointer"}}
              onClick={()=>{if(sauceRef.current?.value.trim()){ps([...sauces,sauceRef.current.value.trim()]);sauceRef.current.value="";}}}> + Sauvegarder</button>
          </div>
        )}
        {mealExtras.map(ex=>(
          <div key={ex.id} style={{marginTop:6}}>
            <p style={{fontSize:11,color:T.textFaint,marginBottom:4}}>➕ {ex.label}</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {ex.options.map(o=><Pill key={o} label={o} active={((order.extras||{})[ex.id]||[]).includes(o)} accent={ex.accent} disabled={!canEdit} onClick={()=>canEdit&&toggleExtraOption(name,ex.id,o)}/>)}
            </div>
          </div>
        ))}
      </div>
      {/* Section 2 */}
      <div style={{paddingBottom:12,borderBottom:`1px solid ${T.borderLight}`}}>
        <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>🍟 Frite extra</p>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
          {["Petite","Moyenne","Grande"].map(o=><Pill key={o} label={o} active={order.friteSup===o} accent="#c97a4a" disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"friteSup",order.friteSup===o?"":o)}/>)}
        </div>
        <p style={{fontSize:11,color:T.textFaint,marginBottom:4}}>🥣 Sauce frite</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:4}}>
          {sauces.map(s=><Pill key={s} label={s} active={order.sauceFrite===s} accent="#c97a4a" disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"sauceFrite",order.sauceFrite===s?"":s)}/>)}
        </div>
        {canEdit && (
          <div style={{display:"flex",gap:4}}>
            <input ref={sauceFriteRef} style={{flex:1,background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,padding:"3px 8px",fontSize:11}} placeholder="Autre sauce…"
              onKeyDown={async e=>{if(e.key==="Enter"&&e.target.value.trim()){await ps([...sauces,e.target.value.trim()]);e.target.value="";}}}/>
            <button style={{background:T.accentLight,border:`1px solid ${T.border}`,borderRadius:8,padding:"3px 10px",fontSize:11,color:T.accent,cursor:"pointer"}}
              onClick={()=>{if(sauceFriteRef.current?.value.trim()){ps([...sauces,sauceFriteRef.current.value.trim()]);sauceFriteRef.current.value="";}}}> + Sauvegarder</button>
          </div>
        )}
      </div>
      {/* Section 3 */}
      <div style={{paddingBottom:12,borderBottom:`1px solid ${T.borderLight}`}}>
        <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>🥗 Crudités</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
          <Pill label="Tout" active={order.cruditesTout} accent="#5a8f7b" disabled={!canEdit}
            onClick={()=>canEdit&&toggleCruditesTout(name)}/>
          {crudites.map(c=><Pill key={c} label={c} active={(order.crudites||[]).includes(c)} accent="#5a8f7b" disabled={!canEdit} onClick={()=>canEdit&&toggleMulti(name,"crudites",c)}/>)}
        </div>
      </div>
      {/* Section 4 */}
      <BoissonSection/>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, T, isDark, toggleTheme, members }) {
  const [username, setUsername] = useState("");
  const [code, setCode]         = useState("");
  const [error, setError]       = useState("");
  const [shake, setShake]       = useState(false);
  const allUsers = [...members, ADMIN];

  const attempt = () => {
    const user = allUsers.find(u=>u.username.toLowerCase()===username.toLowerCase()&&u.code===code.trim());
    if (user) onLogin(user.username);
    else { setError("Nom ou code invalide."); setShake(true); setTimeout(()=>setShake(false),600); }
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.bg}}>
      <style>{CSS(T)}</style>
      <button onClick={toggleTheme} style={{position:"fixed",top:20,right:20,background:T.bgCard,
        border:`1px solid ${T.border}`,borderRadius:10,padding:"8px 12px",fontSize:15,cursor:"pointer",color:T.text}}>
        {isDark?"☀️":"🌙"}
      </button>

      <div style={{display:"flex",width:"100%",maxWidth:900,borderRadius:24,overflow:"hidden",
        boxShadow:"0 24px 80px rgba(44,31,14,0.15)",border:`1px solid ${T.border}`,
        animation:shake?"shake 0.5s":"fadeUp 0.5s both"}}>

        {/* Left panel */}
        <div style={{width:280,background:`linear-gradient(180deg, ${T.sidebarBg||T.sidebar} 0%, ${T.sidebar} 100%)`,padding:48,display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
          <div>
            <div style={{width:48,height:48,borderRadius:14,background:"rgba(245,239,230,0.15)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,marginBottom:32}}>🍽️</div>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:28,color:"#f5efe6",
              marginBottom:8,letterSpacing:"-0.5px"}}>Lunch Orders</h1>
            <p style={{color:"rgba(245,239,230,0.5)",fontSize:14,lineHeight:1.6}}>
              Organise les commandes de l'équipe en quelques secondes.
            </p>
          </div>
          <div style={{borderTop:"1px solid rgba(245,239,230,0.1)",paddingTop:24}}>
            {["🍦 Ice Cream","🥪 Snack Merode","🥙 Libanais"].map(item=>(
              <div key={item} style={{color:"rgba(245,239,230,0.4)",fontSize:13,marginBottom:8}}>{item}</div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{flex:1,background:T.bgCard,padding:48,display:"flex",flexDirection:"column",justifyContent:"center"}}>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:4}}>Bienvenue 👋</h2>
          <p style={{color:T.textSub,fontSize:14,marginBottom:32}}>Connecte-toi pour passer ta commande</p>

          <div style={{marginBottom:16}}>
            <label style={{display:"block",fontSize:12,fontWeight:500,color:T.textSub,marginBottom:6,letterSpacing:"0.05em",textTransform:"uppercase"}}>Ton nom</label>
            <select style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:10,
              color:T.text,padding:"11px 14px",fontSize:14,cursor:"pointer"}}
              value={username} onChange={e=>setUsername(e.target.value)}>
              <option value="">— Sélectionne ton nom —</option>
              {allUsers.map(u=><option key={u.username} value={u.username}>{u.username}</option>)}
            </select>
          </div>

          <div style={{marginBottom:24}}>
            <label style={{display:"block",fontSize:12,fontWeight:500,color:T.textSub,marginBottom:6,letterSpacing:"0.05em",textTransform:"uppercase"}}>Code</label>
            <input style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:10,
              color:T.text,padding:"11px 14px",fontSize:14}}
              type="password" value={code} placeholder="••••"
              onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()}/>
          </div>

          {error && <p style={{color:T.red,fontSize:13,marginBottom:16}}>{error}</p>}

          <button style={{background:T.sidebar,color:"#f5efe6",border:"none",borderRadius:10,padding:"12px",
            fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
            transition:"opacity 0.15s"}}
            onMouseEnter={e=>e.target.style.opacity="0.88"}
            onMouseLeave={e=>e.target.style.opacity="1"}
            onClick={attempt}>Entrer →</button>

          <p style={{color:T.textFaint,fontSize:11,marginTop:20,textAlign:"center"}}>Ton code = ton numéro de poste</p>
        </div>
      </div>
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
  const [favNameInput, setFavNameInput]       = useState("");
  const [showFavModal, setShowFavModal]       = useState(false);
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
  const [openHistory, setOpenHistory]         = useState({});
  const [viewMode, setViewMode]               = useState("accordion");
  const [isDark, setIsDark]   = useState(()=>localStorage.getItem("lunch_theme")==="dark");
  const [isMobile, setIsMobile] = useState(()=>window.innerWidth<768);
  const detailTimers = useRef({});
  const T = isDark ? DARK : LIGHT;

  const toggleTheme=()=>{ const n=!isDark; setIsDark(n); localStorage.setItem("lunch_theme",n?"dark":"light"); };

  useEffect(()=>{ const h=()=>setIsMobile(window.innerWidth<768); window.addEventListener("resize",h); return ()=>window.removeEventListener("resize",h); },[]);

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"orders"),    s=>{const d={};s.forEach(x=>{d[x.id]=x.data();});setOrders(d);setStatus("live");}, ()=>setStatus("error"));
    const u2=onSnapshot(doc(db,"config","members"), s=>{if(s.exists()&&s.data().list)setMembers(s.data().list);});
    const u3=onSnapshot(doc(db,"config","sauces"),  s=>{if(s.exists()&&s.data().list)setSauces(s.data().list);});
    const u4=onSnapshot(doc(db,"config","crudites"),s=>{if(s.exists()&&s.data().list)setCrudites(s.data().list);});
    const u4b=onSnapshot(doc(db,"config","boissons"),s=>{if(s.exists()&&s.data().list)setBoissons(s.data().list);});
    const u5=onSnapshot(doc(db,"config","extras"),  s=>{if(s.exists()&&s.data().list)setExtras(s.data().list);});
    const u6=onSnapshot(collection(db,"favorites"), s=>{
      const d={};
      s.forEach(x=>{ const data=x.data(); if(data.list)d[x.id]=data.list; else if(data.choice)d[x.id]=[{id:"fav_legacy",name:"Mon favori",...data}]; else d[x.id]=[]; });
      setFavorites(d);
    });
    const u7=onSnapshot(collection(db,"history"),   s=>{const days=[];s.forEach(x=>days.push({id:x.id,...x.data()}));days.sort((a,b)=>b.id.localeCompare(a.id));setHistory(days);});
    const u8=onSnapshot(doc(db,"payments","today"), s=>{if(s.exists())setPayments(s.data());else setPayments({});});
    return ()=>{u1();u2();u3();u4();u4b();u5();u6();u7();u8();};
  },[]);

  useEffect(()=>{
    if(!user||user==="Admin")return;
    const favList=favorites[user]||[];
    if(!favList.length)return;
    if(!orders[user]?.choice){
      const {id:_a,name:_b,...orderData}=favList[0];
      setDoc(doc(db,"orders",user),{...orderData});
    }
  },[user,favorites]);

  if(!user) return <LoginScreen onLogin={setUser} T={T} isDark={isDark} toggleTheme={toggleTheme} members={members}/>;

  const pm=async l=>{setMembers(l);  await setDoc(doc(db,"config","members"), {list:l});};
  const ps=async l=>{setSauces(l);   await setDoc(doc(db,"config","sauces"),  {list:l});};
  const pc=async l=>{setCrudites(l); await setDoc(doc(db,"config","crudites"),{list:l});};
  const pb=async l=>{setBoissons(l); await setDoc(doc(db,"config","boissons"),{list:l});};
  const pe=async l=>{setExtras(l);   await setDoc(doc(db,"config","extras"),  {list:l});};

  const names=user==="Admin"?members.map(m=>m.username):[user,...members.map(m=>m.username).filter(n=>n!==user)];

  const addMember    =async()=>{const n=newMemberName.trim(),c=newMemberCode.trim();if(!n||!c||members.find(m=>m.username===n))return;await pm([...members,{username:n,code:c}]);setNewMemberName("");setNewMemberCode("");};
  const removeMember =async n=>{await pm(members.filter(m=>m.username!==n));await deleteDoc(doc(db,"orders",n));};
  const saveEdit     =async()=>{if(!editingMember)return;await pm(members.map(m=>m.username===editingMember.username?editingMember:m));setEditingMember(null);};
  const addSauce     =async()=>{const s=newSauce.trim();   if(s&&!sauces.includes(s))   {await ps([...sauces,s]);    setNewSauce("");}};
  const addCrudite   =async()=>{const c=newCrudite.trim(); if(c&&!crudites.includes(c)) {await pc([...crudites,c]);  setNewCrudite("");}};
  const addBoisson   =async()=>{const b=newBoisson.trim(); if(b&&!boissons.includes(b)) {await pb([...boissons,b]);  setNewBoisson("");}};
  const addExtraCategory=async()=>{const label=newExtraLabel.trim();if(!label||!newExtraApplies.length)return;const id="extra_"+Date.now();const accent=EXTRA_ACCENTS[extras.length%EXTRA_ACCENTS.length];await pe([...extras,{id,label,options:[],appliesTo:newExtraApplies,accent}]);setNewExtraLabel("");setNewExtraApplies([]);};
  const removeExtraCategory=async id=>{await pe(extras.filter(e=>e.id!==id));};
  const addExtraOption=async(extraId)=>{const val=(newExtraOption[extraId]||"").trim();if(!val)return;await pe(extras.map(e=>e.id===extraId?{...e,options:[...e.options,val]}:e));setNewExtraOption(p=>({...p,[extraId]:""}));};
  const removeExtraOption=async(extraId,opt)=>{await pe(extras.map(e=>e.id===extraId?{...e,options:e.options.filter(o=>o!==opt)}:e));};

  const toggleChoice=async(name,choice)=>{
    const cur=orders[name]||{};
    if(cur.choice===choice)await deleteDoc(doc(db,"orders",name));
    else await setDoc(doc(db,"orders",name),{choice,detail:"",sauces:[],crudites:[],cruditesTout:false,boules:"",snackType:"",frites:"",friteSup:"",sauceFrite:"",boisson:"",extras:{}});
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
    const list=cur[field]||[];
    const updated=list.includes(value)?list.filter(x=>x!==value):[...list,value];
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
    const ce=cur.extras||{};
    const list=ce[extraId]||[];
    const updated=list.includes(value)?list.filter(x=>x!==value):[...list,value];
    const newOrder={...cur,extras:{...ce,[extraId]:updated}};
    setOrders(prev=>({...prev,[name]:newOrder}));
    await setDoc(doc(db,"orders",name),newOrder);
  };
  const togglePayment=async name=>{
    const cur=payments[name]||false;
    const updated={...payments,[name]:!cur};
    setPayments(updated);
    await setDoc(doc(db,"payments","today"),updated);
  };
  const saveFavorite=async name=>{
    const cur=orders[name];if(!cur?.choice)return;
    const favName=favNameInput.trim()||formatOrder(cur,extras,crudites).slice(0,30)||"Mon favori";
    const existing=favorites[name]||[];
    await setDoc(doc(db,"favorites",name),{list:[...existing,{id:"fav_"+Date.now(),name:favName,...cur}]});
    setFavNameInput("");setShowFavModal(false);setSavedMsg(true);setTimeout(()=>setSavedMsg(false),2500);
  };
  const deleteFavorite=async(username,favId)=>{
    await setDoc(doc(db,"favorites",username),{list:(favorites[username]||[]).filter(f=>f.id!==favId)});
  };
  const resetAll=async()=>{
    if(!window.confirm("Archiver et effacer toutes les commandes du jour ?"))return;
    const today=new Date().toISOString().slice(0,10);
    const snapshot={};
    members.map(m=>m.username).forEach(n=>{if(orders[n]?.choice)snapshot[n]=orders[n];});
    if(Object.keys(snapshot).length>0)await setDoc(doc(db,"history",`${today}_${Date.now()}`),{date:today,orders:snapshot,payments});
    await Promise.all(members.map(m=>deleteDoc(doc(db,"orders",m.username))));
    await setDoc(doc(db,"payments","today"),{});
  };
  const deleteHistory=async id=>{if(!window.confirm("Supprimer ?"))return;await deleteDoc(doc(db,"history",id));};

  const totalOrdered=names.filter(n=>orders[n]?.choice).length;
  const notOrdered=names.filter(n=>!orders[n]?.choice);
  const counts=LUNCH_OPTIONS.reduce((a,o)=>{a[o.id]=names.filter(n=>orders[n]?.choice===o.id).length;return a;},{});
  const extrasForMeal=choice=>extras.filter(e=>e.appliesTo?.includes(choice));

  const detailCellProps={ sauces,crudites,boissons,extras,T,
    handleDetail,handleSubDetail,toggleMulti,toggleCruditesTout,toggleExtraOption,
    pb,ps,newBoissonInput,setNewBoissonInput };

  const inp={ width:"100%", background:T.bgInput, border:`1px solid ${T.border}`, borderRadius:8,
    color:T.text, padding:"8px 12px", fontSize:14, fontFamily:"'DM Sans',sans-serif" };
  const addBtn={ background:T.sidebar, color:"#f5efe6", border:"none", borderRadius:8,
    padding:"8px 18px", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" };

  // Sidebar nav items
  const navItems = [
    { id:"order",    icon:"📋", label:"Commander" },
    { id:"summary",  icon:"📊", label:"Résumé" },
    { id:"favorites",icon:"⭐", label:"Favoris" },
    { id:"history",  icon:"📅", label:"Historique" },
    { id:"settings", icon:"⚙️", label:"Config" },
  ];

  return (
    <div style={{minHeight:"100vh",display:"flex",background:T.bg}}>
      <style>{CSS(T)}</style>

      {/* ── Sidebar ── */}
      {!isMobile && (
        <aside style={{width:72,background:`linear-gradient(180deg, ${T.sidebarBg||T.sidebar} 0%, ${T.sidebar} 100%)`,
          display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",flexShrink:0,
          zIndex:10}}>

          {/* Logo */}
          <div style={{padding:"20px 0 16px",display:"flex",flexDirection:"column",alignItems:"center",
            borderBottom:`1px solid rgba(255,252,245,0.12)`,marginBottom:8}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:11,
              color:"#fff",letterSpacing:"0.5px",lineHeight:1.2,textAlign:"center"}}>
              <div>LUNCH</div>
              <div style={{opacity:0.6}}>ORD</div>
            </div>
          </div>

          {/* Nav */}
          <nav style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"4px 0",gap:2}}>
            {navItems.map(item=>{
              const isActive = tab===item.id;
              return (
                <div key={item.id} style={{width:"100%",position:"relative",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                  {/* White sliding tab */}
                  {isActive && (
                    <div style={{
                      position:"absolute",
                      right:0,
                      width:52,
                      height:52,
                      background:T.bgCard,
                      borderRadius:"12px 0 0 12px",
                      zIndex:1,
                      // notch effect top
                      boxShadow:`4px 0 0 0 ${T.bgCard}`,
                    }}>
                      {/* top notch */}
                      <div style={{position:"absolute",top:-16,right:0,width:16,height:16,
                        background:"transparent",
                        boxShadow:`8px 8px 0 8px ${T.bgCard}`,
                        borderRadius:"0 0 12px 0"}}/>
                      {/* bottom notch */}
                      <div style={{position:"absolute",bottom:-16,right:0,width:16,height:16,
                        background:"transparent",
                        boxShadow:`8px -8px 0 8px ${T.bgCard}`,
                        borderRadius:"0 12px 0 0"}}/>
                    </div>
                  )}

                  <button
                    onClick={()=>setTab(item.id)}
                    style={{
                      position:"relative", zIndex:2,
                      width:52, height:52,
                      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                      gap:2, border:"none", cursor:"pointer",
                      background:"transparent",
                      borderRadius: isActive ? "12px 0 0 12px" : "10px",
                      color: isActive ? T.accent : "rgba(255,252,245,0.65)",
                      transition:"color 0.2s",
                    }}
                    title={item.label}
                  >
                    <span style={{fontSize:18,lineHeight:1}}>{item.icon}</span>
                    <span style={{fontSize:8,fontWeight:600,opacity:0.8,fontFamily:"'DM Sans',sans-serif",
                      letterSpacing:"0.02em"}}>{item.label.slice(0,3).toUpperCase()}</span>
                  </button>
                </div>
              );
            })}
          </nav>

          {/* User */}
          <div style={{padding:"12px 0 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,
            borderTop:`1px solid rgba(255,252,245,0.12)`}}>
            <Avatar name={user} size={28}/>
            <div style={{display:"flex",flexDirection:"column",gap:4,alignItems:"center"}}>
              <button onClick={toggleTheme}
                style={{background:"rgba(255,252,245,0.12)",border:"none",borderRadius:7,
                  padding:"4px 8px",fontSize:12,cursor:"pointer",color:"#fff"}}>
                {isDark?"☀️":"🌙"}
              </button>
              <button onClick={()=>setUser(null)}
                style={{background:"rgba(255,252,245,0.12)",border:"none",borderRadius:7,
                  padding:"3px 6px",fontSize:9,cursor:"pointer",color:"rgba(255,252,245,0.7)",
                  fontFamily:"'DM Sans',sans-serif"}}>
                Exit
              </button>
            </div>
          </div>
        </aside>
      )}

      {/* ── Main content ── */}
      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>

        {/* Mobile header */}
        {isMobile && (
          <header style={{background:T.bgCard,borderBottom:`1px solid ${T.border}`,
            padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",
            position:"sticky",top:0,zIndex:100}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              <span style={{fontSize:18}}>🍽️</span>
              <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:T.text}}>Lunch Orders</span>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={toggleTheme} style={{background:T.bgTag,border:`1px solid ${T.border}`,
                borderRadius:8,padding:"5px 8px",fontSize:13,cursor:"pointer",color:T.text}}>
                {isDark?"☀️":"🌙"}
              </button>
              <button onClick={()=>setUser(null)} style={{background:T.bgTag,border:`1px solid ${T.border}`,
                borderRadius:8,padding:"5px 10px",fontSize:11,cursor:"pointer",color:T.textSub}}>
                Déconnexion
              </button>
            </div>
          </header>
        )}

        {/* Mobile bottom nav */}
        {isMobile && (
          <nav style={{position:"fixed",bottom:0,left:0,right:0,background:T.bgCard,
            borderTop:`1px solid ${T.border}`,display:"flex",zIndex:100,
            padding:"8px 0 env(safe-area-inset-bottom)"}}>
            {navItems.map(item=>(
              <button key={item.id} onClick={()=>setTab(item.id)}
                style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:2,
                  background:"none",border:"none",padding:"4px 0",cursor:"pointer",
                  color:tab===item.id?T.accent:T.textFaint,fontFamily:"'DM Sans',sans-serif"}}>
                <span style={{fontSize:18}}>{item.icon}</span>
                <span style={{fontSize:9,fontWeight:tab===item.id?600:400}}>{item.label}</span>
              </button>
            ))}
          </nav>
        )}

        {/* Page content */}
        <main style={{flex:1,padding:isMobile?"16px 12px 80px":"28px 32px",maxWidth:960,width:"100%",margin:"0 auto"}}>

          {/* ════ ORDER TAB ════ */}
          {tab==="order" && (
            <div style={{animation:"slideIn 0.25s ease"}}>

              {/* Page header */}
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
                <div>
                  <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:2}}>Commandes du jour</h1>
                  <p style={{fontSize:13,color:T.textSub}}>{totalOrdered} / {names.length} commandé{totalOrdered>1?"s":""}</p>
                </div>
                {user==="Admin" && (
                  <button onClick={()=>setViewMode(v=>v==="accordion"?"columns":"accordion")}
                    style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:8,
                      padding:"7px 14px",fontSize:12,cursor:"pointer",color:T.textSub,
                      display:"flex",alignItems:"center",gap:6,boxShadow:T.shadow}}>
                    {viewMode==="accordion"?"⊞ Colonnes":"☰ Accordéon"}
                  </button>
                )}
              </div>

              {/* Quick favorites */}
              {user!=="Admin" && (favorites[user]||[]).length>0 && (
                <div style={{marginBottom:20}}>
                  <p style={{fontSize:11,fontWeight:600,color:T.textFaint,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>⭐ Commande rapide</p>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {(favorites[user]||[]).map(fav=>{
                      const {id:favId,name:favName,...favOrder}=fav;
                      const opt=LUNCH_OPTIONS.find(o=>o.id===favOrder.choice);
                      const isActive=orders[user]?.choice===favOrder.choice&&formatOrder(orders[user],extras,crudites)===formatOrder(favOrder,extras,crudites);
                      return (
                        <button key={favId}
                          onClick={async()=>{ if(isActive)await deleteDoc(doc(db,"orders",user)); else await setDoc(doc(db,"orders",user),{...favOrder}); }}
                          style={{background:isActive?opt?.bg||T.accentLight:T.bgCard,
                            border:`1.5px solid ${isActive?opt?.accent||T.accent:T.border}`,
                            borderRadius:12,padding:"10px 16px",cursor:"pointer",textAlign:"left",
                            boxShadow:T.shadow,transition:"all 0.15s",minWidth:160}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                            <span style={{fontSize:11,color:opt?.accent||T.accent,fontWeight:600}}>{opt?.emoji} {opt?.label}</span>
                            {isActive && <span style={{fontSize:9,background:opt?.accent+"20",color:opt?.accent,padding:"1px 6px",borderRadius:10}}>✓ Actif</span>}
                          </div>
                          <div style={{fontSize:12,fontWeight:500,color:T.text}}>{favName}</div>
                          <div style={{fontSize:10,color:isActive?T.red:T.textFaint,marginTop:2}}>
                            {isActive?"Clic pour effacer ✕":"Clic pour commander →"}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ── VIEW A: Accordion ── */}
              {viewMode==="accordion" && (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {names.map((name,idx)=>{
                    const order=orders[name]||{};
                    const chosen=LUNCH_OPTIONS.find(o=>o.id===order.choice);
                    const canEdit=user===name||user==="Admin";
                    const isMe=user===name;
                    return (
                      <div key={name} className="accordion-card"
                        style={{background:T.bgCard,border:`1.5px solid ${isMe&&chosen?chosen.accent:isMe?T.accent:chosen?chosen.accent+"44":T.border}`,
                          borderRadius:14,overflow:"hidden",boxShadow:T.shadow}}>

                        {/* Row */}
                        <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:12,
                          background:isMe?T.accentLight:"transparent",
                          borderBottom:order.choice?`1px solid ${T.borderLight}`:"none"}}>
                          <span style={{fontSize:11,fontWeight:600,color:T.textFaint,minWidth:18,textAlign:"right"}}>{idx+1}</span>
                          <Avatar name={name} size={36}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:6}}>
                              <span style={{fontSize:14,fontWeight:isMe?700:500,color:isMe?T.accent:T.text}}>{name}</span>
                              {isMe && <span style={{fontSize:9,background:T.bgTag,color:T.textFaint,padding:"1px 6px",borderRadius:10}}>toi</span>}
                            </div>
                            {chosen && !isMe && <div style={{marginTop:2}}><OrderPills order={order} extras={extras} crudites={crudites}/></div>}
                          </div>
                          {canEdit && (
                            <div style={{display:"flex",gap:5,flexShrink:0}}>
                              {LUNCH_OPTIONS.map(opt=>(
                                <button key={opt.id} onClick={()=>toggleChoice(name,opt.id)}
                                  style={{padding:"5px 10px",borderRadius:20,fontSize:11,fontWeight:500,
                                    border:`1px solid ${order.choice===opt.id?opt.accent:T.border}`,
                                    background:order.choice===opt.id?opt.bg:T.bgInput,
                                    color:order.choice===opt.id?opt.accent:T.textSub,
                                    cursor:"pointer",transition:"all 0.15s"}}>
                                  {isMobile?opt.emoji:opt.emoji+" "+opt.label}
                                </button>
                              ))}
                            </div>
                          )}
                          {!canEdit && chosen && (
                            <span style={{fontSize:12,background:chosen.bg,color:chosen.accent,
                              padding:"3px 10px",borderRadius:20,fontWeight:500}}>{chosen.emoji} {chosen.label}</span>
                          )}
                          {user==="Admin" && (
                            <button style={{background:"none",border:"none",color:T.textFaint,fontSize:14,cursor:"pointer",padding:4,flexShrink:0}}
                              onClick={()=>removeMember(name)}>✕</button>
                          )}
                        </div>

                        {/* Expanded */}
                        {order.choice && (
                          <div style={{padding:"16px 16px 16px 70px"}}>
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
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:16,alignItems:"start"}}>
                  {LUNCH_OPTIONS.map(opt=>{
                    const people=names.filter(n=>orders[n]?.choice===opt.id);
                    const unordered=names.filter(n=>!orders[n]?.choice);
                    return (
                      <div key={opt.id}>
                        <div style={{background:opt.bg,border:`1.5px solid ${opt.accent}44`,borderRadius:12,
                          padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                          <span style={{fontSize:13,fontWeight:600,color:opt.accent}}>{opt.emoji} {opt.label}</span>
                          <span style={{fontSize:11,background:opt.accent+"22",color:opt.accent,
                            padding:"2px 8px",borderRadius:10,fontWeight:600}}>{people.length}</span>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {people.map(name=>{
                            const order=orders[name]||{};
                            return (
                              <div key={name} style={{background:T.bgCard,border:`1px solid ${T.border}`,
                                borderRadius:10,padding:"10px 12px",boxShadow:T.shadow}}>
                                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                                  <Avatar name={name} size={28}/>
                                  <span style={{fontSize:13,fontWeight:500,color:T.text}}>{name}</span>
                                  {payments[name] && <span style={{marginLeft:"auto",fontSize:10,color:T.green}}>✓</span>}
                                </div>
                                <OrderPills order={order} extras={extras} crudites={crudites}/>
                              </div>
                            );
                          })}
                          {people.length===0 && (
                            <div style={{background:T.bgInput,border:`1px dashed ${T.border}`,borderRadius:10,
                              padding:"16px",textAlign:"center",color:T.textFaint,fontSize:12}}>
                              Aucune commande
                            </div>
                          )}
                        </div>
                        {opt.id==="ice-cream" && unordered.length>0 && (
                          <div style={{marginTop:12}}>
                            <p style={{fontSize:11,color:T.textFaint,marginBottom:6}}>⏳ Non commandé</p>
                            {unordered.map(name=>(
                              <div key={name} style={{display:"flex",alignItems:"center",gap:6,
                                padding:"6px 0",borderBottom:`1px solid ${T.borderLight}`}}>
                                <Avatar name={name} size={24}/>
                                <span style={{fontSize:12,color:T.textSub}}>{name}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ════ SUMMARY TAB ════ */}
          {tab==="summary" && (
            <div style={{animation:"slideIn 0.25s ease"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
                <div>
                  <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:2}}>Résumé</h1>
                  <p style={{fontSize:13,color:T.textSub}}>Commandes du jour</p>
                </div>
                <button style={{background:T.bgCard,border:`1px solid ${T.red}44`,color:T.red,
                  borderRadius:8,padding:"7px 14px",fontSize:12,cursor:"pointer",boxShadow:T.shadow}}
                  onClick={resetAll}>🗑 Réinitialiser</button>
              </div>

              {/* Counts */}
              <div style={{display:"flex",gap:12,marginBottom:24,flexWrap:"wrap"}}>
                {LUNCH_OPTIONS.map(opt=>(
                  <div key={opt.id} style={{flex:1,minWidth:120,background:counts[opt.id]>0?opt.bg:T.bgCard,
                    border:`1.5px solid ${counts[opt.id]>0?opt.accent:T.border}`,borderRadius:14,
                    padding:"18px 20px",boxShadow:T.shadow}}>
                    <div style={{fontSize:38,fontWeight:800,fontFamily:"'Syne',sans-serif",
                      color:counts[opt.id]>0?opt.accent:T.textFaint,lineHeight:1}}>{counts[opt.id]}</div>
                    <div style={{fontSize:13,color:counts[opt.id]>0?opt.accent:T.textSub,marginTop:4}}>
                      {opt.emoji} {opt.label}
                    </div>
                  </div>
                ))}
              </div>

              {/* Groups */}
              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {LUNCH_OPTIONS.map(opt=>{
                  const people=names.filter(n=>orders[n]?.choice===opt.id);
                  if(!people.length)return null;
                  const paidCount=people.filter(n=>payments[n]).length;
                  return (
                    <div key={opt.id} style={{background:T.bgCard,border:`1px solid ${T.border}`,
                      borderRadius:14,overflow:"hidden",boxShadow:T.shadow}}>
                      <div style={{padding:"12px 20px",background:opt.bg,borderBottom:`1px solid ${opt.accent}22`,
                        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span style={{fontSize:14,fontWeight:600,color:opt.accent}}>{opt.emoji} {opt.label}</span>
                        <span style={{fontSize:12,color:paidCount===people.length?T.green:T.textSub}}>
                          💰 {paidCount}/{people.length} payé{paidCount>1?"s":""}
                        </span>
                      </div>
                      {people.map((name,idx)=>{
                        const paid=payments[name]||false;
                        return (
                          <div key={name} className="row-hover"
                            style={{padding:"12px 20px",borderBottom:`1px solid ${T.borderLight}`,
                              opacity:paid?0.55:1,transition:"opacity 0.2s"}}>
                            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
                              <span style={{fontSize:11,fontWeight:600,color:T.textFaint,minWidth:18,textAlign:"right"}}>{idx+1}.</span>
                              <Avatar name={name} size={28}/>
                              <span style={{fontSize:13,fontWeight:500,color:T.text,flex:1,textDecoration:paid?"line-through":"none"}}>{name}</span>
                              <button onClick={()=>togglePayment(name)}
                                style={{background:paid?T.green+"18":"transparent",
                                  border:`1px solid ${paid?T.green:T.border}`,
                                  borderRadius:20,padding:"3px 12px",fontSize:11,cursor:"pointer",
                                  color:paid?T.green:T.textSub,whiteSpace:"nowrap"}}>
                                {paid?"✓ Payé":"À payer"}
                              </button>
                              {name===user && (
                                <button onClick={()=>setShowFavModal(true)}
                                  style={{background:T.bgTag,border:`1px solid ${T.border}`,
                                    borderRadius:20,padding:"3px 10px",fontSize:11,cursor:"pointer",color:T.textSub}}>
                                  ⭐ Sauvegarder
                                </button>
                              )}
                            </div>
                            <div style={{paddingLeft:52}}>
                              <OrderPills order={orders[name]} extras={extras} crudites={crudites}/>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {totalOrdered===0 && (
                  <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,
                    padding:"60px 24px",textAlign:"center",color:T.textFaint,boxShadow:T.shadow}}>
                    <div style={{fontSize:32,marginBottom:10}}>🍽️</div>
                    <p>Aucune commande pour l'instant.</p>
                  </div>
                )}
              </div>

              {notOrdered.length>0 && (
                <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:12,
                  padding:"12px 16px",marginTop:16,display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",boxShadow:T.shadow}}>
                  <span style={{color:T.textSub,fontSize:13}}>⏳ Pas encore commandé :</span>
                  {notOrdered.map(n=>(
                    <span key={n} style={{background:T.bgTag,color:T.textSub,fontSize:12,padding:"3px 10px",borderRadius:20}}>{n}</span>
                  ))}
                </div>
              )}

              {showFavModal && (
                <div style={{position:"fixed",inset:0,background:"rgba(44,31,14,0.4)",backdropFilter:"blur(4px)",
                  display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}
                  onClick={e=>e.target===e.currentTarget&&setShowFavModal(false)}>
                  <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:16,
                    padding:"28px",width:340,boxShadow:"0 24px 80px rgba(44,31,14,0.2)"}}>
                    <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:17,color:T.text,marginBottom:6}}>⭐ Nommer ce favori</h3>
                    <p style={{fontSize:13,color:T.textSub,marginBottom:16}}>Donne un nom pour le retrouver facilement.</p>
                    <input autoFocus style={{...inp,marginBottom:12}} value={favNameInput}
                      onChange={e=>setFavNameInput(e.target.value)}
                      onKeyDown={e=>e.key==="Enter"&&saveFavorite(user)}
                      placeholder="ex: Bicky grande frite…"/>
                    <div style={{display:"flex",gap:8}}>
                      <button style={{...addBtn,flex:1}} onClick={()=>saveFavorite(user)}>Sauvegarder</button>
                      <button className="btn-ghost" style={{background:"transparent",border:`1px solid ${T.border}`,
                        color:T.textSub,borderRadius:8,padding:"8px 16px",fontSize:13,cursor:"pointer"}}
                        onClick={()=>setShowFavModal(false)}>Annuler</button>
                    </div>
                  </div>
                </div>
              )}

              {savedMsg && (
                <div style={{position:"fixed",bottom:32,left:"50%",transform:"translateX(-50%)",
                  background:T.bgCard,border:`1px solid ${T.border}`,color:T.accent,
                  padding:"12px 24px",fontSize:14,borderRadius:12,animation:"toastIn 0.3s ease",
                  zIndex:999,boxShadow:T.shadow}}>
                  ⭐ Favori sauvegardé !
                </div>
              )}
            </div>
          )}

          {/* ════ FAVORITES TAB ════ */}
          {tab==="favorites" && (
            <div style={{animation:"slideIn 0.25s ease"}}>
              <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:20}}>⭐ Favoris</h1>

              {user!=="Admin" && (
                (favorites[user]||[]).length===0 ? (
                  <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,
                    padding:"60px 24px",textAlign:"center",color:T.textFaint,boxShadow:T.shadow}}>
                    <div style={{fontSize:32,marginBottom:10}}>⭐</div>
                    <p>Pas encore de favori.</p>
                    <p style={{fontSize:13,marginTop:6,color:T.textFaint}}>Dans le Résumé, clique sur "⭐ Sauvegarder".</p>
                  </div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {(favorites[user]||[]).map(fav=>{
                      const {id:favId,name:favName,...favOrder}=fav;
                      const opt=LUNCH_OPTIONS.find(o=>o.id===favOrder.choice);
                      const isActive=orders[user]?.choice===favOrder.choice&&formatOrder(orders[user],extras,crudites)===formatOrder(favOrder,extras,crudites);
                      return (
                        <div key={favId} style={{background:isActive?opt?.bg||T.accentLight:T.bgCard,
                          border:`1.5px solid ${isActive?opt?.accent||T.accent:T.border}`,
                          borderRadius:14,padding:"16px 20px",boxShadow:T.shadow}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{fontSize:13,fontWeight:700,color:T.text}}>{favName}</span>
                              <span style={{fontSize:11,background:opt?.bg,color:opt?.accent,padding:"2px 8px",borderRadius:10}}>{opt?.emoji} {opt?.label}</span>
                              {isActive && <span style={{fontSize:9,background:opt?.accent+"20",color:opt?.accent,padding:"1px 6px",borderRadius:10}}>✓ Actif</span>}
                            </div>
                            <button style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:14,padding:4}}
                              onClick={async()=>{if(window.confirm(`Supprimer "${favName}" ?`))await deleteFavorite(user,favId);}}>🗑</button>
                          </div>
                          <div style={{marginBottom:12}}><OrderPills order={favOrder} extras={extras} crudites={crudites}/></div>
                          <button style={{width:"100%",padding:"10px",borderRadius:10,fontSize:13,cursor:"pointer",
                            background:isActive?T.red+"11":opt?.bg,
                            border:`1px solid ${isActive?T.red+"44":opt?.accent+"44"}`,
                            color:isActive?T.red:opt?.accent,fontWeight:600}}
                            onClick={async()=>{ if(isActive)await deleteDoc(doc(db,"orders",user)); else{await setDoc(doc(db,"orders",user),{...favOrder});setTab("order");} }}>
                            {isActive?"✕ Effacer ma commande":"↩ Commander maintenant"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )
              )}

              {user==="Admin" && (
                Object.keys(favorites).filter(u=>(favorites[u]||[]).length>0).length===0 ? (
                  <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,padding:"48px",textAlign:"center",color:T.textFaint}}>Aucun favori.</div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {Object.entries(favorites).map(([username,favList])=>{
                      if(!favList?.length)return null;
                      return (
                        <div key={username} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 20px",boxShadow:T.shadow}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                            <Avatar name={username} size={28}/>
                            <span style={{fontSize:14,fontWeight:600,color:T.text}}>{username}</span>
                            <Tag>{favList.length} favori{favList.length>1?"s":""}</Tag>
                          </div>
                          {favList.map(fav=>{
                            const {id:favId,name:favName,...favOrder}=fav;
                            const opt=LUNCH_OPTIONS.find(o=>o.id===favOrder.choice);
                            return (
                              <div key={favId} style={{display:"flex",gap:10,alignItems:"flex-start",
                                padding:"8px 0",borderBottom:`1px solid ${T.borderLight}`}}>
                                <span style={{fontSize:10,color:opt?.accent,marginTop:3,flexShrink:0}}>●</span>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:13,fontWeight:500,color:T.text,marginBottom:4}}>{favName}</div>
                                  <OrderPills order={favOrder} extras={extras} crudites={crudites}/>
                                </div>
                                <button style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:13}}
                                  onClick={async()=>{if(window.confirm(`Supprimer ?`))await deleteFavorite(username,favId);}}>🗑</button>
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
            <div style={{animation:"slideIn 0.25s ease"}}>
              <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:20}}>📅 Historique</h1>
              {history.length===0 && (
                <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,
                  padding:"60px 24px",textAlign:"center",color:T.textFaint,boxShadow:T.shadow}}>
                  <div style={{fontSize:32,marginBottom:10}}>📅</div>
                  <p>Aucun historique pour l'instant.</p>
                </div>
              )}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {history.map(day=>{
                  const visibleOrders=user==="Admin"?Object.entries(day.orders||{}):Object.entries(day.orders||{}).filter(([n])=>n===user);
                  if(!visibleOrders.length)return null;
                  const isOpen=openHistory[day.id]||false;
                  const toggle=()=>setOpenHistory(prev=>({...prev,[day.id]:!prev[day.id]}));
                  return (
                    <div key={day.id} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden",boxShadow:T.shadow}}>
                      {/* Header */}
                      <div onClick={toggle} style={{padding:"14px 20px",display:"flex",alignItems:"center",
                        justifyContent:"space-between",cursor:"pointer",
                        background:isOpen?T.bgHover:"transparent",
                        borderBottom:isOpen?`1px solid ${T.border}`:"none"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10}}>
                          <span style={{fontSize:16,transition:"transform 0.2s",display:"inline-block",
                            transform:isOpen?"rotate(90deg)":"rotate(0deg)",color:T.textSub}}>›</span>
                          <div>
                            <p style={{fontSize:14,fontWeight:600,color:T.text}}>
                              {new Date(day.date||day.id).toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
                            </p>
                            {!isOpen && (
                              <p style={{fontSize:12,color:T.textSub,marginTop:2}}>
                                {visibleOrders.length} commande{visibleOrders.length>1?"s":""}
                                {" · "}
                                {LUNCH_OPTIONS.filter(opt=>visibleOrders.some(([,o])=>o.choice===opt.id)).map(o=>o.emoji+" "+o.label).join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
                          <Tag>{visibleOrders.length} commande{visibleOrders.length>1?"s":""}</Tag>
                          {user==="Admin" && (
                            <>
                              <button style={{background:T.green+"11",border:`1px solid ${T.green}33`,color:T.green,
                                borderRadius:7,padding:"4px 10px",fontSize:11,cursor:"pointer"}}
                                onClick={async()=>{ if(!window.confirm("Restaurer ?"))return;
                                  await Promise.all(Object.entries(day.orders||{}).map(([n,o])=>setDoc(doc(db,"orders",n),o)));
                                  if(day.payments)await setDoc(doc(db,"payments","today"),day.payments);
                                }}>↩ Restaurer</button>
                              <button style={{background:T.red+"11",border:`1px solid ${T.red}33`,color:T.red,
                                borderRadius:7,padding:"4px 8px",fontSize:11,cursor:"pointer"}}
                                onClick={()=>deleteHistory(day.id)}>🗑</button>
                            </>
                          )}
                        </div>
                      </div>
                      {/* Content */}
                      {isOpen && (
                        <div>
                          {LUNCH_OPTIONS.map(opt=>{
                            const people=visibleOrders.filter(([,o])=>o.choice===opt.id);
                            if(!people.length)return null;
                            return (
                              <div key={opt.id} style={{padding:"12px 20px",borderBottom:`1px solid ${T.borderLight}`}}>
                                <p style={{fontSize:12,fontWeight:600,color:opt.accent,marginBottom:8}}>{opt.emoji} {opt.label}</p>
                                {people.map(([name,o],idx)=>{
                                  const paid=(day.payments||{})[name]||false;
                                  return (
                                    <div key={name} style={{display:"flex",gap:10,alignItems:"flex-start",
                                      padding:"8px 0",borderBottom:`1px solid ${T.borderLight}`}}>
                                      <span style={{fontSize:11,fontWeight:600,color:T.textFaint,minWidth:18,textAlign:"right",marginTop:2}}>{idx+1}.</span>
                                      <Avatar name={name} size={24}/>
                                      <div style={{flex:1}}>
                                        <span style={{fontSize:13,fontWeight:500,color:T.text,textDecoration:paid?"line-through":"none"}}>{name}</span>
                                        <div style={{marginTop:4}}><OrderPills order={o} extras={extras} crudites={crudites}/></div>
                                      </div>
                                      <span style={{fontSize:11,padding:"2px 8px",borderRadius:20,flexShrink:0,
                                        background:paid?T.green+"15":T.red+"10",
                                        color:paid?T.green:T.textFaint}}>
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
            </div>
          )}

          {/* ════ CONFIG TAB ════ */}
          {tab==="settings" && (
            <div style={{animation:"slideIn 0.25s ease"}}>
              <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:20}}>⚙️ Configuration</h1>
              {user!=="Admin" ? (
                <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,
                  padding:"60px 24px",textAlign:"center",color:T.textFaint,boxShadow:T.shadow}}>
                  <div style={{fontSize:32,marginBottom:10}}>🔒</div>
                  <p>Réservé à l'Admin</p>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:28}}>

                  {/* Membres */}
                  <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px 24px",boxShadow:T.shadow}}>
                    <h2 style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:16}}>👥 Membres</h2>
                    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                      <input style={{...inp,flex:2,minWidth:140}} value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} placeholder="Nom…"/>
                      <input style={{...inp,flex:1,minWidth:100}} value={newMemberCode} onChange={e=>setNewMemberCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMember()} placeholder="Code…"/>
                      <button style={addBtn} onClick={addMember}>+ Ajouter</button>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {members.map(m=>(
                        <div key={m.username} style={{display:"flex",alignItems:"center",gap:10,
                          padding:"10px 12px",background:T.bgHover,borderRadius:10,border:`1px solid ${T.borderLight}`}}>
                          {editingMember?.username===m.username ? (
                            <>
                              <input style={{...inp,flex:2,padding:"5px 10px",fontSize:13}} value={editingMember.username} onChange={e=>setEditingMember({...editingMember,username:e.target.value})}/>
                              <input style={{...inp,flex:1,padding:"5px 10px",fontSize:13}} value={editingMember.code} onChange={e=>setEditingMember({...editingMember,code:e.target.value})}/>
                              <button style={{...addBtn,padding:"5px 12px",fontSize:12,background:T.green}} onClick={saveEdit}>✓</button>
                              <button className="btn-ghost" style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:7,padding:"5px 10px",fontSize:12,cursor:"pointer"}} onClick={()=>setEditingMember(null)}>✕</button>
                            </>
                          ) : (
                            <>
                              <Avatar name={m.username} size={28}/>
                              <span style={{flex:1,fontSize:13,fontWeight:500,color:T.text}}>{m.username}</span>
                              <Tag>{m.code}</Tag>
                              <button className="btn-ghost" style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:7,padding:"4px 8px",fontSize:11,cursor:"pointer"}} onClick={()=>setEditingMember({...m})}>✏️</button>
                              <button style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:14,padding:4}} onClick={()=>removeMember(m.username)}>✕</button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Lists */}
                  {[
                    {label:"🥫 Sauces",items:sauces,newVal:newSauce,setNew:setNewSauce,add:addSauce,remove:async s=>ps(sauces.filter(x=>x!==s)),accent:"#9b7fa6"},
                    {label:"🥗 Crudités",items:crudites,newVal:newCrudite,setNew:setNewCrudite,add:addCrudite,remove:async c=>pc(crudites.filter(x=>x!==c)),accent:"#5a8f7b"},
                    {label:"🥤 Boissons",items:boissons,newVal:newBoisson,setNew:setNewBoisson,add:addBoisson,remove:async b=>pb(boissons.filter(x=>x!==b)),accent:"#7a9ab5"},
                  ].map(({label,items,newVal,setNew,add,remove,accent})=>(
                    <div key={label} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px 24px",boxShadow:T.shadow}}>
                      <h2 style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:14}}>{label}</h2>
                      <div style={{display:"flex",gap:8,marginBottom:14}}>
                        <input style={{...inp,flex:1}} value={newVal} onChange={e=>setNew(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Nouveau…"/>
                        <button style={addBtn} onClick={add}>+ Ajouter</button>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                        {items.map(item=>(
                          <div key={item} style={{background:T.bgTag,border:`1px solid ${T.borderLight}`,
                            borderRadius:20,padding:"4px 12px",display:"flex",alignItems:"center",gap:6}}>
                            <span style={{fontSize:13,color:T.text}}>{item}</span>
                            <button style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:12}} onClick={()=>remove(item)}>✕</button>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Extras */}
                  <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px 24px",boxShadow:T.shadow}}>
                    <h2 style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:14}}>➕ Catégories personnalisées</h2>
                    <div style={{background:T.bgHover,borderRadius:10,padding:"14px",marginBottom:14,border:`1px solid ${T.borderLight}`}}>
                      <input style={{...inp,marginBottom:10}} value={newExtraLabel} onChange={e=>setNewExtraLabel(e.target.value)} placeholder="Nom de la catégorie…"/>
                      <p style={{fontSize:11,color:T.textFaint,marginBottom:6}}>Applicable à :</p>
                      <div style={{display:"flex",gap:6,marginBottom:10}}>
                        {LUNCH_OPTIONS.map(opt=>(
                          <Pill key={opt.id} label={opt.emoji+" "+opt.label} active={newExtraApplies.includes(opt.id)} accent={opt.accent}
                            onClick={()=>setNewExtraApplies(p=>p.includes(opt.id)?p.filter(x=>x!==opt.id):[...p,opt.id])}/>
                        ))}
                      </div>
                      <button style={{...addBtn,opacity:newExtraLabel&&newExtraApplies.length?1:0.5}} onClick={addExtraCategory}>+ Créer la catégorie</button>
                    </div>
                    {extras.map(ex=>(
                      <div key={ex.id} style={{borderLeft:`3px solid ${ex.accent}`,paddingLeft:14,marginBottom:14}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                          <div>
                            <span style={{fontSize:14,fontWeight:600,color:T.text}}>{ex.label}</span>
                            <span style={{marginLeft:8,fontSize:11,color:T.textSub}}>{ex.appliesTo.map(id=>LUNCH_OPTIONS.find(o=>o.id===id)?.emoji).join(" ")}</span>
                          </div>
                          <button style={{background:T.red+"11",border:`1px solid ${T.red}33`,color:T.red,
                            borderRadius:7,padding:"3px 8px",fontSize:11,cursor:"pointer"}}
                            onClick={()=>removeExtraCategory(ex.id)}>Supprimer</button>
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:8}}>
                          {ex.options.map(o=>(
                            <div key={o} style={{background:T.bgTag,border:`1px solid ${T.borderLight}`,borderRadius:20,
                              padding:"3px 10px",display:"flex",alignItems:"center",gap:4}}>
                              <span style={{fontSize:12,color:T.text}}>{o}</span>
                              <button style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:11}} onClick={()=>removeExtraOption(ex.id,o)}>✕</button>
                            </div>
                          ))}
                        </div>
                        <div style={{display:"flex",gap:6}}>
                          <input style={{...inp,flex:1,padding:"5px 10px",fontSize:12}} value={newExtraOption[ex.id]||""}
                            onChange={e=>setNewExtraOption(p=>({...p,[ex.id]:e.target.value}))}
                            onKeyDown={e=>e.key==="Enter"&&addExtraOption(ex.id)}
                            placeholder="Nouvelle option…"/>
                          <button style={{...addBtn,padding:"5px 12px",fontSize:12}} onClick={()=>addExtraOption(ex.id)}>+ Ajouter</button>
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
    </div>
  );
}