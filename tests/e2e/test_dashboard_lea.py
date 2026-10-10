# Dashboard + Léa: eyes follow the pointer, blinks, floating sidebar, no voice and no lip movement,
# her line typed out in the bubble, reference figures, added sections, and her reactions in a lesson
# (sad on a wrong answer, delighted on a right one). The lesson dialogue keeps its recorded audio.
# Smoothness: front expressions share the same hair (pixel-identical outside the face), the head eases
# after the pointer without jumps (and lags the eyes), expression changes dissolve over the old frame.
# Usage: python3 test_dashboard_lea.py <output dir>  (app served on http://localhost:4173)
import asyncio, sys, re, json
from playwright.async_api import async_playwright
OUT = sys.argv[1]; results = []
def check(n, ok, extra=''): results.append(('PASS' if ok else 'FAIL', n, extra))

async def iris(pg):
    return await pg.evaluate("""() => { const n = document.querySelector('.d2-lea [data-iris][data-e="0"]'); const t = n && n.getAttribute('transform') || ''; const m = t.match(/translate\\(([-\\d.]+) ([-\\d.]+)\\)/); return m ? [parseFloat(m[1]), parseFloat(m[2])] : null; }""")

async def frame(pg, sel):
    return await pg.evaluate("s => document.querySelector(s)?.dataset.frame || null", sel)

