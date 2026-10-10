# Léa presents courses: resting the pointer on a course makes her present it in her panel (wide
# screens) or in a pop-up next to her bubble (narrower screens); opening a course page shows her
# presentation with its actions; on phones, a sheet above the tab bar. The phone layout keeps the web
# design, with the navy menu in a sheet.
# Usage: python3 test_course_guide.py <output dir>  (app served on http://localhost:4173)
import asyncio, sys, re
from playwright.async_api import async_playwright
OUT = sys.argv[1]; results = []
def check(n, ok, extra=''): results.append(('PASS' if ok else 'FAIL', n, extra))
URL = 'http://localhost:4173/'

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # ---- wide screen: in Léa's panel
        ctx = await b.new_context(viewport={'width': 1440, 'height': 900})
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL, wait_until='networkidle'); await pg.evaluate('localStorage.clear()'); await pg.reload(wait_until='networkidle')
        await pg.wait_for_timeout(800)
        await pg.locator('.other').first.scroll_into_view_if_needed()
        await pg.hover('.other >> nth=0'); await pg.wait_for_timeout(1400)
        g = pg.locator('.rail .say-guide')
        check('hovering a course: Léa presents it in her panel', await g.count() == 1 and 'is-peek' in (await g.get_attribute('class') or ''))
        title = await pg.inner_text('.rail .guide-title') if await g.count() else ''
        first = await pg.inner_text('.other >> nth=0')
        check('she presents the hovered course', title and title.split(' ')[0] in first, f'{title} / {first[:30]}')
        await pg.wait_for_timeout(3800)
        txt = await pg.inner_text('.rail .guide-text')
        check('her description is typed out in full', 'Au programme' in txt and 'leçons en' in txt, txt[:90])
        await pg.mouse.move(700, 120); await pg.wait_for_timeout(1000)
        check('moving away: back to her usual line', await g.count() == 0 and await pg.locator('.rail .say').count() == 1)
        await pg.goto(URL + '#library'); await pg.wait_for_timeout(900)
        await pg.hover('.course-card >> nth=2'); await pg.wait_for_timeout(1400)
        check('library card hover: she presents it', await g.count() == 1)
        await pg.locator('.course-card .course-card-hit').nth(0).click(); await pg.wait_for_timeout(1300)
        check('opening a course: Léa presents it (not a quick peek)', await g.count() == 1 and 'is-peek' not in (await g.get_attribute('class') or ''))
        check('her presentation offers to start or continue', await g.get_by_role('button', name=re.compile('Continuer|C’est parti|Revoir')).count() >= 1)
        check('no separate pop-up while her panel is shown', await pg.locator('.guide').count() == 0)
        await pg.screenshot(path=f'{OUT}/guide_panel.png')
        await g.get_by_role('button', name='Plus tard').click(); await pg.wait_for_timeout(300)
        check('“Plus tard” closes it', await g.count() == 0)
        check('no page errors (wide)', not errs, str(errs[:2]))
        await ctx.close()

        # ---- narrower screen: Léa is a bubble, the course comes up in a pop-up
        ctx = await b.new_context(viewport={'width': 1280, 'height': 800})
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL + '#library', wait_until='networkidle'); await pg.wait_for_timeout(900)
        check('narrower screen: Léa is a floating bubble', await pg.locator('.fab').count() == 1 and await pg.locator('.rail.is-panel').count() == 0)
        await pg.hover('.course-card >> nth=1'); await pg.wait_for_timeout(1400)
        pop = pg.locator('.guide.guide-corner')
        check('hovering a course: pop-up next to her bubble', await pop.count() == 1 and 'is-peek' in (await pop.get_attribute('class') or ''))
        await pg.locator('.course-card .course-card-hit').nth(1).click(); await pg.wait_for_timeout(1300)
        check('opening a course: the pop-up stays open with its actions', await pop.count() == 1 and await pop.get_by_role('button', name='Plus tard').count() == 1)
        await pg.screenshot(path=f'{OUT}/guide_bubble.png')
        await pg.locator('.fab').click(); await pg.wait_for_timeout(500)
        check('her bubble opens her panel', await pg.locator('.rail.is-pop').count() == 1 and await pg.locator('.rail.is-pop #coach-input').count() == 1)
        await pg.keyboard.press('Escape'); await pg.wait_for_timeout(300)
        check('Escape closes her panel', await pg.locator('.rail.is-pop').count() == 0)
        check('no page errors (bubble)', not errs, str(errs[:2]))
        await ctx.close()

        # ---- phone
        m = await b.new_context(viewport={'width': 390, 'height': 844}, is_mobile=True, has_touch=True)
        mp = await m.new_page(); merrs = []
        mp.on('pageerror', lambda e: merrs.append(str(e)))
        await mp.goto(URL, wait_until='networkidle'); await mp.wait_for_timeout(1000)
        check('phone: app bar, Léa card, course hero and tab bar', all([await mp.locator(s).count() == 1 for s in ['.m-bar', '.m-lea', '.m-hero', '.m-tabs']]))
        check('phone: Léa sits in the middle of the tab bar', await mp.locator('.m-tabs .m-tab-lea img').count() == 1)
        await mp.click('.m-me'); await mp.wait_for_timeout(450)
        check('phone: the menu opens the navy sidebar in a sheet', await mp.locator('.m-sheet .side .nav-item').count() == 8)
        await mp.locator('.m-sheet').get_by_role('button', name='Bibliothèque', exact=True).click(); await mp.wait_for_timeout(800)
        check('phone: menu navigation works and closes the sheet', 'Bibliothèque' in await mp.inner_text('.m-title') and await mp.locator('.m-sheet').count() == 0)
        await mp.locator('.course-card .course-card-hit').nth(1).click(); await mp.wait_for_timeout(1300)
        check('phone: opening a course shows Léa’s sheet', await mp.locator('.guide.guide-sheet').count() == 1)
        await mp.screenshot(path=f'{OUT}/guide_phone.png')
        sw = await mp.evaluate('document.documentElement.scrollWidth')
        check('phone: no horizontal overflow', sw <= 390, str(sw))
        check('no page errors (phone)', not merrs, str(merrs[:2]))
        await b.close()
    for r in results: print(*r)
asyncio.run(main())
