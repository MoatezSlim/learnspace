# Home page + Léa's panel (wide screen): her line typed out in her bubble, eyes that follow the pointer,
# a head that eases after it, blinks, the same hair on every front expression, no voice and no lip
# movement, the floating sidebar, the dashboard figures, and her reactions during a lesson (sad on a
# wrong answer, delighted with sparkles on a right one). The lesson dialogue keeps its recorded audio.
# Usage: python3 test_dashboard_lea.py <output dir>  (app served on http://localhost:4173)
import asyncio, sys, re, json
from playwright.async_api import async_playwright
OUT = sys.argv[1]; results = []
def check(n, ok, extra=''): results.append(('PASS' if ok else 'FAIL', n, extra))
LEA = '.rail-lea'

async def iris(pg):
    return await pg.evaluate("""(sel) => { const n = document.querySelector(sel + ' [data-iris][data-e="0"]'); const t = n && n.getAttribute('transform') || ''; const m = t.match(/translate\\(([-\\d.]+) ([-\\d.]+)\\)/); return m ? [parseFloat(m[1]), parseFloat(m[2])] : null; }""", LEA)

async def frame(pg, sel=LEA):
    return await pg.evaluate("s => document.querySelector(s)?.dataset.frame || null", sel)

REC_START = """(sel) => {
  const head = document.querySelector(sel + ' .lea-head'); const out = []; let on = true;
  const iris = () => { const n = document.querySelector(sel + ' [data-iris][data-e="0"]'); const m = (n && n.getAttribute('transform') || '').match(/translate\\(([-\\d.]+)/); return m ? parseFloat(m[1]) : 0; };
  const step = (t) => { if (!on) return; const m = head.style.transform.match(/rotate\\(([-\\d.]+)deg\\)/); out.push([t, m ? parseFloat(m[1]) : 0, iris()]); requestAnimationFrame(step); };
  requestAnimationFrame(step);
  window.__rec = { stop: () => { on = false; return out; } };
}"""
HAIR_JS = """async () => {
  const names = ['neutral', 'smile', 'happy', 'excited', 'delighted', 'surprised', 'sad', 'wink', 'wink2', 'content'];
  const load = (n) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = 'assets/lea/x/' + n + '.webp'; });
  const imgs = await Promise.all(names.map(load));
  const W = imgs[0].naturalWidth, H = imgs[0].naturalHeight;
  const px = imgs.map((im) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d'); g.drawImage(im, 0, 0); return g.getImageData(0, 0, W, H).data; });
  const out = {};
  for (let k = 1; k < names.length; k++) {
    let sum = 0, n = 0;
    for (let y = 0; y < H; y += 2) for (let x = 0; x < W; x += 2) {
      const dx = (x - W * 0.481) / (W * 0.36), dy = (y - H * 0.43) / (H * 0.25);
      if (dx * dx + dy * dy < 1) continue;                     // the face itself changes
      const i = (y * W + x) * 4; if (px[0][i + 3] < 10) continue;
      for (let c = 0; c < 3; c++) sum += Math.abs(px[k][i + c] - px[0][i + c]);
      n += 3;
    }
    out[names[k]] = sum / n;
  }
  return out;
}"""
TYPED = """() => { const t = document.querySelector('.rail .say .typed'); if (!t) return 0; let n = t.textContent.length; t.querySelectorAll('.typed-rest').forEach((r) => { n -= r.textContent.length; }); return n; }"""

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1440, 'height': 870})
        await ctx.add_init_script("""(() => { window.__speak = 0; try { const s = window.speechSynthesis; const orig = s.speak.bind(s); s.speak = (u) => { window.__speak++; return orig(u); }; } catch (e) {} })();""")
        pg = await ctx.new_page(); errs = []; reqs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('request', lambda r: reqs.append(r.url.split('/')[-1]) if '/voice/' in r.url else None)
        await pg.goto('http://localhost:4173/', wait_until='networkidle'); await pg.evaluate("localStorage.clear()"); await pg.reload(wait_until='networkidle')
        check('wide screen: Léa has her own panel next to the page', await pg.locator('aside.rail.is-panel').count() == 1 and await pg.locator('.fab').count() == 0)
        # her line is typed out in her bubble
        await pg.mouse.move(700, 40)
        await pg.wait_for_timeout(700)
        t1 = await pg.evaluate(TYPED)
        await pg.wait_for_timeout(600)
        t2 = await pg.evaluate(TYPED)
        await pg.wait_for_timeout(3200)
        full = await pg.inner_text('.rail .say')
        check('her line is typed out in her bubble', 0 < t1 < t2 and 'Objectif atteint' in full and 'Planning a weekend trip' in full, f'{t1} -> {t2}: {full[:70]}')
        # eyes follow the pointer
        await pg.mouse.move(150, 300); await pg.wait_for_timeout(450); left = await iris(pg)
        await pg.mouse.move(1430, 300); await pg.wait_for_timeout(450); right = await iris(pg)
        await pg.mouse.move(1000, 860); await pg.wait_for_timeout(450); down = await iris(pg)
        await pg.mouse.move(1000, 5); await pg.wait_for_timeout(450); up = await iris(pg)
        check('eyes follow the pointer left/right', left and right and left[0] < -3 and right[0] > 3, f'{left} {right}')
        check('eyes follow the pointer up/down', down and up and down[1] > 1 and up[1] < -1, f'{down} {up}')
        # head motion: the head rotation and the iris while the pointer jumps from left to right
        await pg.mouse.move(150, 300); await pg.wait_for_timeout(1800)
        await pg.evaluate(REC_START, LEA)
        await pg.mouse.move(1430, 300)
        await pg.wait_for_timeout(1500)
        rec = await pg.evaluate('window.__rec.stop()')
        rots = [r[1] for r in rec]; irs = [r[2] for r in rec]; ts = [r[0] for r in rec]
        tot = rots[-1] - rots[0]; itot = irs[-1] - irs[0]
        steps = [abs(b - a) for a, b in zip(rots, rots[1:])]
        def half(vals, total, t0):
            for t, v in zip(ts, vals):
                if total and (v - vals[0]) / total >= 0.5: return t - t0
            return 9e9
        t0 = ts[0]
        h_half, e_half = half(rots, tot, t0), half(irs, itot, t0)
        early = [(v - rots[0]) / tot for t, v in zip(ts, rots) if t - t0 <= 50] if tot else [1]
        check('head turns towards the pointer', tot > 0.8 and itot > 3, f'rot {tot:.2f} deg, iris {itot:.1f}')
        check('head moves without jumps', len(rec) > 40 and max(steps) < 0.18 * tot, f'max step {max(steps):.3f} of {tot:.2f} over {len(rec)} frames')
        check('head eases in and lags the eyes', max(early) < 0.12 and h_half > e_half + 60, f'first 50 ms {max(early):.2f}, half-way head {h_half:.0f} ms vs eyes {e_half:.0f} ms')
        hair = await pg.evaluate(HAIR_JS)
        check('front expressions share the same hair', len(hair) == 9 and max(hair.values()) < 1.5, json.dumps({k: round(v, 2) for k, v in hair.items()}))
        blinked = False
        for _ in range(90):
            if await pg.evaluate("(s) => [...document.querySelectorAll(s + ' [data-lid]')].some(n => n.style.display !== 'none' && n.getAttribute('d'))", LEA):
                blinked = True; break
            await pg.wait_for_timeout(100)
        check('she blinks', blinked)
        check('frames come from the character sheet', (await frame(pg)) in ('neutral', 'smile', 'wink', 'happy', 'content'), await frame(pg))
        sb = await pg.evaluate("() => { const s = getComputedStyle(document.querySelector('.side')); return [s.marginLeft, s.borderTopLeftRadius, s.boxShadow.slice(0, 30), s.position]; }")
        check('sidebar floats with radius and shadow', float(sb[0][:-2]) > 10 and float(sb[1][:-2]) > 15 and sb[2] != 'none' and sb[3] == 'sticky', str(sb))
        controls = await pg.evaluate("() => [...document.querySelectorAll('button')].map(b => b.getAttribute('aria-label') || '').filter(l => /voix|^lire|play|écouter|parle à voix/i.test(l))")
        check('no voice or play controls for Léa', controls == [], str(controls))
        check('no mouth layers (her lips never move)', await pg.locator('[data-v], [data-mouth]').count() == 0)
        t = await pg.inner_text('main')
        check('goal tile shows 10 / 10 min, reached', '/ 10 min' in t and 'Objectif atteint' in t)
        check('hero: course, next lesson and progress', 'Anglais – Niveau intermédiaire' in t and 'Prochaine leçon du module 4' in t and 'Planning a weekend trip' in t and '24 leçons sur 35 terminées' in t)
        check('sections present', all(x in t for x in ['Ton temps d’apprentissage', 'À suivre dans ton parcours', 'Tes autres cours', 'Badges récents']))
        check('weekly chart has 7 days', await pg.locator('.wb-col').count() == 7)
        check('her panel: plan of the day and word of the day', 'Ton plan pour aujourd’hui' in await pg.inner_text('.rail') and await pg.locator('.rail .wotd').count() == 1)
        await pg.screenshot(path=f'{OUT}/d_home.png')
        # lesson: wrong answer -> sad, right answer -> delighted
        await pg.get_by_role('button', name=re.compile('Continuer la leçon')).click(); await pg.wait_for_timeout(1500)
        n0 = len(reqs)
        await pg.get_by_role('button', name='Lire l’audio').click(); await pg.wait_for_timeout(2500)
        lreq = [r for r in reqs[n0:] if r.startswith('l_')]
        pos = await pg.inner_text('.player-time')
        check('lesson dialogue keeps its recorded audio', len(lreq) >= 1 and not pos.startswith('0:00'), f'{lreq} {pos}')
        await pg.get_by_role('button', name='Mettre l’audio en pause').click()
        await pg.get_by_role('button', name=re.compile('aux questions|Commencer les questions')).click(); await pg.wait_for_timeout(500)
        await pg.get_by_role('radio', name=re.compile('A job interview')).click()
        await pg.get_by_role('button', name='Valider', exact=True).click(); await pg.wait_for_timeout(90)
        lay = await pg.evaluate("(s) => [...document.querySelectorAll(s + ' .lea-layer')].map(l => [l.dataset.name, l.className, l.style.animationDuration])", LEA)
        own = {'thinking', 'curious', 'skeptical', 'laugh'}
        want = '560ms' if len(lay) >= 2 and (lay[-2][0] in own or lay[-1][0] in own) else '300ms'
        check('expression change dissolves over the previous frame', len(lay) >= 2 and 'is-entering' in lay[-1][1] and lay[-1][2] == want, str(lay))
        await pg.wait_for_timeout(160)
        f_quick = await frame(pg)
        await pg.wait_for_timeout(900)
        f_sad = await frame(pg)
        bub = await pg.inner_text('.rail .say')
        check('wrong answer: she is sad', f_sad == 'sad' and f_quick in ('surprised', 'sad'), f'{f_quick} -> {f_sad}')
        check('wrong answer: encouraging line in her bubble', 'Pas tout à fait' in bub, bub[:60])
        phases = await pg.evaluate("() => [...document.querySelectorAll('.phase')].map(p => p.className.replace('phase ', ''))")
        check('lesson steps: listen done, answering, correcting', phases[:3] == ['is-done', 'is-active', 'is-current'], str(phases))
        await pg.screenshot(path=f'{OUT}/l_sad.png')
        await pg.get_by_role('radio', name=re.compile('A travel plan')).click()
        await pg.get_by_role('button', name='Valider à nouveau').click(); await pg.wait_for_timeout(350)
        f_ok = await frame(pg)
        sparkle = await pg.locator(f'{LEA} .lea-effects.fx-sparkle').count()
        check('right answer: she lights up with sparkles', f_ok == 'excited' and sparkle == 1, f'{f_ok} {sparkle}')
        await pg.screenshot(path=f'{OUT}/l_happy.png')
        await pg.wait_for_timeout(2200)
        check('then settles on a happy face', (await frame(pg)) == 'happy', await frame(pg))
        check('Léa never speaks aloud', [r for r in reqs if not r.startswith('l_')] == [] and await pg.evaluate('window.__speak') == 0, f"{[r for r in reqs if not r.startswith('l_')][:3]} speak={await pg.evaluate('window.__speak')}")
        check('no console or page errors', not errs, str(errs[:3]))
        for r in results: print(*r)
        await b.close()
asyncio.run(main())
