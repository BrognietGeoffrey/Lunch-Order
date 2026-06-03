import { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc, deleteDoc, onSnapshot, collection } from "firebase/firestore";

// ── Firebase ──────────────────────────────────────────────────────────────────
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

const USERS = [
  { username: "Boryana",       code: "200" },
  { username: "Maïté",         code: "201" },
  { username: "Audrey",        code: "202" },
  { username: "Dorothée",      code: "203" },
  { username: "Salle d'acte",  code: "204" },
  { username: "Catherine",     code: "205" },
  { username: "Diana",         code: "206" },
  { username: "Julie",         code: "207" },
  { username: "Frédérique",    code: "208" },
  { username: "Sarah",         code: "210" },
  { username: "Admin",         code: "0000" },
];

const DEFAULT_NAMES = [
  "Boryana", "Maïté", "Audrey", "Dorothée",
  "Salle d'acte", "Catherine", "Diana", "Julie", "Frédérique", "Sarah",
];

const DEFAULT_SAUCES   = ["Mayo", "Ketchup", "Andalouse", "Samourai", "Pickles", "Cocktail"];
const DEFAULT_CRUDITES = ["Tomate", "Salade", "Oignon", "Cornichon", "Poivron"];

const LUNCH_OPTIONS = [
  { id: "ice-cream",    label: "🍦 Ice Cream",    accent: "#ec4899" },
  { id: "snack-merode", label: "🥪 Snack Merode", accent: "#0891b2" },
  { id: "libanais",     label: "🥙 Libanais",     accent: "#16a34a" },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
function formatOrder(o) {
  if (!o?.choice) return "";
  const parts = [o.boules, o.snackType, o.frites];
  if (o.crudites?.length) parts.push("Crudités: " + o.crudites.join(", "));
  if (o.sauces?.length) parts.push(o.sauces.join(", "));
  if (o.detail) parts.push(o.detail);
  return parts.filter(Boolean).join(" · ");
}

// ── Login ─────────────────────────────────────────────────────────────────────
function LoginScreen({ onLogin }) {
  const [username, setUsername] = useState("");
  const [code, setCode]         = useState("");
  const [error, setError]       = useState("");
  const [shake, setShake]       = useState(false);

  const attempt = () => {
    const user = USERS.find(u => u.username.toLowerCase() === username.toLowerCase() && u.code === code.trim());
    if (user) { onLogin(user.username); }
    else {
      setError("Nom ou code invalide.");
      setShake(true);
      setTimeout(() => setShake(false), 600);
    }
  };

  return (
    <div style={S.loginBg}>
      <style>{CSS_GLOBAL}</style>
      <div style={{ ...S.loginCard, animation: shake ? "shake 0.5s" : "fadeIn 0.5s both" }}>
        <div style={{ fontSize: 52, marginBottom: 12 }}>🍽️</div>
        <h1 style={S.loginTitle}>Lunch Orders</h1>
        <p style={S.loginSub}>Connecte-toi pour commander</p>
        <div style={S.field}>
          <label style={S.label}>Nom</label>
          <select style={S.select} value={username} onChange={e => setUsername(e.target.value)}>
            <option value="">— Choisis ton nom —</option>
            {USERS.filter(u => u.username !== "Admin").map(u => (
              <option key={u.username} value={u.username}>{u.username}</option>
            ))}
          </select>
        </div>
        <div style={S.field}>
          <label style={S.label}>Code (numéro de poste)</label>
          <input style={S.input} type="password" value={code} placeholder="••••"
            onChange={e => setCode(e.target.value)} onKeyDown={e => e.key === "Enter" && attempt()} />
        </div>
        {error && <p style={{ color: "#f87171", fontSize: 13, marginBottom: 10 }}>{error}</p>}
        <button style={S.loginBtn} onClick={attempt}>Entrer →</button>
        <p style={{ color: "#444", fontSize: 11, marginTop: 18 }}>Ton code = ton numéro de poste 😉</p>
      </div>
    </div>
  );
}

// ── Main App ──────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser]         = useState(null);
  const [names, setNames]       = useState(DEFAULT_NAMES);
  const [orders, setOrders]     = useState({});
  const [favorites, setFavorites] = useState({});
  const [sauces, setSauces]       = useState(DEFAULT_SAUCES);
  const [crudites, setCrudites]   = useState(DEFAULT_CRUDITES);
  const [newName, setNewName]     = useState("");
  const [newSauce, setNewSauce]   = useState("");
  const [newCrudite, setNewCrudite] = useState("");
  const [tab, setTab]           = useState("order");
  const [status, setStatus]     = useState("connecting");
  const [savedMsg, setSavedMsg] = useState(false);
  const detailTimers            = useRef({});

  // ── Firestore listeners ───────────────────────────────────────────────────
  useEffect(() => {
    const unsubOrders = onSnapshot(collection(db, "orders"),
      snap => { const d = {}; snap.forEach(s => { d[s.id] = s.data(); }); setOrders(d); setStatus("live"); },
      () => setStatus("error")
    );
    const unsubNames = onSnapshot(doc(db, "config", "names"), snap => {
      if (snap.exists() && snap.data().list) setNames(snap.data().list);
    });
    const unsubSauces = onSnapshot(doc(db, "config", "sauces"), snap => {
      if (snap.exists() && snap.data().list) setSauces(snap.data().list);
    });
    const unsubCrudites = onSnapshot(doc(db, "config", "crudites"), snap => {
      if (snap.exists() && snap.data().list) setCrudites(snap.data().list);
    });
    const unsubFavs = onSnapshot(collection(db, "favorites"),
      snap => { const d = {}; snap.forEach(s => { d[s.id] = s.data(); }); setFavorites(d); }
    );
    return () => { unsubOrders(); unsubNames(); unsubSauces(); unsubCrudites(); unsubFavs(); };
  }, []);

  // ── Load favorite on login ────────────────────────────────────────────────
  useEffect(() => {
    if (!user || user === "Admin") return;
    const fav = favorites[user];
    if (!fav?.choice) return;
    const cur = orders[user];
    if (!cur?.choice) {
      setDoc(doc(db, "orders", user), { ...fav });
    }
  }, [user, favorites]);

  if (!user) return <LoginScreen onLogin={u => setUser(u)} />;

  // ── Helpers ───────────────────────────────────────────────────────────────
  const persistNames = async list => { setNames(list); await setDoc(doc(db, "config", "names"), { list }); };
  const persistSauces = async list => { setSauces(list); await setDoc(doc(db, "config", "sauces"), { list }); };
  const persistCrudites = async list => { setCrudites(list); await setDoc(doc(db, "config", "crudites"), { list }); };

  const addName = async () => {
    const n = newName.trim();
    if (n && !names.includes(n)) { await persistNames([...names, n]); setNewName(""); }
  };
  const removeName = async name => {
    await persistNames(names.filter(x => x !== name));
    await deleteDoc(doc(db, "orders", name));
  };
  const addSauce = async () => {
    const s = newSauce.trim();
    if (s && !sauces.includes(s)) { await persistSauces([...sauces, s]); setNewSauce(""); }
  };
  const removeSauce = async s => { await persistSauces(sauces.filter(x => x !== s)); };
  const addCrudite = async () => {
    const c = newCrudite.trim();
    if (c && !crudites.includes(c)) { await persistCrudites([...crudites, c]); setNewCrudite(""); }
  };
  const removeCrudite = async c => { await persistCrudites(crudites.filter(x => x !== c)); };

  const toggleChoice = async (name, choice) => {
    const cur = orders[name] || {};
    if (cur.choice === choice) { await deleteDoc(doc(db, "orders", name)); }
    else { await setDoc(doc(db, "orders", name), { choice, detail: "", sauces: [], crudites: "non", boules: "", snackType: "", frites: "" }); }
  };

  const handleDetail = (name, detail) => {
    setOrders(prev => ({ ...prev, [name]: { ...prev[name], detail } }));
    clearTimeout(detailTimers.current[name]);
    detailTimers.current[name] = setTimeout(async () => {
      const cur = orders[name] || {};
      if (!cur.choice) return;
      await setDoc(doc(db, "orders", name), { ...cur, detail });
    }, 600);
  };

  const handleSubDetail = async (name, field, value) => {
    const cur = orders[name] || {};
    if (!cur.choice) return;
    const updated = { ...cur, [field]: value };
    setOrders(prev => ({ ...prev, [name]: updated }));
    await setDoc(doc(db, "orders", name), updated);
  };

  const toggleSauce = async (name, sauce) => {
    const cur = orders[name] || {};
    if (!cur.choice) return;
    const current = cur.sauces || [];
    const updated = current.includes(sauce) ? current.filter(s => s !== sauce) : [...current, sauce];
    const newOrder = { ...cur, sauces: updated };
    setOrders(prev => ({ ...prev, [name]: newOrder }));
    await setDoc(doc(db, "orders", name), newOrder);
  };

  const toggleCrudite = async (name, crudite) => {
    const cur = orders[name] || {};
    if (!cur.choice) return;
    const current = cur.crudites || [];
    const updated = current.includes(crudite) ? current.filter(c => c !== crudite) : [...current, crudite];
    const newOrder = { ...cur, crudites: updated };
    setOrders(prev => ({ ...prev, [name]: newOrder }));
    await setDoc(doc(db, "orders", name), newOrder);
  };

  const saveFavorite = async (name) => {
    const cur = orders[name];
    if (!cur?.choice) return;
    await setDoc(doc(db, "favorites", name), { ...cur });
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 2500);
  };

  const resetAll = async () => {
    if (!window.confirm("Effacer toutes les commandes du jour ?")) return;
    await Promise.all(names.map(n => deleteDoc(doc(db, "orders", n))));
  };

  const totalOrdered = names.filter(n => orders[n]?.choice).length;
  const notOrdered   = names.filter(n => !orders[n]?.choice);
  const counts = LUNCH_OPTIONS.reduce((a, o) => { a[o.id] = names.filter(n => orders[n]?.choice === o.id).length; return a; }, {});

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={S.appBg}>
      <style>{CSS_GLOBAL}</style>

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerInner}>
          <span style={S.logo}>🍽️ Lunch Orders</span>
          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
            <span style={{ fontSize:12, color: status==="live"?"#22c55e":status==="error"?"#f87171":"#f59e0b", animation:status==="connecting"?"pulse 1.2s infinite":"none" }}>
              {status==="live"?"● En direct":status==="error"?"● Erreur":"⟳ Connexion…"}
            </span>
            <span style={{ fontSize:13, color:"#888" }}>👤 {user}</span>
            <button style={S.logoutBtn} onClick={() => setUser(null)}>Déconnexion</button>
          </div>
        </div>
        <div style={S.tabs}>
          {[["order","📋 Commander"],["summary","📊 Résumé"],["settings","⚙️ Config"]].map(([id,label]) => (
            <button key={id} style={{ ...S.tab, ...(tab===id?S.tabActive:{}) }} onClick={() => setTab(id)}>{label}</button>
          ))}
        </div>
      </header>

      <main style={S.main}>

        {/* ════════ ORDER TAB ════════ */}
        {tab === "order" && (
          <div style={{ animation:"slideDown 0.3s ease" }}>

            {/* Ma commande favorite */}
            {user !== "Admin" && favorites[user]?.choice && (
              <section style={{ ...S.section, marginBottom:24 }}>
                <div style={S.favBanner}>
                  <span style={{ fontSize:13, color:"#aaa" }}>
                    ⭐ Ton favori : <strong style={{ color:"#f1f1f5" }}>{formatOrder(favorites[user])}</strong>
                  </span>
                  <button style={S.favLoadBtn} onClick={async () => {
                    await setDoc(doc(db, "orders", user), { ...favorites[user] });
                  }}>Recharger</button>
                </div>
              </section>
            )}

            {/* Add name — Admin only */}
            {user === "Admin" && (
              <section style={S.section}>
                <h2 style={S.secTitle}>Gérer les noms</h2>
                <div style={{ display:"flex", gap:10 }}>
                  <input style={{ ...S.input, flex:1 }} value={newName}
                    onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key==="Enter" && addName()}
                    placeholder="Ajouter un nom…" />
                  <button style={S.addBtn} onClick={addName}>+ Ajouter</button>
                </div>
              </section>
            )}

            {/* Table */}
            <section style={S.section}>
              <h2 style={S.secTitle}>
                Commandes du jour
                <span style={S.badge}>{totalOrdered} / {names.length}</span>
              </h2>
              <div style={S.tableWrap}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={{ ...S.th, width:160 }}>Nom</th>
                      {LUNCH_OPTIONS.map(o => <th key={o.id} style={S.th}>{o.label}</th>)}
                      <th style={S.th}>Détails</th>
                      <th style={{ ...S.th, width:44 }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {names.map(name => {
                      const order  = orders[name] || {};
                      const chosen = LUNCH_OPTIONS.find(o => o.id === order.choice);
                      const canEdit = user === name || user === "Admin";
                      return (
                        <tr key={name} className="datarow">
                          {/* Name */}
                          <td style={S.td}>
                            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                              <div style={{ ...S.avatar, background:chosen?chosen.accent+"28":"#2a2a38", color:chosen?chosen.accent:"#888" }}>
                                {name[0].toUpperCase()}
                              </div>
                              <div>
                                <span style={{ fontSize:14, fontWeight:500 }}>{name}</span>
                                {user===name && <span style={{ display:"block", fontSize:10, color:"#555" }}>● toi</span>}
                              </div>
                            </div>
                          </td>

                          {/* Choice buttons */}
                          {LUNCH_OPTIONS.map(opt => (
                            <td key={opt.id} style={{ ...S.td, textAlign:"center" }}>
                              <button
                                style={{ ...S.choiceBtn, ...(order.choice===opt.id?{background:opt.accent,color:"#fff",borderColor:opt.accent}:{}), ...(!canEdit?{opacity:0.3,cursor:"not-allowed"}:{}) }}
                                onClick={() => canEdit && toggleChoice(name, opt.id)}
                              >{order.choice===opt.id?"✓":"○"}</button>
                            </td>
                          ))}

                          {/* Detail cell */}
                          <td style={S.td}>
                            {!order.choice && (
                              <span style={{ fontSize:12, color:"#444" }}>{canEdit?"Choisis d'abord":"🔒"}</span>
                            )}

                            {/* 🍦 Ice Cream */}
                            {order.choice==="ice-cream" && (
                              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                                <div style={{ display:"flex", gap:6 }}>
                                  {["1 boule","2 boules"].map(opt => (
                                    <button key={opt} disabled={!canEdit}
                                      onClick={() => canEdit && handleSubDetail(name,"boules",order.boules===opt?"":opt)}
                                      style={{ ...S.pill, ...(order.boules===opt?{background:"#ec4899",color:"#fff",borderColor:"#ec4899"}:{}), ...(!canEdit?{opacity:0.3,cursor:"not-allowed"}:{}) }}
                                    >{opt}</button>
                                  ))}
                                </div>
                                <textarea style={{ ...S.textarea, borderColor:"#ec489966", opacity:canEdit?1:0.35 }}
                                  rows={1} disabled={!canEdit} value={order.detail||""}
                                  onChange={e => handleDetail(name,e.target.value)}
                                  placeholder={canEdit?"Parfum(s)…":"🔒"} />
                              </div>
                            )}

                            {/* 🥪 Snack Merode */}
                            {order.choice==="snack-merode" && (
                              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                                {/* Durum / Bicky */}
                                <div style={{ display:"flex", gap:6 }}>
                                  {["Durum","Bicky"].map(opt => (
                                    <button key={opt} disabled={!canEdit}
                                      onClick={() => canEdit && handleSubDetail(name,"snackType",order.snackType===opt?"":opt)}
                                      style={{ ...S.pill, ...(order.snackType===opt?{background:"#0891b2",color:"#fff",borderColor:"#0891b2"}:{}), ...(!canEdit?{opacity:0.3,cursor:"not-allowed"}:{}) }}
                                    >{opt}</button>
                                  ))}
                                </div>
                                {/* Frites */}
                                <div style={{ display:"flex", gap:6 }}>
                                  {["Frite dedans","Frite à part"].map(opt => (
                                    <button key={opt} disabled={!canEdit}
                                      onClick={() => canEdit && handleSubDetail(name,"frites",order.frites===opt?"":opt)}
                                      style={{ ...S.pill, ...(order.frites===opt?{background:"#f59e0b",color:"#fff",borderColor:"#f59e0b"}:{}), ...(!canEdit?{opacity:0.3,cursor:"not-allowed"}:{}) }}
                                    >{opt}</button>
                                  ))}
                                </div>
                                {/* Crudités multi-select */}
                                <div style={{ display:"flex", flexWrap:"wrap", gap:5, alignItems:"center" }}>
                                  <span style={{ fontSize:12, color:"#888", width:"100%" }}>Crudités :</span>
                                  {crudites.map(crudite => {
                                    const sel = (order.crudites||[]).includes(crudite);
                                    return (
                                      <button key={crudite} disabled={!canEdit}
                                        onClick={() => canEdit && toggleCrudite(name, crudite)}
                                        style={{ ...S.pill, ...(sel?{background:"#16a34a",color:"#fff",borderColor:"#16a34a"}:{}), ...(!canEdit?{opacity:0.3,cursor:"not-allowed"}:{}) }}
                                      >{crudite}</button>
                                    );
                                  })}
                                </div>
                                {/* Sauces */}
                                <div style={{ display:"flex", flexWrap:"wrap", gap:5, alignItems:"center" }}>
                                  <span style={{ fontSize:12, color:"#888", width:"100%" }}>Sauces :</span>
                                  {sauces.map(sauce => {
                                    const sel = (order.sauces||[]).includes(sauce);
                                    return (
                                      <button key={sauce} disabled={!canEdit}
                                        onClick={() => canEdit && toggleSauce(name, sauce)}
                                        style={{ ...S.pill, ...(sel?{background:"#7c3aed",color:"#fff",borderColor:"#7c3aed"}:{}), ...(!canEdit?{opacity:0.3,cursor:"not-allowed"}:{}) }}
                                      >{sauce}</button>
                                    );
                                  })}
                                </div>
                                <textarea style={{ ...S.textarea, borderColor:"#0891b266", opacity:canEdit?1:0.35 }}
                                  rows={1} disabled={!canEdit} value={order.detail||""}
                                  onChange={e => handleDetail(name,e.target.value)}
                                  placeholder={canEdit?"Commentaire…":"🔒"} />
                              </div>
                            )}

                            {/* 🥙 Libanais */}
                            {order.choice==="libanais" && (
                              <textarea style={{ ...S.textarea, borderColor:"#16a34a66", opacity:canEdit?1:0.35 }}
                                rows={2} disabled={!canEdit} value={order.detail||""}
                                onChange={e => handleDetail(name,e.target.value)}
                                placeholder={canEdit?"Précise ta commande…":"🔒"} />
                            )}
                          </td>

                          {/* Remove — Admin only */}
                          <td style={{ ...S.td, textAlign:"center" }}>
                            {user==="Admin" && (
                              <button style={S.removeBtn} onClick={() => removeName(name)}>✕</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        )}

        {/* ════════ SUMMARY TAB ════════ */}
        {tab === "summary" && (
          <div style={{ animation:"slideDown 0.3s ease" }}>
            <section style={S.section}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
                <h2 style={{ ...S.secTitle, marginBottom:0 }}>Résumé des commandes</h2>
                <button style={S.resetBtn} onClick={resetAll}>🗑 Réinitialiser le jour</button>
              </div>

              {/* Count cards */}
              <div style={{ display:"flex", gap:16, marginBottom:28, flexWrap:"wrap" }}>
                {LUNCH_OPTIONS.map(opt => (
                  <div key={opt.id} style={{ ...S.card, borderColor:opt.accent }}>
                    <div style={{ fontSize:48, fontWeight:800, fontFamily:"'Syne',sans-serif", color:opt.accent, lineHeight:1 }}>{counts[opt.id]}</div>
                    <div style={{ fontSize:14, color:"#aaa", marginTop:6 }}>{opt.label}</div>
                  </div>
                ))}
              </div>

              {/* Detail groups */}
              <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
                {LUNCH_OPTIONS.map(opt => {
                  const people = names.filter(n => orders[n]?.choice === opt.id);
                  if (!people.length) return null;
                  return (
                    <div key={opt.id} style={{ ...S.summaryGroup, borderLeftColor:opt.accent }}>
                      <h3 style={{ fontSize:14, fontWeight:700, color:opt.accent, marginBottom:12, fontFamily:"'Syne',sans-serif" }}>{opt.label}</h3>
                      {people.map(name => (
                        <div key={name} style={S.summaryRow}>
                          <span style={{ fontSize:13, fontWeight:600, minWidth:120, color:"#ccc" }}>{name}</span>
                          <span style={{ fontSize:13, color:"#999", flex:1 }}>
                            {formatOrder(orders[name]) || <em style={{ opacity:0.4 }}>Aucun détail</em>}
                          </span>
                          {/* Save favorite button — only for own row */}
                          {name === user && (
                            <button
                              style={{ ...S.favBtn, ...(favorites[name]?.choice===orders[name]?.choice&&formatOrder(favorites[name])===formatOrder(orders[name])?{color:"#f59e0b"}:{}) }}
                              onClick={() => saveFavorite(name)}
                              title="Sauvegarder comme favori"
                            >⭐</button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
                {totalOrdered===0 && <p style={{ color:"#555", textAlign:"center", padding:48 }}>Aucune commande pour l'instant.</p>}
              </div>

              {/* Not ordered */}
              {notOrdered.length>0 && (
                <div style={S.notOrdered}>
                  <span style={{ color:"#888", fontSize:13 }}>⏳ Pas encore commandé :</span>
                  {notOrdered.map(n => <span key={n} style={S.chip}>{n}</span>)}
                </div>
              )}

              {/* Saved confirmation */}
              {savedMsg && (
                <div style={S.toast}>⭐ Commande sauvegardée comme favori !</div>
              )}
            </section>
          </div>
        )}

        {/* ════════ CONFIG TAB ════════ */}
        {tab === "settings" && (
          <div style={{ animation:"slideDown 0.3s ease" }}>
            {user !== "Admin" ? (
              <div style={{ textAlign:"center", color:"#555", padding:60 }}>
                🔒 Réservé à l'Admin
              </div>
            ) : (
              <section style={S.section}>
                <h2 style={S.secTitle}>⚙️ Gérer les sauces</h2>
                <div style={{ display:"flex", gap:10, marginBottom:20 }}>
                  <input style={{ ...S.input, flex:1 }} value={newSauce}
                    onChange={e => setNewSauce(e.target.value)} onKeyDown={e => e.key==="Enter" && addSauce()}
                    placeholder="Nouvelle sauce…" />
                  <button style={S.addBtn} onClick={addSauce}>+ Ajouter</button>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {sauces.map(s => (
                    <div key={s} style={S.sauceTag}>
                      <span style={{ fontSize:13 }}>{s}</span>
                      <button style={{ background:"none", border:"none", color:"#f87171", cursor:"pointer", fontSize:14, padding:"0 0 0 6px" }} onClick={() => removeSauce(s)}>✕</button>
                    </div>
                  ))}
                </div>
              </section>

              <section style={S.section}>
                <h2 style={S.secTitle}>🥗 Gérer les crudités</h2>
                <div style={{ display:"flex", gap:10, marginBottom:20 }}>
                  <input style={{ ...S.input, flex:1 }} value={newCrudite}
                    onChange={e => setNewCrudite(e.target.value)} onKeyDown={e => e.key==="Enter" && addCrudite()}
                    placeholder="Nouvelle crudité…" />
                  <button style={S.addBtn} onClick={addCrudite}>+ Ajouter</button>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                  {crudites.map(c => (
                    <div key={c} style={S.sauceTag}>
                      <span style={{ fontSize:13 }}>{c}</span>
                      <button style={{ background:"none", border:"none", color:"#f87171", cursor:"pointer", fontSize:14, padding:"0 0 0 6px" }} onClick={() => removeCrudite(c)}>✕</button>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

      </main>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────
const CSS_GLOBAL = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;700;800&family=DM+Sans:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { background: #0f0f13; }
  textarea { resize: vertical; }
  input:focus, textarea:focus, button:focus, select:focus { outline: none; }
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-thumb { background: #3f3f52; border-radius: 3px; }
  @keyframes fadeIn    { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  @keyframes shake     { 0%,100%{transform:translateX(0)} 20%{transform:translateX(-8px)} 40%{transform:translateX(8px)} 60%{transform:translateX(-6px)} 80%{transform:translateX(6px)} }
  @keyframes slideDown { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
  @keyframes pulse     { 0%,100%{opacity:1} 50%{opacity:0.3} }
  @keyframes toastIn   { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
  tr.datarow:hover td  { background: #1c1c28; }
`;

const S = {
  loginBg:   { minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", background:"linear-gradient(135deg,#0f0f13,#151528)", fontFamily:"'DM Sans',sans-serif" },
  loginCard: { background:"#16161f", border:"1px solid #2a2a38", borderRadius:20, padding:"48px 40px", width:360, textAlign:"center", boxShadow:"0 24px 80px rgba(0,0,0,.6)" },
  loginTitle:{ fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:28, color:"#f1f1f5", marginBottom:6 },
  loginSub:  { color:"#888", fontSize:14, marginBottom:32 },
  field:     { textAlign:"left", marginBottom:16 },
  label:     { display:"block", fontSize:11, fontWeight:600, color:"#888", marginBottom:6, letterSpacing:"0.08em", textTransform:"uppercase" },
  select:    { width:"100%", background:"#0f0f13", border:"1px solid #2a2a38", borderRadius:10, color:"#f1f1f5", padding:"10px 14px", fontSize:14, fontFamily:"'DM Sans',sans-serif" },
  input:     { width:"100%", background:"#0f0f13", border:"1px solid #2a2a38", borderRadius:10, color:"#f1f1f5", padding:"10px 14px", fontSize:14, fontFamily:"'DM Sans',sans-serif" },
  loginBtn:  { width:"100%", background:"#f1f1f5", color:"#0f0f13", border:"none", borderRadius:10, padding:"12px 0", fontSize:15, fontWeight:700, fontFamily:"'Syne',sans-serif", cursor:"pointer", marginTop:8 },

  appBg:       { minHeight:"100vh", background:"#0f0f13", fontFamily:"'DM Sans',sans-serif", color:"#f1f1f5" },
  header:      { background:"#16161f", borderBottom:"1px solid #2a2a38", position:"sticky", top:0, zIndex:100 },
  headerInner: { maxWidth:1200, margin:"0 auto", padding:"14px 24px", display:"flex", alignItems:"center", justifyContent:"space-between" },
  logo:        { fontFamily:"'Syne',sans-serif", fontWeight:800, fontSize:20 },
  logoutBtn:   { background:"transparent", border:"1px solid #2a2a38", color:"#888", borderRadius:8, padding:"6px 14px", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },
  tabs:        { maxWidth:1200, margin:"0 auto", padding:"0 24px", display:"flex" },
  tab:         { background:"transparent", border:"none", color:"#666", padding:"10px 18px", fontSize:13, fontWeight:600, cursor:"pointer", borderBottom:"2px solid transparent", fontFamily:"'DM Sans',sans-serif", transition:"all 0.2s" },
  tabActive:   { color:"#f1f1f5", borderBottomColor:"#f1f1f5" },

  main:    { maxWidth:1200, margin:"0 auto", padding:"32px 24px" },
  section: { marginBottom:40 },
  secTitle:{ fontFamily:"'Syne',sans-serif", fontWeight:700, fontSize:18, color:"#f1f1f5", marginBottom:18, display:"flex", alignItems:"center", gap:12 },
  badge:   { background:"#2a2a38", color:"#aaa", fontSize:12, padding:"3px 10px", borderRadius:20 },

  addBtn:   { background:"#f1f1f5", color:"#0f0f13", border:"none", borderRadius:10, padding:"10px 20px", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'Syne',sans-serif", whiteSpace:"nowrap" },
  resetBtn: { background:"#1e1e2a", color:"#f87171", border:"1px solid #3f3f52", borderRadius:10, padding:"8px 16px", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans',sans-serif" },

  tableWrap: { overflowX:"auto", borderRadius:14, border:"1px solid #2a2a38" },
  table:     { width:"100%", borderCollapse:"collapse", minWidth:780 },
  th:        { background:"#1a1a28", color:"#777", fontSize:11, fontWeight:600, textTransform:"uppercase", letterSpacing:"0.07em", padding:"12px 16px", textAlign:"left", borderBottom:"1px solid #2a2a38" },
  td:        { padding:"10px 16px", verticalAlign:"middle", borderBottom:"1px solid #1c1c28", transition:"background 0.15s" },

  avatar:    { width:32, height:32, borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, flexShrink:0, transition:"all 0.3s" },
  choiceBtn: { width:34, height:34, borderRadius:8, border:"1px solid #2a2a38", background:"#1a1a28", color:"#666", fontSize:15, cursor:"pointer", transition:"all 0.18s", fontFamily:"inherit" },
  pill:      { background:"#1a1a28", border:"1px solid #2a2a38", borderRadius:20, padding:"3px 10px", fontSize:12, color:"#aaa", cursor:"pointer", transition:"all 0.15s", fontFamily:"inherit", whiteSpace:"nowrap" },
  textarea:  { width:"100%", minWidth:180, background:"#0f0f13", border:"1px solid", borderRadius:8, color:"#f1f1f5", padding:"8px 10px", fontSize:13, fontFamily:"'DM Sans',sans-serif", lineHeight:1.5, transition:"border-color 0.25s, opacity 0.25s" },
  removeBtn: { background:"transparent", border:"none", color:"#3a3a4a", fontSize:16, cursor:"pointer", padding:4, borderRadius:6 },

  card:        { flex:1, minWidth:140, background:"#16161f", border:"1px solid", borderRadius:14, padding:"20px 24px", textAlign:"center" },
  summaryGroup:{ background:"#16161f", border:"1px solid #2a2a38", borderLeft:"3px solid", borderRadius:12, padding:"16px 20px" },
  summaryRow:  { display:"flex", gap:12, alignItems:"center", padding:"8px 0", borderBottom:"1px solid #1e1e2a" },
  notOrdered:  { display:"flex", flexWrap:"wrap", gap:8, alignItems:"center", marginTop:24, padding:"14px 18px", background:"#16161f", border:"1px solid #2a2a38", borderRadius:12 },
  chip:        { background:"#2a2a38", color:"#888", fontSize:12, padding:"3px 10px", borderRadius:20 },

  favBanner:  { background:"#1a1a28", border:"1px solid #2a2a38", borderRadius:12, padding:"12px 18px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:12 },
  favLoadBtn: { background:"#f59e0b22", border:"1px solid #f59e0b55", color:"#f59e0b", borderRadius:8, padding:"5px 12px", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans',sans-serif", whiteSpace:"nowrap" },
  favBtn:     { background:"transparent", border:"none", fontSize:16, cursor:"pointer", padding:"2px 6px", color:"#444", flexShrink:0 },
  toast:      { position:"fixed", bottom:32, left:"50%", transform:"translateX(-50%)", background:"#1a1a28", border:"1px solid #f59e0b55", color:"#f59e0b", borderRadius:12, padding:"12px 24px", fontSize:14, animation:"toastIn 0.3s ease", zIndex:999 },

  sauceTag:   { background:"#1a1a28", border:"1px solid #2a2a38", borderRadius:20, padding:"5px 12px", display:"flex", alignItems:"center", gap:4 },
};