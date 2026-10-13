import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, addDoc,
  query, where, writeBatch,
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import Planning from "./Planning.jsx";

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
  detail:"", snackType:"",
  sauces:[], saucesMode:"some",
  crudites:[], cruditesMode:"some", cruditesTout:false,
  boules:"", boule1:"", boule2:"",
  frites:"", friteSup:"", sauceFrite:"", boisson:"",
  extras:{}, extrasMode:{},
  validated:false,
};

// ── Palettes d'interface (UI, pas des données métier) ─────────────────────────
const EXTRA_ACCENTS = ["#9b7fa6","#c97a4a","#5a8f7b","#7a9ab5","#b5836a","#6b8f6b"];
const EMOJIS_LIST = ["😊","😎","🤩","🥳","😋","🤔","😴","🤓","👻","🦊","🐱","🐸","🦄","🍕","🌮","🍜","☕","🎮","🎸","🌈","⚡","🔥","💎","🚀"];
const COLORS_LIST = ["#c97a8f","#c97a4a","#5a8f7b","#7a9ab5","#9b7fa6","#c8922a","#5a7a9b","#8f5a7a","#4a8f6a","#9b6a4a"];

// ── Thèmes ────────────────────────────────────────────────────────────────────
const LIGHT = {
  isDark:false,
  sidebar:"#1a1a2e", sidebarBg:"#16213e",
  bg:"#f0f2f5", bgCard:"#ffffff", bgHover:"#f5f7fa", bgInput:"#f5f7fa", bgTag:"#e8eaed",
  border:"#d0d3d8", borderLight:"#e4e6ea",
  text:"#0a0a0a", textSub:"#3a3a3a", textFaint:"#6b6b6b",
  accent:"#3b5bdb", accentLight:"#e8edff",
  green:"#2f9e44", red:"#c92a2a", orange:"#d9480f",
  shadow:"0 2px 12px rgba(0,0,0,0.08)", shadowHover:"0 4px 20px rgba(0,0,0,0.12)",
};
const DARK = {
  isDark:true,
  sidebar:"#2a1f14", sidebarBg:"#1e1610",
  bg:"#0f0c08", bgCard:"#1c1610", bgHover:"#231c14", bgInput:"#231c14", bgTag:"#2a2018",
  border:"#3a2e20", borderLight:"#2a2018",
  text:"#f5efe6", textSub:"#b8a58c", textFaint:"#8a7560",
  accent:"#e0a83a", accentLight:"#2a2010",
  green:"#6fb39a", red:"#e0735a", orange:"#f08c4a",
  shadow:"0 2px 16px rgba(0,0,0,0.3)", shadowHover:"0 4px 24px rgba(0,0,0,0.4)",
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
  const n=parseFloat(String(p).replace(/[^0-9.,-]/g,"").replace(",","."));
  return isNaN(n)?null:n;
}
function normName(s){
  return (s||"").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/\s+/g," ").trim();
}
function fmtEuro(n){ return "€ "+Number(n||0).toFixed(2).replace(".",","); }
function priceToInput(p){ const n=parsePrice(p); return n==null ? "" : n.toFixed(2).replace(".",","); }
function round2(n){ return Math.round((n||0)*100)/100; }
function escapeRe(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,"\\$&"); }
function stripPrefix(name, prefix){
  if(!prefix) return name;
  return name.replace(new RegExp("^"+escapeRe(prefix)+"\\s*","i"),"").trim();
}
function todayStr(){ return new Date().toLocaleDateString("sv-SE"); }
function fmtTime(ts){ return new Date(ts).toLocaleTimeString("fr-BE",{hour:"2-digit",minute:"2-digit"}); }
function fmtDay(d){ return new Date(d).toLocaleDateString("fr-BE",{weekday:"short",day:"numeric",month:"short"}); }

// ── Restaurants (tout vient de config/restaurants) ────────────────────────────
// kind : "snack" | "plat" | "glace" — section.action.type : main | frite | sauce | boisson | scoop | none
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
function groupedItems(sections){
  return sections.map(s=>({ cat:s.cat, items:(s.items||[]).map(it=>({label:it.name, price:parsePrice(it.price)})) }));
}
function isComplete(order, r){
  if(!order?.choice || !r) return false;
  if(r.kind==="glace") return !!order.boules && !!order.boule1 && (scoopCount(r,order.boules)<2 || !!order.boule2);
  return !!(order.detail||"").trim();
}

// ── Listes configurables (sauces, crudités, suppléments) ──────────────────────
// sel = { mode: "some" | "all" | "allBut" | "none", items: [...] }
//   some   → items = éléments choisis
//   all    → tout
//   allBut → items = éléments exclus
//   none   → rien
const LIST_DEFAULTS = { multi:true, all:false, allBut:false, none:false, noneLabel:"" };
const listSettings = s => ({ ...LIST_DEFAULTS, ...(s||{}) });

function readSel(o, field){
  const items=o?.[field]||[];
  const mode=o?.[field+"Mode"];
  if(mode) return { mode, items };
  if(field==="crudites" && o?.cruditesTout) return { mode:"all", items:[] };
  return { mode:"some", items };
}
function readExtraSel(o, id){ return { mode:o?.extrasMode?.[id]||"some", items:o?.extras?.[id]||[] }; }
function writeSel(o, field, sel){
  if(field==="sauces")   return { sauces:sel.items, saucesMode:sel.mode };
  if(field==="crudites") return { crudites:sel.items, cruditesMode:sel.mode, cruditesTout:sel.mode==="all" };
  return {
    extras:{ ...(o.extras||{}), [field]:sel.items },
    extrasMode:{ ...(o.extrasMode||{}), [field]:sel.mode },
  };
}
function selectedOf(sel, options){
  const items=sel.items||[];
  switch(sel.mode){
    case "all":    return options||[];
    case "allBut": return (options||[]).filter(o=>!items.includes(o));
    case "none":   return [];
    default:       return items;
  }
}
function formatSel(sel, label, settings, mapItem=x=>x){
  const st=listSettings(settings); const items=sel.items||[];
  switch(sel.mode){
    case "none":   return st.noneLabel || `Sans ${label.toLowerCase()}`;
    case "all":    return `${label} : tout`;
    case "allBut": return items.length ? `${label} : tout sauf ${items.join(", ")}` : `${label} : tout`;
    default:       return items.length ? `${label} : ${items.map(mapItem).join(", ")}` : null;
  }
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
// ctx = { restaurants, extras, sauces, crudites, listCfg:{ sauces, crudites } }
function formatOrderFull(o, ctx={}) {
  if (!o?.choice) return [];
  const r = findResto(ctx.restaurants, o.choice);
  const lines = [];
  const pushExtras = () => (ctx.extras||[]).filter(ex=>ex.appliesTo?.includes(o.choice)).forEach(ex=>{
    const txt = formatSel(readExtraSel(o,ex.id), ex.label, ex.settings, opt=>extraLabel(ex,opt));
    if (txt) lines.push({ emoji:"➕", text: txt });
  });
  if (r?.kind==="snack") {
    const firstPart = [o.snackType, o.detail].filter(Boolean).join(" ");
    if (firstPart) lines.push({ emoji:r.emoji||"🥙", text: firstPart });
    pushExtras();
    if (o.frites)     lines.push({ emoji:"🍟", text: o.frites });
    if (o.friteSup)   lines.push({ emoji:"🍟", text: "Frite sup. "+o.friteSup });
    if (o.sauceFrite) lines.push({ emoji:"🥣", text: "Sauce frite : "+o.sauceFrite });
    const cru = formatSel(readSel(o,"crudites"), "Crudités", ctx.listCfg?.crudites);
    if (cru) lines.push({ emoji:"🥗", text: cru });
    const sau = formatSel(readSel(o,"sauces"), "Sauces", ctx.listCfg?.sauces);
    if (sau) lines.push({ emoji:"🫙", text: sau });
    if (o.boisson)    lines.push({ emoji:"🥤", text: o.boisson });
  } else if (r?.kind==="glace") {
    if (o.boules)  lines.push({ emoji:r.emoji||"🍦", text: o.boules });
    if (scoopCount(r,o.boules)>=2 && o.boule1 && o.boule2) lines.push({ emoji:"✨", text: `${o.boule1} + ${o.boule2}` });
    else if (o.boule1) lines.push({ emoji:"✨", text: o.boule1 });
    pushExtras();
  } else {
    if (o.detail)  lines.push({ emoji:r?.emoji||"🍽️", text: o.detail });
    pushExtras();
    if (o.boisson) lines.push({ emoji:"🥤", text: o.boisson });
  }
  return lines;
}
function formatOrder(o, ctx) { return formatOrderFull(o,ctx).map(l=>l.text).join(" · "); }

// ── Prix ──────────────────────────────────────────────────────────────────────
function buildPriceIndex(r){
  const idx={};
  sectionsOf(r).forEach(s=>(s.items||[]).forEach(it=>{ const p=parsePrice(it.price); if(p!=null) idx[normName(it.name)]=p; }));
  return idx;
}
function mainCandidates(order, r){
  const d=order.detail||"";
  if(r?.kind==="snack" && order.snackType){
    const c=sectionsOf(r).filter(s=>s.action?.snackType===order.snackType).map(s=>((s.action.prefix||"")+" "+d).trim());
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
    selectedOf(readExtraSel(order,ex.id), ex.options).forEach(opt=>{
      out.push({ label:"+ "+opt, price:extraOptPrice(ex,opt), optional:true });
    });
  });
  return out;
}
function orderPricedLines(order, ctx={}){
  const lines=[];
  if(!order || !order.choice) return { lines, total:0, hasUnpriced:false, empty:true };
  const r=findResto(ctx.restaurants, order.choice);
  if(r?.kind==="glace"){
    const fl=[order.boule1,order.boule2].filter(Boolean).join(" + ");
    const so=scoopOptions(r).find(o=>o.label===order.boules);
    lines.push({ label:(order.boules||"Glace")+(fl?" · "+fl:""), price: so ? parsePrice(so.price) : null });
    lines.push(...extraPricedLines(order, ctx.extras));
  } else {
    const idx=buildPriceIndex(r);
    const main=lookup(idx, mainCandidates(order, r));
    const mainLabel=[order.snackType,order.detail].filter(Boolean).join(" ").trim()||"Plat à choisir";
    lines.push({ label:mainLabel, price:main?main.price:null });
    lines.push(...extraPricedLines(order, ctx.extras));
    if(order.friteSup){
      const f=friteSizes(r).find(it=>normName(it.name)===normName(order.friteSup));
      lines.push({ label:"Frite "+order.friteSup, price:f?parsePrice(f.price):null });
    }
    if(order.boisson){
      let bp=idx[normName(order.boisson)];
      if(bp==null){ const key=Object.keys(idx).find(k=>k.startsWith(normName(order.boisson))); if(key) bp=idx[key]; }
      lines.push({ label:order.boisson, price:(bp!=null?bp:null) });
    }
  }
  const total=lines.reduce((a,l)=>a+(l.price||0),0);
  const hasUnpriced=lines.some(l=>l.price==null && !l.optional);
  return { lines, total, hasUnpriced, empty:false };
}
function buildRestoRecap(names, orders, ctx={}){
  const out=[];
  (ctx.restaurants||[]).forEach(r=>{
    const map={};
    (names||[]).forEach(n=>{
      const o=orders[n]; if(!o || o.choice!==r.id) return;
      const key=formatOrder(o,ctx)||"Commande";
      const p=orderPricedLines(o,ctx);
      if(!map[key]) map[key]={ qty:0, total:0, unpriced:false, people:[] };
      map[key].qty++; map[key].total+=p.total; map[key].unpriced = map[key].unpriced || p.hasUnpriced; map[key].people.push(n);
    });
    const items=Object.entries(map).map(([label,v])=>({ label, ...v }));
    if(items.length) out.push({ key:r.id, label:restoLabel(r), accent:r.accent, items, total:items.reduce((a,i)=>a+i.total,0) });
  });
  return {
    groups:out,
    total:out.reduce((a,g)=>a+g.total,0),
    hasUnpriced:out.some(g=>g.items.some(i=>i.unpriced)),
  };
}
function restoRecapText(recap){
  let t="Commande midi";
  recap.groups.forEach(g=>{
    t+="\n\n"+g.label;
    g.items.forEach(it=>{ t+="\n  "+it.qty+"\u00d7 "+it.label; });
    t+="\n  Sous-total estimé : "+fmtEuro(g.total);
  });
  t+="\n\nTotal estimé : "+fmtEuro(recap.total);
  return t;
}

// ── CSS global ────────────────────────────────────────────────────────────────
const CSS = (T) => `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500;600&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { -webkit-text-size-adjust: 100%; }
  body { background: ${T.bg}; font-family: 'DM Sans', sans-serif; color: ${T.text}; overflow-x: hidden;
         display: block !important; place-items: initial !important; min-width: 0 !important; text-align: left; }
  #root { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; text-align: left !important; }
  .num { font-variant-numeric: tabular-nums; }
  @media (max-width: 767px) {
    input, select, textarea { font-size: 16px !important; }
    button { -webkit-tap-highlight-color: transparent; }
  }
  img, svg, video, canvas { max-width: 100%; height: auto; }
  textarea { resize: vertical; font-family: inherit; }
  button, input, select, textarea { font-family: inherit; }
  input:focus, textarea:focus, select:focus { outline: none; border-color: ${T.accent} !important; }
  button:focus { outline: none; }
  button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
    outline: 2px solid ${T.accent}; outline-offset: 2px;
  }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-thumb { background: ${T.border}; border-radius: 4px; }
  @keyframes fadeUp  { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
  @keyframes shake   { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} }
  @keyframes slideIn { from{opacity:0;transform:translateX(-8px)} to{opacity:1;transform:translateX(0)} }
  @keyframes toastIn { from{opacity:0;transform:translateX(-50%) translateY(12px)} to{opacity:1;transform:translateX(-50%) translateY(0)} }
  @media (prefers-reduced-motion: reduce) { *, *::before, *::after { animation: none !important; transition: none !important; } }
  .row-hover:hover { background: ${T.bgHover} !important; }
  .btn-ghost:hover { background: ${T.bgTag} !important; }
  .avatar-tooltip-wrap:hover .avatar-tooltip { display: block !important; }
  .info-wrap:hover .info-pop { display: block !important; }
`;

// ── Petits composants ─────────────────────────────────────────────────────────
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
  const map = { live:{c:"#2f9e44",t:"En direct"}, connecting:{c:"#c8922a",t:"Connexion…"}, error:{c:"#c92a2a",t:"Hors ligne"} };
  const s = map[status] || map.connecting;
  return <span title={s.t} style={{ width:8, height:8, borderRadius:"50%", background:s.c, display:"inline-block", flexShrink:0, boxShadow:`0 0 0 3px ${s.c}22` }}/>;
}

function Tag({ T, children, color, bg }) {
  return (
    <span style={{ background:bg||T.bgTag, color:color||T.textSub,
      borderRadius:20, padding:"2px 10px", fontSize:11, fontWeight:500, whiteSpace:"nowrap" }}>
      {children}
    </span>
  );
}

function Pill({ T, label, active, accent, onClick, disabled, strike }) {
  const a = accent || T.accent;
  return (
    <button type="button" onClick={onClick} disabled={disabled} aria-pressed={!!active}
      style={{ background: strike ? "transparent" : active ? a+"22" : "transparent",
        border:`1px ${strike?"dashed":"solid"} ${strike ? T.red+"99" : active ? a : T.border}`,
        borderRadius:20, padding:"5px 12px", fontSize:12, fontWeight:active&&!strike?600:400,
        color: strike ? T.textFaint : active ? a : T.textSub,
        textDecoration: strike ? "line-through" : "none",
        cursor:disabled?"not-allowed":"pointer", transition:"all 0.15s", whiteSpace:"nowrap", opacity:disabled?0.45:1 }}>
      {strike?"✕ ":""}{label}
    </button>
  );
}

function OrderPills({ order, ctx, T }) {
  const lines = formatOrderFull(order, ctx);
  if (!lines.length) return <span style={{fontSize:12,color:T.textFaint,fontStyle:"italic"}}>Aucun détail</span>;
  return (
    <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
      {lines.map((line,i)=>(
        <span key={i} style={{background:T.bgTag,border:`1px solid ${T.borderLight}`,borderRadius:20,
          padding:"2px 10px",fontSize:11.5,color:T.textSub,display:"inline-flex",alignItems:"center",
          gap:3,maxWidth:"100%",whiteSpace:"normal",wordBreak:"break-word"}}>
          {line.emoji} {line.text}
        </span>
      ))}
    </div>
  );
}

// ── Sélecteur de liste (Tout / Tout sauf / Aucun) ─────────────────────────────
function ListPicker({ T, title, options, sel, settings, accent, disabled, onChange, optionLabel=o=>o, onAddOption }) {
  const st = listSettings(settings);
  const [newOpt, setNewOpt] = useState("");
  const mode = sel.mode || "some";
  const items = sel.items || [];
  const a = accent || T.accent;

  const setMode = m => onChange(mode===m ? { mode:"some", items:[] } : { mode:m, items:[] });
  const clickOpt = o => {
    if (mode==="some") {
      if (!st.multi) onChange({ mode:"some", items: items.includes(o) ? [] : [o] });
      else onChange({ mode:"some", items: items.includes(o) ? items.filter(x=>x!==o) : [...items,o] });
    } else if (mode==="all") {
      onChange(st.allBut ? { mode:"allBut", items:[o] } : { mode:"some", items: options.filter(x=>x!==o) });
    } else if (mode==="allBut") {
      onChange({ mode:"allBut", items: items.includes(o) ? items.filter(x=>x!==o) : [...items,o] });
    } else {
      onChange({ mode:"some", items:[o] });
    }
  };
  const isOn = o => mode==="all" || (mode==="allBut" && !items.includes(o)) || (mode==="some" && items.includes(o));
  const isStruck = o => mode==="allBut" && items.includes(o);
  const showModes = (st.multi && (st.all || st.allBut)) || st.none;

  const addOpt = async () => {
    const v = newOpt.trim(); if (!v) return;
    await onAddOption(v); setNewOpt("");
    if (mode==="some") onChange({ mode:"some", items: st.multi ? [...items, v] : [v] });
  };

  return (
    <div>
      <p style={{fontSize:12,fontWeight:600,color:T.textSub,marginBottom:6}}>{title}</p>
      {showModes && (
        <div style={{display:"flex",gap:5,flexWrap:"wrap",marginBottom:6}}>
          {st.multi && st.all    && <Pill T={T} label="Tout" active={mode==="all"} accent={T.accent} disabled={disabled} onClick={()=>setMode("all")}/>}
          {st.multi && st.allBut && <Pill T={T} label="Tout sauf…" active={mode==="allBut"} accent={T.accent} disabled={disabled} onClick={()=>setMode("allBut")}/>}
          {st.none && <Pill T={T} label={st.noneLabel||"Aucun"} active={mode==="none"} accent={T.accent} disabled={disabled} onClick={()=>setMode("none")}/>}
        </div>
      )}
      {mode==="allBut" && <p style={{fontSize:11.5,color:T.textFaint,marginBottom:6}}>Clique sur ce que tu ne veux pas.</p>}
      <div style={{display:"flex",flexWrap:"wrap",gap:5,opacity:mode==="none"?0.5:1}}>
        {options.map(o=>(
          <Pill key={o} T={T} label={optionLabel(o)} active={isOn(o)} strike={isStruck(o)} accent={a}
            disabled={disabled} onClick={()=>clickOpt(o)}/>
        ))}
        {options.length===0 && <span style={{fontSize:12,color:T.textFaint}}>Aucune option configurée.</span>}
      </div>
      {onAddOption && !disabled && (
        <div style={{display:"flex",gap:5,marginTop:7}}>
          <input value={newOpt} onChange={e=>setNewOpt(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addOpt()}
            placeholder="Autre…" style={{flex:1,background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,padding:"5px 9px",fontSize:12}}/>
          {newOpt.trim() && (
            <button onClick={addOpt} style={{background:T.accentLight,border:`1px solid ${T.border}`,borderRadius:8,padding:"4px 10px",fontSize:11.5,color:T.accent,cursor:"pointer",whiteSpace:"nowrap"}}>+ Ajouter</button>
          )}
        </div>
      )}
    </div>
  );
}

// ── Menu déroulant avec option « Autre… » ─────────────────────────────────────
function VariantSelect({ T, groups, value, onPick, onType, disabled, placeholder }) {
  const all = groups.flatMap(g=>g.items.map(i=>i.label));
  const known = all.includes(value);
  const isOther = !!value && !known;
  const [custom, setCustom] = useState(isOther);
  const showCustom = isOther || custom;
  return (
    <div>
      <select value={known ? value : (showCustom ? "__other__" : "")} disabled={disabled}
        onChange={e=>{ const v=e.target.value; if(v==="__other__"){ setCustom(true); onPick(""); } else { setCustom(false); onPick(v); } }}
        style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:10,
          color:T.text,padding:"9px 12px",fontSize:14,cursor:disabled?"default":"pointer",opacity:disabled?0.5:1}}>
        <option value="">{placeholder}</option>
        {groups.map((g,gi)=> g.cat ? (
          <optgroup key={g.cat+gi} label={g.cat}>
            {g.items.map(it=><option key={it.label} value={it.label}>{it.label}{it.price!=null?"  ·  "+fmtEuro(it.price):""}</option>)}
          </optgroup>
        ) : g.items.map(it=><option key={it.label} value={it.label}>{it.label}{it.price!=null?"  ·  "+fmtEuro(it.price):""}</option>))}
        <option value="__other__">Autre…</option>
      </select>
      {showCustom && (
        <input autoFocus={custom && !value} value={value||""} disabled={disabled} onChange={e=>onType(e.target.value)}
          placeholder="Précise ta commande…"
          style={{width:"100%",marginTop:6,background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,padding:"8px 12px",fontSize:13}}/>
      )}
    </div>
  );
}

