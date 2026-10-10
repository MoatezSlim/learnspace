# Léa's course pop-up: resting the pointer on a course card makes her present it (desktop), opening a
# course shows her presentation on both desktop and mobile, and the phone layout reuses the web design
# with the navy sidebar in a drawer.
# Usage: python3 test_course_guide.py <output dir>  (app served on http://localhost:4173)
import asyncio, sys, re
from playwright.async_api import async_playwright
OUT = sys.argv[1]; results = []
def check(n, ok, extra=''): results.append(('PASS' if ok else 'FAIL', n, extra))
URL = 'http://localhost:4173/'

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL, wait_until='networkidle'); await pg.evaluate('localStorage.clear()'); await pg.reload(wait_until='networkidle')
        await pg.wait_for_timeout(800)
        # hover on a course card (dashboard) -> peek
        await pg.hover('.d2-other >> nth=0'); await pg.wait_for_timeout(1400)
        g = pg.locator('.guide')
        check('hovering a course: Léa pops up', await g.count() == 1 and 'is-peek' in (await g.get_attribute('class') or ''))
        title = await pg.inner_text('.guide-title') if await g.count() else ''
        first = await pg.inner_text('.d2-other >> nth=0')
        check('she presents the hovered course', title.split(' ')[0] in first, f'{title} / {first[:20]}')
        await pg.wait_for_timeout(3500)
        txt = await pg.inner_text('.guide-text')
        check('her description is typed out in full', 'Au programme' in txt and 'leçons en' in txt, txt[:80])
        await pg.mouse.move(110, 520); await pg.wait_for_timeout(1000)
        check('moving away hides the peek', await g.count() == 0)
        # library hover
        await pg.goto(URL + '#library'); await pg.wait_for_timeout(800)
        await pg.hover('.course-card >> nth=2'); await pg.wait_for_timeout(1300)
        check('library card hover: pop-up', await g.count() == 1)
        # opening a course -> open mode with actions
        await pg.locator('.course-card .course-card-hit').nth(0).click(); await pg.wait_for_timeout(1200)
        check('opening a course: Léa presents it', await g.count() == 1 and 'is-peek' not in (await g.get_attribute('class') or ''))
        check('pop-up offers to start or continue', await pg.get_by_role('button', name=re.compile('Continuer|C’est parti|Revoir')).count() >= 1)
        await pg.get_by_role('button', name='Plus tard').click(); await pg.wait_for_timeout(300)
        check('“Plus tard” closes it', await g.count() == 0)
        await pg.screenshot(path=f'{OUT}/guide_closed.png')
        check('no page errors (desktop)', not errs, str(errs[:2]))
        await ctx.close()
        # phone
        m = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        mp = await m.new_page(); merrs = []
        mp.on('pageerror', lambda e: merrs.append(str(e)))
        await mp.goto(URL, wait_until='networkidle'); await mp.wait_for_timeout(1000)
        check('phone uses the web dashboard', await mp.locator('.d2.d2-mobile .d2-path').count() == 1 and await mp.locator('.bottom-nav, .m-dash').count() == 0)
        await mp.click('.m-menu'); await mp.wait_for_timeout(400)
        check('menu opens the navy sidebar', await mp.locator('.m-drawer .sidebar .nav-item').count() == 7)
        await mp.get_by_role('button', name='Bibliothèque', exact=True).click(); await mp.wait_for_timeout(700)
        check('drawer navigation works and closes', 'Bibliothèque' in await mp.inner_text('main') and await mp.locator('.m-drawer').count() == 0)
        await mp.locator('.course-card .course-card-hit').nth(1).click(); await mp.wait_for_timeout(1300)
        check('phone: opening a course shows Léa’s sheet', await mp.locator('.guide.guide-sheet').count() == 1)
        await mp.screenshot(path=f'{OUT}/guide_phone.png')
        sw = await mp.evaluate('document.documentElement.scrollWidth')
        check('phone: no horizontal overflow', sw <= 390, str(sw))
        check('no page errors (phone)', not merrs, str(merrs[:2]))
        await b.close()
    for r in results: print(*r)
asyncio.run(main())
