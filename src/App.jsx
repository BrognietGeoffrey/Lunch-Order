import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, addDoc } from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";

// ── Firebase (valeurs dans .env / variables d'environnement Vercel) ───────────
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId:             import.meta.env.VITE_FIREBASE_APP_ID,
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const auth = getAuth(fbApp);

// ── Structure vide d'une commande (schéma, pas des données) ───────────────────
const EMPTY_ORDER = {
  detail:"", sauces:[], crudites:[], cruditesTout:false,
  boules:"", boule1:"", boule2:"",
  snackType:"", frites:"", friteSup:"", sauceFrite:"", boisson:"", extras:{},
};

// ── Palettes d'interface (UI, pas des données métier) ─────────────────────────
const EXTRA_ACCENTS = ["#9b7fa6","#c97a4a","#5a8f7b","#7a9ab5","#b5836a","#6b8f6b"];
const EMOJIS_LIST = ["😊","😎","🤩","🥳","😋","🤔","😴","🤓","👻","🦊","🐱","🐸","🦄","🍕","🌮","🍜","☕","🎮","🎸","🌈","⚡","🔥","💎","🚀"];
const COLORS_LIST = ["#c97a8f","#c97a4a","#5a8f7b","#7a9ab5","#9b7fa6","#c8922a","#5a7a9b","#8f5a7a","#4a8f6a","#9b6a4a"];

// ── Themes ────────────────────────────────────────────────────────────────────
const LIGHT = {
  isDark: false,
  sidebar:      "#1a1a2e",
  sidebarBg:    "#16213e",
  sidebarText:  "rgba(255,255,255,0.6)",
  sidebarActive:"#ffffff",
  sidebarHover: "rgba(255,255,255,0.1)",
  sidebarBorder:"rgba(255,255,255,0.08)",
  bg:          "#f0f2f5",
  bgCard:      "#ffffff",
  bgHover:     "#f5f7fa",
  bgInput:     "#f5f7fa",
  bgTag:       "#e8eaed",
  border:      "#d0d3d8",
  borderLight: "#e4e6ea",
  text:        "#0a0a0a",
  textSub:     "#3a3a3a",
  textFaint:   "#6b6b6b",
  accent:      "#3b5bdb",
  accentLight: "#e8edff",
  green:       "#2f9e44",
  red:         "#c92a2a",
  shadow:      "0 2px 12px rgba(0,0,0,0.08)",
  shadowHover: "0 4px 20px rgba(0,0,0,0.12)",
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

// ── Helpers génériques ────────────────────────────────────────────────────────
function getInitials(name) { return (name||"?").split(" ").map(w=>w[0]).join("").toUpperCase().slice(0,2); }

function avatarColor(name) {
  const colors = ["#9b7fa6","#c97a4a","#5a8f7b","#7a9ab5","#b5836a","#8f7a5a","#c97a8f","#6b8f9b"];
  let h = 0; for (let c of (name||"")) h = (h*31+c.charCodeAt(0))%colors.length;
  return colors[Math.abs(h)];
}
function parsePrice(p){
  if(p==null || p==="") return null;
  const n=parseFloat(String(p).replace(/[^0-9.,]/g,"").replace(",","."));
  return isNaN(n)?null:n;
}
function normName(s){
  return (s||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
}
function fmtEuro(n){ return "€ "+Number(n||0).toFixed(2).replace(".",","); }
function priceToInput(p){ const n=parsePrice(p); return n==null ? "" : n.toFixed(2).replace(".",","); }
function escapeRe(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
function stripPrefix(name, prefix){
  if(!prefix) return name;
  return name.replace(new RegExp("^"+escapeRe(prefix)+"\\s*","i"),"").trim();
}

// ── Helpers restaurants (tout vient de config/restaurants) ────────────────────
// kind : "snack" (composition durum/bicky/crudités), "plat" (choix dans le menu), "glace" (boules)
// section.action.type : "main" | "frite" | "sauce" | "boisson" | "scoop" | "none"
const findResto   = (restaurants, id) => (restaurants||[]).find(r=>r.id===id);
const sectionsOf  = r => r?.sections || [];
const actionType  = s => s?.action?.type || "main";
const sectionsByAction = (r, type) => sectionsOf(r).filter(s=>actionType(s)===type);
const scoopOptions = r => r?.scoopOptions || [];
const scoopCount   = (r, label) => scoopOptions(r).find(o=>o.label===label)?.count || (label?1:0);
const parfumsOf    = r => sectionsByAction(r,"scoop").flatMap(s=>s.items||[]);
const friteSizes   = r => sectionsByAction(r,"frite").flatMap(s=>s.items||[]);
const restoLabel   = r => r?.recapLabel || r?.label || "?";

function snackTypesOf(r){
  const out=[];
  sectionsOf(r).forEach(s=>{ const t=s.action?.snackType; if(t && !out.includes(t)) out.push(t); });
  return out;
}
function snackVariants(r, snackType){
  return sectionsOf(r).filter(s=>s.action?.snackType===snackType).flatMap(s=>
    (s.items||[]).map(it=>({ label: stripPrefix(it.name, s.action.prefix), price: parsePrice(it.price) }))
  );
}
function mainVariantsGrouped(r){
  return sectionsByAction(r,"main").map(s=>({
    cat:s.cat, items:(s.items||[]).map(it=>({label:it.name, price:parsePrice(it.price)})),
  }));
}

// ── Suppléments : prix ────────────────────────────────────────────────────────
function extraOptPrice(ex, opt) {
  const p = ex?.prices?.[opt];
  if (p==null || p==="" || isNaN(Number(p))) return null;
  return Number(p);
}
function extraLabel(ex, opt) {
  const p = extraOptPrice(ex, opt);
  return p!=null ? `${opt} (+${fmtEuro(p)})` : opt;
}

// ── Formatage des commandes ───────────────────────────────────────────────────
// ctx = { restaurants, extras, crudites }
function formatCrudites(o, allCrudites) {
  if (!o.crudites?.length) return null;
  const isNoneSelected = o.crudites.every(c=>c.toLowerCase().includes("aucune"));
  if (isNoneSelected) return "Aucune crudité";
  if (o.cruditesTout) {
    const realCrudites = (allCrudites||[]).filter(c=>!c.toLowerCase().includes("aucune"));
    const selected = o.crudites.filter(c=>!c.toLowerCase().includes("aucune"));
    const excl = realCrudites.filter(c=>!selected.includes(c));
    return excl.length > 0 ? "Tout sauf: "+excl.join(", ") : "Toutes crudités";
  }
  const selected = o.crudites.filter(c=>!c.toLowerCase().includes("aucune"));
  return selected.length ? "Crudités: "+selected.join(", ") : null;
}

function formatOrderFull(o, ctx={}) {
  if (!o?.choice) return [];
  const r = findResto(ctx.restaurants, o.choice);
  const extras = ctx.extras || [];
  const lines = [];
  const pushExtras = () => extras.filter(ex=>ex.appliesTo?.includes(o.choice)).forEach(ex=>{
    (o.extras||{})[ex.id]?.forEach(opt=>lines.push({ emoji:"➕", text: extraLabel(ex,opt) }));
  });
  if (r?.kind==="snack") {
    const firstPart = [o.snackType, o.detail].filter(Boolean).join(" ");
    if (firstPart) lines.push({ emoji:r.emoji||"🥙", text: firstPart });
    pushExtras();
    if (o.frites)     lines.push({ emoji:"🍟", text: o.frites });
    if (o.friteSup)   lines.push({ emoji:"🍟", text: "Frite sup. "+o.friteSup });
    if (o.sauceFrite) lines.push({ emoji:"🥣", text: "Sauce frite: "+o.sauceFrite });
    const cru = formatCrudites(o, ctx.crudites);
    if (cru)          lines.push({ emoji:"🥗", text: cru });
    if (o.sauces?.length) lines.push({ emoji:"🫙", text: o.sauces.join(", ") });
    if (o.boisson)    lines.push({ emoji:"🥤", text: o.boisson });
  } else if (r?.kind==="glace") {
    if (o.boules)  lines.push({ emoji:r.emoji||"🍦", text: o.boules });
    if (scoopCount(r,o.boules)>=2 && o.boule1 && o.boule2) lines.push({ emoji:"✨", text: `${o.boule1} + ${o.boule2}` });
    else if (o.boule1) lines.push({ emoji:"✨", text: o.boule1 });
    else if (o.detail) lines.push({ emoji:"✨", text: o.detail });
    pushExtras();
  } else {
    if (o.detail)  lines.push({ emoji:r?.emoji||"🍽️", text: o.detail });
    pushExtras();
    if (o.boisson) lines.push({ emoji:"🥤", text: o.boisson });
  }
  return lines;
}
function formatOrder(o, ctx) {
  return formatOrderFull(o,ctx).map(l=>l.text).join(" · ");
}

// ── Prix & récap ──────────────────────────────────────────────────────────────
function buildPriceIndex(r){
  const idx={};
  sectionsOf(r).forEach(s=>(s.items||[]).forEach(it=>{ const p=parsePrice(it.price); if(p!=null) idx[normName(it.name)]=p; }));
  return idx;
}
function mainCandidates(order, r){
  const d=order.detail||"";
  if(r?.kind==="snack" && order.snackType){
    const c=sectionsOf(r).filter(s=>s.action?.snackType===order.snackType)
      .map(s=>((s.action.prefix||"")+" "+d).trim());
    return [...c, d];
  }
  return [d];
}
function lookup(idx, candidates){
  for(const c of (candidates||[])){ const k=normName(c); if(k && idx[k]!=null) return {name:c, price:idx[k]}; }
  return null;
}
function extraPricedLines(order, extras){
  const out=[];
  (extras||[]).filter(ex=>ex.appliesTo?.includes(order.choice)).forEach(ex=>{
    ((order.extras||{})[ex.id]||[]).forEach(opt=>{
      out.push({label:"+ "+opt, price:extraOptPrice(ex,opt), optional:true, opt});
    });
  });
  return out;
}
function scoopLine(order, r){
  const fl=[order.boule1,order.boule2].filter(Boolean).join(" + ");
  const so=scoopOptions(r).find(o=>o.label===order.boules);
  return { label:(order.boules||"Glace"), flavours:fl, price: so ? parsePrice(so.price) : null };
}
function orderPricedLines(order, ctx={}){
  const lines=[];
  if(!order || !order.choice) return {lines, total:0, hasUnpriced:false, empty:true};
  const r=findResto(ctx.restaurants, order.choice);
  if(r?.kind==="glace"){
    const s=scoopLine(order, r);
    lines.push({label:s.label+(s.flavours?" · "+s.flavours:""), price:s.price});
  } else {
    const idx=buildPriceIndex(r);
    const main=lookup(idx, mainCandidates(order, r));
    const mainLabel=[order.snackType,order.detail].filter(Boolean).join(" ").trim()||order.detail||"Commande";
    lines.push({label:mainLabel, price:main?main.price:null});
    lines.push(...extraPricedLines(order, ctx.extras));
    if(order.friteSup){
      const f=friteSizes(r).find(it=>normName(it.name)===normName(order.friteSup));
      lines.push({label:"Frite "+order.friteSup, price:f?parsePrice(f.price):null});
    }
    if(order.boisson){
      let bp=idx[normName(order.boisson)];
      if(bp==null){ const key=Object.keys(idx).find(k=>k.startsWith(normName(order.boisson))); if(key) bp=idx[key]; }
      lines.push({label:order.boisson, price:(bp!=null?bp:null)});
    }
  }
  if(r?.kind==="glace") lines.push(...extraPricedLines(order, ctx.extras));
  const total=lines.reduce((a,l)=>a+(l.price||0),0);
  const hasUnpriced=lines.some(l=>l.price==null && !l.optional);
  return {lines, total, hasUnpriced, empty:false};
}
function buildRestoRecap(names, orders, ctx={}){
  const groups={};
  (ctx.restaurants||[]).forEach(r=>{ groups[r.id]={}; });
  (names||[]).forEach(n=>{
    const o=orders[n]; if(!o||!o.choice) return;
    const r=findResto(ctx.restaurants, o.choice); if(!r) return;
    let label, price;
    if(r.kind==="glace"){
      const s=scoopLine(o, r);
      label=s.label+(s.flavours?" ("+s.flavours+")":"");
      price=s.price;
    } else {
      const m=lookup(buildPriceIndex(r), mainCandidates(o, r));
      label = m ? m.name : ([o.snackType,o.detail].filter(Boolean).join(" ").trim()||o.detail||"Commande");
      price = m ? m.price : null;
    }
    const g=groups[r.id];
    if(!g[label]) g[label]={qty:0, price};
    g[label].qty++;
    extraPricedLines(o, ctx.extras).forEach(l=>{
      const exLabel="Suppl. "+l.opt;
      if(!g[exLabel]) g[exLabel]={qty:0, price:l.price, optional:true};
      g[exLabel].qty++;
    });
  });
  const out=[];
  (ctx.restaurants||[]).forEach(r=>{
    const items=Object.entries(groups[r.id]||{}).map(([label,v])=>({label, qty:v.qty, price:v.price, optional:!!v.optional}));
    if(items.length) out.push({key:r.id, label:restoLabel(r), accent:r.accent, items});
  });
  const total=out.reduce((a,g)=>a+g.items.reduce((b,it)=>b+((it.price||0)*it.qty),0),0);
  const hasUnpriced=out.some(g=>g.items.some(it=>it.price==null && !it.optional));
  return {groups:out, total, hasUnpriced};
}
function restoRecapText(recap){
  let t="Commande midi";
  recap.groups.forEach(g=>{
    t+="\n\n"+g.label;
    g.items.forEach(it=>{ t+="\n  "+it.qty+"\u00d7 "+it.label; });
  });
  t+="\n\nTotal estimé : "+fmtEuro(recap.total);
  return t;
}

// ── Global CSS ────────────────────────────────────────────────────────────────
const CSS = (T) => `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-text-size-adjust: 100%; }
  body { background: ${T.bg}; font-family: 'DM Sans', sans-serif; color: ${T.text}; overflow-x: hidden; }
  img, svg, video, canvas { max-width: 100%; height: auto; }
  textarea { resize: vertical; font-family: inherit; }
  input:focus, textarea:focus, button:focus, select:focus { outline: none; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
  @keyframes fadeUp    { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes shake     { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} }
  @keyframes slideIn   { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
  @keyframes toastIn   { from{opacity:0;transform:translateX(-50%) translateY(12px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
  .row-hover:hover { background: ${T.bgHover} !important; }
  .btn-ghost:hover { background: ${T.bgTag} !important; }
  .avatar-tooltip-wrap:hover .avatar-tooltip { display: block !important; }
  .info-wrap:hover .info-pop { display: block !important; }
`;

// ── Components ────────────────────────────────────────────────────────────────
function Avatar({ name, size=36, profile }) {
  const color = profile?.color || avatarColor(name);
  const emoji = profile?.emoji;
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:color+"22",
      border:`2px solid ${color}44`, display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:emoji?size*0.5:size*0.35, fontWeight:700, color, flexShrink:0, letterSpacing:"-0.5px" }}>
      {emoji || getInitials(name)}
    </div>
  );
}