// ── Formulaire de commande par étapes ─────────────────────────────────────────
function OrderForm({ T, name, order, r, ctx, sauces, crudites, boissons, lists, mealExtras,
  patch, patchDetail, addSauce, addBoisson, onValidate, onSaveFavorite }) {

  const complete = isComplete(order, r);
  const steps = [];
  if (r.kind==="glace") { steps.push({id:"format",title:"Format"}); steps.push({id:"parfums",title:"Parfums"}); }
  else steps.push({id:"plat",title:"Plat"});
  if (r.kind==="snack") steps.push({id:"accomp",title:"Accompagnements"});
  if (mealExtras.length) steps.push({id:"supp",title:"Suppléments"});
  if (r.kind!=="glace") steps.push({id:"boisson",title:"Boisson"});
  steps.push({id:"recap",title:"Récap"});

  const [step, setStep] = useState(complete ? steps.length-1 : 0);
  const [otherMode, setOtherMode] = useState(false);
  const [newBoisson, setNewBoisson] = useState("");
  const prevChoice = useRef(order.choice);
  useEffect(()=>{
    if (prevChoice.current!==order.choice) { setStep(0); setOtherMode(false); prevChoice.current=order.choice; }
  },[order.choice]);

  const idx = Math.min(step, steps.length-1);
  const cur = steps[idx];
  const accent = r.accent || T.accent;
  const priced = orderPricedLines(order, ctx);
  const P = (label, active, onClick, key) => <Pill key={key||label} T={T} label={label} active={active} accent={accent} onClick={onClick}/>;
  const block = { display:"flex", flexDirection:"column", gap:14 };
  const hint = t => <p style={{fontSize:12,color:T.textFaint}}>{t}</p>;
  const sub = t => <p style={{fontSize:12,fontWeight:600,color:T.textSub,marginBottom:6}}>{t}</p>;

  let content = null;

  if (cur.id==="format") {
    content = (
      <div style={block}>
        <div>
          {sub("Combien de boules ?")}
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {scoopOptions(r).map(so=>{
              const p=parsePrice(so.price);
              return P(so.label+(p!=null?"  ·  "+fmtEuro(p):""), order.boules===so.label, ()=>{
                const on = order.boules===so.label;
                patch({ boules: on?"":so.label, ...((so.count||1)<2 ? {boule2:""} : {}) });
                if(!on) setStep(s=>s+1);
              }, so.label);
            })}
          </div>
        </div>
      </div>
    );
  }

  if (cur.id==="parfums") {
    const parfums = parfumsOf(r);
    const two = scoopCount(r, order.boules)>=2;
    content = !order.boules ? hint("Choisis d'abord un format.") : (
      <div style={block}>
        <div>
          {sub(two?"Boule 1":"Parfum")}
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {parfums.map(p=>P(p.name, order.boule1===p.name, ()=>patch({boule1: order.boule1===p.name?"":p.name})))}
          </div>
        </div>
        {two && (
          <div>
            {sub("Boule 2")}
            <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
              {parfums.map(p=>P(p.name, order.boule2===p.name, ()=>patch({boule2: order.boule2===p.name?"":p.name})))}
            </div>
          </div>
        )}
      </div>
    );
  }

  if (cur.id==="plat") {
    if (r.kind==="snack") {
      const types = snackTypesOf(r);
      const otherSections = sectionsByAction(r,"main").filter(s=>!s.action?.snackType);
      const otherItems = otherSections.flatMap(s=>s.items||[]);
      const isOther = !order.snackType && (otherMode || otherItems.some(it=>it.name===order.detail));
      content = (
        <div style={block}>
          <div>
            {sub("Qu'est-ce que tu prends ?")}
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {types.map(t=>P(t, order.snackType===t, ()=>{ setOtherMode(false); patch({snackType: order.snackType===t?"":t, detail:""}); }))}
              {otherSections.length>0 && P("Assiettes & autres", isOther, ()=>{ setOtherMode(!isOther); patch({snackType:"", detail:""}); }, "__other")}
            </div>
          </div>
          {order.snackType && (
            <VariantSelect key={"t_"+order.snackType} T={T} groups={[{cat:"", items:snackVariants(r, order.snackType)}]}
              value={order.detail} onPick={v=>patch({detail:v})} onType={patchDetail}
              placeholder={`— Choisis ton ${order.snackType} —`}/>
          )}
          {isOther && (
            <VariantSelect key="other" T={T} groups={groupedItems(otherSections)}
              value={order.detail} onPick={v=>patch({detail:v})} onType={patchDetail}
              placeholder="— Choisis ton plat —"/>
          )}
        </div>
      );
    } else {
      content = (
        <div style={block}>
          {sub("Qu'est-ce que tu prends ?")}
          <VariantSelect T={T} groups={groupedItems(sectionsByAction(r,"main"))}
            value={order.detail} onPick={v=>patch({detail:v})} onType={patchDetail}
            placeholder="— Choisis ton plat —"/>
        </div>
      );
    }
  }

  if (cur.id==="accomp") {
    const sizes = friteSizes(r);
    content = (
      <div style={block}>
        {(r.fritePlacement||[]).length>0 && (
          <div>
            {sub("🍟 Frites dans le sandwich")}
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {r.fritePlacement.map(o=>P(o, order.frites===o, ()=>patch({frites: order.frites===o?"":o})))}
            </div>
          </div>
        )}
        {sizes.length>0 && (
          <div>
            {sub("🍟 Frite en plus")}
            <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
              {sizes.map(it=>{ const p=parsePrice(it.price);
                return P(it.name+(p!=null?"  ·  "+fmtEuro(p):""), order.friteSup===it.name, ()=>patch({friteSup: order.friteSup===it.name?"":it.name}), it.name); })}
            </div>
            {order.friteSup && (
              <div style={{marginTop:10}}>
                {sub("🥣 Sauce pour la frite")}
                <div style={{display:"flex",gap:5,flexWrap:"wrap"}}>
                  {sauces.map(s=>P(s, order.sauceFrite===s, ()=>patch({sauceFrite: order.sauceFrite===s?"":s})))}
                </div>
              </div>
            )}
          </div>
        )}
        <ListPicker T={T} title="🫙 Sauces" options={sauces} sel={readSel(order,"sauces")} settings={lists.sauces}
          accent="#9b7fa6" onChange={s=>patch(writeSel(order,"sauces",s))} onAddOption={addSauce}/>
        <ListPicker T={T} title="🥗 Crudités" options={crudites} sel={readSel(order,"crudites")} settings={lists.crudites}
          accent="#5a8f7b" onChange={s=>patch(writeSel(order,"crudites",s))}/>
      </div>
    );
  }

  if (cur.id==="supp") {
    content = (
      <div style={block}>
        {mealExtras.map(ex=>(
          <ListPicker key={ex.id} T={T} title={"➕ "+ex.label} options={ex.options||[]} sel={readExtraSel(order,ex.id)}
            settings={ex.settings} accent={ex.accent} optionLabel={o=>extraLabel(ex,o)}
            onChange={s=>patch(writeSel(order,ex.id,s))}/>
        ))}
      </div>
    );
  }

  if (cur.id==="boisson") {
    content = (
      <div style={block}>
        <div>
          {sub("🥤 Une boisson ?")}
          <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
            {boissons.map(b=>P(b, order.boisson===b, ()=>patch({boisson: order.boisson===b?"":b})))}
            {order.boisson && !boissons.includes(order.boisson) && P(order.boisson, true, ()=>patch({boisson:""}))}
          </div>
          <div style={{display:"flex",gap:5,marginTop:7}}>
            <input value={newBoisson} onChange={e=>setNewBoisson(e.target.value)} placeholder="Autre boisson…"
              style={{flex:1,background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,padding:"5px 9px",fontSize:12}}/>
            {newBoisson.trim() && !boissons.includes(newBoisson.trim()) && (
              <button onClick={async()=>{ const v=newBoisson.trim(); await patch({boisson:v}); await addBoisson(v); setNewBoisson(""); }}
                style={{background:T.accentLight,border:`1px solid ${T.border}`,borderRadius:8,padding:"4px 10px",fontSize:11.5,color:T.accent,cursor:"pointer"}}>+ Ajouter</button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (cur.id==="recap") {
    content = (
      <div style={block}>
        <OrderPills order={order} ctx={ctx} T={T}/>
        <div style={{background:T.bgHover,borderRadius:10,padding:"10px 12px"}}>
          {priced.lines.map((l,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:13,color:l.optional?T.textFaint:T.textSub,lineHeight:1.9}}>
              <span>{l.label}</span>
              <span>{l.price!=null?fmtEuro(l.price):(l.optional?"inclus":"—")}</span>
            </div>
          ))}
          <div style={{display:"flex",justifyContent:"space-between",borderTop:`1px solid ${T.borderLight}`,marginTop:6,paddingTop:6}}>
            <span style={{fontSize:12.5,color:T.textSub}}>Total{priced.hasUnpriced?" (estimé)":""}</span>
            <span style={{fontWeight:700,fontSize:17,fontVariantNumeric:"tabular-nums",color:T.text}}>{fmtEuro(priced.total)}</span>
          </div>
        </div>
        {!complete && <p style={{fontSize:12.5,color:T.orange}}>⚠️ Il manque encore le choix principal : reviens à l'étape « {steps[0].title} ».</p>}
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <button disabled={!complete} onClick={onValidate}
            style={{flex:1,minWidth:180,background:complete?T.green:T.bgTag,color:complete?"#fff":T.textFaint,border:"none",borderRadius:11,padding:"12px",fontSize:14,fontWeight:700,cursor:complete?"pointer":"not-allowed"}}>
            ✓ Valider ma commande
          </button>
          {onSaveFavorite && (
            <button onClick={onSaveFavorite} className="btn-ghost"
              style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:11,padding:"12px 14px",fontSize:13,cursor:"pointer"}}>
              ⭐ Enregistrer en favori
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Étapes */}
      <div role="tablist" style={{display:"flex",gap:4,marginBottom:14,overflowX:"auto",paddingBottom:2}}>
        {steps.map((s,i)=>{
          const on=i===idx, done=i<idx;
          return (
            <button key={s.id} role="tab" aria-selected={on} onClick={()=>setStep(i)}
              style={{display:"flex",alignItems:"center",gap:6,padding:"5px 10px 5px 5px",borderRadius:20,border:"none",cursor:"pointer",whiteSpace:"nowrap",
                background:on?accent+"20":"transparent",color:on?accent:done?T.textSub:T.textFaint,fontSize:12,fontWeight:on?700:500}}>
              <span style={{width:20,height:20,borderRadius:"50%",display:"inline-flex",alignItems:"center",justifyContent:"center",fontSize:10.5,fontWeight:700,
                background:on?accent:done?accent+"55":T.bgTag,color:on||done?"#fff":T.textFaint}}>{done?"✓":i+1}</span>
              {s.title}
            </button>
          );
        })}
      </div>

      <div key={cur.id} style={{animation:"slideIn 0.2s ease",minHeight:60}}>{content}</div>

      {cur.id!=="recap" && (
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:16,paddingTop:12,borderTop:`1px solid ${T.borderLight}`}}>
          <button onClick={()=>setStep(Math.max(0,idx-1))} disabled={idx===0}
            style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"8px 14px",fontSize:13,cursor:idx===0?"default":"pointer",opacity:idx===0?0.4:1}}>
            ← Retour
          </button>
          <span style={{fontSize:12.5,color:T.textSub}}>Total : <strong style={{color:T.text}}>{fmtEuro(priced.total)}</strong></span>
          <button onClick={()=>setStep(Math.min(steps.length-1,idx+1))}
            style={{background:accent,color:"#fff",border:"none",borderRadius:10,padding:"8px 16px",fontSize:13,fontWeight:600,cursor:"pointer"}}>
            {steps[idx+1]?.id==="recap" ? "Voir le récap →" : "Suivant →"}
          </button>
        </div>
      )}
      {cur.id==="recap" && (
        <button onClick={()=>setStep(0)} style={{marginTop:10,background:"none",border:"none",color:T.textFaint,fontSize:12,cursor:"pointer"}}>← Revenir au début</button>
      )}
    </div>
  );
}

// ── Réglages d'une liste (Config) ─────────────────────────────────────────────
function ListSettingsEditor({ T, settings, onChange }) {
  const st = listSettings(settings);
  const rows = [
    { k:"multi",  label:"Choix multiple",          help:"Sinon, un seul choix possible" },
    { k:"all",    label:"Bouton « Tout »",          help:"Sélectionne tout d'un coup", needMulti:true },
    { k:"allBut", label:"Bouton « Tout sauf… »",    help:"On clique sur ce qu'on ne veut pas", needMulti:true },
    { k:"none",   label:"Bouton « Aucun »",         help:"Ex : « Sans crudités »" },
  ];
  return (
    <div style={{background:T.bgHover,border:`1px solid ${T.borderLight}`,borderRadius:10,padding:"10px 12px",marginTop:12}}>
      <p style={{fontSize:11.5,fontWeight:600,color:T.textSub,marginBottom:8}}>Options proposées à la commande</p>
      <div style={{display:"flex",flexDirection:"column",gap:6}}>
        {rows.map(row=>{
          const dis = row.needMulti && !st.multi;
          return (
            <label key={row.k} style={{display:"flex",alignItems:"center",gap:8,fontSize:13,color:dis?T.textFaint:T.text,cursor:dis?"default":"pointer"}}>
              <input type="checkbox" checked={!!st[row.k] && !dis} disabled={dis} onChange={()=>onChange({...st,[row.k]:!st[row.k]})}/>
              <span>{row.label}</span>
              <span style={{fontSize:11.5,color:T.textFaint}}>{row.help}</span>
            </label>
          );
        })}
        {st.none && (
          <input key={st.noneLabel} defaultValue={st.noneLabel} placeholder="Texte du bouton, ex : Sans crudités"
            onBlur={e=>{ if(e.target.value!==st.noneLabel) onChange({...st, noneLabel:e.target.value.trim()}); }}
            style={{marginLeft:24,background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,padding:"5px 9px",fontSize:12.5,maxWidth:280}}/>
        )}
      </div>
    </div>
  );
}

