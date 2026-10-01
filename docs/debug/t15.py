async def t(pg, B):
    E = pg.evaluate
    await pg.goto(B + "/", wait_until="load"); await pg.wait_for_timeout(2500)
    # silence timer format at progress 1 -> "00:03.0" ok; at >10? no. check 'menu' preview link list lacks 02-04,06
    print("A menu links", await E("[...document.querySelectorAll('.menu-links a')].map(a=>a.textContent)"))
    # hero chip aria & label when resizing mobile->desktop: chips labels
    await pg.set_viewport_size({"width": 700, "height": 900}); await pg.wait_for_timeout(500)
    await pg.reload(); await pg.wait_for_timeout(2500)
    await pg.set_viewport_size({"width": 1440, "height": 900}); await pg.wait_for_timeout(800)
    print("B chips after resize to desktop", await E("[...document.querySelectorAll('.hero-chip')].map(c=>c.textContent)"))
    # archive random with filter hits 1 -> ok; with zero hits? picks from all
    await E("(()=>{const i=document.querySelector('#scene-search'); i.value='zzzz'; i.dispatchEvent(new Event('input'))})()")
    print("C random when 0 results: status", await E("document.querySelector('.archive-status').textContent"))
    # tag + search combined status
    await E("(()=>{const i=document.querySelector('#scene-search'); i.value=''; i.dispatchEvent(new Event('input'))})()")
    print("D tag count", await E("document.querySelectorAll('.archive-tags button').length"))
    # temp dots are <a> with aria-hidden children but role=list container -> check roles
    print("E temp-dots role list children roles", await E("[...document.querySelector('.temp-dots').children].map(c=>c.getAttribute('role')).join(',')"))
    print("F hscroll track role=list child roles", await E("[...document.querySelector('.hscroll-track').children].map(c=>c.getAttribute('role')).join(',')"))
    # stage aria-live polite on whole article -> huge announcements; player-item aria-current
    print("G palette listbox options inside li buttons, input aria-activedescendant?", await E("document.querySelector('.palette input').getAttribute('aria-activedescendant')"))
    # detail pages og:image absolute?
    print("H og:image", await E("document.querySelector('meta[property=\"og:image\"]').content"))
    # player list keyboard: pressing ArrowRight while focus on player button changes stage & also? fine
    # count images loaded eagerly (lazy)
    print("I stage images alt", await E("[...document.querySelectorAll('.stage-img')].map(i=>i.alt)"))
    print("J duplicated ids", await E("(()=>{const m={}; document.querySelectorAll('[id]').forEach(e=>m[e.id]=(m[e.id]||0)+1); return Object.entries(m).filter(([k,v])=>v>1)})()"))
