// Copies the production build (.build/) to the repository root, because GitHub Pages for this
// repo serves the `main` branch root ("Deploy from a branch" / legacy mode).
// Previously published entries are tracked in .published.json so stale files get removed.
import { cpSync, readdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const build = resolve(root, ".build");
const manifest = resolve(root, ".published.json");
const reserved = new Set(["site", "scripts", "data", "node_modules", "package.json", "package-lock.json", "vite.config.js", "README.md", ".git", ".gitignore", ".build", ".raw", ".published.json", ".github"]);

if (!existsSync(build)) throw new Error("Run the build first (.build/ missing).");
const previous = existsSync(manifest) ? JSON.parse(readFileSync(manifest, "utf8")) : [];
for (const name of previous) if (!reserved.has(name)) rmSync(resolve(root, name), { recursive: true, force: true });
const entries = readdirSync(build);
for (const name of entries) {
  if (reserved.has(name)) throw new Error(`Build output "${name}" collides with a source path.`);
  cpSync(resolve(build, name), resolve(root, name), { recursive: true });
}
writeFileSync(resolve(root, ".nojekyll"), "");
writeFileSync(manifest, JSON.stringify([...entries, ".nojekyll"].sort(), null, 2) + "\n");
console.log(`Published ${entries.length} entries to repo root.`);
