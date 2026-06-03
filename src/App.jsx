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

const LUNCH_OPTIONS = [
  { id: "ice-cream",    label: "🍦 Ice Cream",    accent: "#ec4899" },
  { id: "snack-merode", label: "🥪 Snack Merode", accent: "#0891b2" },
  { id: "libanais",     label: "🥙 Libanais",     accent: "#16a34a" },
];

const DARK = {
  bg:"#0f0f13", bg2:"#16161f", bg3:"#1a1a28", border:"#2a2a38", border2:"#1c1c28",
  text:"#f1f1f5", textMuted:"#888", textFaint:"#555", scrollbar:"#3f3f52",
  rowHover:"#1c1c28", thBg:"#1a1a28", thColor:"#777", loginGrad:"linear-gradient(135deg,#0f0f13,#151528)",
};
const LIGHT = {
  bg:"#f5f5f7", bg2:"#ffffff", bg3:"#f0f0f5", border:"#dddde8", border2:"#e8e8f0",
  text:"#111118", textMuted:"#666", textFaint:"#aaa", scrollbar:"#ccccdd",
  rowHover:"#f0f0f8", thBg:"#ebebf5", thColor:"#555", loginGrad:"linear-gradient(135deg,#e8e8f5,#f5f5ff)",
};

function formatOrder(o) {
  if (!o?.choice) return "";
  const parts = [o.boules, o.snackType, o.frites];
  if (o.friteSup) parts.push("Frite sup. " + o.friteSup);
  if (o.crudites?.length) parts.push("Crudités: " + o.crudites.join(", "));
  if (o.sauces?.length) parts.push(o.sauces.join(", "));
  if (o.detail) parts.push(o.detail);
  return parts.filter(Boolean).join(" · ");
}

