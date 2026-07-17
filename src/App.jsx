import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, addDoc } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDNXj4_HZEjhkP39t8CtPbVhIG5oLojW68",
  authDomain: "lunch-order-64da9.firebaseapp.com",
  projectId: "lunch-order-64da9",
  storageBucket: "lunch-order-64da9.firebasestorage.app",
  messagingSenderId: "319409938743",
  appId: "1:319409938743:web:a5c31835e02ce679d9fab2"
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
  textSub:     "#5a3e28",
  textFaint:   "#8a6040",
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
  const isNoneSelected = o.crudites.every(c=>c.toLowerCase().includes("aucune"));
  if (isNoneSelected) return "Aucune crudité";
  if (o.cruditesTout) {
    const realCrudites = allCrudites.filter(c=>!c.toLowerCase().includes("aucune"));
    const selected = o.crudites.filter(c=>!c.toLowerCase().includes("aucune"));
    const excl = realCrudites.filter(c=>!selected.includes(c));
    return excl.length > 0 ? "Tout sauf: "+excl.join(", ") : "Toutes crudités";
  }
  const selected = o.crudites.filter(c=>!c.toLowerCase().includes("aucune"));
  return selected.length ? "Crudités: "+selected.join(", ") : null;
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
    if (o.boules==="2 boules" && o.boule1 && o.boule2) lines.push({ emoji:"✨", text: `${o.boule1} + ${o.boule2}` });
    else if (o.boule1) lines.push({ emoji:"✨", text: o.boule1 });
    else if (o.detail) lines.push({ emoji:"✨", text: o.detail });
    extras.filter(ex=>ex.appliesTo?.includes("ice-cream")).forEach(ex=>{
      (o.extras||{})[ex.id]?.forEach(opt=>lines.push({ emoji:"➕", text: opt }));
    });
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
    <span style={{ background:bg||"#f0ebe0", color:color||"#5a3e28",
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
        borderRadius:20, padding:"3px 10px", fontSize:11, fontWeight:active?600:400,
        color:active?accent:"#5a3e28", cursor:disabled?"not-allowed":"pointer",
        transition:"all 0.15s", whiteSpace:"nowrap", opacity:disabled?0.35:1 }}>
      {label}
    </button>
  );
}

function OrderPills({ order, extras=[], crudites=[] }) {
  const lines = formatOrderFull(order, extras, crudites);
  if (!lines.length) return <span style={{fontSize:12,color:"#8a6040",fontStyle:"italic"}}>Aucun détail</span>;
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
      {lines.map((line,i)=>(
        <span key={i} style={{background:"#f5f0e8",border:"1px solid #e8e0d0",borderRadius:20,
          padding:"2px 10px",fontSize:11,color:"#5a3e28",display:"inline-flex",alignItems:"center",
          gap:3,maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"normal",wordBreak:"break-word"}}>
          {line.emoji} {line.text}
        </span>
      ))}
    </div>
  );
}