function StatusDot({ status }) {
  const map = {
    live:       { c:"#2f9e44", t:"En direct" },
    connecting: { c:"#c8922a", t:"Connexion…" },
    error:      { c:"#c92a2a", t:"Hors ligne" },
  };
  const s = map[status] || map.connecting;
  return (
    <span title={s.t} style={{ width:8, height:8, borderRadius:"50%", background:s.c,
      display:"inline-block", flexShrink:0, boxShadow:`0 0 0 3px ${s.c}22` }}/>
  );
}

function Tag({ children, color, bg }) {
  return (
    <span style={{ background:bg||"#f0ebe0", color:color||"#3a3a3a",
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
        color:active?accent:"#3a3a3a", cursor:disabled?"not-allowed":"pointer",
        transition:"all 0.15s", whiteSpace:"nowrap", opacity:disabled?0.35:1 }}>
      {label}
    </button>
  );
}

function OrderPills({ order, ctx }) {
  const lines = formatOrderFull(order, ctx);
  if (!lines.length) return <span style={{fontSize:12,color:"#6b6b6b",fontStyle:"italic"}}>Aucun détail</span>;
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
      {lines.map((line,i)=>(
        <span key={i} style={{background:"#f5f0e8",border:"1px solid #d0d3d8",borderRadius:20,
          padding:"2px 10px",fontSize:11,color:"#3a3a3a",display:"inline-flex",alignItems:"center",
          gap:3,maxWidth:"100%",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"normal",wordBreak:"break-word"}}>
          {line.emoji} {line.text}
        </span>
      ))}
    </div>
  );
}

