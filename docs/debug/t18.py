async def t(pg, B):
    E = pg.evaluate
    await pg.goto(B + "/", wait_until="load"); await pg.wait_for_timeout(3000)
    # cursor press scale
    await pg.mouse.move(600, 400); await pg.wait_for_timeout(300)
    await pg.mouse.down(); await pg.wait_for_timeout(120)
    print("A cursor transform while pressed:", await E("document.querySelector('.cursor').style.transform"))
    await pg.mouse.up()
    print("A2 hero canvas cursor label:", await E("document.querySelector('.hero-canvas').dataset.cursor"))
    # arc-save stars visible before cards revealed
    await E("scrollTo(0, document.querySelector('.archive-grid').offsetTop - innerHeight + 40)"); await pg.wait_for_timeout(80)
    print("B arc opacity vs star opacity at edge:", await E("[getComputedStyle(document.querySelectorAll('.arc')[3]).opacity, getComputedStyle(document.querySelectorAll('.arc-save')[3]).opacity]"))
    # menu + palette -> lenis started while menu open
    await E("scrollTo(0,0)"); await pg.wait_for_timeout(500)
    await pg.set_viewport_size({"width": 800, "height": 900}); await pg.wait_for_timeout(500)
    await E("document.querySelector('.menu-toggle').click()"); await pg.wait_for_timeout(600)
    print("C menu open, html class:", await E("document.documentElement.className"))
    await pg.keyboard.press("Control+k"); await pg.wait_for_timeout(400); await pg.keyboard.press("Escape"); await pg.wait_for_timeout(500)
    print("C2 after palette close (menu still open?)", await E("document.body.classList.contains('menu-open')"), "html class:", await E("document.documentElement.className"))
    await pg.mouse.wheel(0, 800); await pg.wait_for_timeout(1000)
    print("C3 page scrolled behind open menu: scrollY=", await E("scrollY"))
