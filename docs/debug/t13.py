async def t(pg, B):
    E = pg.evaluate
    await pg.goto(B + "/moments/niisan-akan/", wait_until="load"); await pg.wait_for_timeout(3000)
    await pg.mouse.move(700, 450)
    story = await E("document.querySelector('#story').offsetTop")
    for i in range(60):
        await pg.mouse.wheel(0, 200); await pg.wait_for_timeout(80)
        y = await E("scrollY")
        if i % 6 == 0:
            print(int(y), "rel", int(y - story), await E("[...document.querySelectorAll('.beat')].map(b=>b.classList.contains('is-active')?1:0).join('')"), await E("[...document.querySelectorAll('.d-beat-dots i')].map(i=>i.className?1:0).join('')"))
    for i in range(60):
        await pg.mouse.wheel(0, -200); await pg.wait_for_timeout(80)
    await pg.wait_for_timeout(1500)
    print("back top", int(await E("scrollY")), await E("[...document.querySelectorAll('.beat')].map(b=>b.classList.contains('is-active')?1:0).join('')"), await E("[...document.querySelectorAll('.d-beat-dots i')].map(i=>i.className?1:0).join('')"))