// ── Detail cell ───────────────────────────────────────────────────────────────
function DetailCell({ name, order, canEdit, sauces, crudites, boissons, extras, mealExtras,
  handleDetail, handleSubDetail, toggleMulti, toggleCruditesTout, toggleExtraOption,
  pb, ps, newBoissonInput, setNewBoissonInput, T, boubouleParfums=[] }) {

  const sauceRef = useRef(null);
  const sauceFriteRef = useRef(null);

  if (!order.choice) return <span style={{fontSize:12,color:T.textFaint}}>{canEdit?"Choisis un plat d'abord…":"🔒"}</span>;

  const opt = LUNCH_OPTIONS.find(o=>o.id===order.choice);

  const [localBoisson, setLocalBoisson] = useState("");

  if (order.choice==="ice-cream") {
    // parse selected flavours
    const boule1 = order.boule1 || "";
    const boule2 = order.boule2 || "";
    const is2 = order.boules==="2 boules";

    return (
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        {/* Boules */}
        <div>
          <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>🍦 Nombre de boules</p>
          <div style={{display:"flex",gap:5}}>
            {["1 boule","2 boules"].map(o=>(
              <Pill key={o} label={o} active={order.boules===o} accent={opt.accent}
                disabled={!canEdit} onClick={()=>{
                  if(!canEdit)return;
                  if(o==="1 boule") handleSubDetail(name,"boule2","");
                  handleSubDetail(name,"boules",order.boules===o?"":o);
                }}/>
            ))}
          </div>
        </div>

        {/* Boule 1 */}
        {order.boules && (
          <div>
            <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>✨ {is2?"Boule 1":"Parfum"}</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {boubouleParfums.map(p=>(
                <Pill key={p.name} label={p.name}
                  active={boule1===p.name} accent={opt.accent}
                  disabled={!canEdit}
                  onClick={()=>canEdit&&handleSubDetail(name,"boule1",boule1===p.name?"":p.name)}/>
              ))}
            </div>
          </div>
        )}

        {/* Boule 2 */}
        {is2 && (
          <div>
            <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>✨ Boule 2</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {boubouleParfums.map(p=>(
                <Pill key={p.name} label={p.name}
                  active={boule2===p.name} accent={opt.accent}
                  disabled={!canEdit}
                  onClick={()=>canEdit&&handleSubDetail(name,"boule2",boule2===p.name?"":p.name)}/>
              ))}
            </div>
          </div>
        )}

        {mealExtras.map(ex=>(
          <div key={ex.id}>
            <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>➕ {ex.label}</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {ex.options.map(o=><Pill key={o} label={o} active={((order.extras||{})[ex.id]||[]).includes(o)} accent={ex.accent} disabled={!canEdit} onClick={()=>canEdit&&toggleExtraOption(name,ex.id,o)}/>)}
            </div>
          </div>
        ))}
      </div>
    );
  }

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
              color:T.text,padding:"4px 8px",fontSize:12}}
              value={localBoisson}
              onChange={e=>setLocalBoisson(e.target.value)}
              placeholder="Autre boisson…"/>
            {localBoisson.trim() && !boissons.includes(localBoisson.trim()) && (
              <button onClick={async()=>{
                const v=localBoisson.trim();
                await handleSubDetail(name,"boisson",v);
                await pb([...boissons,v]);
                setLocalBoisson("");
              }} style={{background:T.accentLight,border:`1px solid ${T.border}`,borderRadius:8,
                padding:"4px 10px",fontSize:11,color:T.accent,cursor:"pointer",whiteSpace:"nowrap"}}>+ Sauvegarder</button>
            )}
          </div>
        )}
      </div>
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
              color:T.text,padding:"4px 8px",fontSize:12}}
              value={localBoisson}
              onChange={e=>setLocalBoisson(e.target.value)}
              placeholder="Autre boisson…"/>
            {localBoisson.trim() && !boissons.includes(localBoisson.trim()) && (
              <button onClick={async()=>{
                const v=localBoisson.trim();
                await handleSubDetail(name,"boisson",v);
                await pb([...boissons,v]);
                setLocalBoisson("");
              }} style={{background:T.accentLight,border:`1px solid ${T.border}`,borderRadius:8,
                padding:"4px 10px",fontSize:11,color:T.accent,cursor:"pointer",whiteSpace:"nowrap"}}>+ Sauvegarder</button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, T, isDark, toggleTheme, members }) {
  const [username, setUsername] = useState("");
  const [code, setCode]         = useState("");
  const [error, setError]       = useState("");
  const [shake, setShake]       = useState(false);
  const [isMobile, setIsMobile] = useState(()=>window.innerWidth<640);
  useEffect(()=>{ const h=()=>setIsMobile(window.innerWidth<640); window.addEventListener("resize",h); return ()=>window.removeEventListener("resize",h); },[]);
  const allUsers = [...members, ADMIN];

  const attempt = () => {
    const user = allUsers.find(u=>u.username.toLowerCase()===username.toLowerCase()&&u.code===code.trim());
    if (user) onLogin(user.username);
    else { setError("Nom ou code invalide."); setShake(true); setTimeout(()=>setShake(false),600); }
  };

  const sidebarColor = T.sidebar;

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:T.bg, padding: isMobile ? "20px 16px" : "24px"}}>
      <style>{CSS(T)}</style>
      <button onClick={toggleTheme} style={{position:"fixed",top:16,right:16,background:T.bgCard,
        border:`1px solid ${T.border}`,borderRadius:10,padding:"8px 12px",fontSize:15,cursor:"pointer",color:T.text,zIndex:10}}>
        {isDark?"☀️":"🌙"}
      </button>

      {isMobile ? (
        /* ── Mobile login : stacked ── */
        <div style={{width:"100%",maxWidth:400,animation:shake?"shake 0.5s":"fadeUp 0.5s both"}}>
          {/* Top card */}
          <div style={{background:`linear-gradient(145deg, ${T.sidebarBg||sidebarColor}, ${sidebarColor})`,
            borderRadius:"20px 20px 0 0",padding:"32px 28px 28px",textAlign:"center"}}>
            <div style={{width:52,height:52,borderRadius:14,background:"rgba(255,252,245,0.18)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 16px"}}>🍽️</div>
            <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:30,color:"#fff",
              marginBottom:6,letterSpacing:"-0.5px"}}>Lunch Orders</h1>
            <p style={{color:"rgba(255,252,245,0.55)",fontSize:14}}>Organise les commandes de l'équipe</p>
          </div>
          {/* Bottom form */}
          <div style={{background:T.bgCard,borderRadius:"0 0 20px 20px",padding:"28px",
            boxShadow:"0 16px 40px rgba(44,31,14,0.12)"}}>
            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:T.textSub,marginBottom:6,letterSpacing:"0.06em",textTransform:"uppercase"}}>Ton nom</label>
              <select style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:10,
                color:T.text,padding:"11px 14px",fontSize:14,cursor:"pointer"}}
                value={username} onChange={e=>setUsername(e.target.value)}>
                <option value="">— Sélectionne ton nom —</option>
                {allUsers.map(u=><option key={u.username} value={u.username}>{u.username}</option>)}
              </select>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:T.textSub,marginBottom:6,letterSpacing:"0.06em",textTransform:"uppercase"}}>Code</label>
              <input style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:10,
                color:T.text,padding:"11px 14px",fontSize:14}}
                type="password" value={code} placeholder="••••"
                onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()}/>
            </div>
            {error && <p style={{color:T.red,fontSize:13,marginBottom:14}}>{error}</p>}
            <button style={{width:"100%",background:`linear-gradient(135deg, ${T.sidebarBg||sidebarColor}, ${sidebarColor})`,
              color:"#fff",border:"none",borderRadius:12,padding:"13px",
              fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}
              onClick={attempt}>Entrer →</button>
            <p style={{color:T.textFaint,fontSize:11,marginTop:14,textAlign:"center"}}>Ton code = ton numéro de poste</p>
          </div>
        </div>
      ) : (
        /* ── Desktop login : side by side ── */
        <div style={{display:"flex",width:"100%",maxWidth:860,borderRadius:24,overflow:"hidden",
          boxShadow:"0 24px 80px rgba(44,31,14,0.15)",border:`1px solid ${T.border}`,
          animation:shake?"shake 0.5s":"fadeUp 0.5s both"}}>

          <div style={{width:260,background:`linear-gradient(160deg, ${T.sidebarBg||sidebarColor} 0%, ${sidebarColor} 100%)`,
            padding:"44px 36px",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
            <div>
              <div style={{width:48,height:48,borderRadius:14,background:"rgba(255,252,245,0.18)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,marginBottom:28}}>🍽️</div>
              <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:26,color:"#fff",
                marginBottom:8,letterSpacing:"-0.5px",lineHeight:1.2}}>Lunch Orders</h1>
              <p style={{color:"rgba(255,252,245,0.5)",fontSize:13,lineHeight:1.6}}>
                Organise les commandes de l'équipe en quelques secondes.
              </p>
            </div>
            <div style={{borderTop:"1px solid rgba(255,252,245,0.12)",paddingTop:20}}>
              {["🍦 Ice Cream","🥪 Snack Merode","🥙 Libanais"].map(item=>(
                <div key={item} style={{color:"rgba(255,252,245,0.45)",fontSize:13,marginBottom:7}}>{item}</div>
              ))}
            </div>
          </div>

          <div style={{flex:1,background:T.bgCard,padding:"44px 40px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:4}}>Bienvenue 👋</h2>
            <p style={{color:T.textSub,fontSize:14,marginBottom:28}}>Connecte-toi pour passer ta commande</p>

            <div style={{marginBottom:14}}>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:T.textSub,marginBottom:6,letterSpacing:"0.06em",textTransform:"uppercase"}}>Ton nom</label>
              <select style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:10,
                color:T.text,padding:"11px 14px",fontSize:14,cursor:"pointer"}}
                value={username} onChange={e=>setUsername(e.target.value)}>
                <option value="">— Sélectionne ton nom —</option>
                {allUsers.map(u=><option key={u.username} value={u.username}>{u.username}</option>)}
              </select>
            </div>
            <div style={{marginBottom:22}}>
              <label style={{display:"block",fontSize:11,fontWeight:600,color:T.textSub,marginBottom:6,letterSpacing:"0.06em",textTransform:"uppercase"}}>Code</label>
              <input style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:10,
                color:T.text,padding:"11px 14px",fontSize:14}}
                type="password" value={code} placeholder="••••"
                onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()}/>
            </div>
            {error && <p style={{color:T.red,fontSize:13,marginBottom:14}}>{error}</p>}
            <button style={{width:"100%",background:`linear-gradient(135deg, ${T.sidebarBg||sidebarColor}, ${sidebarColor})`,
              color:"#fff",border:"none",borderRadius:12,padding:"12px",
              fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif",
              transition:"opacity 0.15s"}}
              onMouseEnter={e=>e.target.style.opacity="0.88"}
              onMouseLeave={e=>e.target.style.opacity="1"}
              onClick={attempt}>Entrer →</button>
            <p style={{color:T.textFaint,fontSize:11,marginTop:16,textAlign:"center"}}>Ton code = ton numéro de poste</p>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuSection({section, T, isAdmin, onSave, onOrder}) {
  const [items, setItems]       = useState(section.items);
  const [editIdx, setEditIdx]   = useState(null);
  const [editItem, setEditItem] = useState({name:"",price:"",desc:""});
  const [newItem, setNewItem]   = useState({name:"",price:"",desc:""});
  const [showAdd, setShowAdd]   = useState(false);

  // sync if parent data changes
  useEffect(()=>{ setItems(section.items); },[section.items]);

  const save = async(updated) => {
    setItems(updated);
    if(onSave) await onSave(section.cat, updated);
  };

  const startEdit = (i) => { setEditIdx(i); setEditItem({...items[i]}); };
  const cancelEdit = () => { setEditIdx(null); };
  const saveEdit = async() => {
    if(!editItem.name.trim()) return;
    const updated = items.map((it,i)=>i===editIdx?{...editItem}:it);
    await save(updated);
    setEditIdx(null);
  };
  const deleteItem = async(i) => {
    const updated = items.filter((_,idx)=>idx!==i);
    await save(updated);
    if(editIdx===i) setEditIdx(null);
  };
  const addItem = async() => {
    if(!newItem.name.trim()) return;
    const updated = [...items, {...newItem}];
    await save(updated);
    setNewItem({name:"",price:"",desc:""});
    setShowAdd(false);
  };

  const inpS = {background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:7,
    color:T.text,padding:"5px 8px",fontSize:12,fontFamily:"'DM Sans',sans-serif"};

  return (
    <div style={{background:T.bgCard,border:`1px solid ${T.border}`,
      borderRadius:14,marginBottom:12,overflow:"hidden",boxShadow:T.shadow}}>
      <div style={{padding:"11px 20px",background:`${section.accent}12`,
        borderBottom:`1px solid ${section.accent}22`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:14,fontWeight:700,color:section.accent,fontFamily:"'Syne',sans-serif"}}>{section.cat}</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,color:section.accent,opacity:0.7}}>{items.length} article{items.length>1?"s":""}</span>
          {isAdmin && (
            <button onClick={()=>setShowAdd(v=>!v)}
              style={{background:section.accent+"18",border:`1px solid ${section.accent}44`,
                color:section.accent,borderRadius:6,padding:"2px 8px",fontSize:11,cursor:"pointer"}}>
              {showAdd?"✕":"+ Ajouter"}
            </button>
          )}
        </div>
      </div>

      <div>
        {items.map((item,i)=>(
          <div key={i} style={{borderBottom:i<items.length-1?`1px solid ${T.borderLight}`:"none"}}>
            {editIdx===i ? (
              /* ── Edit row ── */
              <div style={{padding:"10px 16px",display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",background:T.bgHover}}>
                <input style={{...inpS,flex:2,minWidth:120}} value={editItem.name}
                  onChange={e=>setEditItem(p=>({...p,name:e.target.value}))} placeholder="Nom…"/>
                <input style={{...inpS,width:70}} value={editItem.price}
                  onChange={e=>setEditItem(p=>({...p,price:e.target.value}))} placeholder="Prix…"/>
                <input style={{...inpS,flex:3,minWidth:150}} value={editItem.desc||""}
                  onChange={e=>setEditItem(p=>({...p,desc:e.target.value}))} placeholder="Description (optionnel)…"/>
                <button onClick={saveEdit}
                  style={{background:T.green,color:"#fff",border:"none",borderRadius:7,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:600}}>✓</button>
                <button onClick={cancelEdit}
                  style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:7,padding:"5px 8px",fontSize:12,cursor:"pointer"}}>✕</button>
              </div>
            ) : (
              /* ── Display row ── */
              <div style={{padding:"9px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:T.text}}>{item.name}</div>
                  {item.desc && <div style={{fontSize:11,color:T.textFaint,marginTop:1}}>{item.desc}</div>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                  {item.price && <span style={{fontSize:13,fontWeight:600,color:section.accent}}>€ {item.price}</span>}
                  {onOrder && (
                    <button onClick={()=>onOrder(item)}
                      style={{background:section.accent+"18",border:`1px solid ${section.accent}44`,
                        color:section.accent,borderRadius:20,padding:"3px 10px",fontSize:11,
                        cursor:"pointer",whiteSpace:"nowrap",fontWeight:500}}>
                      + Commander
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button onClick={()=>startEdit(i)}
                        style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,
                          borderRadius:6,padding:"2px 6px",fontSize:11,cursor:"pointer"}}>✏️</button>
                      <button onClick={()=>deleteItem(i)}
                        style={{background:"transparent",border:"none",color:T.textFaint,fontSize:13,cursor:"pointer",padding:2}}>✕</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ── Add row ── */}
      {isAdmin && showAdd && (
        <div style={{padding:"10px 16px",borderTop:`1px solid ${T.borderLight}`,
          display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",background:T.bgHover}}>
          <input style={{...inpS,flex:2,minWidth:120}} value={newItem.name}
            onChange={e=>setNewItem(p=>({...p,name:e.target.value}))}
            onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="Nom…"/>
          <input style={{...inpS,width:70}} value={newItem.price}
            onChange={e=>setNewItem(p=>({...p,price:e.target.value}))} placeholder="Prix…"/>
          <input style={{...inpS,flex:3,minWidth:150}} value={newItem.desc}
            onChange={e=>setNewItem(p=>({...p,desc:e.target.value}))}
            onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="Description (optionnel)…"/>
          <button onClick={addItem}
            style={{background:T.sidebar,color:"#fff",border:"none",borderRadius:7,
              padding:"5px 12px",fontSize:12,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>+ Ajouter</button>
        </div>
      )}
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
const EMOJIS_LIST = ["😊","😎","🤩","🥳","😋","🤔","😴","🤓","👻","🦊","🐱","🐸","🦄","🍕","🌮","🍜","☕","🎮","🎸","🌈","⚡","🔥","💎","🚀"];
const COLORS_LIST = ["#c97a8f","#c97a4a","#5a8f7b","#7a9ab5","#9b7fa6","#c8922a","#5a7a9b","#8f5a7a","#4a8f6a","#9b6a4a"];

function ProfileTab({ user, profiles, members, T, editingProfile, setEditingProfile, db, avatarColor, getInitials }) {
  const myProfile = profiles[user] || {};
  const [draft, setDraft] = useState({
    alias: myProfile.alias||"",
    bio: myProfile.bio||"",
    emoji: myProfile.emoji||"",
    color: myProfile.color||avatarColor(user),
    favoriteOrder: myProfile.favoriteOrder||"",
    funFact: myProfile.funFact||"",
  });
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    const p=profiles[user]||{};
    setDraft({
      alias:p.alias||"", bio:p.bio||"", emoji:p.emoji||"",
      color:p.color||avatarColor(user), favoriteOrder:p.favoriteOrder||"", funFact:p.funFact||"",
    });
  },[profiles[user]]);

  const saveProfile = async() => {
    setSaving(true);
    await setDoc(doc(db,"profiles",user),{...myProfile,...draft,username:user});
    setSaving(false);
    setEditingProfile(false);
  };

  const displayColor = draft.color || avatarColor(user);

  return (
    <div style={{animation:"slideIn 0.25s ease",maxWidth:560,margin:"0 auto"}}>
      <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:20}}>👤 Mon Profil</h1>

      {/* Profile card */}
      <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:16,
        padding:"28px 24px",marginBottom:16,boxShadow:T.shadow,textAlign:"center"}}>
        <div style={{width:80,height:80,borderRadius:"50%",background:displayColor+"22",
          border:`3px solid ${displayColor}`,display:"flex",alignItems:"center",
          justifyContent:"center",fontSize:myProfile.emoji?36:28,fontWeight:700,
          color:displayColor,margin:"0 auto 12px"}}>
          {myProfile.emoji||getInitials(user)}
        </div>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:20,color:T.text,marginBottom:2}}>
          {myProfile.alias||user}
        </h2>
        {myProfile.alias && <p style={{fontSize:13,color:T.textSub,marginBottom:4}}>({user})</p>}
        {myProfile.bio && <p style={{fontSize:13,color:T.textSub,marginBottom:8,fontStyle:"italic"}}>"{myProfile.bio}"</p>}
        {myProfile.favoriteOrder && (
          <div style={{background:T.bgTag,borderRadius:20,padding:"4px 14px",fontSize:12,color:T.textSub,display:"inline-block",marginBottom:4}}>
            🍴 Commande fav : {myProfile.favoriteOrder}
          </div>
        )}
        {myProfile.funFact && <p style={{fontSize:12,color:T.textFaint,marginTop:8}}>💡 {myProfile.funFact}</p>}
        <button onClick={()=>setEditingProfile(!editingProfile)}
          style={{marginTop:16,background:T.sidebar,color:"#fff",border:"none",
            borderRadius:10,padding:"8px 20px",fontSize:13,fontWeight:600,cursor:"pointer"}}>
          {editingProfile?"Annuler":"✏️ Modifier mon profil"}
        </button>
      </div>

      {/* Edit form */}
      {editingProfile && (
        <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:16,padding:"24px",boxShadow:T.shadow,marginBottom:16}}>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:16,color:T.text,marginBottom:16}}>Personnalise ton profil</h3>

          {/* Emoji */}
          <div style={{marginBottom:16}}>
            <label style={{fontSize:11,fontWeight:600,color:T.textSub,display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em"}}>Avatar emoji</label>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              <button onClick={()=>setDraft(p=>({...p,emoji:""}))}
                style={{width:36,height:36,borderRadius:10,border:`2px solid ${!draft.emoji?T.accent:T.border}`,
                  background:!draft.emoji?T.accentLight:"transparent",fontSize:13,cursor:"pointer",color:T.text,fontWeight:700}}>Aa</button>
              {EMOJIS_LIST.map(e=>(
                <button key={e} onClick={()=>setDraft(p=>({...p,emoji:e}))}
                  style={{width:36,height:36,borderRadius:10,border:`2px solid ${draft.emoji===e?T.accent:T.border}`,
                    background:draft.emoji===e?T.accentLight:"transparent",fontSize:20,cursor:"pointer"}}>{e}</button>
              ))}
            </div>
          </div>

          {/* Color */}
          <div style={{marginBottom:16}}>
            <label style={{fontSize:11,fontWeight:600,color:T.textSub,display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.05em"}}>Couleur</label>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {COLORS_LIST.map(c=>(
                <button key={c} onClick={()=>setDraft(p=>({...p,color:c}))}
                  style={{width:28,height:28,borderRadius:"50%",background:c,
                    border:`3px solid ${draft.color===c?"#fff":"transparent"}`,
                    outline:draft.color===c?`3px solid ${c}`:"none",cursor:"pointer"}}/>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div style={{display:"flex",alignItems:"center",gap:10,padding:"10px 14px",
            background:T.bgTag,borderRadius:12,marginBottom:16}}>
            <div style={{width:40,height:40,borderRadius:"50%",background:draft.color+"22",
              border:`2px solid ${draft.color}`,display:"flex",alignItems:"center",justifyContent:"center",
              fontSize:draft.emoji?20:14,fontWeight:700,color:draft.color}}>
              {draft.emoji||getInitials(user)}
            </div>
            <div>
              <div style={{fontSize:14,fontWeight:600,color:T.text}}>{draft.alias||user}</div>
              {draft.bio&&<div style={{fontSize:12,color:T.textSub,fontStyle:"italic"}}>"{draft.bio}"</div>}
            </div>
          </div>

          {[
            {key:"alias",         label:"Surnom / Alias",    placeholder:"ex: Geof, La Patronne…"},
            {key:"bio",           label:"Bio",               placeholder:"ex: Toujours Durum falafel 🥙"},
            {key:"favoriteOrder", label:"Commande favorite", placeholder:"ex: Bicky grande + Mayo"},
            {key:"funFact",       label:"Fun fact",          placeholder:"ex: Je n'aime pas les cornichons 🥒"},
          ].map(({key,label,placeholder})=>(
            <div key={key} style={{marginBottom:12}}>
              <label style={{fontSize:11,fontWeight:600,color:T.textSub,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.05em"}}>{label}</label>
              <input style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:10,
                color:T.text,padding:"9px 14px",fontSize:14,fontFamily:"'DM Sans',sans-serif"}}
                value={draft[key]} onChange={e=>setDraft(p=>({...p,[key]:e.target.value}))}
                placeholder={placeholder}/>
            </div>
          ))}

          <button onClick={saveProfile} disabled={saving}
            style={{width:"100%",background:T.sidebar,color:"#fff",border:"none",
              borderRadius:10,padding:"11px",fontSize:14,fontWeight:600,cursor:"pointer",opacity:saving?0.7:1}}>
            {saving?"Sauvegarde…":"✓ Sauvegarder"}
          </button>
        </div>
      )}

      {/* Team */}
      <div>
        <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:15,color:T.text,marginBottom:12}}>👥 L'équipe</h3>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {[...members.map(m=>m.username),"Admin"].filter(n=>n!==user).map(name=>{
            const p=profiles[name]||{};
            const color=p.color||avatarColor(name);
            return (
              <div key={name} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:12,
                padding:"12px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:T.shadow}}>
                <div style={{width:40,height:40,borderRadius:"50%",background:color+"22",
                  border:`2px solid ${color}`,display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:p.emoji?20:14,fontWeight:700,color,flexShrink:0}}>
                  {p.emoji||getInitials(name)}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:14,fontWeight:600,color:T.text}}>
                    {p.alias||name}
                    {p.alias&&<span style={{fontSize:12,color:T.textSub,marginLeft:6}}>({name})</span>}
                  </div>
                  {p.bio&&<div style={{fontSize:12,color:T.textSub,fontStyle:"italic"}}>"{p.bio}"</div>}
                  {p.funFact&&<div style={{fontSize:11,color:T.textFaint}}>💡 {p.funFact}</div>}
                </div>
              </div>
            );
          })}
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
  const [activity, setActivity]               = useState([]);
  const [unreadActivity, setUnreadActivity]   = useState(0);
  const [lastSeenActivity, setLastSeenActivity] = useState(()=>parseInt(localStorage.getItem("lastSeenActivity")||"0"));
  const [profiles, setProfiles]               = useState({});
  const [editingProfile, setEditingProfile]   = useState(false);
  const [messages, setMessages]     = useState([]);
  const [chatInput, setChatInput]   = useState("");
  const [unreadChat, setUnreadChat] = useState(0);
  const [lastSeenChat, setLastSeenChat] = useState(()=>parseInt(localStorage.getItem("lastSeenChat")||"0"));
  const [activeMenu, setActiveMenu]           = useState("snack");
  const [boubouleSpeciaux, setBoubouleSpeciaux] = useState([
    "Bueno","Oréo","Menthe Choco","Mascarpone Fruits des Bois",
    "Sorbet Cassis 🌿","Sorbet Kiwi Pomme Verte 🌿","Vanille sans sucre",
  ]);
  const [newSpecial, setNewSpecial] = useState("");
  const [menuToast, setMenuToast]   = useState("");
  const [sauceModal, setSauceModal] = useState(null);
  const [boubouleAI, setBoubouleAI] = useState({ loading:false, extracted:null, preview:false }); // {sauceName}
  const [snackMenu, setSnackMenu]       = useState(null);
  const [libanaisMenu, setLibanaisMenu] = useState(null);
  const [boubouleMenuSaved, setBoubouleMenuSaved] = useState(null);
  const [isDark, setIsDark]   = useState(()=>localStorage.getItem("lunch_theme")==="dark");
  const [isMobile, setIsMobile] = useState(()=>window.innerWidth<768);
  const detailTimers = useRef({});
  const T = isDark ? DARK : LIGHT;

  const toggleTheme=()=>{ const n=!isDark; setIsDark(n); localStorage.setItem("lunch_theme",n?"dark":"light"); };

  useEffect(()=>{ const h=()=>setIsMobile(window.innerWidth<768); window.addEventListener("resize",h); return ()=>window.removeEventListener("resize",h); },[]);

  useEffect(()=>{
    const u1=onSnapshot(collection(db,"orders"),    s=>{const d={};s.forEach(x=>{d[x.id]=x.data();});setOrders(d);setStatus("live");}, ()=>setStatus("error"));
    const u2=onSnapshot(doc(db,"config","members"), s=>{
      if(s.exists()&&s.data().list) setMembers(s.data().list);
      else setDoc(doc(db,"config","members"),{list:DEFAULT_MEMBERS});
    });
    const u3=onSnapshot(doc(db,"config","sauces"),  s=>{
      if(s.exists()&&s.data().list) setSauces(s.data().list);
      else setDoc(doc(db,"config","sauces"),{list:DEFAULT_SAUCES});
    });
    const u4=onSnapshot(doc(db,"config","crudites"),s=>{
      if(s.exists()&&s.data().list) setCrudites(s.data().list);
      else setDoc(doc(db,"config","crudites"),{list:DEFAULT_CRUDITES});
    });
    const u4b=onSnapshot(doc(db,"config","boissons"),s=>{
      if(s.exists()&&s.data().list) setBoissons(s.data().list);
      else setDoc(doc(db,"config","boissons"),{list:DEFAULT_BOISSONS});
    });
    const u5=onSnapshot(doc(db,"config","extras"),  s=>{
      if(s.exists()&&s.data().list) setExtras(s.data().list);
      else setDoc(doc(db,"config","extras"),{list:[]});
    });
    const u6=onSnapshot(collection(db,"favorites"), s=>{
      const d={};
      s.forEach(x=>{ const data=x.data(); if(data.list)d[x.id]=data.list; else if(data.choice)d[x.id]=[{id:"fav_legacy",name:"Mon favori",...data}]; else d[x.id]=[]; });
      setFavorites(d);
    });
    const u7=onSnapshot(collection(db,"history"),   s=>{const days=[];s.forEach(x=>days.push({id:x.id,...x.data()}));days.sort((a,b)=>b.id.localeCompare(a.id));setHistory(days);});
    const u8=onSnapshot(doc(db,"payments","today"), s=>{if(s.exists())setPayments(s.data());else setPayments({});});
    const u9=onSnapshot(doc(db,"config","boubouleSpeciaux"), s=>{if(s.exists()&&s.data().list)setBoubouleSpeciaux(s.data().list);});
    const u10=onSnapshot(doc(db,"config","snackMenu"), s=>{if(s.exists()&&s.data().sections)setSnackMenu(s.data().sections);});
    const u11=onSnapshot(doc(db,"config","libanaisMenu"), s=>{if(s.exists()&&s.data().sections)setLibanaisMenu(s.data().sections);});
    const u12=onSnapshot(doc(db,"config","boubouleMenu"), s=>{if(s.exists())setBoubouleMenuSaved(s.data());});
    const u13=onSnapshot(collection(db,"chat"), snap=>{
      const msgs=[];
      snap.forEach(s=>msgs.push({id:s.id,...s.data()}));
      msgs.sort((a,b)=>a.ts-b.ts);
      setMessages(msgs);
      // count unread
      const lastSeen=parseInt(localStorage.getItem("lastSeenChat")||"0");
      setUnreadChat(msgs.filter(m=>m.ts>lastSeen&&m.author!==user).length);
    });
    const u14=onSnapshot(collection(db,"activity"), snap=>{
      const acts=[];
      snap.forEach(s=>acts.push({id:s.id,...s.data()}));
      acts.sort((a,b)=>b.ts-a.ts);
      setActivity(acts.slice(0,50));
      const lastSeen=parseInt(localStorage.getItem("lastSeenActivity")||"0");
      setUnreadActivity(acts.filter(a=>a.ts>lastSeen&&a.author!==user).length);
    });
    const u15=onSnapshot(collection(db,"profiles"), snap=>{
      const d={};
      snap.forEach(s=>{d[s.id]=s.data();});
      setProfiles(d);
    });
    return ()=>{u1();u2();u3();u4();u4b();u5();u6();u7();u8();u9();u10();u11();u12();u13();u14();u15();};
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
  const saveMemberEdit =async()=>{if(!editingMember)return;await pm(members.map(m=>m.username===editingMember.username?editingMember:m));setEditingMember(null);};
  const addSauce     =async()=>{const s=newSauce.trim();   if(s&&!sauces.includes(s))   {await ps([...sauces,s]);    setNewSauce("");}};
  const addCrudite   =async()=>{const c=newCrudite.trim(); if(c&&!crudites.includes(c)) {await pc([...crudites,c]);  setNewCrudite("");}};
  const addBoisson   =async()=>{const b=newBoisson.trim(); if(b&&!boissons.includes(b)) {await pb([...boissons,b]);  setNewBoisson("");}};
  const addExtraCategory=async()=>{const label=newExtraLabel.trim();if(!label||!newExtraApplies.length)return;const id="extra_"+Date.now();const accent=EXTRA_ACCENTS[extras.length%EXTRA_ACCENTS.length];await pe([...extras,{id,label,options:[],appliesTo:newExtraApplies,accent}]);setNewExtraLabel("");setNewExtraApplies([]);};
  const removeExtraCategory=async id=>{await pe(extras.filter(e=>e.id!==id));};
  const addExtraOption=async(extraId)=>{const val=(newExtraOption[extraId]||"").trim();if(!val)return;await pe(extras.map(e=>e.id===extraId?{...e,options:[...e.options,val]}:e));setNewExtraOption(p=>({...p,[extraId]:""}));};
  const removeExtraOption=async(extraId,opt)=>{await pe(extras.map(e=>e.id===extraId?{...e,options:e.options.filter(o=>o!==opt)}:e));};

  const logActivity = async(type, text) => {
    await addDoc(collection(db,"activity"),{author:user,type,text,ts:Date.now()});
  };

  const toggleChoice=async(name,choice)=>{
    const cur=orders[name]||{};
    const opt=LUNCH_OPTIONS.find(o=>o.id===choice);
    if(cur.choice===choice){
      await deleteDoc(doc(db,"orders",name));
      await logActivity("cancel",`${name} a annulé sa commande`);
    } else {
      await setDoc(doc(db,"orders",name),{choice,detail:"",sauces:[],crudites:[],cruditesTout:false,boules:"",boule1:"",boule2:"",snackType:"",frites:"",friteSup:"",sauceFrite:"",boisson:"",extras:{}});
      await logActivity("order",`${name} a commandé ${opt?.emoji||""} ${opt?.label||choice}`);
    }
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
    let updated;
    let extra = {};

    if(field==="crudites") {
      const isNone = value.toLowerCase().includes("aucune");
      if(isNone) {
        // "Aucune crudités" selected → deselect everything else, toggle aucune
        updated = list.includes(value) ? [] : [value];
        extra = { cruditesTout: false };
      } else {
        // normal crudite → remove "aucune" if present, toggle this one
        const withoutNone = list.filter(x=>!x.toLowerCase().includes("aucune"));
        updated = withoutNone.includes(value)
          ? withoutNone.filter(x=>x!==value)
          : [...withoutNone, value];
        // auto-set cruditesTout if all real crudites selected
        const realCrudites = crudites.filter(c=>!c.toLowerCase().includes("aucune"));
        const allSelected = realCrudites.length>0 && realCrudites.every(c=>updated.includes(c));
        extra = { cruditesTout: allSelected };
      }
    } else {
      updated = list.includes(value)?list.filter(x=>x!==value):[...list,value];
    }

    const newOrder={...cur,[field]:updated,...extra};
    setOrders(prev=>({...prev,[name]:newOrder}));
    await setDoc(doc(db,"orders",name),newOrder);
  };
  const toggleCruditesTout=async(name)=>{
    const cur=orders[name]||{};if(!cur.choice)return;
    const wasTout=cur.cruditesTout||false;
    const realCrudites = crudites.filter(c=>!c.toLowerCase().includes("aucune"));
    const updated={...cur,cruditesTout:!wasTout,crudites:!wasTout?[...realCrudites]:[]};
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
    if(!cur) await logActivity("pay",`${user} a marqué ${name} comme payé`);
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
    await logActivity("reset",`${user} a archivé et réinitialisé les commandes du jour`);
  };
  const deleteHistory=async id=>{if(!window.confirm("Supprimer ?"))return;await deleteDoc(doc(db,"history",id));};

  const totalOrdered=names.filter(n=>orders[n]?.choice).length;
  const notOrdered=names.filter(n=>!orders[n]?.choice);
  const counts=LUNCH_OPTIONS.reduce((a,o)=>{a[o.id]=names.filter(n=>orders[n]?.choice===o.id).length;return a;},{});
  const extrasForMeal=choice=>extras.filter(e=>e.appliesTo?.includes(choice));

  const detailCellProps={ sauces,crudites,boissons,extras,T,
    handleDetail,handleSubDetail,toggleMulti,toggleCruditesTout,toggleExtraOption,
    pb,ps,newBoissonInput,setNewBoissonInput,
    boubouleParfums: [
      ...(boubouleMenuSaved?.classiques || [
        {name:"Vanille de Madagascar"},{name:"Kulfi"},{name:"Stracciatella"},
        {name:"Cerise Amarena"},{name:"Caramel Beurre Salé"},{name:"Café"},
        {name:"Spéculoos"},{name:"Sorbet Citron 🌿"},{name:"Noisette du Piémont"},
        {name:"Sorbet Fruit de la Passion 🌿"},{name:"Pistache d'Iran"},{name:"Sorbet Chocolat 70% 🌿"},
      ]),
      ...(boubouleSpeciaux.map(n=>({name:n}))),
    ],
  };

  const inp={ width:"100%", background:T.bgInput, border:`1px solid ${T.border}`, borderRadius:8,
    color:T.text, padding:"8px 12px", fontSize:14, fontFamily:"'DM Sans',sans-serif" };
  const addBtn={ background:T.sidebar, color:"#f5efe6", border:"none", borderRadius:8,
    padding:"8px 18px", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" };

  // Sidebar nav items
  const navItems = [
    { id:"order",    icon:"📋", label:"Commander" },
    { id:"summary",  icon:"📊", label:"Résumé" },
    { id:"chat",     icon:"💬", label:"Chat", badge: unreadChat },
    { id:"notifs",   icon:"🔔", label:"Activité", badge: unreadActivity },
    { id:"favorites",icon:"⭐", label:"Favoris" },
    { id:"history",  icon:"📅", label:"Historique" },
    { id:"menu",     icon:"🍽️", label:"Menu" },
    { id:"profile",  icon:"👤", label:"Profil" },
    { id:"settings", icon:"⚙️", label:"Config" },
  ];

  return (
    <div style={{minHeight:"100vh",display:"flex",background:T.bg}}>
      <style>{CSS(T)}</style>

      {/* ── Sidebar ── */}
      {!isMobile && (
        <aside style={{width:90,background:`linear-gradient(180deg, ${T.sidebarBg||T.sidebar} 0%, ${T.sidebar} 100%)`,
          display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",flexShrink:0,
          zIndex:10, overflow:"visible"}}>

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
              const tabColor = T.bg; // matches page background
              return (
                <div key={item.id} style={{width:"100%",position:"relative",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
                  {/* Sliding tab — uses page bg color */}
                  {isActive && (
                    <div style={{
                      position:"absolute", right:0, width:74, height:56,
                      background:tabColor, borderRadius:"14px 0 0 14px", zIndex:1,
                    }}>
                      {/* top curved notch */}
                      <div style={{position:"absolute",top:-18,right:0,width:18,height:18,
                        background:"transparent",
                        boxShadow:`9px 9px 0 9px ${tabColor}`,
                        borderRadius:"0 0 14px 0"}}/>
                      {/* bottom curved notch */}
                      <div style={{position:"absolute",bottom:-18,right:0,width:18,height:18,
                        background:"transparent",
                        boxShadow:`9px -9px 0 9px ${tabColor}`,
                        borderRadius:"0 14px 0 0"}}/>
                    </div>
                  )}
                  <button
                    onClick={()=>{
                      setTab(item.id);
                      if(item.id==="chat"){
                        const now=Date.now();
                        localStorage.setItem("lastSeenChat",now.toString());
                        setUnreadChat(0);
                      }
                      if(item.id==="notifs"){
                        const now=Date.now();
                        localStorage.setItem("lastSeenActivity",now.toString());
                        setUnreadActivity(0);
                      }
                    }}
                    style={{
                      position:"relative", zIndex:2,
                      width:74, height:56,
                      display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
                      gap:3, border:"none", cursor:"pointer",
                      background:"transparent",
                      color: isActive ? T.accent : "rgba(255,252,245,0.55)",
                      transition:"color 0.2s, opacity 0.2s",
                    }}
                    title={item.label}
                    onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.color="rgba(255,252,245,0.9)"; }}
                    onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.color="rgba(255,252,245,0.55)"; }}
                  >
                    <span style={{fontSize:19,lineHeight:1,position:"relative"}}>
                      {item.icon}
                      {item.id==="chat" && unreadChat>0 && (
                        <span style={{position:"absolute",top:-4,right:-6,background:"#c0553a",color:"#fff",
                          borderRadius:"50%",width:14,height:14,fontSize:9,fontWeight:700,
                          display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {unreadChat>9?"9+":unreadChat}
                        </span>
                      )}
                      {item.id==="notifs" && unreadActivity>0 && (
                        <span style={{position:"absolute",top:-4,right:-6,background:"#c97a4a",color:"#fff",
                          borderRadius:"50%",width:14,height:14,fontSize:9,fontWeight:700,
                          display:"flex",alignItems:"center",justifyContent:"center"}}>
                          {unreadActivity>9?"9+":unreadActivity}
                        </span>
                      )}
                    </span>
                    <span style={{fontSize:8,fontWeight:600,fontFamily:"'DM Sans',sans-serif",
                      letterSpacing:"0.04em",opacity:0.8}}>{item.label}</span>
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
          <nav style={{position:"fixed",bottom:0,left:0,right:0,
            background:T.bgCard, borderTop:`1px solid ${T.border}`,
            display:"flex",zIndex:100,
            paddingBottom:"env(safe-area-inset-bottom,8px)"}}>
            {navItems.map(item=>(
              <button key={item.id} onClick={()=>{
                setTab(item.id);
                if(item.id==="chat"){const now=Date.now();localStorage.setItem("lastSeenChat",now.toString());setLastSeenChat(now);setUnreadChat(0);}
              }}
                style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",
                  justifyContent:"center",gap:3,padding:"10px 0",
                  background:"none",border:"none",cursor:"pointer",
                  color:tab===item.id?T.accent:T.textFaint,
                  borderTop:tab===item.id?`2px solid ${T.accent}`:"2px solid transparent",
                  fontFamily:"'DM Sans',sans-serif",transition:"color 0.15s"}}>
                <span style={{fontSize:20,position:"relative"}}>
                  {item.icon}
                  {item.id==="chat" && unreadChat>0 && (
                    <span style={{position:"absolute",top:-4,right:-6,background:"#c0553a",color:"#fff",
                      borderRadius:"50%",width:14,height:14,fontSize:9,fontWeight:700,
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      {unreadChat>9?"9+":unreadChat}
                    </span>
                  )}
                </span>
                <span style={{fontSize:9,fontWeight:tab===item.id?700:400,letterSpacing:"0.03em"}}>
                  {item.label}
                </span>
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
                  {(user==="Admin" ? names : names.filter(n=>n===user)).map((name,idx)=>{
                    const order=orders[name]||{};
                    const chosen=LUNCH_OPTIONS.find(o=>o.id===order.choice);
                    const canEdit=user===name||user==="Admin";
                    const isMe=user===name;
                    return (
                      <div key={name} className="accordion-card"
                        style={{background:T.bgCard,border:`1.5px solid ${isMe&&chosen?chosen.accent:isMe?T.accent:chosen?chosen.accent+"44":T.border}`,
                          borderRadius:14,overflow:"hidden",boxShadow:T.shadow}}>

                        {/* Row */}
                        <div style={{padding:isMobile?"7px 10px":"12px 16px",display:"flex",alignItems:"center",gap:isMobile?6:12,
                          background:isMe?T.accentLight:"transparent",
                          borderBottom:order.choice?`1px solid ${T.borderLight}`:"none"}}>
                          <span style={{fontSize:10,fontWeight:600,color:T.textFaint,minWidth:14,textAlign:"right"}}>{idx+1}</span>
                          <Avatar name={name} size={isMobile?26:36}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <span style={{fontSize:isMobile?12:14,fontWeight:isMe?700:500,color:isMe?T.accent:T.text}}>{name}</span>
                              {isMe && <span style={{fontSize:8,background:T.bgTag,color:T.textFaint,padding:"1px 4px",borderRadius:10}}>toi</span>}
                            </div>
                            {chosen && <div style={{marginTop:2}}><OrderPills order={order} extras={extras} crudites={crudites}/></div>}
                          </div>
                          {canEdit && (
                            <div style={{display:"flex",gap:3,flexShrink:0}}>
                              {LUNCH_OPTIONS.map(opt=>(
                                <button key={opt.id} onClick={()=>toggleChoice(name,opt.id)}
                                  style={{padding:isMobile?"4px 5px":"5px 10px",borderRadius:20,
                                    fontSize:isMobile?15:11,fontWeight:500,lineHeight:1,
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
                            <span style={{fontSize:isMobile?13:12,background:chosen.bg,color:chosen.accent,
                              padding:"2px 8px",borderRadius:20,fontWeight:500,flexShrink:0}}>{chosen.emoji}</span>
                          )}
                          {user==="Admin" && (
                            <button style={{background:"none",border:"none",color:T.textFaint,fontSize:12,cursor:"pointer",padding:2,flexShrink:0}}
                              onClick={()=>removeMember(name)}>✕</button>
                          )}
                        </div>

                        {/* Expanded */}
                        {order.choice && (
                          <div style={{padding:isMobile?"10px 12px":"16px 16px 16px 70px"}}>
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

          {/* ════ CHAT TAB ════ */}
          {tab==="chat" && (
            <div style={{animation:"slideIn 0.25s ease",display:"flex",flexDirection:"column",height:"calc(100vh - 120px)"}}>
              <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:16}}>💬 Chat</h1>

              {/* Messages */}
              <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,
                padding:"4px 0",marginBottom:12}}>
                {messages.length===0 && (
                  <div style={{textAlign:"center",color:T.textFaint,padding:40,fontSize:14}}>
                    Aucun message pour l'instant.<br/>
                    <span style={{fontSize:12}}>Soyez le premier à écrire ! 👋</span>
                  </div>
                )}
                {messages.map(msg=>{
                  const isMe = msg.author===user;
                  const time = new Date(msg.ts).toLocaleTimeString("fr-BE",{hour:"2-digit",minute:"2-digit"});
                  return (
                    <div key={msg.id} style={{display:"flex",flexDirection:"column",
                      alignItems:isMe?"flex-end":"flex-start",gap:3}}>
                      {!isMe && <span style={{fontSize:11,color:T.textSub,paddingLeft:8}}>{msg.author}</span>}
                      <div style={{display:"flex",alignItems:"flex-end",gap:6,flexDirection:isMe?"row-reverse":"row"}}>
                        {!isMe && <Avatar name={msg.author} size={28}/>}
                        <div style={{
                          background: isMe?T.sidebar:"#fff",
                          color: isMe?"#fff":T.text,
                          border: isMe?"none":`1px solid ${T.border}`,
                          borderRadius: isMe?"16px 16px 4px 16px":"16px 16px 16px 4px",
                          padding:"9px 14px", fontSize:13, maxWidth:"72%",
                          boxShadow:T.shadow, lineHeight:1.5,
                        }}>{msg.text}</div>
                        <span style={{fontSize:10,color:T.textFaint,flexShrink:0}}>{time}</span>
                      </div>
                      {isMe && user==="Admin" && (
                        <button onClick={async()=>{ await deleteDoc(doc(db,"chat",msg.id)); }}
                          style={{background:"none",border:"none",color:T.textFaint,fontSize:10,cursor:"pointer",paddingRight:4}}>
                          Supprimer
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Input */}
              <div style={{display:"flex",gap:8,padding:"10px 0",borderTop:`1px solid ${T.border}`}}>
                <input
                  style={{flex:1,background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:24,
                    color:T.text,padding:"10px 16px",fontSize:14,fontFamily:"'DM Sans',sans-serif"}}
                  value={chatInput}
                  onChange={e=>setChatInput(e.target.value)}
                  onKeyDown={async e=>{
                    if(e.key==="Enter"&&!e.shiftKey&&chatInput.trim()){
                      await addDoc(collection(db,"chat"),{author:user,text:chatInput.trim(),ts:Date.now()});
                      setChatInput("");
                    }
                  }}
                  placeholder="Écris un message…"/>
                <button
                  style={{background:T.sidebar,color:"#fff",border:"none",borderRadius:"50%",
                    width:42,height:42,fontSize:18,cursor:"pointer",flexShrink:0,
                    display:"flex",alignItems:"center",justifyContent:"center"}}
                  onClick={async()=>{
                    if(!chatInput.trim())return;
                    await addDoc(collection(db,"chat"),{author:user,text:chatInput.trim(),ts:Date.now()});
                    setChatInput("");
                  }}>➤</button>
              </div>
            </div>
          )}

          {/* ════ NOTIFICATIONS TAB ════ */}
          {tab==="notifs" && (
            <div style={{animation:"slideIn 0.25s ease"}}>
              <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:20}}>🔔 Activité</h1>
              {activity.length===0 ? (
                <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,
                  padding:"60px 24px",textAlign:"center",color:T.textFaint,boxShadow:T.shadow}}>
                  <div style={{fontSize:32,marginBottom:10}}>🔔</div>
                  <p>Aucune activité pour l'instant.</p>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {activity.map((act,i)=>{
                    const isNew = act.ts > lastSeenActivity && act.author !== user;
                    const time = new Date(act.ts).toLocaleString("fr-BE",{weekday:"short",hour:"2-digit",minute:"2-digit"});
                    const emoji = act.type==="order"?"🛒":act.type==="cancel"?"❌":act.type==="pay"?"💰":act.type==="reset"?"🗑️":"📝";
                    return (
                      <div key={act.id||i} style={{background:isNew?T.accentLight:T.bgCard,
                        border:`1px solid ${isNew?T.accent:T.border}`,borderRadius:12,
                        padding:"10px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:T.shadow}}>
                        <span style={{fontSize:20,flexShrink:0}}>{emoji}</span>
                        <div style={{flex:1}}>
                          <span style={{fontSize:13,color:T.text}}>{act.text}</span>
                        </div>
                        <span style={{fontSize:11,color:T.textFaint,flexShrink:0}}>{time}</span>
                        {isNew && <span style={{width:8,height:8,borderRadius:"50%",background:T.accent,flexShrink:0}}/>}
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
              <div style={{display:"flex",gap:isMobile?8:12,marginBottom:isMobile?16:24,flexWrap:"wrap"}}>
                {LUNCH_OPTIONS.map(opt=>(
                  <div key={opt.id} style={{flex:1,minWidth:isMobile?80:120,background:counts[opt.id]>0?opt.bg:T.bgCard,
                    border:`1.5px solid ${counts[opt.id]>0?opt.accent:T.border}`,borderRadius:12,
                    padding:isMobile?"12px 14px":"18px 20px",boxShadow:T.shadow}}>
                    <div style={{fontSize:isMobile?28:38,fontWeight:800,fontFamily:"'Syne',sans-serif",
                      color:counts[opt.id]>0?opt.accent:T.textFaint,lineHeight:1}}>{counts[opt.id]}</div>
                    <div style={{fontSize:isMobile?11:13,color:counts[opt.id]>0?opt.accent:T.textSub,marginTop:4}}>
                      {opt.emoji} {isMobile?opt.label.split(" ")[0]+" "+opt.label.split(" ").slice(1).join(" "):opt.label}
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

          {/* ════ MENU TAB ════ */}
          {tab==="menu" && (
            <div style={{animation:"slideIn 0.25s ease"}}>
              <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:20}}>🍽️ Menus</h1>

              {/* Banner: current order + link back */}
              {user!=="Admin" && orders[user]?.choice && (
                <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:12,
                  padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",
                  justifyContent:"space-between",gap:12,boxShadow:T.shadow}}>
                  <span style={{fontSize:13,color:T.textSub}}>
                    🛒 Ma commande : <strong style={{color:T.text}}>{formatOrder(orders[user],extras,crudites)||"En cours…"}</strong>
                  </span>
                  <button onClick={()=>setTab("order")}
                    style={{background:T.sidebar,color:"#fff",border:"none",borderRadius:8,
                      padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                    → Voir ma commande
                  </button>
                </div>
              )}
              {user!=="Admin" && !orders[user]?.choice && (
                <div style={{background:T.bgTag,borderRadius:10,padding:"9px 14px",marginBottom:16,
                  fontSize:12,color:T.textSub,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                  <span>💡 Clique sur <strong>+ Commander</strong> sur un item pour pré-remplir ta commande</span>
                  <button onClick={()=>setTab("order")}
                    style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,
                      borderRadius:8,padding:"4px 10px",fontSize:11,cursor:"pointer",whiteSpace:"nowrap",marginLeft:8}}>
                    → Commander
                  </button>
                </div>
              )}

              {/* Sub-tabs */}
              <div style={{display:"flex",gap:8,marginBottom:24,borderBottom:`1px solid ${T.border}`,paddingBottom:0,flexWrap:"wrap"}}>
                {[
                  {id:"snack",     label:"🥪 Snack Merode",   accent:"#c97a4a"},
                  {id:"libanais",  label:"🥙 Snack Libanais",  accent:"#5a8f7b"},
                  {id:"bouboule",  label:"🍦 Bou·Boul·e",      accent:"#c97a8f"},
                ].map(m=>(
                  <button key={m.id} onClick={()=>setActiveMenu(m.id)}
                    style={{padding:"8px 18px",border:"none",borderRadius:"8px 8px 0 0",
                      cursor:"pointer",fontSize:13,fontWeight:activeMenu===m.id?700:400,
                      fontFamily:"'DM Sans',sans-serif",
                      background:activeMenu===m.id?T.bgCard:"transparent",
                      color:activeMenu===m.id?m.accent:T.textSub,
                      borderBottom:activeMenu===m.id?`2px solid ${m.accent}`:"2px solid transparent",
                      transition:"all 0.15s"}}>
                    {m.label}
                  </button>
                ))}
              </div>

              {/* ── Snack Merode ── */}
              {activeMenu==="snack" && (
                <div>
                  <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                    <a href="https://www.takeaway.com/be-fr/menu/snack-merode" target="_blank" rel="noopener noreferrer"
                      style={{fontSize:12,color:T.textSub,textDecoration:"none"}}>
                      📎 Takeaway.com ↗
                    </a>
                    <a href="tel:027355970"
                      style={{fontSize:12,color:T.textSub,textDecoration:"none",display:"flex",alignItems:"center",gap:4}}>
                      📞 02 735 59 70
                    </a>
                  </div>
                  {[
                    { cat:"🥗 Assiettes", accent:"#5a8f7b", items:[
                      {name:"Assiette mixte",              price:"20,00"},
                      {name:"Assiette brochette de boeuf", price:"18,60"},
                      {name:"Assiette brochette de poulet",price:"18,60"},
                      {name:"Assiette pitta",              price:"18,60"},
                      {name:"Assiette kefta",              price:"18,60"},
                      {name:"Assiette falafel",            price:"16,00"},
                      {name:"Assiette cuisse de poulet",   price:"17,00"},
                      {name:"Assiette poulycroc",          price:"13,00"},
                      {name:"Assiette fish",               price:"13,00"},
                      {name:"Assiette chick fingers",      price:"13,00"},
                      {name:"Assiette calamars",           price:"16,00"},
                      {name:"Assiette fricadelle",         price:"13,00"},
                      {name:"Assiette boulette",           price:"13,50"},
                      {name:"Assiette hamburger",          price:"12,00"},
                    ]},
                    { cat:"🫕 Kapsalon", accent:"#9b7fa6", items:[
                      {name:"Kapsalon pita",   price:"14,00"},
                      {name:"Kapsalon poulet", price:"14,00"},
                    ]},
                    { cat:"🥖 Sandwichs", accent:"#c8922a", items:[
                      {name:"Sandwich pitta",             price:"10,00"},
                      {name:"Sandwich poulet",            price:"10,00"},
                      {name:"Sandwich kefta",             price:"10,00"},
                      {name:"Sandwich falafel (4 pièces)",price:"9,50"},
                      {name:"Sandwich poulycroc",         price:"9,00"},
                      {name:"Sandwich fish",              price:"9,00"},
                      {name:"Sandwich fricadelle",        price:"9,00"},
                      {name:"Sandwich mexicano",          price:"9,00"},
                      {name:"Sandwich hamburger",         price:"9,00"},
                    ]},
                    { cat:"🥙 Dürüms", accent:"#c97a4a", items:[
                      {name:"Durum pitta",              price:"10,00"},
                      {name:"Durum poulet",             price:"10,00"},
                      {name:"Durum kefta",              price:"10,00"},
                      {name:"Durum falafel (4 pièces)", price:"9,50"},
                      {name:"Durum poulycroc",          price:"9,00"},
                      {name:"Durum fish",               price:"9,00"},
                      {name:"Durum fricadelle",         price:"9,00"},
                      {name:"Durum mexicano",           price:"9,00"},
                    ]},
                    { cat:"🍔 Burgers", accent:"#9b7fa6", items:[
                      {name:"Burger hamburger",price:"5,50"},
                      {name:"Burger fish",     price:"6,50"},
                      {name:"Burger kefta",    price:"6,50"},
                    ]},
                    { cat:"🍗 Snacks", accent:"#c97a4a", items:[
                      {name:"Poulet",            price:"6,00"},
                      {name:"Boeuf",             price:"6,00"},
                      {name:"Falafel (4 pièces)",price:"4,00"},
                      {name:"Poulycroc",         price:"5,00"},
                      {name:"Fish",              price:"5,00"},
                      {name:"Fricadelle",        price:"4,00"},
                      {name:"Boulette",          price:"4,50"},
                      {name:"Mexicano",          price:"4,50"},
                      {name:"Cuisse de poulet",  price:"5,50"},
                      {name:"Chick fingers",     price:"4,50"},
                    ]},
                    { cat:"🍟 Frites", accent:"#c8922a", items:[
                      {name:"Petite frite", price:"4,80"},
                    ]},
                    { cat:"🫙 Sauces", accent:"#9b7fa6", items:[
                      {name:"Samurai",      price:"1,50"},{name:"Andalouse",    price:"1,50"},
                      {name:"Mayonnaise",   price:"1,50"},{name:"Pili pili",    price:"1,50"},
                      {name:"Tartare",      price:"1,50"},{name:"Ketchup",      price:"1,50"},
                      {name:"Curry ketchup",price:"1,50"},{name:"Cocktail",     price:"1,50"},
                      {name:"Américaine",   price:"1,50"},{name:"Brasil",       price:"1,50"},
                      {name:"Sauce à l'ail",price:"1,50"},{name:"Sauce pita",   price:"1,50"},
                    ]},
                    { cat:"🥤 Boissons", accent:"#7a9ab5", items:[
                      {name:"Coca-Cola 33cl",        price:"2,70"},
                      {name:"Coca-Cola Zero 33cl",   price:"2,70"},
                      {name:"Ayran 25cl",            price:"2,70"},
                      {name:"Tropico Original 33cl", price:"2,70"},
                      {name:"Fanta 33cl",            price:"2,70"},
                      {name:"Ice Tea 33cl",          price:"2,70"},
                      {name:"Oasis pomme poire 33cl",price:"2,70"},
                      {name:"Eau plate 50cl",        price:"2,70"},
                      {name:"Eau pétillante 50cl",   price:"2,70"},
                    ]},
                  ].map(section=>{
                    const saved=snackMenu?.find(s=>s.cat===section.cat);
                    const merged=saved?{...section,items:saved.items}:section;
                    if(user==="Admin") return <MenuSection key={section.cat} section={merged} T={T} isAdmin={true}
                      onSave={async(cat,items)=>{const cur=snackMenu||[];const upd=cur.find(s=>s.cat===cat)?cur.map(s=>s.cat===cat?{...s,items}:s):[...cur,{cat,items}];await setDoc(doc(db,"config","snackMenu"),{sections:upd});}}/>;

                    const toast = (msg) => { setMenuToast(`✓ ${msg}`); setTimeout(()=>setMenuToast(""),2500); };
                    const base = () => orders[user]?.choice==="snack-merode"
                      ? orders[user]
                      : {choice:"snack-merode",sauces:[],crudites:[],cruditesTout:false,boules:"",boule1:"",boule2:"",snackType:"",frites:"",friteSup:"",sauceFrite:"",boisson:"",extras:{}};

                    let onOrder = null;

                    if(section.cat.includes("Dürüm")) {
                      onOrder = async(item)=>{
                        await setDoc(doc(db,"orders",user),{...base(),choice:"snack-merode",snackType:"Durum",detail:item.name.replace(/^Durum\s*/i,"")});
                        toast(item.name);
                      };
                    } else if(section.cat.includes("Sandwich")) {
                      onOrder = async(item)=>{
                        await setDoc(doc(db,"orders",user),{...base(),choice:"snack-merode",snackType:"Bicky",detail:item.name.replace(/^Sandwich\s*/i,"")});
                        toast(item.name);
                      };
                    } else if(section.cat.includes("Burger")) {
                      onOrder = async(item)=>{
                        await setDoc(doc(db,"orders",user),{...base(),choice:"snack-merode",snackType:"Bicky",detail:item.name.replace(/^Burger\s*/i,"")});
                        toast(item.name);
                      };
                    } else if(section.cat.includes("Snack") || section.cat.includes("🍗")) {
                      onOrder = async(item)=>{
                        await setDoc(doc(db,"orders",user),{...base(),choice:"snack-merode",detail:item.name});
                        toast(item.name);
                      };
                    } else if(section.cat.includes("Kapsalon")) {
                      onOrder = async(item)=>{
                        await setDoc(doc(db,"orders",user),{...base(),choice:"snack-merode",detail:item.name});
                        toast(item.name);
                      };
                    } else if(section.cat.includes("Frites")) {
                      onOrder = async(item)=>{
                        const cur=base();
                        // map "Petite frite" → "Petite", "Moyenne" → "Moyenne", "Grande" → "Grande"
                        const size = item.name.replace(/\s*frite\s*/i,"").trim();
                        const mapped = ["Petite","Moyenne","Grande"].find(s=>size.toLowerCase().includes(s.toLowerCase())) || size;
                        await setDoc(doc(db,"orders",user),{...cur,choice:"snack-merode",friteSup:mapped});
                        toast("Frite "+mapped+" ajoutée");
                      };
                    } else if(section.cat.includes("Sauce")) {
                      onOrder = async(item)=>{ setSauceModal({sauceName:item.name}); };
                    } else if(section.cat.includes("Boisson")) {
                      onOrder = async(item)=>{
                        const cur=base();
                        // strip size info for matching (e.g. "Coca-Cola 33cl" → "Coca-Cola")
                        const bName = item.name;
                        if(!boissons.includes(bName)) await pb([...boissons, bName]);
                        await setDoc(doc(db,"orders",user),{...cur,choice:"snack-merode",boisson:bName});
                        toast(bName+" ajoutée");
                      };
                    } else if(section.cat.includes("Assiette")) {
                      onOrder = async(item)=>{
                        await setDoc(doc(db,"orders",user),{...base(),choice:"snack-merode",detail:item.name});
                        toast(item.name);
                      };
                    }

                    return <MenuSection key={section.cat} section={merged} T={T} isAdmin={false}
                      onSave={async(cat,items)=>{const cur=snackMenu||[];const upd=cur.find(s=>s.cat===cat)?cur.map(s=>s.cat===cat?{...s,items}:s):[...cur,{cat,items}];await setDoc(doc(db,"config","snackMenu"),{sections:upd});}}
                      onOrder={onOrder}/>;
                  })}
                  <p style={{fontSize:11,color:T.textFaint,textAlign:"center",marginTop:8}}>
                    Prix Takeaway · peuvent différer sur place
                  </p>
                </div>
              )}

              {/* ── Snack Libanais ── */}
              {activeMenu==="libanais" && (
                <div>
                  <div style={{marginBottom:16}}>
                    <a href="https://deliveroo.be" target="_blank" rel="noopener noreferrer"
                      style={{fontSize:12,color:T.textSub,textDecoration:"none"}}>
                      📎 Deliveroo ↗
                    </a>
                  </div>
                  {[
                    { cat:"🫑 Mezzes Froids", accent:"#5a8f7b", items:[
                      {name:"Hoummous",              price:"9,90", desc:"Purée de pois chiches à l'huile de sésame et jus de citron"},
                      {name:"Mjaddara",              price:"9,90", desc:"Lentilles au blé concassé, oignons et épices orientales"},
                      {name:"Tabbouleh",             price:"9,90", desc:"Persil, blé concassé, tomates, menthe, oignons, huile d'olive"},
                      {name:"Moutabal",              price:"9,90", desc:"Purée d'aubergines grillées, sésame, huile d'olive, citron"},
                      {name:"Fattouch",              price:"9,90", desc:"Pains libanais grillés, légumes frais, citron, huile d'olive"},
                      {name:"Warak Arich Bel Zeit",  price:"9,90", desc:"Feuilles de vignes farcies aux légumes et au riz"},
                      {name:"Bourghoul Bel Banadoura",price:"9,90", desc:"Blé concassé, tomates, oignons et épices orientales"},
                      {name:"Moussaka",              price:"9,90", desc:"Aubergines grillées, sauce tomate, oignons et pois chiches"},
                    ]},
                    { cat:"🔥 Mezzes Chauds", accent:"#c97a4a", items:[
                      {name:"Kellage x4",         price:"10,40", desc:"Pitta farcis au fromage halloumi accompagnés de salade"},
                      {name:"Falafel x4",         price:"10,50", desc:"Croquettes de pois chiches et fèves écrasées"},
                      {name:"Hommos Bel Lahmé",   price:"12,50", desc:"Pois chiches, sésame, viande d'agneau, citron"},
                      {name:"Arayess x4",         price:"12,90", desc:"Pitta farcis à la viande hachée et épices orientales"},
                      {name:"Toshka x4",          price:"12,90", desc:"Pitta farcis à la viande hachée et fromage halloumi"},
                      {name:"Ras Asfour",         price:"12,90", desc:"Morceaux de filet d'agneau poêlés et assaisonnés"},
                    ]},
                    { cat:"🍖 Grillades", accent:"#9b7fa6", items:[
                      {name:"Assiette Mixte Machawi",         price:"19,50", desc:"1 kefta, 1 poulet, 1 agneau + frites et salade ⭐"},
                      {name:"Assiette Lahmeh Machwiyeh x2",  price:"17,90", desc:"2 brochettes d'agneau marinées + frites et salade"},
                      {name:"Assiette Chawarma",              price:"16,50", desc:"Bœuf mariné ou poulet grillé + frites et salade"},
                      {name:"Assiette Kebab Halabi x3",       price:"18,50", desc:"3 brochettes viande hachée, persil, oignons"},
                      {name:"Assiette Chich Taouk x2",        price:"17,50", desc:"2 brochettes poulet à la crème d'ail + frites"},
                      {name:"Assiette Libanaise Végétarienne",price:"16,50", desc:"5 choix végétariens + salade"},
                      {name:"Assiette Libanaise avec Viandes",price:"19,50", desc:"4 choix végétariens + 1 brochette au choix"},
                      {name:"Assiette Halloumi",              price:"11,00", desc:"Halloumi accompagné de salade"},
                      {name:"Assiette Pitta Arabi",           price:"16,90", desc:"Chawarma poulet grillé + frites et salade"},
                      {name:"Assiette Brochette Individuelle",price:"7,50",  desc:"1 brochette poulet, kafta ou agneau"},
                    ]},
                    { cat:"🫓 Pittas Libanaises", accent:"#c8922a", items:[
                      {name:"Pitta Chich Taouk",      price:"9,00", desc:"Poulet grillé mariné à la crème d'ail"},
                      {name:"Pitta Kebab Halabi",     price:"9,00", desc:"Viande hachée au persil et oignons"},
                      {name:"Pitta Chawarma",         price:"9,00", desc:"Bœuf mariné ou poulet grillé à la flamme"},
                      {name:"Pitta Végétarien",       price:"9,00", desc:"Omelette de courgettes, hoummous, aubergines"},
                      {name:"Pitta Lahmeh Mechwiyeh", price:"9,00", desc:"Brochette d'agneau mariné et grillé"},
                    ]},
                    { cat:"🍟 Frites", accent:"#c8922a", items:[
                      {name:"Frites", price:"4,50"},
                    ]},
                  ].map(section=>{
                    const saved=libanaisMenu?.find(s=>s.cat===section.cat);
                    const merged=saved?{...section,items:saved.items}:section;
                    if(user==="Admin") return <MenuSection key={section.cat} section={merged} T={T} isAdmin={true}
                      onSave={async(cat,items)=>{const cur=libanaisMenu||[];const upd=cur.find(s=>s.cat===cat)?cur.map(s=>s.cat===cat?{...s,items}:s):[...cur,{cat,items}];await setDoc(doc(db,"config","libanaisMenu"),{sections:upd});}}/>;

                    const toast=(msg)=>{ setMenuToast(`✓ ${msg}`); setTimeout(()=>setMenuToast(""),2500); };
                    const base=()=>orders[user]?.choice==="libanais"?orders[user]
                      :{choice:"libanais",sauces:[],crudites:[],cruditesTout:false,boules:"",boule1:"",boule2:"",snackType:"",frites:"",friteSup:"",sauceFrite:"",boisson:"",extras:{}};

                    let onOrder = null;
                    if(!section.cat.includes("Frites")) {
                      onOrder = async(item)=>{
                        await setDoc(doc(db,"orders",user),{...base(),choice:"libanais",detail:item.name});
                        toast(item.name);
                      };
                    }

                    return <MenuSection key={section.cat} section={merged} T={T} isAdmin={false}
                      onSave={async(cat,items)=>{const cur=libanaisMenu||[];const upd=cur.find(s=>s.cat===cat)?cur.map(s=>s.cat===cat?{...s,items}:s):[...cur,{cat,items}];await setDoc(doc(db,"config","libanaisMenu"),{sections:upd});}}
                      onOrder={onOrder}/>;
                  })}
                  <p style={{fontSize:11,color:T.textFaint,textAlign:"center",marginTop:8}}>
                    Prix Deliveroo · peuvent différer sur place · Minimum de commande : 5 €
                  </p>
                </div>
              )}

              {/* ── Bou·Boul·e ── */}
              {activeMenu==="bouboule" && (
                <div>
                  {/* Header card */}
                  <div style={{background:"linear-gradient(135deg, #f5c6d0, #e8a0b0)",borderRadius:16,
                    padding:"24px",marginBottom:20,textAlign:"center",boxShadow:T.shadow,position:"relative"}}>
                    <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:28,
                      color:"#fff",letterSpacing:"-0.5px",marginBottom:4}}>BOU·BOUL·E</div>
                    <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"rgba(255,255,255,0.85)",
                      fontStyle:"italic"}}>Parfums de la semaine</div>
                    {/* Admin: upload button */}
                    {user==="Admin" && (
                      <label style={{position:"absolute",top:12,right:12,
                        background:"rgba(255,255,255,0.25)",border:"1px solid rgba(255,255,255,0.4)",
                        borderRadius:10,padding:"6px 12px",fontSize:12,fontWeight:600,
                        color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                        {boubouleAI.loading ? "⏳ Analyse…" : "📸 Mettre à jour"}
                        <input type="file" accept="image/*" style={{display:"none"}}
                          onChange={async(e)=>{
                            const file = e.target.files?.[0];
                            if(!file) return;
                            setBoubouleAI({loading:true, extracted:null, preview:false});
                            try {
                              // Compress image to max 1MB before sending
                              const base64 = await new Promise((res,rej)=>{
                                const img = new Image();
                                img.onload = () => {
                                  const canvas = document.createElement("canvas");
                                  const maxW = 1200;
                                  const scale = Math.min(1, maxW / img.width);
                                  canvas.width = img.width * scale;
                                  canvas.height = img.height * scale;
                                  canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                                  res(canvas.toDataURL("image/jpeg", 0.7).split(",")[1]);
                                };
                                img.onerror = rej;
                                const reader = new FileReader();
                                reader.onload = e => { img.src = e.target.result; };
                                reader.onerror = rej;
                                reader.readAsDataURL(file);
                              });
                              const mediaType = "image/jpeg";

                              const response = await fetch("/api/analyze-image",{
                                method:"POST",
                                headers:{"Content-Type":"application/json"},
                                body: JSON.stringify({ imageBase64: base64, mediaType })
                              });
                              const rawText = await response.text();
                              console.log("API response:", rawText);
                              let parsed;
                              try { parsed = JSON.parse(rawText); }
                              catch(e) { throw new Error("Réponse serveur invalide: " + rawText.slice(0,200)); }
                              if(parsed.error) throw new Error(parsed.error + (parsed.detail?" — "+parsed.detail:""));
                              setBoubouleAI({loading:false, extracted:parsed, preview:true});
                            } catch(err) {
                              console.error(err);
                              setBoubouleAI({loading:false, extracted:null, preview:false});
                              alert("Erreur lors de l'analyse. Réessaie.");
                            }
                            e.target.value="";
                          }}/>
                      </label>
                    )}
                  </div>

                  {/* AI Preview Modal */}
                  {boubouleAI.preview && boubouleAI.extracted && (
                    <div style={{background:T.bgCard,border:`2px solid #c97a8f`,borderRadius:14,
                      padding:"20px",marginBottom:16,boxShadow:T.shadow}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                        <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:"#c97a8f"}}>
                          ✨ Parfums détectés — confirmer ?
                        </h3>
                        <button onClick={()=>setBoubouleAI({loading:false,extracted:null,preview:false})}
                          style={{background:"none",border:"none",color:T.textFaint,fontSize:18,cursor:"pointer"}}>✕</button>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                        {["classiques","speciaux"].map(cat=>(
                          <div key={cat}>
                            <p style={{fontSize:12,fontWeight:600,color:T.textSub,marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"}}>
                              {cat==="classiques"?"🍨 Classiques":"✨ Spéciaux"}
                            </p>
                            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                              {(boubouleAI.extracted[cat]||[]).map(n=>(
                                <span key={n} style={{background:"#f5c6d022",border:"1px solid #c97a8f44",
                                  borderRadius:20,padding:"3px 10px",fontSize:12,color:T.text}}>{n}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={async()=>{
                          const {classiques=[],speciaux=[]}=boubouleAI.extracted;
                          // Save classiques
                          await setDoc(doc(db,"config","boubouleMenu"),{
                            ...(boubouleMenuSaved||{}),
                            classiques:classiques.map(n=>({name:n}))
                          });
                          // Save speciaux
                          setBoubouleSpeciaux(speciaux);
                          await setDoc(doc(db,"config","boubouleSpeciaux"),{list:speciaux});
                          setBoubouleAI({loading:false,extracted:null,preview:false});
                          setMenuToast("✓ Parfums mis à jour !");
                          setTimeout(()=>setMenuToast(""),3000);
                        }} style={{flex:1,background:"#c97a8f",color:"#fff",border:"none",borderRadius:10,
                          padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                          ✓ Confirmer et sauvegarder
                        </button>
                        <button onClick={()=>setBoubouleAI({loading:false,extracted:null,preview:false})}
                          style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,
                            borderRadius:10,padding:"10px 16px",fontSize:13,cursor:"pointer"}}>
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Les classiques */}
                  <MenuSection key="classiques" section={{
                    cat:"🍨 Les classiques", accent:"#c97a8f",
                    items: boubouleMenuSaved?.classiques || [
                      {name:"Vanille de Madagascar"},{name:"Kulfi"},
                      {name:"Stracciatella"},{name:"Cerise Amarena"},
                      {name:"Caramel Beurre Salé"},{name:"Café"},
                      {name:"Spéculoos"},{name:"Sorbet Citron 🌿"},
                      {name:"Noisette du Piémont"},{name:"Sorbet Fruit de la Passion 🌿"},
                      {name:"Pistache d'Iran"},{name:"Sorbet Chocolat 70% 🌿"},
                    ]
                  }} T={T} isAdmin={user==="Admin"}
                    onSave={async(cat,items)=>{
                      const cur=boubouleMenuSaved||{};
                      await setDoc(doc(db,"config","boubouleMenu"),{...cur,classiques:items});
                    }}
                    onOrder={user!=="Admin" ? async(item)=>{
                      const cur=orders[user]||{};
                      const already = cur.choice==="ice-cream";
                      const b1 = already ? (cur.boule1||"") : "";
                      const b2 = already ? (cur.boule2||"") : "";
                      const newB1 = b1 || item.name;
                      const newB2 = b1 && !b2 ? item.name : b2;
                      const boules = newB2 ? "2 boules" : "1 boule";
                      await setDoc(doc(db,"orders",user),{
                        ...(already?cur:{sauces:[],crudites:[],cruditesTout:false,snackType:"",frites:"",friteSup:"",sauceFrite:"",boisson:"",extras:{}}),
                        choice:"ice-cream", boules, boule1:newB1, boule2:newB2,
                      });
                      setMenuToast(`✓ ${item.name} ajouté !`);
                      setTimeout(()=>setMenuToast(""),2500);
                    }:null}/>

                  {/* Les spéciaux */}
                  <MenuSection key="speciaux" section={{
                    cat:"✨ Les spéciaux", accent:"#9b7fa6",
                    items: boubouleSpeciaux.map(n=>({name:n}))
                  }} T={T} isAdmin={user==="Admin"}
                    onSave={async(cat,items)=>{
                      const list=items.map(i=>i.name);
                      setBoubouleSpeciaux(list);
                      await setDoc(doc(db,"config","boubouleSpeciaux"),{list});
                    }}
                    onOrder={user!=="Admin" ? async(item)=>{
                      const cur=orders[user]||{};
                      const already = cur.choice==="ice-cream";
                      const b1 = already ? (cur.boule1||"") : "";
                      const b2 = already ? (cur.boule2||"") : "";
                      const newB1 = b1 || item.name;
                      const newB2 = b1 && !b2 ? item.name : b2;
                      const boules = newB2 ? "2 boules" : "1 boule";
                      await setDoc(doc(db,"orders",user),{
                        ...(already?cur:{sauces:[],crudites:[],cruditesTout:false,snackType:"",frites:"",friteSup:"",sauceFrite:"",boisson:"",extras:{}}),
                        choice:"ice-cream", boules, boule1:newB1, boule2:newB2,
                      });
                      setMenuToast(`✓ ${item.name} ajouté !`);
                      setTimeout(()=>setMenuToast(""),2500);
                    }:null}/>

                  <p style={{fontSize:11,color:T.textFaint,textAlign:"center",marginTop:8}}>
                    🌿 = végane · Parfums mis à jour chaque semaine par l'Admin
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Sauce modal */}
          {sauceModal && (
            <div style={{position:"fixed",inset:0,background:"rgba(44,31,14,0.4)",backdropFilter:"blur(4px)",
              display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}}
              onClick={e=>e.target===e.currentTarget&&setSauceModal(null)}>
              <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:16,
                padding:"24px",width:300,boxShadow:"0 24px 60px rgba(44,31,14,0.15)"}}>
                <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:T.text,marginBottom:6}}>
                  🫙 {sauceModal.sauceName}
                </h3>
                <p style={{fontSize:13,color:T.textSub,marginBottom:16}}>Où ajouter cette sauce ?</p>
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  <button style={{background:"#9b7fa618",border:"1px solid #9b7fa644",color:"#9b7fa6",
                    borderRadius:10,padding:"10px",fontSize:13,cursor:"pointer",fontWeight:500}}
                    onClick={async()=>{
                      const s=sauceModal.sauceName;
                      const cur=orders[user]?.choice==="snack-merode"?orders[user]
                        :{choice:"snack-merode",sauces:[],crudites:[],cruditesTout:false,boules:"",boule1:"",boule2:"",snackType:"",frites:"",friteSup:"",sauceFrite:"",boisson:"",extras:{}};
                      const newSauces=[...(cur.sauces||[])];
                      if(!newSauces.includes(s)) newSauces.push(s);
                      // auto-add to list if missing
                      const updatedList = sauces.includes(s) ? sauces : [...sauces, s];
                      if(!sauces.includes(s)) await ps(updatedList);
                      await setDoc(doc(db,"orders",user),{...cur,choice:"snack-merode",sauces:newSauces});
                      setMenuToast(`✓ ${s} ajoutée au snack`);
                      setTimeout(()=>setMenuToast(""),2500);
                      setSauceModal(null);
                    }}>
                    🫙 Sauce dans le snack
                  </button>
                  <button style={{background:"#c8922a18",border:"1px solid #c8922a44",color:"#c8922a",
                    borderRadius:10,padding:"10px",fontSize:13,cursor:"pointer",fontWeight:500}}
                    onClick={async()=>{
                      const s=sauceModal.sauceName;
                      const cur=orders[user]?.choice==="snack-merode"?orders[user]
                        :{choice:"snack-merode",sauces:[],crudites:[],cruditesTout:false,boules:"",boule1:"",boule2:"",snackType:"",frites:"",friteSup:"",sauceFrite:"",boisson:"",extras:{}};
                      // auto-add to list if missing
                      if(!sauces.includes(s)) await ps([...sauces, s]);
                      await setDoc(doc(db,"orders",user),{...cur,choice:"snack-merode",sauceFrite:s});
                      setMenuToast(`✓ ${s} ajoutée aux frites`);
                      setTimeout(()=>setMenuToast(""),2500);
                      setSauceModal(null);
                    }}>
                    🥣 Sauce pour les frites
                  </button>
                  <button style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,
                    borderRadius:10,padding:"8px",fontSize:12,cursor:"pointer"}}
                    onClick={()=>setSauceModal(null)}>Annuler</button>
                </div>
              </div>
            </div>
          )}

          {/* Menu toast */}
          {menuToast && (
            <div style={{position:"fixed",bottom:32,left:"50%",transform:"translateX(-50%)",
              background:T.bgCard,border:`1px solid ${T.border}`,color:T.accent,
              padding:"10px 20px",fontSize:13,borderRadius:12,animation:"toastIn 0.3s ease",
              zIndex:999,boxShadow:T.shadow,display:"flex",alignItems:"center",gap:10}}>
              <span>{menuToast}</span>
              <button onClick={()=>setTab("order")}
                style={{background:T.sidebar,color:"#fff",border:"none",borderRadius:7,
                  padding:"4px 10px",fontSize:11,cursor:"pointer",fontWeight:600}}>
                → Commander
              </button>
            </div>
          )}
          {/* ════ PROFILE TAB ════ */}
          {tab==="profile" && (
            <ProfileTab user={user} profiles={profiles} members={members} T={T}
              editingProfile={editingProfile} setEditingProfile={setEditingProfile}
              db={db} avatarColor={avatarColor} getInitials={getInitials}/>
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
                              <button style={{...addBtn,padding:"5px 12px",fontSize:12,background:T.green}} onClick={saveMemberEdit}>✓</button>
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