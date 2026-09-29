# Debug harness (Playwright). usage: python3 run.py <test.py> [w h]
# test.py must define: async def t(pg, B)  and optionally CTX = {...}
import asyncio, sys, importlib.util
from playwright.async_api import async_playwright
B = "http://localhost:4180"
spec = importlib.util.spec_from_file_location("t", sys.argv[1]); t = importlib.util.module_from_spec(spec); spec.loader.exec_module(t)
w = int(sys.argv[2]) if len(sys.argv) > 2 else 1440; h = int(sys.argv[3]) if len(sys.argv) > 3 else 900
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"])
        ctx = await b.new_context(viewport={"width": w, "height": h}, **getattr(t, "CTX", {}))
        pg = await ctx.new_page()
        pg.on("pageerror", lambda e: print("[pageerror]", e))
        pg.on("console", lambda m: print("[console.error]", m.text[:200]) if m.type == "error" else None)
        try:
            await t.t(pg, B)
        except Exception as e:
            print("[harness error]", str(e).splitlines()[0])
        await b.close()
asyncio.run(main())
