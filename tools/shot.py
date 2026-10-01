#!/usr/bin/env python3
"""Screenshot / console-error harness for every agent (Playwright + SwiftShader WebGL).

usage:
  python3 tools/shot.py URL_OR_PATH [more ...] [--w 1440 --h 900] [--wait 4000] [--scroll Y] [--full]
                        [--mobile] [--reduced] [--out .shots] [--eval "js"] [--fps]
  - paths like /gallery/ are resolved against --base (default http://localhost:4173)
  - prints [pageerror] / [console.error] lines and the saved PNG path
  - --fps measures requestAnimationFrame rate for 3s (SwiftShader = CPU, so expect low numbers;
    use it only for *relative* comparisons)
Then look at the PNG with the Read tool (it renders images).
"""
import asyncio, sys, argparse, os, re, time, fcntl
from playwright.async_api import async_playwright

# Global heavy-process lock shared by ALL agents (Playwright / vite build): only one at a time on 1GB RAM.
_lk = open("/tmp/omoro-heavy.lock", "w")
_t = time.time()
fcntl.flock(_lk, fcntl.LOCK_EX)
if time.time() - _t > 1: print(f"[lock] waited {time.time()-_t:.0f}s for /tmp/omoro-heavy.lock")

ap = argparse.ArgumentParser()
ap.add_argument("urls", nargs="+")
ap.add_argument("--base", default=os.environ.get("SHOT_BASE", "http://localhost:4173"))
ap.add_argument("--w", type=int, default=1440); ap.add_argument("--h", type=int, default=900)
ap.add_argument("--wait", type=int, default=4000); ap.add_argument("--scroll", type=int, default=0)
ap.add_argument("--full", action="store_true"); ap.add_argument("--mobile", action="store_true")
ap.add_argument("--reduced", action="store_true"); ap.add_argument("--fps", action="store_true")
ap.add_argument("--out", default=".shots"); ap.add_argument("--eval", default=None)
ap.add_argument("--timeout", type=int, default=90000, help="page.goto timeout ms")
a = ap.parse_args()
os.makedirs(a.out, exist_ok=True)

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist", "--enable-webgl"])
        vp = {"width": 390, "height": 844} if a.mobile else {"width": a.w, "height": a.h}
        ctx = await b.new_context(viewport=vp, device_scale_factor=1, is_mobile=a.mobile, has_touch=a.mobile,
                                  reduced_motion="reduce" if a.reduced else "no-preference")
        await ctx.add_init_script("sessionStorage.setItem('omoro-loaded','1')")  # skip the intro loader
        for u in a.urls:
            url = u if u.startswith("http") else a.base.rstrip("/") + u
            pg = await ctx.new_page()
            pg.on("pageerror", lambda e: print("[pageerror]", str(e)[:300]))
            pg.on("console", lambda m: print(f"[console.{m.type}]", m.text[:300]) if m.type in ("error", "warning") else None)
            t0 = time.time()
            try:
                await pg.goto(url, wait_until="load", timeout=a.timeout)
            except Exception as e:
                print("[goto error]", e); continue
            if a.scroll: await pg.evaluate(f"window.scrollTo(0,{a.scroll})")
            await pg.wait_for_timeout(a.wait)
            if a.eval: print("[eval]", await pg.evaluate(a.eval))
            if a.fps:
                f = await pg.evaluate("new Promise(r=>{let n=0;const s=performance.now();const k=()=>{n++;performance.now()-s<3000?requestAnimationFrame(k):r(n/3)};requestAnimationFrame(k)})")
                print(f"[fps] {f:.1f}")
            name = re.sub(r"[^a-z0-9]+", "_", url.split("//",1)[-1].lower()).strip("_")[:60]
            path = f"{a.out}/{name}_{vp['width']}x{vp['height']}{'_s'+str(a.scroll) if a.scroll else ''}.png"
            await pg.screenshot(path=path, full_page=a.full)
            print(f"[shot] {path}  ({time.time()-t0:.1f}s)")
            await pg.close()
        await b.close()
asyncio.run(main())
