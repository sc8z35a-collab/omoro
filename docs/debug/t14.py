async def t(pg, B):
    E = pg.evaluate
    await pg.goto(B + "/credits/", wait_until="load"); await pg.wait_for_timeout(2000)
    await pg.mouse.move(700, 450)
    for i in range(20): await pg.mouse.wheel(0, 300); await pg.wait_for_timeout(60)
    await pg.wait_for_timeout(2500)
    print("A footer giant letters opacity", await E("[...document.querySelectorAll('.footer-giant span')].map(s=>getComputedStyle(s).opacity).join(',')"), "scrollY", await E("scrollY"), "max", await E("document.documentElement.scrollHeight-innerHeight"))
    print("A2 footer-giant top vs vh", await E("document.querySelector('.footer-giant').getBoundingClientRect().top"))
    # data-count on home: 10年 stat
    await pg.goto(B + "/", wait_until="load"); await pg.wait_for_timeout(2500)
    await pg.mouse.move(700, 450)
    for i in range(4): await pg.mouse.wheel(0, 250); await pg.wait_for_timeout(100)
    await pg.wait_for_timeout(2500)
    print("B stats", await E("[...document.querySelectorAll('[data-count]')].map(e=>e.textContent)"))
    # hash nav: footer "Archive" link from home -> same page with hash
    await E("document.querySelector('.footer-grid a[href$=\"#archive\"]').click()"); await pg.wait_for_timeout(2500)
    print("C footer Archive link on home -> hash:", await E("location.hash"), "archive top:", await E("Math.round(document.querySelector('#archive').getBoundingClientRect().top)"))
    # hero chip click then autoplay resumes: double interval?
    await E("scrollTo(0,0)"); await pg.wait_for_timeout(500)
    await E("document.querySelectorAll('.hero-chip')[3].click()"); await pg.wait_for_timeout(200)
    await E("document.querySelectorAll('.hero-chip')[4].click()"); await pg.wait_for_timeout(200)
    print("D heroNow after clicks", await E("document.querySelector('.hero-now').textContent"))