function makeCssGlobal(T) {
  return `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { background: ${T.bg}; }
    textarea { resize: vertical; }
    input:focus, textarea:focus, button:focus, select:focus { outline: none; }
    ::-webkit-scrollbar { width: 6px; }
    ::-webkit-scrollbar-thumb { background: ${T.scrollbar}; border-radius: 3px; }
    @keyframes fadeIn    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shake     { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
    @keyframes slideDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
    @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:0.3} }
    @keyframes toastIn   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
    tr.datarow:hover td  { background: ${T.rowHover}; }
  `;
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin, theme, toggleTheme, members }) {
  const [username, setUsername] = useState("");
  const [code, setCode]         = useState("");
  const [error, setError]       = useState("");
  const [shake, setShake]       = useState(false);
  const T = theme === "dark" ? DARK : LIGHT;
  const allUsers = [...members, ADMIN];

  const attempt = () => {
    const user = allUsers.find(u => u.username.toLowerCase() === username.toLowerCase() && u.code === code.trim());
    if (user) { onLogin(user.username); }
    else { setError("Nom ou code invalide."); setShake(true); setTimeout(() => setShake(false), 600); }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:T.loginGrad, fontFamily:"'DM Sans',sans-serif" }}>
      <style>{makeCssGlobal(T)}</style>
      <button onClick={toggleTheme} style={{ position:"fixed", top:16, right:16, background:T.bg2, border:"1px solid "+T.border, borderRadius:8, padding:"6px 12px", fontSize:16, cursor:"pointer", color:T.text }}>
        {theme==="dark"?"☀️":"🌙"}
      </button>
      <div style={{ background:T.bg2, border:"1px solid "+T.border, borderRadius:20, padding:"48px 40px", width:360, textAlign:"center", boxShadow:"0 24px 80px rgba(0,0,0,.2)", animation:shake?"shake 0.5s":"fadeIn 0.5s both" }}>
        <div style={{ fontSize:52, marginBottom:12 }}>🍽️</div>
        <h1 style={{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:28, color:T.text, marginBottom:6 }}>Lunch Orders</h1>
        <p style={{ color:T.textMuted, fontSize:14, marginBottom:32 }}>Connecte-toi pour commander</p>
        <div style={{ textAlign:"left", marginBottom:16 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:600, color:T.textMuted, marginBottom:6, letterSpacing:"0.08em", textTransform:"uppercase" }}>Nom</label>
          <select style={{ width:"100%", background:T.bg, border:"1px solid "+T.border, borderRadius:10, color:T.text, padding:"10px 14px", fontSize:14, fontFamily:"'DM Sans',sans-serif" }}
            value={username} onChange={e=>setUsername(e.target.value)}>
            <option value="">— Choisis ton nom —</option>
            {allUsers.map(u=><option key={u.username} value={u.username}>{u.username}</option>)}
          </select>
        </div>
        <div style={{ textAlign:"left", marginBottom:16 }}>
          <label style={{ display:"block", fontSize:11, fontWeight:600, color:T.textMuted, marginBottom:6, letterSpacing:"0.08em", textTransform:"uppercase" }}>Code</label>
          <input style={{ width:"100%", background:T.bg, border:"1px solid "+T.border, borderRadius:10, color:T.text, padding:"10px 14px", fontSize:14, fontFamily:"'DM Sans',sans-serif" }}
            type="password" value={code} placeholder="••••"
            onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()} />
        </div>
        {error && <p style={{ color:"#f87171", fontSize:13, marginBottom:10 }}>{error}</p>}
        <button style={{ width:"100%", background:T.text, color:T.bg, border:"none", borderRadius:10, padding:"12px 0", fontSize:15, fontWeight:700, fontFamily:"'Syne',sans-serif", cursor:"pointer", marginTop:8 }}
          onClick={attempt}>Entrer →</button>
        <p style={{ color:T.textFaint, fontSize:11, marginTop:18 }}>Ton code = ton numéro de poste 😉</p>
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
  const [history, setHistory]       = useState([]);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberCode, setNewMemberCode] = useState("");
  const [editingMember, setEditingMember] = useState(null); // { username, code }
  const [newSauce, setNewSauce]     = useState("");
  const [newCrudite, setNewCrudite] = useState("");
  const [tab, setTab]               = useState("order");
  const [status, setStatus]         = useState("connecting");
  const [savedMsg, setSavedMsg]     = useState(false);
  const [theme, setTheme]           = useState(() => localStorage.getItem("lunch_theme") || "dark");
  const detailTimers                = useRef({});
  const T = theme==="dark" ? DARK : LIGHT;

  const toggleTheme = () => {
    const next = theme==="dark" ? "light" : "dark";
    setTheme(next); localStorage.setItem("lunch_theme", next);
  };

  useEffect(() => {
    const unsubOrders   = onSnapshot(collection(db,"orders"),    snap=>{const d={};snap.forEach(s=>{d[s.id]=s.data();});setOrders(d);setStatus("live");}, ()=>setStatus("error"));
    const unsubMembers  = onSnapshot(doc(db,"config","members"), snap=>{if(snap.exists()&&snap.data().list)setMembers(snap.data().list);});
    const unsubSauces   = onSnapshot(doc(db,"config","sauces"),  snap=>{if(snap.exists()&&snap.data().list)setSauces(snap.data().list);});
    const unsubCrudites = onSnapshot(doc(db,"config","crudites"),snap=>{if(snap.exists()&&snap.data().list)setCrudites(snap.data().list);});
    const unsubFavs     = onSnapshot(collection(db,"favorites"), snap=>{const d={};snap.forEach(s=>{d[s.id]=s.data();});setFavorites(d);});
    const unsubHistory  = onSnapshot(collection(db,"history"),   snap=>{const days=[];snap.forEach(s=>days.push({id:s.id,...s.data()}));days.sort((a,b)=>b.id.localeCompare(a.id));setHistory(days);});
    return ()=>{unsubOrders();unsubMembers();unsubSauces();unsubCrudites();unsubFavs();unsubHistory();};
  }, []);

  useEffect(() => {
    if (!user||user==="Admin") return;
    const fav=favorites[user];
    if (!fav?.choice) return;
    const cur=orders[user];
    if (!cur?.choice) setDoc(doc(db,"orders",user),{...fav});
  }, [user,favorites]);

  if (!user) return <LoginScreen onLogin={setUser} theme={theme} toggleTheme={toggleTheme} members={members} />;

  const persistMembers  = async list=>{setMembers(list);  await setDoc(doc(db,"config","members"), {list});};
  const persistSauces   = async list=>{setSauces(list);   await setDoc(doc(db,"config","sauces"),  {list});};
  const persistCrudites = async list=>{setCrudites(list); await setDoc(doc(db,"config","crudites"),{list});};

  // sorted names: current user first, then rest in order
  const names = user==="Admin"
    ? members.map(m=>m.username)
    : [user, ...members.map(m=>m.username).filter(n=>n!==user)];

  // ── Member CRUD ───────────────────────────────────────────────────────────
  const addMember = async () => {
    const n=newMemberName.trim(), c=newMemberCode.trim();
    if (!n||!c||members.find(m=>m.username===n)) return;
    await persistMembers([...members,{username:n,code:c}]);
    setNewMemberName(""); setNewMemberCode("");
  };

  const removeMember = async name => {
    await persistMembers(members.filter(m=>m.username!==name));
    await deleteDoc(doc(db,"orders",name));
  };

  const startEdit = m => setEditingMember({...m});

  const saveEdit = async () => {
    if (!editingMember) return;
    const updated = members.map(m => m.username===editingMember.username ? editingMember : m);
    await persistMembers(updated);
    setEditingMember(null);
  };

  // ── Sauce / Crudite CRUD ──────────────────────────────────────────────────
  const addSauce    = async()=>{const s=newSauce.trim();   if(s&&!sauces.includes(s))   {await persistSauces([...sauces,s]);    setNewSauce("");}};
  const removeSauce = async s =>{await persistSauces(sauces.filter(x=>x!==s));};
  const addCrudite  = async()=>{const c=newCrudite.trim(); if(c&&!crudites.includes(c)) {await persistCrudites([...crudites,c]);setNewCrudite("");}};
  const removeCrudite=async c =>{await persistCrudites(crudites.filter(x=>x!==c));};

  // ── Order helpers ─────────────────────────────────────────────────────────
  const toggleChoice = async (name,choice)=>{
    const cur=orders[name]||{};
    if (cur.choice===choice){await deleteDoc(doc(db,"orders",name));}
    else{await setDoc(doc(db,"orders",name),{choice,detail:"",sauces:[],crudites:[],boules:"",snackType:"",frites:"",friteSup:""});}
  };

  const handleDetail=(name,detail)=>{
    setOrders(prev=>({...prev,[name]:{...prev[name],detail}}));
    clearTimeout(detailTimers.current[name]);
    detailTimers.current[name]=setTimeout(async()=>{
      const cur=orders[name]||{};
      if(!cur.choice)return;
      await setDoc(doc(db,"orders",name),{...cur,detail});
    },600);
  };

  const handleSubDetail=async(name,field,value)=>{
    const cur=orders[name]||{};
    if(!cur.choice)return;
    const updated={...cur,[field]:value};
    setOrders(prev=>({...prev,[name]:updated}));
    await setDoc(doc(db,"orders",name),updated);
  };

  const toggleMulti=async(name,field,value)=>{
    const cur=orders[name]||{};
    if(!cur.choice)return;
    const current=cur[field]||[];
    const updated=current.includes(value)?current.filter(x=>x!==value):[...current,value];
    const newOrder={...cur,[field]:updated};
    setOrders(prev=>({...prev,[name]:newOrder}));
    await setDoc(doc(db,"orders",name),newOrder);
  };

  const saveFavorite=async name=>{
    const cur=orders[name];
    if(!cur?.choice)return;
    await setDoc(doc(db,"favorites",name),{...cur});
    setSavedMsg(true); setTimeout(()=>setSavedMsg(false),2500);
  };

  const resetAll=async()=>{
    if(!window.confirm("Archiver et effacer toutes les commandes du jour ?"))return;
    const today=new Date().toISOString().slice(0,10);
    const snapshot={};
    members.map(m=>m.username).forEach(n=>{if(orders[n]?.choice)snapshot[n]=orders[n];});
    if(Object.keys(snapshot).length>0) await setDoc(doc(db,"history",today),{date:today,orders:snapshot});
    await Promise.all(members.map(m=>deleteDoc(doc(db,"orders",m.username))));
  };

  const deleteHistory=async id=>{
    if(!window.confirm("Supprimer cet historique ?"))return;
    await deleteDoc(doc(db,"history",id));
  };

  const totalOrdered=names.filter(n=>orders[n]?.choice).length;
  const notOrdered=names.filter(n=>!orders[n]?.choice);
  const counts=LUNCH_OPTIONS.reduce((a,o)=>{a[o.id]=names.filter(n=>orders[n]?.choice===o.id).length;return a;},{});

  const pill=(accent,active,disabled)=>({
    background:active?accent:T.bg3, border:"1px solid "+(active?accent:T.border),
    borderRadius:20, padding:"3px 10px", fontSize:12, color:active?"#fff":T.textMuted,
    cursor:disabled?"not-allowed":"pointer", transition:"all 0.15s", fontFamily:"inherit",
    whiteSpace:"nowrap", opacity:disabled?0.35:1,
  });

  const inp={background:T.bg,border:"1px solid "+T.border,borderRadius:10,color:T.text,padding:"10px 14px",fontSize:14,fontFamily:"'DM Sans',sans-serif"};
  const addBtn={background:T.text,color:T.bg,border:"none",borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Syne',sans-serif",whiteSpace:"nowrap"};
  const secTitle={fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,marginBottom:18,color:T.text,display:"flex",alignItems:"center",gap:12};
  const tdStyle={padding:"10px 16px",verticalAlign:"middle",borderBottom:"1px solid "+T.border2};
  const thStyle={background:T.thBg,color:T.thColor,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",padding:"12px 16px",textAlign:"left",borderBottom:"1px solid "+T.border};

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'DM Sans',sans-serif",color:T.text}}>
      <style>{makeCssGlobal(T)}</style>

      {/* Header */}
      <header style={{background:T.bg2,borderBottom:"1px solid "+T.border,position:"sticky",top:0,zIndex:100}}>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"14px 24px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <span style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:20,color:T.text}}>🍽️ Lunch Orders</span>
          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <span style={{fontSize:12,color:status==="live"?"#22c55e":status==="error"?"#f87171":"#f59e0b"}}>
              {status==="live"?"● En direct":status==="error"?"● Erreur":"⟳ Connexion…"}
            </span>
            <button onClick={toggleTheme} style={{background:T.bg3,border:"1px solid "+T.border,borderRadius:8,padding:"5px 10px",fontSize:15,cursor:"pointer",color:T.text}}>
              {theme==="dark"?"☀️":"🌙"}
            </button>
            <span style={{fontSize:13,color:T.textMuted}}>👤 {user}</span>
            <button style={{background:"transparent",border:"1px solid "+T.border,color:T.textMuted,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer"}}
              onClick={()=>setUser(null)}>Déconnexion</button>
          </div>
        </div>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"0 24px",display:"flex"}}>
          {[["order","📋 Commander"],["summary","📊 Résumé"],["history","📅 Historique"],["settings","⚙️ Config"]].map(([id,label])=>(
            <button key={id} style={{background:"transparent",border:"none",color:tab===id?T.text:T.textMuted,padding:"10px 18px",fontSize:13,fontWeight:600,cursor:"pointer",borderBottom:tab===id?"2px solid "+T.text:"2px solid transparent",fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s"}}
              onClick={()=>setTab(id)}>{label}</button>
          ))}
        </div>
      </header>

      <main style={{maxWidth:1200,margin:"0 auto",padding:"32px 24px"}}>

        {/* ════ ORDER TAB ════ */}
        {tab==="order" && (
          <div style={{animation:"slideDown 0.3s ease"}}>

            {/* Favori banner */}
            {user!=="Admin" && favorites[user]?.choice && (
              <div style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:12,padding:"12px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",gap:12,marginBottom:24}}>
                <span style={{fontSize:13,color:T.textMuted}}>⭐ Ton favori : <strong style={{color:T.text}}>{formatOrder(favorites[user])}</strong></span>
                <button style={{background:"#f59e0b22",border:"1px solid #f59e0b55",color:"#f59e0b",borderRadius:8,padding:"5px 12px",fontSize:12,cursor:"pointer",whiteSpace:"nowrap"}}
                  onClick={async()=>{await setDoc(doc(db,"orders",user),{...favorites[user]});}}>Recharger</button>
              </div>
            )}

            {/* Table */}
            <div style={{marginBottom:40}}>
              <h2 style={secTitle}>
                Commandes du jour
                <span style={{background:T.bg3,color:T.textMuted,fontSize:12,padding:"3px 10px",borderRadius:20}}>{totalOrdered} / {names.length}</span>
              </h2>
              <div style={{overflowX:"auto",borderRadius:14,border:"1px solid "+T.border}}>
                <table style={{width:"100%",borderCollapse:"collapse",minWidth:820}}>
                  <thead>
                    <tr>
                      <th style={{...thStyle,width:50,textAlign:"center"}}>#</th>
                      <th style={{...thStyle,width:160}}>Nom</th>
                      {LUNCH_OPTIONS.map(o=><th key={o.id} style={thStyle}>{o.label}</th>)}
                      <th style={thStyle}>Détails</th>
                      <th style={{...thStyle,width:44}}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {names.map((name,idx)=>{
                      const order  = orders[name]||{};
                      const chosen = LUNCH_OPTIONS.find(o=>o.id===order.choice);
                      const canEdit= user===name || user==="Admin";
                      const isMe   = user===name;
                      return (
                        <tr key={name} className="datarow" style={isMe?{background:T.bg3}:{}}>
                          {/* # */}
                          <td style={{...tdStyle,textAlign:"center"}}>
                            <span style={{fontSize:13,fontWeight:700,color:isMe?"#f59e0b":T.textFaint}}>{idx+1}</span>
                          </td>
                          {/* Nom */}
                          <td style={tdStyle}>
                            <div style={{display:"flex",alignItems:"center",gap:10}}>
                              <div style={{width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0,background:chosen?chosen.accent+"28":T.bg3,color:chosen?chosen.accent:T.textMuted}}>
                                {name[0].toUpperCase()}
                              </div>
                              <div>
                                <span style={{fontSize:14,fontWeight:isMe?700:500,color:isMe?"#f59e0b":T.text}}>{name}</span>
                                {isMe && <span style={{display:"block",fontSize:10,color:T.textFaint}}>● toi</span>}
                              </div>
                            </div>
                          </td>

                          {/* Choix */}
                          {LUNCH_OPTIONS.map(opt=>(
                            <td key={opt.id} style={{...tdStyle,textAlign:"center"}}>
                              <button style={{width:34,height:34,borderRadius:8,border:"1px solid "+(order.choice===opt.id?opt.accent:T.border),background:order.choice===opt.id?opt.accent:T.bg3,color:order.choice===opt.id?"#fff":T.textMuted,fontSize:15,cursor:canEdit?"pointer":"not-allowed",transition:"all 0.18s",opacity:canEdit?1:0.35}}
                                onClick={()=>canEdit&&toggleChoice(name,opt.id)}>
                                {order.choice===opt.id?"✓":"○"}
                              </button>
                            </td>
                          ))}

                          {/* Détails */}
                          <td style={tdStyle}>
                            {!order.choice && <span style={{fontSize:12,color:T.textFaint}}>{canEdit?"Choisis d'abord":"🔒"}</span>}

                            {order.choice==="ice-cream" && (
                              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                                <div style={{display:"flex",gap:6}}>
                                  {["1 boule","2 boules"].map(opt=>(
                                    <button key={opt} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"boules",order.boules===opt?"":opt)} style={pill("#ec4899",order.boules===opt,!canEdit)}>{opt}</button>
                                  ))}
                                </div>
                                <textarea style={{width:"100%",background:T.bg,border:"1px solid #ec489966",borderRadius:8,color:T.text,padding:"8px 10px",fontSize:13,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5,opacity:canEdit?1:0.35}}
                                  rows={1} disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)} placeholder={canEdit?"Parfum(s)…":"🔒"} />
                              </div>
                            )}

                            {order.choice==="snack-merode" && (
                              <div style={{display:"flex",flexDirection:"column",gap:6}}>
                                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                                  {["Durum","Bicky"].map(opt=>(
                                    <button key={opt} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"snackType",order.snackType===opt?"":opt)} style={pill("#0891b2",order.snackType===opt,!canEdit)}>{opt}</button>
                                  ))}
                                </div>
                                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                                  {["Frite dedans","Frite à part"].map(opt=>(
                                    <button key={opt} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"frites",order.frites===opt?"":opt)} style={pill("#f59e0b",order.frites===opt,!canEdit)}>{opt}</button>
                                  ))}
                                </div>
                                {/* Frite supplémentaire */}
                                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center"}}>
                                  <span style={{fontSize:12,color:T.textMuted,width:"100%"}}>Frite sup. :</span>
                                  {["Petite","Moyenne","Grande"].map(opt=>(
                                    <button key={opt} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"friteSup",order.friteSup===opt?"":opt)} style={pill("#f97316",order.friteSup===opt,!canEdit)}>{opt}</button>
                                  ))}
                                </div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                                  <span style={{fontSize:12,color:T.textMuted,width:"100%"}}>Crudités :</span>
                                  {crudites.map(c=>(
                                    <button key={c} disabled={!canEdit} onClick={()=>canEdit&&toggleMulti(name,"crudites",c)} style={pill("#16a34a",(order.crudites||[]).includes(c),!canEdit)}>{c}</button>
                                  ))}
                                </div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                                  <span style={{fontSize:12,color:T.textMuted,width:"100%"}}>Sauces :</span>
                                  {sauces.map(s=>(
                                    <button key={s} disabled={!canEdit} onClick={()=>canEdit&&toggleMulti(name,"sauces",s)} style={pill("#7c3aed",(order.sauces||[]).includes(s),!canEdit)}>{s}</button>
                                  ))}
                                </div>
                                <textarea style={{width:"100%",background:T.bg,border:"1px solid #0891b266",borderRadius:8,color:T.text,padding:"8px 10px",fontSize:13,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5,opacity:canEdit?1:0.35}}
                                  rows={1} disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)} placeholder={canEdit?"Commentaire…":"🔒"} />
                              </div>
                            )}

                            {order.choice==="libanais" && (
                              <textarea style={{width:"100%",background:T.bg,border:"1px solid #16a34a66",borderRadius:8,color:T.text,padding:"8px 10px",fontSize:13,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5,opacity:canEdit?1:0.35}}
                                rows={2} disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)} placeholder={canEdit?"Précise ta commande…":"🔒"} />
                            )}
                          </td>

                          {/* Supprimer */}
                          <td style={{...tdStyle,textAlign:"center"}}>
                            {user==="Admin" && (
                              <button style={{background:"transparent",border:"none",color:T.textFaint,fontSize:16,cursor:"pointer",padding:4,borderRadius:6}} onClick={()=>removeMember(name)}>✕</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ════ SUMMARY TAB ════ */}
        {tab==="summary" && (
          <div style={{animation:"slideDown 0.3s ease"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,color:T.text}}>Résumé des commandes</h2>
              <button style={{background:T.bg2,color:"#f87171",border:"1px solid "+T.border,borderRadius:10,padding:"8px 16px",fontSize:13,cursor:"pointer"}} onClick={resetAll}>🗑 Réinitialiser le jour</button>
            </div>

            <div style={{display:"flex",gap:16,marginBottom:28,flexWrap:"wrap"}}>
              {LUNCH_OPTIONS.map(opt=>(
                <div key={opt.id} style={{flex:1,minWidth:140,background:T.bg2,border:"1px solid "+opt.accent,borderRadius:14,padding:"20px 24px",textAlign:"center"}}>
                  <div style={{fontSize:48,fontWeight:800,fontFamily:"'Syne',sans-serif",color:opt.accent,lineHeight:1}}>{counts[opt.id]}</div>
                  <div style={{fontSize:14,color:T.textMuted,marginTop:6}}>{opt.label}</div>
                </div>
              ))}
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:14}}>
              {LUNCH_OPTIONS.map(opt=>{
                const people=names.filter(n=>orders[n]?.choice===opt.id);
                if(!people.length)return null;
                return (
                  <div key={opt.id} style={{background:T.bg2,border:"1px solid "+T.border,borderLeft:"3px solid "+opt.accent,borderRadius:12,padding:"16px 20px"}}>
                    <h3 style={{fontSize:14,fontWeight:700,color:opt.accent,marginBottom:12,fontFamily:"'Syne',sans-serif"}}>{opt.label}</h3>
                    {people.map((name,idx)=>(
                      <div key={name} style={{display:"flex",gap:12,alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+T.border2}}>
                        <span style={{fontSize:12,fontWeight:700,color:T.textFaint,minWidth:24,textAlign:"right"}}>{idx+1}.</span>
                        <span style={{fontSize:13,fontWeight:600,minWidth:120,color:T.text}}>{name}</span>
                        <span style={{fontSize:13,color:T.textMuted,flex:1}}>{formatOrder(orders[name])||<em style={{opacity:0.4}}>Aucun détail</em>}</span>
                        {name===user && (
                          <button style={{background:"transparent",border:"none",fontSize:16,cursor:"pointer",padding:"2px 6px",color:formatOrder(favorites[name])===formatOrder(orders[name])?"#f59e0b":"#aaa",flexShrink:0}}
                            onClick={()=>saveFavorite(name)} title="Sauvegarder comme favori">⭐</button>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
              {totalOrdered===0 && <p style={{color:T.textFaint,textAlign:"center",padding:48}}>Aucune commande pour l'instant.</p>}
            </div>

            {notOrdered.length>0 && (
              <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",marginTop:24,padding:"14px 18px",background:T.bg2,border:"1px solid "+T.border,borderRadius:12}}>
                <span style={{color:T.textMuted,fontSize:13}}>⏳ Pas encore commandé :</span>
                {notOrdered.map(n=><span key={n} style={{background:T.bg3,color:T.textMuted,fontSize:12,padding:"3px 10px",borderRadius:20}}>{n}</span>)}
              </div>
            )}

            {savedMsg && (
              <div style={{position:"fixed",bottom:32,left:"50%",transform:"translateX(-50%)",background:T.bg2,border:"1px solid #f59e0b55",color:"#f59e0b",borderRadius:12,padding:"12px 24px",fontSize:14,animation:"toastIn 0.3s ease",zIndex:999}}>
                ⭐ Commande sauvegardée comme favori !
              </div>
            )}
          </div>
        )}

        {/* ════ HISTORY TAB ════ */}
        {tab==="history" && (
          <div style={{animation:"slideDown 0.3s ease"}}>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,marginBottom:24,color:T.text}}>📅 Historique des commandes</h2>
            {history.length===0 && (
              <p style={{color:T.textFaint,textAlign:"center",padding:48}}>Aucun historique pour l'instant.<br/>Les commandes sont archivées lors de la réinitialisation.</p>
            )}
            {history.map(day=>{
              const visibleOrders=user==="Admin"
                ? Object.entries(day.orders||{})
                : Object.entries(day.orders||{}).filter(([name])=>name===user);
              if(!visibleOrders.length)return null;
              return (
                <div key={day.id} style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:14,padding:"20px 24px",marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                    <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:T.text}}>
                      📆 {new Date(day.id).toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}
                    </h3>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <span style={{background:T.bg3,color:T.textMuted,fontSize:12,padding:"3px 10px",borderRadius:20}}>
                        {visibleOrders.length} commande{visibleOrders.length>1?"s":""}
                      </span>
                      {user==="Admin" && (
                        <button style={{background:"transparent",border:"1px solid #f8717155",color:"#f87171",borderRadius:8,padding:"4px 10px",fontSize:12,cursor:"pointer"}}
                          onClick={()=>deleteHistory(day.id)}>🗑 Supprimer</button>
                      )}
                    </div>
                  </div>
                  {LUNCH_OPTIONS.map(opt=>{
                    const people=visibleOrders.filter(([,o])=>o.choice===opt.id);
                    if(!people.length)return null;
                    return (
                      <div key={opt.id} style={{marginBottom:12,paddingLeft:12,borderLeft:"3px solid "+opt.accent}}>
                        <div style={{fontSize:13,fontWeight:600,color:opt.accent,marginBottom:6}}>{opt.label}</div>
                        {people.map(([name,o],idx)=>(
                          <div key={name} style={{display:"flex",gap:12,padding:"5px 0",borderBottom:"1px solid "+T.border2,alignItems:"center"}}>
                            <span style={{fontSize:12,fontWeight:700,color:T.textFaint,minWidth:24,textAlign:"right"}}>{idx+1}.</span>
                            <span style={{fontSize:13,fontWeight:600,minWidth:120,color:T.text}}>{name}</span>
                            <span style={{fontSize:13,color:T.textMuted}}>{formatOrder(o)||<em style={{opacity:0.4}}>Aucun détail</em>}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {/* ════ CONFIG TAB ════ */}
        {tab==="settings" && (
          <div style={{animation:"slideDown 0.3s ease"}}>
            {user!=="Admin" ? (
              <div style={{textAlign:"center",color:T.textFaint,padding:60}}>🔒 Réservé à l'Admin</div>
            ) : (
              <div>

                {/* Membres */}
                <div style={{marginBottom:40}}>
                  <h2 style={secTitle}>👥 Gérer les membres</h2>
                  <div style={{display:"flex",gap:10,marginBottom:20,flexWrap:"wrap"}}>
                    <input style={{...inp,flex:2,minWidth:140}} value={newMemberName} onChange={e=>setNewMemberName(e.target.value)} placeholder="Nom…" />
                    <input style={{...inp,flex:1,minWidth:100}} value={newMemberCode} onChange={e=>setNewMemberCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addMember()} placeholder="Code…" />
                    <button style={addBtn} onClick={addMember}>+ Ajouter</button>
                  </div>
                  <div style={{display:"flex",flexDirection:"column",gap:8}}>
                    {members.map(m=>(
                      <div key={m.username} style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:10,padding:"10px 16px"}}>
                        {editingMember?.username===m.username ? (
                          /* Edit mode */
                          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                            <input style={{...inp,flex:2,minWidth:120,padding:"6px 12px",fontSize:13}} value={editingMember.username}
                              onChange={e=>setEditingMember({...editingMember,username:e.target.value})} placeholder="Nom…" />
                            <input style={{...inp,flex:1,minWidth:80,padding:"6px 12px",fontSize:13}} value={editingMember.code}
                              onChange={e=>setEditingMember({...editingMember,code:e.target.value})} placeholder="Code…" />
                            <button style={{...addBtn,padding:"6px 14px",fontSize:13,background:"#22c55e"}} onClick={saveEdit}>✓ Sauver</button>
                            <button style={{background:"transparent",border:"1px solid "+T.border,color:T.textMuted,borderRadius:8,padding:"6px 12px",fontSize:13,cursor:"pointer"}} onClick={()=>setEditingMember(null)}>Annuler</button>
                          </div>
                        ) : (
                          /* View mode */
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <div style={{display:"flex",alignItems:"center",gap:12}}>
                              <div style={{width:32,height:32,borderRadius:8,background:T.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:T.textMuted}}>
                                {m.username[0].toUpperCase()}
                              </div>
                              <div>
                                <span style={{fontSize:14,fontWeight:500,color:T.text}}>{m.username}</span>
                                <span style={{marginLeft:12,fontSize:12,color:T.textMuted,background:T.bg3,padding:"2px 8px",borderRadius:20}}>code : {m.code}</span>
                              </div>
                            </div>
                            <div style={{display:"flex",gap:8}}>
                              <button style={{background:"transparent",border:"1px solid "+T.border,color:T.textMuted,borderRadius:8,padding:"4px 10px",fontSize:12,cursor:"pointer"}} onClick={()=>startEdit(m)}>✏️ Modifier</button>
                              <button style={{background:"transparent",border:"none",color:"#f87171",cursor:"pointer",fontSize:16,padding:4}} onClick={()=>removeMember(m.username)}>✕</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Sauces */}
                <div style={{marginBottom:40}}>
                  <h2 style={secTitle}>🥫 Gérer les sauces</h2>
                  <div style={{display:"flex",gap:10,marginBottom:20}}>
                    <input style={{...inp,flex:1}} value={newSauce} onChange={e=>setNewSauce(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addSauce()} placeholder="Nouvelle sauce…" />
                    <button style={addBtn} onClick={addSauce}>+ Ajouter</button>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {sauces.map(s=>(
                      <div key={s} style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:20,padding:"5px 12px",display:"flex",alignItems:"center",gap:4}}>
                        <span style={{fontSize:13,color:T.text}}>{s}</span>
                        <button style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:14,padding:"0 0 0 6px"}} onClick={()=>removeSauce(s)}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Crudités */}
                <div style={{marginBottom:40}}>
                  <h2 style={secTitle}>🥗 Gérer les crudités</h2>
                  <div style={{display:"flex",gap:10,marginBottom:20}}>
                    <input style={{...inp,flex:1}} value={newCrudite} onChange={e=>setNewCrudite(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addCrudite()} placeholder="Nouvelle crudité…" />
                    <button style={addBtn} onClick={addCrudite}>+ Ajouter</button>
                  </div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                    {crudites.map(c=>(
                      <div key={c} style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:20,padding:"5px 12px",display:"flex",alignItems:"center",gap:4}}>
                        <span style={{fontSize:13,color:T.text}}>{c}</span>
                        <button style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:14,padding:"0 0 0 6px"}} onClick={()=>removeCrudite(c)}>✕</button>
                      </div>
                    ))}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

      </main>
    </div>
  );
}