async def t(pg, B):
    E = pg.evaluate
    await pg.add_init_script("""
      window.__intervals = 0; const si = window.setInterval; window.setInterval = function(...a){ window.__intervals++; return si.apply(this,a) };
    """)
    await pg.goto(B + "/", wait_until="load"); await pg.wait_for_timeout(7000)
    base = await E("window.__intervals")
    # click chip twice quickly -> two pending setTimeout(startAuto,12000); startAuto calls stopAuto first so ok. But chip clicks during pending timers?
    await E("document.querySelectorAll('.hero-chip')[1].click()"); await pg.wait_for_timeout(300)
    n1 = await E("document.querySelector('.hero-now').textContent")
    await pg.wait_for_timeout(13000)
    n2 = await E("document.querySelector('.hero-now').textContent")
    print("A hero chip 01 then after 12s auto ->", n1, "->", n2, "(auto continues from index", ")")
    # Lab: ma challenge first ever result shows no toast, best display
    await pg.goto(B + "/lab/#ma", wait_until="load"); await pg.wait_for_timeout(1500)
    await E("localStorage.clear()")
    await pg.reload(); await pg.wait_for_timeout(1500)
    await E("document.querySelector('#ma-btn').click()"); await pg.wait_for_timeout(500)
    await E("document.querySelector('#ma-btn').click()"); await pg.wait_for_timeout(300)
    print("B ma history", await E("document.querySelector('#ma-history').textContent"), "best", await E("document.querySelector('#ma-best').textContent"))
    # after timeout (no press) - auto finish at 3.6s counts as a try with 1.8 diff
    await E("document.querySelector('#ma-btn').click()"); await pg.wait_for_timeout(4200)
    print("C auto-finish without pressing:", await E("document.querySelector('#ma-result').textContent"), "| history rows", await E("document.querySelectorAll('#ma-history li').length"))
    # quiz timed: answer timed-out question then toggle
    await pg.goto(B + "/lab/#quiz", wait_until="load"); await pg.wait_for_timeout(1500)
    await E("document.querySelector('#quiz-timed').click()"); await pg.wait_for_timeout(300)
    await E("document.querySelector('#tab-card').click()"); await pg.wait_for_timeout(11000)
    await E("document.querySelector('#tab-quiz').click()"); await pg.wait_for_timeout(300)
    print("D timer paused while hidden? feedback:", await E("document.querySelector('#quiz-feedback').textContent"))
    await pg.wait_for_timeout(1000)
    # score when quick: elapsed counts hidden-tab time
    await E("document.querySelector('#quiz-options button').click()")
    print("E feedback after answering (time hidden counted?)", await E("document.querySelector('#quiz-feedback strong').textContent"))
