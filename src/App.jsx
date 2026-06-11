import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection, addDoc } from "firebase/firestore";

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
const DEFAULT_EXTRAS = [];

const LUNCH_OPTIONS = [
  { id: "ice-cream",    label: "🍦 Ice Cream",    accent: "#ec4899" },
  { id: "snack-merode", label: "🥪 Snack Merode", accent: "#0891b2" },
  { id: "libanais",     label: "🥙 Libanais",     accent: "#16a34a" },
];

const EXTRA_ACCENTS = ["#8b5cf6","#f97316","#06b6d4","#84cc16","#f43f5e","#a78bfa"];

const DARK  = { bg:"#0f0f13",bg2:"#16161f",bg3:"#1a1a28",border:"#2a2a38",border2:"#1c1c28",text:"#f1f1f5",textMuted:"#888",textFaint:"#555",scrollbar:"#3f3f52",rowHover:"#1c1c28",thBg:"#1a1a28",thColor:"#777",loginGrad:"linear-gradient(135deg,#0f0f13,#151528)" };
const LIGHT = { bg:"#f5f5f7",bg2:"#ffffff",bg3:"#f0f0f5",border:"#dddde8",border2:"#e8e8f0",text:"#111118",textMuted:"#666",textFaint:"#aaa",scrollbar:"#ccccdd",rowHover:"#f0f0f8",thBg:"#ebebf5",thColor:"#555",loginGrad:"linear-gradient(135deg,#e8e8f5,#f5f5ff)" };

const TZATZIKI_RECIPE = {
  name: "Tzatziki",
  description: "La sauce grecque fraîche et crémeuse, parfaite en dip ou en accompagnement.",
  category: "Sauce",
  servings: 4,
  prepTime: 15,
  totalTime: 45,
  ingredients: [
    "500 g de yaourt grec entier",
    "1 concombre",
    "2 gousses d'ail",
    "2 c. à soupe d'huile d'olive",
    "1 c. à soupe de jus de citron",
    "2 c. à soupe d'aneth frais (ou menthe)",
    "½ c. à café de sel",
    "1 pincée de poivre noir",
  ],
  steps: [
    { title: "Préparer le concombre", text: "Râpez le concombre à gros trous. Saupoudrez de sel et laissez dégorger 10 min dans une passoire, puis pressez pour enlever l'excès d'eau." },
    { title: "Préparer l'ail", text: "Pelez et écrasez finement les gousses d'ail." },
    { title: "Mélanger", text: "Dans un bol, mélangez le yaourt, le concombre, l'ail, l'huile d'olive, le citron et l'aneth ciselé. Poivrez." },
    { title: "Reposer au frais", text: "Couvrez et réfrigérez au moins 30 minutes pour que les saveurs se développent." },
    { title: "Servir", text: "Versez dans un bol, faites un creux au centre, ajoutez un filet d'huile d'olive et quelques brins d'aneth. Servez frais avec du pain pita ou des crudités." },
  ],
  notes: "💡 Le secret : bien égoutter le concombre. Préférez un yaourt grec épais type Total.",
  createdAt: new Date().toISOString(),
};

function formatCrudites(order, allCrudites) {
  if (!order.crudites?.length) return null;
  if (order.cruditesTout) {
    const excl = allCrudites.filter(c => !order.crudites.includes(c));
    return excl.length > 0 ? "Tout sauf: "+excl.join(", ") : "Toutes crudités";
  }
  return "Crudités: "+order.crudites.join(", ");
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
    if (o.boisson) lines.push({ emoji:"🥤", text: o.boisson });
    extras.filter(ex=>ex.appliesTo?.includes("ice-cream")).forEach(ex=>{
      const sel=(o.extras||{})[ex.id]||[];
      sel.forEach(opt=>lines.push({ emoji:"➕", text: opt }));
    });
  } else {
    if (o.detail)  lines.push({ emoji:"🥙", text: o.detail });
    if (o.boisson) lines.push({ emoji:"🥤", text: o.boisson });
    extras.filter(ex=>ex.appliesTo?.includes("libanais")).forEach(ex=>{
      const sel=(o.extras||{})[ex.id]||[];
      sel.forEach(opt=>lines.push({ emoji:"➕", text: opt }));
    });
  }
  return lines;
}

function formatOrder(o, extras=[], allCrudites=[]) {
  return formatOrderFull(o, extras, allCrudites).map(l=>l.text).join(" · ");
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
  const T = theme==="dark" ? DARK : LIGHT;
  const allUsers = [...members, ADMIN];

  const attempt = () => {
    const user = allUsers.find(u=>u.username.toLowerCase()===username.toLowerCase()&&u.code===code.trim());
    if (user) { onLogin(user.username); }
    else { setError("Nom ou code invalide."); setShake(true); setTimeout(()=>setShake(false),600); }
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:T.loginGrad,fontFamily:"'DM Sans',sans-serif"}}>
      <style>{makeCssGlobal(T)}</style>
      <button onClick={toggleTheme} style={{position:"fixed",top:16,right:16,background:T.bg2,border:"1px solid "+T.border,borderRadius:8,padding:"6px 12px",fontSize:16,cursor:"pointer",color:T.text}}>
        {theme==="dark"?"☀️":"🌙"}
      </button>
      <div style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:20,padding:"48px 40px",width:360,textAlign:"center",boxShadow:"0 24px 80px rgba(0,0,0,.2)",animation:shake?"shake 0.5s":"fadeIn 0.5s both"}}>
        <div style={{fontSize:52,marginBottom:12}}>🍽️</div>
        <h1 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:28,color:T.text,marginBottom:6}}>Lunch Orders</h1>
        <p style={{color:T.textMuted,fontSize:14,marginBottom:32}}>Connecte-toi pour commander</p>
        <div style={{textAlign:"left",marginBottom:16}}>
          <label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:6,letterSpacing:"0.08em",textTransform:"uppercase"}}>Nom</label>
          <select style={{width:"100%",background:T.bg,border:"1px solid "+T.border,borderRadius:10,color:T.text,padding:"10px 14px",fontSize:14,fontFamily:"'DM Sans',sans-serif"}}
            value={username} onChange={e=>setUsername(e.target.value)}>
            <option value="">— Choisis ton nom —</option>
            {allUsers.map(u=><option key={u.username} value={u.username}>{u.username}</option>)}
          </select>
        </div>
        <div style={{textAlign:"left",marginBottom:16}}>
          <label style={{display:"block",fontSize:11,fontWeight:600,color:T.textMuted,marginBottom:6,letterSpacing:"0.08em",textTransform:"uppercase"}}>Code</label>
          <input style={{width:"100%",background:T.bg,border:"1px solid "+T.border,borderRadius:10,color:T.text,padding:"10px 14px",fontSize:14,fontFamily:"'DM Sans',sans-serif"}}
            type="password" value={code} placeholder="••••" onChange={e=>setCode(e.target.value)} onKeyDown={e=>e.key==="Enter"&&attempt()} />
        </div>
        {error && <p style={{color:"#f87171",fontSize:13,marginBottom:10}}>{error}</p>}
        <button style={{width:"100%",background:T.text,color:T.bg,border:"none",borderRadius:10,padding:"12px 0",fontSize:15,fontWeight:700,fontFamily:"'Syne',sans-serif",cursor:"pointer",marginTop:8}} onClick={attempt}>Entrer →</button>
        <p style={{color:T.textFaint,fontSize:11,marginTop:18}}>Ton code = ton numéro de poste 😉</p>
      </div>
    </div>
  );
}