// ── Connexion ─────────────────────────────────────────────────────────────────
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
    const u = members.find(m=>m.username.toLowerCase()===username.toLowerCase()&&String(m.code)===code.trim());
    if (u) onLogin(u.username);
    else { setError("Nom ou code invalide."); setShake(true); setTimeout(()=>setShake(false),600); }
  };

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
        <p style={{fontSize:13,color:T.textSub,lineHeight:1.6}}>Aucun membre n'est configuré dans <code>config/members</code>. Lance le script d'import une fois :</p>
        <code style={{display:"block",marginTop:10,fontSize:12,background:T.bgTag,padding:"8px 10px",borderRadius:8,color:T.text}}>node --env-file=.env scripts/seed.mjs</code>
      </div>
    </div>
  );

  const labelS = {display:"block",fontSize:11,fontWeight:600,color:T.textSub,marginBottom:6,letterSpacing:"0.06em",textTransform:"uppercase"};
  const fieldS = {width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,padding:"11px 14px",fontSize:15};
  const form = (
    <>
      <div style={{marginBottom:14}}>
        <label htmlFor="login-name" style={labelS}>Ton nom</label>
        <select id="login-name" style={{...fieldS,cursor:"pointer"}} value={username} onChange={e=>setUsername(e.target.value)}>
          <option value="">— Sélectionne ton nom —</option>
          {members.map(u=><option key={u.username} value={u.username}>{u.username}</option>)}
        </select>
      </div>
      <div style={{marginBottom:20}}>
        <label htmlFor="login-code" style={labelS}>Code</label>
        <input id="login-code" style={fieldS} type="password" inputMode="numeric" value={code} placeholder="••••"
          onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()}/>
      </div>
      {error && <p role="alert" style={{color:T.red,fontSize:13,marginBottom:14}}>{error}</p>}
      <button style={{width:"100%",background:`linear-gradient(135deg, ${T.sidebarBg}, ${T.sidebar})`,color:"#fff",border:"none",borderRadius:12,padding:"13px",fontSize:15,fontWeight:600,cursor:"pointer"}}
        onClick={attempt}>Entrer →</button>
      {hint && <p style={{color:T.textFaint,fontSize:11.5,marginTop:14,textAlign:"center"}}>{hint}</p>}
    </>
  );

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.bg,padding:isMobile?"20px 16px":"24px"}}>
      <style>{CSS(T)}</style>
      <button onClick={toggleTheme} aria-label="Changer de thème" style={{position:"fixed",top:16,right:16,background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10,padding:"8px 12px",fontSize:15,cursor:"pointer",color:T.text,zIndex:10}}>
        {isDark?"☀️":"🌙"}
      </button>
      {isMobile ? (
        <div style={{width:"100%",maxWidth:400,animation:shake?"shake 0.5s":"fadeUp 0.5s both"}}>
          <div style={{background:`linear-gradient(145deg, ${T.sidebarBg}, ${T.sidebar})`,borderRadius:"20px 20px 0 0",padding:"32px 28px 28px",textAlign:"center"}}>
            {logo && <div style={{width:52,height:52,borderRadius:14,background:"rgba(255,252,245,0.18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:26,margin:"0 auto 16px"}}>{logo}</div>}
            <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:30,color:"#fff",marginBottom:6,letterSpacing:"-0.5px"}}>{title}</h1>
            {sub && <p style={{color:"rgba(255,252,245,0.6)",fontSize:14}}>{sub}</p>}
          </div>
          <div style={{background:T.bgCard,borderRadius:"0 0 20px 20px",padding:"28px",boxShadow:"0 16px 40px rgba(44,31,14,0.12)"}}>{form}</div>
        </div>
      ) : (
        <div style={{display:"flex",width:"100%",maxWidth:860,borderRadius:24,overflow:"hidden",boxShadow:"0 24px 80px rgba(44,31,14,0.15)",border:`1px solid ${T.border}`,animation:shake?"shake 0.5s":"fadeUp 0.5s both"}}>
          <div style={{width:260,background:`linear-gradient(160deg, ${T.sidebarBg} 0%, ${T.sidebar} 100%)`,padding:"44px 36px",display:"flex",flexDirection:"column",justifyContent:"space-between"}}>
            <div>
              {logo && <div style={{width:48,height:48,borderRadius:14,background:"rgba(255,252,245,0.18)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:24,marginBottom:28}}>{logo}</div>}
              <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:26,color:"#fff",marginBottom:8,letterSpacing:"-0.5px",lineHeight:1.2}}>{title}</h1>
              {sub && <p style={{color:"rgba(255,252,245,0.55)",fontSize:13,lineHeight:1.6}}>{sub}</p>}
            </div>
            <div style={{borderTop:"1px solid rgba(255,252,245,0.12)",paddingTop:20}}>
              {restaurants.map(r=><div key={r.id} style={{color:"rgba(255,252,245,0.5)",fontSize:13,marginBottom:7}}>{r.emoji} {r.label}</div>)}
            </div>
          </div>
          <div style={{flex:1,background:T.bgCard,padding:"44px 40px",display:"flex",flexDirection:"column",justifyContent:"center"}}>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:22,color:T.text,marginBottom:4}}>Bienvenue 👋</h2>
            <p style={{color:T.textSub,fontSize:14,marginBottom:28}}>Connecte-toi pour passer ta commande</p>
            {form}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Section de menu ───────────────────────────────────────────────────────────
function MenuSection({ section, T, isAdmin, onSave, onOrder }) {
  const [items, setItems]       = useState(section.items||[]);
  const [editIdx, setEditIdx]   = useState(null);
  const [editItem, setEditItem] = useState({name:"",price:"",desc:""});
  const [newItem, setNewItem]   = useState({name:"",price:"",desc:""});
  const [showAdd, setShowAdd]   = useState(false);
  useEffect(()=>{ setItems(section.items||[]); },[section.items]);

  const save = async(updated) => { setItems(updated); if(onSave) await onSave(section.cat, updated); };
  const saveEdit = async() => { if(!editItem.name.trim()) return; await save(items.map((it,i)=>i===editIdx?{...editItem}:it)); setEditIdx(null); };
  const deleteItem = async(i) => { if(!window.confirm(`Supprimer « ${items[i].name} » du menu ?`)) return; await save(items.filter((_,x)=>x!==i)); if(editIdx===i) setEditIdx(null); };
  const addItem = async() => { if(!newItem.name.trim()) return; await save([...items,{...newItem}]); setNewItem({name:"",price:"",desc:""}); setShowAdd(false); };

  const accent = section.accent || T.accent;
  const inpS = {background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:7,color:T.text,padding:"6px 8px",fontSize:12.5};

  return (
    <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,marginBottom:12,overflow:"hidden",boxShadow:T.shadow}}>
      <div style={{padding:"11px 20px",background:`${accent}14`,borderBottom:`1px solid ${accent}22`,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span style={{fontSize:14,fontWeight:700,color:accent,fontFamily:"'Syne',sans-serif"}}>{section.cat}</span>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <span style={{fontSize:11,color:accent,opacity:0.8}}>{items.length} article{items.length>1?"s":""}</span>
          {isAdmin && (
            <button onClick={()=>setShowAdd(v=>!v)} style={{background:accent+"18",border:`1px solid ${accent}44`,color:accent,borderRadius:6,padding:"2px 8px",fontSize:11,cursor:"pointer"}}>
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
                <input style={{...inpS,flex:2,minWidth:120}} value={editItem.name} onChange={e=>setEditItem(p=>({...p,name:e.target.value}))} placeholder="Nom…"/>
                <input style={{...inpS,width:70}} value={editItem.price||""} onChange={e=>setEditItem(p=>({...p,price:e.target.value}))} placeholder="Prix…"/>
                <input style={{...inpS,flex:3,minWidth:150}} value={editItem.desc||""} onChange={e=>setEditItem(p=>({...p,desc:e.target.value}))} placeholder="Description (optionnel)…"/>
                <button onClick={saveEdit} style={{background:T.green,color:"#fff",border:"none",borderRadius:7,padding:"6px 10px",fontSize:12,cursor:"pointer",fontWeight:600}}>✓</button>
                <button onClick={()=>setEditIdx(null)} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:7,padding:"6px 8px",fontSize:12,cursor:"pointer"}}>✕</button>
              </div>
            ) : (
              <div style={{padding:"10px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:13.5,color:T.text}}>{item.name}</div>
                  {item.desc && <div style={{fontSize:11.5,color:T.textFaint,marginTop:1}}>{item.desc}</div>}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:8,flexShrink:0}}>
                  {item.price && <span style={{fontSize:13,fontWeight:600,color:accent}}>€ {item.price}</span>}
                  {onOrder && (
                    <button onClick={()=>onOrder(item)} style={{background:accent+"18",border:`1px solid ${accent}44`,color:accent,borderRadius:20,padding:"4px 11px",fontSize:11.5,cursor:"pointer",whiteSpace:"nowrap",fontWeight:500}}>
                      + Commander
                    </button>
                  )}
                  {isAdmin && (
                    <>
                      <button aria-label="Modifier" onClick={()=>{ setEditIdx(i); setEditItem({price:"",desc:"",...items[i]}); }} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:6,padding:"2px 6px",fontSize:11,cursor:"pointer"}}>✏️</button>
                      <button aria-label="Supprimer" onClick={()=>deleteItem(i)} style={{background:"transparent",border:"none",color:T.textFaint,fontSize:13,cursor:"pointer",padding:2}}>✕</button>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
      {isAdmin && showAdd && (
        <div style={{padding:"10px 16px",borderTop:`1px solid ${T.borderLight}`,display:"flex",flexWrap:"wrap",gap:6,alignItems:"center",background:T.bgHover}}>
          <input style={{...inpS,flex:2,minWidth:120}} value={newItem.name} onChange={e=>setNewItem(p=>({...p,name:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="Nom…"/>
          <input style={{...inpS,width:70}} value={newItem.price} onChange={e=>setNewItem(p=>({...p,price:e.target.value}))} placeholder="Prix…"/>
          <input style={{...inpS,flex:3,minWidth:150}} value={newItem.desc} onChange={e=>setNewItem(p=>({...p,desc:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addItem()} placeholder="Description (optionnel)…"/>
          <button onClick={addItem} style={{background:T.sidebar,color:"#fff",border:"none",borderRadius:7,padding:"6px 12px",fontSize:12,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>+ Ajouter</button>
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
        <select value={sel} onChange={e=>setSel(e.target.value)} style={{background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,padding:"7px 10px",fontSize:13}}>
          {docs.map(d=><option key={d.id} value={d.id}>config/{d.id}</option>)}
        </select>
        <button onClick={reload} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"7px 12px",fontSize:12,cursor:"pointer"}}>Recharger</button>
        <button onClick={save} style={{background:ok?T.green:T.sidebar,color:"#fff",border:"none",borderRadius:8,padding:"7px 14px",fontSize:12,fontWeight:600,cursor:"pointer"}}>{ok?"✓ Enregistré":"Enregistrer"}</button>
      </div>
      <textarea value={text} onChange={e=>setText(e.target.value)} spellCheck={false} rows={18}
        style={{width:"100%",background:T.bgInput,border:`1px solid ${err?T.red:T.border}`,borderRadius:10,color:T.text,padding:"10px 12px",fontSize:12,lineHeight:1.5,fontFamily:"ui-monospace, Menlo, Consolas, monospace"}}/>
      {err && <p style={{color:T.red,fontSize:12,marginTop:6}}>{err}</p>}
    </div>
  );
}

// ── Profil ────────────────────────────────────────────────────────────────────
function ProfileTab({ user, profiles, members, T, editingProfile, setEditingProfile }) {
  const myProfile = profiles[user] || {};
  const blank = p => ({ alias:p.alias||"", bio:p.bio||"", emoji:p.emoji||"", color:p.color||avatarColor(user), favoriteOrder:p.favoriteOrder||"", funFact:p.funFact||"" });
  const [draft, setDraft] = useState(blank(myProfile));
  const [saving, setSaving] = useState(false);
  useEffect(()=>{ setDraft(blank(profiles[user]||{})); },[profiles[user]]); // eslint-disable-line react-hooks/exhaustive-deps
  const saveProfile = async() => {
    setSaving(true);
    await setDoc(doc(db,"profiles",user),{...myProfile,...draft,username:user});
    setSaving(false); setEditingProfile(false);
  };
  const displayColor = draft.color || avatarColor(user);
  const labelS = {fontSize:11,fontWeight:600,color:T.textSub,display:"block",marginBottom:6,textTransform:"uppercase",letterSpacing:"0.05em"};

  return (
    <div>
      <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:16,padding:"28px 24px",marginBottom:16,boxShadow:T.shadow,textAlign:"center"}}>
        <div style={{width:80,height:80,borderRadius:"50%",background:displayColor+"22",border:`3px solid ${displayColor}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:myProfile.emoji?36:28,fontWeight:700,color:displayColor,margin:"0 auto 12px"}}>
          {myProfile.emoji||getInitials(user)}
        </div>
        <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:20,color:T.text,marginBottom:2}}>{myProfile.alias||user}</h2>
        {myProfile.alias && <p style={{fontSize:13,color:T.textSub,marginBottom:4}}>({user})</p>}
        {myProfile.bio && <p style={{fontSize:13,color:T.textSub,marginBottom:8,fontStyle:"italic"}}>"{myProfile.bio}"</p>}
        {myProfile.favoriteOrder && <div style={{background:T.bgTag,borderRadius:20,padding:"4px 14px",fontSize:12,color:T.textSub,display:"inline-block",marginBottom:4}}>🍴 Commande fav : {myProfile.favoriteOrder}</div>}
        {myProfile.funFact && <p style={{fontSize:12,color:T.textFaint,marginTop:8}}>💡 {myProfile.funFact}</p>}
        <button onClick={()=>setEditingProfile(!editingProfile)} style={{marginTop:16,background:T.sidebar,color:"#fff",border:"none",borderRadius:10,padding:"8px 20px",fontSize:13,fontWeight:600,cursor:"pointer"}}>
          {editingProfile?"Annuler":"✏️ Modifier mon profil"}
        </button>
      </div>

      {editingProfile && (
        <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:16,padding:"24px",boxShadow:T.shadow,marginBottom:16}}>
          <div style={{marginBottom:16}}>
            <span style={labelS}>Avatar emoji</span>
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              <button onClick={()=>setDraft(p=>({...p,emoji:""}))} style={{width:36,height:36,borderRadius:10,border:`2px solid ${!draft.emoji?T.accent:T.border}`,background:!draft.emoji?T.accentLight:"transparent",fontSize:13,cursor:"pointer",color:T.text,fontWeight:700}}>Aa</button>
              {EMOJIS_LIST.map(e=>(
                <button key={e} onClick={()=>setDraft(p=>({...p,emoji:e}))} style={{width:36,height:36,borderRadius:10,border:`2px solid ${draft.emoji===e?T.accent:T.border}`,background:draft.emoji===e?T.accentLight:"transparent",fontSize:20,cursor:"pointer"}}>{e}</button>
              ))}
            </div>
          </div>
          <div style={{marginBottom:16}}>
            <span style={labelS}>Couleur</span>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              {COLORS_LIST.map(c=>(
                <button key={c} aria-label={c} onClick={()=>setDraft(p=>({...p,color:c}))} style={{width:28,height:28,borderRadius:"50%",background:c,border:`3px solid ${draft.color===c?T.bgCard:"transparent"}`,outline:draft.color===c?`3px solid ${c}`:"none",cursor:"pointer"}}/>
              ))}
            </div>
          </div>
          {[
            {key:"alias",         label:"Surnom / Alias",    placeholder:"ex: Geof, La Patronne…"},
            {key:"bio",           label:"Bio",               placeholder:"ex: Toujours Durum falafel 🥙"},
            {key:"favoriteOrder", label:"Commande favorite", placeholder:"ex: Bicky grande + Mayo"},
            {key:"funFact",       label:"Fun fact",          placeholder:"ex: Je n'aime pas les cornichons 🥒"},
          ].map(({key,label,placeholder})=>(
            <div key={key} style={{marginBottom:12}}>
              <label style={labelS}>{label}</label>
              <input style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,padding:"9px 14px",fontSize:14}}
                value={draft[key]} onChange={e=>setDraft(p=>({...p,[key]:e.target.value}))} placeholder={placeholder}/>
            </div>
          ))}
          <button onClick={saveProfile} disabled={saving} style={{width:"100%",background:T.sidebar,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:14,fontWeight:600,cursor:"pointer",opacity:saving?0.7:1}}>
            {saving?"Sauvegarde…":"✓ Sauvegarder"}
          </button>
        </div>
      )}

      <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:600,fontSize:15,color:T.text,margin:"24px 0 12px"}}>👥 L'équipe</h3>
      <div style={{display:"flex",flexDirection:"column",gap:8}}>
        {members.filter(m=>!m.planningOnly).map(m=>m.username).filter(n=>n!==user).map(name=>{
          const p=profiles[name]||{};
          return (
            <div key={name} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:12,padding:"12px 16px",display:"flex",alignItems:"center",gap:12,boxShadow:T.shadow}}>
              <Avatar name={name} size={40} profile={p}/>
              <div style={{flex:1}}>
                <div style={{fontSize:14,fontWeight:600,color:T.text}}>{p.alias||name}{p.alias&&<span style={{fontSize:12,color:T.textSub,marginLeft:6}}>({name})</span>}</div>
                {p.bio&&<div style={{fontSize:12,color:T.textSub,fontStyle:"italic"}}>"{p.bio}"</div>}
                {p.funFact&&<div style={{fontSize:11.5,color:T.textFaint}}>💡 {p.funFact}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Récap (perso + resto) ─────────────────────────────────────────────────────
function RecapPanel({ user, names, orders, ctx, T, isMobile, only, onSuggest, personalStatus }){
  const [slide, setSlide] = useState(0);
  const [copied, setCopied] = useState(false);
  const perso = orderPricedLines(orders[user], ctx);
  const resto = buildRestoRecap(names, orders, ctx);

  const copyList=async()=>{
    const txt=restoRecapText(resto);
    try{ await navigator.clipboard.writeText(txt); }
    catch(e){
      const ta=document.createElement("textarea"); ta.value=txt; ta.style.position="fixed"; ta.style.opacity="0";
      document.body.appendChild(ta); ta.select(); try{ document.execCommand("copy"); }catch(_){} document.body.removeChild(ta);
    }
    setCopied(true); setTimeout(()=>setCopied(false),2000);
  };

  const infoHint=(
    <span className="info-wrap" style={{position:"relative",display:"inline-flex",marginLeft:6,verticalAlign:"middle"}}>
      <button type="button" aria-label="À propos des prix" onClick={()=>onSuggest&&onSuggest()}
        style={{cursor:"pointer",width:16,height:16,borderRadius:"50%",border:`1px solid ${T.textFaint}`,background:"transparent",color:T.textFaint,fontSize:10,fontWeight:700,fontStyle:"italic",display:"inline-flex",alignItems:"center",justifyContent:"center",lineHeight:1,padding:0}}>i</button>
      <span className="info-pop" style={{display:"none",position:"absolute",bottom:"calc(100% + 8px)",left:"50%",transform:"translateX(-50%)",width:230,background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",zIndex:60,boxShadow:T.shadowHover,fontSize:11.5,color:T.textSub,lineHeight:1.5,fontWeight:400,fontStyle:"normal",textAlign:"left",pointerEvents:"none"}}>
        Total estimé à partir des prix des plateformes Take Away, souvent plus chers qu'au comptoir. Le vrai montant est saisi par la personne qui paie. Clique pour signaler un prix.
      </span>
    </span>
  );

  const RestoView = resto.groups.length===0 ? (
    <p style={{fontSize:13,color:T.textFaint,padding:"12px 0"}}>Aucune commande pour l'instant.</p>
  ) : (
    <>
      {resto.groups.map(g=>(
        <div key={g.key} style={{marginBottom:14}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:10.5,fontWeight:700,color:g.accent,textTransform:"uppercase",letterSpacing:"0.05em",marginBottom:6}}>
            <span>{g.label}</span><span>{fmtEuro(g.total)}</span>
          </div>
          {g.items.map((it,i)=>(
            <div key={i} style={{display:"flex",alignItems:"baseline",gap:8,fontSize:13,color:T.textSub,lineHeight:1.6,marginBottom:4}}>
              <span style={{fontWeight:700,color:T.text,minWidth:24}}>{it.qty}×</span>
              <span style={{flex:1}}>{it.label}</span>
            </div>
          ))}
        </div>
      ))}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",borderTop:`1px solid ${T.borderLight}`,paddingTop:10,marginBottom:10}}>
        <span style={{fontSize:12,color:T.textSub}}>Total estimé{infoHint}</span>
        <span style={{fontWeight:700,fontSize:18,fontVariantNumeric:"tabular-nums",color:T.text}}>{fmtEuro(resto.total)}</span>
      </div>
      <button onClick={copyList} style={{width:"100%",background:copied?T.green:T.sidebar,color:"#fff",border:"none",borderRadius:11,padding:11,fontSize:13,fontWeight:600,cursor:"pointer",transition:"background 0.2s"}}>
        {copied?"✓ Copié !":"📋 Copier la liste pour le resto"}
      </button>
    </>
  );

  const PersoView = perso.empty ? (
    <p style={{fontSize:13,color:T.textFaint,padding:"12px 0"}}>Tu n'as pas encore commandé.</p>
  ) : (
    <>
      {perso.lines.map((l,i)=>(
        <div key={i} style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",fontSize:13,color:l.optional?T.textFaint:T.textSub,lineHeight:2}}>
          <span style={{flex:1,paddingRight:8}}>{l.label}</span>
          <span style={{color:l.price!=null?T.text:T.textFaint}}>{l.price!=null?fmtEuro(l.price):(l.optional?"inclus":"—")}</span>
        </div>
      ))}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",borderTop:`1px solid ${T.borderLight}`,paddingTop:10,marginTop:6}}>
        <span style={{fontSize:12,color:T.textSub}}>Mon total{perso.hasUnpriced?" (estimé)":""}{infoHint}</span>
        <span style={{fontWeight:700,fontSize:18,fontVariantNumeric:"tabular-nums",color:T.text}}>{fmtEuro(perso.total)}</span>
      </div>
      {personalStatus && <div style={{marginTop:12}}>{personalStatus}</div>}
    </>
  );

  const colHeader=(icon,label)=>(
    <div style={{display:"flex",alignItems:"center",gap:7,fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:13.5,color:T.text,marginBottom:12}}><span>{icon}</span>{label}</div>
  );
  const box = {background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,padding:16,marginBottom:20,boxShadow:T.shadow};

  if(only==="perso") return <div style={box}>{colHeader("👤","Ma commande")}{PersoView}</div>;
  if(!isMobile) return (
    <div style={{...box,padding:18}}>
      <div style={{display:"flex",gap:20,alignItems:"stretch"}}>
        <div style={{flex:1,minWidth:0}}>{colHeader("📞","Pour le resto")}{RestoView}</div>
        <div style={{width:1,background:T.borderLight,flexShrink:0}}/>
        <div style={{flex:1,minWidth:0}}>{colHeader("👤","Ma commande")}{PersoView}</div>
      </div>
    </div>
  );
  const seg=(i,icon,label)=>(
    <button onClick={()=>setSlide(i)} style={{flex:1,border:"none",borderRadius:8,padding:"7px 0",fontSize:12.5,fontWeight:600,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:6,background:slide===i?T.sidebar:"transparent",color:slide===i?"#fff":T.textSub}}>
      <span>{icon}</span>{label}
    </button>
  );
  return (
    <div style={box}>
      <div style={{display:"flex",background:T.bgTag,borderRadius:10,padding:3,marginBottom:14}}>{seg(0,"📞","Resto")}{seg(1,"👤","Moi")}</div>
      {slide===0 ? RestoView : PersoView}
    </div>
  );
}

// ── Fenêtre « Qui a payé ? » ──────────────────────────────────────────────────
function PayModal({ T, r, people, orders, ctx, payerOptions, defaultPayer, onClose, onConfirm }) {
  const est = Object.fromEntries(people.map(n=>[n, round2(orderPricedLines(orders[n],ctx).total)]));
  const sumEst = round2(people.reduce((a,n)=>a+est[n],0));
  const [payer, setPayer]   = useState(defaultPayer||"");
  const [ticket, setTicket] = useState(priceToInput(sumEst));
  const [shares, setShares] = useState(()=>Object.fromEntries(people.map(n=>[n, priceToInput(est[n])])));
  const [busy, setBusy]     = useState(false);

  const distribute = () => {
    const t = parsePrice(ticket); if (t==null || !people.length) return;
    const raw = sumEst>0 ? people.map(n=>est[n]*t/sumEst) : people.map(()=>t/people.length);
    const cents = raw.map(x=>Math.round(x*100));
    const diff = Math.round(t*100) - cents.reduce((a,b)=>a+b,0);
    const iMax = cents.indexOf(Math.max(...cents)); cents[iMax] += diff;
    setShares(Object.fromEntries(people.map((n,i)=>[n, priceToInput(cents[i]/100)])));
  };
  const sumShares = round2(people.reduce((a,n)=>a+(parsePrice(shares[n])||0),0));
  const t = parsePrice(ticket);
  const mismatch = t!=null && Math.abs(sumShares-t)>0.009;
  const inpS = {background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:8,color:T.text,padding:"7px 10px",fontSize:14};

  return (
    <div role="dialog" aria-modal="true" style={{position:"fixed",inset:0,background:"rgba(20,15,10,0.45)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000,padding:16}}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:16,padding:22,width:460,maxWidth:"100%",maxHeight:"90vh",overflowY:"auto",boxShadow:"0 24px 80px rgba(44,31,14,0.25)"}}>
        <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:17,color:T.text,marginBottom:4}}>💳 Paiement · {r.emoji} {r.label}</h3>
        <p style={{fontSize:12.5,color:T.textSub,lineHeight:1.5,marginBottom:16}}>Chacun devra sa part à la personne qui a payé. Le montant se retrouve dans l'onglet Comptes.</p>

        <label style={{fontSize:12,fontWeight:600,color:T.textSub,display:"block",marginBottom:5}}>Qui a payé ?</label>
        <select value={payer} onChange={e=>setPayer(e.target.value)} style={{...inpS,width:"100%",marginBottom:14}}>
          <option value="">— Choisir —</option>
          {payerOptions.map(n=><option key={n} value={n}>{n}</option>)}
        </select>

        <label style={{fontSize:12,fontWeight:600,color:T.textSub,display:"block",marginBottom:5}}>Montant réel du ticket</label>
        <div style={{display:"flex",gap:8,marginBottom:4}}>
          <input value={ticket} onChange={e=>setTicket(e.target.value)} inputMode="decimal" style={{...inpS,width:120}}/>
          <button onClick={distribute} className="btn-ghost" style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"7px 12px",fontSize:12.5,cursor:"pointer"}}>
            Répartir selon les commandes
          </button>
        </div>
        <p style={{fontSize:11.5,color:T.textFaint,marginBottom:14}}>Estimation de l'app : {fmtEuro(sumEst)}. Les parts sont ajustées au prorata.</p>

        <p style={{fontSize:12,fontWeight:600,color:T.textSub,marginBottom:6}}>Parts de chacun</p>
        <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
          {people.map(n=>(
            <div key={n} style={{display:"flex",alignItems:"center",gap:10}}>
              <span style={{flex:1,fontSize:13.5,color:T.text}}>{n}{n===payer && <span style={{fontSize:11.5,color:T.textFaint}}> (a payé)</span>}</span>
              <input value={shares[n]} inputMode="decimal" onChange={e=>setShares(s=>({...s,[n]:e.target.value}))} style={{...inpS,width:100,textAlign:"right",padding:"6px 9px",fontSize:13}}/>
            </div>
          ))}
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:13,color:mismatch?T.orange:T.textSub,marginBottom:16}}>
          <span>Somme des parts</span>
          <span>{fmtEuro(sumShares)}{mismatch?` ≠ ticket ${fmtEuro(t)}`:""}</span>
        </div>

        <div style={{display:"flex",gap:8}}>
          <button disabled={!payer||busy} onClick={async()=>{
              setBusy(true);
              await onConfirm({ payer, total: t ?? sumShares, shares: people.map(n=>({ name:n, amount: round2(parsePrice(shares[n])||0) })) });
              setBusy(false);
            }}
            style={{flex:1,background:payer?T.green:T.bgTag,color:payer?"#fff":T.textFaint,border:"none",borderRadius:10,padding:"11px",fontSize:14,fontWeight:700,cursor:payer?"pointer":"not-allowed"}}>
            {busy?"Enregistrement…":"Enregistrer le paiement"}
          </button>
          <button onClick={onClose} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"11px 16px",fontSize:13,cursor:"pointer"}}>Annuler</button>
        </div>
      </div>
    </div>
  );
}

// ── Application ───────────────────────────────────────────────────────────────
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
  const [saucesSettings, setSaucesSettings]     = useState({});
  const [crudites, setCrudites]     = useState([]);
  const [cruditesSettings, setCruditesSettings] = useState({});
  const [boissons, setBoissons]     = useState([]);
  const [extras, setExtras]         = useState([]);
  const [dayState, setDayState]     = useState({});
  const [ledger, setLedger]         = useState([]);
  const [history, setHistory]       = useState([]);
  const [tab, setTab]               = useState("order");
  const [msgTab, setMsgTab]         = useState("chat");
  const [status, setStatus]         = useState("connecting");
  const [favNameInput, setFavNameInput] = useState("");
  const [showFavModal, setShowFavModal] = useState(false);
  const [newExtraOption, setNewExtraOption] = useState({});
  const [newExtraPrice, setNewExtraPrice]   = useState({});
  const [newMemberName, setNewMemberName]   = useState("");
  const [newMemberCode, setNewMemberCode]   = useState("");
  const [editingMember, setEditingMember]   = useState(null);
  const [newSauce, setNewSauce]     = useState("");
  const [newCrudite, setNewCrudite] = useState("");
  const [newBoisson, setNewBoisson] = useState("");
  const [newQuote, setNewQuote]     = useState("");
  const [newExtraLabel, setNewExtraLabel]     = useState("");
  const [newExtraApplies, setNewExtraApplies] = useState([]);
  const [openHistory, setOpenHistory] = useState({});
  const [openRows, setOpenRows]       = useState({});
  const [openDetail, setOpenDetail]   = useState({});
  const [viewMode, setViewMode]       = useState("accordion");
  const [activity, setActivity]       = useState([]);
  const [unreadActivity, setUnreadActivity] = useState(0);
  const [lastSeenActivity, setLastSeenActivity] = useState(()=>parseInt(localStorage.getItem("lastSeenActivity")||"0"));
  const [profiles, setProfiles]       = useState({});
  const [editingProfile, setEditingProfile] = useState(false);
  const [messages, setMessages]       = useState([]);
  const [chatInput, setChatInput]     = useState("");
  const [unreadChat, setUnreadChat]   = useState(0);
  const [activeMenu, setActiveMenu]   = useState("");
  const [toast, setToast]             = useState(null);
  const [sauceModal, setSauceModal]   = useState(null);
  const [payModal, setPayModal]       = useState(null);
  const [aiState, setAiState]         = useState({ loading:false, extracted:null, preview:false, restoId:null });
  const [isDark, setIsDark]   = useState(()=>localStorage.getItem("lunch_theme")==="dark");
  const [navOpen, setNavOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(()=>window.innerWidth<768);
  const [authReady, setAuthReady] = useState(false);
  const [authError, setAuthError] = useState(null);
  const [quote, setQuote] = useState(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackInput, setFeedbackInput] = useState("");
  const [feedbackSent, setFeedbackSent] = useState(false);
  const [feedback, setFeedback] = useState([]);
  const [now, setNow] = useState(Date.now());
  const detailTimers = useRef({});
  const toastTimer = useRef(null);
  const ordersRef = useRef({});
  ordersRef.current = orders;
  const T = isDark ? DARK : LIGHT;

  const isAdmin = !!members.find(m=>m.username===user)?.isAdmin;

  const toggleTheme=()=>{ const n=!isDark; setIsDark(n); localStorage.setItem("lunch_theme",n?"dark":"light"); };

  useEffect(()=>{ const h=()=>setIsMobile(window.innerWidth<768); window.addEventListener("resize",h); return ()=>window.removeEventListener("resize",h); },[]);
  useEffect(()=>{ const t=setInterval(()=>setNow(Date.now()),30000); return ()=>clearInterval(t); },[]);
  useEffect(()=>{
    let m=document.querySelector('meta[name="viewport"]');
    if(!m){ m=document.createElement("meta"); m.setAttribute("name","viewport"); document.head.appendChild(m); }
    m.setAttribute("content","width=device-width, initial-scale=1, viewport-fit=cover");
  },[]);
  useEffect(()=>{ if(user && quotes.length) setQuote(quotes[Math.floor(Math.random()*quotes.length)]); },[user]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(()=>{ if(appConfig.title) document.title = appConfig.title; },[appConfig.title]);

  useEffect(()=>{
    const unsub = onAuthStateChanged(auth, u=>{
      if(u){ setAuthReady(true); setAuthError(null); }
      else signInAnonymously(auth).catch(e=>{ console.error("Auth anonyme échouée:", e); setAuthError(e.code || e.message || "erreur inconnue"); });
    });
    return unsub;
  },[]);

  useEffect(()=>{
    if(!authReady) return;
    const listDoc=(id,setter,settingsSetter)=>onSnapshot(doc(db,"config",id), s=>{
      const d=s.exists()?s.data():{};
      setter(Array.isArray(d.list)?d.list:[]);
      if(settingsSetter) settingsSetter(d.settings||{});
    });
    const unsubs=[
      onSnapshot(collection(db,"orders"), s=>{const d={};s.forEach(x=>{d[x.id]=x.data();});setOrders(d);setStatus("live");}, ()=>setStatus("error")),
      onSnapshot(doc(db,"config","members"), s=>{ setMembers(s.exists()&&Array.isArray(s.data().list)?s.data().list:[]); setMembersLoaded(true); }, ()=>setMembersLoaded(true)),
      onSnapshot(doc(db,"config","app"), s=>setAppConfig(s.exists()?s.data():{})),
      listDoc("restaurants", setRestaurants),
      listDoc("quotes",      setQuotes),
      listDoc("sauces",      setSauces, setSaucesSettings),
      listDoc("crudites",    setCrudites, setCruditesSettings),
      listDoc("boissons",    setBoissons),
      listDoc("extras",      setExtras),
      onSnapshot(doc(db,"state","today"), s=>setDayState(s.exists()?s.data():{})),
      onSnapshot(query(collection(db,"ledger"), where("settled","==",false)), s=>{ const a=[]; s.forEach(x=>a.push({id:x.id,...x.data()})); a.sort((x,y)=>x.ts-y.ts); setLedger(a); }),
      onSnapshot(collection(db,"favorites"), s=>{
        const d={};
        s.forEach(x=>{ const data=x.data(); if(data.list)d[x.id]=data.list; else if(data.choice)d[x.id]=[{id:"fav_legacy",name:"Mon favori",...data}]; else d[x.id]=[]; });
        setFavorites(d);
      }),
      onSnapshot(collection(db,"history"), s=>{const days=[];s.forEach(x=>days.push({id:x.id,...x.data()}));days.sort((a,b)=>b.id.localeCompare(a.id));setHistory(days);}),
      onSnapshot(collection(db,"chat"), snap=>{
        const msgs=[]; snap.forEach(s=>msgs.push({id:s.id,...s.data()})); msgs.sort((a,b)=>a.ts-b.ts); setMessages(msgs);
        const lastSeen=parseInt(localStorage.getItem("lastSeenChat")||"0");
        setUnreadChat(msgs.filter(m=>m.ts>lastSeen&&m.author!==user).length);
      }),
      onSnapshot(collection(db,"activity"), snap=>{
        const acts=[]; snap.forEach(s=>acts.push({id:s.id,...s.data()})); acts.sort((a,b)=>b.ts-a.ts); setActivity(acts.slice(0,60));
        const lastSeen=parseInt(localStorage.getItem("lastSeenActivity")||"0");
        setUnreadActivity(acts.filter(a=>a.ts>lastSeen&&a.author!==user).length);
      }),
      onSnapshot(collection(db,"profiles"), snap=>{ const d={}; snap.forEach(s=>{d[s.id]=s.data();}); setProfiles(d); }),
      onSnapshot(collection(db,"feedback"), snap=>{ const arr=[]; snap.forEach(s=>arr.push({id:s.id,...s.data()})); arr.sort((a,b)=>b.ts-a.ts); setFeedback(arr); }),
    ];
    return ()=>unsubs.forEach(u=>u());
  },[authReady, user]);

  if(!authReady) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.bg,padding:24}}>
      <div style={{textAlign:"center",color:T.textSub,maxWidth:360,fontFamily:"'DM Sans',sans-serif"}}>
        {authError ? (
          <>
            <div style={{fontSize:15,fontWeight:700,color:T.red,marginBottom:10}}>Connexion impossible</div>
            <div style={{fontSize:13,marginBottom:6}}>Code d'erreur :</div>
            <code style={{fontSize:13,color:T.text,background:T.bgTag,padding:"5px 10px",borderRadius:6,display:"inline-block",marginBottom:18,wordBreak:"break-all"}}>{authError}</code>
            <div>
              <button onClick={()=>{ setAuthError(null); signInAnonymously(auth).catch(e=>setAuthError(e.code || e.message || "erreur inconnue")); }}
                style={{background:T.sidebar,color:"#fff",border:"none",borderRadius:10,padding:"10px 22px",fontSize:14,fontWeight:600,cursor:"pointer"}}>Réessayer</button>
            </div>
          </>
        ) : <div style={{fontSize:14}}>Connexion sécurisée…</div>}
      </div>
    </div>
  );

  if(!user) return <LoginScreen onLogin={setUser} T={T} isDark={isDark} toggleTheme={toggleTheme}
    members={members} membersLoaded={membersLoaded} appConfig={appConfig} restaurants={restaurants}/>;

  // Profil « planning uniquement » : ne voit que le planning
  if(members.find(m=>m.username===user)?.planningOnly) return (
    <Planning db={db} T={T} user={user} isDark={isDark} toggleTheme={toggleTheme} isMobile={isMobile} onLogout={()=>setUser(null)}/>
  );

  // ── Persistance config ──
  const cfgRef = id => doc(db,"config",id);
  const pm=async l=>{setMembers(l);     await setDoc(cfgRef("members"),    {list:l},{merge:true});};
  const ps=async l=>{setSauces(l);      await setDoc(cfgRef("sauces"),     {list:l},{merge:true});};
  const pc=async l=>{setCrudites(l);    await setDoc(cfgRef("crudites"),   {list:l},{merge:true});};
  const pb=async l=>{setBoissons(l);    await setDoc(cfgRef("boissons"),   {list:l},{merge:true});};
  const pe=async l=>{setExtras(l);      await setDoc(cfgRef("extras"),     {list:l},{merge:true});};
  const pr=async l=>{setRestaurants(l); await setDoc(cfgRef("restaurants"),{list:l},{merge:true});};
  const pq=async l=>{setQuotes(l);      await setDoc(cfgRef("quotes"),     {list:l},{merge:true});};
  const saveSaucesSettings  =async s=>{setSaucesSettings(s);   await setDoc(cfgRef("sauces"),  {settings:s},{merge:true});};
  const saveCruditesSettings=async s=>{setCruditesSettings(s); await setDoc(cfgRef("crudites"),{settings:s},{merge:true});};
  const saveAppConfig=async patch=>{ const n={...appConfig,...patch}; setAppConfig(n); await setDoc(cfgRef("app"),n); };
  const saveDay=async patch=>{ const n={...day,...patch,date:todayStr()}; setDayState(n); await setDoc(doc(db,"state","today"),n); };

  const updateResto=(rid,fn)=>pr(restaurants.map(r=>r.id===rid?fn(r):r));
  const saveSection=(rid,cat,items)=>updateResto(rid,r=>({...r,sections:sectionsOf(r).map(s=>s.cat===cat?{...s,items}:s)}));
  const updateScoop=(rid,i,p)=>updateResto(rid,r=>({...r,scoopOptions:scoopOptions(r).map((o,j)=>j===i?{...o,...p}:o)}));
  const addScoop=rid=>updateResto(rid,r=>({...r,scoopOptions:[...scoopOptions(r),{label:"Nouveau format",count:1,price:null}]}));
  const removeScoop=(rid,i)=>updateResto(rid,r=>({...r,scoopOptions:scoopOptions(r).filter((_,j)=>j!==i)}));

  const lists = { sauces:saucesSettings, crudites:cruditesSettings };
  const ctx = { restaurants, extras, sauces, crudites, listCfg:lists };
  const orderers = members.filter(m=>!m.isAdmin&&!m.planningOnly).map(m=>m.username);
  const names = isAdmin ? orderers : [user, ...orderers.filter(n=>n!==user)];
  const adminCount = members.filter(m=>m.isAdmin).length;
  // Un état d'un autre jour (journée pas archivée) est ignoré
  const day = dayState.date===todayStr() ? dayState : {};
  const paid = day.paid || {};
  const unsettledIds = new Set(ledger.map(e=>e.id));

  // ── Heure limite & verrouillage ──
  const deadlineTs = (()=>{ const d=appConfig.orderDeadline; if(!/^\d{1,2}:\d{2}$/.test(d||"")) return null; const [h,m]=d.split(":").map(Number); const x=new Date(); x.setHours(h,m,0,0); return x.getTime(); })();
  const pastDeadline = deadlineTs!=null && now>deadlineTs;
  const locked = !!day.locked || (pastDeadline && !day.reopened);
  const minutesLeft = deadlineTs!=null ? Math.ceil((deadlineTs-now)/60000) : null;
  const canEditFor = (name) => {
    if (isAdmin) return true;
    if (name!==user || locked) return false;
    const c = orders[name]?.choice;
    return !(c && paid[c] && paid[c].shares?.[name]!=null);
  };

  // ── Notifications avec action (ex. Annuler) ──
  const showToast = (msg, actions=[], ms=5000) => {
    clearTimeout(toastTimer.current);
    setToast({ msg, actions });
    toastTimer.current = setTimeout(()=>setToast(null), ms);
  };

  const logActivity = async(type, text) => { await addDoc(collection(db,"activity"),{author:user,type,text,ts:Date.now()}); };

  // ── Écriture des commandes ──
  const patchOrder = async(name, partial) => {
    const cur=ordersRef.current[name]||{}; if(!cur.choice) return;
    const updated={...cur,...partial};
    ordersRef.current={...ordersRef.current,[name]:updated};
    setOrders(p=>({...p,[name]:updated}));
    await setDoc(doc(db,"orders",name),updated);
  };
  const patchDetail = (name, detail) => {
    const cur=ordersRef.current[name]||{}; if(!cur.choice) return;
    const updated={...cur,detail};
    ordersRef.current={...ordersRef.current,[name]:updated};
    setOrders(p=>({...p,[name]:updated}));
    clearTimeout(detailTimers.current[name]);
    detailTimers.current[name]=setTimeout(()=>setDoc(doc(db,"orders",name),ordersRef.current[name]),600);
  };
  const restoreOrder = async(name, prev) => {
    if(prev) await setDoc(doc(db,"orders",name),prev); else await deleteDoc(doc(db,"orders",name));
    setToast(null);
  };
  const chooseResto = async(name, rid) => {
    const prev = orders[name];
    const r = findResto(restaurants, rid);
    if (prev?.choice===rid) {
      await deleteDoc(doc(db,"orders",name));
      showToast("Commande annulée", [{label:"Annuler", fn:()=>restoreOrder(name,prev)}]);
      await logActivity("cancel",`${name} a annulé sa commande`);
      return;
    }
    await setDoc(doc(db,"orders",name),{...EMPTY_ORDER,choice:rid});
    if (prev?.choice) showToast(`Restaurant changé : ${r?.label||rid}`, [{label:"Annuler", fn:()=>restoreOrder(name,prev)}]);
    await logActivity("order",`${name} a choisi ${r?.emoji||""} ${r?.label||rid}`);
  };
  const validateOrder = async(name) => {
    await patchOrder(name,{validated:true, validatedAt:Date.now()});
    showToast("Commande validée ✓");
    await logActivity("validate",`${name} a validé sa commande`);
  };
  const applyFavorite = async(fav) => {
    const { id:_i, name:_n, ...favOrder } = fav;
    const prev = orders[user];
    await setDoc(doc(db,"orders",user),{...EMPTY_ORDER,...favOrder,validated:false});
    showToast(`Favori « ${fav.name} » chargé`, [{label:"Annuler", fn:()=>restoreOrder(user,prev)}]);
  };

  // ── Membres ──
  const addMember=async()=>{const n=newMemberName.trim(),c=newMemberCode.trim();if(!n||!c||members.find(m=>m.username===n))return;await pm([...members,{username:n,code:c}]);setNewMemberName("");setNewMemberCode("");};
  const removeMember=async n=>{
    const m=members.find(x=>x.username===n);
    if(m?.isAdmin && adminCount<=1){ alert("Impossible de supprimer le dernier administrateur."); return; }
    if(!window.confirm(`Supprimer ${n} de l'équipe ?`)) return;
    await pm(members.filter(x=>x.username!==n));
    await deleteDoc(doc(db,"orders",n));
  };
  const toggleMemberAdmin=async n=>{
    const m=members.find(x=>x.username===n);
    if(m?.isAdmin && adminCount<=1){ alert("Il faut au moins un administrateur."); return; }
    await pm(members.map(x=>x.username===n?{...x,isAdmin:!x.isAdmin,planningOnly:false}:x));
  };
  const toggleMemberPlanning=async n=>{
    const m=members.find(x=>x.username===n);
    if(n===user){ alert("Tu ne peux pas passer ton propre compte en « planning uniquement »."); return; }
    if(!m?.planningOnly && m?.isAdmin && adminCount<=1){ alert("Il faut au moins un administrateur."); return; }
    await pm(members.map(x=>x.username===n?{...x,planningOnly:!x.planningOnly,isAdmin:false}:x));
  };
  const saveMemberEdit=async()=>{ if(!editingMember)return; const {_orig,...clean}=editingMember; await pm(members.map(m=>m.username===_orig?clean:m)); setEditingMember(null); };

  // ── Listes & suppléments ──
  const addSauceOpt  =async v=>{ if(v && !sauces.includes(v)) await ps([...sauces,v]); };
  const addBoissonOpt=async v=>{ if(v && !boissons.includes(v)) await pb([...boissons,v]); };
  const addSauce  =async()=>{const s=newSauce.trim();   if(s&&!sauces.includes(s))   {await ps([...sauces,s]);   setNewSauce("");}};
  const addCrudite=async()=>{const c=newCrudite.trim(); if(c&&!crudites.includes(c)) {await pc([...crudites,c]); setNewCrudite("");}};
  const addBoisson=async()=>{const b=newBoisson.trim(); if(b&&!boissons.includes(b)) {await pb([...boissons,b]); setNewBoisson("");}};
  const addQuote  =async()=>{const q=newQuote.trim(); if(q){await pq([...quotes,{text:q}]); setNewQuote("");}};
  const addExtraCategory=async()=>{const label=newExtraLabel.trim();if(!label||!newExtraApplies.length)return;const id="extra_"+Date.now();const accent=EXTRA_ACCENTS[extras.length%EXTRA_ACCENTS.length];await pe([...extras,{id,label,options:[],prices:{},settings:{},appliesTo:newExtraApplies,accent}]);setNewExtraLabel("");setNewExtraApplies([]);};
  const removeExtraCategory=async id=>{ if(!window.confirm("Supprimer cette catégorie de suppléments ?")) return; await pe(extras.filter(e=>e.id!==id)); };
  const updateExtra=(id,fn)=>pe(extras.map(e=>e.id===id?fn(e):e));
  const addExtraOption=async(extraId)=>{
    const val=(newExtraOption[extraId]||"").trim(); if(!val) return;
    const p=parsePrice(newExtraPrice[extraId]);
    await updateExtra(extraId, e=>{ const prices={...(e.prices||{})}; if(p!=null) prices[val]=p; return {...e, options:e.options.includes(val)?e.options:[...e.options,val], prices}; });
    setNewExtraOption(q=>({...q,[extraId]:""})); setNewExtraPrice(q=>({...q,[extraId]:""}));
  };
  const removeExtraOption=(extraId,opt)=>updateExtra(extraId, e=>{ const prices={...(e.prices||{})}; delete prices[opt]; return {...e, options:e.options.filter(o=>o!==opt), prices}; });
  const setExtraOptionPrice=(extraId,opt,raw)=>updateExtra(extraId, e=>{ const p=parsePrice(raw); const prices={...(e.prices||{})}; if(p==null) delete prices[opt]; else prices[opt]=p; return {...e, prices}; });

  // ── Paiements & comptes ──
  const declarePayment = async(rid, { payer, total, shares }) => {
    const r = findResto(restaurants, rid);
    const batch = writeBatch(db); const ids = []; const ts = Date.now(); const date = todayStr();
    shares.filter(s=>s.name!==payer && s.amount>0).forEach(s=>{
      const ref = doc(collection(db,"ledger")); ids.push(ref.id);
      batch.set(ref,{ date, restoId:rid, restoLabel:r?.label||rid, payer, debtor:s.name, amount:round2(s.amount), settled:false, claimed:false, ts });
    });
    const shareMap = Object.fromEntries(shares.map(s=>[s.name, s.amount]));
    batch.set(doc(db,"state","today"),{ ...day, date:todayStr(), paid:{ ...paid, [rid]:{ payer, total:round2(total), shares:shareMap, entryIds:ids, ts } } });
    await batch.commit();
    setPayModal(null);
    showToast(`Paiement enregistré : ${payer} · ${fmtEuro(total)}`);
    await logActivity("pay",`${payer} a payé ${r?.label||rid} (${fmtEuro(total)})`);
  };
  const cancelPayment = async(rid) => {
    const p = paid[rid]; if(!p) return;
    if(!window.confirm("Annuler ce paiement ? Les dettes non remboursées seront supprimées.")) return;
    const batch = writeBatch(db);
    (p.entryIds||[]).forEach(id=>{ if(unsettledIds.has(id)) batch.delete(doc(db,"ledger",id)); });
    const np = { ...paid }; delete np[rid];
    batch.set(doc(db,"state","today"),{ ...day, date:todayStr(), paid:np });
    await batch.commit();
  };
  const pairEntries = (a,b) => ledger.filter(e=>(e.payer===a&&e.debtor===b)||(e.payer===b&&e.debtor===a));
  const claimRepaid = async(other) => {
    const batch = writeBatch(db);
    pairEntries(user,other).forEach(e=>batch.update(doc(db,"ledger",e.id),{claimed:true,claimedAt:Date.now()}));
    await batch.commit();
    showToast(`${other} va recevoir une demande de confirmation`);
    await logActivity("repay",`${user} indique avoir remboursé ${other}`);
  };
  const confirmRepaid = async(a,b) => {
    const batch = writeBatch(db);
    pairEntries(a,b).forEach(e=>batch.update(doc(db,"ledger",e.id),{settled:true,settledAt:Date.now(),settledBy:user}));
    await batch.commit();
    showToast("Remboursement confirmé ✓");
    await logActivity("repay",`Remboursement réglé entre ${a} et ${b}`);
  };
  const myNets = {};
  ledger.forEach(e=>{
    if(e.payer===user) myNets[e.debtor]=(myNets[e.debtor]||0)+e.amount;
    else if(e.debtor===user) myNets[e.payer]=(myNets[e.payer]||0)-e.amount;
  });
  const pairClaimed = other => pairEntries(user,other).some(e=>e.claimed);
  const accountsBadge = Object.entries(myNets).filter(([o,n])=>(n<-0.004 && !pairClaimed(o)) || (n>0.004 && pairClaimed(o))).length;
  const allPairs = (()=>{
    const m={};
    ledger.forEach(e=>{
      const [a,b]=[e.payer,e.debtor].sort(); const k=a+"|"+b;
      if(!m[k]) m[k]={a,b,net:0,claimed:false,count:0};
      m[k].net += e.debtor===a ? e.amount : -e.amount; // >0 : a doit à b
      m[k].claimed = m[k].claimed || e.claimed; m[k].count++;
    });
    return Object.values(m).filter(p=>Math.abs(p.net)>0.004);
  })();

  // ── Favoris, feedback, reset ──
  const saveFavorite=async()=>{
    const cur=orders[user]; if(!cur?.choice) return;
    const { validated:_v, validatedAt:_va, ...rest } = cur;
    const favName=favNameInput.trim()||formatOrder(cur,ctx).slice(0,30)||"Mon favori";
    await setDoc(doc(db,"favorites",user),{list:[...(favorites[user]||[]),{id:"fav_"+Date.now(),name:favName,...rest}]});
    setFavNameInput(""); setShowFavModal(false); showToast("⭐ Favori enregistré");
  };
  const deleteFavorite=async(username,favId)=>{ await setDoc(doc(db,"favorites",username),{list:(favorites[username]||[]).filter(f=>f.id!==favId)}); };
  const submitFeedback=async()=>{
    const txt=feedbackInput.trim(); if(!txt) return;
    await addDoc(collection(db,"feedback"),{author:user,text:txt,ts:Date.now()});
    setFeedbackInput(""); setFeedbackSent(true);
    setTimeout(()=>{ setFeedbackSent(false); setShowFeedback(false); },1600);
  };
  const deleteFeedback=async id=>{ await deleteDoc(doc(db,"feedback",id)); };
  const resetAll=async()=>{
    if(!window.confirm("Archiver et effacer toutes les commandes du jour ?\nLes dettes en cours sont conservées dans Comptes."))return;
    const today=todayStr();
    const snapshot={}; orderers.forEach(n=>{ if(orders[n]?.choice) snapshot[n]=orders[n]; });
    const cleanPaid=Object.fromEntries(Object.entries(paid).map(([k,v])=>[k,{payer:v.payer,total:v.total,shares:v.shares||{}}]));
    if(Object.keys(snapshot).length>0) await setDoc(doc(db,"history",`${today}_${Date.now()}`),{date:today,orders:snapshot,paid:cleanPaid});
    await Promise.all(members.map(m=>deleteDoc(doc(db,"orders",m.username))));
    await setDoc(doc(db,"state","today"),{date:todayStr(),locked:false,reopened:false,paid:{}});
    await logActivity("reset",`${user} a archivé et réinitialisé les commandes du jour`);
  };
  const deleteHistory=async id=>{ if(!window.confirm("Supprimer ce jour de l'historique ?"))return; await deleteDoc(doc(db,"history",id)); };

  // ── Commande depuis l'onglet Menu ──
  const orderFromMenu = async(r, section, item) => {
    if(!canEditFor(user)){ showToast(locked?"🔒 Les commandes sont clôturées":"Commande déjà payée, plus modifiable"); return; }
    const a = section.action || {type:"main"};
    const mine = orders[user]?.choice===r.id;
    const prev = orders[user];
    const cur = mine ? orders[user] : {...EMPTY_ORDER, choice:r.id};
    const write = async(o, msg) => {
      await setDoc(doc(db,"orders",user),{...o,choice:r.id,validated:false});
      showToast(msg, [{label:"Voir ma commande", fn:()=>{ setToast(null); setTab("order"); }}, {label:"Annuler", fn:()=>restoreOrder(user,prev)}]);
    };
    switch (actionType(section)) {
      case "main":    await write({...cur, snackType:a.snackType||"", detail:stripPrefix(item.name,a.prefix)}, item.name+" ajouté"); break;
      case "frite":   await write({...cur, friteSup:item.name}, "Frite "+item.name+" ajoutée"); break;
      case "sauce":   setSauceModal({sauceName:item.name, restoId:r.id}); break;
      case "boisson": await addBoissonOpt(item.name); await write({...cur, boisson:item.name}, item.name+" ajouté"); break;
      case "scoop": {
        const b1 = mine ? (cur.boule1||"") : ""; const b2 = mine ? (cur.boule2||"") : "";
        const maxCount = Math.max(1, ...scoopOptions(r).map(o=>o.count||1));
        const newB1 = b1 || item.name;
        const newB2 = (b1 && !b2 && maxCount>=2) ? item.name : b2;
        const opt = scoopOptions(r).find(o=>(o.count||1)===(newB2?2:1));
        await write({...cur, boules:opt?.label||"", boule1:newB1, boule2:newB2}, item.name+" ajouté");
        break;
      }
      default: break;
    }
  };

  // ── Styles partagés ──
  const inp={ width:"100%", background:T.bgInput, border:`1px solid ${T.border}`, borderRadius:8, color:T.text, padding:"8px 12px", fontSize:14 };
  const addBtn={ background:T.sidebar, color:"#f5efe6", border:"none", borderRadius:8, padding:"8px 18px", fontSize:13, fontWeight:600, cursor:"pointer", whiteSpace:"nowrap" };
  const card={ background:T.bgCard, border:`1px solid ${T.border}`, borderRadius:14, padding:"20px 24px", boxShadow:T.shadow };
  const h1={ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:22, color:T.text };
  const h2={ fontSize:15, fontWeight:600, color:T.text, marginBottom:4 };
  const helpS={ fontSize:12, color:T.textFaint, marginBottom:14, lineHeight:1.5 };
  const emptyBox=(icon,text,sub)=>(
    <div style={{...card,padding:"48px 24px",textAlign:"center",color:T.textFaint}}>
      <div style={{fontSize:32,marginBottom:10}}>{icon}</div><p style={{color:T.textSub}}>{text}</p>
      {sub && <p style={{fontSize:13,marginTop:6}}>{sub}</p>}
    </div>
  );

  // ── Navigation ──
  const NAV = {
    order:    { icon:"📋", label:"Commander" },
    summary:  { icon:"📊", label:"Résumé" },
    menu:     { icon:"🍽️", label:"Menu" },
    accounts: { icon:"💶", label:"Comptes" },
    messages: { icon:"💬", label:"Messages" },
    history:  { icon:"📅", label:"Historique" },
    profile:  { icon:"👤", label:"Profil" },
    settings: { icon:"⚙️", label:"Config" },
  };
  const navPrimary = ["order","summary","menu","accounts"];
  const navSecondary = ["messages","history","profile", ...(isAdmin?["settings"]:[])];
  const itemBadge = id => id==="messages" ? unreadChat : id==="accounts" ? accountsBadge : 0;
  const secBadge = navSecondary.reduce((a,id)=>a+itemBadge(id),0);
  const secActive = navSecondary.includes(tab);

  const markChatSeen = ()=>{ localStorage.setItem("lastSeenChat",Date.now().toString()); setUnreadChat(0); };
  const markActivitySeen = ()=>{ const n=Date.now(); localStorage.setItem("lastSeenActivity",n.toString()); setLastSeenActivity(n); setUnreadActivity(0); };
  const selectTab = id => {
    setTab(id);
    if(id==="messages"){ if(msgTab==="chat") markChatSeen(); else markActivitySeen(); }
  };
  const badgeEl = (n, color="#c0553a") => n>0 && (
    <span style={{position:"absolute",top:-4,right:-8,background:color,color:"#fff",borderRadius:10,minWidth:15,height:15,padding:"0 4px",fontSize:9,fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center"}}>{n>9?"9+":n}</span>
  );

  const renderNavBtn = (id)=>{
    const item = NAV[id]; const isActive = tab===id; const tabColor = T.bg;
    return (
      <div key={id} style={{width:"100%",position:"relative",display:"flex",alignItems:"center",justifyContent:"flex-end"}}>
        {isActive && (
          <div style={{position:"absolute",right:0,width:82,height:62,background:tabColor,borderRadius:"14px 0 0 14px",zIndex:1}}>
            <div style={{position:"absolute",top:-18,right:0,width:18,height:18,background:"transparent",boxShadow:`9px 9px 0 9px ${tabColor}`,borderRadius:"0 0 14px 0"}}/>
            <div style={{position:"absolute",bottom:-18,right:0,width:18,height:18,background:"transparent",boxShadow:`9px -9px 0 9px ${tabColor}`,borderRadius:"0 14px 0 0"}}/>
          </div>
        )}
        <button onClick={()=>selectTab(id)} aria-current={isActive?"page":undefined} title={item.label}
          style={{position:"relative",zIndex:2,width:82,height:62,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,border:"none",cursor:"pointer",background:"transparent",color:isActive?T.accent:"rgba(255,255,255,0.78)",transition:"color 0.2s"}}>
          <span style={{fontSize:20,lineHeight:1,position:"relative"}}>{item.icon}{badgeEl(itemBadge(id))}</span>
          <span style={{fontSize:10,fontWeight:isActive?700:500,letterSpacing:"0.02em"}}>{item.label}</span>
        </button>
      </div>
    );
  };

  const menuResto = findResto(restaurants, activeMenu) || restaurants[0];
  const shortTitle = Array.isArray(appConfig.shortTitle) ? appConfig.shortTitle : [appConfig.title||""];
  const validatedCount = names.filter(n=>orders[n]?.validated).length;
  const orderedCount = names.filter(n=>orders[n]?.choice).length;
  const notOrdered = names.filter(n=>!orders[n]?.choice);

  // ── Carte de commande (utilisée pour soi et par l'admin pour chacun) ──
  const renderOrderBody = (name) => {
    const order = orders[name]||{};
    const r = findResto(restaurants, order.choice);
    const canEdit = canEditFor(name);
    const isMe = name===user;

    if (!order.choice) {
      if (!canEdit) return <p style={{fontSize:13,color:T.textFaint}}>{locked?"🔒 Commandes clôturées, pas de commande.":"Pas encore commandé."}</p>;
      return (
        <div>
          <p style={{fontSize:13,color:T.textSub,marginBottom:10}}>Où {isMe?"veux-tu":"veut-"+name} manger aujourd'hui ?</p>
          <div style={{display:"grid",gridTemplateColumns:`repeat(auto-fill, minmax(${isMobile?130:160}px, 1fr))`,gap:10}}>
            {restaurants.map(rr=>{
              const dis = !isAdmin && !!paid[rr.id];
              return (
                <button key={rr.id} disabled={dis} onClick={()=>chooseResto(name, rr.id)}
                  style={{background:rr.bg,border:`1.5px solid ${rr.accent}55`,borderRadius:14,padding:"16px 12px",cursor:dis?"not-allowed":"pointer",opacity:dis?0.5:1,textAlign:"center",transition:"transform 0.15s"}}>
                  <div style={{fontSize:30,marginBottom:6}}>{rr.emoji}</div>
                  <div style={{fontSize:13.5,fontWeight:700,color:rr.accent}}>{rr.label}</div>
                  {dis && <div style={{fontSize:11,color:rr.accent,marginTop:3}}>Déjà payé</div>}
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    if (!r) return <p style={{fontSize:13,color:T.textFaint}}>Restaurant introuvable dans la configuration.</p>;

    if (order.validated || !canEdit) {
      const priced = orderPricedLines(order, ctx);
      return (
        <div>
          <OrderPills order={order} ctx={ctx} T={T}/>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,marginTop:12,flexWrap:"wrap"}}>
            <span style={{fontSize:13,color:T.textSub}}>
              Total : <strong style={{color:T.text}}>{fmtEuro(priced.total)}</strong>
              {order.validated && order.validatedAt && <span style={{color:T.textFaint}}> · validée à {fmtTime(order.validatedAt)}</span>}
            </span>
            <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
              {canEdit && (
                <button onClick={()=>patchOrder(name,{validated:false})}
                  style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:9,padding:"7px 12px",fontSize:12.5,cursor:"pointer"}}>✏️ Modifier</button>
              )}
              {canEdit && (
                <button onClick={()=>chooseResto(name, order.choice)}
                  style={{background:"transparent",border:`1px solid ${T.red}55`,color:T.red,borderRadius:9,padding:"7px 12px",fontSize:12.5,cursor:"pointer"}}>Annuler la commande</button>
              )}
              {!canEdit && isMe && <span style={{fontSize:12,color:T.textFaint}}>{paid[order.choice]?.shares?.[name]!=null?"💳 Déjà payé":"🔒 Clôturé"}</span>}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div>
        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:14,alignItems:"center"}}>
          {restaurants.map(rr=>{
            const on = rr.id===order.choice;
            return (
              <button key={rr.id} onClick={()=>chooseResto(name, rr.id)} title={on?"Annuler la commande":"Changer pour "+rr.label}
                style={{padding:"5px 11px",borderRadius:20,fontSize:12,fontWeight:on?700:500,border:`1px solid ${on?rr.accent:T.border}`,
                  background:on?rr.accent+"20":"transparent",color:on?rr.accent:T.textSub,cursor:"pointer"}}>
                {rr.emoji} {rr.label}{on?" ✕":""}
              </button>
            );
          })}
        </div>
        <OrderForm key={name+"_"+order.choice} T={T} name={name} order={order} r={r} ctx={ctx}
          sauces={sauces} crudites={crudites} boissons={boissons} lists={lists}
          mealExtras={extras.filter(e=>e.appliesTo?.includes(order.choice))}
          patch={p=>patchOrder(name,p)} patchDetail={d=>patchDetail(name,d)}
          addSauce={addSauceOpt} addBoisson={addBoissonOpt}
          onValidate={()=>validateOrder(name)}
          onSaveFavorite={isMe ? ()=>setShowFavModal(true) : null}/>
      </div>
    );
  };

  const statusTag = (name) => {
    const o = orders[name];
    if (!o?.choice) return <Tag T={T}>Pas encore commandé</Tag>;
    if (o.validated) return <Tag T={T} color={T.green} bg={T.green+"1c"}>✓ Validée</Tag>;
    return <Tag T={T} color={T.orange} bg={T.orange+"1c"}>En cours</Tag>;
  };

  // Statut de remboursement d'une personne pour un restaurant payé
  const debtStatus = (name, rid) => {
    const p = paid[rid]; if(!p) return null;
    if (name===p.payer) return <span style={{fontSize:11.5,color:T.accent}}>💳 a payé</span>;
    const share = p.shares?.[name];
    if (!share) return null;
    const entry = ledger.find(e=>(p.entryIds||[]).includes(e.id) && e.debtor===name);
    if (!entry) return <span style={{fontSize:11.5,color:T.green}}>✓ remboursé</span>;
    return <span style={{fontSize:11.5,color:entry.claimed?T.accent:T.orange}}>{entry.claimed?"⏳ à confirmer":`doit ${fmtEuro(entry.amount)} à ${p.payer}`}</span>;
  };

  const myOrder = orders[user];
  const myPaid = myOrder?.choice && paid[myOrder.choice];
  const myEntry = myPaid ? ledger.find(e=>(myPaid.entryIds||[]).includes(e.id) && e.debtor===user) : null;
  const personalStatus = myEntry ? (
    <button onClick={()=>selectTab("accounts")} style={{width:"100%",background:T.orange+"18",border:`1px solid ${T.orange}55`,color:T.orange,borderRadius:10,padding:"9px 12px",fontSize:12.5,fontWeight:600,cursor:"pointer",textAlign:"left"}}>
      💶 Tu dois {fmtEuro(myEntry.amount)} à {myPaid.payer} → Comptes
    </button>
  ) : null;

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{minHeight:"100vh",display:"flex",background:T.bg}}>
      <style>{CSS(T)}</style>

      {/* Feedback prix */}
      {showFeedback && (
        <div role="dialog" aria-modal="true" style={{position:"fixed",inset:0,background:"rgba(20,15,10,0.4)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000,padding:16}}
          onClick={e=>e.target===e.currentTarget&&setShowFeedback(false)}>
          <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:16,padding:24,width:420,maxWidth:"100%",boxShadow:"0 24px 80px rgba(44,31,14,0.2)"}}>
            <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:17,color:T.text,marginBottom:6}}>💡 Signaler un prix ou une idée</h3>
            <p style={{fontSize:13,color:T.textSub,lineHeight:1.5,marginBottom:14}}>Les totaux sont estimés à partir des prix Take Away. Indique les vrais prix ou toute amélioration : l'admin les verra.</p>
            {feedbackSent ? (
              <div style={{background:T.green+"18",border:`1px solid ${T.green}44`,color:T.green,borderRadius:10,padding:"14px",textAlign:"center",fontSize:14,fontWeight:600}}>✓ Merci, c'est envoyé !</div>
            ) : (
              <>
                <textarea autoFocus value={feedbackInput} onChange={e=>setFeedbackInput(e.target.value)} rows={4} placeholder="ex : Bicky pitta 8,50 € au comptoir…"
                  style={{width:"100%",background:T.bgInput,border:`1px solid ${T.border}`,borderRadius:10,color:T.text,padding:"10px 12px",fontSize:13.5,lineHeight:1.5,marginBottom:14}}/>
                <div style={{display:"flex",gap:8}}>
                  <button onClick={submitFeedback} disabled={!feedbackInput.trim()} style={{flex:1,background:T.sidebar,color:"#fff",border:"none",borderRadius:10,padding:"11px",fontSize:14,fontWeight:600,cursor:"pointer",opacity:feedbackInput.trim()?1:0.5}}>Envoyer</button>
                  <button onClick={()=>setShowFeedback(false)} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"11px 16px",fontSize:13,cursor:"pointer"}}>Annuler</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Nom du favori */}
      {showFavModal && (
        <div role="dialog" aria-modal="true" style={{position:"fixed",inset:0,background:"rgba(44,31,14,0.4)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000,padding:16}}
          onClick={e=>e.target===e.currentTarget&&setShowFavModal(false)}>
          <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:16,padding:"26px",width:360,maxWidth:"100%",boxShadow:"0 24px 80px rgba(44,31,14,0.2)"}}>
            <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:17,color:T.text,marginBottom:6}}>⭐ Nommer ce favori</h3>
            <p style={{fontSize:13,color:T.textSub,marginBottom:16}}>Tu pourras le recharger en un clic depuis Commander.</p>
            <input autoFocus style={{...inp,marginBottom:12}} value={favNameInput} onChange={e=>setFavNameInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveFavorite()} placeholder="ex : Mon durum du vendredi"/>
            <div style={{display:"flex",gap:8}}>
              <button style={{...addBtn,flex:1}} onClick={saveFavorite}>Enregistrer</button>
              <button className="btn-ghost" style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"8px 16px",fontSize:13,cursor:"pointer"}} onClick={()=>setShowFavModal(false)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Paiement */}
      {payModal && (()=>{
        const r = findResto(restaurants, payModal.restoId);
        const people = names.filter(n=>orders[n]?.choice===payModal.restoId);
        return <PayModal T={T} r={r} people={people} orders={orders} ctx={ctx}
          payerOptions={orderers} defaultPayer={!isAdmin?user:(people[0]||"")}
          onClose={()=>setPayModal(null)} onConfirm={data=>declarePayment(payModal.restoId,data)}/>;
      })()}

      {/* Sauce depuis le menu */}
      {sauceModal && (
        <div role="dialog" aria-modal="true" style={{position:"fixed",inset:0,background:"rgba(44,31,14,0.4)",backdropFilter:"blur(4px)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:3000}}
          onClick={e=>e.target===e.currentTarget&&setSauceModal(null)}>
          <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:16,padding:"24px",width:300,boxShadow:"0 24px 60px rgba(44,31,14,0.15)"}}>
            <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:T.text,marginBottom:6}}>🫙 {sauceModal.sauceName}</h3>
            <p style={{fontSize:13,color:T.textSub,marginBottom:16}}>Où ajouter cette sauce ?</p>
            <div style={{display:"flex",flexDirection:"column",gap:8}}>
              {[
                {label:"🫙 Dans le sandwich", color:"#9b7fa6", apply:(cur,s)=>{ const sel=readSel(cur,"sauces"); return {...cur, ...writeSel(cur,"sauces",{mode:"some",items:sel.mode==="some"&&!sel.items.includes(s)?[...sel.items,s]:[s]})}; }, msg:"ajoutée au sandwich"},
                {label:"🥣 Pour les frites", color:"#c8922a", apply:(cur,s)=>({...cur,sauceFrite:s}), msg:"ajoutée aux frites"},
              ].map(o=>(
                <button key={o.label} style={{background:o.color+"18",border:`1px solid ${o.color}44`,color:o.color,borderRadius:10,padding:"10px",fontSize:13,cursor:"pointer",fontWeight:500}}
                  onClick={async()=>{
                    const s=sauceModal.sauceName, rid=sauceModal.restoId; const prev=orders[user];
                    const cur=orders[user]?.choice===rid ? orders[user] : {...EMPTY_ORDER, choice:rid};
                    await addSauceOpt(s);
                    await setDoc(doc(db,"orders",user),{...o.apply(cur,s),choice:rid,validated:false});
                    showToast(`${s} ${o.msg}`, [{label:"Annuler", fn:()=>restoreOrder(user,prev)}]);
                    setSauceModal(null);
                  }}>{o.label}</button>
              ))}
              <button style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"8px",fontSize:12,cursor:"pointer"}} onClick={()=>setSauceModal(null)}>Annuler</button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div role="status" style={{position:"fixed",bottom:isMobile?84:28,left:"50%",transform:"translateX(-50%)",background:T.text,color:T.bg,padding:"10px 12px 10px 18px",fontSize:13,borderRadius:12,animation:"toastIn 0.25s ease",zIndex:4000,boxShadow:T.shadowHover,display:"flex",alignItems:"center",gap:10,maxWidth:"calc(100vw - 24px)"}}>
          <span>{toast.msg}</span>
          {toast.actions.map(a=>(
            <button key={a.label} onClick={a.fn} style={{background:"transparent",color:T.bg,border:`1px solid ${T.bg}55`,borderRadius:7,padding:"4px 10px",fontSize:12,cursor:"pointer",fontWeight:600,whiteSpace:"nowrap"}}>{a.label}</button>
          ))}
          <button aria-label="Fermer" onClick={()=>setToast(null)} style={{background:"none",border:"none",color:T.bg,opacity:0.6,cursor:"pointer",fontSize:14}}>✕</button>
        </div>
      )}

      {/* ── Barre latérale ── */}
      {!isMobile && (
        <aside style={{width:88,background:`linear-gradient(180deg, ${T.sidebarBg} 0%, ${T.sidebar} 100%)`,display:"flex",flexDirection:"column",position:"sticky",top:0,height:"100vh",flexShrink:0,zIndex:10}}>
          <div style={{padding:"20px 0 16px",display:"flex",flexDirection:"column",alignItems:"center",borderBottom:"1px solid rgba(255,252,245,0.12)",marginBottom:8}}>
            <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:11,color:"#fff",letterSpacing:"0.5px",lineHeight:1.2,textAlign:"center"}}>
              {shortTitle.map((l,i)=><div key={i} style={i>0?{opacity:0.6}:undefined}>{l}</div>)}
            </div>
          </div>
          <nav style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"4px 0",gap:2}}>
            {navPrimary.map(renderNavBtn)}
            <button onClick={()=>setNavOpen(o=>!o)} title={navOpen?"Réduire":"Plus"}
              style={{width:82,height:54,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:4,border:"none",cursor:"pointer",background:"transparent",color:(secActive&&!navOpen)?T.accent:"rgba(255,255,255,0.6)"}}>
              <span style={{fontSize:20,lineHeight:1,position:"relative"}}>{navOpen?"▾":"⋯"}{!navOpen && badgeEl(secBadge)}</span>
              <span style={{fontSize:10,fontWeight:500}}>{navOpen?"Réduire":"Plus"}</span>
            </button>
            {navOpen && navSecondary.map(renderNavBtn)}
          </nav>
          <div style={{padding:"12px 0 16px",display:"flex",flexDirection:"column",alignItems:"center",gap:8,borderTop:"1px solid rgba(255,252,245,0.12)"}}>
            <div style={{position:"relative"}}>
              <Avatar name={user} size={28} profile={profiles[user]}/>
              <span style={{position:"absolute",bottom:-1,right:-1,padding:2,borderRadius:"50%",background:T.sidebar,display:"flex"}}><StatusDot status={status}/></span>
            </div>
            <button onClick={toggleTheme} aria-label="Changer de thème" style={{background:"rgba(255,252,245,0.12)",border:"none",borderRadius:7,padding:"4px 8px",fontSize:12,cursor:"pointer",color:"#fff"}}>{isDark?"☀️":"🌙"}</button>
            <button onClick={()=>setUser(null)} style={{background:"rgba(255,252,245,0.12)",border:"none",borderRadius:7,padding:"3px 6px",fontSize:9.5,cursor:"pointer",color:"rgba(255,252,245,0.75)"}}>Quitter</button>
          </div>
        </aside>
      )}

      <div style={{flex:1,display:"flex",flexDirection:"column",minWidth:0}}>

        {isMobile && (
          <header style={{background:T.bgCard,borderBottom:`1px solid ${T.border}`,padding:"12px 16px",paddingTop:"calc(12px + env(safe-area-inset-top, 0px))",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100}}>
            <div style={{display:"flex",alignItems:"center",gap:8}}>
              {appConfig.logoEmoji && <span style={{fontSize:18}}>{appConfig.logoEmoji}</span>}
              <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:T.text}}>{appConfig.title||""}</span>
              <StatusDot status={status}/>
            </div>
            <div style={{display:"flex",gap:6}}>
              <button onClick={toggleTheme} aria-label="Changer de thème" style={{background:T.bgTag,border:`1px solid ${T.border}`,borderRadius:8,padding:"5px 8px",fontSize:13,cursor:"pointer",color:T.text}}>{isDark?"☀️":"🌙"}</button>
              <button onClick={()=>setUser(null)} style={{background:T.bgTag,border:`1px solid ${T.border}`,borderRadius:8,padding:"5px 10px",fontSize:11.5,cursor:"pointer",color:T.textSub}}>Déconnexion</button>
            </div>
          </header>
        )}

        {isMobile && (
          <>
            {navOpen && <div onClick={()=>setNavOpen(false)} style={{position:"fixed",inset:0,zIndex:100,background:"rgba(0,0,0,0.25)"}}/>}
            {navOpen && (
              <div style={{position:"fixed",left:8,right:8,zIndex:101,bottom:"calc(64px + env(safe-area-inset-bottom,8px))",background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,boxShadow:T.shadowHover,padding:6,display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:4}}>
                {navSecondary.map(id=>{
                  const item=NAV[id]; const isActive=tab===id;
                  return (
                    <button key={id} onClick={()=>{ selectTab(id); setNavOpen(false); }}
                      style={{display:"flex",alignItems:"center",gap:9,padding:"12px",borderRadius:10,border:"none",cursor:"pointer",background:isActive?T.accentLight:"transparent",color:isActive?T.accent:T.text}}>
                      <span style={{fontSize:19,position:"relative"}}>{item.icon}{badgeEl(itemBadge(id))}</span>
                      <span style={{fontSize:13.5,fontWeight:isActive?700:500}}>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
            <nav style={{position:"fixed",bottom:0,left:0,right:0,background:T.bgCard,borderTop:`1px solid ${T.border}`,display:"flex",zIndex:100,paddingBottom:"env(safe-area-inset-bottom,8px)"}}>
              {navPrimary.map(id=>{
                const item=NAV[id]; const isActive=tab===id;
                return (
                  <button key={id} onClick={()=>selectTab(id)} aria-current={isActive?"page":undefined}
                    style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"10px 0",background:"none",border:"none",cursor:"pointer",color:isActive?T.accent:T.textFaint,borderTop:isActive?`2px solid ${T.accent}`:"2px solid transparent"}}>
                    <span style={{fontSize:20,position:"relative"}}>{item.icon}{badgeEl(itemBadge(id))}</span>
                    <span style={{fontSize:10,fontWeight:isActive?700:500}}>{item.label}</span>
                  </button>
                );
              })}
              <button onClick={()=>setNavOpen(o=>!o)}
                style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:3,padding:"10px 0",background:"none",border:"none",cursor:"pointer",color:(secActive||navOpen)?T.accent:T.textFaint,borderTop:(secActive&&!navOpen)?`2px solid ${T.accent}`:"2px solid transparent"}}>
                <span style={{fontSize:20,position:"relative"}}>{navOpen?"▾":"⋯"}{!navOpen && badgeEl(secBadge)}</span>
                <span style={{fontSize:10,fontWeight:(secActive||navOpen)?700:500}}>Plus</span>
              </button>
            </nav>
          </>
        )}

        <main style={{flex:1,padding:isMobile?"16px 12px 90px":"28px 32px",width:"100%",margin:"0 auto"}}>

          {/* ════ COMMANDER ════ */}
          {tab==="order" && (
            <div style={{animation:"slideIn 0.25s ease"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16,gap:10,flexWrap:"wrap"}}>
                <div>
                  <h1 style={{...h1,marginBottom:2}}>{isAdmin?"Commandes du jour":`Bonjour ${profiles[user]?.alias||user} 👋`}</h1>
                  <p style={{fontSize:13,color:T.textSub}}>{orderedCount}/{names.length} ont commandé · {validatedCount} validée{validatedCount>1?"s":""}</p>
                </div>
                {isAdmin && (
                  <button onClick={()=>setViewMode(v=>v==="accordion"?"columns":"accordion")}
                    style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:8,padding:"7px 14px",fontSize:12,cursor:"pointer",color:T.textSub,boxShadow:T.shadow}}>
                    {viewMode==="accordion"?"⊞ Vue colonnes":"☰ Vue liste"}
                  </button>
                )}
              </div>

              {/* Bandeaux */}
              <div style={{display:"flex",flexDirection:"column",gap:8,marginBottom:16}}>
                {locked ? (
                  <div style={{background:T.red+"14",border:`1px solid ${T.red}44`,color:T.red,borderRadius:12,padding:"10px 14px",fontSize:13,fontWeight:500}}>
                    🔒 Les commandes sont clôturées{isAdmin?" (tu peux encore tout modifier en tant qu'admin).":"."}
                  </div>
                ) : deadlineTs!=null && (
                  <div style={{background:(minutesLeft<=15?T.orange:T.accent)+"14",border:`1px solid ${(minutesLeft<=15?T.orange:T.accent)}44`,color:minutesLeft<=15?T.orange:T.accent,borderRadius:12,padding:"10px 14px",fontSize:13,fontWeight:500}}>
                    ⏰ Commandes jusqu'à {appConfig.orderDeadline} · {minutesLeft>=60?`encore ${Math.floor(minutesLeft/60)} h ${String(minutesLeft%60).padStart(2,"0")}`:`encore ${minutesLeft} min`}
                  </div>
                )}
                {quote && (
                  <div style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:12,padding:"10px 14px",display:"flex",alignItems:"center",gap:10}}>
                    <span style={{flex:1,fontSize:13,color:T.textSub,fontStyle:"italic"}}>« {quote.text} »{quote.author?` — ${quote.author}`:""}</span>
                    <button aria-label="Masquer" onClick={()=>setQuote(null)} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:14}}>✕</button>
                  </div>
                )}
                {restaurants.length===0 && (
                  <div style={{...card,color:T.textSub,fontSize:13}}>Aucun restaurant configuré. {isAdmin?"Ajoute-les dans Config → Éditeur avancé.":"Demande à l'admin de les configurer."}</div>
                )}
              </div>

              <div style={{display:isMobile?"block":"flex",gap:20,alignItems:"flex-start"}}>
                <div style={{flex:1,minWidth:0}}>

                  {/* Favoris rapides */}
                  {!isAdmin && (favorites[user]||[]).length>0 && canEditFor(user) && !myOrder?.validated && (
                    <div style={{marginBottom:16}}>
                      <p style={{fontSize:12,fontWeight:600,color:T.textSub,marginBottom:8}}>⭐ Mes favoris</p>
                      <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4}}>
                        {(favorites[user]||[]).map(fav=>{
                          const rr=findResto(restaurants,fav.choice);
                          return (
                            <button key={fav.id} onClick={()=>applyFavorite(fav)}
                              style={{background:T.bgCard,border:`1.5px solid ${rr?.accent||T.border}55`,borderRadius:12,padding:"9px 14px",cursor:"pointer",textAlign:"left",minWidth:150,flexShrink:0,boxShadow:T.shadow}}>
                              <div style={{fontSize:11,color:rr?.accent||T.accent,fontWeight:600,marginBottom:2}}>{rr?.emoji} {rr?.label}</div>
                              <div style={{fontSize:12.5,fontWeight:600,color:T.text}}>{fav.name}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Ma commande */}
                  {!isAdmin && (()=>{
                    const r=findResto(restaurants,myOrder?.choice);
                    return (
                      <div style={{background:T.bgCard,border:`1.5px solid ${r?r.accent+"66":T.border}`,borderRadius:16,overflow:"hidden",boxShadow:T.shadow,marginBottom:16}}>
                        <div style={{padding:"12px 16px",display:"flex",alignItems:"center",gap:10,borderBottom:`1px solid ${T.borderLight}`,background:r?r.bg+(isDark?"22":""):"transparent"}}>
                          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:r&&!isDark?r.accent:T.text,flex:1}}>
                            {r?`${r.emoji} ${r.label}`:"Ma commande"}
                          </span>
                          {statusTag(user)}
                        </div>
                        <div style={{padding:isMobile?"14px":"18px"}}>{renderOrderBody(user)}</div>
                      </div>
                    );
                  })()}

                  {/* Admin : liste de toute l'équipe */}
                  {isAdmin && viewMode==="accordion" && (
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {names.map(name=>{
                        const order=orders[name]||{};
                        const r=findResto(restaurants,order.choice);
                        const open=!!openRows[name];
                        return (
                          <div key={name} style={{background:T.bgCard,border:`1.5px solid ${r?r.accent+"44":T.border}`,borderRadius:14,overflow:"hidden",boxShadow:T.shadow}}>
                            <button onClick={()=>setOpenRows(p=>({...p,[name]:!open}))} aria-expanded={open}
                              style={{width:"100%",padding:isMobile?"9px 12px":"12px 16px",display:"flex",alignItems:"center",gap:12,background:"transparent",border:"none",cursor:"pointer",textAlign:"left"}}>
                              <Avatar name={name} size={isMobile?28:34} profile={profiles[name]}/>
                              <div style={{flex:1,minWidth:0}}>
                                <div style={{fontSize:14,fontWeight:600,color:T.text,marginBottom:order.choice?3:0}}>{name} {r && <span style={{fontSize:12,color:r.accent,fontWeight:500}}>· {r.emoji} {r.label}</span>}</div>
                                {order.choice && !open && <div style={{fontSize:12,color:T.textFaint,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{formatOrder(order,ctx)||"En cours…"}</div>}
                              </div>
                              {statusTag(name)}
                              <span style={{color:T.textFaint,transform:open?"rotate(90deg)":"none",transition:"transform 0.2s"}}>›</span>
                            </button>
                            {open && <div style={{padding:isMobile?"4px 12px 14px":"4px 16px 16px 62px"}}>{renderOrderBody(name)}</div>}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {isAdmin && viewMode==="columns" && (
                    <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":`repeat(${Math.max(1,restaurants.length)},1fr)`,gap:16,alignItems:"start"}}>
                      {restaurants.map((r,ri)=>{
                        const people=names.filter(n=>orders[n]?.choice===r.id);
                        return (
                          <div key={r.id}>
                            <div style={{background:r.bg,border:`1.5px solid ${r.accent}44`,borderRadius:12,padding:"12px 14px",marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                              <span style={{fontSize:13,fontWeight:600,color:r.accent}}>{r.emoji} {r.label}</span>
                              <span style={{fontSize:11,background:r.accent+"22",color:r.accent,padding:"2px 8px",borderRadius:10,fontWeight:600}}>{people.length}</span>
                            </div>
                            <div style={{display:"flex",flexDirection:"column",gap:6}}>
                              {people.map(name=>(
                                <div key={name} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10,padding:"10px 12px",boxShadow:T.shadow}}>
                                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                                    <Avatar name={name} size={26} profile={profiles[name]}/>
                                    <span style={{fontSize:13,fontWeight:500,color:T.text,flex:1}}>{name}</span>
                                    {orders[name]?.validated && <span style={{fontSize:11,color:T.green}}>✓</span>}
                                  </div>
                                  <OrderPills order={orders[name]} ctx={ctx} T={T}/>
                                </div>
                              ))}
                              {people.length===0 && <div style={{background:T.bgInput,border:`1px dashed ${T.border}`,borderRadius:10,padding:"16px",textAlign:"center",color:T.textFaint,fontSize:12}}>Aucune commande</div>}
                            </div>
                            {ri===0 && notOrdered.length>0 && (
                              <div style={{marginTop:12}}>
                                <p style={{fontSize:11.5,color:T.textFaint,marginBottom:6}}>⏳ Pas encore commandé</p>
                                {notOrdered.map(n=><div key={n} style={{display:"flex",alignItems:"center",gap:6,padding:"5px 0"}}><Avatar name={n} size={22} profile={profiles[n]}/><span style={{fontSize:12,color:T.textSub}}>{n}</span></div>)}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {!isAdmin && (
                  <div style={{width:isMobile?"100%":340,flexShrink:0,position:isMobile?"static":"sticky",top:28}}>
                    <RecapPanel user={user} names={names} orders={orders} ctx={ctx} T={T} only="perso" isMobile={isMobile} onSuggest={()=>setShowFeedback(true)} personalStatus={personalStatus}/>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ════ RÉSUMÉ ════ */}
          {tab==="summary" && (
            <div style={{animation:"slideIn 0.25s ease"}}>
              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:20,gap:10,flexWrap:"wrap"}}>
                <div>
                  <h1 style={{...h1,marginBottom:2}}>Résumé</h1>
                  <p style={{fontSize:13,color:T.textSub}}>{orderedCount}/{names.length} ont commandé · {validatedCount} validée{validatedCount>1?"s":""}{locked?" · 🔒 clôturé":""}</p>
                </div>
                {isAdmin && (
                  <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                    <button onClick={()=>saveDay(locked?{locked:false,reopened:true}:{locked:true})}
                      style={{background:T.bgCard,border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"7px 14px",fontSize:12.5,cursor:"pointer",boxShadow:T.shadow}}>
                      {locked?"🔓 Rouvrir les commandes":"🔒 Clôturer les commandes"}
                    </button>
                    <button onClick={resetAll} style={{background:T.bgCard,border:`1px solid ${T.red}44`,color:T.red,borderRadius:8,padding:"7px 14px",fontSize:12.5,cursor:"pointer",boxShadow:T.shadow}}>🗑 Archiver la journée</button>
                  </div>
                )}
              </div>

              <RecapPanel user={user} names={names} orders={orders} ctx={ctx} T={T} isMobile={isMobile} onSuggest={()=>setShowFeedback(true)} personalStatus={personalStatus}/>

              <div style={{display:"flex",flexDirection:"column",gap:16}}>
                {restaurants.map(r=>{
                  const people=names.filter(n=>orders[n]?.choice===r.id);
                  if(!people.length) return null;
                  const p=paid[r.id];
                  const canCancel = p && (isAdmin || p.payer===user);
                  return (
                    <div key={r.id} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden",boxShadow:T.shadow}}>
                      <div style={{padding:"12px 18px",background:r.bg+(isDark?"22":""),borderBottom:`1px solid ${r.accent}22`,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                        <span style={{fontSize:14,fontWeight:700,color:isDark?T.text:r.accent}}>{r.emoji} {r.label} <span style={{fontWeight:400,fontSize:12.5}}>· {people.length}</span></span>
                        {p ? (
                          <span style={{display:"flex",alignItems:"center",gap:8,fontSize:12.5,color:T.textSub}}>
                            💳 Payé par <strong style={{color:T.text}}>{p.payer}</strong> · {fmtEuro(p.total)}
                            {canCancel && <button onClick={()=>cancelPayment(r.id)} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:12,textDecoration:"underline"}}>annuler</button>}
                          </span>
                        ) : (
                          <button onClick={()=>setPayModal({restoId:r.id})}
                            style={{background:r.accent,color:"#fff",border:"none",borderRadius:9,padding:"7px 13px",fontSize:12.5,fontWeight:600,cursor:"pointer"}}>
                            💳 {isAdmin?"Enregistrer qui a payé":"J'ai payé"}
                          </button>
                        )}
                      </div>
                      {people.map(name=>{
                        const prof=profiles[name]||{};
                        return (
                          <div key={name} className="row-hover" style={{padding:"12px 18px",borderBottom:`1px solid ${T.borderLight}`}}>
                            <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:6,flexWrap:"wrap"}}>
                              <div style={{position:"relative"}} className="avatar-tooltip-wrap">
                                <Avatar name={name} size={28} profile={prof}/>
                                {(prof.alias||prof.bio) && (
                                  <div className="avatar-tooltip" style={{position:"absolute",bottom:"calc(100% + 6px)",left:"50%",transform:"translateX(-50%)",background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:10,padding:"8px 12px",zIndex:50,boxShadow:T.shadow,minWidth:140,pointerEvents:"none",display:"none"}}>
                                    {prof.alias && <div style={{fontSize:13,fontWeight:700,color:T.text}}>{prof.alias}</div>}
                                    {prof.bio && <div style={{fontSize:11.5,color:T.textFaint,marginTop:2,maxWidth:180,whiteSpace:"normal"}}>{prof.bio}</div>}
                                  </div>
                                )}
                              </div>
                              <span style={{fontSize:13.5,fontWeight:500,color:T.text,flex:1}}>{prof.alias||name}</span>
                              {statusTag(name)}
                              {debtStatus(name, r.id)}
                            </div>
                            <div style={{paddingLeft:38}}><OrderPills order={orders[name]} ctx={ctx} T={T}/></div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
                {orderedCount===0 && emptyBox("🍽️","Aucune commande pour l'instant.")}
              </div>

              {notOrdered.length>0 && (
                <div style={{...card,padding:"12px 16px",marginTop:16,display:"flex",flexWrap:"wrap",gap:8,alignItems:"center"}}>
                  <span style={{color:T.textSub,fontSize:13}}>⏳ Pas encore commandé :</span>
                  {notOrdered.map(n=><Tag key={n} T={T}>{n}</Tag>)}
                </div>
              )}
            </div>
          )}

          {/* ════ COMPTES ════ */}
          {tab==="accounts" && (
            <div style={{animation:"slideIn 0.25s ease",maxWidth:720}}>
              <h1 style={{...h1,marginBottom:4}}>💶 Comptes</h1>
              <p style={{fontSize:13,color:T.textSub,marginBottom:20}}>Qui doit combien à qui. Les dettes croisées sont compensées automatiquement.</p>

              {!isAdmin && (()=>{
                const entries = Object.entries(myNets).filter(([,n])=>Math.abs(n)>0.004);
                const owe = entries.filter(([,n])=>n<0).reduce((a,[,n])=>a-n,0);
                const owed = entries.filter(([,n])=>n>0).reduce((a,[,n])=>a+n,0);
                if (!entries.length) return emptyBox("🎉","Tout est réglé !","Aucun remboursement en attente.");
                return (
                  <>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:16}}>
                      <div style={{...card,padding:"14px 16px"}}>
                        <div style={{fontSize:12,color:T.textSub}}>Je dois</div>
                        <div style={{fontWeight:700,fontSize:22,fontVariantNumeric:"tabular-nums",color:owe>0?T.orange:T.textFaint}}>{fmtEuro(owe)}</div>
                      </div>
                      <div style={{...card,padding:"14px 16px"}}>
                        <div style={{fontSize:12,color:T.textSub}}>On me doit</div>
                        <div style={{fontWeight:700,fontSize:22,fontVariantNumeric:"tabular-nums",color:owed>0?T.green:T.textFaint}}>{fmtEuro(owed)}</div>
                      </div>
                    </div>
                    <div style={{display:"flex",flexDirection:"column",gap:10}}>
                      {entries.map(([other,net])=>{
                        const iOwe = net<0; const claimed = pairClaimed(other);
                        const det = pairEntries(user,other); const open=!!openDetail[other];
                        return (
                          <div key={other} style={{...card,padding:"14px 16px"}}>
                            <div style={{display:"flex",alignItems:"center",gap:12,flexWrap:"wrap"}}>
                              <Avatar name={other} size={34} profile={profiles[other]}/>
                              <div style={{flex:1,minWidth:160}}>
                                <div style={{fontSize:14,color:T.text}}>
                                  {iOwe ? <>Tu dois <strong>{fmtEuro(-net)}</strong> à {other}</> : <>{other} te doit <strong>{fmtEuro(net)}</strong></>}
                                </div>
                                {claimed && <div style={{fontSize:12,color:T.accent,marginTop:2}}>{iOwe?"⏳ En attente de confirmation":`⏳ ${other} indique t'avoir remboursé`}</div>}
                              </div>
                              {iOwe && !claimed && (
                                <button onClick={()=>claimRepaid(other)} style={{background:T.accent,color:"#fff",border:"none",borderRadius:9,padding:"8px 13px",fontSize:12.5,fontWeight:600,cursor:"pointer"}}>J'ai remboursé</button>
                              )}
                              {!iOwe && (
                                <button onClick={()=>confirmRepaid(user,other)} style={{background:claimed?T.green:"transparent",color:claimed?"#fff":T.green,border:`1px solid ${T.green}`,borderRadius:9,padding:"8px 13px",fontSize:12.5,fontWeight:600,cursor:"pointer"}}>
                                  {claimed?"✓ Confirmer la réception":"Marquer comme remboursé"}
                                </button>
                              )}
                            </div>
                            <button onClick={()=>setOpenDetail(p=>({...p,[other]:!open}))} style={{background:"none",border:"none",color:T.textFaint,fontSize:12,cursor:"pointer",marginTop:8}}>
                              {open?"▾ Masquer le détail":`▸ Détail (${det.length})`}
                            </button>
                            {open && (
                              <div style={{marginTop:6,borderTop:`1px solid ${T.borderLight}`,paddingTop:6}}>
                                {det.map(e=>(
                                  <div key={e.id} style={{display:"flex",justifyContent:"space-between",fontSize:12.5,color:T.textSub,lineHeight:1.9}}>
                                    <span>{fmtDay(e.date)} · {e.restoLabel} · {e.debtor===user?"tu dois":"te doit"}</span>
                                    <span style={{color:e.debtor===user?T.orange:T.green}}>{e.debtor===user?"−":"+"}{fmtEuro(e.amount)}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                );
              })()}

              {isAdmin && (
                <div>
                  <h2 style={{...h2,marginBottom:10}}>Vue d'ensemble</h2>
                  {allPairs.length===0 ? emptyBox("🎉","Aucune dette en cours.") : (
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {allPairs.map(p=>{
                        const debtor = p.net>0 ? p.a : p.b; const creditor = p.net>0 ? p.b : p.a;
                        return (
                          <div key={p.a+"|"+p.b} style={{...card,padding:"12px 16px",display:"flex",alignItems:"center",gap:10,flexWrap:"wrap"}}>
                            <span style={{flex:1,fontSize:13.5,color:T.text}}><strong>{debtor}</strong> doit <strong>{fmtEuro(Math.abs(p.net))}</strong> à <strong>{creditor}</strong>{p.claimed && <span style={{color:T.accent,fontSize:12}}> · remboursement signalé</span>}</span>
                            <button onClick={()=>{ if(window.confirm(`Marquer comme réglé entre ${debtor} et ${creditor} ?`)) confirmRepaid(p.a,p.b); }}
                              style={{background:"transparent",border:`1px solid ${T.green}`,color:T.green,borderRadius:8,padding:"6px 12px",fontSize:12,cursor:"pointer"}}>Marquer réglé</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════ MESSAGES (chat + activité) ════ */}
          {tab==="messages" && (
            <div style={{animation:"slideIn 0.25s ease",display:"flex",flexDirection:"column",height:isMobile?"calc(100vh - 170px)":"calc(100vh - 60px)"}}>
              <div style={{display:"flex",background:T.bgTag,borderRadius:10,padding:3,marginBottom:14,maxWidth:340}}>
                {[["chat","💬 Chat",unreadChat],["activity","🔔 Activité",unreadActivity]].map(([id,label,n])=>(
                  <button key={id} onClick={()=>{ setMsgTab(id); if(id==="chat") markChatSeen(); else markActivitySeen(); }}
                    style={{flex:1,border:"none",borderRadius:8,padding:"8px 0",fontSize:13,fontWeight:600,cursor:"pointer",background:msgTab===id?T.sidebar:"transparent",color:msgTab===id?"#fff":T.textSub,position:"relative"}}>
                    {label}{msgTab!==id && n>0 && <span style={{marginLeft:6,background:"#c0553a",color:"#fff",borderRadius:10,padding:"0 6px",fontSize:10}}>{n}</span>}
                  </button>
                ))}
              </div>

              {msgTab==="chat" ? (
                <>
                  <div style={{flex:1,overflowY:"auto",display:"flex",flexDirection:"column",gap:8,padding:"4px 0",marginBottom:12}}>
                    {messages.length===0 && <div style={{textAlign:"center",color:T.textFaint,padding:40,fontSize:14}}>Aucun message pour l'instant.<br/><span style={{fontSize:12}}>Lance la conversation 👋</span></div>}
                    {messages.map(msg=>{
                      const isMe=msg.author===user; const prof=profiles[msg.author]||{};
                      return (
                        <div key={msg.id} style={{display:"flex",flexDirection:"column",alignItems:isMe?"flex-end":"flex-start",gap:3}}>
                          <span style={{fontSize:11,color:T.textSub,padding:"0 8px"}}>{prof.alias||msg.author}{isMe&&<span style={{opacity:0.6}}> (toi)</span>}</span>
                          <div style={{display:"flex",alignItems:"flex-end",gap:6,flexDirection:isMe?"row-reverse":"row"}}>
                            <Avatar name={msg.author} size={28} profile={prof}/>
                            <div style={{background:isMe?T.sidebar:T.bgCard,color:isMe?"#fff":T.text,border:isMe?"none":`1px solid ${T.border}`,borderRadius:isMe?"16px 16px 4px 16px":"16px 16px 16px 4px",padding:"9px 14px",fontSize:13.5,maxWidth:"72%",boxShadow:T.shadow,lineHeight:1.5,wordBreak:"break-word"}}>{msg.text}</div>
                            <span style={{fontSize:10,color:T.textFaint,flexShrink:0}}>{fmtTime(msg.ts)}</span>
                          </div>
                          {isAdmin && (
                            <button onClick={async()=>{ if(window.confirm("Supprimer ce message ?")) await deleteDoc(doc(db,"chat",msg.id)); }} style={{background:"none",border:"none",color:T.textFaint,fontSize:10.5,cursor:"pointer",padding:"0 8px"}}>Supprimer</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{display:"flex",gap:8,padding:"10px 0",borderTop:`1px solid ${T.border}`}}>
                    <input aria-label="Message" value={chatInput} onChange={e=>setChatInput(e.target.value)} placeholder="Écris un message…"
                      onKeyDown={async e=>{ if(e.key==="Enter"&&!e.shiftKey&&chatInput.trim()){ const t=chatInput.trim(); setChatInput(""); await addDoc(collection(db,"chat"),{author:user,text:t,ts:Date.now()}); } }}
                      style={{flex:1,background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:24,color:T.text,padding:"11px 16px",fontSize:14}}/>
                    <button aria-label="Envoyer" onClick={async()=>{ if(!chatInput.trim())return; const t=chatInput.trim(); setChatInput(""); await addDoc(collection(db,"chat"),{author:user,text:t,ts:Date.now()}); }}
                      style={{background:T.sidebar,color:"#fff",border:"none",borderRadius:"50%",width:44,height:44,fontSize:18,cursor:"pointer",flexShrink:0}}>➤</button>
                  </div>
                </>
              ) : (
                <div style={{flex:1,overflowY:"auto"}}>
                  {activity.length===0 ? emptyBox("🔔","Aucune activité pour l'instant.") : (
                    <div style={{display:"flex",flexDirection:"column",gap:6}}>
                      {activity.map((act,i)=>{
                        const isNew = act.ts > lastSeenActivity && act.author !== user;
                        const emoji = {order:"🛒",cancel:"❌",pay:"💳",reset:"🗑️",validate:"✅",repay:"🤝"}[act.type]||"📝";
                        return (
                          <div key={act.id||i} style={{background:isNew?T.accentLight:T.bgCard,border:`1px solid ${isNew?T.accent:T.border}`,borderRadius:12,padding:"10px 16px",display:"flex",alignItems:"center",gap:12}}>
                            <span style={{fontSize:18,flexShrink:0}}>{emoji}</span>
                            <span style={{flex:1,fontSize:13,color:T.text}}>{act.text}</span>
                            <span style={{fontSize:11,color:T.textFaint,flexShrink:0}}>{new Date(act.ts).toLocaleString("fr-BE",{weekday:"short",hour:"2-digit",minute:"2-digit"})}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ════ HISTORIQUE ════ */}
          {tab==="history" && (
            <div style={{animation:"slideIn 0.25s ease"}}>
              <h1 style={{...h1,marginBottom:20}}>📅 Historique</h1>
              {history.length===0 && emptyBox("📅","Aucun historique pour l'instant.","Les journées apparaissent ici après l'archivage.")}
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {history.map(day=>{
                  const visible=isAdmin?Object.entries(day.orders||{}):Object.entries(day.orders||{}).filter(([n])=>n===user);
                  if(!visible.length) return null;
                  const isOpen=!!openHistory[day.id];
                  return (
                    <div key={day.id} style={{background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:14,overflow:"hidden",boxShadow:T.shadow}}>
                      <div style={{padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,background:isOpen?T.bgHover:"transparent",borderBottom:isOpen?`1px solid ${T.border}`:"none"}}>
                        <button onClick={()=>setOpenHistory(p=>({...p,[day.id]:!isOpen}))} aria-expanded={isOpen}
                          style={{flex:1,display:"flex",alignItems:"center",gap:10,background:"none",border:"none",cursor:"pointer",textAlign:"left",padding:0}}>
                          <span style={{fontSize:16,transition:"transform 0.2s",display:"inline-block",transform:isOpen?"rotate(90deg)":"none",color:T.textSub}}>›</span>
                          <div>
                            <p style={{fontSize:14,fontWeight:600,color:T.text}}>{new Date(day.date||day.id.slice(0,10)).toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</p>
                            {!isOpen && <p style={{fontSize:12,color:T.textSub,marginTop:2}}>{visible.length} commande{visible.length>1?"s":""} · {restaurants.filter(r=>visible.some(([,o])=>o.choice===r.id)).map(r=>r.emoji+" "+r.label).join(", ")}</p>}
                          </div>
                        </button>
                        {isAdmin && (
                          <div style={{display:"flex",gap:6}}>
                            <button onClick={async()=>{ if(!window.confirm("Remettre ces commandes comme commandes du jour ?"))return; await Promise.all(Object.entries(day.orders||{}).map(([n,o])=>setDoc(doc(db,"orders",n),o))); showToast("Commandes restaurées"); }}
                              style={{background:T.green+"11",border:`1px solid ${T.green}33`,color:T.green,borderRadius:7,padding:"4px 10px",fontSize:11.5,cursor:"pointer"}}>↩ Restaurer</button>
                            <button aria-label="Supprimer" onClick={()=>deleteHistory(day.id)} style={{background:T.red+"11",border:`1px solid ${T.red}33`,color:T.red,borderRadius:7,padding:"4px 8px",fontSize:11.5,cursor:"pointer"}}>🗑</button>
                          </div>
                        )}
                      </div>
                      {isOpen && restaurants.map(r=>{
                        const people=visible.filter(([,o])=>o.choice===r.id);
                        if(!people.length) return null;
                        const dp=day.paid?.[r.id];
                        return (
                          <div key={r.id} style={{padding:"12px 18px",borderBottom:`1px solid ${T.borderLight}`}}>
                            <p style={{fontSize:12.5,fontWeight:600,color:r.accent,marginBottom:8}}>{r.emoji} {r.label}{dp && <span style={{color:T.textSub,fontWeight:400}}> · 💳 payé par {dp.payer} ({fmtEuro(dp.total)})</span>}</p>
                            {people.map(([name,o])=>(
                              <div key={name} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"7px 0"}}>
                                <Avatar name={name} size={24} profile={profiles[name]}/>
                                <div style={{flex:1}}>
                                  <span style={{fontSize:13,fontWeight:500,color:T.text}}>{name}</span>
                                  {dp?.shares?.[name]!=null && <span style={{fontSize:12,color:T.textFaint}}> · {fmtEuro(dp.shares[name])}</span>}
                                  <div style={{marginTop:4}}><OrderPills order={o} ctx={ctx} T={T}/></div>
                                </div>
                                {day.payments && <Tag T={T} color={day.payments[name]?T.green:T.textFaint}>{day.payments[name]?"✓ Payé":"Non payé"}</Tag>}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ════ MENU ════ */}
          {tab==="menu" && (
            <div style={{animation:"slideIn 0.25s ease"}}>
              <h1 style={{...h1,marginBottom:16}}>🍽️ Menus</h1>
              {!isAdmin && (
                <div style={{background:T.bgTag,borderRadius:10,padding:"9px 14px",marginBottom:16,fontSize:12.5,color:T.textSub,display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
                  <span>{myOrder?.choice ? <>🛒 Ma commande : <strong style={{color:T.text}}>{formatOrder(myOrder,ctx)||"en cours…"}</strong></> : <>💡 Clique sur <strong>+ Commander</strong> pour pré-remplir ta commande.</>}</span>
                  <button onClick={()=>setTab("order")} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"4px 10px",fontSize:11.5,cursor:"pointer",whiteSpace:"nowrap"}}>Voir ma commande</button>
                </div>
              )}

              <div role="tablist" style={{display:"flex",gap:6,marginBottom:20,borderBottom:`1px solid ${T.border}`,flexWrap:"wrap"}}>
                {restaurants.map(r=>{
                  const active=menuResto?.id===r.id;
                  return (
                    <button key={r.id} role="tab" aria-selected={active} onClick={()=>setActiveMenu(r.id)}
                      style={{padding:"9px 16px",border:"none",borderRadius:"8px 8px 0 0",cursor:"pointer",fontSize:13.5,fontWeight:active?700:500,background:active?T.bgCard:"transparent",color:active?r.accent:T.textSub,borderBottom:active?`2px solid ${r.accent}`:"2px solid transparent"}}>
                      {r.emoji} {r.menuLabel||r.label}
                    </button>
                  );
                })}
              </div>

              {menuResto && (
                <div>
                  {menuResto.header && (
                    <div style={{background:menuResto.header.gradient||menuResto.bg,borderRadius:16,padding:"24px",marginBottom:20,textAlign:"center",boxShadow:T.shadow,position:"relative"}}>
                      <div style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:28,color:"#fff",letterSpacing:"-0.5px",marginBottom:4}}>{menuResto.header.title}</div>
                      {menuResto.header.subtitle && <div style={{fontSize:14,color:"rgba(255,255,255,0.9)",fontStyle:"italic"}}>{menuResto.header.subtitle}</div>}
                      {isAdmin && sectionsOf(menuResto).some(s=>s.aiKey) && (
                        <label style={{position:"absolute",top:12,right:12,background:"rgba(255,255,255,0.25)",border:"1px solid rgba(255,255,255,0.4)",borderRadius:10,padding:"6px 12px",fontSize:12,fontWeight:600,color:"#fff",cursor:"pointer"}}>
                          {aiState.loading ? "⏳ Analyse…" : "📸 Mettre à jour"}
                          <input type="file" accept="image/*" style={{display:"none"}}
                            onChange={async(e)=>{
                              const file=e.target.files?.[0]; if(!file) return;
                              const rid=menuResto.id;
                              setAiState({loading:true,extracted:null,preview:false,restoId:rid});
                              try {
                                const base64 = await new Promise((res,rej)=>{
                                  const img=new Image();
                                  img.onload=()=>{ const c=document.createElement("canvas"); const sc=Math.min(1,1200/img.width); c.width=img.width*sc; c.height=img.height*sc; c.getContext("2d").drawImage(img,0,0,c.width,c.height); res(c.toDataURL("image/jpeg",0.7).split(",")[1]); };
                                  img.onerror=rej;
                                  const rd=new FileReader(); rd.onload=ev=>{ img.src=ev.target.result; }; rd.onerror=rej; rd.readAsDataURL(file);
                                });
                                const response=await fetch("/api/analyze-image",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({imageBase64:base64,mediaType:"image/jpeg"})});
                                const raw=await response.text();
                                let parsed; try{ parsed=JSON.parse(raw); } catch(_){ throw new Error("Réponse serveur invalide: "+raw.slice(0,200)); }
                                if(parsed.error) throw new Error(parsed.error+(parsed.detail?" — "+parsed.detail:""));
                                setAiState({loading:false,extracted:parsed,preview:true,restoId:rid});
                              } catch(err) {
                                console.error(err); setAiState({loading:false,extracted:null,preview:false,restoId:null});
                                alert("L'analyse de la photo a échoué. Réessaie avec une photo plus nette.");
                              }
                              e.target.value="";
                            }}/>
                        </label>
                      )}
                    </div>
                  )}

                  {aiState.preview && aiState.extracted && aiState.restoId===menuResto.id && (
                    <div style={{background:T.bgCard,border:`2px solid ${menuResto.accent}`,borderRadius:14,padding:"20px",marginBottom:16,boxShadow:T.shadow}}>
                      <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:menuResto.accent,marginBottom:12}}>✨ Éléments détectés : on enregistre ?</h3>
                      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"1fr 1fr",gap:12,marginBottom:16}}>
                        {sectionsOf(menuResto).filter(s=>s.aiKey).map(s=>(
                          <div key={s.aiKey}>
                            <p style={{fontSize:12,fontWeight:600,color:T.textSub,marginBottom:6}}>{s.cat}</p>
                            <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                              {(aiState.extracted[s.aiKey]||[]).map(n=><Tag key={n} T={T}>{n}</Tag>)}
                            </div>
                          </div>
                        ))}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <button onClick={async()=>{
                          const ex=aiState.extracted;
                          await updateResto(menuResto.id, r=>({...r, sections:sectionsOf(r).map(s=>s.aiKey && Array.isArray(ex[s.aiKey]) ? {...s, items:ex[s.aiKey].map(n=>({name:n}))} : s)}));
                          setAiState({loading:false,extracted:null,preview:false,restoId:null});
                          showToast("Menu mis à jour ✓");
                        }} style={{flex:1,background:menuResto.accent,color:"#fff",border:"none",borderRadius:10,padding:"10px",fontSize:13,fontWeight:600,cursor:"pointer"}}>Enregistrer</button>
                        <button onClick={()=>setAiState({loading:false,extracted:null,preview:false,restoId:null})} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:10,padding:"10px 16px",fontSize:13,cursor:"pointer"}}>Annuler</button>
                      </div>
                    </div>
                  )}

                  {(menuResto.links||[]).length>0 && (
                    <div style={{marginBottom:16,display:"flex",alignItems:"center",gap:16,flexWrap:"wrap"}}>
                      {menuResto.links.map((l,i)=>(
                        <a key={i} href={l.url} target={l.url?.startsWith("http")?"_blank":undefined} rel="noopener noreferrer" style={{fontSize:12.5,color:T.textSub,textDecoration:"none"}}>{l.label}</a>
                      ))}
                    </div>
                  )}

                  {sectionsOf(menuResto).map(section=>(
                    <MenuSection key={menuResto.id+"_"+section.cat} section={section} T={T} isAdmin={isAdmin}
                      onSave={(cat,items)=>saveSection(menuResto.id,cat,items)}
                      onOrder={!isAdmin && actionType(section)!=="none" ? item=>orderFromMenu(menuResto,section,item) : null}/>
                  ))}
                  {menuResto.note && <p style={{fontSize:11.5,color:T.textFaint,textAlign:"center",marginTop:8}}>{menuResto.note}</p>}
                </div>
              )}
            </div>
          )}

          {/* ════ PROFIL (+ favoris) ════ */}
          {tab==="profile" && (
            <div style={{animation:"slideIn 0.25s ease",maxWidth:560,margin:"0 auto"}}>
              <h1 style={{...h1,marginBottom:20}}>👤 Mon profil</h1>
              {!isAdmin && (
                <div style={{...card,marginBottom:16}}>
                  <h2 style={{...h2,marginBottom:10}}>⭐ Mes favoris</h2>
                  {(favorites[user]||[]).length===0 ? (
                    <p style={{fontSize:13,color:T.textFaint}}>Pas encore de favori. Enregistre-en un depuis l'étape « Récap » de ta commande.</p>
                  ) : (
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {(favorites[user]||[]).map(fav=>{
                        const {id:favId,name:favName,...favOrder}=fav;
                        const rr=findResto(restaurants,favOrder.choice);
                        return (
                          <div key={favId} style={{border:`1px solid ${T.borderLight}`,borderRadius:12,padding:"10px 12px",display:"flex",gap:10,alignItems:"flex-start"}}>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13.5,fontWeight:600,color:T.text,marginBottom:4}}>{favName} <span style={{fontSize:11.5,color:rr?.accent,fontWeight:500}}>{rr?.emoji} {rr?.label}</span></div>
                              <OrderPills order={favOrder} ctx={ctx} T={T}/>
                            </div>
                            <div style={{display:"flex",flexDirection:"column",gap:6}}>
                              {canEditFor(user) && <button onClick={async()=>{ await applyFavorite(fav); setTab("order"); }} style={{background:rr?.accent||T.accent,color:"#fff",border:"none",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}>Commander</button>}
                              <button onClick={async()=>{ if(window.confirm(`Supprimer « ${favName} » ?`)) await deleteFavorite(user,favId); }} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textFaint,borderRadius:8,padding:"5px 10px",fontSize:12,cursor:"pointer"}}>Supprimer</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <ProfileTab user={user} profiles={profiles} members={members} T={T} editingProfile={editingProfile} setEditingProfile={setEditingProfile}/>
            </div>
          )}

          {/* ════ CONFIG ════ */}
          {tab==="settings" && isAdmin && (
            <div style={{animation:"slideIn 0.25s ease",display:"flex",flexDirection:"column",gap:24,maxWidth:900}}>
              <h1 style={h1}>⚙️ Configuration</h1>

              {/* Commandes */}
              <div style={card}>
                <h2 style={h2}>⏰ Heure limite des commandes</h2>
                <p style={helpS}>Après cette heure, seul l'admin peut encore modifier les commandes. Laisse vide pour ne pas avoir de limite. Tu peux aussi clôturer ou rouvrir à la main depuis le Résumé.</p>
                <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                  <input type="time" value={appConfig.orderDeadline||""} onChange={e=>saveAppConfig({orderDeadline:e.target.value})} style={{...inp,width:140}}/>
                  {appConfig.orderDeadline && <button onClick={()=>saveAppConfig({orderDeadline:""})} style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:8,padding:"8px 12px",fontSize:12.5,cursor:"pointer"}}>Retirer la limite</button>}
                </div>
              </div>

              {/* Retours */}
              <div style={card}>
                <h2 style={h2}>💡 Prix signalés & idées</h2>
                <p style={helpS}>Envoyés par l'équipe via le ⓘ des totaux.</p>
                {feedback.length===0 ? <p style={{fontSize:13,color:T.textFaint}}>Aucun retour pour l'instant.</p> : (
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {feedback.map(f=>(
                      <div key={f.id} style={{display:"flex",gap:10,alignItems:"flex-start",padding:"10px 12px",background:T.bgHover,borderRadius:10,border:`1px solid ${T.borderLight}`}}>
                        <Avatar name={f.author} size={28} profile={profiles[f.author]}/>
                        <div style={{flex:1,minWidth:0}}>
                          <div style={{display:"flex",alignItems:"baseline",gap:8,marginBottom:2}}>
                            <span style={{fontSize:13,fontWeight:600,color:T.text}}>{f.author}</span>
                            <span style={{fontSize:11,color:T.textFaint}}>{new Date(f.ts).toLocaleDateString("fr-BE",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</span>
                          </div>
                          <div style={{fontSize:13,color:T.textSub,lineHeight:1.5,whiteSpace:"pre-wrap",wordBreak:"break-word"}}>{f.text}</div>
                        </div>
                        <button aria-label="Supprimer" onClick={()=>deleteFeedback(f.id)} style={{background:"none",border:"none",color:T.textFaint,cursor:"pointer",fontSize:14,padding:2}}>🗑</button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Membres */}
              <div style={card}>
                <h2 style={h2}>👥 Membres</h2>
                <p style={helpS}>👑 = administrateur (ne commande pas, gère la configuration). 📅 = planning uniquement (ne voit que le planning, ne commande pas). La suppression d'un membre se fait uniquement ici.</p>
                <div style={{display:"flex",gap:8,marginBottom:16,flexWrap:"wrap"}}>
                  <input style={{...inp,flex:2,minWidth:140}} value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} placeholder="Nom…"/>
                  <input style={{...inp,flex:1,minWidth:100}} value={newMemberCode} onChange={e=>setNewMemberCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMember()} placeholder="Code…"/>
                  <button style={addBtn} onClick={addMember}>+ Ajouter</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {members.map(m=>(
                    <div key={m.username} style={{display:"flex",alignItems:"center",gap:10,padding:"9px 12px",background:T.bgHover,borderRadius:10,border:`1px solid ${T.borderLight}`,flexWrap:"wrap"}}>
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
                          <span style={{flex:1,fontSize:13.5,fontWeight:500,color:T.text}}>{m.isAdmin?"👑 ":""}{m.planningOnly?"📅 ":""}{m.username}</span>
                          <Tag T={T}>{m.code}</Tag>
                          <button className="btn-ghost" title={m.isAdmin?"Retirer les droits admin":"Rendre admin"} onClick={()=>toggleMemberAdmin(m.username)}
                            style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,padding:"4px 8px",fontSize:11,cursor:"pointer",opacity:m.isAdmin?1:0.45}}>👑</button>
                          <button className="btn-ghost" title={m.planningOnly?"Redonner l'accès normal":"Planning uniquement"} onClick={()=>toggleMemberPlanning(m.username)}
                            style={{background:"transparent",border:`1px solid ${T.border}`,borderRadius:7,padding:"4px 8px",fontSize:11,cursor:"pointer",opacity:m.planningOnly?1:0.45}}>📅</button>
                          <button className="btn-ghost" aria-label="Modifier" style={{background:"transparent",border:`1px solid ${T.border}`,color:T.textSub,borderRadius:7,padding:"4px 8px",fontSize:11,cursor:"pointer"}} onClick={()=>setEditingMember({...m,_orig:m.username})}>✏️</button>
                          <button aria-label="Supprimer" style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:14,padding:4}} onClick={()=>removeMember(m.username)}>✕</button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Formats glaces */}
              {restaurants.filter(r=>r.kind==="glace").map(r=>(
                <div key={r.id} style={card}>
                  <h2 style={h2}>{r.emoji} {r.label} : formats & prix</h2>
                  <p style={helpS}>Le nombre de boules (1 ou 2) détermine combien de parfums on peut choisir.</p>
                  <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:10}}>
                    {scoopOptions(r).map((so,i)=>(
                      <div key={i+"_"+so.label+"_"+so.price+"_"+so.count} style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
                        <input style={{...inp,flex:2,minWidth:120,padding:"6px 10px",fontSize:13}} defaultValue={so.label} onBlur={e=>{ const v=e.target.value.trim(); if(v && v!==so.label) updateScoop(r.id,i,{label:v}); }}/>
                        <select value={so.count||1} onChange={e=>updateScoop(r.id,i,{count:Number(e.target.value)})} style={{...inp,width:110,padding:"6px 10px",fontSize:13}}>
                          <option value={1}>1 boule</option><option value={2}>2 boules</option>
                        </select>
                        <input style={{...inp,width:100,padding:"6px 10px",fontSize:13}} defaultValue={priceToInput(so.price)} placeholder="Prix €" inputMode="decimal" onBlur={e=>{ if(e.target.value.trim()!==priceToInput(so.price)) updateScoop(r.id,i,{price:parsePrice(e.target.value)}); }}/>
                        <button aria-label="Supprimer" style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:14}} onClick={()=>removeScoop(r.id,i)}>✕</button>
                      </div>
                    ))}
                  </div>
                  <button style={{...addBtn,padding:"6px 14px",fontSize:12}} onClick={()=>addScoop(r.id)}>+ Ajouter un format</button>
                </div>
              ))}

              {/* Listes */}
              {[
                {label:"🫙 Sauces",   items:sauces,   newVal:newSauce,   setNew:setNewSauce,   add:addSauce,   remove:s=>ps(sauces.filter(x=>x!==s)),   settings:saucesSettings,   saveSettings:saveSaucesSettings},
                {label:"🥗 Crudités", items:crudites, newVal:newCrudite, setNew:setNewCrudite, add:addCrudite, remove:c=>pc(crudites.filter(x=>x!==c)), settings:cruditesSettings, saveSettings:saveCruditesSettings},
                {label:"🥤 Boissons", items:boissons, newVal:newBoisson, setNew:setNewBoisson, add:addBoisson, remove:b=>pb(boissons.filter(x=>x!==b))},
              ].map(({label,items,newVal,setNew,add,remove,settings,saveSettings})=>(
                <div key={label} style={card}>
                  <h2 style={{...h2,marginBottom:14}}>{label}</h2>
                  <div style={{display:"flex",gap:8,marginBottom:14}}>
                    <input style={{...inp,flex:1}} value={newVal} onChange={e=>setNew(e.target.value)} onKeyDown={e=>e.key==="Enter"&&add()} placeholder="Nouveau…"/>
                    <button style={addBtn} onClick={add}>+ Ajouter</button>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
                    {items.map(item=>(
                      <div key={item} style={{background:T.bgTag,border:`1px solid ${T.borderLight}`,borderRadius:20,padding:"4px 8px 4px 12px",display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:13,color:T.text}}>{item}</span>
                        <button aria-label={"Retirer "+item} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:12}} onClick={()=>remove(item)}>✕</button>
                      </div>
                    ))}
                  </div>
                  {saveSettings && <ListSettingsEditor T={T} settings={settings} onChange={saveSettings}/>}
                </div>
              ))}

              {/* Suppléments */}
              <div style={card}>
                <h2 style={h2}>➕ Suppléments & catégories personnalisées</h2>
                <p style={helpS}>Chaque option peut avoir un prix (optionnel), ajouté aux totaux. Sans prix = inclus. Chaque catégorie a ses propres options (Tout, Tout sauf, Aucun…).</p>
                <div style={{background:T.bgHover,borderRadius:10,padding:"14px",marginBottom:16,border:`1px solid ${T.borderLight}`}}>
                  <input style={{...inp,marginBottom:10}} value={newExtraLabel} onChange={e=>setNewExtraLabel(e.target.value)} placeholder="Nom de la catégorie… (ex : Suppléments)"/>
                  <p style={{fontSize:12,color:T.textSub,marginBottom:6}}>Proposée pour :</p>
                  <div style={{display:"flex",gap:6,marginBottom:10,flexWrap:"wrap"}}>
                    {restaurants.map(r=><Pill key={r.id} T={T} label={r.emoji+" "+r.label} active={newExtraApplies.includes(r.id)} accent={r.accent} onClick={()=>setNewExtraApplies(p=>p.includes(r.id)?p.filter(x=>x!==r.id):[...p,r.id])}/>)}
                  </div>
                  <button style={{...addBtn,opacity:newExtraLabel&&newExtraApplies.length?1:0.5}} onClick={addExtraCategory}>+ Créer la catégorie</button>
                </div>
                {extras.map(ex=>(
                  <div key={ex.id} style={{borderLeft:`3px solid ${ex.accent}`,paddingLeft:14,marginBottom:20}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8,gap:8}}>
                      <div>
                        <span style={{fontSize:14,fontWeight:600,color:T.text}}>{ex.label}</span>
                        <span style={{marginLeft:8,fontSize:11.5,color:T.textSub}}>{(ex.appliesTo||[]).map(id=>findResto(restaurants,id)?.emoji).join(" ")}</span>
                      </div>
                      <button style={{background:T.red+"11",border:`1px solid ${T.red}33`,color:T.red,borderRadius:7,padding:"3px 8px",fontSize:11.5,cursor:"pointer"}} onClick={()=>removeExtraCategory(ex.id)}>Supprimer</button>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:6,marginBottom:8}}>
                      {(ex.options||[]).map(o=>{
                        const current=priceToInput(extraOptPrice(ex,o));
                        return (
                          <div key={o} style={{background:T.bgTag,border:`1px solid ${T.borderLight}`,borderRadius:20,padding:"3px 6px 3px 10px",display:"flex",alignItems:"center",gap:5}}>
                            <span style={{fontSize:12.5,color:T.text}}>{o}</span>
                            <span style={{fontSize:11,color:T.textFaint,marginLeft:2}}>€</span>
                            <input key={o+"_"+current} defaultValue={current} placeholder="0,00" inputMode="decimal" aria-label={"Prix de "+o}
                              onBlur={e=>{ if(e.target.value.trim()!==current) setExtraOptionPrice(ex.id,o,e.target.value); }} onKeyDown={e=>{ if(e.key==="Enter") e.target.blur(); }}
                              style={{width:54,background:T.bgCard,border:`1px solid ${T.border}`,borderRadius:12,color:T.text,padding:"2px 6px",fontSize:11.5,textAlign:"right"}}/>
                            <button aria-label={"Retirer "+o} style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:11}} onClick={()=>removeExtraOption(ex.id,o)}>✕</button>
                          </div>
                        );
                      })}
                    </div>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <input style={{...inp,flex:1,minWidth:140,padding:"6px 10px",fontSize:12.5}} value={newExtraOption[ex.id]||""} onChange={e=>setNewExtraOption(p=>({...p,[ex.id]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addExtraOption(ex.id)} placeholder="Nouvelle option… (ex : Fromage)"/>
                      <input style={{...inp,width:110,padding:"6px 10px",fontSize:12.5}} value={newExtraPrice[ex.id]||""} inputMode="decimal" onChange={e=>setNewExtraPrice(p=>({...p,[ex.id]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addExtraOption(ex.id)} placeholder="Prix € (opt.)"/>
                      <button style={{...addBtn,padding:"6px 12px",fontSize:12}} onClick={()=>addExtraOption(ex.id)}>+ Ajouter</button>
                    </div>
                    <ListSettingsEditor T={T} settings={ex.settings} onChange={s=>updateExtra(ex.id,e=>({...e,settings:s}))}/>
                  </div>
                ))}
              </div>

              {/* Citations */}
              <div style={card}>
                <h2 style={h2}>💬 Citations d'accueil</h2>
                <p style={helpS}>Une citation au hasard s'affiche en bandeau dans Commander. Aucune citation = pas de bandeau.</p>
                <div style={{display:"flex",gap:8,marginBottom:14}}>
                  <input style={{...inp,flex:1}} value={newQuote} onChange={e=>setNewQuote(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addQuote()} placeholder="Nouvelle citation…"/>
                  <button style={addBtn} onClick={addQuote}>+ Ajouter</button>
                </div>
                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                  {quotes.map((q,i)=>(
                    <div key={i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:T.bgHover,borderRadius:10,border:`1px solid ${T.borderLight}`}}>
                      <span style={{flex:1,fontSize:13,color:T.textSub,fontStyle:"italic"}}>« {q.text} »{q.author?` — ${q.author}`:""}</span>
                      <button aria-label="Supprimer" style={{background:"none",border:"none",color:T.red,cursor:"pointer",fontSize:12}} onClick={()=>pq(quotes.filter((_,j)=>j!==i))}>✕</button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Éditeur avancé */}
              <div style={card}>
                <h2 style={h2}>🧩 Éditeur avancé</h2>
                <p style={helpS}>Modifie directement n'importe quel document de configuration : restaurants (nom, couleurs, liens, sections, comportement des boutons), nom de l'application, etc. Un JSON invalide est refusé avant l'enregistrement.</p>
                <JsonEditor T={T} docs={[
                  {id:"restaurants", value:{list:restaurants}},
                  {id:"app",         value:appConfig},
                  {id:"members",     value:{list:members}},
                  {id:"quotes",      value:{list:quotes}},
                  {id:"sauces",      value:{list:sauces, settings:saucesSettings}},
                  {id:"crudites",    value:{list:crudites, settings:cruditesSettings}},
                  {id:"boissons",    value:{list:boissons}},
                  {id:"extras",      value:{list:extras}},
                ]}/>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}