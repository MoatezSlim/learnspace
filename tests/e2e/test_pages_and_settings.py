# Messages, settings, courses, video lesson, failed assessment, reduced motion, keyboard access, and
# no mention of the AI model or its provider anywhere in the interface.
# Usage: python3 test_pages_and_settings.py <output dir>  (app served on http://localhost:4173)
import asyncio, sys, re, json
from playwright.async_api import async_playwright
OUT=sys.argv[1]; results=[]
def check(n, ok, extra=''): results.append(('PASS' if ok else 'FAIL', n, extra))
MOCK = r"""
(() => {
  const store = {}; window.__dbWrites = 0; window.__sampleCalls = [];
  const ref = (path) => ({ path, async get(){ const d = store[path]; return { exists: !!d, data(){ return d; }, id: path.split('/').pop(), metadata:{} }; },
                           async set(d){ window.__dbWrites++; store[path] = JSON.parse(JSON.stringify(d)); } });
  const db = Object.freeze({ doc: (p) => ref(p), collection: () => ({}) });
  const user = Object.freeze({ id: async () => 'viewer-123', isOwner: async () => true });
  const sample = async (input, opts) => {
    window.__sampleCalls.push(input);
    const full = "Bonne question ! Dans « Planning a weekend trip », Tom propose Édimbourg. Écoute la réponse à « How long is the journey? ». 💡\n[[humeur:encourageant]]\n[[action:lecon:en-b1-m4-l2]]";
    let acc = '';
    for (const ch of full.match(/.{1,12}/gs)) { await new Promise(r => setTimeout(r, 20)); acc += ch; opts && opts.onText && opts.onText({ text: acc, delta: ch }); }
    return { text: full, truncated: false, modelTierApplied: 'quick' };
  };
  window.__store = store;
  window.claude = { use: async (n) => ({ db, user, sample })[n] ?? null };
})();
"""
# text and attribute values under a selector that name the model or its provider
NAMES_JS = r"""(sel) => {
  const root = document.querySelector(sel); if (!root) return ['(missing ' + sel + ')'];
  const re = /claude|anthropic/i; const out = [];
  if (re.test(root.innerText)) out.push('text: ' + root.innerText.match(new RegExp('.{0,40}(claude|anthropic).{0,40}', 'i'))[0]);
  for (const el of root.querySelectorAll('*')) for (const a of ['title', 'aria-label', 'alt', 'placeholder', 'class']) {
    const v = el.getAttribute(a); if (v && re.test(v)) out.push(a + '=' + v);
  }
  return out;
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':1440,'height':960})
        await ctx.add_init_script(MOCK)
        pg = await ctx.new_page(); errors=[]
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type=='error' else None)
        await pg.goto('http://localhost:4173/#messages', wait_until='networkidle'); await pg.wait_for_timeout(900)
        await pg.fill('textarea', 'Je ne comprends pas la question 2'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(2500)
        last = await pg.locator('.msg-assistant').last.inner_text()
        check('live reply streamed & tags stripped', 'Édimbourg' in last and '[[' not in last, last[:160])
        check('live reply signed by Léa', 'Léa ·' in last, last[-60:])
        chat_txt = await pg.evaluate(NAMES_JS, '.chat')
        check('conversation never names the model', chat_txt == [], str(chat_txt[:3]))
        check('action chip from tag', 'Planning a weekend trip' in last)
        calls = await pg.evaluate('window.__sampleCalls')
        ctxtxt = calls[0][0]['content'] if calls else ''
        check('context sent includes progress', '"lessonsDone":24' in ctxtxt, ctxtxt[-200:])
        check('model asked to present itself as Léa', 'assistante virtuelle de LearnSpace' in ctxtxt and 'Ne nomme pas le modèle' in ctxtxt)
        await pg.wait_for_timeout(1200)
        writes = await pg.evaluate('window.__dbWrites')
        stored = await pg.evaluate("Object.keys(window.__store)")
        check('cloud write to private viewer doc', writes >= 1 and stored == ['data/users/viewer-123/learnspace'], f'{writes} {stored}')
        await pg.goto('http://localhost:4173/#settings'); await pg.wait_for_timeout(800)
        t = await pg.inner_text('main')
        check('settings shows cloud sync', 'synchronisée entre tes appareils' in t)
        live_on = await pg.get_by_role('radio', name=re.compile('Réponses en direct')).is_checked()
        check('settings: live answers chosen, model not named', live_on and 'Réponses préparées' in t and (await pg.evaluate(NAMES_JS, 'main')) == [])
        # every page, plus the course pop-up and an open lesson: no model or provider name in text or attributes
        found = []
        for h in ['', '#courses', '#library', '#progress', '#badges', '#messages', '#settings']:
            await pg.goto('http://localhost:4173/' + h); await pg.wait_for_timeout(700)
            found += [f'{h or "#home"}: {x}' for x in await pg.evaluate(NAMES_JS, 'body')]
        await pg.goto('http://localhost:4173/'); await pg.wait_for_timeout(600)
        await pg.get_by_role('button', name=re.compile('Continuer la leçon')).click(); await pg.wait_for_timeout(1200)
        found += [f'lesson: {x}' for x in await pg.evaluate(NAMES_JS, 'body')]
        title = await pg.title()
        check('no model or provider name on any page', found == [] and not re.search('claude|anthropic', title, re.I), str(found[:4]) + ' ' + title)
        # video lesson
        await pg.evaluate("localStorage.clear()")
        pg2 = await (await b.new_context(viewport={'width':1280,'height':900})).new_page()
        pg2.on('pageerror', lambda e: errors.append(str(e)))
        await pg2.goto('http://localhost:4173/#courses', wait_until='networkidle'); await pg2.wait_for_timeout(600)
        await pg2.get_by_role('button', name='Commencer', exact=True).click(); await pg2.wait_for_timeout(900)
        t = await pg2.inner_text('main')
        check('recommended lesson opens (Planning a weekend trip)', 'Listen and answer' in t)
        # open the course page and the video lesson
        await pg2.goto('http://localhost:4173/'); await pg2.wait_for_timeout(500)
        await pg2.locator('.d2-course').click(); await pg2.wait_for_timeout(900); await pg2.keyboard.press('Escape'); await pg2.wait_for_timeout(200)
        await pg2.get_by_role('button', name='Ouvrir').first.click(); await pg2.wait_for_timeout(1200)
        t = await pg2.inner_text('main')
        check('video lesson renders', 'Watch and answer' in t and await pg2.locator('video').count() == 1)
        dur = await pg2.evaluate("new Promise(r => { const v = document.querySelector('video'); if (v.readyState >= 1) r(v.duration); else v.addEventListener('loadedmetadata', () => r(v.duration)); setTimeout(() => r(-1), 4000); })")
        check('video metadata loads', dur and dur > 20, str(dur))
        await pg2.screenshot(path=f'{OUT}/l_video.png')
        # assessment failure path: module 4 lesson 5
        await pg2.goto('http://localhost:4173/'); await pg2.wait_for_timeout(400)
        await pg2.locator('.d2-course').click(); await pg2.wait_for_timeout(900); await pg2.keyboard.press('Escape'); await pg2.wait_for_timeout(200)
        btns = pg2.locator('.lesson-item', has_text='Évaluation du module 4').get_by_role('button')
        await btns.click(); await pg2.wait_for_timeout(900)
        await pg2.get_by_role('button', name=re.compile('aux questions')).click(); await pg2.wait_for_timeout(300)
        for i in range(5):
            radios = pg2.get_by_role('radio')
            if await radios.count():
                # choose a wrong answer twice -> reveal
                await radios.nth(3 if await radios.count() > 2 else 0).click(); await pg2.get_by_role('button', name='Valider', exact=True).click(); await pg2.wait_for_timeout(250)
                if await pg2.get_by_role('button', name='Valider à nouveau').count():
                    await pg2.get_by_role('link-inline').count()
                    await pg2.get_by_role('button', name='affiche la correction').click(); await pg2.wait_for_timeout(250)
            else:
                await pg2.fill('input[id^="a-"]', '999'); await pg2.get_by_role('button', name='Valider', exact=True).click(); await pg2.wait_for_timeout(250)
                await pg2.get_by_role('button', name='affiche la correction').click(); await pg2.wait_for_timeout(250)
            nxt = pg2.get_by_role('button', name=re.compile('^(Suivant|Voir le résultat)$'))
            await nxt.click(); await pg2.wait_for_timeout(400)
        t = await pg2.inner_text('main')
        check('failed assessment not validated', 'Il faut 70 %' in t, t[:200])
        await pg2.goto('http://localhost:4173/'); await pg2.wait_for_timeout(500)
        check('failed assessment does not count', '24 / 35' in await pg2.inner_text('main'))
        # reduced motion
        rm = await b.new_context(viewport={'width':1280,'height':900}, reduced_motion='reduce')
        rp = await rm.new_page(); await rp.goto('http://localhost:4173/', wait_until='networkidle'); await rp.wait_for_timeout(2500)
        cls = await rp.evaluate("document.querySelector('.app').className")
        mouths = await rp.evaluate("document.querySelectorAll('.hero-stage .rig-overlay img.on').length")
        check('reduced motion class, no mouth layers', 'reduce-motion' in cls and mouths == 0, f'{cls} {mouths}')
        # keyboard: tab to sidebar nav and activate
        await rp.keyboard.press('Tab'); await rp.keyboard.press('Tab'); await rp.keyboard.press('Tab'); await rp.keyboard.press('Tab')
        focused = await rp.evaluate("document.activeElement.textContent")
        check('keyboard reaches sidebar nav', 'Mes cours' in focused or 'Accueil' in focused, focused)
        check('no console or page errors', not errors, str(errors[:3]))
        for r in results: print(*r)
        await b.close()
asyncio.run(main())
