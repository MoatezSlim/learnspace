# Screenshots of the main pages, desktop and mobile; no horizontal overflow from 1000 px to 1920 px.
# Usage: python3 test_layout.py <output dir>  (app served on http://localhost:4173)
import asyncio, sys
from playwright.async_api import async_playwright
OUT=sys.argv[1]
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await (await b.new_context(viewport={'width':1440,'height':900})).new_page(); errs=[]
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto('http://localhost:4173/', wait_until='networkidle'); await pg.evaluate("localStorage.clear()"); await pg.reload(wait_until='networkidle')
        await pg.wait_for_timeout(600)
        await pg.get_by_role('button', name='Continuer la leçon').click(); await pg.wait_for_timeout(1200)
        await pg.screenshot(path=f'{OUT}/p_lesson.png')
        for name in ['progress','messages']:
            await pg.goto(f'http://localhost:4173/#{name}'); await pg.wait_for_timeout(900)
            await pg.screenshot(path=f'{OUT}/p_{name}.png')
        m = await (await b.new_context(viewport={'width':390,'height':844}, is_mobile=True, has_touch=True)).new_page()
        await m.goto('http://localhost:4173/', wait_until='networkidle'); await m.wait_for_timeout(900)
        await m.screenshot(path=f'{OUT}/p_mobile.png')
        await m.get_by_role('button', name='Continuer la leçon').click(); await m.wait_for_timeout(900)
        await m.screenshot(path=f'{OUT}/p_mobile_lesson.png')
        for w in [1280, 1920, 1100, 1000]:
            q = await (await b.new_context(viewport={'width':w,'height':round(w*520/861)})).new_page()
            await q.goto('http://localhost:4173/', wait_until='networkidle'); await q.wait_for_timeout(700)
            sw = await q.evaluate('document.documentElement.scrollWidth')
            await q.screenshot(path=f'{OUT}/p_dash_{w}.png'); print('PASS' if sw <= w else 'FAIL', f'no horizontal overflow at {w} px', sw)
        print('PASS' if not errs else 'FAIL', 'no page errors', errs[:3])
        await b.close()
asyncio.run(main())
