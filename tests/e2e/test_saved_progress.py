# Usage: python3 test_saved_progress.py <output dir>  (needs stale.json / frozen.json from gen-states in that dir)
# Stored progress from an earlier day: the dashboard must open on the reference day, keep the
# learner's own work, stay frozen once they finished a lesson, and adopt cloud progress on a new device.
import asyncio, json, sys
from playwright.async_api import async_playwright
D = sys.argv[1].rstrip('/') + '/'
stale = open(D + 'stale.json').read(); frozen = open(D + 'frozen.json').read()
results = []
def check(n, ok, extra=''): results.append(('PASS' if ok else 'FAIL', n, extra))
URL = 'http://localhost:4173/'

async def with_local(b, state):
    ctx = await b.new_context(viewport={'width': 1440, 'height': 870})
    pg = await ctx.new_page(); errs = []
    pg.on('pageerror', lambda e: errs.append(str(e)))
    await pg.goto(URL, wait_until='networkidle')
    await pg.evaluate("s => localStorage.setItem('learnspace:v1', s)", state)
    await pg.reload(wait_until='networkidle'); await pg.wait_for_timeout(900)
    return ctx, pg, errs

async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        # A — untouched demo from two days ago, one answer given
        ctx, pg, errs = await with_local(b, stale)
        t = await pg.inner_text('.d2')
        check('A: goal shows 10 min / 10 min', '10 min' in t and '/ 10 min' in t, t[:0])
        check('A: two "+1 aujourd’hui"', t.count('+1 aujourd’hui') == 2, str(t.count('+1 aujourd’hui')))
        check('A: streak 5 jours', '5 jours' in t)
        check('A: 24 / 35 and +2 cette semaine', '24 / 35' in t and '+2 cette semaine' in t)
        st = json.loads(await pg.evaluate("localStorage.getItem('learnspace:v1')"))
        old = json.loads(stale)
        check('A: answer and lesson in progress kept', st['answerLog'] == old['answerLog'] and st['attempts'] == old['attempts'])
        check('A: version upgraded, goal 10', st['version'] == 2 and st['profile']['dailyGoalMin'] == 10)
        check('A: no page errors', not errs, str(errs[:2]))
        await ctx.close()
        # B — the learner finished a lesson: history frozen, real figures
        ctx, pg, errs = await with_local(b, frozen)
        t = await pg.inner_text('.d2')
        check('B: own lesson counted (25 / 35)', '25 / 35' in t)
        check('B: not moved to today (0 min today)', '0 min' in t and 'aucune aujourd’hui' in t)
        await ctx.close()
        # C — new device: no local copy, progress in the cloud
        ctx = await b.new_context(viewport={'width': 1440, 'height': 870})
        await ctx.add_init_script("""(() => {
          const stored = %s;
          window.__writes = [];
          const ref = { get: async () => ({ exists: true, data: () => ({ state: JSON.stringify(stored), savedAt: stored.updatedAt }) }),
                        set: async (d) => { window.__writes.push(d); } };
          window.claude = { use: async (n) => n === 'db' ? { doc: () => ref } : n === 'user' ? { id: async () => 'u_test' } : null };
        })();""" % stale)
        pg = await ctx.new_page(); errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL, wait_until='networkidle'); await pg.wait_for_timeout(1200)
        st = json.loads(await pg.evaluate("localStorage.getItem('learnspace:v1')") or 'null')
        check('C: cloud progress adopted on a new device', bool(st) and st['answerLog'] == json.loads(stale)['answerLog'], str(st and len(st['answerLog'])))
        t = await pg.inner_text('.d2')
        check('C: reference day shown', '/ 10 min' in t and t.count('+1 aujourd’hui') == 2 and '5 jours' in t)
        writes = await pg.evaluate("window.__writes.length")
        check('C: nothing overwritten in the cloud on load', writes == 0, str(writes))
        check('C: no page errors', not errs, str(errs[:2]))
        await ctx.close(); await b.close()
    for r in results: print(*r)
    print('ALL PASS' if all(r[0] == 'PASS' for r in results) else 'SOME FAILED')
asyncio.run(main())
