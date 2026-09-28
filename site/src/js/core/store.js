// Local-only persistence. Nothing leaves the device.
const KEY_SAVED = "omoro-saved-v1";
const KEY_REACT = "omoro-reactions-v1";
const KEY_SEEN = "omoro-seen-v1";
const KEY_PREFS = "omoro-prefs-v1";
const listeners = new Set();

const read = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key)); return v ?? fallback; } catch { return fallback; } };
const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; } };
const emit = (type) => listeners.forEach((fn) => fn(type));

export const store = {
  on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  saved() { const v = read(KEY_SAVED, []); return Array.isArray(v) ? v : []; },
  isSaved(slug) { return this.saved().includes(slug); },
  toggleSaved(slug) {
    const saved = this.saved();
    const next = saved.includes(slug) ? saved.filter((s) => s !== slug) : [...saved, slug];
    const ok = write(KEY_SAVED, next);
    if (ok) emit("saved");
    return ok ? next.includes(slug) : null;
  },
  reactions(slug) { const all = read(KEY_REACT, {}); return all[slug] || { lol: 0, ma: 0, wow: 0 }; },
  react(slug, kind) {
    const all = read(KEY_REACT, {});
    const r = all[slug] || { lol: 0, ma: 0, wow: 0 };
    r[kind] = (r[kind] || 0) + 1;
    all[slug] = r;
    write(KEY_REACT, all);
    emit("react");
    return r;
  },
  markSeen(slug) { const seen = new Set(read(KEY_SEEN, [])); seen.add(slug); write(KEY_SEEN, [...seen]); emit("seen"); },
  seen() { const v = read(KEY_SEEN, []); return Array.isArray(v) ? v : []; },
  pref(key, fallback) { return read(KEY_PREFS, {})[key] ?? fallback; },
  setPref(key, value) { const p = read(KEY_PREFS, {}); p[key] = value; write(KEY_PREFS, p); emit("prefs"); }
};
