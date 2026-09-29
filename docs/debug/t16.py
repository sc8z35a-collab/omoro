CTX = {"reduced_motion": "reduce"}
async def t(pg, B):
    E = pg.evaluate
    await pg.goto(B + "/", wait_until="load"); await pg.wait_for_timeout(2500)
    print("A reduced: hero chips visible?", await E("!document.querySelector('.hero-switch').hidden"), "chip click works?", await E("(()=>{document.querySelectorAll('.hero-chip')[2].click(); return document.querySelector('.hero-now').textContent})()"))
    print("B reduced: split titles opacity", await E("getComputedStyle(document.querySelector('#moments-heading')).opacity"))
    print("C reduced: count stats", await E("[...document.querySelectorAll('[data-count]')].map(e=>e.textContent)"))
    print("D reduced: marquee items (duplicated?)", await E("document.querySelectorAll('.marquee-item').length"))
    print("E reduced: silence text opacity", await E("getComputedStyle(document.querySelector('.silence-text')).opacity"), "timer", await E("document.querySelector('.silence-timer').textContent"))
    print("F reduced: temp chart dot count visible", await E("[...document.querySelectorAll('.temp-dot')].map(d=>getComputedStyle(d).opacity).join(',')"))
    await pg.screenshot(path="/tmp/reduced_home.png")
    await pg.goto(B + "/?nogl", wait_until="load"); await pg.wait_for_timeout(2500)
    await pg.screenshot(path="/tmp/nogl_home.png")
    print("G nogl: canvas?", await E("!!document.querySelector('.hero-canvas')"), "fallback bg", await E("getComputedStyle(document.querySelector('.hero-fallback')).backgroundImage.slice(0,40)"), "z", await E("getComputedStyle(document.querySelector('.hero-fallback')).zIndex"))
    await pg.goto(B + "/gallery/?nogl", wait_until="load"); await pg.wait_for_timeout(2500)
    await pg.screenshot(path="/tmp/nogl_gallery.png")
    print("H gallery fallback scrollable?", await E("[document.documentElement.scrollHeight, innerHeight, getComputedStyle(document.querySelector('.g-main')).position, document.querySelector('.g-fallback').scrollHeight]"))
