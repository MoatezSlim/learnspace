# Every page at desktop widths from 1000 px to 1920 px (Léa as a panel from 1440 px, as a bubble
# below) and on a phone: nothing overflows horizontally, the page column and Léa's panel stay inside
# the window, and screenshots are kept for review.
# Usage: python3 test_layout.py <output dir>  (app served on http://localhost:4173)
import asyncio, sys, re
from playwright.async_api import async_playwright
OUT = sys.argv[1]; results = []
def check(n, ok, extra=''): results.append(('PASS' if ok else 'FAIL', n, extra))
URL = 'http://localhost:4173/'
PAGES = ['', '#courses', '#library', '#progress', '#badges', '#messages', '#settings', '#subscription']

async def run(b, w, h, mobile=False):
    ctx = await b.new_context(viewport={'width': w, 'height': h}, is_mobile=mobile, has_touch=mobile)
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL, wait_until='networkidle'); await pg.evaluate('localStorage.clear()'); await pg.reload(wait_until='networkidle')
    bad = []
    for hsh in PAGES + ['lesson', 'course']:
        if hsh == 'lesson':
            await pg.goto(URL); await pg.wait_for_timeout(500)
            await pg.get_by_role('button', name=re.compile('(Continuer|Reprendre) la leçon')).first.click()
        elif hsh == 'course':
            await pg.goto(URL + '#courses'); await pg.wait_for_timeout(500)
            await pg.locator('.mc-cover-hit').first.click()
        else:
            await pg.goto(URL + hsh)
        await pg.wait_for_timeout(900)
        m = await pg.evaluate("""() => {
          const sw = document.documentElement.scrollWidth, iw = innerWidth;
          const over = [...document.querySelectorAll('.content *, .rail *, .side *')].filter((n) => { const r = n.getBoundingClientRect(); return r.width && r.right > iw + 1 && getComputedStyle(n).position !== 'fixed' && !n.closest('.cat-chips, .picks-cards, .others, .tabs, .seg, .st-nav, .chat-chips, .cc-menu, .m-tabs, .search-results, .hm-tip'); }).slice(0, 3).map((n) => n.className && n.className.baseVal === undefined ? n.className : n.tagName);
          return [sw, iw, over];
        }""")
        name = (hsh or '#home').strip('#')
        if m[0] > m[1] or m[2]: bad.append(f'{name}: {m[0]}>{m[1]} {m[2]}')
        await pg.screenshot(path=f'{OUT}/p_{name}_{w}{"_m" if mobile else ""}.png')
    check(f'{w} px{" (phone)" if mobile else ""}: no horizontal overflow on any page', not bad, '; '.join(bad[:3]))
    if not mobile:
        dock = 'panel' if await pg.locator('.rail.is-panel').count() else 'bubble' if await pg.locator('.fab').count() else 'none'
        check(f'{w} px: Léa shown as {"panel" if w >= 1440 else "bubble"}', dock == ('panel' if w >= 1440 else 'bubble'), dock)
    check(f'{w} px: no page errors', not errs, str(errs[:2]))
    await ctx.close()

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for w, h in [(1920, 1080), (1440, 900), (1280, 800), (1100, 760), (1000, 720)]:
            await run(b, w, h)
        await run(b, 390, 844, True)
        await run(b, 820, 1180, True)
        await b.close()
    for r in results: print(*r)
asyncio.run(main())
