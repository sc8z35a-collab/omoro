import raw from "../../../../data/moments.json";

export const BASE = import.meta.env.BASE_URL || "/";
export const moments = raw;
export const url = (path = "") => BASE + String(path).replace(/^\//, "");
export const momentUrl = (m) => url(`moments/${m.slug}/`);
export const img = (name, small = false) => url(`img/${name}${small ? "-sm" : ""}.webp`);
export const bySlug = (slug) => moments.find((m) => m.slug === slug);
export const speakerOf = (m) => m.speaker.split(" → ")[0];
export const normalize = (s) => String(s).normalize("NFKC").toLocaleLowerCase("ja");
export const haystack = (m) => normalize([m.title, m.speaker, m.short, m.lead, m.context, m.point, m.en, ...(m.tags || []), ...m.beats.map((b) => b.title + b.body)].join(" "));
export const search = (q) => {
  const query = normalize(q.trim());
  if (!query) return moments.slice();
  const terms = query.split(/\s+/);
  return moments.filter((m) => { const h = haystack(m); return terms.every((t) => h.includes(t)); });
};
