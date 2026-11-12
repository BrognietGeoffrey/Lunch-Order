// ── Destinataires des alertes stock (partagé entre l'app et api/stock-alert.js) ──
// config/etude.alertRecipients = [{ email, instant, digest, days:[0-6], hour }]
//   instant : reçoit le mail immédiat quand un article passe « à commander »
//   digest  : reçoit le récapitulatif, les jours `days` (0 = dimanche … 6 = samedi) à partir de `hour` h (heure de Bruxelles)
// config/etude.digestSent = { [email]: "AAAA-MM-JJ" }  → un seul récap par personne et par jour
// Ancien format (alertEmails[], alertInstant, alertDigest) repris automatiquement.

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const TZ = "Europe/Brussels";
export const WEEKDAYS = [
  { id: 1, short: "L", label: "lundi" }, { id: 2, short: "M", label: "mardi" }, { id: 3, short: "M", label: "mercredi" },
  { id: 4, short: "J", label: "jeudi" }, { id: 5, short: "V", label: "vendredi" }, { id: 6, short: "S", label: "samedi" },
  { id: 0, short: "D", label: "dimanche" },
];
export const DEFAULT_RECIPIENT = { instant: true, digest: true, days: [1, 2, 3, 4, 5], hour: 7 };

const clampHour = h => { const n = Math.round(Number(h)); return Number.isFinite(n) ? Math.min(23, Math.max(0, n)) : DEFAULT_RECIPIENT.hour; };
const cleanDays = d => Array.isArray(d) ? [...new Set(d.map(Number).filter(x => x >= 0 && x <= 6))] : [...DEFAULT_RECIPIENT.days];

export function recipientsOf(cfg = {}) {
  if (Array.isArray(cfg.alertRecipients)) {
    return cfg.alertRecipients
      .filter(r => EMAIL_RE.test(r?.email || ""))
      .map(r => ({ email: r.email.trim().toLowerCase(), instant: r.instant !== false, digest: r.digest !== false, days: cleanDays(r.days), hour: clampHour(r.hour ?? DEFAULT_RECIPIENT.hour) }));
  }
  return (cfg.alertEmails || []).filter(e => EMAIL_RE.test(e)).map(email => ({
    email: email.trim().toLowerCase(), instant: cfg.alertInstant !== false, digest: cfg.alertDigest !== false, days: [...DEFAULT_RECIPIENT.days], hour: DEFAULT_RECIPIENT.hour,
  }));
}

// Jour (0-6), heure et date du jour à Bruxelles
export function localNow(d = new Date(), tz = TZ) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short", hour: "numeric", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" })
    .formatToParts(d).map(x => [x.type, x.value]));
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  return { dow, hour: Number(p.hour) % 24, date: `${p.year}-${p.month}-${p.day}` };
}

// Doit recevoir le récap maintenant ? (jour choisi, heure atteinte, pas encore reçu aujourd'hui)
export const dueForDigest = (r, now, lastSent) => r.digest && r.days.includes(now.dow) && now.hour >= r.hour && lastSent !== now.date;

export function describeSchedule(r) {
  if (!r.digest || !r.days.length) return "Pas de récapitulatif";
  const ids = WEEKDAYS.map(w => w.id).filter(id => r.days.includes(id));
  const key = ids.join(",");
  const days = key === "1,2,3,4,5" ? "du lundi au vendredi" : key === "1,2,3,4,5,6,0" ? "tous les jours" : key === "6,0" ? "le week-end"
    : "le " + ids.map(id => WEEKDAYS.find(w => w.id === id).label).join(", ").replace(/, ([^,]*)$/, " et $1");
  return `Récapitulatif ${days} à ${r.hour} h`;
}