// ── Detail cell ───────────────────────────────────────────────────────────────
function DetailCell({ name, order, canEdit, restaurant: r, sauces, crudites, boissons, mealExtras,
  handleDetail, handleSubDetail, toggleMulti, toggleCruditesTout, toggleExtraOption, pb, ps, T }) {

  const sauceRef = useRef(null);
  const sauceFriteRef = useRef(null);
  const [localBoisson, setLocalBoisson] = useState("");

  if (!order.choice) return <span style={{fontSize:12,color:T.textFaint}}>{canEdit?"Choisis un plat d'abord…":"🔒"}</span>;
  if (!r) return <span style={{fontSize:12,color:T.textFaint}}>Restaurant introuvable dans la configuration.</span>;

  const accent = r.accent || T.accent;

  const extrasBlock = (mt) => mealExtras.map(ex=>(
    <div key={ex.id} style={mt?{marginTop:6}:undefined}>
      <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>➕ {ex.label}</p>
      <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
        {ex.options.map(o=><Pill key={o} label={extraLabel(ex,o)} active={((order.extras||{})[ex.id]||[]).includes(o)} accent={ex.accent} disabled={!canEdit} onClick={()=>canEdit&&toggleExtraOption(name,ex.id,o)}/>)}
      </div>
    </div>
  ));

  const boissonBlock = (
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
  );

  // ── Glace
  if (r.kind==="glace") {
    const boule1 = order.boule1 || "";
    const boule2 = order.boule2 || "";
    const is2 = scoopCount(r, order.boules)>=2;
    const parfums = parfumsOf(r);
    return (
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div>
          <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>{r.emoji} Format</p>
          <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
            {scoopOptions(r).map(so=>(
              <Pill key={so.label} label={so.label+(parsePrice(so.price)!=null?"  ·  "+fmtEuro(parsePrice(so.price)):"")}
                active={order.boules===so.label} accent={accent}
                disabled={!canEdit} onClick={()=>{
                  if(!canEdit)return;
                  if((so.count||1)<2) handleSubDetail(name,"boule2","");
                  handleSubDetail(name,"boules",order.boules===so.label?"":so.label);
                }}/>
            ))}
          </div>
        </div>
        {order.boules && (
          <div>
            <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>✨ {is2?"Boule 1":"Parfum"}</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {parfums.map(p=>(
                <Pill key={p.name} label={p.name} active={boule1===p.name} accent={accent} disabled={!canEdit}
                  onClick={()=>canEdit&&handleSubDetail(name,"boule1",boule1===p.name?"":p.name)}/>
              ))}
            </div>
          </div>
        )}
        {is2 && (
          <div>
            <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>✨ Boule 2</p>
            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
              {parfums.map(p=>(
                <Pill key={p.name} label={p.name} active={boule2===p.name} accent={accent} disabled={!canEdit}
                  onClick={()=>canEdit&&handleSubDetail(name,"boule2",boule2===p.name?"":p.name)}/>
              ))}
            </div>
          </div>
        )}
        {extrasBlock(false)}
      </div>
    );
  }

  // ── Plat (choix dans le menu)
  if (r.kind!=="snack") {
    const groups=mainVariantsGrouped(r);
    const allLabels=groups.flatMap(g=>g.items.map(i=>i.label));
    const known=allLabels.includes(order.detail);
    const isOther=!!order.detail && !known;
    return (
      <div style={{display:"flex",flexDirection:"column",gap:10}}>
        <div>
          <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>{r.emoji} Commande</p>
          <select value={known?order.detail:(isOther?"__other__":"")} disabled={!canEdit}
            onChange={e=>{ const v=e.target.value; handleDetail(name, v==="__other__"?"":v); }}
            style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,
              color:T.text,padding:"7px 10px",fontSize:13,cursor:canEdit?"pointer":"default",opacity:canEdit?1:0.4}}>
            <option value="">— Choisis ton plat —</option>
            {groups.map(g=>(
              <optgroup key={g.cat} label={g.cat}>
                {g.items.map(it=>(
                  <option key={it.label} value={it.label}>{it.label}{it.price!=null?"  ·  "+fmtEuro(it.price):""}</option>
                ))}
              </optgroup>
            ))}
            <option value="__other__">Autre…</option>
          </select>
          {isOther && (
            <textarea style={{width:"100%",marginTop:5,background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,
              color:T.text,padding:"6px 10px",fontSize:13,lineHeight:1.5,opacity:canEdit?1:0.4}}
              rows={2} disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)} placeholder="Précise ta commande…"/>
          )}
        </div>
        {extrasBlock(false)}
        {boissonBlock}
      </div>
    );
  }

  // ── Snack (composition)
  const snackTypes = snackTypesOf(r);
  return (
    <div style={{display:"flex",flexDirection:"column",gap:12}}>
      <div style={{paddingBottom:12,borderBottom:`1px solid ${T.borderLight}`}}>
        <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>{r.emoji} Sandwich</p>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",marginBottom:6}}>
          {snackTypes.map(o=><Pill key={o} label={o} active={order.snackType===o} accent={accent} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"snackType",order.snackType===o?"":o)}/>)}
        </div>
        {order.snackType && (()=>{
          const variants=snackVariants(r, order.snackType);
          const known=variants.some(v=>v.label===order.detail);
          const isOther=!!order.detail && !known;
          return (
            <div style={{marginBottom:6}}>
              <select value={known?order.detail:(isOther?"__other__":"")} disabled={!canEdit}
                onChange={e=>{ const v=e.target.value; handleDetail(name, v==="__other__"?"":v); }}
                style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,
                  color:T.text,padding:"7px 10px",fontSize:13,cursor:canEdit?"pointer":"default",opacity:canEdit?1:0.4}}>
                <option value="">— Choisis ton {order.snackType} —</option>
                {variants.map(v=>(
                  <option key={v.label} value={v.label}>{v.label}{v.price!=null?"  ·  "+fmtEuro(v.price):""}</option>
                ))}
                <option value="__other__">Autre…</option>
              </select>
              {isOther && (
                <input style={{width:"100%",marginTop:5,background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,
                  color:T.text,padding:"6px 10px",fontSize:12,opacity:canEdit?1:0.4}}
                  disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)}
                  placeholder="Précise…"/>
              )}
            </div>
          );
        })()}
        {!order.snackType && order.detail && (
          <p style={{fontSize:12,color:T.textSub,marginBottom:6}}>🍽️ {order.detail}</p>
        )}
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
          {(r.fritePlacement||[]).map(o=><Pill key={o} label={o} active={order.frites===o} accent="#c97a4a" disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"frites",order.frites===o?"":o)}/>)}
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
        {extrasBlock(true)}
      </div>
      <div style={{paddingBottom:12,borderBottom:`1px solid ${T.borderLight}`}}>
        <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>🍟 Frite extra</p>
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
          {friteSizes(r).map(it=>{
            const p=parsePrice(it.price);
            return <Pill key={it.name} label={it.name+(p!=null?"  ·  "+fmtEuro(p):"")} active={order.friteSup===it.name} accent="#c97a4a" disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"friteSup",order.friteSup===it.name?"":it.name)}/>;
          })}
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
      <div style={{paddingBottom:12,borderBottom:`1px solid ${T.borderLight}`}}>
        <p style={{fontSize:11,color:T.textFaint,marginBottom:5}}>🥗 Crudités</p>
        <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
          <Pill label="Tout" active={order.cruditesTout} accent="#5a8f7b" disabled={!canEdit}
            onClick={()=>canEdit&&toggleCruditesTout(name)}/>
          {crudites.map(c=><Pill key={c} label={c} active={(order.crudites||[]).includes(c)} accent="#5a8f7b" disabled={!canEdit} onClick={()=>canEdit&&toggleMulti(name,"crudites",c)}/>)}
        </div>
      </div>
      {boissonBlock}
    </div>
  );
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, T, isDark, toggleTheme, members, membersLoaded, appConfig, restaurants }) {
  const [username, setUsername] = useState("");
  const [code, setCode]         = useState("");
  const [error, setError]       = useState("");
  const [shake, setShake]       = useState(false);
  const [isMobile, setIsMobile] = useState(()=>window.innerWidth<640);
  useEffect(()=>{ const h=()=>setIsMobile(window.innerWidth<640); window.addEventListener("resize",h); return ()=>window.removeEventListener("resize",h); },[]);

  const title = appConfig.title || "";
  const logo  = appConfig.logoEmoji || "";
  const hint  = appConfig.loginHint || "";
  const sub   = appConfig.subtitle || "";

  const attempt = () => {
    const user = members.find(u=>u.username.toLowerCase()===username.toLowerCase()&&String(u.code)===code.trim());
    if (user) onLogin(user.username);
    else { setError("Nom ou code invalide."); setShake(true); setTimeout(()=>setShake(false),600); }
  };

  const sidebarColor = T.sidebar;

  if (!membersLoaded) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.bg,color:T.textSub,fontSize:14}}>
      <style>{CSS(T)}</style>Chargement…
    </div>
  );

  if (members.length===0) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.bg,padding:24}}>
      <style>{CSS(T)}</style>
      <div style={{maxWidth:420,background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:16,padding:28,boxShadow:T.shadow}}>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontSize:18,color:T.text,marginBottom:8}}>La base de données est vide</h2>
        <p style={{fontSize:13,color:T.textSub,lineHeight:1.6}}>
          Aucun membre n'est configuré dans <code>config/members</code>. Lance le script d'import une fois :
        </p>
        <code style={{display:"block",marginTop:10,fontSize:12,background:T.bgTag,padding:"8px 10px",borderRadius:8,color:T.text}}>
          node --env-file=.env scripts/seed.mjs
        </code>
      </div>
    </div>
  );

  const nameField = (
    <div style={{marginBottom:14}}>
      <label style={{display:"block",fontSize:11,fontWeight:600,color:T.textSub,marginBottom:6,letterSpacing:"0.06em",textTransform:"uppercase"}}>Ton nom</label>
      <select style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:10,
        color:T.text,padding:"11px 14px",fontSize:14,cursor:"pointer"}}
        value={username} onChange={e=>setUsername(e.target.value)}>
        <option value="">— Sélectionne ton nom —</option>
        {members.map(u=><option key={u.username} value={u.username}>{u.username}</option>)}
      </select>
    </div>
  );
  const codeField = (mb) => (
    <div style={{marginBottom:mb}}>
      <label style={{display:"block",fontSize:11,fontWeight:600,color:T.textSub,marginBottom:6,letterSpacing:"0.06em",textTransform:"uppercase"}}>Code</label>
      <input style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:10,
        color:T.text,padding:"11px 14px",fontSize:14}}
        type="password" value={code} placeholder="••••"
        onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()}/>
    </div>
  );
  const submitBtn = (
    <button style={{width:"100%",background:`linear-gradient(135deg, ${T.sidebarBg||sidebarColor}, ${sidebarColor})`,
      color:"#fff",border:"none",borderRadius:12,padding:"13px",
      fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}
      onClick={attempt}>Entrer →</button>
  );

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",
      background:T.bg, padding: isMobile ? "20px 16px" : "24px"}}>
      <style>{CSS(T)}</style>
      <button onClick={toggleTheme} style={{position:"fixed",top:16,right:16,background:T.bgCard,
        border:`1px solid ${T.border}`,borderRadius:10,padding:"8px 12px",fontSize:15,cursor:"pointer",color:T.text,zIndex:10}}>
        {isDark?"☀️":"🌙"}
      </button>

      {isMobile ? (
        <div style={{width:"100%",maxWidth:400,animation:shake?"shake 0.5s":"fadeUp 0.5s both"}}>
          <div style={{background:`linear-gradient(145deg, ${T.sidebarBg||sidebarColor}, ${sidebarColor})`,
            borderRadius:"20px 20px 0 0",padding:"32px 28px 28px",textAlign:"center"}}>
            {logo && <div style={{width:52,height:52,borderRadius:14,background:"rgba(255,252,245,0.18)",
              display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 16px"}}>{logo}</div>}
            <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:30,color:"#fff",
              marginBottom:6,letterSpacing:"-0.5px"}}>{title}</h1>
            {sub && <p style={{color:"rgba(255,252,245,0.55)",fontSize:14}}>{sub}</p>}
          </div>
          <div style={{background:T.bgCard,borderRadius:"0 0 20px 20px",padding:"28px",
            boxShadow:"0 16px 40px rgba(44,31,14,0.12)"}}>
            {nameField}
            {codeField(20)}
            {error && <p style={{color:T.red,fontSize:13,marginBottom:14}}>{error}</p>}
            {submitBtn}
            {hint && <p style={{color:T.textFaint,fontSize:11,marginTop:14,textAlign:"center"}}>{hint}</p>}
          </div>
        </div>
      ) : (
        <div style={{display:"flex",width:"100%",maxWidth:860,borderRadius:24,overflow:"hidden",
          boxShadow:"0 24px 80px rgba(44,31,14,0.15)",border:`1px solid ${T.border}`,
          animation:shake?"shake 0.5s":"fadeUp 0.5s both"}}>
          <div style={{width:260,background:`linear-gradient(160deg, ${T.sidebarBg||sidebarColor} 0%, ${sidebarColor} 100%)`,
            padding:"44px 36px",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
            <div>
              {logo && <div style={{width:48,height:48,borderRadius:14,background:"rgba(255,252,245,0.18)",
                display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,marginBottom:28}}>{logo}</div>}
              <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:26,color:"#fff",
                marginBottom:8,letterSpacing:"-0.5px",lineHeight:1.2}}>{title}</h1>
              {sub && <p style={{color:"rgba(255,252,245,0.5)",fontSize:13,lineHeight:1.6}}>{sub}</p>}
            </div>
            <div style={{borderTop:"1px solid rgba(255,252,245,0.12)",paddingTop:20}}>
              {restaurants.map(r=>(
                <div key={r.id} style={{color:"rgba(255,252,245,0.45)",fontSize:13,marginBottom:7}}>{r.emoji} {r.label}</div>
              ))}
            </div>
          </div>
          <div style={{flex:1,background:T.bgCard,padding:"44px 40px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:4}}>Bienvenue 👋</h2>
            <p style={{color:T.textSub,fontSize:14,marginBottom:28}}>Connecte-toi pour passer ta commande</p>
            {nameField}
            {codeField(22)}
            {error && <p style={{color:T.red,fontSize:13,marginBottom:14}}>{error}</p>}
            {submitBtn}
            {hint && <p style={{color:T.textFaint,fontSize:11,marginTop:16,textAlign:"center"}}>{hint}</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section de menu ───────────────────────────────────────────────────────────
function MenuSection({section, T, isAdmin, onSave, onOrder}) {
  const [items, setItems]       = useState(section.items||[]);
  const [editIdx, setEditIdx]   = useState(null);
  const [editItem, setEditItem] = useState({name:"",price:"",desc:""});
  const [newItem, setNewItem]   = useState({name:"",price:"",desc:""});
  const [showAdd, setShowAdd]   = useState(false);

  useEffect(()=>{ setItems(section.items||[]); },[section.items]);

  const save = async(updated) => { setItems(updated); if(onSave) await onSave(section.cat, updated); };
  const startEdit = (i) => { setEditIdx(i); setEditItem({price:"",desc:"",...items[i]}); };
  const cancelEdit = () => { setEditIdx(null); };
  const saveEdit = async() => {
    if(!editItem.name.trim()) return;
    await save(items.map((it,i)=>i===editIdx?{...editItem}:it));
    setEditIdx(null);
  };
  const deleteItem = async(i) => {
    await save(items.filter((_,idx)=>idx!==i));
    if(editIdx===i) setEditIdx(null);
  };
  const addItem = async() => {
    if(!newItem.name.trim()) return;
    await save([...items, {...newItem}]);
    setNewItem({name:"",price:"",desc:""});
    setShowAdd(false);
  };

  const accent = section.accent || T.accent;
  const inpS = {background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:7,
    color:T.text,padding:"5px 8px",fontSize:12,fontFamily:"'DM Sans',sans-serif"};

  return (
    <div style={{background:T.bgCard,border:`1px solid ${T.border}`,
      borderRadius:14,marginBottom:12,overflow:"hidden",boxShadow:T.shadow}}>
      <div style={{padding:"11px 20px",background:`${accent}12`,
        borderBottom:`1px solid ${accent}22`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:14,fontWeight:700,color:accent,fontFamily:"'Syne',sans-serif"}}>{section.cat}</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,color:accent,opacity:0.7}}>{items.length} article{items.length>1?"s":""}</span>
          {isAdmin && (
            <button onClick={()=>setShowAdd(v=>!v)}
              style={{background:accent+"18",border:`1px solid ${accent}44`,
                color:accent,borderRadius:6,padding:"2px 8px",fontSize:11,cursor:"pointer"}}>
              {showAdd?"✕":"+ Ajouter"}
            </button>
          )}
        </div>
      </div>
      <div>
        {items.map((item,i)=>(
          <div key={i} style={{borderBottom:i<items.length-1?`1px solid ${T.borderLight}`:"none"}}>
            {editIdx===i ? (
              <div style={{padding:"10px 16px",display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",background:T.bgHover}}>
                <input style={{...inpS,flex:2,minWidth:120}} value={editItem.name}
                  onChange={e=>setEditItem(p=>({...p,name:e.target.value}))} placeholder="Nom…"/>
                <input style={{...inpS,width:70}} value={editItem.price||""}
                  onChange={e=>setEditItem(p=>({...p,price:e.target.value}))} placeholder="Prix…"/>
                <input style={{...inpS,flex:3,minWidth:150}} value={editItem.desc||""}
                  onChange={e=>setEditItem(p=>({...p,desc:e.target.value}))} placeholder="Description (optionnel)…"/>
                <button onClick={saveEdit}
                  style={{background:T.green,color:"#fff",border:"none",borderRadius:7,padding:"5px 10px",fontSize:12,cursor:"pointer",fontWeight:600}}>✓</button>
                <button onClick={cancelEdit}
                  style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:7,padding:"5px 8px",fontSize:12,cursor:"pointer"}}>✕</button>
              </div>
            ) : (
              <div style={{padding:"9px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13,color:T.text}}>{item.name}</div>
                  {item.desc && <div style={{fontSize:11,color:T.textFaint,marginTop:1}}>{item.desc}</div>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                  {item.price && <span style={{fontSize:13,fontWeight:600,color:accent}}>€ {item.price}</span>}
                  {onOrder && (
                    <button onClick={()=>onOrder(item)}
                      style={{background:accent+"18",border:`1px solid ${accent}44`,
                        color:accent,borderRadius:20,padding:"3px 10px",fontSize:11,
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

// ── Éditeur JSON avancé (admin) ───────────────────────────────────────────────
function JsonEditor({ T, docs }) {
  const [sel, setSel]   = useState(docs[0]?.id || "");
  const [text, setText] = useState("");
  const [err, setErr]   = useState("");
  const [ok, setOk]     = useState(false);
  const cur = docs.find(d=>d.id===sel);

  const reload = () => { setText(JSON.stringify(cur?.value ?? {}, null, 2)); setErr(""); };
  useEffect(()=>{ reload(); },[sel]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async() => {
    try {
      const v = JSON.parse(text);
      if (typeof v!=="object" || v===null || Array.isArray(v)) throw new Error("Le document doit être un objet JSON { … }.");
      await setDoc(doc(db,"config",sel), v);
      setErr(""); setOk(true); setTimeout(()=>setOk(false),2000);
    } catch(e) { setErr(e.message); }
  };

  return (
    <div>
      <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap",alignItems:"center"}}>
        <select value={sel} onChange={e=>setSel(e.target.value)}
          style={{background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,padding:"7px 10px",fontSize:13}}>
          {docs.map(d=><option key={d.id} value={d.id}>config/{d.id}</option>)}
        </select>
        <button onClick={reload} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"7px 12px",fontSize:12,cursor:"pointer"}}>Recharger</button>
        <button onClick={save} style={{background:ok?T.green:T.sidebar,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>
          {ok?"✓ Enregistré":"Enregistrer"}
        </button>
      </div>
      <textarea value={text} onChange={e=>setText(e.target.value)} spellCheck={false} rows={18}
        style={{width:"100%",background:T.bgInput,border:`1px solid ${err?T.red:T.border}`,borderRadius:10,color:T.text,
          padding:"10px 12px",fontSize:12,lineHeight:1.5,fontFamily:"ui-monospace, Menlo, Consolas, monospace"}}/>
      {err && <p style={{color:T.red,fontSize:12,marginTop:6}}>{err}</p>}
    </div>
  );
}

// ── Profile Tab ───────────────────────────────────────────────────────────────
function ProfileTab({ user, profiles, members, T, editingProfile, setEditingProfile }) {
  const myProfile = profiles[user] || {};
  const [draft, setDraft] = useState({
    alias: myProfile.alias||"", bio: myProfile.bio||"", emoji: myProfile.emoji||"",
    color: myProfile.color||avatarColor(user), favoriteOrder: myProfile.favoriteOrder||"", funFact: myProfile.funFact||"",
  });
  const [saving, setSaving] = useState(false);

  useEffect(()=>{
    const p=profiles[user]||{};
    setDraft({
      alias:p.alias||"", bio:p.bio||"", emoji:p.emoji||"",
      color:p.color||avatarColor(user), favoriteOrder:p.favoriteOrder||"", funFact:p.funFact||"",
    });
  },[profiles[user]]); // eslint-disable-line react-hooks/exhaustive-deps

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

      {editingProfile && (
        <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:16,padding:"24px",boxShadow:T.shadow,marginBottom:16}}>
          <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:16,color:T.text,marginBottom:16}}>Personnalise ton profil</h3>
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

      <div>
        <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:15,color:T.text,marginBottom:12}}>👥 L'équipe</h3>
        <div style={{display:"flex",flexDirection:"column",gap:8}}>
          {members.map(m=>m.username).filter(n=>n!==user).map(name=>{
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

// ── Récap panel ───────────────────────────────────────────────────────────────
function RecapPanel({ user, names, orders, payments, togglePayment, ctx, T, defaultSlide=0, isMobile, only, onSuggest }){
  const [slide, setSlide] = useState(defaultSlide);
  const [copied, setCopied] = useState(false);
  const perso = orderPricedLines(orders[user], ctx);
  const resto = buildRestoRecap(names, orders, ctx);
  const isPaid = payments[user]||false;

  const copyList=async()=>{
    const txt=restoRecapText(resto);
    try{ await navigator.clipboard.writeText(txt); }
    catch(e){
      const ta=document.createElement("textarea"); ta.value=txt;
      ta.style.position="fixed"; ta.style.opacity="0"; document.body.appendChild(ta); ta.select();
      try{ document.execCommand("copy"); }catch(_){} document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  };

  const priceCell=(pr, optional)=>(
    <span style={{fontSize:12.5,color:pr!=null?T.text:T.textFaint}}>{pr!=null?fmtEuro(pr):(optional?"inclus":"—")}</span>
  );

  const infoHint=(
    <span className="info-wrap" style={{position:"relative",display:"inline-flex",marginLeft:6,verticalAlign:"middle"}}>
      <span onClick={()=>onSuggest&&onSuggest()}
        style={{cursor:"pointer",width:15,height:15,borderRadius:"50%",border:`1px solid ${T.textFaint}`,
          color:T.textFaint,fontSize:10,fontWeight:700,fontStyle:"italic",display:"inline-flex",
          alignItems:"center",justifyContent:"center",lineHeight:1}}>i</span>
      <span className="info-pop" style={{display:"none",position:"absolute",bottom:"calc(100% + 8px)",left:"50%",
        transform:"translateX(-50%)",width:220,background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10,
        padding:"10px 12px",zIndex:60,boxShadow:T.shadowHover||T.shadow,fontSize:11.5,color:T.textSub,
        lineHeight:1.5,fontWeight:400,fontStyle:"normal",textAlign:"left",pointerEvents:"none"}}>
        Total estimé : les prix viennent des plateformes Take Away, souvent plus chers qu'au comptoir. Clique pour donner les vrais prix.
      </span>
    </span>
  );

  const RestoView = (
    resto.groups.length===0 ? (
      <p style={{fontSize:13,color:T.textFaint,padding:"12px 0"}}>Aucune commande pour l'instant.</p>
    ) : (
      <>
        {resto.groups.map(g=>(
          <div key={g.key} style={{marginBottom:12}}>
            <div style={{fontSize:10.5,fontWeight:700,color:g.accent,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>{g.label}</div>
            {g.items.map((it,i)=>(
              <div key={i} style={{display:"flex",alignItems:"baseline",gap:8,fontSize:13,color:it.optional?T.textFaint:T.textSub,lineHeight:1.9}}>
                <span style={{fontWeight:600,color:T.text,minWidth:22}}>{it.qty}×</span>
                <span style={{flex:1}}>{it.label}</span>
                {it.price!=null && <span style={{color:T.textFaint,fontSize:12}}>{fmtEuro(it.price*it.qty)}</span>}
              </div>
            ))}
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",
          borderTop:`1px solid ${T.borderLight}`,paddingTop:10,marginBottom:6}}>
          <span style={{fontSize:12,color:T.textSub}}>Total resto{resto.hasUnpriced?" (estimé)":""}{infoHint}</span>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>{fmtEuro(resto.total)}</span>
        </div>
        {resto.hasUnpriced && <p style={{fontSize:11,color:T.textFaint,marginBottom:10}}>Certains articles n'ont pas de prix connu.</p>}
        <button onClick={copyList}
          style={{width:"100%",background:copied?T.green:T.sidebar,color:"#fff",border:"none",borderRadius:11,
            padding:11,fontSize:13,fontWeight:600,cursor:"pointer",transition:"background 0.2s"}}>
          {copied?"✓ Copié !":"📋 Copier la liste"}
        </button>
      </>
    )
  );

  const PersoView = (
    perso.empty ? (
      <p style={{fontSize:13,color:T.textFaint,padding:"12px 0"}}>Tu n'as pas encore commandé.</p>
    ) : (
      <>
        <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12}}>
          <Avatar name={user} size={30}/>
          <span style={{fontSize:13.5,fontWeight:600,color:T.text}}>Ma commande</span>
        </div>
        {perso.lines.map((l,i)=>(
          <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",
            fontSize:13,color:l.optional?T.textFaint:T.textSub,lineHeight:2}}>
            <span style={{flex:1,paddingRight:8}}>{l.label}</span>
            {priceCell(l.price, l.optional)}
          </div>
        ))}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",
          borderTop:`1px solid ${T.borderLight}`,paddingTop:10,marginTop:6,marginBottom:12}}>
          <span style={{fontSize:12,color:T.textSub}}>Mon total{perso.hasUnpriced?" (estimé)":""}{infoHint}</span>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:18,color:T.text}}>{fmtEuro(perso.total)}</span>
        </div>
        <button onClick={()=>togglePayment(user)}
          style={{width:"100%",background:isPaid?T.green+"18":"transparent",
            border:`1.5px solid ${isPaid?T.green:T.border}`,color:isPaid?T.green:T.textSub,
            borderRadius:11,padding:11,fontSize:13,fontWeight:600,cursor:"pointer"}}>
          {isPaid?"✓ Payé":"Marquer payé"}
        </button>
      </>
    )
  );

  const colHeader=(icon,label)=>(
    <div style={{display:"flex",alignItems:"center",gap:7,fontFamily:"'Syne',sans-serif",fontWeight:700,
      fontSize:13.5,color:T.text,marginBottom:12}}><span>{icon}</span>{label}</div>
  );

  if(only==="perso" || only==="resto"){
    return (
      <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,padding:16,marginBottom:20,boxShadow:T.shadow}}>
        {only==="perso" ? colHeader("👤","Perso") : colHeader("📞","Resto")}
        {only==="perso" ? PersoView : RestoView}
      </div>
    );
  }

  if(!isMobile){
    return (
      <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,padding:18,marginBottom:20,boxShadow:T.shadow}}>
        <div style={{display:"flex",gap:20,alignItems:"stretch"}}>
          <div style={{flex:1,minWidth:0}}>{colHeader("📞","Resto")}{RestoView}</div>
          <div style={{width:1,background:T.borderLight,flexShrink:0}}/>
          <div style={{flex:1,minWidth:0}}>{colHeader("👤","Perso")}{PersoView}</div>
        </div>
      </div>
    );
  }

  const seg=(idxN,icon,label)=>(
    <button onClick={()=>setSlide(idxN)}
      style={{flex:1,border:"none",borderRadius:8,padding:"7px 0",fontSize:12.5,fontWeight:600,cursor:"pointer",
        fontFamily:"'DM Sans',sans-serif",display:"flex",alignItems:"center",justifyContent:"center",gap:6,
        background:slide===idxN?T.sidebar:"transparent", color:slide===idxN?"#fff":T.textSub}}>
      <span>{icon}</span>{label}
    </button>
  );

  return (
    <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,padding:16,marginBottom:20,boxShadow:T.shadow}}>
      <div style={{display:"flex",background:T.bgTag,borderRadius:10,padding:3,marginBottom:14}}>
        {seg(0,"📞","Resto")}
        {seg(1,"👤","Perso")}
      </div>
      <div style={{overflow:"hidden"}}>
        <div style={{display:"flex",width:"200%",transition:"transform 0.3s cubic-bezier(0.4,0,0.2,1)",
          transform:`translateX(-${slide*50}%)`}}>
          <div style={{width:"50%",paddingRight:6,boxSizing:"border-box"}}>{RestoView}</div>
          <div style={{width:"50%",paddingLeft:6,boxSizing:"border-box"}}>{PersoView}</div>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]             = useState(null);
  const [members, setMembers]       = useState([]);
  const [membersLoaded, setMembersLoaded] = useState(false);
  const [appConfig, setAppConfig]   = useState({});
  const [restaurants, setRestaurants] = useState([]);
  const [quotes, setQuotes]         = useState([]);
  const [orders, setOrders]         = useState({});
  const [favorites, setFavorites]   = useState({});
  const [sauces, setSauces]         = useState([]);
  const [crudites, setCrudites]     = useState([]);
  const [boissons, setBoissons]     = useState([]);
  const [extras, setExtras]         = useState([]);
  const [payments, setPayments]     = useState({});
  const [history, setHistory]       = useState([]);
  const [tab, setTab]               = useState("order");
  const [status, setStatus]         = useState("connecting");
  const [savedMsg, setSavedMsg]     = useState(false);
  const [favNameInput, setFavNameInput]       = useState("");
  const [showFavModal, setShowFavModal]       = useState(false);
  const [newExtraOption, setNewExtraOption]   = useState({});
  const [newExtraPrice, setNewExtraPrice]     = useState({});
  const [newMemberName, setNewMemberName]     = useState("");
  const [newMemberCode, setNewMemberCode]     = useState("");
  const [editingMember, setEditingMember]     = useState(null);
  const [newSauce, setNewSauce]       = useState("");
  const [newCrudite, setNewCrudite]   = useState("");
  const [newBoisson, setNewBoisson]   = useState("");
  const [newQuote, setNewQuote]       = useState("");
  const [newExtraLabel, setNewExtraLabel]     = useState("");
  const [newExtraApplies, setNewExtraApplies] = useState([]);
  const [openHistory, setOpenHistory]         = useState({});
  const [viewMode, setViewMode]               = useState("accordion");
  const [activity, setActivity]               = useState([]);
  const [unreadActivity, setUnreadActivity]   = useState(0);
  const [lastSeenActivity, setLastSeenActivity] = useState(()=>parseInt(localStorage.getItem("lastSeenActivity")||"0"));
  const [profiles, setProfiles]               = useState({});
  const [editingProfile, setEditingProfile]   = useState(false);
  const [messages, setMessages]     = useState([]);
  const [chatInput, setChatInput]   = useState("");
  const [unreadChat, setUnreadChat] = useState(0);
  const [activeMenu, setActiveMenu] = useState("");
  const [menuToast, setMenuToast]   = useState("");
  const [sauceModal, setSauceModal] = useState(null);
  const [boubouleAI, setBoubouleAI] = useState({ loading:false, extracted:null, preview:false, restoId:null });
  const [isDark, setIsDark]   = useState(()=>localStorage.getItem("lunch_theme")==="dark");
  const [navOpen, setNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(()=>window.innerWidth<768);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [welcome, setWelcome] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackInput, setFeedbackInput] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedback, setFeedback] = useState([]);
  const detailTimers = useRef({});
  const T = isDark ? DARK : LIGHT;

  const isAdmin = !!members.find(m=>m.username===user)?.isAdmin;

  const toggleTheme=()=>{ const n=!isDark; setIsDark(n); localStorage.setItem("lunch_theme",n?"dark":"light"); };

  useEffect(()=>{ const h=()=>setIsMobile(window.innerWidth<768); window.addEventListener("resize",h); return ()=>window.removeEventListener("resize",h); },[]);

  useEffect(()=>{
    let m=document.querySelector('meta[name="viewport"]');
    if(!m){ m=document.createElement("meta"); m.setAttribute("name","viewport"); document.head.appendChild(m); }
    m.setAttribute("content","width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no");
  },[]);

  useEffect(()=>{
    if(!user || !quotes.length) return;
    setWelcome(quotes[Math.floor(Math.random()*quotes.length)]);
  },[user]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(()=>{ if(appConfig.title) document.title = appConfig.title; },[appConfig.title]);

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, u=>{
      if(u){ setAuthReady(true); setAuthError(null); }
      else signInAnonymously(auth).catch(e=>{
        console.error("Auth anonyme échouée:", e);
        setAuthError(e.code || e.message || "erreur inconnue");
      });
    });
    return unsub;
  },[]);

  useEffect(()=>{
    if(!authReady) return;
    const listDoc=(id,setter)=>onSnapshot(doc(db,"config",id),
      s=>setter(s.exists() && Array.isArray(s.data().list) ? s.data().list : []));
    const unsubs=[
      onSnapshot(collection(db,"orders"), s=>{const d={};s.forEach(x=>{d[x.id]=x.data();});setOrders(d);setStatus("live");}, ()=>setStatus("error")),
      onSnapshot(doc(db,"config","members"), s=>{
        setMembers(s.exists() && Array.isArray(s.data().list) ? s.data().list : []);
        setMembersLoaded(true);
      }, ()=>setMembersLoaded(true)),
      onSnapshot(doc(db,"config","app"), s=>setAppConfig(s.exists()?s.data():{})),
      listDoc("restaurants", setRestaurants),
      listDoc("quotes",      setQuotes),
      listDoc("sauces",      setSauces),
      listDoc("crudites",    setCrudites),
      listDoc("boissons",    setBoissons),
      listDoc("extras",      setExtras),
      onSnapshot(collection(db,"favorites"), s=>{
        const d={};
        s.forEach(x=>{ const data=x.data(); if(data.list)d[x.id]=data.list; else if(data.choice)d[x.id]=[{id:"fav_legacy",name:"Mon favori",...data}]; else d[x.id]=[]; });
        setFavorites(d);
      }),
      onSnapshot(collection(db,"history"), s=>{const days=[];s.forEach(x=>days.push({id:x.id,...x.data()}));days.sort((a,b)=>b.id.localeCompare(a.id));setHistory(days);}),
      onSnapshot(doc(db,"payments","today"), s=>{if(s.exists())setPayments(s.data());else setPayments({});}),
      onSnapshot(collection(db,"chat"), snap=>{
        const msgs=[];
        snap.forEach(s=>msgs.push({id:s.id,...s.data()}));
        msgs.sort((a,b)=>a.ts-b.ts);
        setMessages(msgs);
        const lastSeen=parseInt(localStorage.getItem("lastSeenChat")||"0");
        setUnreadChat(msgs.filter(m=>m.ts>lastSeen&&m.author!==user).length);
      }),
      onSnapshot(collection(db,"activity"), snap=>{
        const acts=[];
        snap.forEach(s=>acts.push({id:s.id,...s.data()}));
        acts.sort((a,b)=>b.ts-a.ts);
        setActivity(acts.slice(0,50));
        const lastSeen=parseInt(localStorage.getItem("lastSeenActivity")||"0");
        setUnreadActivity(acts.filter(a=>a.ts>lastSeen&&a.author!==user).length);
      }),
      onSnapshot(collection(db,"profiles"), snap=>{ const d={}; snap.forEach(s=>{d[s.id]=s.data();}); setProfiles(d); }),
      onSnapshot(collection(db,"feedback"), snap=>{
        const arr=[]; snap.forEach(s=>arr.push({id:s.id,...s.data()}));
        arr.sort((a,b)=>b.ts-a.ts); setFeedback(arr);
      }),
    ];
    return ()=>unsubs.forEach(u=>u());
  },[authReady, user]);

  useEffect(()=>{
    if(!user||isAdmin)return;
    const favList=favorites[user]||[];
    if(!favList.length)return;
    if(!orders[user]?.choice){
      const {id:_a,name:_b,...orderData}=favList[0];
      setDoc(doc(db,"orders",user),{...orderData});
    }
  },[user,favorites,isAdmin]); // eslint-disable-line react-hooks/exhaustive-deps

  if(!authReady) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.bg,padding:24}}>
      <div style={{textAlign:"center",color:T.textSub,fontFamily:"'DM Sans',sans-serif",maxWidth:360}}>
        {authError ? (
          <>
            <div style={{fontSize:15,fontWeight:700,color:T.red,marginBottom:10}}>Connexion impossible</div>
            <div style={{fontSize:13,marginBottom:6}}>Code d'erreur :</div>
            <code style={{fontSize:13,color:T.text,background:T.bgTag,padding:"5px 10px",
              borderRadius:6,display:"inline-block",marginBottom:18,wordBreak:"break-all"}}>{authError}</code>
            <div>
              <button onClick={()=>{
                setAuthError(null);
                signInAnonymously(auth).catch(e=>setAuthError(e.code || e.message || "erreur inconnue"));
              }} style={{background:T.sidebar,color:"#fff",border:"none",borderRadius:10,
                padding:"10px 22px",fontSize:14,fontWeight:600,cursor:"pointer"}}>
                Réessayer
              </button>
            </div>
          </>
        ) : (
          <div style={{fontSize:14}}>Connexion sécurisée…</div>
        )}
      </div>
    </div>
  );

  if(!user) return <LoginScreen onLogin={setUser} T={T} isDark={isDark} toggleTheme={toggleTheme}
    members={members} membersLoaded={membersLoaded} appConfig={appConfig} restaurants={restaurants}/>;

  // ── Persistance config ──
  const pm=async l=>{setMembers(l);     await setDoc(doc(db,"config","members"),    {list:l});};
  const ps=async l=>{setSauces(l);      await setDoc(doc(db,"config","sauces"),     {list:l});};
  const pc=async l=>{setCrudites(l);    await setDoc(doc(db,"config","crudites"),   {list:l});};
  const pb=async l=>{setBoissons(l);    await setDoc(doc(db,"config","boissons"),   {list:l});};
  const pe=async l=>{setExtras(l);      await setDoc(doc(db,"config","extras"),     {list:l});};
  const pr=async l=>{setRestaurants(l); await setDoc(doc(db,"config","restaurants"),{list:l});};
  const pq=async l=>{setQuotes(l);      await setDoc(doc(db,"config","quotes"),     {list:l});};

  const updateResto=(rid,fn)=>pr(restaurants.map(r=>r.id===rid?fn(r):r));
  const saveSection=(rid,cat,items)=>updateResto(rid,r=>({...r,sections:sectionsOf(r).map(s=>s.cat===cat?{...s,items}:s)}));
  const updateScoop=(rid,idx,patch)=>updateResto(rid,r=>({...r,scoopOptions:scoopOptions(r).map((o,i)=>i===idx?{...o,...patch}:o)}));
  const addScoop=(rid)=>updateResto(rid,r=>({...r,scoopOptions:[...scoopOptions(r),{label:"Nouveau format",count:1,price:null}]}));
  const removeScoop=(rid,idx)=>updateResto(rid,r=>({...r,scoopOptions:scoopOptions(r).filter((_,i)=>i!==idx)}));

  const ctx = { restaurants, extras, crudites };
  const orderers = members.filter(m=>!m.isAdmin).map(m=>m.username);
  const names = isAdmin ? orderers : [user, ...orderers.filter(n=>n!==user)];
  const adminCount = members.filter(m=>m.isAdmin).length;

  const addMember=async()=>{const n=newMemberName.trim(),c=newMemberCode.trim();if(!n||!c||members.find(m=>m.username===n))return;await pm([...members,{username:n,code:c}]);setNewMemberName("");setNewMemberCode("");};
  const removeMember=async n=>{
    const m=members.find(x=>x.username===n);
    if(m?.isAdmin && adminCount<=1){ alert("Impossible de supprimer le dernier administrateur."); return; }
    if(!window.confirm(`Supprimer ${n} ?`)) return;
    await pm(members.filter(x=>x.username!==n));
    await deleteDoc(doc(db,"orders",n));
  };
  const toggleMemberAdmin=async n=>{
    const m=members.find(x=>x.username===n);
    if(m?.isAdmin && adminCount<=1){ alert("Il faut au moins un administrateur."); return; }
    await pm(members.map(x=>x.username===n?{...x,isAdmin:!x.isAdmin}:x));
  };
  const saveMemberEdit=async()=>{
    if(!editingMember)return;
    const {_orig,...clean}=editingMember;
    await pm(members.map(m=>m.username===_orig?clean:m));
    setEditingMember(null);
  };
  const addSauce  =async()=>{const s=newSauce.trim();   if(s&&!sauces.includes(s))   {await ps([...sauces,s]);   setNewSauce("");}};
  const addCrudite=async()=>{const c=newCrudite.trim(); if(c&&!crudites.includes(c)) {await pc([...crudites,c]); setNewCrudite("");}};
  const addBoisson=async()=>{const b=newBoisson.trim(); if(b&&!boissons.includes(b)) {await pb([...boissons,b]); setNewBoisson("");}};
  const addQuote  =async()=>{const q=newQuote.trim(); if(q){await pq([...quotes,{text:q}]); setNewQuote("");}};
  const addExtraCategory=async()=>{const label=newExtraLabel.trim();if(!label||!newExtraApplies.length)return;const id="extra_"+Date.now();const accent=EXTRA_ACCENTS[extras.length%EXTRA_ACCENTS.length];await pe([...extras,{id,label,options:[],prices:{},appliesTo:newExtraApplies,accent}]);setNewExtraLabel("");setNewExtraApplies([]);};
  const removeExtraCategory=async id=>{await pe(extras.filter(e=>e.id!==id));};
  const addExtraOption=async(extraId)=>{
    const val=(newExtraOption[extraId]||"").trim();if(!val)return;
    const p=parsePrice(newExtraPrice[extraId]);
    await pe(extras.map(e=>{
      if(e.id!==extraId) return e;
      const prices={...(e.prices||{})};
      if(p!=null) prices[val]=p;
      return {...e, options:e.options.includes(val)?e.options:[...e.options,val], prices};
    }));
    setNewExtraOption(q=>({...q,[extraId]:""}));
    setNewExtraPrice(q=>({...q,[extraId]:""}));
  };
  const removeExtraOption=async(extraId,opt)=>{
    await pe(extras.map(e=>{
      if(e.id!==extraId) return e;
      const prices={...(e.prices||{})}; delete prices[opt];
      return {...e, options:e.options.filter(o=>o!==opt), prices};
    }));
  };
  const setExtraOptionPrice=async(extraId,opt,raw)=>{
    const p=parsePrice(raw);
    await pe(extras.map(e=>{
      if(e.id!==extraId) return e;
      const prices={...(e.prices||{})};
      if(p==null) delete prices[opt]; else prices[opt]=p;
      return {...e, prices};
    }));
  };

  const logActivity = async(type, text) => {
    await addDoc(collection(db,"activity"),{author:user,type,text,ts:Date.now()});
  };

  const submitFeedback = async() => {
    const txt=feedbackInput.trim();
    if(!txt) return;
    await addDoc(collection(db,"feedback"),{author:user,text:txt,ts:Date.now()});
    setFeedbackInput("");
    setFeedbackSent(true);
    setTimeout(()=>{ setFeedbackSent(false); setShowFeedback(false); }, 1600);
  };
  const deleteFeedback = async(id) => { await deleteDoc(doc(db,"feedback",id)); };

  const toggleChoice=async(name,choice)=>{
    const cur=orders[name]||{};
    const r=findResto(restaurants,choice);
    if(cur.choice===choice){
      await deleteDoc(doc(db,"orders",name));
      await logActivity("cancel",`${name} a annulé sa commande`);
    } else {
      await setDoc(doc(db,"orders",name),{...EMPTY_ORDER,choice});
      await logActivity("order",`${name} a commandé ${r?.emoji||""} ${r?.label||choice}`);
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
        updated = list.includes(value) ? [] : [value];
        extra = { cruditesTout: false };
      } else {
        const withoutNone = list.filter(x=>!x.toLowerCase().includes("aucune"));
        updated = withoutNone.includes(value) ? withoutNone.filter(x=>x!==value) : [...withoutNone, value];
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
    const favName=favNameInput.trim()||formatOrder(cur,ctx).slice(0,30)||"Mon favori";
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
    orderers.forEach(n=>{if(orders[n]?.choice)snapshot[n]=orders[n];});
    if(Object.keys(snapshot).length>0)await setDoc(doc(db,"history",`${today}_${Date.now()}`),{date:today,orders:snapshot,payments});
    await Promise.all(members.map(m=>deleteDoc(doc(db,"orders",m.username))));
    await setDoc(doc(db,"payments","today"),{});
    await logActivity("reset",`${user} a archivé et réinitialisé les commandes du jour`);
  };
  const deleteHistory=async id=>{if(!window.confirm("Supprimer ?"))return;await deleteDoc(doc(db,"history",id));};

  const totalOrdered=names.filter(n=>orders[n]?.choice).length;
  const notOrdered=names.filter(n=>!orders[n]?.choice);
  const counts=restaurants.reduce((a,r)=>{a[r.id]=names.filter(n=>orders[n]?.choice===r.id).length;return a;},{});
  const extrasForMeal=choice=>extras.filter(e=>e.appliesTo?.includes(choice));

  const detailCellProps={ sauces,crudites,boissons,T,
    handleDetail,handleSubDetail,toggleMulti,toggleCruditesTout,toggleExtraOption,pb,ps };

  const showToast=(msg)=>{ setMenuToast(`✓ ${msg}`); setTimeout(()=>setMenuToast(""),2500); };

  // Commande depuis l'onglet Menu : le comportement dépend de section.action (en base)
  const orderFromMenu = async (r, section, item) => {
    const a = section.action || {type:"main"};
    const mine = orders[user]?.choice===r.id;
    const cur = mine ? orders[user] : {...EMPTY_ORDER, choice:r.id};
    switch (actionType(section)) {
      case "main":
        await setDoc(doc(db,"orders",user),{...cur,choice:r.id,snackType:a.snackType||"",detail:stripPrefix(item.name,a.prefix)});
        showToast(item.name); break;
      case "frite":
        await setDoc(doc(db,"orders",user),{...cur,choice:r.id,friteSup:item.name});
        showToast("Frite "+item.name+" ajoutée"); break;
      case "sauce":
        setSauceModal({sauceName:item.name, restoId:r.id}); break;
      case "boisson":
        if(!boissons.includes(item.name)) await pb([...boissons,item.name]);
        await setDoc(doc(db,"orders",user),{...cur,choice:r.id,boisson:item.name});
        showToast(item.name+" ajoutée"); break;
      case "scoop": {
        const b1 = mine ? (cur.boule1||"") : "";
        const b2 = mine ? (cur.boule2||"") : "";
        const maxCount = Math.max(1, ...scoopOptions(r).map(o=>o.count||1));
        const newB1 = b1 || item.name;
        const newB2 = (b1 && !b2 && maxCount>=2) ? item.name : b2;
        const n = newB2 ? 2 : 1;
        const opt = scoopOptions(r).find(o=>(o.count||1)===n);
        await setDoc(doc(db,"orders",user),{...cur,choice:r.id,boules:opt?.label||"",boule1:newB1,boule2:newB2});
        showToast(item.name+" ajouté !"); break;
      }
      default: break;
    }
  };

  const inp={ width:"100%", background:T.bgInput, border:`1px solid ${T.border}`, borderRadius:8,
    color:T.text, padding:"8px 12px", fontSize:14, fontFamily:"'DM Sans',sans-serif" };
  const addBtn={ background:T.sidebar, color:"#f5efe6", border:"none", borderRadius:8,
    padding:"8px 18px", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" };
  const card={background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,padding:"20px 24px",boxShadow:T.shadow};

  const NAV = {
    order:    { icon:"📋", label:"Commander" },
    summary:  { icon:"📊", label:"Résumé" },
    menu:     { icon:"🍽️", label:"Menu" },
    favorites:{ icon:"⭐", label:"Favoris" },
    chat:     { icon:"💬", label:"Chat" },
    notifs:   { icon:"🔔", label:"Activité" },
    history:  { icon:"📅", label:"Historique" },
    profile:  { icon:"👤", label:"Profil" },
    settings: { icon:"⚙️", label:"Config" },
  };
  const navPrimary = ["order","summary","menu","favorites"];
  const navSecondary = ["chat","notifs","history","profile", ...(isAdmin?["settings"]:[])];
  const secBadge = unreadChat + unreadActivity;
  const secActive = navSecondary.includes(tab);
  const itemBadge = (id)=> id==="chat"?unreadChat : id==="notifs"?unreadActivity : 0;

  const selectTab = (id)=>{
    setTab(id);
    if(id==="chat"){ localStorage.setItem("lastSeenChat",Date.now().toString()); setUnreadChat(0); }
    if(id==="notifs"){ const now=Date.now(); localStorage.setItem("lastSeenActivity",now.toString()); setLastSeenActivity(now); setUnreadActivity(0); }
  };

  const renderNavBtn = (id)=>{
    const item = NAV[id];
    const isActive = tab===id;
    const tabColor = T.bg;
    const badge = itemBadge(id);
    return (
      <div key={id} style={{width:"100%",position:"relative",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
        {isActive && (
          <div style={{position:"absolute",right:0,width:82,height:62,background:tabColor,borderRadius:"14px 0 0 14px",zIndex:1}}>
            <div style={{position:"absolute",top:-18,right:0,width:18,height:18,background:"transparent",boxShadow:`9px 9px 0 9px ${tabColor}`,borderRadius:"0 0 14px 0"}}/>
            <div style={{position:"absolute",bottom:-18,right:0,width:18,height:18,background:"transparent",boxShadow:`9px -9px 0 9px ${tabColor}`,borderRadius:"0 14px 0 0"}}/>
          </div>
        )}
        <button onClick={()=>selectTab(id)}
          style={{position:"relative",zIndex:2,width:82,height:62,display:"flex",flexDirection:"column",
            alignItems:"center",justifyContent:"center",gap:4,border:"none",cursor:"pointer",background:"transparent",
            color:isActive?T.accent:"rgba(255,255,255,0.75)",transition:"color 0.2s"}}
          title={item.label}
          onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.color="rgba(255,255,255,1)"; }}
          onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.color="rgba(255,255,255,0.75)"; }}>
          <span style={{fontSize:20,lineHeight:1,position:"relative"}}>
            {item.icon}
            {badge>0 && (
              <span style={{position:"absolute",top:-4,right:-6,background:id==="chat"?"#c0553a":"#c97a4a",color:"#fff",
                borderRadius:"50%",width:14,height:14,fontSize:9,fontWeight:700,
                display:"flex",alignItems:"center",justifyContent:"center"}}>{badge>9?"9+":badge}</span>
            )}
          </span>
          <span style={{fontSize:10,fontWeight:isActive?700:500,fontFamily:"'DM Sans',sans-serif",
            letterSpacing:"0.02em",textShadow:"0 1px 2px rgba(0,0,0,0.3)"}}>{item.label}</span>
        </button>
      </div>
    );
  };

  const menuResto = findResto(restaurants, activeMenu) || restaurants[0];
  const shortTitle = Array.isArray(appConfig.shortTitle) ? appConfig.shortTitle : [appConfig.title||""];

  return (
    <div style={{minHeight:"100vh",display:"flex",background:T.bg}}>
      <style>{CSS(T)}</style>

      {welcome && (
        <div style={{position:"fixed",inset:0,background:"rgba(20,15,10,0.55)",backdropFilter:"blur(6px)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:4000,padding:20}}>
          <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:20,padding:"32px 28px",
            maxWidth:420,width:"100%",boxShadow:"0 30px 90px rgba(20,15,10,0.35)",textAlign:"center",
            animation:"fadeUp 0.4s ease"}}>
            {appConfig.logoEmoji && <div style={{fontSize:40,marginBottom:14}}>{appConfig.logoEmoji}</div>}
            <div style={{fontFamily:"'Syne','DM Sans',sans-serif",fontWeight:800,fontSize:22,color:T.text,marginBottom:14}}>
              Bonjour {user} 👋
            </div>
            <div style={{fontSize:15,color:T.textSub,fontStyle:"italic",lineHeight:1.6,marginBottom:welcome.author?6:24}}>
              « {welcome.text} »
            </div>
            {welcome.author && <div style={{fontSize:12,color:T.textFaint,marginBottom:24}}>— {welcome.author}</div>}
            <button onClick={()=>setWelcome(null)}
              style={{width:"100%",background:T.sidebar,color:"#fff",border:"none",borderRadius:12,padding:"13px",
                fontSize:15,fontWeight:600,cursor:"pointer",fontFamily:"'DM Sans',sans-serif"}}>
              C'est parti {appConfig.logoEmoji||""}
            </button>
          </div>
        </div>
      )}

      {showFeedback && (
        <div style={{position:"fixed",inset:0,background:"rgba(20,15,10,0.4)",backdropFilter:"blur(4px)",
          display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000,padding:16}}
          onClick={e=>e.target===e.currentTarget&&setShowFeedback(false)}>
          <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:16,padding:24,
            width:420,maxWidth:"100%",boxShadow:"0 24px 80px rgba(44,31,14,0.2)"}}>
            <h3 style={{fontFamily:"'Syne','DM Sans',sans-serif",fontWeight:700,fontSize:17,color:T.text,marginBottom:6}}>💡 Proposer un prix / une amélioration</h3>
            <p style={{fontSize:13,color:T.textSub,lineHeight:1.5,marginBottom:14}}>
              Les totaux sont estimés à partir des prix Take Away, souvent plus chers qu'au comptoir.
              Indique ici les vrais prix ou toute autre amélioration — l'admin les verra tous.
            </p>
            {feedbackSent ? (
              <div style={{background:T.green+"18",border:`1px solid ${T.green}44`,color:T.green,
                borderRadius:10,padding:"14px",textAlign:"center",fontSize:14,fontWeight:600}}>✓ Merci, c'est envoyé !</div>
            ) : (
              <>
                <textarea autoFocus value={feedbackInput} onChange={e=>setFeedbackInput(e.target.value)}
                  rows={4} placeholder="ex : Bicky pitta 8,50 € au comptoir · ajouter la sauce X · …"
                  style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:10,
                    color:T.text,padding:"10px 12px",fontSize:13.5,lineHeight:1.5,fontFamily:"'DM Sans',sans-serif",marginBottom:14}}/>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={submitFeedback} disabled={!feedbackInput.trim()}
                    style={{flex:1,background:T.sidebar,color:"#fff",border:"none",borderRadius:10,padding:"11px",
                      fontSize:14,fontWeight:600,cursor:"pointer",opacity:feedbackInput.trim()?1:0.5}}>Envoyer</button>
                  <button onClick={()=>setShowFeedback(false)}
                    style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,
                      padding:"11px 16px",fontSize:13,cursor:"pointer"}}>Annuler</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Sidebar ── */}
      {!isMobile && (
        <aside style={{width:88,background:`linear-gradient(180deg, ${T.sidebarBg||T.sidebar} 0%, ${T.sidebar} 100%)`,
          display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",flexShrink:0,
          zIndex:10, overflow:"visible"}}>
          <div style={{padding:"20px 0 16px",display:"flex",flexDirection:"column",alignItems:"center",
            borderBottom:`1px solid rgba(255,252,245,0.12)`,marginBottom:8}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:11,
              color:"#fff",letterSpacing:"0.5px",lineHeight:1.2,textAlign:"center"}}>
              {shortTitle.map((l,i)=><div key={i} style={i>0?{opacity:0.6}:undefined}>{l}</div>)}
            </div>
          </div>
          <nav style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"4px 0",gap:2}}>
            {navPrimary.map(id=>renderNavBtn(id))}
            <button onClick={()=>setNavOpen(o=>!o)} title={navOpen?"Réduire":"Plus"}
              style={{width:82,height:54,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                gap:4,border:"none",cursor:"pointer",background:"transparent",
                color:(secActive&&!navOpen)?T.accent:"rgba(255,255,255,0.55)",transition:"color 0.2s"}}
              onMouseEnter={e=>{ e.currentTarget.style.color="rgba(255,255,255,0.9)"; }}
              onMouseLeave={e=>{ e.currentTarget.style.color=(secActive&&!navOpen)?T.accent:"rgba(255,255,255,0.55)"; }}>
              <span style={{fontSize:20,lineHeight:1,position:"relative"}}>
                {navOpen?"▾":"⋯"}
                {!navOpen && secBadge>0 && (
                  <span style={{position:"absolute",top:-4,right:-6,background:"#c0553a",color:"#fff",borderRadius:"50%",
                    width:14,height:14,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{secBadge>9?"9+":secBadge}</span>
                )}
              </span>
              <span style={{fontSize:10,fontWeight:500,fontFamily:"'DM Sans',sans-serif",letterSpacing:"0.02em",textShadow:"0 1px 2px rgba(0,0,0,0.3)"}}>{navOpen?"Réduire":"Plus"}</span>
            </button>
            {navOpen && navSecondary.map(id=>renderNavBtn(id))}
          </nav>
          <div style={{padding:"12px 0 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,
            borderTop:`1px solid rgba(255,252,245,0.12)`}}>
            <div style={{position:"relative"}}>
              <Avatar name={user} size={28} profile={profiles[user]}/>
              <span style={{position:"absolute",bottom:-1,right:-1,padding:2,borderRadius:"50%",background:T.sidebar,display:"flex"}}>
                <StatusDot status={status}/>
              </span>
            </div>
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

        {isMobile && (
          <header style={{background:T.bgCard,borderBottom:`1px solid ${T.border}`,
            padding:"12px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",
            position:"sticky",top:0,zIndex:100}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {appConfig.logoEmoji && <span style={{fontSize:18}}>{appConfig.logoEmoji}</span>}
              <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:T.text}}>{appConfig.title||""}</span>
              <StatusDot status={status}/>
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

        {isMobile && (
          <>
            {navOpen && (
              <div onClick={()=>setNavOpen(false)}
                style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.25)"}}/>
            )}
            {navOpen && (
              <div style={{position:"fixed",left:8,right:8,zIndex:101,
                bottom:"calc(64px + env(safe-area-inset-bottom,8px))",
                background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,boxShadow:T.shadowHover,
                padding:6,display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:4}}>
                {navSecondary.map(id=>{
                  const item=NAV[id]; const badge=itemBadge(id); const isActive=tab===id;
                  return (
                    <button key={id} onClick={()=>{ selectTab(id); setNavOpen(false); }}
                      style={{display:"flex",alignItems:"center",gap:9,padding:"11px 12px",borderRadius:10,border:"none",
                        cursor:"pointer",background:isActive?T.accentLight:"transparent",
                        color:isActive?T.accent:T.text,fontFamily:"'DM Sans',sans-serif"}}>
                      <span style={{fontSize:19,position:"relative"}}>
                        {item.icon}
                        {badge>0 && (
                          <span style={{position:"absolute",top:-4,right:-6,background:id==="chat"?"#c0553a":"#c97a4a",color:"#fff",
                            borderRadius:"50%",width:14,height:14,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{badge>9?"9+":badge}</span>
                        )}
                      </span>
                      <span style={{fontSize:13,fontWeight:isActive?700:500}}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <nav style={{position:"fixed",bottom:0,left:0,right:0,
              background:T.bgCard, borderTop:`1px solid ${T.border}`,
              display:"flex",zIndex:100,
              paddingBottom:"env(safe-area-inset-bottom,8px)"}}>
              {navPrimary.map(id=>{
                const item=NAV[id]; const isActive=tab===id;
                return (
                  <button key={id} onClick={()=>selectTab(id)}
                    style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                      gap:3,padding:"10px 0",background:"none",border:"none",cursor:"pointer",
                      color:isActive?T.accent:T.textFaint,
                      borderTop:isActive?`2px solid ${T.accent}`:"2px solid transparent",
                      fontFamily:"'DM Sans',sans-serif",transition:"color 0.15s"}}>
                    <span style={{fontSize:20}}>{item.icon}</span>
                    <span style={{fontSize:9,fontWeight:isActive?700:400,letterSpacing:"0.03em"}}>{item.label}</span>
                  </button>
                );
              })}
              <button onClick={()=>setNavOpen(o=>!o)}
                style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
                  gap:3,padding:"10px 0",background:"none",border:"none",cursor:"pointer",
                  color:(secActive||navOpen)?T.accent:T.textFaint,
                  borderTop:(secActive&&!navOpen)?`2px solid ${T.accent}`:"2px solid transparent",
                  fontFamily:"'DM Sans',sans-serif",transition:"color 0.15s"}}>
                <span style={{fontSize:20,position:"relative"}}>
                  {navOpen?"▾":"⋯"}
                  {!navOpen && secBadge>0 && (
                    <span style={{position:"absolute",top:-4,right:-6,background:"#c0553a",color:"#fff",borderRadius:"50%",
                      width:14,height:14,fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{secBadge>9?"9+":secBadge}</span>
                  )}
                </span>
                <span style={{fontSize:9,fontWeight:(secActive||navOpen)?700:400,letterSpacing:"0.03em"}}>Plus</span>
              </button>
            </nav>
          </>
        )}

        <main style={{flex:1,padding:isMobile?"16px 12px 80px":"28px 32px",maxWidth:isMobile?960:"none",width:"100%",margin:"0 auto"}}>

          {/* ════ ORDER TAB ════ */}
          {tab==="order" && (
            <div style={{animation:"slideIn 0.25s ease"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
                <div>
                  <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:2}}>Commandes du jour</h1>
                  <p style={{fontSize:13,color:T.textSub}}>{totalOrdered} / {names.length} commandé{totalOrdered>1?"s":""}</p>
                </div>
                {isAdmin && (
                  <button onClick={()=>setViewMode(v=>v==="accordion"?"columns":"accordion")}
                    style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:8,
                      padding:"7px 14px",fontSize:12,cursor:"pointer",color:T.textSub,
                      display:"flex",alignItems:"center",gap:6,boxShadow:T.shadow}}>
                    {viewMode==="accordion"?"⊞ Colonnes":"☰ Accordéon"}
                  </button>
                )}
              </div>

              {restaurants.length===0 && (
                <div style={{...card,marginBottom:16,color:T.textSub,fontSize:13}}>
                  Aucun restaurant configuré. {isAdmin?"Ajoute-les dans Config → Éditeur avancé (config/restaurants).":"Demande à l'admin de les configurer."}
                </div>
              )}

              <div style={{display:isMobile?"block":"flex",gap:20,alignItems:"flex-start"}}>
              <div style={{flex:1,minWidth:0}}>

              {isMobile && (
                <RecapPanel user={user} names={names} orders={orders} payments={payments}
                  togglePayment={togglePayment} ctx={ctx} T={T} only="perso" isMobile={isMobile} onSuggest={()=>setShowFeedback(true)}/>
              )}

              {!isAdmin && (favorites[user]||[]).length>0 && (
                <div style={{marginBottom:20}}>
                  <p style={{fontSize:11,fontWeight:600,color:T.textFaint,textTransform:"uppercase",letterSpacing:"0.06em",marginBottom:8}}>⭐ Commande rapide</p>
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    {(favorites[user]||[]).map(fav=>{
                      const {id:favId,name:favName,...favOrder}=fav;
                      const opt=findResto(restaurants,favOrder.choice);
                      const isActive=orders[user]?.choice===favOrder.choice&&formatOrder(orders[user],ctx)===formatOrder(favOrder,ctx);
                      return (
                        <button key={favId}
                          onClick={async()=>{ if(isActive)await deleteDoc(doc(db,"orders",user)); else await setDoc(doc(db,"orders",user),{...favOrder}); }}
                          style={{background:isActive?opt?.bg||T.accentLight:T.bgCard,
                            border:`1.5px solid ${isActive?opt?.accent||T.accent:T.border}`,
                            borderRadius:12,padding:"10px 16px",cursor:"pointer",textAlign:"left",
                            boxShadow:T.shadow,transition:"all 0.15s",minWidth:160}}>
                          <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:3}}>
                            <span style={{fontSize:11,color:opt?.accent||T.accent,fontWeight:600}}>{opt?.emoji} {opt?.label}</span>
                            {isActive && <span style={{fontSize:9,background:(opt?.accent||T.accent)+"20",color:opt?.accent,padding:"1px 6px",borderRadius:10}}>✓ Actif</span>}
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

              {viewMode==="accordion" && (
                <div style={{display:"flex",flexDirection:"column",gap:8}}>
                  {(isAdmin ? names : names.filter(n=>n===user)).map((name,idx)=>{
                    const order=orders[name]||{};
                    const chosen=findResto(restaurants,order.choice);
                    const canEdit=user===name||isAdmin;
                    const isMe=user===name;
                    return (
                      <div key={name}
                        style={{background:T.bgCard,border:`1.5px solid ${isMe&&chosen?chosen.accent:isMe?T.accent:chosen?chosen.accent+"44":T.border}`,
                          borderRadius:14,overflow:"hidden",boxShadow:T.shadow}}>
                        <div style={{padding:isMobile?"7px 10px":"12px 16px",display:"flex",alignItems:"center",gap:isMobile?6:12,
                          background:isMe?T.accentLight:"transparent",
                          borderBottom:order.choice?`1px solid ${T.borderLight}`:"none"}}>
                          <span style={{fontSize:10,fontWeight:600,color:T.textFaint,minWidth:14,textAlign:"right"}}>{idx+1}</span>
                          <Avatar name={name} size={isMobile?26:36} profile={profiles[name]}/>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{display:"flex",alignItems:"center",gap:4}}>
                              <span style={{fontSize:isMobile?12:14,fontWeight:isMe?700:500,color:isMe?T.accent:T.text}}>{name}</span>
                              {isMe && <span style={{fontSize:8,background:T.bgTag,color:T.textFaint,padding:"1px 4px",borderRadius:10}}>toi</span>}
                            </div>
                            {chosen && <div style={{marginTop:2}}><OrderPills order={order} ctx={ctx}/></div>}
                          </div>
                          {canEdit && (
                            <div style={{display:"flex",gap:3,flexShrink:0}}>
                              {restaurants.map(r=>(
                                <button key={r.id} onClick={()=>toggleChoice(name,r.id)}
                                  style={{padding:isMobile?"4px 5px":"5px 10px",borderRadius:20,
                                    fontSize:isMobile?15:11,fontWeight:500,lineHeight:1,
                                    border:`1px solid ${order.choice===r.id?r.accent:T.border}`,
                                    background:order.choice===r.id?r.bg:T.bgInput,
                                    color:order.choice===r.id?r.accent:T.textSub,
                                    cursor:"pointer",transition:"all 0.15s"}}>
                                  {isMobile?r.emoji:r.emoji+" "+r.label}
                                </button>
                              ))}
                            </div>
                          )}
                          {!canEdit && chosen && (
                            <span style={{fontSize:isMobile?13:12,background:chosen.bg,color:chosen.accent,
                              padding:"2px 8px",borderRadius:20,fontWeight:500,flexShrink:0}}>{chosen.emoji}</span>
                          )}
                          {isAdmin && (
                            <button style={{background:"none",border:"none",color:T.textFaint,fontSize:12,cursor:"pointer",padding:2,flexShrink:0}}
                              onClick={()=>removeMember(name)}>✕</button>
                          )}
                        </div>
                        {order.choice && (
                          <div style={{padding:isMobile?"10px 12px":"16px 16px 16px 70px"}}>
                            <DetailCell name={name} order={order} canEdit={canEdit} restaurant={chosen}
                              mealExtras={extrasForMeal(order.choice)} {...detailCellProps}/>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {viewMode==="columns" && isAdmin && (
                <div style={{display:"grid",gridTemplateColumns:`repeat(${Math.max(1,restaurants.length)},1fr)`,gap:16,alignItems:"start"}}>
                  {restaurants.map((r,ri)=>{
                    const people=names.filter(n=>orders[n]?.choice===r.id);
                    return (
                      <div key={r.id}>
                        <div style={{background:r.bg,border:`1.5px solid ${r.accent}44`,borderRadius:12,
                          padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                          <span style={{fontSize:13,fontWeight:600,color:r.accent}}>{r.emoji} {r.label}</span>
                          <span style={{fontSize:11,background:r.accent+"22",color:r.accent,
                            padding:"2px 8px",borderRadius:10,fontWeight:600}}>{people.length}</span>
                        </div>
                        <div style={{display:"flex",flexDirection:"column",gap:6}}>
                          {people.map(name=>(
                            <div key={name} style={{background:T.bgCard,border:`1px solid ${T.border}`,
                              borderRadius:10,padding:"10px 12px",boxShadow:T.shadow}}>
                              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                                <Avatar name={name} size={28} profile={profiles[name]}/>
                                <span style={{fontSize:13,fontWeight:500,color:T.text}}>{name}</span>
                                {payments[name] && <span style={{marginLeft:"auto",fontSize:10,color:T.green}}>✓</span>}
                              </div>
                              <OrderPills order={orders[name]} ctx={ctx}/>
                            </div>
                          ))}
                          {people.length===0 && (
                            <div style={{background:T.bgInput,border:`1px dashed ${T.border}`,borderRadius:10,
                              padding:"16px",textAlign:"center",color:T.textFaint,fontSize:12}}>
                              Aucune commande
                            </div>
                          )}
                        </div>
                        {ri===0 && notOrdered.length>0 && (
                          <div style={{marginTop:12}}>
                            <p style={{fontSize:11,color:T.textFaint,marginBottom:6}}>⏳ Non commandé</p>
                            {notOrdered.map(name=>(
                              <div key={name} style={{display:"flex",alignItems:"center",gap:6,
                                padding:"6px 0",borderBottom:`1px solid ${T.borderLight}`}}>
                                <Avatar name={name} size={24} profile={profiles[name]}/>
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

              {!isMobile && (
                <div style={{width:360,flexShrink:0,position:"sticky",top:28}}>
                  <RecapPanel user={user} names={names} orders={orders} payments={payments}
                    togglePayment={togglePayment} ctx={ctx} T={T} only="perso" isMobile={isMobile} onSuggest={()=>setShowFeedback(true)}/>
                </div>
              )}
              </div>
            </div>
          )}

          {/* ════ CHAT TAB ════ */}
          {tab==="chat" && (
            <div style={{animation:"slideIn 0.25s ease",display:"flex",flexDirection:"column",height:"calc(100vh - 120px)"}}>
              <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:16}}>💬 Chat</h1>
              <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,padding:"4px 0",marginBottom:12}}>
                {messages.length===0 && (
                  <div style={{textAlign:"center",color:T.textFaint,padding:40,fontSize:14}}>
                    Aucun message pour l'instant.<br/>
                    <span style={{fontSize:12}}>Soyez le premier à écrire ! 👋</span>
                  </div>
                )}
                {messages.map(msg=>{
                  const isMe = msg.author===user;
                  const time = new Date(msg.ts).toLocaleTimeString("fr-BE",{hour:"2-digit",minute:"2-digit"});
                  const prof = profiles[msg.author]||{};
                  const displayName = prof.alias||msg.author;
                  return (
                    <div key={msg.id} style={{display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start",gap:3}}>
                      <span style={{fontSize:11,color:T.textSub,paddingLeft:isMe?0:8,paddingRight:isMe?8:0}}>
                        {displayName} {isMe&&<span style={{opacity:0.6}}>(toi)</span>}
                      </span>
                      <div style={{display:"flex",alignItems:"flex-end",gap:6,flexDirection:isMe?"row-reverse":"row"}}>
                        <Avatar name={msg.author} size={28} profile={prof}/>
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
                      {isMe && isAdmin && (
                        <button onClick={async()=>{ await deleteDoc(doc(db,"chat",msg.id)); }}
                          style={{background:"none",border:"none",color:T.textFaint,fontSize:10,cursor:"pointer",paddingRight:4}}>
                          Supprimer
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
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
                        <div style={{flex:1}}><span style={{fontSize:13,color:T.text}}>{act.text}</span></div>
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
                {isAdmin && (
                  <button style={{background:T.bgCard,border:`1px solid ${T.red}44`,color:T.red,
                    borderRadius:8,padding:"7px 14px",fontSize:12,cursor:"pointer",boxShadow:T.shadow}}
                    onClick={resetAll}>🗑 Réinitialiser</button>
                )}
              </div>

              <RecapPanel user={user} names={names} orders={orders} payments={payments}
                togglePayment={togglePayment} ctx={ctx} T={T} isMobile={isMobile} onSuggest={()=>setShowFeedback(true)}/>

              <div style={{display:"flex",gap:isMobile?8:12,marginBottom:isMobile?16:24,flexWrap:"wrap"}}>
                {restaurants.map(r=>(
                  <div key={r.id} style={{flex:1,minWidth:isMobile?80:120,background:counts[r.id]>0?r.bg:T.bgCard,
                    border:`1.5px solid ${counts[r.id]>0?r.accent:T.border}`,borderRadius:12,
                    padding:isMobile?"12px 14px":"18px 20px",boxShadow:T.shadow}}>
                    <div style={{fontSize:isMobile?28:38,fontWeight:800,fontFamily:"'Syne',sans-serif",
                      color:counts[r.id]>0?r.accent:T.textFaint,lineHeight:1}}>{counts[r.id]}</div>
                    <div style={{fontSize:isMobile?11:13,color:counts[r.id]>0?r.accent:T.textSub,marginTop:4}}>
                      {r.emoji} {r.label}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {restaurants.map(r=>{
                  const people=names.filter(n=>orders[n]?.choice===r.id);
                  if(!people.length)return null;
                  const paidCount=people.filter(n=>payments[n]).length;
                  return (
                    <div key={r.id} style={{background:T.bgCard,border:`1px solid ${T.border}`,
                      borderRadius:14,overflow:"hidden",boxShadow:T.shadow}}>
                      <div style={{padding:"12px 20px",background:r.bg,borderBottom:`1px solid ${r.accent}22`,
                        display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                        <span style={{fontSize:14,fontWeight:600,color:r.accent}}>{r.emoji} {r.label}</span>
                        <span style={{fontSize:12,color:paidCount===people.length?T.green:T.textSub}}>
                          💰 {paidCount}/{people.length} payé{paidCount>1?"s":""}
                        </span>
                      </div>
                      {people.map((name,idx)=>{
                        const paid=payments[name]||false;
                        const prof=profiles[name]||{};
                        return (
                          <div key={name} className="row-hover"
                            style={{padding:"12px 20px",borderBottom:`1px solid ${T.borderLight}`,
                              opacity:paid?0.55:1,transition:"opacity 0.2s"}}>
                            <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:6}}>
                              <span style={{fontSize:11,fontWeight:600,color:T.textFaint,minWidth:18,textAlign:"right"}}>{idx+1}.</span>
                              <div style={{position:"relative"}} className="avatar-tooltip-wrap">
                                <Avatar name={name} size={28} profile={prof}/>
                                {(prof.alias||prof.bio||prof.mood) && (
                                  <div className="avatar-tooltip" style={{
                                    position:"absolute",bottom:"calc(100% + 6px)",left:"50%",
                                    transform:"translateX(-50%)",
                                    background:T.bgCard,border:`1px solid ${T.border}`,
                                    borderRadius:10,padding:"8px 12px",zIndex:50,
                                    boxShadow:T.shadow,minWidth:140,
                                    pointerEvents:"none",display:"none"}}>
                                    {prof.alias && <div style={{fontSize:13,fontWeight:700,color:T.text}}>{prof.alias}</div>}
                                    {prof.mood && <div style={{fontSize:12,color:T.textSub,marginTop:2}}>{prof.mood}</div>}
                                    {prof.bio && <div style={{fontSize:11,color:T.textFaint,marginTop:2,maxWidth:180,whiteSpace:"normal"}}>{prof.bio}</div>}
                                  </div>
                                )}
                              </div>
                              <span style={{fontSize:13,fontWeight:500,color:T.text,flex:1,textDecoration:paid?"line-through":"none"}}>
                                {prof.alias||name}
                              </span>
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
                              <OrderPills order={orders[name]} ctx={ctx}/>
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

              {!isAdmin && (
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
                      const opt=findResto(restaurants,favOrder.choice);
                      const isActive=orders[user]?.choice===favOrder.choice&&formatOrder(orders[user],ctx)===formatOrder(favOrder,ctx);
                      return (
                        <div key={favId} style={{background:isActive?opt?.bg||T.accentLight:T.bgCard,
                          border:`1.5px solid ${isActive?opt?.accent||T.accent:T.border}`,
                          borderRadius:14,padding:"16px 20px",boxShadow:T.shadow}}>
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{fontSize:13,fontWeight:700,color:T.text}}>{favName}</span>
                              <span style={{fontSize:11,background:opt?.bg,color:opt?.accent,padding:"2px 8px",borderRadius:10}}>{opt?.emoji} {opt?.label}</span>
                              {isActive && <span style={{fontSize:9,background:(opt?.accent||T.accent)+"20",color:opt?.accent,padding:"1px 6px",borderRadius:10}}>✓ Actif</span>}
                            </div>
                            <button style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:14,padding:4}}
                              onClick={async()=>{if(window.confirm(`Supprimer "${favName}" ?`))await deleteFavorite(user,favId);}}>🗑</button>
                          </div>
                          <div style={{marginBottom:12}}><OrderPills order={favOrder} ctx={ctx}/></div>
                          <button style={{width:"100%",padding:"10px",borderRadius:10,fontSize:13,cursor:"pointer",
                            background:isActive?T.red+"11":opt?.bg,
                            border:`1px solid ${isActive?T.red+"44":(opt?.accent||T.accent)+"44"}`,
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

              {isAdmin && (
                Object.keys(favorites).filter(u=>(favorites[u]||[]).length>0).length===0 ? (
                  <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,padding:"48px",textAlign:"center",color:T.textFaint}}>Aucun favori.</div>
                ) : (
                  <div style={{display:"flex",flexDirection:"column",gap:10}}>
                    {Object.entries(favorites).map(([username,favList])=>{
                      if(!favList?.length)return null;
                      return (
                        <div key={username} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,padding:"16px 20px",boxShadow:T.shadow}}>
                          <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                            <Avatar name={username} size={28} profile={profiles[username]}/>
                            <span style={{fontSize:14,fontWeight:600,color:T.text}}>{username}</span>
                            <Tag>{favList.length} favori{favList.length>1?"s":""}</Tag>
                          </div>
                          {favList.map(fav=>{
                            const {id:favId,name:favName,...favOrder}=fav;
                            const opt=findResto(restaurants,favOrder.choice);
                            return (
                              <div key={favId} style={{display:"flex",gap:10,alignItems:"flex-start",
                                padding:"8px 0",borderBottom:`1px solid ${T.borderLight}`}}>
                                <span style={{fontSize:10,color:opt?.accent,marginTop:3,flexShrink:0}}>●</span>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:13,fontWeight:500,color:T.text,marginBottom:4}}>{favName}</div>
                                  <OrderPills order={favOrder} ctx={ctx}/>
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
                  const visibleOrders=isAdmin?Object.entries(day.orders||{}):Object.entries(day.orders||{}).filter(([n])=>n===user);
                  if(!visibleOrders.length)return null;
                  const isOpen=openHistory[day.id]||false;
                  const toggle=()=>setOpenHistory(prev=>({...prev,[day.id]:!prev[day.id]}));
                  return (
                    <div key={day.id} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden",boxShadow:T.shadow}}>
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
                                {restaurants.filter(r=>visibleOrders.some(([,o])=>o.choice===r.id)).map(r=>r.emoji+" "+r.label).join(", ")}
                              </p>
                            )}
                          </div>
                        </div>
                        <div style={{display:"flex",gap:6,alignItems:"center"}} onClick={e=>e.stopPropagation()}>
                          <Tag>{visibleOrders.length} commande{visibleOrders.length>1?"s":""}</Tag>
                          {isAdmin && (
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
                      {isOpen && (
                        <div>
                          {restaurants.map(r=>{
                            const people=visibleOrders.filter(([,o])=>o.choice===r.id);
                            if(!people.length)return null;
                            return (
                              <div key={r.id} style={{padding:"12px 20px",borderBottom:`1px solid ${T.borderLight}`}}>
                                <p style={{fontSize:12,fontWeight:600,color:r.accent,marginBottom:8}}>{r.emoji} {r.label}</p>
                                {people.map(([name,o],idx)=>{
                                  const paid=(day.payments||{})[name]||false;
                                  return (
                                    <div key={name} style={{display:"flex",gap:10,alignItems:"flex-start",
                                      padding:"8px 0",borderBottom:`1px solid ${T.borderLight}`}}>
                                      <span style={{fontSize:11,fontWeight:600,color:T.textFaint,minWidth:18,textAlign:"right",marginTop:2}}>{idx+1}.</span>
                                      <Avatar name={name} size={24} profile={profiles[name]}/>
                                      <div style={{flex:1}}>
                                        <span style={{fontSize:13,fontWeight:500,color:T.text,textDecoration:paid?"line-through":"none"}}>{name}</span>
                                        <div style={{marginTop:4}}><OrderPills order={o} ctx={ctx}/></div>
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

              {!isAdmin && orders[user]?.choice && (
                <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:12,
                  padding:"10px 16px",marginBottom:16,display:"flex",alignItems:"center",
                  justifyContent:"space-between",gap:12,boxShadow:T.shadow}}>
                  <span style={{fontSize:13,color:T.textSub}}>
                    🛒 Ma commande : <strong style={{color:T.text}}>{formatOrder(orders[user],ctx)||"En cours…"}</strong>
                  </span>
                  <button onClick={()=>setTab("order")}
                    style={{background:T.sidebar,color:"#fff",border:"none",borderRadius:8,
                      padding:"6px 14px",fontSize:12,fontWeight:600,cursor:"pointer",whiteSpace:"nowrap"}}>
                    → Voir ma commande
                  </button>
                </div>
              )}
              {!isAdmin && !orders[user]?.choice && (
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

              <div style={{display:"flex",gap:8,marginBottom:24,borderBottom:`1px solid ${T.border}`,paddingBottom:0,flexWrap:"wrap"}}>
                {restaurants.map(r=>{
                  const active=menuResto?.id===r.id;
                  return (
                    <button key={r.id} onClick={()=>setActiveMenu(r.id)}
                      style={{padding:"8px 18px",border:"none",borderRadius:"8px 8px 0 0",
                        cursor:"pointer",fontSize:13,fontWeight:active?700:400,
                        fontFamily:"'DM Sans',sans-serif",
                        background:active?T.bgCard:"transparent",
                        color:active?r.accent:T.textSub,
                        borderBottom:active?`2px solid ${r.accent}`:"2px solid transparent",
                        transition:"all 0.15s"}}>
                      {r.emoji} {r.menuLabel||r.label}
                    </button>
                  );
                })}
              </div>

              {menuResto && (
                <div>
                  {menuResto.header && (
                    <div style={{background:menuResto.header.gradient||menuResto.bg,borderRadius:16,
                      padding:"24px",marginBottom:20,textAlign:"center",boxShadow:T.shadow,position:"relative"}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:28,
                        color:"#fff",letterSpacing:"-0.5px",marginBottom:4}}>{menuResto.header.title}</div>
                      {menuResto.header.subtitle && (
                        <div style={{fontFamily:"'DM Sans',sans-serif",fontSize:14,color:"rgba(255,255,255,0.85)",fontStyle:"italic"}}>
                          {menuResto.header.subtitle}
                        </div>
                      )}
                      {isAdmin && sectionsOf(menuResto).some(s=>s.aiKey) && (
                        <label style={{position:"absolute",top:12,right:12,
                          background:"rgba(255,255,255,0.25)",border:"1px solid rgba(255,255,255,0.4)",
                          borderRadius:10,padding:"6px 12px",fontSize:12,fontWeight:600,
                          color:"#fff",cursor:"pointer",display:"flex",alignItems:"center",gap:6}}>
                          {boubouleAI.loading ? "⏳ Analyse…" : "📸 Mettre à jour"}
                          <input type="file" accept="image/*" style={{display:"none"}}
                            onChange={async(e)=>{
                              const file = e.target.files?.[0];
                              if(!file) return;
                              const rid = menuResto.id;
                              setBoubouleAI({loading:true, extracted:null, preview:false, restoId:rid});
                              try {
                                const base64 = await new Promise((res,rej)=>{
                                  const img = new Image();
                                  img.onload = () => {
                                    const canvas = document.createElement("canvas");
                                    const scale = Math.min(1, 1200 / img.width);
                                    canvas.width = img.width * scale;
                                    canvas.height = img.height * scale;
                                    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
                                    res(canvas.toDataURL("image/jpeg", 0.7).split(",")[1]);
                                  };
                                  img.onerror = rej;
                                  const reader = new FileReader();
                                  reader.onload = ev => { img.src = ev.target.result; };
                                  reader.onerror = rej;
                                  reader.readAsDataURL(file);
                                });
                                const response = await fetch("/api/analyze-image",{
                                  method:"POST",
                                  headers:{"Content-Type":"application/json"},
                                  body: JSON.stringify({ imageBase64: base64, mediaType:"image/jpeg" })
                                });
                                const rawText = await response.text();
                                let parsed;
                                try { parsed = JSON.parse(rawText); }
                                catch(err) { throw new Error("Réponse serveur invalide: " + rawText.slice(0,200)); }
                                if(parsed.error) throw new Error(parsed.error + (parsed.detail?" — "+parsed.detail:""));
                                setBoubouleAI({loading:false, extracted:parsed, preview:true, restoId:rid});
                              } catch(err) {
                                console.error(err);
                                setBoubouleAI({loading:false, extracted:null, preview:false, restoId:null});
                                alert("Erreur lors de l'analyse. Réessaie.");
                              }
                              e.target.value="";
                            }}/>
                        </label>
                      )}
                    </div>
                  )}

                  {boubouleAI.preview && boubouleAI.extracted && boubouleAI.restoId===menuResto.id && (
                    <div style={{background:T.bgCard,border:`2px solid ${menuResto.accent}`,borderRadius:14,
                      padding:"20px",marginBottom:16,boxShadow:T.shadow}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                        <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:menuResto.accent}}>
                          ✨ Éléments détectés — confirmer ?
                        </h3>
                        <button onClick={()=>setBoubouleAI({loading:false,extracted:null,preview:false,restoId:null})}
                          style={{background:"none",border:"none",color:T.textFaint,fontSize:18,cursor:"pointer"}}>✕</button>
                      </div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                        {sectionsOf(menuResto).filter(s=>s.aiKey).map(s=>(
                          <div key={s.aiKey}>
                            <p style={{fontSize:12,fontWeight:600,color:T.textSub,marginBottom:6}}>{s.cat}</p>
                            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                              {(boubouleAI.extracted[s.aiKey]||[]).map(n=>(
                                <span key={n} style={{background:menuResto.accent+"12",border:`1px solid ${menuResto.accent}44`,
                                  borderRadius:20,padding:"3px 10px",fontSize:12,color:T.text}}>{n}</span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={async()=>{
                          const ex=boubouleAI.extracted;
                          await updateResto(menuResto.id, r=>({...r, sections:sectionsOf(r).map(s=>
                            s.aiKey && Array.isArray(ex[s.aiKey]) ? {...s, items:ex[s.aiKey].map(n=>({name:n}))} : s)}));
                          setBoubouleAI({loading:false,extracted:null,preview:false,restoId:null});
                          showToast("Menu mis à jour !");
                        }} style={{flex:1,background:menuResto.accent,color:"#fff",border:"none",borderRadius:10,
                          padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer"}}>
                          ✓ Confirmer et sauvegarder
                        </button>
                        <button onClick={()=>setBoubouleAI({loading:false,extracted:null,preview:false,restoId:null})}
                          style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,
                            borderRadius:10,padding:"10px 16px",fontSize:13,cursor:"pointer"}}>
                          Annuler
                        </button>
                      </div>
                    </div>
                  )}

                  {(menuResto.links||[]).length>0 && (
                    <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                      {menuResto.links.map((l,i)=>(
                        <a key={i} href={l.url} target={l.url?.startsWith("http")?"_blank":undefined} rel="noopener noreferrer"
                          style={{fontSize:12,color:T.textSub,textDecoration:"none"}}>{l.label}</a>
                      ))}
                    </div>
                  )}

                  {sectionsOf(menuResto).map(section=>(
                    <MenuSection key={menuResto.id+"_"+section.cat} section={section} T={T} isAdmin={isAdmin}
                      onSave={(cat,items)=>saveSection(menuResto.id,cat,items)}
                      onOrder={!isAdmin && actionType(section)!=="none" ? (item)=>orderFromMenu(menuResto,section,item) : null}/>
                  ))}

                  {menuResto.note && (
                    <p style={{fontSize:11,color:T.textFaint,textAlign:"center",marginTop:8}}>{menuResto.note}</p>
                  )}
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
                  {[
                    {label:"🫙 Sauce dans le snack", color:"#9b7fa6", apply:(cur,s)=>({...cur,sauces:(cur.sauces||[]).includes(s)?cur.sauces:[...(cur.sauces||[]),s]}), msg:"ajoutée au snack"},
                    {label:"🥣 Sauce pour les frites", color:"#c8922a", apply:(cur,s)=>({...cur,sauceFrite:s}), msg:"ajoutée aux frites"},
                  ].map(o=>(
                    <button key={o.label} style={{background:o.color+"18",border:`1px solid ${o.color}44`,color:o.color,
                      borderRadius:10,padding:"10px",fontSize:13,cursor:"pointer",fontWeight:500}}
                      onClick={async()=>{
                        const s=sauceModal.sauceName, rid=sauceModal.restoId;
                        const cur=orders[user]?.choice===rid ? orders[user] : {...EMPTY_ORDER, choice:rid};
                        if(!sauces.includes(s)) await ps([...sauces, s]);
                        await setDoc(doc(db,"orders",user),{...o.apply(cur,s),choice:rid});
                        showToast(`${s} ${o.msg}`);
                        setSauceModal(null);
                      }}>
                      {o.label}
                    </button>
                  ))}
                  <button style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,
                    borderRadius:10,padding:"8px",fontSize:12,cursor:"pointer"}}
                    onClick={()=>setSauceModal(null)}>Annuler</button>
                </div>
              </div>
            </div>
          )}

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
              editingProfile={editingProfile} setEditingProfile={setEditingProfile}/>
          )}

          {/* ════ CONFIG TAB ════ */}
          {tab==="settings" && (
            <div style={{animation:"slideIn 0.25s ease"}}>
              <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:20}}>⚙️ Configuration</h1>
              {!isAdmin ? (
                <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,
                  padding:"60px 24px",textAlign:"center",color:T.textFaint,boxShadow:T.shadow}}>
                  <div style={{fontSize:32,marginBottom:10}}>🔒</div>
                  <p>Réservé à l'Admin</p>
                </div>
              ) : (
                <div style={{display:"flex",flexDirection:"column",gap:28}}>

                  {/* Retours */}
                  <div style={card}>
                    <h2 style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:4}}>💡 Améliorations & prix signalés</h2>
                    <p style={{fontSize:12,color:T.textFaint,marginBottom:14}}>Retours envoyés par l'équipe via le ⓘ des totaux.</p>
                    {feedback.length===0 ? (
                      <p style={{fontSize:13,color:T.textFaint}}>Aucun retour pour l'instant.</p>
                    ) : (
                      <div style={{display:"flex",flexDirection:"column",gap:8}}>
                        {feedback.map(f=>(
                          <div key={f.id} style={{display:"flex",gap:10,alignItems:"flex-start",
                            padding:"10px 12px",background:T.bgHover,borderRadius:10,border:`1px solid ${T.borderLight}`}}>
                            <Avatar name={f.author} size={28} profile={profiles[f.author]}/>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:2}}>
                                <span style={{fontSize:13,fontWeight:600,color:T.text}}>{f.author}</span>
                                <span style={{fontSize:11,color:T.textFaint}}>{new Date(f.ts).toLocaleDateString("fr-BE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
                              </div>
                              <div style={{fontSize:13,color:T.textSub,lineHeight:1.5,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{f.text}</div>
                            </div>
                            <button onClick={()=>deleteFeedback(f.id)}
                              style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:14,padding:2,flexShrink:0}}>🗑</button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Membres */}
                  <div style={card}>
                    <h2 style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:4}}>👥 Membres</h2>
                    <p style={{fontSize:12,color:T.textFaint,marginBottom:14}}>👑 = administrateur (ne commande pas, accède à la configuration).</p>
                    <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                      <input style={{...inp,flex:2,minWidth:140}} value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} placeholder="Nom…"/>
                      <input style={{...inp,flex:1,minWidth:100}} value={newMemberCode} onChange={e=>setNewMemberCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMember()} placeholder="Code…"/>
                      <button style={addBtn} onClick={addMember}>+ Ajouter</button>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {members.map(m=>(
                        <div key={m.username} style={{display:"flex",alignItems:"center",gap:10,
                          padding:"10px 12px",background:T.bgHover,borderRadius:10,border:`1px solid ${T.borderLight}`}}>
                          {editingMember?._orig===m.username ? (
                            <>
                              <input style={{...inp,flex:2,padding:"5px 10px",fontSize:13}} value={editingMember.username} onChange={e=>setEditingMember({...editingMember,username:e.target.value})}/>
                              <input style={{...inp,flex:1,padding:"5px 10px",fontSize:13}} value={editingMember.code} onChange={e=>setEditingMember({...editingMember,code:e.target.value})}/>
                              <button style={{...addBtn,padding:"5px 12px",fontSize:12,background:T.green}} onClick={saveMemberEdit}>✓</button>
                              <button className="btn-ghost" style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:7,padding:"5px 10px",fontSize:12,cursor:"pointer"}} onClick={()=>setEditingMember(null)}>✕</button>
                            </>
                          ) : (
                            <>
                              <Avatar name={m.username} size={28} profile={profiles[m.username]}/>
                              <span style={{flex:1,fontSize:13,fontWeight:500,color:T.text}}>{m.isAdmin?"👑 ":""}{m.username}</span>
                              <Tag>{m.code}</Tag>
                              <button className="btn-ghost" title={m.isAdmin?"Retirer les droits admin":"Rendre admin"}
                                style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:7,padding:"4px 8px",fontSize:11,cursor:"pointer",opacity:m.isAdmin?1:0.5}}
                                onClick={()=>toggleMemberAdmin(m.username)}>👑</button>
                              <button className="btn-ghost" style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:7,padding:"4px 8px",fontSize:11,cursor:"pointer"}} onClick={()=>setEditingMember({...m,_orig:m.username})}>✏️</button>
                              <button style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:14,padding:4}} onClick={()=>removeMember(m.username)}>✕</button>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Formats & prix des glaces */}
                  {restaurants.filter(r=>r.kind==="glace").map(r=>(
                    <div key={r.id} style={card}>
                      <h2 style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:4}}>{r.emoji} {r.label} : formats & prix</h2>
                      <p style={{fontSize:12,color:T.textFaint,marginBottom:14}}>Le nombre de boules (1 ou 2) détermine combien de parfums on peut choisir.</p>
                      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
                        {scoopOptions(r).map((so,i)=>(
                          <div key={i+"_"+so.label+"_"+so.price+"_"+so.count} style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                            <input style={{...inp,flex:2,minWidth:120,padding:"6px 10px",fontSize:13}} defaultValue={so.label}
                              onBlur={e=>{ const v=e.target.value.trim(); if(v && v!==so.label) updateScoop(r.id,i,{label:v}); }}/>
                            <select value={so.count||1} onChange={e=>updateScoop(r.id,i,{count:Number(e.target.value)})}
                              style={{...inp,width:110,flex:"none",padding:"6px 10px",fontSize:13}}>
                              <option value={1}>1 boule</option>
                              <option value={2}>2 boules</option>
                            </select>
                            <input style={{...inp,width:100,flex:"none",padding:"6px 10px",fontSize:13}} defaultValue={priceToInput(so.price)} placeholder="Prix €" inputMode="decimal"
                              onBlur={e=>{ if(e.target.value.trim()!==priceToInput(so.price)) updateScoop(r.id,i,{price:parsePrice(e.target.value)}); }}/>
                            <button style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:14}} onClick={()=>removeScoop(r.id,i)}>✕</button>
                          </div>
                        ))}
                      </div>
                      <button style={{...addBtn,padding:"6px 14px",fontSize:12}} onClick={()=>addScoop(r.id)}>+ Ajouter un format</button>
                    </div>
                  ))}

                  {/* Listes */}
                  {[
                    {label:"🥫 Sauces",items:sauces,newVal:newSauce,setNew:setNewSauce,add:addSauce,remove:async s=>ps(sauces.filter(x=>x!==s))},
                    {label:"🥗 Crudités",items:crudites,newVal:newCrudite,setNew:setNewCrudite,add:addCrudite,remove:async c=>pc(crudites.filter(x=>x!==c))},
                    {label:"🥤 Boissons",items:boissons,newVal:newBoisson,setNew:setNewBoisson,add:addBoisson,remove:async b=>pb(boissons.filter(x=>x!==b))},
                  ].map(({label,items,newVal,setNew,add,remove})=>(
                    <div key={label} style={card}>
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

                  {/* Suppléments */}
                  <div style={card}>
                    <h2 style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:4}}>➕ Suppléments & catégories personnalisées</h2>
                    <p style={{fontSize:12,color:T.textFaint,marginBottom:14}}>
                      Chaque option peut avoir un prix (optionnel). Il s'affiche sur les choix et s'ajoute aux totaux. Sans prix = inclus.
                    </p>
                    <div style={{background:T.bgHover,borderRadius:10,padding:"14px",marginBottom:14,border:`1px solid ${T.borderLight}`}}>
                      <input style={{...inp,marginBottom:10}} value={newExtraLabel} onChange={e=>setNewExtraLabel(e.target.value)} placeholder="Nom de la catégorie… (ex : Suppléments)"/>
                      <p style={{fontSize:11,color:T.textFaint,marginBottom:6}}>Applicable à :</p>
                      <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                        {restaurants.map(r=>(
                          <Pill key={r.id} label={r.emoji+" "+r.label} active={newExtraApplies.includes(r.id)} accent={r.accent}
                            onClick={()=>setNewExtraApplies(p=>p.includes(r.id)?p.filter(x=>x!==r.id):[...p,r.id])}/>
                        ))}
                      </div>
                      <button style={{...addBtn,opacity:newExtraLabel&&newExtraApplies.length?1:0.5}} onClick={addExtraCategory}>+ Créer la catégorie</button>
                    </div>
                    {extras.map(ex=>(
                      <div key={ex.id} style={{borderLeft:`3px solid ${ex.accent}`,paddingLeft:14,marginBottom:14}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                          <div>
                            <span style={{fontSize:14,fontWeight:600,color:T.text}}>{ex.label}</span>
                            <span style={{marginLeft:8,fontSize:11,color:T.textSub}}>{(ex.appliesTo||[]).map(id=>findResto(restaurants,id)?.emoji).join(" ")}</span>
                          </div>
                          <button style={{background:T.red+"11",border:`1px solid ${T.red}33`,color:T.red,
                            borderRadius:7,padding:"3px 8px",fontSize:11,cursor:"pointer"}}
                            onClick={()=>removeExtraCategory(ex.id)}>Supprimer</button>
                        </div>
                        <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                          {ex.options.map(o=>{
                            const current=priceToInput(extraOptPrice(ex,o));
                            return (
                              <div key={o} style={{background:T.bgTag,border:`1px solid ${T.borderLight}`,borderRadius:20,
                                padding:"3px 6px 3px 10px",display:"flex",alignItems:"center",gap:5}}>
                                <span style={{fontSize:12,color:T.text}}>{o}</span>
                                <span style={{fontSize:11,color:T.textFaint,marginLeft:2}}>€</span>
                                <input key={o+"_"+current} defaultValue={current} placeholder="0,00" inputMode="decimal"
                                  title="Prix du supplément (laisser vide = inclus)"
                                  onBlur={e=>{ if(e.target.value.trim()!==current) setExtraOptionPrice(ex.id,o,e.target.value); }}
                                  onKeyDown={e=>{ if(e.key==="Enter") e.target.blur(); }}
                                  style={{width:52,background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:12,
                                    color:T.text,padding:"2px 6px",fontSize:11,textAlign:"right",fontFamily:"'DM Sans',sans-serif"}}/>
                                <button style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:11}} onClick={()=>removeExtraOption(ex.id,o)}>✕</button>
                              </div>
                            );
                          })}
                        </div>
                        <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                          <input style={{...inp,flex:1,minWidth:140,padding:"5px 10px",fontSize:12}} value={newExtraOption[ex.id]||""}
                            onChange={e=>setNewExtraOption(p=>({...p,[ex.id]:e.target.value}))}
                            onKeyDown={e=>e.key==="Enter"&&addExtraOption(ex.id)}
                            placeholder="Nouvelle option… (ex : Fromage)"/>
                          <input style={{...inp,width:100,flex:"none",padding:"5px 10px",fontSize:12}} value={newExtraPrice[ex.id]||""}
                            inputMode="decimal"
                            onChange={e=>setNewExtraPrice(p=>({...p,[ex.id]:e.target.value}))}
                            onKeyDown={e=>e.key==="Enter"&&addExtraOption(ex.id)}
                            placeholder="Prix € (opt.)"/>
                          <button style={{...addBtn,padding:"5px 12px",fontSize:12}} onClick={()=>addExtraOption(ex.id)}>+ Ajouter</button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Citations d'accueil */}
                  <div style={card}>
                    <h2 style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:4}}>💬 Citations d'accueil</h2>
                    <p style={{fontSize:12,color:T.textFaint,marginBottom:14}}>Une citation au hasard s'affiche à la connexion. Aucune citation = pas de fenêtre d'accueil.</p>
                    <div style={{display:"flex",gap:8,marginBottom:14}}>
                      <input style={{...inp,flex:1}} value={newQuote} onChange={e=>setNewQuote(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addQuote()} placeholder="Nouvelle citation…"/>
                      <button style={addBtn} onClick={addQuote}>+ Ajouter</button>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {quotes.map((q,i)=>(
                        <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:T.bgHover,borderRadius:10,border:`1px solid ${T.borderLight}`}}>
                          <span style={{flex:1,fontSize:13,color:T.textSub,fontStyle:"italic"}}>« {q.text} »{q.author?` — ${q.author}`:""}</span>
                          <button style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:12}} onClick={()=>pq(quotes.filter((_,j)=>j!==i))}>✕</button>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Éditeur avancé */}
                  <div style={card}>
                    <h2 style={{fontSize:15,fontWeight:600,color:T.text,marginBottom:4}}>🧩 Éditeur avancé</h2>
                    <p style={{fontSize:12,color:T.textFaint,marginBottom:14,lineHeight:1.5}}>
                      Modifie directement n'importe quel document de configuration : restaurants (nom, couleurs, liens, sections, comportement des boutons),
                      nom de l'application, etc. Une erreur de format est refusée avant l'enregistrement.
                    </p>
                    <JsonEditor T={T} docs={[
                      {id:"restaurants", value:{list:restaurants}},
                      {id:"app",         value:appConfig},
                      {id:"members",     value:{list:members}},
                      {id:"quotes",      value:{list:quotes}},
                      {id:"sauces",      value:{list:sauces}},
                      {id:"crudites",    value:{list:crudites}},
                      {id:"boissons",    value:{list:boissons}},
                      {id:"extras",      value:{list:extras}},
                    ]}/>
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