REC_START = """() => {
  const head = document.querySelector('.d2-lea .lea-head'); const out = []; let on = true;
  const iris = () => { const n = document.querySelector('.d2-lea [data-iris][data-e="0"]'); const m = (n && n.getAttribute('transform') || '').match(/translate\\(([-\\d.]+)/); return m ? parseFloat(m[1]) : 0; };
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
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width': 1440, 'height': 870})
        await ctx.add_init_script("""(() => { window.__speak = 0; try { const s = window.speechSynthesis; const orig = s.speak.bind(s); s.speak = (u) => { window.__speak++; return orig(u); }; } catch (e) {} })();""")
        pg = await ctx.new_page(); errs = []; reqs = []
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
        pg.on('request', lambda r: reqs.append(r.url.split('/')[-1]) if '/voice/' in r.url else None)
        await pg.goto('http://localhost:4173/', wait_until='networkidle'); await pg.evaluate("localStorage.clear()"); await pg.reload(wait_until='networkidle')
        # her line is typed out in the bubble
        await pg.wait_for_timeout(900)
        shown = """() => { const t = document.querySelector('.d2-bubble .typed'); if (!t) return 0; let n = t.textContent.length; t.querySelectorAll('.typed-rest').forEach((r) => { n -= r.textContent.length; }); return n; }"""
        t1 = await pg.evaluate(shown)
        await pg.wait_for_timeout(700)
        t2 = await pg.evaluate(shown)
        await pg.wait_for_timeout(2600)
        full = await pg.inner_text('.d2-bubble')
        check('bubble types her line out', 0 < t1 < t2 and 'objectifs de formation' in full, f'{t1} -> {t2}')
        # eyes follow the pointer
        await pg.mouse.move(150, 300); await pg.wait_for_timeout(450); left = await iris(pg)
        await pg.mouse.move(1430, 300); await pg.wait_for_timeout(450); right = await iris(pg)
        await pg.mouse.move(1100, 860); await pg.wait_for_timeout(450); down = await iris(pg)
        await pg.mouse.move(1100, 5); await pg.wait_for_timeout(450); up = await iris(pg)
        check('eyes follow pointer left/right', left and right and left[0] < -3 and right[0] > 3, f'{left} {right}')
        check('eyes follow pointer up/down', down and up and down[1] > 1 and up[1] < -1, f'{down} {up}')
        # head motion: record the head rotation and the iris while the pointer jumps from left to right
        await pg.mouse.move(150, 300); await pg.wait_for_timeout(1800)
        await pg.evaluate(REC_START)
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
            if await pg.evaluate("() => [...document.querySelectorAll('.d2-lea [data-lid]')].some(n => n.style.display !== 'none' && n.getAttribute('d'))"):
                blinked = True; break
            await pg.wait_for_timeout(100)
        check('she blinks', blinked)
        check('frames come from the character sheet', (await frame(pg, '.d2-lea .lea')) in ('neutral', 'smile', 'wink', 'happy'), await frame(pg, '.d2-lea .lea'))
        sb = await pg.evaluate("() => { const s = getComputedStyle(document.querySelector('.sidebar')); return [s.marginLeft, s.borderTopLeftRadius, s.boxShadow.slice(0, 30)]; }")
        check('sidebar floats with radius and shadow', float(sb[0][:-2]) > 10 and float(sb[1][:-2]) > 15 and sb[2] != 'none', str(sb))
        controls = await pg.evaluate("() => [...document.querySelectorAll('button')].filter(b => /voix|lire|play|écouter|son/i.test(b.getAttribute('aria-label') || '')).map(b => b.getAttribute('aria-label'))")
        check('no voice or play controls', controls == [], str(controls))
        check('no mouth layers (lips never move)', await pg.locator('[data-v], [data-mouth]').count() == 0)
        t = await pg.inner_text('.d2')
        check('goal shows 10 min / 10 min', '10 min' in t and '/ 10 min' in t)
        check('module label matches reference', 'Module 4 · Compréhension orale' in t)
        check('tip text matches reference', 'Pourquoi ne pas revoir la leçon sur' in t)
        check('added sections present', all(x in t for x in ['Ton activité cette semaine', 'Prochaines leçons', 'Badges récents', 'Tes autres cours']))
        check('weekly chart has 7 days', await pg.locator('.d2-week-col').count() == 7)
        # lesson: wrong answer -> sad, right answer -> delighted
        await pg.get_by_role('button', name=re.compile('Continuer la leçon')).click(); await pg.wait_for_timeout(1500)
        n0 = len(reqs)
        await pg.get_by_role('button', name='Lire l’audio').click(); await pg.wait_for_timeout(2500)
        lreq = [r for r in reqs[n0:] if r.startswith('l_')]
        pos = await pg.inner_text('.player-time')
        check('lesson dialogue keeps its recorded audio', len(lreq) >= 1 and not pos.startswith('0:00'), f'{lreq} {pos}')
        await pg.get_by_role('button', name='Mettre l’audio en pause').click()
        await pg.get_by_role('button', name=re.compile('aux questions')).click(); await pg.wait_for_timeout(500)
        await pg.get_by_role('radio', name=re.compile('A job interview')).click()
        await pg.get_by_role('button', name='Valider', exact=True).click(); await pg.wait_for_timeout(90)
        lay = await pg.evaluate("() => [...document.querySelectorAll('.lesson-stage .lea-layer')].map(l => [l.dataset.name, l.className, l.style.animationDuration])")
        own = {'thinking', 'curious', 'skeptical', 'laugh'}
        want = '560ms' if len(lay) >= 2 and (lay[-2][0] in own or lay[-1][0] in own) else '300ms'
        check('expression change dissolves over the previous frame', len(lay) >= 2 and 'is-entering' in lay[-1][1] and lay[-1][2] == want, str(lay))
        await pg.wait_for_timeout(160)
        f_quick = await frame(pg, '.lesson-stage .lea')
        await pg.wait_for_timeout(900)
        f_sad = await frame(pg, '.lesson-stage .lea')
        bub = await pg.inner_text('.lesson-bubble')
        check('wrong answer: she is sad', f_sad == 'sad' and f_quick in ('surprised', 'sad'), f'{f_quick} -> {f_sad}')
        check('wrong answer: encouraging line typed', 'Pas tout à fait' in bub, bub[:60])
        await pg.screenshot(path=f'{OUT}/l_sad.png')
        await pg.get_by_role('radio', name=re.compile('A travel plan')).click()
        await pg.get_by_role('button', name='Valider à nouveau').click(); await pg.wait_for_timeout(350)
        f_ok = await frame(pg, '.lesson-stage .lea')
        sparkle = await pg.locator('.lesson-stage .lea-effects.fx-sparkle').count()
        check('right answer: she lights up with sparkles', f_ok == 'excited' and sparkle == 1, f'{f_ok} {sparkle}')
        await pg.screenshot(path=f'{OUT}/l_happy.png')
        await pg.wait_for_timeout(2200)
        check('then settles on a happy face', (await frame(pg, '.lesson-stage .lea')) == 'happy', await frame(pg, '.lesson-stage .lea'))
        check('Léa never speaks aloud', [r for r in reqs if not r.startswith('l_')] == [] and await pg.evaluate('window.__speak') == 0, f"{[r for r in reqs if not r.startswith('l_')][:3]} speak={await pg.evaluate('window.__speak')}")
        check('no console or page errors', not errs, str(errs[:3]))
        for r in results: print(*r)
        await b.close()
asyncio.run(main())
