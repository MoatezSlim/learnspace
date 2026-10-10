# Live answers from Léa (streamed, tags removed, actions), the private cloud copy, the settings page,
# the video lesson, a failed assessment, reduced motion, keyboard access, and no mention of the AI
# model or its provider anywhere in the interface.
# Usage: python3 test_pages_and_settings.py <output dir>  (app served on http://localhost:4173)
import asyncio, sys, re
from playwright.async_api import async_playwright
OUT = sys.argv[1]; results = []
def check(n, ok, extra=''): results.append(('PASS' if ok else 'FAIL', n, extra))
URL = 'http://localhost:4173/'
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
  for (const el of root.querySelectorAll('*')) for (const a of ['title', 'aria-label', 'alt', 'placeholder', 'class', 'data-tip']) {
    const v = el.getAttribute(a); if (v && re.test(v)) out.push(a + '=' + v);
  }
  return out;
}"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1440, 'height': 960})
        await ctx.add_init_script(MOCK)
        pg = await ctx.new_page(); errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
        await pg.goto(URL + '#messages', wait_until='networkidle'); await pg.wait_for_timeout(900)
        await pg.fill('#chat-text', 'Je ne comprends pas la question 2'); await pg.keyboard.press('Enter'); await pg.wait_for_timeout(2600)
        last = await pg.locator('.chat-list .msg-lea').last.inner_text()
        check('live reply streamed, tags removed', 'Édimbourg' in last and '[[' not in last, last[:160])
        check('live reply signed by Léa', bool(re.search(r'Léa, \d', last)), last[-40:])
        check('action from the tag: open the lesson', await pg.locator('.chat-list .msg-lea').last.get_by_role('button', name=re.compile('Planning a weekend trip')).count() == 1)
        chat_txt = await pg.evaluate(NAMES_JS, '.chat-page')
        check('the conversation never names the model', chat_txt == [], str(chat_txt[:3]))
        calls = await pg.evaluate('window.__sampleCalls')
        ctxtxt = calls[0][0]['content'] if calls else ''
        check('context sent includes the progress', '"lessonsDone":24' in ctxtxt, ctxtxt[-200:])
        check('the model is asked to present itself as Léa', 'assistante virtuelle de LearnSpace' in ctxtxt and 'Ne nomme pas le modèle' in ctxtxt)
        await pg.wait_for_timeout(1200)
        writes = await pg.evaluate('window.__dbWrites')
        stored = await pg.evaluate("Object.keys(window.__store)")
        check('cloud copy in the viewer’s private document', writes >= 1 and stored == ['data/users/viewer-123/learnspace'], f'{writes} {stored}')
        await pg.goto(URL + '#settings'); await pg.wait_for_timeout(800)
        t = await pg.inner_text('main')
        check('settings: cloud sync explained', 'synchronisés entre tes appareils' in t)
        live = pg.get_by_role('switch', name='Réponses en direct')
        check('settings: live answers on, the model never named', await live.get_attribute('aria-checked') == 'true' and (await pg.evaluate(NAMES_JS, 'main')) == [])
        # settings change Léa: discreet style, floating bubble
        await pg.get_by_role('radio', name=re.compile('Discrète')).click(); await pg.wait_for_timeout(200)
        await pg.get_by_role('radio', name=re.compile('Bulle flottante')).click(); await pg.wait_for_timeout(500)
        check('settings: Léa can become a floating bubble', await pg.locator('.fab').count() == 1 and await pg.locator('.rail.is-panel').count() == 0)
        await pg.get_by_role('radio', name=re.compile('Panneau à droite')).click(); await pg.get_by_role('radio', name=re.compile('Encourageante')).click(); await pg.wait_for_timeout(400)
        check('settings: back to her panel', await pg.locator('.rail.is-panel').count() == 1)
        await pg.get_by_role('radio', name=re.compile('^15')).click(); await pg.wait_for_timeout(200)
        await pg.goto(URL); await pg.wait_for_timeout(700)
        check('settings: the daily goal changes the home page', '/ 15 min' in await pg.inner_text('main'))
        # every page, an open lesson and a course page: no model or provider name in text or attributes
        found = []
        for h in ['', '#courses', '#library', '#progress', '#badges', '#messages', '#settings', '#subscription']:
            await pg.goto(URL + h); await pg.wait_for_timeout(700)
            found += [f'{h or "#home"}: {x}' for x in await pg.evaluate(NAMES_JS, 'body')]
        await pg.goto(URL); await pg.wait_for_timeout(600)
        await pg.get_by_role('button', name=re.compile('(Continuer|Reprendre) la leçon')).click(); await pg.wait_for_timeout(1200)
        found += [f'lesson: {x}' for x in await pg.evaluate(NAMES_JS, 'body')]
        title = await pg.title()
        check('no model or provider name on any page', found == [] and not re.search('claude|anthropic', title, re.I), str(found[:4]) + ' ' + title)
        await ctx.close()

        # video lesson and failed assessment, from the course page
        pg2 = await (await b.new_context(viewport={'width': 1280, 'height': 900})).new_page()
        pg2.on('pageerror', lambda e: errors.append(str(e)))
        await pg2.goto(URL + '#courses', wait_until='networkidle'); await pg2.wait_for_timeout(600)
        await pg2.locator('.mc-featured').get_by_role('button', name=re.compile('^(Continuer|Reprendre)$')).click(); await pg2.wait_for_timeout(900)
        check('my courses: the next lesson opens (Planning a weekend trip)', 'Listen and answer' in await pg2.inner_text('main'))
        await pg2.goto(URL + '#courses'); await pg2.wait_for_timeout(500)
        await pg2.locator('.mc-cover-hit').first.click(); await pg2.wait_for_timeout(900)
        if await pg2.get_by_role('button', name='Plus tard').count(): await pg2.get_by_role('button', name='Plus tard').click()
        await pg2.get_by_role('button', name='Ouvrir : London landmarks').click(); await pg2.wait_for_timeout(1200)
        check('video lesson renders', 'Watch and answer' in await pg2.inner_text('main') and await pg2.locator('video').count() == 1)
        dur = await pg2.evaluate("new Promise(r => { const v = document.querySelector('video'); if (v.readyState >= 1) r(v.duration); else v.addEventListener('loadedmetadata', () => r(v.duration)); setTimeout(() => r(-1), 4000); })")
        check('video metadata loads', dur and dur > 20, str(dur))
        await pg2.screenshot(path=f'{OUT}/l_video.png')
        await pg2.get_by_role('button', name=re.compile('^Retour au cours')).click(); await pg2.wait_for_timeout(900)
        if await pg2.get_by_role('button', name='Plus tard').count(): await pg2.get_by_role('button', name='Plus tard').click()
        await pg2.get_by_role('button', name='Ouvrir : Évaluation du module 4').click(); await pg2.wait_for_timeout(900)
        await pg2.get_by_role('button', name=re.compile('aux questions|Commencer les questions')).click(); await pg2.wait_for_timeout(300)
        for i in range(8):
            radios = pg2.get_by_role('radio')
            if await radios.count():
                await radios.nth(3 if await radios.count() > 2 else 0).click(); await pg2.get_by_role('button', name='Valider', exact=True).click(); await pg2.wait_for_timeout(250)
                if await pg2.get_by_role('button', name='Valider à nouveau').count():
                    await pg2.get_by_role('button', name='affiche la correction').click(); await pg2.wait_for_timeout(250)
            elif await pg2.locator('input[id^="a-"]').count():
                await pg2.fill('input[id^="a-"]', '999'); await pg2.get_by_role('button', name='Valider', exact=True).click(); await pg2.wait_for_timeout(250)
                await pg2.get_by_role('button', name='affiche la correction').click(); await pg2.wait_for_timeout(250)
            nxt = pg2.get_by_role('button', name=re.compile('^(Question suivante|Voir le résultat)$'))
            if not await nxt.count(): break
            await nxt.click(); await pg2.wait_for_timeout(400)
        t = await pg2.inner_text('main')
        check('failed assessment is not validated', 'Il faut 70 %' in t and 'Retenter l’évaluation' in t, t[:200])
        await pg2.goto(URL); await pg2.wait_for_timeout(500)
        check('failed assessment does not count', '24 leçons sur 35 terminées' in await pg2.inner_text('main'))

        # reduced motion + keyboard
        rm = await b.new_context(viewport={'width': 1440, 'height': 900}, reduced_motion='reduce')
        rp = await rm.new_page(); await rp.goto(URL, wait_until='networkidle'); await rp.wait_for_timeout(1500)
        cls = await rp.evaluate("document.querySelector('.app').className")
        anim = await rp.evaluate("getComputedStyle(document.querySelector('.page')).animationDuration")
        check('reduced motion: class set, page entrance not animated', 'reduce-motion' in cls and float(anim[:-1]) < 0.01, f'{cls[:40]} {anim}')
        reached = ''
        for _ in range(8):
            await rp.keyboard.press('Tab')
            reached = await rp.evaluate("document.activeElement.classList.contains('nav-item') ? document.activeElement.textContent : ''")
            if reached: break
        check('the keyboard reaches the sidebar menu', 'Accueil' in reached, reached)
        await rp.keyboard.press('Control+k')
        check('Ctrl K focuses the search', await rp.evaluate("document.activeElement.id") == 'global-search')
        check('no console or page errors', not errors, str(errors[:3]))
        for r in results: print(*r)
        await b.close()
asyncio.run(main())
