async def t(pg, B):
    E = pg.evaluate
    await pg.set_viewport_size({"width": 800, "height": 900})
    await pg.goto(B + "/", wait_until="load"); await pg.wait_for_timeout(2500)
    await E("document.querySelector('.menu-toggle').click()"); await pg.wait_for_timeout(800)
    await pg.set_viewport_size({"width": 1300, "height": 900}); await pg.wait_for_timeout(800)
    print("A menu open after resize:", await E("document.body.classList.contains('menu-open')"), "toggle display:", await E("getComputedStyle(document.querySelector('.menu-toggle')).display"), "menu visible:", await E("getComputedStyle(document.querySelector('.menu')).visibility"))
    await pg.goto(B + "/lab/#quiz", wait_until="load"); await pg.wait_for_timeout(1500)
    await E("localStorage.clear()"); await pg.reload(); await pg.wait_for_timeout(1500)
    for i in range(6):
        await E("""(()=>{const q=document.querySelector('#quiz-quote').textContent; const bs=[...document.querySelectorAll('#quiz-options button')]; const wrong=bs.find(b=>!(b.dataset.s && q && false)); bs[0].click(); })()""")
        await E("document.querySelector('#quiz-next').click()"); await pg.wait_for_timeout(80)
    print("B result:", await E("document.querySelector('#quiz-feedback').textContent"))
    await pg.goto(B + "/lab/#ma", wait_until="load"); await pg.wait_for_timeout(1500)
    await E("document.querySelector('#ma-btn').focus()")
    await pg.keyboard.press("Space"); await pg.wait_for_timeout(1000)
    print("C Space on focused ma button (should start):", await E("document.querySelector('#ma-state').textContent"))
