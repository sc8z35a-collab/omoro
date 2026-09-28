import { defineConfig } from "vite";
import { resolve } from "node:path";
import { readdirSync, existsSync, readFileSync } from "node:fs";

const here = import.meta.dirname;
const root = resolve(here, "site");
const base = process.env.BASE || "/";

function pages() {
  const input = {};
  const walk = (dir, prefix = "") => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (["public", "src", "partials"].includes(entry.name)) continue;
      const full = resolve(dir, entry.name);
      if (entry.isDirectory()) walk(full, prefix + entry.name + "-");
      else if (entry.name.endsWith(".html")) input[(prefix + entry.name.replace(/\.html$/, "")) || "index"] = full;
    }
  };
  walk(root);
  return input;
}

// Tiny HTML include + base token plugin:  <!--#include header -->  and  {{base}}
function partials() {
  const read = (name) => readFileSync(resolve(root, "partials", name + ".html"), "utf8");
  return {
    name: "omoro-partials",
    enforce: "pre",
    transformIndexHtml: {
      order: "pre",
      handler(html, ctx) {
        let out = html;
        for (let i = 0; i < 3; i++) out = out.replace(/<!--#include ([\w-]+) -->/g, (_, name) => read(name));
        const page = (ctx.filename || "").replace(root, "").replace(/\\/g, "/");
        out = out.replace(/data-nav="([\w-]+)"/g, (m, key) => {
          const current = (key === "home" && page === "/index.html") || (key !== "home" && page.startsWith("/" + key + "/"));
          return current ? m + ' aria-current="page"' : m;
        });
        return out.replaceAll("{{base}}", base);
      }
    },
    handleHotUpdate({ file, server }) { if (file.includes("partials")) server.ws.send({ type: "full-reload" }); }
  };
}

export default defineConfig({
  root,
  base,
  publicDir: resolve(root, "public"),
  plugins: [partials()],
  server: { fs: { allow: [here] }, allowedHosts: true },
  preview: { allowedHosts: true },
  build: { outDir: resolve(here, ".build"), emptyOutDir: true, rollupOptions: { input: pages() }, chunkSizeWarningLimit: 1400 }
});