// ── Cookido Tab ───────────────────────────────────────────────────────────────
function CookidoTab({ T, isMobile }) {
  const [recipes, setRecipes]         = useState([]);
  const [selectedRecipe, setSelected] = useState(null);
  const [showForm, setShowForm]       = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [copiedLink, setCopiedLink]   = useState(false);
  const [form, setForm] = useState({
    name:"", description:"", category:"", servings:4,
    prepTime:"", totalTime:"", ingredients:[""], steps:[{title:"",text:""}], notes:"",
  });

  // Hash routing: #cookido/ID
  const openRecipe = (recipe) => {
    setSelected(recipe);
    window.location.hash = "cookido/" + recipe.id;
  };
  const closeRecipe = () => {
    setSelected(null);
    window.location.hash = "cookido";
  };
  const copyLink = () => {
    const url = window.location.origin + window.location.pathname + "#cookido/" + selectedRecipe.id;
    navigator.clipboard.writeText(url).then(()=>{ setCopiedLink(true); setTimeout(()=>setCopiedLink(false),2000); });
  };

  useEffect(()=>{
    const unsub = onSnapshot(collection(db,"cookido"), snap=>{
      const list = [];
      snap.forEach(s => list.push({ id:s.id, ...s.data() }));
      list.sort((a,b)=>(a.createdAt||"").localeCompare(b.createdAt||""));
      setRecipes(list);
      setInitialized(true);
    });
    return ()=>unsub();
  },[]);

  // On mount: check if URL hash points to a recipe
  useEffect(()=>{
    const hash = window.location.hash.replace("#","");
    if (hash.startsWith("cookido/")) {
      const id = hash.split("/")[1];
      if (id && recipes.length > 0) {
        const found = recipes.find(r=>r.id===id);
        if (found) setSelected(found);
      }
    }
  },[recipes]);

  useEffect(()=>{
    if (initialized && recipes.length===0) {
      addDoc(collection(db,"cookido"), TZATZIKI_RECIPE);
    }
  },[initialized, recipes.length]);

  const saveRecipe = async () => {
    if (!form.name.trim()) return;
    const data = {
      ...form,
      ingredients: form.ingredients.filter(i=>i.trim()),
      steps: form.steps.filter(s=>s.title.trim()||s.text.trim()),
      servings: Number(form.servings)||4,
      prepTime: Number(form.prepTime)||0,
      totalTime: Number(form.totalTime)||0,
      createdAt: new Date().toISOString(),
    };
    await addDoc(collection(db,"cookido"), data);
    setShowForm(false);
    setForm({ name:"", description:"", category:"", servings:4, prepTime:"", totalTime:"", ingredients:[""], steps:[{title:"",text:""}], notes:"" });
  };

  const deleteRecipe = async (id) => {
    if (!window.confirm("Supprimer cette recette ?")) return;
    await deleteDoc(doc(db,"cookido",id));
    if (selectedRecipe?.id===id) closeRecipe();
  };

  const updateIngredient = (i,val) => { const l=[...form.ingredients]; l[i]=val; setForm(f=>({...f,ingredients:l})); };
  const addIngredient    = ()    => setForm(f=>({...f,ingredients:[...f.ingredients,""]}));
  const removeIngredient = (i)   => setForm(f=>({...f,ingredients:f.ingredients.filter((_,idx)=>idx!==i)}));
  const updateStep  = (i,field,val) => { const l=[...form.steps]; l[i]={...l[i],[field]:val}; setForm(f=>({...f,steps:l})); };
  const addStep     = ()            => setForm(f=>({...f,steps:[...f.steps,{title:"",text:""}]}));
  const removeStep  = (i)           => setForm(f=>({...f,steps:f.steps.filter((_,idx)=>idx!==i)}));

  const inp = {background:T.bg,border:"1px solid "+T.border,borderRadius:10,color:T.text,padding:"8px 12px",fontSize:13,fontFamily:"'DM Sans',sans-serif",width:"100%"};
  const addBtn = {background:T.text,color:T.bg,border:"none",borderRadius:10,padding:"10px 20px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Syne',sans-serif"};
  const accent = "#f97316";

  if (selectedRecipe) return (
    <div style={{animation:"slideDown 0.3s ease"}}>
      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:20}}>
        <button onClick={closeRecipe} style={{background:"transparent",border:"1px solid "+T.border,color:T.textMuted,borderRadius:8,padding:"6px 14px",fontSize:13,cursor:"pointer"}}>← Retour</button>
        <button onClick={copyLink} style={{background:copiedLink?accent+"22":"transparent",border:"1px solid "+(copiedLink?accent+"55":T.border),color:copiedLink?accent:T.textMuted,borderRadius:8,padding:"6px 14px",fontSize:13,cursor:"pointer",transition:"all 0.2s"}}>
          {copiedLink?"✓ Lien copié !":"🔗 Copier le lien"}
        </button>
      </div>
      <div style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:16,padding:isMobile?"16px":"28px"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:20,gap:12}}>
          <div>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:isMobile?20:26,color:T.text,marginBottom:4}}>{selectedRecipe.name}</h2>
            {selectedRecipe.description && <p style={{fontSize:14,color:T.textMuted,lineHeight:1.5}}>{selectedRecipe.description}</p>}
          </div>
          <button onClick={()=>deleteRecipe(selectedRecipe.id)} style={{background:"transparent",border:"1px solid #f8717155",color:"#f87171",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer",flexShrink:0}}>🗑</button>
        </div>
        <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:24}}>
          {selectedRecipe.category && <span style={{background:accent+"22",color:accent,padding:"4px 12px",borderRadius:20,fontSize:12,fontWeight:600}}>{selectedRecipe.category}</span>}
          {selectedRecipe.servings>0 && <span style={{background:T.bg3,color:T.textMuted,padding:"4px 12px",borderRadius:20,fontSize:12}}>👤 {selectedRecipe.servings} portions</span>}
          {selectedRecipe.prepTime>0 && <span style={{background:T.bg3,color:T.textMuted,padding:"4px 12px",borderRadius:20,fontSize:12}}>⏱ Prépa {selectedRecipe.prepTime} min</span>}
          {selectedRecipe.totalTime>0 && <span style={{background:T.bg3,color:T.textMuted,padding:"4px 12px",borderRadius:20,fontSize:12}}>⏰ Total {selectedRecipe.totalTime} min</span>}
        </div>
        {selectedRecipe.ingredients?.length>0 && (
          <div style={{marginBottom:24}}>
            <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:T.text,marginBottom:12}}>
              <span style={{background:accent+"22",color:accent,borderRadius:8,padding:"2px 8px",fontSize:12}}>Ingrédients</span>
            </h3>
            <ul style={{listStyle:"none",display:"flex",flexDirection:"column",gap:6}}>
              {selectedRecipe.ingredients.map((ing,i)=>(
                <li key={i} style={{display:"flex",alignItems:"center",gap:10,fontSize:14,color:T.text}}>
                  <span style={{color:accent,fontWeight:700,fontSize:16}}>·</span>{ing}
                </li>
              ))}
            </ul>
          </div>
        )}
        {selectedRecipe.steps?.length>0 && (
          <div style={{marginBottom:24}}>
            <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:15,color:T.text,marginBottom:12}}>
              <span style={{background:accent+"22",color:accent,borderRadius:8,padding:"2px 8px",fontSize:12}}>Préparation</span>
            </h3>
            <div style={{display:"flex",flexDirection:"column",gap:12}}>
              {selectedRecipe.steps.map((step,i)=>(
                <div key={i} style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                  <span style={{background:accent,color:"#fff",borderRadius:"50%",width:26,height:26,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,flexShrink:0,marginTop:1}}>{i+1}</span>
                  <div>
                    {step.title && <p style={{fontSize:13,fontWeight:700,color:T.text,marginBottom:3}}>{step.title}</p>}
                    <p style={{fontSize:13,color:T.textMuted,lineHeight:1.6}}>{step.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        {selectedRecipe.notes && (
          <div style={{background:accent+"11",border:"1px solid "+accent+"33",borderRadius:10,padding:"12px 16px",fontSize:13,color:T.text,lineHeight:1.6}}>
            {selectedRecipe.notes}
          </div>
        )}
      </div>
    </div>
  );

  if (showForm) return (
    <div style={{animation:"slideDown 0.3s ease"}}>
      <button onClick={()=>setShowForm(false)} style={{background:"transparent",border:"1px solid "+T.border,color:T.textMuted,borderRadius:8,padding:"6px 14px",fontSize:13,cursor:"pointer",marginBottom:20}}>← Annuler</button>
      <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,color:T.text,marginBottom:24}}>Nouvelle recette</h2>
      <div style={{display:"flex",flexDirection:"column",gap:16}}>
        <div style={{display:"flex",flexDirection:isMobile?"column":"row",gap:12}}>
          <div style={{flex:2}}>
            <label style={{fontSize:11,color:T.textMuted,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>Nom *</label>
            <input style={inp} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="ex: Tzatziki, Pesto…" />
          </div>
          <div style={{flex:1}}>
            <label style={{fontSize:11,color:T.textMuted,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>Catégorie</label>
            <input style={inp} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))} placeholder="ex: Sauce, Plat…" />
          </div>
        </div>
        <div>
          <label style={{fontSize:11,color:T.textMuted,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>Description</label>
          <textarea style={{...inp,resize:"none"}} rows={2} value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} placeholder="Courte description…" />
        </div>
        <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
          {[["servings","Portions","4"],["prepTime","Prépa (min)","15"],["totalTime","Total (min)","45"]].map(([field,label,ph])=>(
            <div key={field} style={{flex:1,minWidth:90}}>
              <label style={{fontSize:11,color:T.textMuted,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>{label}</label>
              <input style={inp} type="number" min={0} value={form[field]} onChange={e=>setForm(f=>({...f,[field]:e.target.value}))} placeholder={ph} />
            </div>
          ))}
        </div>
        <div>
          <label style={{fontSize:11,color:T.textMuted,display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.07em"}}>Ingrédients</label>
          <div style={{display:"flex",flexDirection:"column",gap:6}}>
            {form.ingredients.map((ing,i)=>(
              <div key={i} style={{display:"flex",gap:6,alignItems:"center"}}>
                <input style={{...inp,flex:1}} value={ing} onChange={e=>updateIngredient(i,e.target.value)} placeholder={`Ingrédient ${i+1}…`} />
                {form.ingredients.length>1 && <button onClick={()=>removeIngredient(i)} style={{background:"transparent",border:"none",color:"#f87171",cursor:"pointer",fontSize:18,padding:"0 4px"}}>✕</button>}
              </div>
            ))}
            <button onClick={addIngredient} style={{background:T.bg3,border:"1px dashed "+T.border,color:T.textMuted,borderRadius:8,padding:"7px",fontSize:13,cursor:"pointer",textAlign:"left"}}>+ Ajouter un ingrédient</button>
          </div>
        </div>
        <div>
          <label style={{fontSize:11,color:T.textMuted,display:"block",marginBottom:8,textTransform:"uppercase",letterSpacing:"0.07em"}}>Étapes</label>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {form.steps.map((step,i)=>(
              <div key={i} style={{background:T.bg3,border:"1px solid "+T.border,borderRadius:10,padding:"10px 12px"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                  <span style={{background:accent,color:"#fff",borderRadius:"50%",width:22,height:22,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:700,flexShrink:0}}>{i+1}</span>
                  <input style={{...inp,flex:1,padding:"5px 10px",background:T.bg2}} value={step.title} onChange={e=>updateStep(i,"title",e.target.value)} placeholder="Titre de l'étape…" />
                  {form.steps.length>1 && <button onClick={()=>removeStep(i)} style={{background:"transparent",border:"none",color:"#f87171",cursor:"pointer",fontSize:16,padding:"0 2px"}}>✕</button>}
                </div>
                <textarea style={{...inp,background:T.bg2,resize:"none"}} rows={2} value={step.text} onChange={e=>updateStep(i,"text",e.target.value)} placeholder="Description…" />
              </div>
            ))}
            <button onClick={addStep} style={{background:T.bg3,border:"1px dashed "+T.border,color:T.textMuted,borderRadius:8,padding:"7px",fontSize:13,cursor:"pointer",textAlign:"left"}}>+ Ajouter une étape</button>
          </div>
        </div>
        <div>
          <label style={{fontSize:11,color:T.textMuted,display:"block",marginBottom:5,textTransform:"uppercase",letterSpacing:"0.07em"}}>Notes / Astuces</label>
          <textarea style={{...inp,resize:"none"}} rows={2} value={form.notes} onChange={e=>setForm(f=>({...f,notes:e.target.value}))} placeholder="💡 Conseils, variantes…" />
        </div>
        <button style={{...addBtn,marginTop:4}} onClick={saveRecipe}>💾 Enregistrer la recette</button>
      </div>
    </div>
  );

  return (
    <div style={{animation:"slideDown 0.3s ease"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24}}>
        <div>
          <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:800,fontSize:22,color:T.text}}>🍳 Cookido</h2>
          <p style={{fontSize:13,color:T.textMuted,marginTop:2}}>Vos recettes de cuisine</p>
        </div>
        <button style={addBtn} onClick={()=>setShowForm(true)}>+ Nouvelle recette</button>
      </div>
      {recipes.length===0 && (
        <div style={{textAlign:"center",color:T.textFaint,padding:60}}>
          <div style={{fontSize:40,marginBottom:12}}>🍳</div>
          <p>Aucune recette pour l'instant.</p>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:isMobile?"1fr":"repeat(auto-fill,minmax(280px,1fr))",gap:14}}>
        {recipes.map(recipe=>(
          <div key={recipe.id} onClick={()=>openRecipe(recipe)}
            style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:14,padding:"18px 20px",cursor:"pointer",transition:"all 0.18s"}}
            onMouseEnter={e=>{e.currentTarget.style.border="1px solid "+accent+"66";e.currentTarget.style.transform="translateY(-2px)";}}
            onMouseLeave={e=>{e.currentTarget.style.border="1px solid "+T.border;e.currentTarget.style.transform="translateY(0)";}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:8}}>
              <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:T.text}}>{recipe.name}</h3>
              <button onClick={e=>{e.stopPropagation();deleteRecipe(recipe.id);}}
                style={{background:"transparent",border:"none",color:T.textFaint,cursor:"pointer",fontSize:15,padding:"0 0 0 8px",flexShrink:0}}>🗑</button>
            </div>
            {recipe.description && <p style={{fontSize:12,color:T.textMuted,marginBottom:10,lineHeight:1.5}}>{recipe.description}</p>}
            <div style={{display:"flex",flexWrap:"wrap",gap:6}}>
              {recipe.category && <span style={{background:accent+"22",color:accent,padding:"2px 8px",borderRadius:20,fontSize:11,fontWeight:600}}>{recipe.category}</span>}
              {recipe.servings>0 && <span style={{background:T.bg3,color:T.textMuted,padding:"2px 8px",borderRadius:20,fontSize:11}}>👤 {recipe.servings}</span>}
              {recipe.totalTime>0 && <span style={{background:T.bg3,color:T.textMuted,padding:"2px 8px",borderRadius:20,fontSize:11}}>⏰ {recipe.totalTime} min</span>}
              {recipe.ingredients?.length>0 && <span style={{background:T.bg3,color:T.textMuted,padding:"2px 8px",borderRadius:20,fontSize:11}}>📋 {recipe.ingredients.length} ingr.</span>}
            </div>
          </div>
        ))}
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
  const [history, setHistory]       = useState([]);
  const [payments, setPayments]     = useState({});
  const [tab, setTab]               = useState("order");
  const [status, setStatus]         = useState("connecting");
  const [savedMsg, setSavedMsg]     = useState(false);
  const [favNameInput, setFavNameInput] = useState("");
  const [showFavModal, setShowFavModal] = useState(false);
  const [newBoissonInput, setNewBoissonInput] = useState({});
  const [theme, setTheme]           = useState(()=>localStorage.getItem("lunch_theme")||"dark");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberCode, setNewMemberCode] = useState("");
  const [editingMember, setEditingMember] = useState(null);
  const [newSauce, setNewSauce]     = useState("");
  const [newCrudite, setNewCrudite] = useState("");
  const [newBoisson, setNewBoisson] = useState("");
  const [newExtraLabel, setNewExtraLabel]     = useState("");
  const [newExtraApplies, setNewExtraApplies] = useState([]);
  const [newExtraOption, setNewExtraOption]   = useState({});
  const detailTimers = useRef({});
  const T = theme==="dark" ? DARK : LIGHT;
  const [isMobile, setIsMobile] = useState(()=>window.innerWidth < 768);

  useEffect(()=>{
    const handler = ()=>setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handler);
    return ()=>window.removeEventListener("resize", handler);
  },[]);

  const toggleTheme = () => {
    const next = theme==="dark"?"light":"dark";
    setTheme(next); localStorage.setItem("lunch_theme",next);
  };

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
        const data = s.data();
        if (data.list) d[s.id] = data.list;
        else if (data.choice) d[s.id] = [{ id:"fav_legacy", name:"Mon favori", ...data }];
        else d[s.id] = [];
      });
      setFavorites(d);
    });
    const u7 = onSnapshot(collection(db,"history"),   snap=>{const days=[];snap.forEach(s=>days.push({id:s.id,...s.data()}));days.sort((a,b)=>b.id.localeCompare(a.id));setHistory(days);});
    const u8 = onSnapshot(doc(db,"payments","today"), snap=>{if(snap.exists())setPayments(snap.data());else setPayments({});});
    return ()=>{u1();u2();u3();u4();u4b();u5();u6();u7();u8();};
  },[]);

  useEffect(()=>{
    if(!user||user==="Admin")return;
    const favList = favorites[user]||[];
    if(!favList.length)return;
    const cur=orders[user];
    if(!cur?.choice) {
      const first = favList[0];
      const {id:_favId, name:_favName, ...orderData} = first;
      setDoc(doc(db,"orders",user),{...orderData});
    }
  },[user,favorites]);

  if(!user) return <LoginScreen onLogin={setUser} theme={theme} toggleTheme={toggleTheme} members={members}/>;

  const pm = async l=>{setMembers(l);   await setDoc(doc(db,"config","members"), {list:l});};
  const ps = async l=>{setSauces(l);    await setDoc(doc(db,"config","sauces"),  {list:l});};
  const pc = async l=>{setCrudites(l);  await setDoc(doc(db,"config","crudites"),{list:l});};
  const pb = async l=>{setBoissons(l);  await setDoc(doc(db,"config","boissons"),{list:l});};
  const pe = async l=>{setExtras(l);    await setDoc(doc(db,"config","extras"),  {list:l});};

  const names = user==="Admin"
    ? members.map(m=>m.username)
    : [user,...members.map(m=>m.username).filter(n=>n!==user)];

  const addMember    = async()=>{const n=newMemberName.trim(),c=newMemberCode.trim();if(!n||!c||members.find(m=>m.username===n))return;await pm([...members,{username:n,code:c}]);setNewMemberName("");setNewMemberCode("");};
  const removeMember = async n=>{await pm(members.filter(m=>m.username!==n));await deleteDoc(doc(db,"orders",n));};
  const saveEdit     = async()=>{if(!editingMember)return;await pm(members.map(m=>m.username===editingMember.username?editingMember:m));setEditingMember(null);};
  const addSauce     = async()=>{const s=newSauce.trim();   if(s&&!sauces.includes(s))   {await ps([...sauces,s]);    setNewSauce("");}};
  const removeSauce  = async s=>{await ps(sauces.filter(x=>x!==s));};
  const addCrudite   = async()=>{const c=newCrudite.trim(); if(c&&!crudites.includes(c)) {await pc([...crudites,c]);  setNewCrudite("");}};
  const removeCrudite= async c=>{await pc(crudites.filter(x=>x!==c));};
  const addBoisson   = async()=>{const b=newBoisson.trim(); if(b&&!boissons.includes(b)){await pb([...boissons,b]); setNewBoisson("");}};
  const removeBoisson= async b=>{await pb(boissons.filter(x=>x!==b));};

  const addExtraCategory = async()=>{
    const label=newExtraLabel.trim();
    if(!label||!newExtraApplies.length)return;
    const id="extra_"+Date.now();
    const accent=EXTRA_ACCENTS[extras.length%EXTRA_ACCENTS.length];
    await pe([...extras,{id,label,options:[],appliesTo:newExtraApplies,accent}]);
    setNewExtraLabel(""); setNewExtraApplies([]);
  };
  const removeExtraCategory = async id=>{await pe(extras.filter(e=>e.id!==id));};
  const addExtraOption = async(extraId)=>{
    const val=(newExtraOption[extraId]||"").trim();
    if(!val)return;
    const updated=extras.map(e=>e.id===extraId?{...e,options:[...e.options,val]}:e);
    await pe(updated);
    setNewExtraOption(prev=>({...prev,[extraId]:""}));
  };
  const removeExtraOption = async(extraId,opt)=>{
    const updated=extras.map(e=>e.id===extraId?{...e,options:e.options.filter(o=>o!==opt)}:e);
    await pe(updated);
  };
  const toggleExtraApplies = (meal)=>{
    setNewExtraApplies(prev=>prev.includes(meal)?prev.filter(x=>x!==meal):[...prev,meal]);
  };

  const toggleChoice=async(name,choice)=>{
    const cur=orders[name]||{};
    if(cur.choice===choice){await deleteDoc(doc(db,"orders",name));}
    else{await setDoc(doc(db,"orders",name),{choice,detail:"",sauces:[],crudites:[],cruditesTout:false,boules:"",snackType:"",frites:"",friteSup:"",sauceFrite:"",boisson:"",extras:{}});}
  };
  const toggleCruditesTout = async(name)=>{
    const cur=orders[name]||{};
    if(!cur.choice)return;
    const wasTout=cur.cruditesTout||false;
    const updated={...cur, cruditesTout:!wasTout, crudites:!wasTout?[...crudites]:[]};
    setOrders(prev=>({...prev,[name]:updated}));
    await setDoc(doc(db,"orders",name),updated);
  };
  const handleDetail=(name,detail)=>{
    setOrders(prev=>({...prev,[name]:{...prev[name],detail}}));
    clearTimeout(detailTimers.current[name]);
    detailTimers.current[name]=setTimeout(async()=>{
      const cur=orders[name]||{};if(!cur.choice)return;
      await setDoc(doc(db,"orders",name),{...cur,detail});
    },600);
  };
  const handleSubDetail=async(name,field,value)=>{
    const cur=orders[name]||{};if(!cur.choice)return;
    const updated={...cur,[field]:value};
    setOrders(prev=>({...prev,[name]:updated}));
    await setDoc(doc(db,"orders",name),updated);
  };
  const handleBoissonInput = (name, val) => {
    setNewBoissonInput(prev=>({...prev,[name]:val}));
    handleSubDetail(name,"boisson",val);
  };
  const toggleMulti=async(name,field,value)=>{
    const cur=orders[name]||{};if(!cur.choice)return;
    const current=cur[field]||[];
    const updated=current.includes(value)?current.filter(x=>x!==value):[...current,value];
    const newOrder={...cur,[field]:updated};
    setOrders(prev=>({...prev,[name]:newOrder}));
    await setDoc(doc(db,"orders",name),newOrder);
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
  const togglePayment = async name => {
    const current = payments[name] || false;
    const updated = { ...payments, [name]: !current };
    setPayments(updated);
    await setDoc(doc(db,"payments","today"), updated);
  };
  const saveFavorite = async name => {
    const cur = orders[name];
    if (!cur?.choice) return;
    const favName = favNameInput.trim() || formatOrder(cur,extras,crudites).slice(0,30) || "Mon favori";
    const existing = favorites[name] || [];
    const newFav = { id:"fav_"+Date.now(), name:favName, ...cur };
    await setDoc(doc(db,"favorites",name), { list:[...existing, newFav] });
    setFavNameInput(""); setShowFavModal(false);
    setSavedMsg(true); setTimeout(()=>setSavedMsg(false),2500);
  };
  const deleteFavorite = async (username, favId) => {
    const existing = favorites[username] || [];
    const updated = existing.filter(f=>f.id!==favId);
    await setDoc(doc(db,"favorites",username), { list:updated });
  };
  const resetAll=async()=>{
    if(!window.confirm("Archiver et effacer toutes les commandes du jour ?"))return;
    const today=new Date().toISOString().slice(0,10);
    const snapshot={};
    members.map(m=>m.username).forEach(n=>{if(orders[n]?.choice)snapshot[n]=orders[n];});
    if(Object.keys(snapshot).length>0)await setDoc(doc(db,"history",today),{date:today,orders:snapshot,payments});
    await Promise.all(members.map(m=>deleteDoc(doc(db,"orders",m.username))));
    await setDoc(doc(db,"payments","today"),{});
  };
  const deleteHistory=async id=>{if(!window.confirm("Supprimer cet historique ?"))return;await deleteDoc(doc(db,"history",id));};

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
  const tdS={padding:"10px 16px",verticalAlign:"middle",borderBottom:"1px solid "+T.border2};
  const thS={background:T.thBg,color:T.thColor,fontSize:11,fontWeight:600,textTransform:"uppercase",letterSpacing:"0.07em",padding:"12px 16px",textAlign:"left",borderBottom:"1px solid "+T.border};
  const extrasForMeal = (choice) => extras.filter(e=>e.appliesTo?.includes(choice));

  const allTabs = [
    ["order","📋 Commander"],
    ["summary","📊 Résumé"],
    ["favorites","⭐ Favoris"],
    ["history","📅 Historique"],
    ["settings","⚙️ Config"],
    ...(user==="Admin" ? [["cookido","🍳 Cookido"]] : []),
  ];

  return (
    <div style={{minHeight:"100vh",background:T.bg,fontFamily:"'DM Sans',sans-serif",color:T.text}}>
      <style>{makeCssGlobal(T)}</style>
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
            <button style={{background:"transparent",border:"1px solid "+T.border,color:T.textMuted,borderRadius:8,padding:"6px 14px",fontSize:12,cursor:"pointer"}} onClick={()=>setUser(null)}>Déconnexion</button>
          </div>
        </div>
        <div style={{maxWidth:1200,margin:"0 auto",padding:"0 24px",display:"flex",overflowX:"auto"}}>
          {allTabs.map(([id,label])=>(
            <button key={id} style={{background:"transparent",border:"none",color:tab===id?T.text:T.textMuted,padding:"10px 18px",fontSize:13,fontWeight:600,cursor:"pointer",borderBottom:tab===id?"2px solid "+(id==="cookido"?"#f97316":T.text):"2px solid transparent",fontFamily:"'DM Sans',sans-serif",transition:"all 0.2s",whiteSpace:"nowrap"}}
              onClick={()=>setTab(id)}>{label}</button>
          ))}
        </div>
      </header>

      <main style={{maxWidth:1200,margin:"0 auto",padding:isMobile?"16px 12px":"32px 24px"}}>

        {tab==="cookido" && user==="Admin" && <CookidoTab T={T} isMobile={isMobile} />}

        {tab==="order" && (
          <div style={{animation:"slideDown 0.3s ease"}}>
            {user!=="Admin" && (favorites[user]||[]).length > 0 && (
              <div style={{marginBottom:20}}>
                <div style={{fontSize:12,color:T.textFaint,marginBottom:8,display:"flex",alignItems:"center",gap:6}}>⭐ <span>Commande rapide depuis tes favoris</span></div>
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {(favorites[user]||[]).map(fav=>{
                    const opt = LUNCH_OPTIONS.find(o=>o.id===fav.choice);
                    const {id:favId, name:favName, ...favOrder} = fav;
                    const currentOrder = orders[user];
                    const isActive = currentOrder?.choice===favOrder.choice && formatOrder(currentOrder,extras,crudites)===formatOrder(favOrder,extras,crudites);
                    return (
                      <button key={favId} onClick={async()=>{ if(isActive){await deleteDoc(doc(db,"orders",user));}else{await setDoc(doc(db,"orders",user),{...favOrder});} }}
                        style={{background:isActive?opt?.accent+"22":T.bg2,border:"2px solid "+(isActive?opt?.accent:T.border),borderRadius:12,padding:"10px 16px",cursor:"pointer",textAlign:"left",transition:"all 0.2s",display:"flex",flexDirection:"column",gap:4,minWidth:isMobile?"calc(50% - 5px)":200,flex:isMobile?"1":"0 1 auto"}}>
                        <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"space-between"}}>
                          <span style={{fontSize:12,fontWeight:600,color:opt?.accent}}>{opt?.label}</span>
                          {isActive && <span style={{fontSize:10,background:opt?.accent+"33",color:opt?.accent,padding:"1px 6px",borderRadius:10}}>✓ Actif</span>}
                        </div>
                        <div style={{fontSize:12,fontWeight:500,color:T.text}}>{favName}</div>
                        <div style={{fontSize:11,color:T.textMuted,lineHeight:1.4}}>{formatOrder(favOrder,extras,crudites)||"Aucun détail"}</div>
                        <div style={{fontSize:11,color:isActive?"#f87171":opt?.accent,marginTop:2}}>{isActive?"Cliquer pour effacer ✕":"Cliquer pour commander →"}</div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div style={{marginBottom:40}}>
              <h2 style={secTitle}>Commandes du jour <span style={{background:T.bg3,color:T.textMuted,fontSize:12,padding:"3px 10px",borderRadius:20}}>{totalOrdered} / {names.length}</span></h2>
              {isMobile && (
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {names.map((name,idx)=>{
                    const order=orders[name]||{};
                    const chosen=LUNCH_OPTIONS.find(o=>o.id===order.choice);
                    const canEdit=user===name||user==="Admin";
                    const isMe=user===name;
                    const mealExtras=extrasForMeal(order.choice);
                    return (
                      <div key={name} style={{background:T.bg2,border:"1px solid "+(isMe?(chosen?.accent||"#f59e0b"):T.border),borderRadius:14,padding:"16px",boxShadow:isMe?"0 0 0 2px "+(chosen?.accent||"#f59e0b")+"33":"none"}}>
                        <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14}}>
                          <div style={{width:36,height:36,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:15,fontWeight:700,flexShrink:0,background:chosen?chosen.accent+"28":T.bg3,color:chosen?chosen.accent:T.textMuted}}>{name[0].toUpperCase()}</div>
                          <div style={{flex:1}}>
                            <div style={{display:"flex",alignItems:"center",gap:8}}>
                              <span style={{fontSize:15,fontWeight:600,color:isMe?"#f59e0b":T.text}}>{name}</span>
                              {isMe && <span style={{fontSize:10,color:T.textFaint,background:T.bg3,padding:"1px 6px",borderRadius:10}}>toi</span>}
                              <span style={{fontSize:12,color:T.textFaint,marginLeft:"auto"}}>#{idx+1}</span>
                            </div>
                            {chosen && <span style={{fontSize:12,color:chosen.accent}}>{chosen.label}</span>}
                          </div>
                          {user==="Admin" && <button style={{background:"transparent",border:"none",color:T.textFaint,fontSize:18,cursor:"pointer",padding:4}} onClick={()=>removeMember(name)}>✕</button>}
                        </div>
                        {canEdit && (
                          <div style={{display:"flex",gap:8,marginBottom:12,flexWrap:"wrap"}}>
                            {LUNCH_OPTIONS.map(opt=>(
                              <button key={opt.id} style={{flex:1,minWidth:80,padding:"8px 4px",borderRadius:10,border:"1px solid "+(order.choice===opt.id?opt.accent:T.border),background:order.choice===opt.id?opt.accent:T.bg3,color:order.choice===opt.id?"#fff":T.textMuted,fontSize:12,fontWeight:600,cursor:"pointer",transition:"all 0.18s"}}
                                onClick={()=>toggleChoice(name,opt.id)}>{opt.label}</button>
                            ))}
                          </div>
                        )}
                        {!canEdit && order.choice && <div style={{marginBottom:12}}><span style={{fontSize:13,color:chosen?.accent,fontWeight:600}}>{chosen?.label}</span></div>}
                        {order.choice && (
                          <div style={{display:"flex",flexDirection:"column",gap:8,paddingTop:12,borderTop:"1px solid "+T.border2}}>
                            {order.choice==="ice-cream" && (<>
                              <div style={{display:"flex",gap:6}}>{["1 boule","2 boules"].map(opt=>(<button key={opt} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"boules",order.boules===opt?"":opt)} style={pill("#ec4899",order.boules===opt,!canEdit)}>{opt}</button>))}</div>
                              <input style={{width:"100%",background:T.bg,border:"1px solid #ec489966",borderRadius:8,color:T.text,padding:"8px 12px",fontSize:13,fontFamily:"'DM Sans',sans-serif",opacity:canEdit?1:0.4}} disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)} placeholder={canEdit?"Parfum(s)…":"🔒"} />
                              <div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{fontSize:11,color:T.textMuted,whiteSpace:"nowrap"}}>🥤 Boisson :</span><input style={{flex:1,background:T.bg,border:"1px solid "+T.border,borderRadius:8,color:T.text,padding:"6px 10px",fontSize:13,fontFamily:"'DM Sans',sans-serif",opacity:canEdit?1:0.4}} disabled={!canEdit} value={order.boisson||""} onChange={e=>handleSubDetail(name,"boisson",e.target.value)} placeholder={canEdit?"ex: eau, coca…":"🔒"} /></div>
                            </>)}
                            {order.choice==="libanais" && (<>
                              <textarea style={{width:"100%",background:T.bg,border:"1px solid #16a34a66",borderRadius:8,color:T.text,padding:"8px 12px",fontSize:13,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5,opacity:canEdit?1:0.4,resize:"none"}} rows={2} disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)} placeholder={canEdit?"Précise ta commande…":"🔒"} />
                              <div style={{display:"flex",gap:6,alignItems:"center"}}><span style={{fontSize:11,color:T.textMuted,whiteSpace:"nowrap"}}>🥤 Boisson :</span><input style={{flex:1,background:T.bg,border:"1px solid "+T.border,borderRadius:8,color:T.text,padding:"6px 10px",fontSize:13,fontFamily:"'DM Sans',sans-serif",opacity:canEdit?1:0.4}} disabled={!canEdit} value={order.boisson||""} onChange={e=>handleSubDetail(name,"boisson",e.target.value)} placeholder={canEdit?"ex: eau, coca…":"🔒"} /></div>
                            </>)}
                            {order.choice==="snack-merode" && (<>
                              <div style={{paddingBottom:8,marginBottom:8,borderBottom:"1px dashed "+T.border}}>
                                <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:6}}>
                                  {["Durum","Bicky"].map(opt=>(<button key={opt} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"snackType",order.snackType===opt?"":opt)} style={pill("#0891b2",order.snackType===opt,!canEdit)}>{opt}</button>))}
                                  <input style={{flex:1,minWidth:80,background:T.bg,border:"1px solid #0891b266",borderRadius:8,color:T.text,padding:"6px 10px",fontSize:13,fontFamily:"'DM Sans',sans-serif",opacity:canEdit?1:0.4}} disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)} placeholder={canEdit?(order.snackType?"ex: falafel…":"Précise…"):"🔒"} />
                                </div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:6}}>
                                  <span style={{fontSize:11,color:T.textFaint,width:"100%"}}>🫙 Sauce snack :</span>
                                  {sauces.map(s=>(<button key={s} disabled={!canEdit} onClick={()=>canEdit&&toggleMulti(name,"sauces",s)} style={pill("#7c3aed",(order.sauces||[]).includes(s),!canEdit)}>{s}</button>))}
                                </div>
                                {mealExtras.map(ex=>(<div key={ex.id} style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:5}}><span style={{fontSize:11,color:ex.accent,width:"100%",fontWeight:500}}>➕ {ex.label} :</span>{ex.options.map(o=>(<button key={o} disabled={!canEdit} onClick={()=>canEdit&&toggleExtraOption(name,ex.id,o)} style={pill(ex.accent,((order.extras||{})[ex.id]||[]).includes(o),!canEdit)}>{o}</button>))}</div>))}
                                <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:6}}>{["Frite dedans","Frite à part"].map(opt=>(<button key={opt} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"frites",order.frites===opt?"":opt)} style={pill("#f59e0b",order.frites===opt,!canEdit)}>{opt}</button>))}</div>
                              </div>
                              <div style={{paddingBottom:8,marginBottom:8,borderBottom:"1px dashed "+T.border}}>
                                <div style={{display:"flex",gap:5,flexWrap:"wrap",alignItems:"center",marginBottom:6}}>
                                  <span style={{fontSize:11,color:T.textFaint,width:"100%"}}>🍟 Frite extra :</span>
                                  {["Petite","Moyenne","Grande"].map(opt=>(<button key={opt} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"friteSup",order.friteSup===opt?"":opt)} style={pill("#f97316",order.friteSup===opt,!canEdit)}>{opt}</button>))}
                                </div>
                                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                                  <span style={{fontSize:11,color:T.textFaint,width:"100%"}}>🥣 Sauce frite :</span>
                                  {sauces.map(s=>(<button key={s} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"sauceFrite",order.sauceFrite===s?"":s)} style={pill("#f59e0b",order.sauceFrite===s,!canEdit)}>{s}</button>))}
                                </div>
                              </div>
                              <div style={{paddingBottom:8,marginBottom:8,borderBottom:"1px dashed "+T.border}}>
                                <span style={{fontSize:11,color:T.textFaint,display:"block",marginBottom:5}}>🥗 Crudités :</span>
                                <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                                  <button disabled={!canEdit} onClick={()=>canEdit&&toggleCruditesTout(name)} style={{...pill("#16a34a",order.cruditesTout,!canEdit),fontWeight:600}}>Tout</button>
                                  {crudites.map(c=>(<button key={c} disabled={!canEdit} onClick={()=>canEdit&&toggleMulti(name,"crudites",c)} style={pill("#16a34a",(order.crudites||[]).includes(c),!canEdit)}>{c}</button>))}
                                </div>
                              </div>
                              <div>
                                <span style={{fontSize:11,color:T.textFaint,display:"block",marginBottom:5}}>🥤 Boisson :</span>
                                <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:5}}>{boissons.map(b=>(<button key={b} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"boisson",order.boisson===b?"":b)} style={pill("#06b6d4",order.boisson===b,!canEdit)}>{b}</button>))}</div>
                                <input style={{flex:1,background:T.bg,border:"1px solid #06b6d466",borderRadius:8,color:T.text,padding:"6px 10px",fontSize:12,fontFamily:"'DM Sans',sans-serif",opacity:canEdit?1:0.4,width:"100%"}} disabled={!canEdit} value={newBoissonInput[name]??(!boissons.includes(order.boisson||"")?(order.boisson||""):"")} onChange={e=>handleBoissonInput(name,e.target.value)} placeholder={canEdit?"Autre boisson…":"🔒"} />
                              </div>
                            </>)}
                            {formatOrderFull(order,extras,crudites).length>0 && (
                              <div style={{display:"flex",flexWrap:"wrap",gap:4,marginTop:4}}>
                                {formatOrderFull(order,extras,crudites).map((line,i)=>(<span key={i} style={{fontSize:11,color:T.textMuted,background:T.bg3,padding:"2px 8px",borderRadius:20}}>{line.emoji} {line.text}</span>))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {!isMobile && (
                <div style={{overflowX:"auto",borderRadius:14,border:"1px solid "+T.border}}>
                  <table style={{width:"100%",borderCollapse:"collapse",minWidth:820}}>
                    <thead>
                      <tr>
                        <th style={{...thS,width:50,textAlign:"center"}}>#</th>
                        <th style={{...thS,width:160}}>Nom</th>
                        {LUNCH_OPTIONS.map(o=><th key={o.id} style={thS}>{o.label}</th>)}
                        <th style={thS}>Détails</th>
                        <th style={{...thS,width:44}}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {names.map((name,idx)=>{
                        const order=orders[name]||{};
                        const chosen=LUNCH_OPTIONS.find(o=>o.id===order.choice);
                        const canEdit=user===name||user==="Admin";
                        const isMe=user===name;
                        const mealExtras=extrasForMeal(order.choice);
                        return (
                          <tr key={name} className="datarow" style={isMe?{background:T.bg3}:{}}>
                            <td style={{...tdS,textAlign:"center"}}><span style={{fontSize:13,fontWeight:700,color:isMe?"#f59e0b":T.textFaint}}>{idx+1}</span></td>
                            <td style={tdS}>
                              <div style={{display:"flex",alignItems:"center",gap:10}}>
                                <div style={{width:32,height:32,borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,flexShrink:0,background:chosen?chosen.accent+"28":T.bg3,color:chosen?chosen.accent:T.textMuted}}>{name[0].toUpperCase()}</div>
                                <div><span style={{fontSize:14,fontWeight:isMe?700:500,color:isMe?"#f59e0b":T.text}}>{name}</span>{isMe&&<span style={{display:"block",fontSize:10,color:T.textFaint}}>● toi</span>}</div>
                              </div>
                            </td>
                            {LUNCH_OPTIONS.map(opt=>(
                              <td key={opt.id} style={{...tdS,textAlign:"center"}}>
                                <button style={{width:34,height:34,borderRadius:8,border:"1px solid "+(order.choice===opt.id?opt.accent:T.border),background:order.choice===opt.id?opt.accent:T.bg3,color:order.choice===opt.id?"#fff":T.textMuted,fontSize:15,cursor:canEdit?"pointer":"not-allowed",transition:"all 0.18s",opacity:canEdit?1:0.35}} onClick={()=>canEdit&&toggleChoice(name,opt.id)}>
                                  {order.choice===opt.id?"✓":"○"}
                                </button>
                              </td>
                            ))}
                            <td style={tdS}>
                              {!order.choice&&<span style={{fontSize:12,color:T.textFaint}}>{canEdit?"Choisis d'abord":"🔒"}</span>}
                              {order.choice==="ice-cream"&&(
                                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                                  <div style={{display:"flex",gap:6}}>{["1 boule","2 boules"].map(opt=>(<button key={opt} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"boules",order.boules===opt?"":opt)} style={pill("#ec4899",order.boules===opt,!canEdit)}>{opt}</button>))}</div>
                                  <textarea style={{width:"100%",background:T.bg,border:"1px solid #ec489966",borderRadius:8,color:T.text,padding:"8px 10px",fontSize:13,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5,opacity:canEdit?1:0.35}} rows={1} disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)} placeholder={canEdit?"Parfum(s)…":"🔒"} />
                                  <div style={{padding:"6px 0",borderTop:"1px dashed "+T.border}}>
                                    <span style={{fontSize:11,color:T.textFaint,display:"block",marginBottom:5}}>🥤 Boisson :</span>
                                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>{boissons.map(b=>(<button key={b} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"boisson",order.boisson===b?"":b)} style={pill("#06b6d4",order.boisson===b,!canEdit)}>{b}</button>))}</div>
                                  </div>
                                  {mealExtras.map(ex=>(<div key={ex.id} style={{display:"flex",flexWrap:"wrap",gap:5}}><span style={{fontSize:12,color:T.textMuted,width:"100%"}}>{ex.label} :</span>{ex.options.map(o=>(<button key={o} disabled={!canEdit} onClick={()=>canEdit&&toggleExtraOption(name,ex.id,o)} style={pill(ex.accent,((order.extras||{})[ex.id]||[]).includes(o),!canEdit)}>{o}</button>))}</div>))}
                                </div>
                              )}
                              {order.choice==="snack-merode"&&(
                                <div style={{display:"flex",flexDirection:"column",gap:0}}>
                                  <div style={{padding:"8px 0",borderBottom:"1px dashed "+T.border}}>
                                    <div style={{display:"flex",gap:6,flexWrap:"wrap",alignItems:"center",marginBottom:6}}>
                                      {["Durum","Bicky"].map(opt=>(<button key={opt} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"snackType",order.snackType===opt?"":opt)} style={pill("#0891b2",order.snackType===opt,!canEdit)}>{opt}</button>))}
                                      <input style={{flex:1,minWidth:80,background:T.bg,border:"1px solid #0891b266",borderRadius:8,color:T.text,padding:"4px 8px",fontSize:13,fontFamily:"'DM Sans',sans-serif",opacity:canEdit?1:0.35}} disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)} placeholder={canEdit?(order.snackType?"ex: falafel…":"Précise…"):"🔒"} />
                                    </div>
                                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:5}}>{["Frite dedans","Frite à part"].map(opt=>(<button key={opt} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"frites",order.frites===opt?"":opt)} style={pill("#f59e0b",order.frites===opt,!canEdit)}>{opt}</button>))}</div>
                                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:5}}><span style={{fontSize:11,color:T.textFaint,width:"100%"}}>🫙 Sauce du snack :</span>{sauces.map(s=>(<button key={s} disabled={!canEdit} onClick={()=>canEdit&&toggleMulti(name,"sauces",s)} style={pill("#7c3aed",(order.sauces||[]).includes(s),!canEdit)}>{s}</button>))}</div>
                                    {mealExtras.map(ex=>(<div key={ex.id} style={{display:"flex",flexWrap:"wrap",gap:5,marginTop:5}}><span style={{fontSize:11,color:ex.accent,width:"100%",fontWeight:500}}>➕ {ex.label} :</span>{ex.options.map(o=>(<button key={o} disabled={!canEdit} onClick={()=>canEdit&&toggleExtraOption(name,ex.id,o)} style={pill(ex.accent,((order.extras||{})[ex.id]||[]).includes(o),!canEdit)}>{o}</button>))}</div>))}
                                  </div>
                                  <div style={{padding:"8px 0",borderBottom:"1px dashed "+T.border}}>
                                    <span style={{fontSize:11,color:T.textFaint,display:"block",marginBottom:5}}>🍟 Frite extra :</span>
                                    <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:5}}>{["Petite","Moyenne","Grande"].map(opt=>(<button key={opt} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"friteSup",order.friteSup===opt?"":opt)} style={pill("#f97316",order.friteSup===opt,!canEdit)}>{opt}</button>))}</div>
                                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}><span style={{fontSize:11,color:T.textFaint,width:"100%"}}>🥣 Sauce frite :</span>{sauces.map(s=>(<button key={s} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"sauceFrite",order.sauceFrite===s?"":s)} style={pill("#f59e0b",order.sauceFrite===s,!canEdit)}>{s}</button>))}</div>
                                  </div>
                                  <div style={{padding:"8px 0",borderBottom:"1px dashed "+T.border}}>
                                    <span style={{fontSize:11,color:T.textFaint,display:"block",marginBottom:5}}>🥗 Crudités :</span>
                                    <div style={{display:"flex",flexWrap:"wrap",gap:5}}>
                                      <button disabled={!canEdit} onClick={()=>canEdit&&toggleCruditesTout(name)} style={{...pill("#16a34a",order.cruditesTout,!canEdit),fontWeight:600}}>Tout</button>
                                      {crudites.map(c=>(<button key={c} disabled={!canEdit} onClick={()=>canEdit&&toggleMulti(name,"crudites",c)} style={pill("#16a34a",(order.crudites||[]).includes(c),!canEdit)}>{c}</button>))}
                                    </div>
                                  </div>
                                  <div style={{padding:"8px 0"}}>
                                    <span style={{fontSize:11,color:T.textFaint,display:"block",marginBottom:5}}>🥤 Boisson :</span>
                                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:5}}>{boissons.map(b=>(<button key={b} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"boisson",order.boisson===b?"":b)} style={pill("#06b6d4",order.boisson===b,!canEdit)}>{b}</button>))}</div>
                                    <input style={{width:"100%",background:T.bg,border:"1px solid #06b6d466",borderRadius:8,color:T.text,padding:"4px 8px",fontSize:12,fontFamily:"'DM Sans',sans-serif",opacity:canEdit?1:0.35}} disabled={!canEdit} value={!boissons.includes(order.boisson||"")?(order.boisson||""):""} onChange={e=>handleSubDetail(name,"boisson",e.target.value)} placeholder={canEdit?"Autre boisson…":"🔒"} />
                                  </div>
                                </div>
                              )}
                              {order.choice==="libanais"&&(
                                <div style={{display:"flex",flexDirection:"column",gap:6}}>
                                  <textarea style={{width:"100%",background:T.bg,border:"1px solid #16a34a66",borderRadius:8,color:T.text,padding:"8px 10px",fontSize:13,fontFamily:"'DM Sans',sans-serif",lineHeight:1.5,opacity:canEdit?1:0.35}} rows={2} disabled={!canEdit} value={order.detail||""} onChange={e=>handleDetail(name,e.target.value)} placeholder={canEdit?"Précise ta commande…":"🔒"} />
                                  <div style={{padding:"6px 0",borderTop:"1px dashed "+T.border}}>
                                    <span style={{fontSize:11,color:T.textFaint,display:"block",marginBottom:5}}>🥤 Boisson :</span>
                                    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:5}}>{boissons.map(b=>(<button key={b} disabled={!canEdit} onClick={()=>canEdit&&handleSubDetail(name,"boisson",order.boisson===b?"":b)} style={pill("#06b6d4",order.boisson===b,!canEdit)}>{b}</button>))}</div>
                                  </div>
                                  {mealExtras.map(ex=>(<div key={ex.id} style={{display:"flex",flexWrap:"wrap",gap:5}}><span style={{fontSize:12,color:T.textMuted,width:"100%"}}>{ex.label} :</span>{ex.options.map(o=>(<button key={o} disabled={!canEdit} onClick={()=>canEdit&&toggleExtraOption(name,ex.id,o)} style={pill(ex.accent,((order.extras||{})[ex.id]||[]).includes(o),!canEdit)}>{o}</button>))}</div>))}
                                </div>
                              )}
                            </td>
                            <td style={{...tdS,textAlign:"center"}}>{user==="Admin"&&<button style={{background:"transparent",border:"none",color:T.textFaint,fontSize:16,cursor:"pointer",padding:4}} onClick={()=>removeMember(name)}>✕</button>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {tab==="summary"&&(
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
                const paidCount=people.filter(n=>payments[n]).length;
                return (
                  <div key={opt.id} style={{background:T.bg2,border:"1px solid "+T.border,borderLeft:"3px solid "+opt.accent,borderRadius:12,padding:"16px 20px"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
                      <h3 style={{fontSize:14,fontWeight:700,color:opt.accent,fontFamily:"'Syne',sans-serif"}}>{opt.label}</h3>
                      <span style={{fontSize:12,color:paidCount===people.length?"#22c55e":T.textMuted}}>💰 {paidCount}/{people.length} payé{paidCount>1?"s":""}</span>
                    </div>
                    {people.map((name,idx)=>{
                      const paid=payments[name]||false;
                      const lines=formatOrderFull(orders[name],extras,crudites);
                      return (
                        <div key={name} style={{padding:"10px 0",borderBottom:"1px solid "+T.border2,opacity:paid?0.6:1,transition:"opacity 0.2s"}}>
                          <div style={{display:"flex",gap:12,alignItems:"center",marginBottom:lines.length?6:0}}>
                            <span style={{fontSize:12,fontWeight:700,color:T.textFaint,minWidth:24,textAlign:"right"}}>{idx+1}.</span>
                            <span style={{fontSize:13,fontWeight:600,color:T.text,textDecoration:paid?"line-through":"none",flex:1}}>{name}</span>
                            <button onClick={()=>togglePayment(name)} style={{background:paid?"#22c55e22":"transparent",border:"1px solid "+(paid?"#22c55e55":T.border),borderRadius:8,padding:"3px 10px",fontSize:12,cursor:"pointer",color:paid?"#22c55e":T.textMuted,whiteSpace:"nowrap",flexShrink:0,transition:"all 0.2s"}}>{paid?"✓ Payé":"À payer"}</button>
                            {name===user&&<button style={{background:"transparent",border:"1px solid "+T.border,fontSize:13,cursor:"pointer",padding:"3px 8px",color:T.textMuted,borderRadius:8,flexShrink:0,whiteSpace:"nowrap"}} onClick={()=>setShowFavModal(true)}>⭐ Sauvegarder</button>}
                          </div>
                          {lines.length>0 && <div style={{display:"flex",flexWrap:"wrap",gap:4,paddingLeft:36}}>{lines.map((line,i)=>(<span key={i} style={{fontSize:12,color:T.textMuted,background:T.bg3,padding:"2px 8px",borderRadius:20,display:"inline-flex",alignItems:"center",gap:4}}><span>{line.emoji}</span><span>{line.text}</span></span>))}</div>}
                          {lines.length===0 && <span style={{fontSize:12,color:T.textFaint,paddingLeft:36}}><em>Aucun détail</em></span>}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
              {totalOrdered===0&&<p style={{color:T.textFaint,textAlign:"center",padding:48}}>Aucune commande pour l'instant.</p>}
            </div>
            {notOrdered.length>0&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:8,alignItems:"center",marginTop:24,padding:"14px 18px",background:T.bg2,border:"1px solid "+T.border,borderRadius:12}}>
                <span style={{color:T.textMuted,fontSize:13}}>⏳ Pas encore commandé :</span>
                {notOrdered.map(n=><span key={n} style={{background:T.bg3,color:T.textMuted,fontSize:12,padding:"3px 10px",borderRadius:20}}>{n}</span>)}
              </div>
            )}
            {showFavModal && (
              <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.5)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:999}} onClick={e=>e.target===e.currentTarget&&setShowFavModal(false)}>
                <div style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:16,padding:"24px",width:320,boxShadow:"0 24px 80px rgba(0,0,0,.4)"}}>
                  <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:T.text,marginBottom:6}}>⭐ Sauvegarder ce favori</h3>
                  <p style={{fontSize:12,color:T.textMuted,marginBottom:16}}>Donne un nom à cette commande pour la retrouver facilement.</p>
                  <input autoFocus style={{width:"100%",background:T.bg,border:"1px solid "+T.border,borderRadius:10,color:T.text,padding:"10px 14px",fontSize:14,fontFamily:"'DM Sans',sans-serif",marginBottom:12}} value={favNameInput} onChange={e=>setFavNameInput(e.target.value)} onKeyDown={e=>e.key==="Enter"&&saveFavorite(user)} placeholder="ex: Durum falafel habituel…" />
                  <div style={{display:"flex",gap:8}}>
                    <button style={{flex:1,background:T.text,color:T.bg,border:"none",borderRadius:10,padding:"10px",fontSize:14,fontWeight:700,cursor:"pointer",fontFamily:"'Syne',sans-serif"}} onClick={()=>saveFavorite(user)}>Sauvegarder</button>
                    <button style={{background:"transparent",border:"1px solid "+T.border,color:T.textMuted,borderRadius:10,padding:"10px 16px",fontSize:13,cursor:"pointer"}} onClick={()=>setShowFavModal(false)}>Annuler</button>
                  </div>
                </div>
              </div>
            )}
            {savedMsg&&<div style={{position:"fixed",bottom:32,left:"50%",transform:"translateX(-50%)",background:T.bg2,border:"1px solid #f59e0b55",color:"#f59e0b",borderRadius:12,padding:"12px 24px",fontSize:14,animation:"toastIn 0.3s ease",zIndex:999}}>⭐ Commande sauvegardée comme favori !</div>}
          </div>
        )}

        {tab==="favorites"&&(
          <div style={{animation:"slideDown 0.3s ease"}}>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,marginBottom:24,color:T.text}}>⭐ Commandes favorites</h2>
            {user!=="Admin"&&(
              (favorites[user]||[]).length===0?(
                <div style={{textAlign:"center",color:T.textFaint,padding:60}}><div style={{fontSize:40,marginBottom:12}}>⭐</div><p>Tu n'as pas encore de favori.</p><p style={{fontSize:13,marginTop:8}}>Dans l'onglet Résumé, clique sur "⭐ Sauvegarder" à côté de ta commande.</p></div>
              ):(
                <div style={{display:"flex",flexDirection:"column",gap:12}}>
                  {(favorites[user]||[]).map(fav=>{
                    const {id:favId,name:favName,...favOrder}=fav;
                    const opt=LUNCH_OPTIONS.find(o=>o.id===favOrder.choice);
                    const currentOrder=orders[user];
                    const isActive=currentOrder?.choice===favOrder.choice&&formatOrder(currentOrder,extras,crudites)===formatOrder(favOrder,extras,crudites);
                    return (
                      <div key={favId} style={{background:T.bg2,border:"2px solid "+(isActive?opt?.accent:T.border),borderRadius:14,padding:"16px 20px",transition:"all 0.2s"}}>
                        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:8}}>
                          <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:14,fontWeight:700,color:T.text}}>{favName}</span><span style={{fontSize:12,color:opt?.accent}}>{opt?.label}</span>{isActive&&<span style={{fontSize:10,background:opt?.accent+"33",color:opt?.accent,padding:"1px 8px",borderRadius:10}}>✓ Actif</span>}</div>
                          <button style={{background:"transparent",border:"none",color:"#f87171",cursor:"pointer",fontSize:15,padding:4}} onClick={async()=>{if(window.confirm(`Supprimer "${favName}" ?`))await deleteFavorite(user,favId);}}>🗑</button>
                        </div>
                        <div style={{fontSize:12,color:T.textMuted,marginBottom:12,lineHeight:1.5}}>{formatOrder(favOrder,extras,crudites)||<em>Aucun détail</em>}</div>
                        <button style={{background:isActive?"#f8717122":opt?.accent+"22",border:"1px solid "+(isActive?"#f8717155":opt?.accent+"55"),color:isActive?"#f87171":opt?.accent,borderRadius:8,padding:"6px 16px",fontSize:13,cursor:"pointer",width:"100%"}}
                          onClick={async()=>{ if(isActive){await deleteDoc(doc(db,"orders",user));}else{await setDoc(doc(db,"orders",user),{...favOrder});setTab("order");} }}>
                          {isActive?"✕ Effacer ma commande":"↩ Commander ça maintenant"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )
            )}
            {user==="Admin"&&(Object.keys(favorites).length===0?<p style={{color:T.textFaint,textAlign:"center",padding:48}}>Aucun favori enregistré.</p>:(
              <div style={{display:"flex",flexDirection:"column",gap:12}}>
                {Object.entries(favorites).map(([username,favList])=>{
                  if(!favList?.length)return null;
                  return (
                    <div key={username} style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:12,padding:"16px 20px"}}>
                      <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                        <div style={{width:28,height:28,borderRadius:6,background:T.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:700,color:T.textMuted}}>{username[0].toUpperCase()}</div>
                        <span style={{fontSize:14,fontWeight:600,color:T.text}}>{username}</span>
                        <span style={{fontSize:12,color:T.textMuted}}>{favList.length} favori{favList.length>1?"s":""}</span>
                      </div>
                      {favList.map(fav=>{
                        const {id:favId,name:favName,...favOrder}=fav;
                        const opt=LUNCH_OPTIONS.find(o=>o.id===favOrder.choice);
                        return (
                          <div key={favId} style={{display:"flex",gap:12,alignItems:"center",padding:"8px 0",borderBottom:"1px solid "+T.border2}}>
                            <span style={{fontSize:12,color:opt?.accent,minWidth:16}}>●</span>
                            <span style={{fontSize:13,fontWeight:600,color:T.text,minWidth:120}}>{favName}</span>
                            <span style={{fontSize:12,color:T.textMuted,flex:1}}>{formatOrder(favOrder,extras,crudites)||<em style={{opacity:0.4}}>Aucun détail</em>}</span>
                            <button style={{background:"transparent",border:"none",color:T.textFaint,cursor:"pointer",fontSize:14,padding:4}} onClick={async()=>{if(window.confirm(`Supprimer "${favName}" de ${username} ?`))await deleteFavorite(username,favId);}}>🗑</button>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}

        {tab==="history"&&(
          <div style={{animation:"slideDown 0.3s ease"}}>
            <h2 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:18,marginBottom:24,color:T.text}}>📅 Historique des commandes</h2>
            {history.length===0&&<p style={{color:T.textFaint,textAlign:"center",padding:48}}>Aucun historique pour l'instant.</p>}
            {history.map(day=>{
              const visibleOrders=user==="Admin"?Object.entries(day.orders||{}):Object.entries(day.orders||{}).filter(([n])=>n===user);
              if(!visibleOrders.length)return null;
              return (
                <div key={day.id} style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:14,padding:"20px 24px",marginBottom:16}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
                    <h3 style={{fontFamily:"'Syne',sans-serif",fontWeight:700,fontSize:16,color:T.text}}>📆 {new Date(day.id).toLocaleDateString("fr-BE",{weekday:"long",day:"numeric",month:"long",year:"numeric"})}</h3>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <span style={{background:T.bg3,color:T.textMuted,fontSize:12,padding:"3px 10px",borderRadius:20}}>{visibleOrders.length} commande{visibleOrders.length>1?"s":""}</span>
                      {user==="Admin"&&(<>
                        <button style={{background:"transparent",border:"1px solid #22c55e55",color:"#22c55e",borderRadius:8,padding:"4px 10px",fontSize:12,cursor:"pointer"}}
                          onClick={async()=>{ if(!window.confirm("Restaurer ces commandes comme commandes du jour ?"))return; await Promise.all(Object.entries(day.orders||{}).map(([name,order])=>setDoc(doc(db,"orders",name),order))); if(day.payments)await setDoc(doc(db,"payments","today"),day.payments); }}>↩ Restaurer</button>
                        <button style={{background:"transparent",border:"1px solid #f8717155",color:"#f87171",borderRadius:8,padding:"4px 10px",fontSize:12,cursor:"pointer"}} onClick={()=>deleteHistory(day.id)}>🗑 Supprimer</button>
                      </>)}
                    </div>
                  </div>
                  {LUNCH_OPTIONS.map(opt=>{
                    const people=visibleOrders.filter(([,o])=>o.choice===opt.id);
                    if(!people.length)return null;
                    return (
                      <div key={opt.id} style={{marginBottom:12,paddingLeft:12,borderLeft:"3px solid "+opt.accent}}>
                        <div style={{fontSize:13,fontWeight:600,color:opt.accent,marginBottom:6}}>{opt.label}</div>
                        {people.map(([name,o],idx)=>{
                          const paid=(day.payments||{})[name]||false;
                          return (
                            <div key={name} style={{display:"flex",gap:12,padding:"5px 0",borderBottom:"1px solid "+T.border2,alignItems:"center"}}>
                              <span style={{fontSize:12,fontWeight:700,color:T.textFaint,minWidth:24,textAlign:"right"}}>{idx+1}.</span>
                              <span style={{fontSize:13,fontWeight:600,minWidth:120,color:T.text,textDecoration:paid?"line-through":"none"}}>{name}</span>
                              <span style={{fontSize:13,color:T.textMuted,flex:1}}>{formatOrder(o,extras)||<em style={{opacity:0.4}}>Aucun détail</em>}</span>
                              <span style={{fontSize:12,padding:"2px 8px",borderRadius:20,background:paid?"#22c55e22":"#f8717122",color:paid?"#22c55e":"#f87171",flexShrink:0}}>{paid?"✓ Payé":"Non payé"}</span>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>
        )}

        {tab==="settings"&&(
          <div style={{animation:"slideDown 0.3s ease"}}>
            {user!=="Admin"?<div style={{textAlign:"center",color:T.textFaint,padding:60}}>🔒 Réservé à l'Admin</div>:(
              <div>
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
                        {editingMember?.username===m.username?(
                          <div style={{display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                            <input style={{...inp,flex:2,minWidth:120,padding:"6px 12px",fontSize:13}} value={editingMember.username} onChange={e=>setEditingMember({...editingMember,username:e.target.value})} />
                            <input style={{...inp,flex:1,minWidth:80,padding:"6px 12px",fontSize:13}} value={editingMember.code} onChange={e=>setEditingMember({...editingMember,code:e.target.value})} />
                            <button style={{...addBtn,padding:"6px 14px",fontSize:13,background:"#22c55e"}} onClick={saveEdit}>✓ Sauver</button>
                            <button style={{background:"transparent",border:"1px solid "+T.border,color:T.textMuted,borderRadius:8,padding:"6px 12px",fontSize:13,cursor:"pointer"}} onClick={()=>setEditingMember(null)}>Annuler</button>
                          </div>
                        ):(
                          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                            <div style={{display:"flex",alignItems:"center",gap:12}}>
                              <div style={{width:32,height:32,borderRadius:8,background:T.bg3,display:"flex",alignItems:"center",justifyContent:"center",fontSize:13,fontWeight:700,color:T.textMuted}}>{m.username[0].toUpperCase()}</div>
                              <div><span style={{fontSize:14,fontWeight:500,color:T.text}}>{m.username}</span><span style={{marginLeft:12,fontSize:12,color:T.textMuted,background:T.bg3,padding:"2px 8px",borderRadius:20}}>code : {m.code}</span></div>
                            </div>
                            <div style={{display:"flex",gap:8}}>
                              <button style={{background:"transparent",border:"1px solid "+T.border,color:T.textMuted,borderRadius:8,padding:"4px 10px",fontSize:12,cursor:"pointer"}} onClick={()=>setEditingMember({...m})}>✏️ Modifier</button>
                              <button style={{background:"transparent",border:"none",color:"#f87171",cursor:"pointer",fontSize:16,padding:4}} onClick={()=>removeMember(m.username)}>✕</button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                {[["🥫 Gérer les sauces",sauces,newSauce,setNewSauce,addSauce,removeSauce,"Nouvelle sauce…","#7c3aed"],["🥗 Gérer les crudités",crudites,newCrudite,setNewCrudite,addCrudite,removeCrudite,"Nouvelle crudité…","#16a34a"],["🥤 Gérer les boissons",boissons,newBoisson,setNewBoisson,addBoisson,removeBoisson,"Nouvelle boisson…","#06b6d4"]].map(([title,list,val,setVal,addFn,removeFn,ph,color])=>(
                  <div key={title} style={{marginBottom:40}}>
                    <h2 style={secTitle}>{title}</h2>
                    <div style={{display:"flex",gap:10,marginBottom:20}}>
                      <input style={{...inp,flex:1}} value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==="Enter"&&addFn()} placeholder={ph} />
                      <button style={addBtn} onClick={addFn}>+ Ajouter</button>
                    </div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                      {list.map(s=>(<div key={s} style={{background:T.bg2,border:"1px solid "+color+"44",borderRadius:20,padding:"5px 12px",display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:13,color:T.text}}>{s}</span><button style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:14,padding:"0 0 0 6px"}} onClick={()=>removeFn(s)}>✕</button></div>))}
                    </div>
                  </div>
                ))}
                <div style={{marginBottom:40}}>
                  <h2 style={secTitle}>➕ Catégories personnalisées</h2>
                  <div style={{background:T.bg2,border:"1px solid "+T.border,borderRadius:12,padding:"16px 20px",marginBottom:20}}>
                    <p style={{fontSize:13,color:T.textMuted,marginBottom:12}}>Nouvelle catégorie</p>
                    <input style={{...inp,marginBottom:12}} value={newExtraLabel} onChange={e=>setNewExtraLabel(e.target.value)} placeholder="Nom de la catégorie (ex: Toppings, Dips…)" />
                    <div style={{marginBottom:12}}>
                      <p style={{fontSize:12,color:T.textMuted,marginBottom:8}}>Applicable à :</p>
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        {LUNCH_OPTIONS.map(opt=>(<button key={opt.id} onClick={()=>toggleExtraApplies(opt.id)} style={{...pill(opt.accent,newExtraApplies.includes(opt.id),false),padding:"5px 14px",fontSize:13}}>{opt.label}</button>))}
                      </div>
                    </div>
                    <button style={{...addBtn,background:newExtraLabel&&newExtraApplies.length?T.text:"#444",cursor:newExtraLabel&&newExtraApplies.length?"pointer":"not-allowed"}} onClick={addExtraCategory}>+ Créer la catégorie</button>
                  </div>
                  {extras.length===0&&<p style={{color:T.textFaint,fontSize:13}}>Aucune catégorie personnalisée pour l'instant.</p>}
                  {extras.map(ex=>(
                    <div key={ex.id} style={{background:T.bg2,border:"1px solid "+T.border,borderLeft:"3px solid "+ex.accent,borderRadius:12,padding:"16px 20px",marginBottom:12}}>
                      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
                        <div><span style={{fontSize:15,fontWeight:700,color:T.text}}>{ex.label}</span><span style={{marginLeft:10,fontSize:12,color:T.textMuted}}>→ {ex.appliesTo.map(id=>LUNCH_OPTIONS.find(o=>o.id===id)?.label).join(", ")}</span></div>
                        <button style={{background:"transparent",border:"1px solid #f8717155",color:"#f87171",borderRadius:8,padding:"4px 10px",fontSize:12,cursor:"pointer"}} onClick={()=>removeExtraCategory(ex.id)}>🗑 Supprimer</button>
                      </div>
                      <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:10}}>
                        {ex.options.map(o=>(<div key={o} style={{background:T.bg3,border:"1px solid "+T.border,borderRadius:20,padding:"4px 12px",display:"flex",alignItems:"center",gap:4}}><span style={{fontSize:13,color:T.text}}>{o}</span><button style={{background:"none",border:"none",color:"#f87171",cursor:"pointer",fontSize:13,padding:"0 0 0 4px"}} onClick={()=>removeExtraOption(ex.id,o)}>✕</button></div>))}
                      </div>
                      <div style={{display:"flex",gap:8}}>
                        <input style={{...inp,flex:1,padding:"6px 12px",fontSize:13}} value={newExtraOption[ex.id]||""} onChange={e=>setNewExtraOption(prev=>({...prev,[ex.id]:e.target.value}))} onKeyDown={e=>e.key==="Enter"&&addExtraOption(ex.id)} placeholder={`Nouvelle option pour "${ex.label}"…`} />
                        <button style={{...addBtn,padding:"6px 14px",fontSize:13}} onClick={()=>addExtraOption(ex.id)}>+ Ajouter</button>
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
